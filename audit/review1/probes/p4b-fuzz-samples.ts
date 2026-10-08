import { GRAMMAR_SAMPLES } from '../../../src/data/samples.ts';
import { parseGrammar } from '../../../src/algorithms/grammar.js';
import { computeSets } from '../../../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../../../src/algorithms/precedence.js';
import { parseString } from '../../../src/algorithms/parser.js';
import { validateOperatorGrammar } from '../../../src/algorithms/grammar.js';
function language(G: any, maxLen: number) {
  const nt = new Set(G.nonterminals), out = new Set<string>(), seen = new Set<string>(); const q = [[G.start]];
  while (q.length) { const form = q.pop()!; const k = form.join(' '); if (seen.has(k)) continue; seen.add(k);
    const i = form.findIndex((s: string) => nt.has(s)); if (i < 0) { out.add(form.join(' ')); continue; }
    for (const pr of G.productions) if (pr.lhs === form[i]) { const nf = [...form.slice(0, i), ...pr.rhs, ...form.slice(i + 1)]; if (nf.length <= maxLen) q.push(nf); } }
  return out;
}
function* strings(alpha: string[], n: number, pre: string[] = []): Generator<string[]> { if (!n) return; for (const a of alpha) { const s = [...pre, a]; yield s; yield* strings(alpha, n - 1, s); } }
for (const s of GRAMMAR_SAMPLES) {
  const g = parseGrammar(s.text).grammar as any;
  if (!validateOperatorGrammar(g).ok) { console.log(`skip (not an operator grammar): ${s.title}`); continue; }
  const t = buildPrecedenceTable(g, computeSets(g, 'LEADING').sets, computeSets(g, 'TRAILING').sets);
  if (t.conflicts.length) { console.log(`skip (conflicts, parser blocked): ${s.title}`); continue; }
  const N = g.terminals.length > 5 ? 6 : 7; const L = language(g, N); let total = 0;
  const bad: Record<string, string[]> = { classic: [], safeguarded: [] }, miss: Record<string, string[]> = { classic: [], safeguarded: [] };
  for (const toks of strings(g.terminals, N)) { total++; const str = toks.join(' '); const inL = L.has(str);
    for (const m of ['classic', 'safeguarded']) { const acc = parseString(g, t, str, m).result === 'ACCEPT'; if (acc && !inL) bad[m].push(str); if (!acc && inL) miss[m].push(str); } }
  console.log(`${s.title}: ${total} strings ≤${N} tokens, |L|=${L.size}; classic false-acc ${bad.classic.length} false-rej ${miss.classic.length}; safeguarded false-acc ${bad.safeguarded.length}${bad.safeguarded.length ? ' e.g. ' + bad.safeguarded.slice(0, 3).join(' | ') : ''} false-rej ${miss.safeguarded.length}${miss.safeguarded.length ? ' e.g. ' + miss.safeguarded.slice(0, 3).join(' | ') : ''}`);
}
