import { parseGrammar, validateOperatorGrammar } from '../../../src/algorithms/grammar.js';
import { computeSets } from '../../../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../../../src/algorithms/precedence.js';
import { parseString } from '../../../src/algorithms/parser.js';
let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const T = ['a', 'b', 'c', 'd'], N = ['S', 'A', 'B'];
function randGrammar() {
  const lines = [];
  for (const nt of N) {
    const alts = [];
    for (let k = 0; k < 1 + rnd(2); k++) {
      const len = 1 + rnd(3); const rhs = []; let prevNT = false;
      for (let i = 0; i < len; i++) { const useNT = !prevNT && rnd(3) === 0; const s = useNT ? N[rnd(3)] : T[rnd(4)]; rhs.push(s); prevNT = useNT; }
      alts.push(rhs.join(' '));
    }
    lines.push(`${nt} -> ${alts.join(' | ')}`);
  }
  return lines.join('\n');
}
function language(G, maxLen) { const nt = new Set(G.nonterminals), out = new Set(), seen = new Set(); const q = [[G.start]]; let guard = 0;
  while (q.length && guard++ < 400000) { const form = q.pop(); const k = form.join(' '); if (seen.has(k)) continue; seen.add(k);
    const i = form.findIndex((s) => nt.has(s)); if (i < 0) { out.add(form.join(' ')); continue; }
    for (const pr of G.productions) if (pr.lhs === form[i]) { const nf = [...form.slice(0, i), ...pr.rhs, ...form.slice(i + 1)]; if (nf.length <= maxLen) q.push(nf); } }
  return guard >= 400000 ? null : out; }
function* strings(alpha, n, pre = []) { if (!n) return; for (const a of alpha) { const s = [...pre, a]; yield s; yield* strings(alpha, n - 1, s); } }
let tested = 0, skipped = 0, strs = 0; const stats = { classic: { fa: 0, fr: 0, g: 0 }, safeguarded: { fa: 0, fr: 0, g: 0 } }; const examples = [];
for (let n = 0; n < 400; n++) {
  const txt = randGrammar(); const g = parseGrammar(txt).grammar;
  if (!validateOperatorGrammar(g).ok) { skipped++; continue; }
  const t = buildPrecedenceTable(g, computeSets(g, 'LEADING').sets, computeSets(g, 'TRAILING').sets);
  if (t.conflicts.length) { skipped++; continue; }
  const L = language(g, 6); if (!L) { skipped++; continue; }
  tested++;
  const per = { classic: { fa: 0, fr: 0 }, safeguarded: { fa: 0, fr: 0 } };
  for (const toks of strings(g.terminals, 6)) { strs++; const s = toks.join(' '); const inL = L.has(s);
    for (const m of ['classic', 'safeguarded']) { let acc; try { acc = parseString(g, t, s, m).result === 'ACCEPT'; } catch (e) { acc = 'THREW'; }
      if (acc === 'THREW') { examples.push(`THREW ${m}: ${txt.replace(/\n/g, '; ')} :: ${s}`); continue; }
      if (acc && !inL) { per[m].fa++; if (m === 'safeguarded' && examples.length < 8) examples.push(`safeguarded FALSE ACCEPT: [${txt.replace(/\n/g, '; ')}] :: "${s}"`); }
      if (!acc && inL) { per[m].fr++; if (examples.length < 8) examples.push(`${m} FALSE REJECT: [${txt.replace(/\n/g, '; ')}] :: "${s}"`); } } }
  for (const m of ['classic', 'safeguarded']) { stats[m].fa += per[m].fa; stats[m].fr += per[m].fr; if (per[m].fa || per[m].fr) stats[m].g++; }
}
console.log(`random operator grammars tested: ${tested} (skipped ${skipped} invalid/conflicting/unbounded); token strings checked: ${strs}`);
for (const m of ['classic', 'safeguarded']) console.log(`  ${m.padEnd(11)} false accepts ${stats[m].fa}, false rejects ${stats[m].fr}, grammars affected ${stats[m].g}`);
console.log(examples.join('\n'));
