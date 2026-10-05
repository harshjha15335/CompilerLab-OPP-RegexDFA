import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGrammar, validateOperatorGrammar } from '../src/algorithms/grammar.js';
import { computeSets } from '../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../src/algorithms/precedence.js';
import { parseString, compareModes, MODES } from '../src/algorithms/parser.js';

const setup = (text) => {
  const { grammar } = parseGrammar(text);
  const leading = computeSets(grammar, 'LEADING'), trailing = computeSets(grammar, 'TRAILING');
  const table = buildPrecedenceTable(grammar, leading.sets, trailing.sets);
  return { grammar, leading, trailing, table };
};
const sorted = (a) => [...a].sort();
const EXPR = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';

test('expression grammar LEADING/TRAILING', () => {
  const { leading, trailing } = setup(EXPR);
  assert.deepEqual(sorted(leading.sets.E), sorted(['+', '*', '(', 'id']));
  assert.deepEqual(sorted(leading.sets.T), sorted(['*', '(', 'id']));
  assert.deepEqual(sorted(leading.sets.F), sorted(['(', 'id']));
  assert.deepEqual(sorted(trailing.sets.E), sorted(['+', '*', ')', 'id']));
  assert.deepEqual(sorted(trailing.sets.T), sorted(['*', ')', 'id']));
  assert.deepEqual(sorted(trailing.sets.F), sorted([')', 'id']));
  assert.ok(leading.steps.some((s) => s.type === 'ADD_LEADING' && s.changed === false), 'duplicate discoveries are recorded');
});

test('expression grammar table is conflict-free with known cells', () => {
  const { table } = setup(EXPR);
  assert.equal(table.verdict, 'OPERATOR_PRECEDENCE');
  assert.deepEqual(table.get('+', '*'), ['⋖']);
  assert.deepEqual(table.get('*', '+'), ['⋗']);
  assert.deepEqual(table.get('+', '+'), ['⋗']);
  assert.deepEqual(table.get('(', ')'), ['≐']);
  assert.deepEqual(table.get('$', 'id'), ['⋖']);
  assert.deepEqual(table.get('id', '$'), ['⋗']);
  assert.deepEqual(table.get('id', 'id'), []);
});

test('expression grammar parses', () => {
  const { grammar, table } = setup(EXPR);
  for (const m of [MODES.CLASSIC, MODES.SAFEGUARDED]) {
    assert.equal(parseString(grammar, table, 'id+id*id', m).result, 'ACCEPT', m);
    assert.equal(parseString(grammar, table, '(id+id)*id', m).result, 'ACCEPT', m);
    assert.equal(parseString(grammar, table, 'id+', m).result, 'REJECT', m);
    assert.equal(parseString(grammar, table, '(id', m).result, 'REJECT', m);
  }
  const r = parseString(grammar, table, 'id+id*id', MODES.SAFEGUARDED);
  assert.ok(r.steps.some((s) => s.type === 'REDUCE' && s.handle), 'reduce steps carry the handle');
});

test('ambiguous grammar is NOT operator-precedence', () => {
  const { table } = setup('E -> E + E | E * E | ( E ) | id');
  assert.equal(table.verdict, 'NOT_OPERATOR_PRECEDENCE');
  assert.deepEqual(table.get('+', '+').sort(), ['⋖', '⋗']);
  assert.deepEqual(table.get('+', '*').sort(), ['⋖', '⋗']);
  assert.ok(table.steps.some((s) => s.conflict));
  assert.match(table.steps.at(-1).message, /NOT AN OPERATOR-PRECEDENCE GRAMMAR/);
});

test('invalid operator grammars are rejected with clear messages', () => {
  const adj = validateOperatorGrammar(parseGrammar('S -> A B\nA -> a\nB -> b').grammar);
  assert.equal(adj.ok, false);
  assert.equal(adj.errors[0].code, 'ADJACENT_NONTERMINALS');
  assert.match(adj.errors[0].message, /A B/);
  const eps = validateOperatorGrammar(parseGrammar('S -> A a\nA -> ε | b').grammar);
  assert.equal(eps.ok, false);
  assert.equal(eps.errors[0].code, 'EPSILON');
  assert.equal(validateOperatorGrammar(parseGrammar(EXPR).grammar).ok, true);
});

const AB = 'S -> A + B\nA -> id * id\nB -> id / id';
test('Classic N vs Safeguarded regression', () => {
  const { grammar, table } = setup(AB);
  assert.equal(table.verdict, 'OPERATOR_PRECEDENCE');
  const want = {
    'id*id+id/id': ['ACCEPT', 'ACCEPT'], 'id/id+id*id': ['ACCEPT', 'REJECT'],
    'id*id+id*id': ['ACCEPT', 'REJECT'], 'id/id+id/id': ['ACCEPT', 'REJECT'],
    'id*id': ['ACCEPT', 'REJECT'], 'id/id': ['ACCEPT', 'REJECT'],
    'id+id': ['REJECT', 'REJECT'], 'id*id+id': ['REJECT', 'REJECT'],
  };
  for (const [inp, [c, s]] of Object.entries(want)) {
    assert.equal(parseString(grammar, table, inp, MODES.CLASSIC).result, c, `classic ${inp}`);
    assert.equal(parseString(grammar, table, inp, MODES.SAFEGUARDED).result, s, `safeguarded ${inp}`);
  }
  const cmp = compareModes(grammar, table, 'id/id+id*id');
  assert.equal(cmp.firstStateDivergence, 4);
  assert.equal(cmp.firstDecisionDivergence, 10);
  assert.equal(cmp.classic.steps[9].semanticId, 'final-start-production-reduction');
  assert.equal(cmp.classic.steps[9].type, 'REDUCE');
  assert.equal(cmp.safeguarded.steps[9].type, 'REJECT');
});
