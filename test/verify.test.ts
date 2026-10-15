// The Verification tab's independent checks: on every built-in sample they agree with the core, and
// they really catch a wrong answer (a deliberately corrupted result fails).
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_SAMPLES, LR_SAMPLES, REGEX_SAMPLES } from '../src/data/samples.ts';
import { analyzeGrammar, analyzeLr, analyzeRegex, runCompare, runLrParse, runParse, runSimulation, type OkGrammar, type OkLr, type OkRegex } from '../src/replay/pipelines.ts';
import * as V from '../src/verify/stages.ts';
import { earley } from '../src/verify/independent.ts';

const failing = (v: { checks: { state: string; label: string; detail?: string }[] }) => v.checks.filter((c) => c.state === 'fail').map((c) => `${c.label} ${c.detail ?? ''}`);

test('operator precedence: every stage verifies on every sample', () => {
  for (const s of GRAMMAR_SAMPLES) {
    const a = analyzeGrammar(s.text);
    assert.deepEqual(failing(V.verifyOppGrammar(a)), [], s.id);
    if (a.status !== 'ok') continue;
    assert.deepEqual(failing(V.verifyOppSets(a as OkGrammar)), [], s.id);
    assert.deepEqual(failing(V.verifyOppTable(a as OkGrammar)), [], s.id);
    if (!a.conflictFree) continue;
    for (const str of s.strings) {
      assert.deepEqual(failing(V.verifyOppParse(a as OkGrammar, runParse(a as OkGrammar, str, 'safeguarded'))), [], `${s.id} ${str}`);
      assert.deepEqual(failing(V.verifyOppModes(a as OkGrammar, runCompare(a as OkGrammar, str))), [], `${s.id} ${str}`);
    }
  }
});

test('Classic N accepting a string outside the language is a note, not a failure', () => {
  const s = GRAMMAR_SAMPLES.find((x) => x.id === 'modes')!;
  const a = analyzeGrammar(s.text) as OkGrammar;
  const v = V.verifyOppParse(a, runParse(a, 'id/id+id*id', 'classic'));
  assert.equal(failing(v).length, 0);
  assert.ok(v.checks.some((c) => c.state === 'note'));
});

test('regex: every stage verifies on every sample', () => {
  for (const s of REGEX_SAMPLES) {
    const r = analyzeRegex(s.source);
    if (r.status !== 'ok') continue;
    for (const f of [V.verifyRegexTree, V.verifyRegexProps, V.verifyRegexFollow, V.verifyRegexDfa]) assert.deepEqual(failing(f(r as OkRegex)), [], `${s.id} ${f.name}`);
    for (const str of s.strings) assert.deepEqual(failing(V.verifyRegexSim(r as OkRegex, runSimulation((r as OkRegex).dfa, str))), [], `${s.id} ${str}`);
  }
});

test('LR: every stage verifies on every sample', () => {
  for (const s of LR_SAMPLES) {
    const a = analyzeLr(s.text) as OkLr;
    for (const f of [V.verifyLrGrammar, V.verifyLrItems, V.verifyLrSets, V.verifyLrTable]) assert.deepEqual(failing(f(a)), [], `${s.id} ${f.name}`);
    if (!a.conflictFree) continue;
    for (const str of s.strings) assert.deepEqual(failing(V.verifyLrParse(a, runLrParse(a, str))), [], `${s.id} ${str}`);
  }
});

test('the checks catch wrong answers', () => {
  const r = analyzeRegex('(a|b)*abb') as OkRegex;
  const broken = { ...r, followpos: { ...r.followpos, 3: [4, 5] } } as OkRegex;
  assert.ok(failing(V.verifyRegexFollow(broken)).length > 0);
  const wrongDfa = { ...r, dfa: { ...r.dfa, accepting: ['C'] } } as OkRegex;
  assert.ok(failing(V.verifyRegexDfa(wrongDfa)).length > 0);
  const a = analyzeLr(LR_SAMPLES[0].text) as OkLr;
  const badFollow = { ...a, follow: { ...a.follow, E: ['$'] } } as OkLr;
  assert.ok(failing(V.verifyLrSets(badFollow)).length > 0);
  assert.equal(earley([{ lhs: 'S', rhs: ['(', 'S', ')', 'S'] }, { lhs: 'S', rhs: [] }], 'S', ['(', ')']), true);
  assert.equal(earley([{ lhs: 'S', rhs: ['(', 'S', ')', 'S'] }, { lhs: 'S', rhs: [] }], 'S', ['(']), false);
});
