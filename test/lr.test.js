import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLr0, buildSlrTable, computeFirstFollow, itemKey, parseLr, prepareLrGrammar } from '../src/algorithms/lr.js';
import { parseRegex } from '../src/algorithms/regex.js';
import { buildDirect, treeSteps } from '../src/algorithms/direct.js';

const EXPR = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';
function analyse(text) {
  const p = prepareLrGrammar(text);
  assert.ok(p.ok, JSON.stringify(p.errors));
  const ff = computeFirstFollow(p.grammar);
  const lr0 = buildLr0(p.augmented);
  const table = buildSlrTable(p.augmented, lr0, ff.follow);
  return { ...p, ...ff, lr0, table, parse: (s) => parseLr(p.augmented, table, s.split(' ').filter(Boolean)) };
}
const cell = (t, s, a) => t.get(s, a).map((x) => (x.kind === 'shift' ? `s${x.to}` : x.kind === 'reduce' ? `r${x.prod}` : x.kind === 'accept' ? 'acc' : `${x.to}`)).join('/');

test('expression grammar: augmented with E\' → E as production 0', () => {
  const a = analyse(EXPR);
  assert.equal(a.augmented.start, "E'");
  assert.deepEqual(a.augmented.productions[0], { id: 0, lhs: "E'", rhs: ['E'], line: 0 });
  assert.equal(a.augmented.productions.length, 7);
});

test('expression grammar: FIRST and FOLLOW match the textbook', () => {
  const a = analyse(EXPR);
  for (const n of ['E', 'T', 'F']) assert.deepEqual([...a.first[n]].sort(), ['(', 'id']);
  assert.deepEqual([...a.follow.E].sort(), ['$', ')', '+']);
  assert.deepEqual([...a.follow.T].sort(), ['$', ')', '*', '+']);
  assert.deepEqual([...a.follow.F].sort(), ['$', ')', '*', '+']);
});

test('expression grammar: 12 LR(0) item sets, I0 closure and the textbook SLR table', () => {
  const a = analyse(EXPR);
  assert.equal(a.lr0.states.length, 12);
  assert.deepEqual(a.lr0.states[0].items.map(itemKey), ['0.0', '1.0', '2.0', '3.0', '4.0', '5.0', '6.0']);
  const t = a.table;
  assert.equal(t.conflicts.length, 0);
  assert.equal(cell(t, 0, 'id'), 's5'); assert.equal(cell(t, 0, '('), 's4');
  assert.equal(cell(t, 0, 'E'), '1'); assert.equal(cell(t, 0, 'T'), '2'); assert.equal(cell(t, 0, 'F'), '3');
  assert.equal(cell(t, 1, '+'), 's6'); assert.equal(cell(t, 1, '$'), 'acc');
  assert.equal(cell(t, 2, '+'), 'r2'); assert.equal(cell(t, 2, '*'), 's7'); assert.equal(cell(t, 2, ')'), 'r2'); assert.equal(cell(t, 2, '$'), 'r2');
  assert.equal(cell(t, 5, '*'), 'r6');
  assert.equal(cell(t, 9, '*'), 's7'); assert.equal(cell(t, 9, '+'), 'r1');
  assert.equal(cell(t, 11, '$'), 'r5');
});

test('expression grammar: parses accept and reject as expected', () => {
  const a = analyse(EXPR);
  const r = a.parse('id + id * id');
  assert.equal(r.result, 'ACCEPT');
  assert.deepEqual(r.steps.map((s) => (s.type === 'REDUCE' ? `r${s.production.id}` : s.type[0])),
    ['S', 'r6', 'r4', 'r2', 'S', 'S', 'r6', 'r4', 'S', 'S', 'r6', 'r3', 'r1', 'A']);
  assert.equal(a.parse('( id + id ) * id').result, 'ACCEPT');
  assert.equal(a.parse('id + * id').result, 'REJECT');
  assert.equal(a.parse('( id').result, 'REJECT');
  assert.equal(a.parse('').result, 'REJECT');
});

test('S → L = R | R is not SLR(1): shift/reduce conflict on = in I2', () => {
  const a = analyse('S -> L = R | R\nL -> * R | id\nR -> L');
  assert.deepEqual(a.table.conflicts, [{ state: 2, symbol: '=' }]);
  assert.equal(cell(a.table, 2, '='), 's6/r5');
  const v = a.table.steps.at(-1);
  assert.equal(v.type, 'VERDICT'); assert.equal(v.ok, false);
});

test('ε-productions and adjacent non-terminals are fine for LR', () => {
  const b = analyse('S -> ( S ) S | ε');
  assert.deepEqual([...b.first.S].sort(), ['(', 'ε']);
  assert.deepEqual([...b.follow.S].sort(), ['$', ')']);
  assert.equal(b.table.conflicts.length, 0);
  for (const [s, want] of [['( ) ( )', 'ACCEPT'], ['( ( ) )', 'ACCEPT'], ['', 'ACCEPT'], ['( ( )', 'REJECT'], [')', 'REJECT']]) assert.equal(b.parse(s).result, want, s);
  const c = analyse('S -> A B\nA -> a\nB -> b');
  assert.equal(c.table.conflicts.length, 0);
  assert.equal(c.parse('a b').result, 'ACCEPT');
  assert.equal(c.parse('b a').result, 'REJECT');
});

test('LR grammar errors: "$" is reserved, empty input is empty', () => {
  assert.equal(prepareLrGrammar('S -> a $').ok, false);
  assert.equal(prepareLrGrammar('').errors[0].code, 'EMPTY');
  assert.equal(prepareLrGrammar("S -> S' a\nS' -> b").augmented.start, "S''");
});

test('every step carries a message, and FIRST/FOLLOW snapshots only grow', () => {
  const a = analyse(EXPR);
  for (const s of [...a.steps, ...a.lr0.steps, ...a.table.steps, ...a.parse('id * id').steps]) assert.equal(typeof s.message, 'string');
  let prev = 0;
  for (const s of a.steps) {
    const n = Object.values(s.snapshot.first).flat().length + Object.values(s.snapshot.follow).flat().length;
    assert.ok(n >= prev); prev = n;
  }
});

test('syntax tree steps: one node per step, children before parents, positions left to right', () => {
  const p = parseRegex('(a|b)*abb');
  const d = buildDirect(p.ast);
  const steps = treeSteps(d.root, d.nodes);
  assert.equal(steps.length, d.nodes.length);
  const seen = new Set();
  for (const s of steps) {
    const n = d.nodes.find((x) => x.id === s.nodeId);
    for (const c of n.children ?? []) assert.ok(seen.has(c.id), 'child built first');
    seen.add(n.id);
  }
  assert.deepEqual(steps.filter((s) => s.type === 'TREE_LEAF' || s.type === 'TREE_END').map((s) => s.pos), [1, 2, 3, 4, 5, 6]);
  assert.equal(steps.at(-2).type, 'TREE_END');
  assert.equal(steps.at(-1).type, 'TREE_ROOT');
});
