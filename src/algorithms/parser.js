import { END_MARKER } from './grammar.js';
import { REL } from './precedence.js';

export const MODES = { CLASSIC: 'classic', SAFEGUARDED: 'safeguarded' };

/** Split one whitespace-free chunk into terminals: longest match first, backtracking when the longest
 *  match leaves a remainder that cannot be split. On failure, `at` is the furthest index reached. */
function segment(chunk, sorted) {
  const memo = new Map();
  let far = 0;
  const go = (i) => {
    if (i === chunk.length) return [];
    if (memo.has(i)) return memo.get(i);
    far = Math.max(far, i);
    let found = null;
    for (const t of sorted) {
      if (!chunk.startsWith(t, i)) continue;
      const rest = go(i + t.length);
      if (rest) { found = [t, ...rest]; break; }
    }
    memo.set(i, found);
    return found;
  };
  const tokens = go(0);
  return tokens ? { ok: true, tokens } : { ok: false, at: far };
}

/** Split input into terminals. Whitespace separates chunks, and each chunk is split into terminals, so
 *  "id+id*id", "id + id * id" and "id + id*id" all give the same tokens. */
export function tokenize(input, terminals) {
  const sorted = [...terminals].sort((a, b) => b.length - a.length);
  const tokens = [];
  for (const m of input.matchAll(/\S+/g)) {
    const seg = segment(m[0], sorted);
    if (!seg.ok) return { ok: false, error: `Unknown symbol at position ${m.index + seg.at + 1}: "${m[0][seg.at]}".` };
    tokens.push(...seg.tokens);
  }
  return { ok: true, tokens };
}

// unit-production closure: if B is possible and A → B exists, A is possible too
function closure(set, grammar) {
  const out = new Set(set);
  let ch = true;
  while (ch) {
    ch = false;
    for (const p of grammar.productions)
      if (p.rhs.length === 1 && out.has(p.rhs[0]) && !out.has(p.lhs)) { out.add(p.lhs); ch = true; }
  }
  return out;
}

const label = (it, mode) => (it.kind === 'T' ? it.symbol : mode === MODES.CLASSIC ? 'N' : `{${it.set.join(',')}}`);
const view = (stack, mode) => stack.map((it) => ({ symbol: label(it, mode), kind: it.kind }));

/** Operator-precedence shift/reduce parse. Returns { result, reason, steps }. */
export function parseString(grammar, table, input, mode = MODES.SAFEGUARDED) {
  const nt = new Set(grammar.nonterminals);
  const tk = tokenize(input, grammar.terminals);
  if (!tk.ok) return { result: 'REJECT', reason: tk.error, steps: [] };
  if (!table?.get) return { result: 'REJECT', reason: 'No precedence table to parse with.', steps: [] };
  const toks = [...tk.tokens, END_MARKER];
  const stack = [{ kind: 'T', symbol: END_MARKER }];
  const steps = [];
  let ip = 0;
  const finish = (result, reason, extra = {}) => {
    steps.push({ phase: 'PARSE', type: result, mode, action: steps.length + 1, message: reason, reason, stack: view(stack, mode), pointer: ip, ...extra });
    return { result, reason, steps };
  };
  const topTerminalIndex = () => { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === 'T') return i; return -1; };

  for (let guard = 0; guard < 10000; guard++) {
    const k = topTerminalIndex();
    const a = stack[k].symbol, b = toks[ip];
    if (a === END_MARKER && b === END_MARKER) {
      if (stack.length === 2 && stack[1].kind === 'N') {
        if (mode === MODES.CLASSIC || stack[1].set.includes(grammar.start))
          return finish('ACCEPT', 'Stack is $ N and input is exhausted.', { top: a, lookahead: b });
        return finish('REJECT', `Input reduced to ${label(stack[1], mode)}, which does not contain the start symbol ${grammar.start}.`, { top: a, lookahead: b });
      }
      return finish('REJECT', stack.length === 1 ? 'Input is empty.' : 'Input ended but the stack could not be reduced to a single non-terminal.', { top: a, lookahead: b });
    }
    const rels = table.get(a, b);
    if (rels.length === 0)
      return finish('REJECT', `No precedence relation between ${a} and ${b}.`, { top: a, lookahead: b, relation: null });
    if (rels.length > 1)   // a conflicting table: the parser cannot choose, so it stops instead of guessing
      return finish('REJECT', `Cell (${a}, ${b}) holds ${rels.join(' and ')}: a conflict, so the parser cannot choose between shift and reduce.`, { top: a, lookahead: b, relation: null });
    const rel = rels[0];

    if (rel === REL.YIELDS || rel === REL.EQUAL) {
      const before = view(stack, mode);
      stack.push({ kind: 'T', symbol: b }); ip++;
      steps.push({ phase: 'PARSE', type: 'SHIFT', mode, action: steps.length + 1, top: a, lookahead: b, relation: rel,
        message: `${a} ${rel} ${b}, so shift ${b}.`, stackBefore: before, stack: view(stack, mode), pointer: ip });
      continue;
    }
    // rel === TAKES: find the handle, scanning down while relations are ≐ until a ⋖ boundary
    let cur = k, prev = -1;
    for (;;) {
      prev = -1;
      for (let i = cur - 1; i >= 0; i--) if (stack[i].kind === 'T') { prev = i; break; }
      if (prev < 0) break;
      const r = table.get(stack[prev].symbol, stack[cur].symbol);
      if (r.includes(REL.YIELDS)) break;
      if (r.includes(REL.EQUAL)) { cur = prev; continue; }
      prev = -1; break;
    }
    if (prev < 0)
      return finish('REJECT', `${a} ${rel} ${b} asks for a reduction, but no ⋖ boundary exists below ${a} on the stack.`, { top: a, lookahead: b, relation: rel });
    const from = prev + 1;
    const handle = stack.slice(from);
    const handleView = view(handle, mode);
    const matches = grammar.productions.filter((p) => p.rhs.length === handle.length && p.rhs.every((s, i) => {
      const h = handle[i];
      if (!nt.has(s)) return h.kind === 'T' && h.symbol === s;
      if (h.kind !== 'N') return false;
      return mode === MODES.CLASSIC ? true : h.set.includes(s);
    }));
    const semanticId = from === 1 && b === END_MARKER ? 'final-start-production-reduction' : undefined;
    if (!matches.length)
      return finish('REJECT', `Handle ${handleView.map((h) => h.symbol).join(' ')} matches no production${mode === MODES.SAFEGUARDED ? ' with the required non-terminals' : ''}.`,
        { top: a, lookahead: b, relation: rel, handle: { from, to: stack.length - 1, symbols: handleView }, semanticId });
    const before = view(stack, mode);
    const produced = mode === MODES.CLASSIC
      ? { kind: 'N' }
      : { kind: 'N', set: [...closure(new Set(matches.map((p) => p.lhs)), grammar)].sort() };
    stack.splice(from, handle.length, produced);
    steps.push({ phase: 'PARSE', type: 'REDUCE', mode, action: steps.length + 1, top: a, lookahead: b, relation: rel,
      handle: { from, to: from + handle.length - 1, symbols: handleView }, production: { ...matches[0], rhs: [...matches[0].rhs] },
      message: `${a} ${rel} ${b}: reduce handle ${handleView.map((h) => h.symbol).join(' ')} using ${matches[0].lhs} → ${matches[0].rhs.join(' ')}.`,
      stackBefore: before, stack: view(stack, mode), pointer: ip, semanticId });
  }
  return finish('REJECT', 'Parser did not terminate (internal guard).');
}

/** Run both modes and report where they first differ (state-wise and decision-wise). */
export function compareModes(grammar, table, input) {
  const c = parseString(grammar, table, input, MODES.CLASSIC);
  const s = parseString(grammar, table, input, MODES.SAFEGUARDED);
  const n = Math.max(c.steps.length, s.steps.length);
  let stateDiv = null, decisionDiv = null;
  const str = (st) => (st ? st.stack.map((x) => x.symbol).join(' ') : null);
  const hd = (st) => (st?.handle ? st.handle.symbols.length : 0);
  for (let i = 0; i < n; i++) {
    const a = c.steps[i], b = s.steps[i];
    if (stateDiv === null && (str(a) !== str(b)) ) {
      // compare structure only: N vs {..} differ by design, so look for a kind/length mismatch or label difference of terminals
      stateDiv = i + 1;
    }
    if (decisionDiv === null && (a?.type !== b?.type || hd(a) !== hd(b))) decisionDiv = i + 1;
  }
  return { classic: c, safeguarded: s, firstStateDivergence: stateDiv, firstDecisionDivergence: decisionDiv,
    differ: c.result !== s.result };
}
