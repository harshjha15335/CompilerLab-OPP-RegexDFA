// Regression tests for the bugs found by the Review-1 remove-and-verify audit
// (audit/REVIEW1_REMOVE_AND_VERIFY.md). Each test failed on the code before its fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrammar, validateOperatorGrammar } from '../src/algorithms/grammar.js';
import { computeSets } from '../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../src/algorithms/precedence.js';
import { parseString, tokenize } from '../src/algorithms/parser.js';
import { parseRegex } from '../src/algorithms/regex.js';
import { buildDirect, simulateDfa } from '../src/algorithms/direct.js';

const analyse = (text) => {
  const g = parseGrammar(text).grammar;
  return { g, t: buildPrecedenceTable(g, computeSets(g, 'LEADING').sets, computeSets(g, 'TRAILING').sets) };
};
const EXPR = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';

test('B1: a grammar typed without spaces is split around its non-terminals', () => {
  const spaced = parseGrammar(EXPR).grammar;
  const glued = parseGrammar('E->E+T|T\nT->T*F|F\nF->(E)|id').grammar;
  assert.deepEqual(glued.productions.map((p) => [p.lhs, p.rhs]), spaced.productions.map((p) => [p.lhs, p.rhs]));
  assert.deepEqual([...glued.terminals].sort(), [...spaced.terminals].sort());
  // multi-character terminals written with spaces are untouched
  assert.deepEqual(parseGrammar('S -> S <= T | T\nT -> id').grammar.terminals, ['<=', 'id']);
});

test('B2: "$" cannot be a non-terminal', () => {
  const v = validateOperatorGrammar(parseGrammar('$ -> a').grammar);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.code === 'RESERVED'));
});

test('B3: mixed spacing in a test string tokenizes', () => {
  const { g, t } = analyse(EXPR);
  for (const s of ['id + id*id', 'id +id', '( id+id ) *id']) assert.equal(parseString(g, t, s).result, 'ACCEPT', s);
  assert.deepEqual(tokenize('id + id*id', g.terminals), { ok: true, tokens: ['id', '+', 'id', '*', 'id'] });
});

test('B4: whitespace-only input is the empty string, not an unknown symbol', () => {
  const { g, t } = analyse(EXPR);
  assert.equal(parseString(g, t, '   ').reason, 'Input is empty.');
});

test('B5: tokenizing backtracks when the longest match leads nowhere', () => {
  assert.deepEqual(tokenize('abcd', ['ab', 'abc', 'cd']), { ok: true, tokens: ['ab', 'cd'] });
  assert.deepEqual(tokenize('aab', ['a', 'aa', 'ab']), { ok: true, tokens: ['a', 'ab'] });
  assert.equal(tokenize('id+x', ['id', '+']).ok, false);
});

test('B6: parsing with a conflicting table returns REJECT instead of throwing', () => {
  const { g, t } = analyse('E -> E + E | E * E | ( E ) | id');
  const r = parseString(g, t, 'id+id*id');
  assert.equal(r.result, 'REJECT');
  assert.match(r.reason, /conflict/i);
});

test('B7: an unescaped space in a regex is an error, not a hidden input symbol', () => {
  const r = parseRegex('a b');
  assert.equal(r.ok, false);
  assert.equal(r.position, 1);
  assert.match(r.error, /position 2/);
  assert.equal(parseRegex('a\\ b').ok, true);   // an escaped space is still allowed
});

test('B10: every node of (a|b)*abb# matches the hand derivation (notes fixture)', () => {
  const d = buildDirect(parseRegex('(a|b)*abb').ast);
  const rows = d.nodes.map((n) => `${n.type === 'leaf' ? n.symbol + n.pos : n.type}:${n.nullable ? 'T' : 'F'}:{${n.first}}:{${n.last}}`);
  assert.deepEqual(rows, ['a1:F:{1}:{1}', 'b2:F:{2}:{2}', 'or:F:{1,2}:{1,2}', 'star:T:{1,2}:{1,2}', 'a3:F:{3}:{3}', 'cat:F:{1,2,3}:{3}',
    'b4:F:{4}:{4}', 'cat:F:{1,2,3}:{4}', 'b5:F:{5}:{5}', 'cat:F:{1,2,3}:{5}', '#6:F:{6}:{6}', 'cat:F:{1,2,3}:{6}']);
});
