// Step-schema contract: the visualizer reads these fields. If an algorithm edit renames or
// drops one, these tests fail before the UI silently breaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGrammar, runParse, runCompare, analyzeRegex, runSimulation } from '../src/replay/pipelines.js';
import { MODES } from '../src/algorithms/parser.js';
import { REL } from '../src/algorithms/precedence.js';

const EXPR = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';
const str = (v) => typeof v === 'string' && v.length > 0;
const stackView = (v) => Array.isArray(v) && v.every((c) => str(c.symbol) && (c.kind === 'T' || c.kind === 'N'));
const intSet = (v) => Array.isArray(v) && v.every(Number.isInteger);

test('grammar errors carry a code, a message and a production or line reference', () => {
  const adj = analyzeGrammar('S -> A B\nA -> a\nB -> b');
  assert.equal(adj.status, 'invalid');
  for (const e of adj.errors) { assert.ok(str(e.code) && str(e.message)); assert.ok(Number.isInteger(e.productionId)); }
  const syn = analyzeGrammar('E E + T');
  assert.equal(syn.status, 'syntax');
  assert.ok(Number.isInteger(syn.errors[0].line));
  assert.equal(analyzeGrammar('   ').status, 'empty');
  const g = analyzeGrammar(EXPR).grammar;
  for (const p of g.productions) assert.ok(Number.isInteger(p.id) && Number.isInteger(p.line) && str(p.lhs) && Array.isArray(p.rhs));
});

test('LEADING/TRAILING steps: every step has phase, message and snapshot; ADD steps have provenance', () => {
  const a = analyzeGrammar(EXPR);
  assert.ok(a.setSteps.length > 0);
  for (const s of a.setSteps) {
    assert.ok(s.phase === 'LEADING' || s.phase === 'TRAILING');
    assert.ok(str(s.message));
    assert.equal(typeof s.snapshot, 'object');
    for (const n of a.grammar.nonterminals) assert.ok(Array.isArray(s.snapshot[n]));
    if (s.type === 'PASS') assert.ok(Number.isInteger(s.pass));
    if (s.type.startsWith('ADD_')) {
      assert.equal(s.type, `ADD_${s.phase}`);
      assert.ok(a.grammar.nonterminals.includes(s.nonTerminal));
      assert.ok(str(s.element) && str(s.rule));
      assert.ok(a.grammar.productions.some((p) => p.id === s.productionId));
      assert.ok(Array.isArray(s.sourceSymbols) && s.sourceSymbols.length >= 1);
      assert.equal(typeof s.changed, 'boolean');
      if (!s.changed) assert.match(s.message, /No set change/);
    }
  }
  assert.equal(a.leading.steps.at(-1).type, 'DONE');
  assert.equal(a.trailing.steps.at(-1).type, 'DONE');
});

test('precedence steps: ADD_RELATION has left/right/relation/rule/explanation; last step is VERDICT', () => {
  for (const text of [EXPR, 'E -> E + E | E * E | ( E ) | id']) {
    const { table, grammar } = analyzeGrammar(text);
    const rels = Object.values(REL);
    table.steps.slice(0, -1).forEach((s) => {
      assert.equal(s.type, 'ADD_RELATION');
      assert.ok(table.axes.includes(s.left) && table.axes.includes(s.right));
      assert.ok(rels.includes(s.relation));
      assert.match(s.rule, /^R[1-6]$/);
      assert.ok(str(s.explanation) && str(s.message));
      assert.equal(typeof s.changed, 'boolean');
      assert.equal(typeof s.conflict, 'boolean');
      assert.ok(s.productionId === null || grammar.productions.some((p) => p.id === s.productionId));
      if (['R3', 'R4', 'R5', 'R6'].includes(s.rule)) assert.ok(grammar.nonterminals.includes(s.nonTerminal));
    });
    const v = table.steps.at(-1);
    assert.equal(v.type, 'VERDICT');
    assert.equal(typeof v.ok, 'boolean');
    assert.equal(table.axes.at(-1), '$');
    for (const c of table.conflicts) assert.ok(str(c.left) && str(c.right));
  }
});

test('parser steps: SHIFT/REDUCE expose stack before/after, top, lookahead, relation; REDUCE exposes the handle', () => {
  const a = analyzeGrammar(EXPR);
  for (const mode of [MODES.CLASSIC, MODES.SAFEGUARDED]) {
    const run = runParse(a, 'id + id * id', mode);
    assert.deepEqual(run.tokens, ['id', '+', 'id', '*', 'id']);
    assert.equal(run.result, 'ACCEPT');
    run.steps.forEach((s, i) => {
      assert.equal(s.action, i + 1);
      assert.equal(s.mode, mode);
      assert.ok(str(s.message));
      assert.ok(stackView(s.stack));
      assert.ok(Number.isInteger(s.pointer));
      assert.ok(str(s.top) && str(s.lookahead));
      if (s.type === 'SHIFT' || s.type === 'REDUCE') {
        assert.ok(stackView(s.stackBefore));
        assert.ok(Object.values(REL).includes(s.relation));
      }
      if (s.type === 'REDUCE') {
        assert.ok(Number.isInteger(s.handle.from) && Number.isInteger(s.handle.to) && s.handle.to >= s.handle.from);
        assert.ok(stackView(s.handle.symbols));
        assert.deepEqual(s.stackBefore.slice(s.handle.from, s.handle.to + 1), s.handle.symbols);
        assert.ok(str(s.production.lhs) && Array.isArray(s.production.rhs));
        assert.equal(s.stack.length, s.stackBefore.length - s.handle.symbols.length + 1);
      }
    });
    const last = run.steps.at(-1);
    assert.equal(last.type, 'ACCEPT');
    assert.ok(str(last.reason));
  }
  const bad = runParse(a, 'id + x', MODES.CLASSIC);
  assert.equal(bad.result, 'REJECT'); assert.ok(str(bad.reason)); assert.deepEqual(bad.steps, []);
  const rej = runParse(a, 'id +', MODES.SAFEGUARDED);
  assert.equal(rej.steps.at(-1).type, 'REJECT'); assert.ok(str(rej.steps.at(-1).reason));
});

test('safeguarded mode shows the unit-production closure: id reduces to {E,F,T}', () => {
  const run = runParse(analyzeGrammar(EXPR), 'id', MODES.SAFEGUARDED);
  const red = run.steps.find((s) => s.type === 'REDUCE');
  assert.equal(red.stack.at(-1).symbol, '{E,F,T}');
  assert.equal(runParse(analyzeGrammar(EXPR), 'id', MODES.CLASSIC).steps.find((s) => s.type === 'REDUCE').stack.at(-1).symbol, 'N');
});

test('compareModes result shape and the spaced divergence fixtures', () => {
  const a = analyzeGrammar('S -> A + B\nA -> id * id\nB -> id / id');
  const want = { 'id * id + id / id': ['ACCEPT', 'ACCEPT'], 'id / id + id * id': ['ACCEPT', 'REJECT'],
    'id * id': ['ACCEPT', 'REJECT'], 'id + id': ['REJECT', 'REJECT'] };
  for (const [input, [c, s]] of Object.entries(want)) {
    const cmp = runCompare(a, input);
    assert.equal(cmp.classic.result, c, `classic ${input}`);
    assert.equal(cmp.safeguarded.result, s, `safeguarded ${input}`);
    assert.equal(cmp.differ, c !== s);
    assert.ok(Array.isArray(cmp.classic.steps) && Array.isArray(cmp.safeguarded.steps));
    assert.ok(cmp.firstDecisionDivergence === null || Number.isInteger(cmp.firstDecisionDivergence));
  }
});

test('direct-method steps: NODE_PROPS, ADD_FOLLOWPOS, DFA_* fields', () => {
  const r = analyzeRegex('(a|b)*abb');
  assert.equal(r.status, 'ok');
  assert.equal(r.propSteps.length + r.followSteps.length + r.dfaSteps.length, r.steps.length);
  assert.equal(r.propSteps.length, r.nodes.length);
  const ids = new Set(r.nodes.map((n) => n.id));
  for (const s of r.propSteps) {
    assert.equal(s.type, 'NODE_PROPS');
    assert.ok(ids.has(s.nodeId));
    assert.equal(typeof s.nullable, 'boolean');
    assert.ok(intSet(s.firstpos) && intSet(s.lastpos));
    assert.ok(str(s.rule) && str(s.message) && str(s.nodeLabel));
  }
  for (const s of r.followSteps) {
    assert.equal(s.type, 'ADD_FOLLOWPOS');
    assert.ok(Number.isInteger(s.position) && intSet(s.added) && ids.has(s.nodeId));
    assert.ok(str(s.rule)); assert.equal(typeof s.changed, 'boolean');
    for (const l of r.leaves) assert.ok(intSet(s.snapshot[l.pos]));
  }
  assert.equal(r.dfaSteps[0].type, 'DFA_START');
  assert.equal(r.dfaSteps.at(-1).type, 'DFA_DONE');
  for (const s of r.dfaSteps) {
    assert.ok(str(s.message));
    if (s.type === 'DFA_START') { assert.ok(str(s.state) && intSet(s.positions)); assert.equal(typeof s.accepting, 'boolean'); }
    if (s.type === 'DFA_TRANSITION') {
      assert.ok(str(s.from) && str(s.symbol) && str(s.to) && intSet(s.positions));
      assert.equal(typeof s.isNew, 'boolean'); assert.equal(typeof s.accepting, 'boolean');
    }
  }
  // tree shape the SVG renderer relies on
  for (const n of r.nodes) {
    assert.ok(['leaf', 'or', 'cat', 'star', 'plus', 'opt'].includes(n.type));
    if (n.type === 'leaf') assert.ok(Number.isInteger(n.pos) && str(n.symbol)); else assert.ok(n.children.length >= 1);
  }
  assert.equal(r.leaves.at(-1).isEnd, true);
  assert.deepEqual(Object.keys(r.dfa).sort(), ['accepting', 'alphabet', 'start', 'states', 'transitions']);
});

test('regex errors expose message and source position; simulation steps expose state/index', () => {
  const e = analyzeRegex('abc(d');
  assert.equal(e.status, 'error'); assert.equal(e.position, 3); assert.match(e.error, /position 4/);
  assert.match(analyzeRegex('a#b').error, /reserved/);
  assert.equal(analyzeRegex('').status, 'empty');
  const { dfa } = analyzeRegex('(a|b)*abb');
  const ok = runSimulation(dfa, 'abb');
  assert.deepEqual(ok.steps.map((s) => s.type), ['SIM_START', 'MOVE', 'MOVE', 'MOVE', 'ACCEPT']);
  for (const s of ok.steps) {
    assert.ok(str(s.message) && Number.isInteger(s.index));
    if (s.type === 'MOVE') assert.ok(str(s.from) && str(s.to) && str(s.symbol)); else assert.ok(str(s.state));
  }
  assert.equal(runSimulation(dfa, 'ab').result, 'REJECT');
  const dead = runSimulation(dfa, 'ac').steps.at(-1);
  assert.equal(dead.type, 'REJECT'); assert.equal(dead.symbol, 'c'); assert.equal(dead.index, 1);
});
