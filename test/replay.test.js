// Replay-layer tests: the selectors must rebuild, from steps[] alone, exactly what the core computed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGrammar, analyzeRegex, runSimulation, runCompare } from '../src/replay/pipelines.ts';
import { setsAt, tableAt, conflictsOf, cellKey, nodePropsAt, followposAt, dfaAt, simAt, phaseMarkers,
  setProvenance, followposProvenance, safeguardedRejection, stepAt } from '../src/replay/selectors.ts';
import { layoutDfa, visibleEdgeLabels, overlaps } from '../src/screens/regex/dfaLayout.ts';

const EXPR = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';
const sorted = (a) => [...a].sort();

test('sets replay: empty at 0, audited fixture at the end, pure in between', () => {
  const a = analyzeGrammar(EXPR);
  const nts = a.grammar.nonterminals, n = a.setSteps.length;
  assert.deepEqual(setsAt(a.setSteps, 0, 'LEADING', nts), { E: [], T: [], F: [] });
  const L = setsAt(a.setSteps, n, 'LEADING', nts), T = setsAt(a.setSteps, n, 'TRAILING', nts);
  assert.deepEqual(sorted(L.E), sorted(['+', '*', '(', 'id']));
  assert.deepEqual(sorted(L.T), sorted(['*', '(', 'id']));
  assert.deepEqual(sorted(L.F), sorted(['(', 'id']));
  assert.deepEqual(sorted(T.E), sorted(['+', '*', ')', 'id']));
  assert.deepEqual(sorted(T.T), sorted(['*', ')', 'id']));
  assert.deepEqual(sorted(T.F), sorted([')', 'id']));
  // LEADING stays final while TRAILING is still being derived
  const mid = a.leading.steps.length + 2;
  assert.deepEqual(setsAt(a.setSteps, mid, 'LEADING', nts), a.leading.sets);
  assert.deepEqual(setsAt(a.setSteps, a.leading.steps.length, 'TRAILING', nts), { E: [], T: [], F: [] });
  // stepping forward then Back yields the identical state
  for (let k = 1; k <= n; k++) {
    const before = JSON.stringify(setsAt(a.setSteps, k - 1, 'LEADING', nts));
    setsAt(a.setSteps, k, 'LEADING', nts);
    assert.equal(JSON.stringify(setsAt(a.setSteps, k - 1, 'LEADING', nts)), before);
  }
  assert.equal(stepAt(a.setSteps, 0), null);
  const prov = setProvenance(a.setSteps, n, 'LEADING', 'E', 'id');
  assert.ok(prov.length >= 2 && prov[0].changed === true && prov.slice(1).every((p) => !p.changed));
  const marks = phaseMarkers(a.setSteps, (s) => s.phase);
  assert.deepEqual(marks.map((m) => m.label), ['LEADING', 'TRAILING']);
  assert.equal(marks[1].at, a.leading.steps.length + 1);
});

test('table replay equals the core table and keeps provenance', () => {
  const a = analyzeGrammar(EXPR);
  assert.equal(tableAt(a.table.steps, 0).size, 0);
  const cells = tableAt(a.table.steps, a.table.steps.length);
  assert.equal(cells.size, a.table.cells.size);
  for (const [k, c] of a.table.cells) assert.deepEqual(cells.get(k).relations, [...c.relations]);
  assert.equal(conflictsOf(cells).length, 0);
  const plusStar = cells.get(cellKey('+', '*'));
  assert.deepEqual(plusStar.relations, ['⋖']);
  assert.ok(plusStar.sources.every((s) => Number.isInteger(s.step) && s.rule && s.explanation));
  assert.match(plusStar.sources[0].explanation, /LEADING\(T\)/);
});

test('conflict grammar: (+,+) and (+,*) conflict, and the conflict is visible at the step it happens', () => {
  const a = analyzeGrammar('E -> E + E | E * E | ( E ) | id');
  assert.equal(a.conflictFree, false);
  const steps = a.table.steps;
  const final = tableAt(steps, steps.length);
  const keys = conflictsOf(final).map((c) => `${c.left}${c.right}`);
  assert.ok(keys.includes('++') && keys.includes('+*'));
  assert.deepEqual(sorted(a.table.conflicts.map((c) => `${c.left}${c.right}`)), sorted(keys));
  const first = steps.findIndex((s) => s.conflict) + 1;
  assert.ok(first > 0);
  assert.equal(conflictsOf(tableAt(steps, first - 1)).length, 0);
  assert.equal(conflictsOf(tableAt(steps, first)).length, 1);
  assert.equal(steps.at(-1).ok, false);
});

test('mode divergence: the safeguarded rejection point is identified', () => {
  const a = analyzeGrammar('S -> A + B\nA -> id * id\nB -> id / id');
  const cmp = runCompare(a, 'id / id + id * id');
  assert.equal(cmp.differ, true);
  const rej = safeguardedRejection(cmp);
  assert.equal(rej.step, 10); assert.equal(rej.atReduction, true);
  assert.deepEqual(rej.handle.symbols.map((h) => h.symbol), ['{B}', '+', '{A}']);
  assert.equal(safeguardedRejection(runCompare(a, 'id * id + id / id')), null);
});

test('direct-method replay: props, followpos fixture and DFA fixture', () => {
  const r = analyzeRegex('(a|b)*abb');
  assert.equal(nodePropsAt(r.propSteps, 0).size, 0);
  const props = nodePropsAt(r.propSteps, r.propSteps.length);
  for (const n of r.nodes) assert.deepEqual(props.get(n.id).firstpos, n.first);
  const pos = r.leaves.map((l) => l.pos);
  assert.deepEqual(followposAt(r.followSteps, 0, pos), { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
  assert.deepEqual(followposAt(r.followSteps, r.followSteps.length, pos), { 1: [1, 2, 3], 2: [1, 2, 3], 3: [4], 4: [5], 5: [6], 6: [] });
  assert.ok(followposProvenance(r.followSteps, r.followSteps.length, 1).length >= 2);
  assert.deepEqual(dfaAt(r.dfaSteps, 1).states.map((s) => s.name), ['A']);
  const d = dfaAt(r.dfaSteps, r.dfaSteps.length);
  assert.equal(d.done, true);
  assert.deepEqual(d.states.map((s) => [s.name, s.positions, s.accepting]),
    [['A', [1, 2, 3], false], ['B', [1, 2, 3, 4], false], ['C', [1, 2, 3, 5], false], ['D', [1, 2, 3, 6], true]]);
  assert.deepEqual(d.transitions.map((t) => `${t.from} ${t.symbol} ${t.to}`),
    ['A a B', 'A b A', 'B a B', 'B b C', 'C a B', 'C b D', 'D a B', 'D b A']);
  assert.deepEqual(d.transitions.map(({ from, symbol, to }) => ({ from, symbol, to })), r.dfa.transitions);
});

test('graph model: A loops on b only; layout is deterministic', () => {
  const { dfa } = analyzeRegex('(a|b)*abb');
  const g = layoutDfa(dfa);
  const loopA = g.edges.find((e) => e.from === 'A' && e.to === 'A');
  assert.deepEqual(loopA.symbols, ['b']); assert.equal(loopA.loop, true);
  assert.equal(g.edges.length, 8);
  assert.deepEqual(layoutDfa(dfa), g);
  assert.equal(new Set(g.nodes.map((n) => `${n.x},${n.y}`)).size, 4);
  const big = layoutDfa(analyzeRegex('(a|b)*a(a|b)(a|b)').dfa);
  assert.ok(big.nodes.length > 5);
  assert.equal(new Set(big.nodes.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`)).size, big.nodes.length);
  assert.equal(visibleEdgeLabels([{ from: 'A', to: 'B', symbol: 'a' }, { from: 'A', to: 'B', symbol: 'c' }]).get('A->B'), 'a,c');
});

test('DFA drawing: no label overlaps a label or a node, for every sample and some larger automata', () => {
  const sources = ['(a|b)*abb', 'a(b|c)*d', '(ab|a)+b?', 'a*b*c?', 'ab+', 'ab?c', 'a\\*b',
    '(a|b)*a(a|b)', '(a|b)*a(a|b)(a|b)', 'abcde', '(a|b|c)*abc', 'a(ba)*b'];
  for (const src of sources) {
    const r = analyzeRegex(src);
    assert.equal(r.status, 'ok', src);
    const g = layoutDfa(r.dfa);
    assert.deepEqual(overlaps(g), [], `${src} (${g.layout}, ${g.nodes.length} states)`);
    assert.ok(g.box.w > 0 && g.box.h > 0);
  }
});

test('simulation replay', () => {
  const { dfa } = analyzeRegex('(a|b)*abb');
  const run = runSimulation(dfa, 'abb');
  assert.equal(simAt(run.steps, 0).started, false);
  assert.deepEqual(simAt(run.steps, 2).edge, { from: 'A', to: 'B', symbol: 'a' });
  assert.equal(simAt(run.steps, 2).index, 1);
  const end = simAt(run.steps, run.steps.length);
  assert.equal(end.state, 'D'); assert.equal(end.verdict, 'ACCEPT');
  assert.equal(simAt(runSimulation(dfa, 'ab').steps, 4).verdict, 'REJECT');
});
