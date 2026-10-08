// Regression tests for the defects in COMPILER_LAB_AUDIT (D-xx ids). Each one failed, or could not be
// written, against the code the audit examined.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_SAMPLES, EXPR_SAMPLE, MODES_SAMPLE } from '../src/data/samples.ts';
import { analyzeGrammar, analyzeRegex, runCompare, runParse, runSimulation, type OkGrammar } from '../src/replay/pipelines.ts';
import { pickCompareString } from '../src/replay/transfer.ts';
import { conflictSentence, errorPlace, relationCount, verdictDetail } from '../src/replay/wording.ts';
import { grammarWarnings } from '../src/replay/warnings.ts';
import { edgeLabel, edgesThroughStates, graphSummary, GRAPH_STATE_LIMIT, layoutDfa, overlaps, visibleEdgeLabels } from '../src/screens/regex/dfaLayout.ts';
import { MAX_DFA_STATES, MAX_REGEX_LENGTH, MAX_REGEX_NESTING } from '../src/core/index.ts';

const ok = (text: string) => {
  const a = analyzeGrammar(text);
  assert.equal(a.status, 'ok', text);
  return a as OkGrammar;
};

test('D-05: stage 1 → stage 5 hands over a sentence of the grammar, never its terminal list', () => {
  const expr = ok(EXPR_SAMPLE.text);
  const terminals = expr.grammar.terminals.join(' ');
  // the old behaviour: the terminal list, which the grammar rejects
  assert.equal(runParse(expr, terminals, 'safeguarded').result, 'REJECT');
  const s = pickCompareString(expr, [terminals, ...EXPR_SAMPLE.strings]);
  assert.notEqual(s, terminals);
  assert.equal(runParse(expr, s, 'safeguarded').result, 'ACCEPT');
  assert.equal(runCompare(expr, s).safeguarded.result, 'ACCEPT');
  // the string actually being parsed wins when it is valid
  assert.equal(pickCompareString(expr, ['( id + id ) * id', 'id']), '( id + id ) * id');
  // nothing valid: '' (the UI then asks), never a guess
  assert.equal(pickCompareString(expr, ['id id', '', '+ +']), '');
  // a grammar with conflicts cannot be compared at all
  const conflict = ok(GRAMMAR_SAMPLES.find((g) => g.kind === 'conflict')!.text);
  assert.equal(pickCompareString(conflict, ['id + id']), '');
  // the modes sample still opens on its own divergent string
  assert.ok(runCompare(ok(MODES_SAMPLE.text), MODES_SAMPLE.compare!).differ);
});

test('D-08: conflict wording counts the relations actually in each cell', () => {
  assert.equal(relationCount(2), 'two relations');
  assert.equal(relationCount(3), 'three relations');
  assert.equal(relationCount(1), 'one relation');
  assert.equal(conflictSentence([{ left: '+', right: '+', relations: ['⋖', '⋗'] }]), '(+, +) holds two relations.');
  assert.equal(conflictSentence([
    { left: '+', right: '+', relations: ['⋖', '⋗'] }, { left: 'a', right: 'b', relations: ['⋖', '⋗', '≐'] }, { left: '*', right: '*', relations: ['⋖', '⋗'] },
  ], 'Cell '), 'Cell (a, b) holds three relations; Cell (+, +), Cell (*, *) each hold two relations.');
  // a real three-relation cell from the core
  const g = ok('S -> a S b | a b | a S | S b');
  const three = g.table.conflicts.map((c) => ({ ...c, relations: g.table.get(c.left, c.right) })).find((c) => c.relations.length === 3);
  assert.ok(three, 'grammar has a three-relation cell');
  assert.equal(conflictSentence([three!]), '(a, b) holds three relations.');
});

test('D-09: the verdict detail drops the shouted headline but keeps the cell list', () => {
  const conflict = ok(GRAMMAR_SAMPLES.find((g) => g.kind === 'conflict')!.text);
  const v = conflict.table.steps.at(-1)!;
  assert.equal(v.type, 'VERDICT');
  const detail = verdictDetail(v.message, false);
  assert.match(detail, /^Conflicting cells: \(/);
  assert.doesNotMatch(detail, /NOT AN OPERATOR/);
  // the core's message itself is unchanged (algorithm output stays identical)
  assert.match(v.message, /^NOT AN OPERATOR-PRECEDENCE GRAMMAR\. Conflicting cells: /);
  assert.equal(verdictDetail('No cell holds more than one relation: this is an operator-precedence grammar.', true),
    'No cell holds more than one relation: this is an operator-precedence grammar.');
});

test('D-10: error positions are stated in characters, and the end of input is named as such', () => {
  const r = analyzeRegex('a(');
  assert.equal(r.status, 'error');
  assert.equal(errorPlace('a(', (r as { position: number }).position), 'At the end of the expression, after character 2.');
  assert.equal(errorPlace('a)b', 1), 'At character 2 of 3 (counted in characters).');
  assert.equal(errorPlace('😀)', 1), 'At character 2 of 2 (counted in characters).');
  assert.equal(errorPlace('anything', null), '');
});

test('D-11: deep nesting and long input give a friendly diagnostic, never a stack overflow', () => {
  const nest = (d: number) => '('.repeat(d) + 'a' + ')'.repeat(d);
  assert.equal(analyzeRegex(nest(MAX_REGEX_NESTING)).status, 'ok');
  const over = analyzeRegex(nest(MAX_REGEX_NESTING + 1));
  assert.equal(over.status, 'error');
  assert.match((over as { error: string }).error, new RegExp(`more than ${MAX_REGEX_NESTING} levels`));
  for (const d of [2_000, 10_000]) {
    const r = analyzeRegex(nest(d));
    assert.equal(r.status, 'error', `depth ${d}`);
    assert.doesNotMatch((r as { error: string }).error, /call stack|Maximum/i);
  }
  assert.equal(analyzeRegex('a'.repeat(MAX_REGEX_LENGTH)).status, 'ok');
  const long = analyzeRegex('a'.repeat(MAX_REGEX_LENGTH + 1));
  assert.equal(long.status, 'error');
  assert.match((long as { error: string }).error, new RegExp(`limit is ${MAX_REGEX_LENGTH}`));
  assert.doesNotMatch((analyzeRegex('a'.repeat(5000)) as { error: string }).error, /call stack|Maximum/i);
});

test('D-12: a symbol outside the Basic Multilingual Plane is one symbol and one position', () => {
  const r = analyzeRegex('😀a*');
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  assert.deepEqual(r.leaves.filter((l) => !l.isEnd).map((l) => l.symbol), ['😀', 'a']);
  assert.deepEqual(r.dfa.alphabet.sort(), ['a', '😀'].sort());
  assert.equal(runSimulation(r.dfa, '😀aa').result, 'ACCEPT');
  assert.equal(runSimulation(r.dfa, 'a😀').result, 'REJECT');
  const sim = runSimulation(r.dfa, '😀');
  assert.equal(sim.steps.at(-1)!.index, 1);           // one character read, not two UTF-16 units
});

test('D-13: edge labels quote the comma, so "a,c" can never be misread', () => {
  assert.equal(visibleEdgeLabels([{ from: 'A', to: 'B', symbol: 'a' }, { from: 'A', to: 'B', symbol: 'c' }]).get('A->B'), 'a,c');
  assert.equal(edgeLabel([',', 'a']), "',',a");
  assert.equal(edgeLabel([' ']), "' '");
  const r = analyzeRegex('(a|\\,)*b');
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  const labels = visibleEdgeLabels(r.dfa.transitions);
  assert.ok([...labels.values()].some((l) => l.includes("','")), [...labels.values()].join(' / '));
  assert.deepEqual(overlaps(layoutDfa(r.dfa)), []);
});

test('D-14: grammars that pass the operator rules but cannot derive anything useful are explained', () => {
  const none = ok('S -> A\nA -> S');
  assert.deepEqual(grammarWarnings(none.grammar).map((w) => w.code), ['NO_TERMINALS']);
  const unreachable = ok('S -> a\nB -> b');
  assert.deepEqual(grammarWarnings(unreachable.grammar).map((w) => [w.code, w.symbols]), [['UNREACHABLE', ['B']]]);
  const dead = ok('S -> a | S + A\nA -> A * b');
  assert.deepEqual(grammarWarnings(dead.grammar).map((w) => [w.code, w.symbols]), [['NON_PRODUCTIVE', ['A']]]);
  for (const s of GRAMMAR_SAMPLES.filter((g) => g.kind !== 'invalid')) assert.deepEqual(grammarWarnings(ok(s.text).grammar), [], s.title);
});

test('D-26: a DFA beyond the state cap stops with a plain message instead of freezing', () => {
  const blowup = '(a|b)*a' + '(a|b)'.repeat(9);                 // 1,024 states
  const t = performance.now();
  const r = analyzeRegex(blowup);
  assert.ok(performance.now() - t < 5_000);
  assert.equal(r.status, 'error');
  assert.match((r as { error: string }).error, new RegExp(`more than ${MAX_DFA_STATES} states`));
  assert.equal((r as { position: number | null }).position, null);
  // just under the cap still builds, and every state is kept (no silent truncation)
  const fine = analyzeRegex('(a|b)*a' + '(a|b)'.repeat(7));      // 256 states
  assert.equal(fine.status, 'ok');
  if (fine.status === 'ok') assert.equal(fine.dfa.states.length, 256);
});

test('D-25: large DFAs get a deterministic layered drawing with no overlaps and no edge through a state', () => {
  for (const k of [2, 3, 4, 5]) {
    const r = analyzeRegex('(a|b)*a' + '(a|b)'.repeat(k));
    assert.equal(r.status, 'ok');
    if (r.status !== 'ok') continue;
    const g = layoutDfa(r.dfa);
    assert.equal(g.layout, 'layered', `${2 ** (k + 1)} states`);
    assert.deepEqual(overlaps(g), [], `${r.dfa.states.length} states`);
    assert.deepEqual(edgesThroughStates(g), [], `${r.dfa.states.length} states`);
    assert.deepEqual(layoutDfa(r.dfa), g, 'deterministic');
  }
  // the samples keep their row layout and stay clean
  for (const src of ['(a|b)*abb', 'a(b|c)*d', '(ab|a)+b?', 'a*b*c?', 'ab+', 'ab?c', 'a\\*b']) {
    const r = analyzeRegex(src);
    if (r.status !== 'ok') continue;
    const g = layoutDfa(r.dfa);
    assert.equal(g.layout, 'row');
    assert.deepEqual(edgesThroughStates(g), [], src);
  }
  assert.ok(GRAPH_STATE_LIMIT < MAX_DFA_STATES);
});

test('D-35: the accessible summary describes only what is drawn so far', () => {
  const r = analyzeRegex('(a|b)*abb');
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  const dfa = r.dfa;
  const early = graphSummary(dfa, new Set(['A', 'B']), dfa.transitions.filter((t) => t.from === 'A'));
  assert.match(early, /so far: 2 states/);
  assert.doesNotMatch(early, /\bD\b/);                         // the accepting state is not revealed early
  assert.match(early, /Accepting: none yet/);
  const done = graphSummary(dfa, new Set(dfa.states.map((s) => s.name)), dfa.transitions);
  assert.match(done, /^DFA with 4 states/);
  assert.match(done, /Accepting: D/);
  assert.equal(graphSummary(dfa, new Set(), []), 'DFA drawing: no state yet.');
});
