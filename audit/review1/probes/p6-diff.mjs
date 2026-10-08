import { parseRegex } from '../../../src/algorithms/regex.js';
import { buildDirect, simulateDfa } from '../../../src/algorithms/direct.js';
// Independent reference #2: Thompson NFA from the same AST shape, simulated by subset construction on the fly.
function thompson(ast) {
  let n = 0; const eps = new Map(), edges = new Map(); const st = () => n++;
  const addE = (a, b) => { (eps.get(a) ?? eps.set(a, []).get(a)).push(b); };
  const addT = (a, c, b) => { (edges.get(a) ?? edges.set(a, []).get(a)).push([c, b]); };
  function go(t) {
    if (t.type === 'leaf') { const s = st(), e = st(); addT(s, t.symbol, e); return [s, e]; }
    if (t.type === 'cat') { const [s1, e1] = go(t.children[0]); const [s2, e2] = go(t.children[1]); addE(e1, s2); return [s1, e2]; }
    if (t.type === 'or') { const s = st(), e = st(); for (const c of t.children) { const [cs, ce] = go(c); addE(s, cs); addE(ce, e); } return [s, e]; }
    const [cs, ce] = go(t.children[0]); const s = st(), e = st(); addE(s, cs); addE(ce, e);
    if (t.type === 'star' || t.type === 'opt') addE(s, e);
    if (t.type === 'star' || t.type === 'plus') addE(ce, cs);
    return [s, e];
  }
  const [s, e] = go(ast);
  const close = (set) => { const out = new Set(set), stack = [...set]; while (stack.length) { const x = stack.pop(); for (const y of eps.get(x) ?? []) if (!out.has(y)) { out.add(y); stack.push(y); } } return out; };
  return (str) => { let cur = close([s]); for (const ch of str) { const nx = []; for (const q of cur) for (const [c, t] of edges.get(q) ?? []) if (c === ch) nx.push(t); cur = close(nx); if (!cur.size) return false; } return cur.has(e); };
}
let seed = 7; const rnd = (k) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };
const REGEXES = ['(a|b)*abb', '(ab|a)+b?', 'a*b*c?', '((a|b)*c)+', '(a(b|c)*)*d?', 'a+b+|(ba)*', '((ab)*|c+)?a', '(a|b|c)*abc', 'a(ba)*b', '((a*b)+c?)*'];
let total = 0, mism = 0; const det = []; const report = [];
for (const src of REGEXES) {
  const ast = parseRegex(src).ast; const d = buildDirect(JSON.parse(JSON.stringify(ast)));
  const js = new RegExp(`^(?:${src})$`); const nfa = thompson(ast);
  // determinism + structural checks
  const keys = d.dfa.transitions.map((t) => `${t.from}|${t.symbol}`); if (new Set(keys).size !== keys.length) det.push(`${src}: nondeterministic`);
  const sets = d.dfa.states.map((s) => s.positions.join(',')); if (new Set(sets).size !== sets.length) det.push(`${src}: duplicate state`);
  const reach = new Set([d.dfa.start]); let grow = true; while (grow) { grow = false; for (const t of d.dfa.transitions) if (reach.has(t.from) && !reach.has(t.to)) { reach.add(t.to); grow = true; } }
  if (reach.size !== d.dfa.states.length) det.push(`${src}: unreachable states`);
  const alpha = d.dfa.alphabet; let m = 0;
  for (let i = 0; i < 5000; i++) {
    const len = rnd(10); let s = ''; for (let k = 0; k < len; k++) s += alpha[rnd(alpha.length)];
    const a = simulateDfa(d.dfa, s).result === 'ACCEPT', b = js.test(s), c = nfa(s);
    total++; if (a !== b || a !== c) { m++; mism++; if (m < 3) console.log(`MISMATCH ${src} on "${s}": dfa=${a} js=${b} thompson=${c}`); }
  }
  report.push(`${src.padEnd(14)} states=${d.dfa.states.length} mismatches=${m}/5000`);
}
console.log(report.join('\n'));
console.log(`\nTOTAL ${total} strings, ${mism} mismatches; structural problems: ${det.length ? det.join('; ') : 'none (deterministic, no duplicate or unreachable states)'}`);
