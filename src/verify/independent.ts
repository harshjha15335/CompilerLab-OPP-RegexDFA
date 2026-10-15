// Independent re-computations used by the Verification tab. Nothing here calls the algorithm core:
// each result the core produced is checked against a second method written separately
// (a general Earley parser, a derivation search, a Thompson NFA, the browser's own RegExp engine,
// graph reachability). If both methods agree the check passes; a disagreement is shown, never hidden.

export type CheckState = 'pass' | 'fail' | 'note';
export interface Check { label: string; state: CheckState; detail?: string }
export interface Verification { method: string; checks: Check[] }
export const check = (label: string, ok: boolean, detail?: string): Check => ({ label, state: ok ? 'pass' : 'fail', detail });

interface Prod { lhs: string; rhs: string[] }
const EPS = new Set(['ε', 'eps', 'epsilon', 'λ']);
const clean = (ps: readonly Prod[]) => ps.map((p) => ({ lhs: p.lhs, rhs: p.rhs.filter((s) => !EPS.has(s)) }));
const sameSet = (a: Iterable<string>, b: Iterable<string>) => { const x = [...new Set(a)].sort(), y = [...new Set(b)].sort(); return x.length === y.length && x.every((v, i) => v === y[i]); };
const show = (xs: Iterable<string>) => `{ ${[...xs].join(', ')} }`;

/* ───────────── Earley recogniser: decides membership for ANY context-free grammar ───────────── */
export function earley(productions: readonly Prod[], start: string, tokens: readonly string[]): boolean {
  const P = clean(productions);
  const nts = new Set(P.map((p) => p.lhs));
  const nullable = new Set<string>();
  for (let ch = true; ch;) { ch = false; for (const p of P) if (!nullable.has(p.lhs) && p.rhs.every((s) => nullable.has(s))) { nullable.add(p.lhs); ch = true; } }
  type It = { p: number; dot: number; origin: number };
  const chart: It[][] = Array.from({ length: tokens.length + 1 }, () => []);
  const seen = chart.map(() => new Set<string>());
  const add = (i: number, it: It) => { const k = `${it.p}.${it.dot}.${it.origin}`; if (!seen[i].has(k)) { seen[i].add(k); chart[i].push(it); } };
  P.forEach((p, i) => { if (p.lhs === start) add(0, { p: i, dot: 0, origin: 0 }); });
  for (let i = 0; i <= tokens.length; i++) {
    for (let q = 0; q < chart[i].length; q++) {
      const it = chart[i][q];
      const next = P[it.p].rhs[it.dot];
      if (next === undefined) {
        for (const j of chart[it.origin]) if (P[j.p].rhs[j.dot] === P[it.p].lhs) add(i, { p: j.p, dot: j.dot + 1, origin: j.origin });
      } else if (nts.has(next)) {
        P.forEach((p, k) => { if (p.lhs === next) add(i, { p: k, dot: 0, origin: i }); });
        if (nullable.has(next)) add(i, { p: it.p, dot: it.dot + 1, origin: it.origin });
      } else if (i < tokens.length && tokens[i] === next) add(i + 1, { p: it.p, dot: it.dot + 1, origin: it.origin });
    }
  }
  return chart[tokens.length].some((it) => P[it.p].lhs === start && it.origin === 0 && it.dot === P[it.p].rhs.length);
}

/* ───────────── Operator precedence ───────────── */
/** LEADING/TRAILING by searching derivations: only the first (last) two symbols of a sentential form
 *  matter, so the search over truncated forms is finite. a ∈ LEADING(A) iff A ⇒+ a… or A ⇒+ B a…. */
export function edgeTerminalsBySearch(productions: readonly Prod[], kind: 'LEADING' | 'TRAILING') {
  const P = clean(productions);
  const nts = new Set(P.map((p) => p.lhs));
  const out: Record<string, Set<string>> = {};
  const edge = (rhs: string[]) => (kind === 'LEADING' ? rhs.slice(0, 2) : [...rhs].reverse().slice(0, 2));
  for (const A of nts) {
    const found = new Set<string>();
    const seen = new Set<string>();
    const queue = P.filter((p) => p.lhs === A).map((p) => edge(p.rhs));
    while (queue.length) {
      const f = queue.shift()!;
      const key = f.join('\u0000');
      if (seen.has(key) || !f.length) continue;
      seen.add(key);
      if (!nts.has(f[0])) { found.add(f[0]); continue; }
      if (f[1] !== undefined && !nts.has(f[1])) found.add(f[1]);
      for (const p of P) if (p.lhs === f[0]) queue.push([...edge(p.rhs), ...f.slice(1)].slice(0, 2));
    }
    out[A] = found;
  }
  return out;
}

/** Every precedence relation, written straight from the definitions, as "a rel b" strings. */
export function relationsByDefinition(productions: readonly Prod[], start: string, L: Record<string, Set<string>>, T: Record<string, Set<string>>) {
  const P = clean(productions);
  const nts = new Set(P.map((p) => p.lhs));
  const rel = new Set<string>();
  for (const { rhs } of P) for (let i = 0; i < rhs.length; i++) {
    const x = rhs[i], y = rhs[i + 1], z = rhs[i + 2];
    if (y === undefined) continue;
    if (!nts.has(x) && !nts.has(y)) rel.add(`${x} ≐ ${y}`);
    if (!nts.has(x) && nts.has(y) && z !== undefined && !nts.has(z)) rel.add(`${x} ≐ ${z}`);
    if (!nts.has(x) && nts.has(y)) for (const a of L[y]) rel.add(`${x} ⋖ ${a}`);
    if (nts.has(x) && !nts.has(y)) for (const a of T[x]) rel.add(`${a} ⋗ ${y}`);
  }
  for (const a of L[start] ?? []) rel.add(`$ ⋖ ${a}`);
  for (const a of T[start] ?? []) rel.add(`${a} ⋗ $`);
  return rel;
}

export function operatorGrammarChecks(productions: readonly Prod[]): Check[] {
  const nts = new Set(productions.map((p) => p.lhs));
  const empty = productions.filter((p) => p.rhs.length === 0 || p.rhs.some((s) => EPS.has(s)));
  const adjacent = productions.filter((p) => p.rhs.some((s, i) => nts.has(s) && nts.has(p.rhs[i + 1])));
  const dollar = productions.filter((p) => p.lhs === '$' || p.rhs.includes('$'));
  const fmt = (ps: Prod[]) => ps.map((p) => `${p.lhs} → ${p.rhs.join(' ') || 'ε'}`).join('; ');
  return [
    { label: empty.length ? 'A production derives ε (not allowed)' : 'No production derives ε', state: empty.length ? 'note' : 'pass', detail: empty.length ? fmt(empty) : undefined },
    { label: adjacent.length ? 'Two non-terminals stand side by side (not allowed)' : 'No two non-terminals stand side by side', state: adjacent.length ? 'note' : 'pass', detail: adjacent.length ? fmt(adjacent) : undefined },
    { label: dollar.length ? 'The reserved end marker $ is used' : 'The end marker $ is not used', state: dollar.length ? 'note' : 'pass', detail: dollar.length ? fmt(dollar) : undefined },
  ];
}

/* ───────────── LR: FIRST / FOLLOW by graph reachability ───────────── */
export function firstFollowByGraph(productions: readonly Prod[], start: string) {
  const P = clean(productions);
  const nts = [...new Set(P.map((p) => p.lhs))];
  const isNt = (s: string) => nts.includes(s);
  const nullable = new Set<string>();
  for (let ch = true; ch;) { ch = false; for (const p of P) if (!nullable.has(p.lhs) && p.rhs.every((s) => nullable.has(s))) { nullable.add(p.lhs); ch = true; } }
  // FIRST: A → X1 … Xk with X1..Xi-1 nullable gives an edge A → Xi; FIRST(A) = terminals reachable from A
  const edges = new Map<string, Set<string>>(nts.map((n) => [n, new Set()]));
  for (const p of P) for (const s of p.rhs) { edges.get(p.lhs)!.add(s); if (!nullable.has(s)) break; }
  const reach = (from: string, g: Map<string, Set<string>>) => {
    const seen = new Set<string>([from]); const st = [from];
    while (st.length) for (const y of g.get(st.pop()!) ?? []) if (!seen.has(y)) { seen.add(y); st.push(y); }
    return seen;
  };
  const first: Record<string, Set<string>> = {};
  for (const A of nts) { first[A] = new Set([...reach(A, edges)].filter((s) => !isNt(s))); if (nullable.has(A)) first[A].add('ε'); }
  const firstOf = (xs: string[]) => {
    const out = new Set<string>();
    for (const s of xs) { if (!isNt(s)) { out.add(s); return { set: out, vanish: false }; } for (const t of first[s]) if (t !== 'ε') out.add(t); if (!nullable.has(s)) return { set: out, vanish: false }; }
    return { set: out, vanish: true };
  };
  // FOLLOW: direct terminals, plus an edge A → B when B can end a rule for A; FOLLOW(B) ⊇ FOLLOW of everything reaching it
  const direct = new Map<string, Set<string>>(nts.map((n) => [n, new Set()]));
  const back = new Map<string, Set<string>>(nts.map((n) => [n, new Set()]));
  direct.get(start)!.add('$');
  for (const p of P) p.rhs.forEach((B, i) => {
    if (!isNt(B)) return;
    const f = firstOf(p.rhs.slice(i + 1));
    for (const t of f.set) direct.get(B)!.add(t);
    if (f.vanish) back.get(B)!.add(p.lhs);
  });
  const follow: Record<string, Set<string>> = {};
  for (const B of nts) { follow[B] = new Set(); for (const X of reach(B, back)) for (const t of direct.get(X)!) follow[B].add(t); }
  return { first, follow, nullable };
}

/* ───────────── LR: item sets and table rebuilt independently ───────────── */
interface AugG { productions: { id: number; lhs: string; rhs: string[] }[]; nonterminals: string[] }
type Item = { prod: number; dot: number };
const ik = (i: Item) => `${i.prod}.${i.dot}`;
export function closureOf(kernel: Item[], g: AugG) {
  const set = new Map<string, Item>(kernel.map((i) => [ik(i), i]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const it of [...set.values()]) {
      const B = g.productions[it.prod].rhs[it.dot];
      if (!g.nonterminals.includes(B)) continue;
      for (const q of g.productions) if (q.lhs === B && !set.has(`${q.id}.0`)) { set.set(`${q.id}.0`, { prod: q.id, dot: 0 }); grew = true; }
    }
  }
  return [...set.keys()].sort();
}

export function lrItemChecks(g: AugG, states: { id: number; items: Item[] }[], transitions: { from: number; symbol: string; to: number }[]): Check[] {
  const kernelOf = (s: { items: Item[] }) => s.items.filter((i) => i.dot > 0 || i.prod === 0);
  const notClosed = states.filter((s) => closureOf(kernelOf(s), g).join() !== s.items.map(ik).sort().join());
  const kernels = states.map((s) => kernelOf(s).map(ik).sort().join(' '));
  const dupes = kernels.filter((k, i) => kernels.indexOf(k) !== i);
  const badGoto = transitions.filter((t) => {
    const moved = states[t.from].items.filter((i) => g.productions[i.prod].rhs[i.dot] === t.symbol).map((i) => ({ prod: i.prod, dot: i.dot + 1 }));
    return closureOf(moved, g).join() !== states[t.to].items.map(ik).sort().join();
  });
  const missing = states.flatMap((s) => {
    const syms = new Set(s.items.map((i) => g.productions[i.prod].rhs[i.dot]).filter((x): x is string => x !== undefined));
    return [...syms].filter((x) => !transitions.some((t) => t.from === s.id && t.symbol === x)).map((x) => `I${s.id} on ${x}`);
  });
  return [
    check(`Every item set equals the closure of its kernel, recomputed separately (${states.length} sets)`, notClosed.length === 0, notClosed.map((s) => `I${s.id}`).join(', ')),
    check('No two item sets have the same kernel', dupes.length === 0, dupes.join(' | ')),
    check(`Every GOTO edge leads to closure(dot moved over the symbol) (${transitions.length} edges)`, badGoto.length === 0, badGoto.map((t) => `I${t.from} on ${t.symbol}`).join(', ')),
    check('Every symbol after a dot has its GOTO edge', missing.length === 0, missing.join(', ')),
  ];
}

export function slrTableByDefinition(g: AugG, states: { id: number; items: Item[] }[], transitions: { from: number; symbol: string; to: number }[], follow: Record<string, Set<string>>) {
  const cells = new Map<string, Set<string>>();
  const put = (s: number, x: string, a: string) => { const k = `${s}\u0000${x}`; if (!cells.has(k)) cells.set(k, new Set()); cells.get(k)!.add(a); };
  for (const t of transitions) put(t.from, t.symbol, g.nonterminals.includes(t.symbol) ? `${t.to}` : `s${t.to}`);
  for (const s of states) for (const it of s.items) {
    const p = g.productions[it.prod];
    if (it.dot !== p.rhs.length) continue;
    if (p.id === 0) put(s.id, '$', 'acc');
    else for (const a of follow[p.lhs] ?? []) put(s.id, a, `r${p.id}`);
  }
  return cells;
}

/** Replays an LR run's reductions backwards: a correct parse is a rightmost derivation of the input. */
export function rightmostDerivationCheck(start: string, nts: string[], reductions: { lhs: string; rhs: string[] }[], tokens: string[]) {
  let form = [start];
  const lines = [form.join(' ')];
  for (const r of [...reductions].reverse()) {
    let i = form.length - 1;
    while (i >= 0 && !nts.includes(form[i])) i--;
    if (i < 0 || form[i] !== r.lhs) return { ok: false, lines, error: `expected to expand ${r.lhs}, found ${i < 0 ? 'no non-terminal' : form[i]}` };
    form = [...form.slice(0, i), ...r.rhs, ...form.slice(i + 1)];
    lines.push(form.join(' ') || 'ε');
  }
  const ok = form.length === tokens.length && form.every((s, i) => s === tokens[i]);
  return { ok, lines, error: ok ? '' : `derivation ends in "${form.join(' ')}", not the input` };
}

/* ───────────── Regex: Thompson NFA and the browser's RegExp ───────────── */
export interface RNode { id: number; type: string; children?: RNode[]; symbol?: string; pos?: number; isEnd?: boolean }

/** Thompson NFA over the syntax tree: each leaf is one edge labelled with its position. */
export function thompson(root: RNode) {
  let n = 0;
  const eps = new Map<number, number[]>();
  const sym = new Map<number, { to: number; pos: number }>();     // state → its one symbol edge
  const frag = new Map<number, { s: number; e: number }>();
  const leafEdge = new Map<number, { from: number; to: number }>();
  const E = (a: number, b: number) => { if (!eps.has(a)) eps.set(a, []); eps.get(a)!.push(b); };
  const build = (x: RNode): { s: number; e: number } => {
    const k = x.children ?? [];
    let f: { s: number; e: number };
    if (x.type === 'leaf') { const s = n++, e = n++; sym.set(s, { to: e, pos: x.pos! }); leafEdge.set(x.pos!, { from: s, to: e }); f = { s, e }; }
    else if (x.type === 'cat') { const a = build(k[0]), b = build(k[1]); E(a.e, b.s); f = { s: a.s, e: b.e }; }
    else if (x.type === 'or') { const s = n++, a = build(k[0]), b = build(k[1]), e = n++; E(s, a.s); E(s, b.s); E(a.e, e); E(b.e, e); f = { s, e }; }
    else { const s = n++, a = build(k[0]), e = n++; E(s, a.s); E(a.e, e); if (x.type !== 'plus') E(s, e); if (x.type !== 'opt') E(a.e, a.s); f = { s, e }; }
    frag.set(x.id, f);
    return f;
  };
  const top = build(root);
  /** ε-closure; `stop` is a state whose outgoing ε edges leave the fragment and are not followed. */
  const close = (from: number[], stop?: number) => {
    const seen = new Set(from); const st = [...from];
    while (st.length) { const q = st.pop()!; if (q === stop) continue; for (const r of eps.get(q) ?? []) if (!seen.has(r)) { seen.add(r); st.push(r); } }
    return seen;
  };
  const posOut = (states: Set<number>) => [...states].map((q) => sym.get(q)?.pos).filter((p): p is number => p !== undefined).sort((a, b) => a - b);
  return {
    top,
    nullable: (id: number) => { const f = frag.get(id)!; return close([f.s], f.e).has(f.e); },
    firstpos: (id: number) => { const f = frag.get(id)!; return posOut(close([f.s], f.e)); },
    lastpos: (id: number, leaves: number[]) => { const f = frag.get(id)!; return leaves.filter((p) => close([leafEdge.get(p)!.to], f.e).has(f.e)).sort((a, b) => a - b); },
    followpos: (p: number) => posOut(close([leafEdge.get(p)!.to])),
    accepts: (symbolAt: Record<number, string>, input: string[], endPos: number) => {
      // run the NFA of the augmented tree: accept when the edge of # (the end marker) can be taken next
      let cur = close([top.s]);
      for (const c of input) {
        const nxt: number[] = [];
        for (const q of cur) { const t = sym.get(q); if (t && t.pos !== endPos && symbolAt[t.pos] === c) nxt.push(t.to); }
        cur = close(nxt);
        if (!cur.size) return false;
      }
      return [...cur].some((q) => sym.get(q)?.pos === endPos);
    },
  };
}

const JS_SPECIAL = /[\\^$.*+?()[\]{}|/-]/;
const jsLit = (c: string) => (JS_SPECIAL.test(c) ? `\\${c}` : c);
/** The user's source text turned into a JavaScript pattern, character by character (no shared parser). */
export function sourceToJsRegex(source: string): RegExp | null {
  const chars = [...source];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '\\') { out += jsLit(chars[++i] ?? ''); continue; }
    out += '|*+?()'.includes(c) ? c : jsLit(c);
  }
  try { return new RegExp(`^(?:${out})$`, 'u'); } catch { return null; }
}
/** The symbols of the source in order, read straight from the text (operators skipped, escapes resolved). */
export function sourceSymbols(source: string) {
  const chars = [...source], out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '\\') { out.push(chars[++i]); continue; }
    if (!'|*+?()'.includes(chars[i])) out.push(chars[i]);
  }
  return out;
}
/** All strings over the alphabet up to the longest length that keeps the count under `cap`. */
export function allStrings(alphabet: string[], cap = 2500) {
  const out: string[][] = [[]];
  let layer: string[][] = [[]];
  for (let len = 1; alphabet.length && out.length + layer.length * alphabet.length <= cap && len <= 10; len++) {
    layer = layer.flatMap((s) => alphabet.map((a) => [...s, a]));
    out.push(...layer);
  }
  return out;
}

export { sameSet, show };
