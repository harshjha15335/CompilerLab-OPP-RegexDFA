import { parseGrammar } from '../../../src/algorithms/grammar.js';
import { computeSets } from '../../../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../../../src/algorithms/precedence.js';
import { parseString, compareModes } from '../../../src/algorithms/parser.js';
const build = (txt) => { const g = parseGrammar(txt).grammar; return { g, t: buildPrecedenceTable(g, computeSets(g, 'LEADING').sets, computeSets(g, 'TRAILING').sets) }; };
const M = build('S -> A + B\nA -> id * id\nB -> id / id');
console.log('S->A+B table verdict:', M.t.verdict, ' conflicts:', M.t.conflicts.length);
const fixture = [['id*id+id/id', 'ACCEPT', 'ACCEPT'], ['id/id+id*id', 'ACCEPT', 'REJECT'], ['id*id+id*id', 'ACCEPT', 'REJECT'], ['id/id+id/id', 'ACCEPT', 'REJECT'],
  ['id*id', 'ACCEPT', 'REJECT'], ['id/id', 'ACCEPT', 'REJECT'], ['id+id', 'REJECT', 'REJECT'], ['id*id+id', 'REJECT', 'REJECT']];
let p = 0, f = 0;
for (const [s, ec, es] of fixture) {
  const c = parseString(M.g, M.t, s, 'classic'), g = parseString(M.g, M.t, s, 'safeguarded');
  const good = c.result === ec && g.result === es; good ? p++ : f++;
  console.log(`${good ? 'PASS' : 'FAIL'} ${s.padEnd(13)} classic=${c.result.padEnd(6)} safe=${g.result.padEnd(6)} (expected ${ec}/${es})  safe reason: ${g.reason}`);
}
const cm = compareModes(M.g, M.t, 'id/id+id*id');
console.log(`compareModes(id/id+id*id): firstStateDivergence=${cm.firstStateDivergence} firstDecisionDivergence=${cm.firstDecisionDivergence}`);
console.log('   classic steps:', cm.classic.steps.map((s, i) => `${i + 1}:${s.type}[${s.stack.map((x) => x.symbol).join(' ')}]`).join('  '));
console.log('   safe steps   :', cm.safeguarded.steps.map((s, i) => `${i + 1}:${s.type}[${s.stack.map((x) => x.symbol).join(' ')}]`).join('  '));
console.log(`fixture: ${p} pass, ${f} fail`);

// ---- fuzz vs L(G) by brute-force derivation ----
function language(G, maxLen) {
  const nt = new Set(G.nonterminals), out = new Set(), seen = new Set();
  const q = [[G.start]];
  while (q.length) {
    const form = q.pop(); const k = form.join(' ');
    if (seen.has(k)) continue; seen.add(k);
    const i = form.findIndex((s) => nt.has(s));
    if (i < 0) { out.add(form.join('')); continue; }
    for (const pr of G.productions) if (pr.lhs === form[i]) {
      const nf = [...form.slice(0, i), ...pr.rhs, ...form.slice(i + 1)];
      if (nf.length <= maxLen) q.push(nf);
    }
  }
  return out;
}
function* strings(alpha, maxLen) { function* go(pre, n) { if (n === 0) return; for (const a of alpha) { const s = [...pre, a]; yield s; yield* go(s, n - 1); } } yield* go([], maxLen); }
for (const [name, txt, alpha, N] of [['expression grammar', 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id', ['id', '+', '*', '(', ')'], 7],
                                   ['S -> A + B', 'S -> A + B\nA -> id * id\nB -> id / id', ['id', '+', '*', '/'], 8]]) {
  const B = build(txt); const L = language(B.g, N);
  let total = 0; const res = { classic: { falseAcc: [], falseRej: [] }, safeguarded: { falseAcc: [], falseRej: [] } };
  for (const toks of strings(alpha, N)) {
    total++; const s = toks.join(''); const inL = L.has(s);
    for (const mode of ['classic', 'safeguarded']) {
      const r = parseString(B.g, B.t, toks.join(' '), mode).result === 'ACCEPT';
      if (r && !inL) res[mode].falseAcc.push(toks.join(' ')); if (!r && inL) res[mode].falseRej.push(toks.join(' '));
    }
  }
  console.log(`\nFUZZ ${name}: all ${total} token strings up to length ${N}; |L(G) ∩ len≤${N}| = ${L.size}`);
  for (const mode of ['classic', 'safeguarded'])
    console.log(`  ${mode.padEnd(11)} accepts-not-in-L(G): ${res[mode].falseAcc.length}${res[mode].falseAcc.length ? '  e.g. ' + res[mode].falseAcc.slice(0, 6).join(' | ') : ''}   rejects-in-L(G): ${res[mode].falseRej.length}${res[mode].falseRej.length ? '  e.g. ' + res[mode].falseRej.slice(0, 4).join(' | ') : ''}`);
}
