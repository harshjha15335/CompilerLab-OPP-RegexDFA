import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRegex } from '../src/algorithms/regex.js';
import { buildDirect, simulateDfa } from '../src/algorithms/direct.js';

const build = (re) => { const p = parseRegex(re); assert.ok(p.ok, p.error); return buildDirect(p.ast); };

test('(a|b)*abb# followpos and DFA match the textbook answer', () => {
  const r = build('(a|b)*abb');
  assert.deepEqual(r.leaves.map((l) => `${l.symbol}${l.pos}`), ['a1', 'b2', 'a3', 'b4', 'b5', '#6']);
  assert.deepEqual(r.followpos, { 1: [1, 2, 3], 2: [1, 2, 3], 3: [4], 4: [5], 5: [6], 6: [] });
  assert.deepEqual(r.root.first, [1, 2, 3]);
  const { dfa } = r;
  assert.deepEqual(dfa.states.map((s) => [s.name, s.positions]), [['A', [1, 2, 3]], ['B', [1, 2, 3, 4]], ['C', [1, 2, 3, 5]], ['D', [1, 2, 3, 6]]]);
  assert.deepEqual(dfa.accepting, ['D']);
  const T = Object.fromEntries(dfa.transitions.map((t) => [`${t.from}${t.symbol}`, t.to]));
  assert.deepEqual(T, { Aa: 'B', Ab: 'A', Ba: 'B', Bb: 'C', Ca: 'B', Cb: 'D', Da: 'B', Db: 'A' });
});

test('node properties for (a|b)*abb#', () => {
  const r = build('(a|b)*abb');
  const star = r.nodes.find((n) => n.type === 'star');
  assert.equal(star.nullable, true); assert.deepEqual(star.first, [1, 2]); assert.deepEqual(star.last, [1, 2]);
  const union = r.nodes.find((n) => n.type === 'or');
  assert.equal(union.nullable, false);
  assert.equal(r.nodes.filter((n) => n.type === 'cat').length, 4);   // 3 inside + root with #
  assert.equal(r.root.nullable, false); assert.deepEqual(r.root.last, [6]);
});

test('simulation', () => {
  const { dfa } = build('(a|b)*abb');
  assert.equal(simulateDfa(dfa, 'abb').result, 'ACCEPT');
  assert.equal(simulateDfa(dfa, 'aabb').result, 'ACCEPT');
  assert.equal(simulateDfa(dfa, 'babb').result, 'ACCEPT');
  assert.equal(simulateDfa(dfa, 'ab').result, 'REJECT');
  assert.equal(simulateDfa(dfa, 'abba').result, 'REJECT');
  assert.equal(simulateDfa(dfa, 'abc').result, 'REJECT');
});

test('plus, optional, escapes', () => {
  assert.equal(simulateDfa(build('ab+').dfa, 'abbb').result, 'ACCEPT');
  assert.equal(simulateDfa(build('ab+').dfa, 'a').result, 'REJECT');
  const o = build('ab?c').dfa;
  assert.equal(simulateDfa(o, 'ac').result, 'ACCEPT'); assert.equal(simulateDfa(o, 'abc').result, 'ACCEPT'); assert.equal(simulateDfa(o, 'abbc').result, 'REJECT');
  assert.equal(simulateDfa(build('a\\*b').dfa, 'a*b').result, 'ACCEPT');
  assert.equal(simulateDfa(build('\\#').dfa, '#').result, 'ACCEPT');
});

test('malformed regexes give position-aware errors', () => {
  assert.match(parseRegex('(ab').error, /position 1.*closing/);
  assert.match(parseRegex('a)').error, /Unexpected "\)"/);
  assert.match(parseRegex('*a').error, /nothing to repeat/);
  assert.match(parseRegex('a#b').error, /reserved/);
  assert.match(parseRegex('a|').error, /Nothing after/);
  assert.equal(parseRegex('').ok, false);
});

test('cross-check against JS RegExp on random strings', () => {
  for (const re of ['(a|b)*abb', 'a(b|c)*d', '(ab|a)+b?', 'a*b*c?']) {
    const { dfa } = build(re); const js = new RegExp(`^(?:${re})$`);
    for (let n = 0; n < 400; n++) {
      const len = Math.floor(Math.random() * 8);
      const s = Array.from({ length: len }, () => 'abcd'[Math.floor(Math.random() * 4)]).join('');
      assert.equal(simulateDfa(dfa, s).result === 'ACCEPT', js.test(s), `${re} on "${s}"`);
    }
  }
});
