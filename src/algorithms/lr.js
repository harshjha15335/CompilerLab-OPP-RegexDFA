// SLR(1) parsing: augmented grammar, FIRST/FOLLOW, the canonical collection of LR(0) item sets,
// the ACTION/GOTO table and a shift-reduce parse. Every phase emits replayable steps; no UI code here.
import { END_MARKER, parseGrammar } from './grammar.js';

const EPS = new Set(['ε', 'eps', 'epsilon', 'λ']);
export const EPSILON = 'ε';
// Item sets grow with the grammar; past this many the construction stops instead of freezing the page.
export const MAX_LR_STATES = 300;
export class LrLimitError extends Error {
  constructor(limit) { super(`The LR(0) automaton needs more than ${limit} states.`); this.name = 'LrLimitError'; this.limit = limit; }
}

const show = (p) => `${p.lhs} → ${p.rhs.length ? p.rhs.join(' ') : 'ε'}`;

/** Parse "E -> E + T | T" lines (the shared grammar syntax) and augment with S' → S as production 0.
 *  Any context-free grammar is allowed: ε-productions and adjacent non-terminals are fine for LR. */
export function prepareLrGrammar(text) {
  const parsed = parseGrammar(text);
  const g = parsed.grammar;
  const productions = g.productions.map((p) => ({ ...p, rhs: p.rhs.filter((s) => !EPS.has(s)) }));
  const grammar = { ...g, productions };
  if (!parsed.ok) return { ok: false, errors: parsed.errors, grammar };
  const errors = [];
  for (const p of productions)
    if (p.lhs === END_MARKER || p.rhs.includes(END_MARKER))
      errors.push({ code: 'RESERVED', productionId: p.id, message: `Production ${p.id} (${show(p)}) uses "$", which is reserved as the end marker.` });
  if (errors.length) return { ok: false, errors, grammar };
  let aug = `${g.start}'`;
  while (g.nonterminals.includes(aug) || g.terminals.includes(aug)) aug += "'";
  const augmented = {
    productions: [{ id: 0, lhs: aug, rhs: [g.start], line: 0 }, ...productions],
    nonterminals: [aug, ...g.nonterminals], terminals: [...g.terminals], start: aug, original: g.start,
  };
  return { ok: true, errors: [], grammar, augmented };
}

/* ───────────── FIRST and FOLLOW ───────────── */
const snap = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]]));

/** FIRST of a symbol string under the sets known so far. Contains ε when the whole string can vanish. */
export function firstOfString(symbols, first, nts) {
  const out = new Set();
  for (const s of symbols) {
    if (!nts.has(s)) { out.add(s); return out; }
    for (const x of first[s]) if (x !== EPSILON) out.add(x);
    if (!first[s].includes(EPSILON)) return out;
  }
  out.add(EPSILON);
  return out;
}

/** FIRST then FOLLOW, by passes until nothing changes. Only additions are emitted as steps. */
export function computeFirstFollow(grammar) {
  const nts = new Set(grammar.nonterminals);
  const first = Object.fromEntries(grammar.nonterminals.map((n) => [n, []]));
  const follow = Object.fromEntries(grammar.nonterminals.map((n) => [n, []]));
  const steps = [];
  const add = (phase, map, nt, el, extra) => {
    if (map[nt].includes(el)) return false;
    map[nt].push(el);
    steps.push({ phase, type: 'ADD', nonTerminal: nt, element: el, ...extra, snapshot: { first: snap(first), follow: snap(follow) } });
    return true;
  };
  for (let pass = 1, changed = true; changed; pass++) {
    changed = false;
    steps.push({ phase: 'FIRST', type: 'PASS', pass, message: `FIRST, pass ${pass}: try every production in order.`, snapshot: { first: snap(first), follow: snap(follow) } });
    for (const p of grammar.productions) {
      let vanished = true;
      for (let i = 0; i < p.rhs.length; i++) {
        const X = p.rhs[i];
        const before = p.rhs.slice(0, i);
        if (!nts.has(X)) {
          if (add('FIRST', first, p.lhs, X, { rule: before.length ? 'F2' : 'F1', productionId: p.id, via: null, skipped: before,
            message: `${p.lhs} → ${p.rhs.join(' ')} starts with ${before.length ? `${before.join(' ')} (which can vanish), then ` : ''}terminal ${X}, so ${X} ∈ FIRST(${p.lhs}).` })) changed = true;
          vanished = false; break;
        }
        for (const x of first[X]) if (x !== EPSILON && add('FIRST', first, p.lhs, x, { rule: 'F2', productionId: p.id, via: X, skipped: before,
          message: `${p.lhs} → ${p.rhs.join(' ')}: ${before.length ? `${before.join(' ')} can vanish, so ` : ''}FIRST(${X}) flows into FIRST(${p.lhs}); it brings ${x}.` })) changed = true;
        if (!first[X].includes(EPSILON)) { vanished = false; break; }
      }
      if (vanished && add('FIRST', first, p.lhs, EPSILON, { rule: 'F3', productionId: p.id, via: null, skipped: [...p.rhs],
        message: p.rhs.length ? `Every symbol of ${p.lhs} → ${p.rhs.join(' ')} can vanish, so ε ∈ FIRST(${p.lhs}).` : `${p.lhs} → ε, so ε ∈ FIRST(${p.lhs}).` })) changed = true;
    }
  }
  steps.push({ phase: 'FIRST', type: 'DONE', message: 'FIRST is complete: a whole pass added nothing.', snapshot: { first: snap(first), follow: snap(follow) } });

  const start = grammar.start;
  for (let pass = 1, changed = true; changed; pass++) {
    changed = false;
    steps.push({ phase: 'FOLLOW', type: 'PASS', pass, message: `FOLLOW, pass ${pass}: look at every non-terminal on a right-hand side.`, snapshot: { first: snap(first), follow: snap(follow) } });
    if (pass === 1 && add('FOLLOW', follow, start, END_MARKER, { rule: 'W1', productionId: null, via: null, beta: [],
      message: `${start} is the start symbol, so the end marker $ ∈ FOLLOW(${start}).` })) changed = true;
    for (const p of grammar.productions) {
      p.rhs.forEach((B, i) => {
        if (!nts.has(B)) return;
        const beta = p.rhs.slice(i + 1);
        const fb = firstOfString(beta, first, nts);
        for (const x of fb) if (x !== EPSILON && add('FOLLOW', follow, B, x, { rule: 'W2', productionId: p.id, via: null, beta, position: i,
          message: `In ${p.lhs} → ${p.rhs.join(' ')}, ${beta.join(' ')} follows ${B}; ${x} ∈ FIRST(${beta.join(' ')}), so ${x} ∈ FOLLOW(${B}).` })) changed = true;
        if (fb.has(EPSILON) && p.lhs !== B)
          for (const x of [...follow[p.lhs]]) if (add('FOLLOW', follow, B, x, { rule: 'W3', productionId: p.id, via: p.lhs, beta, position: i,
            message: `In ${p.lhs} → ${p.rhs.join(' ')}, ${B} ${beta.length ? `is followed only by ${beta.join(' ')}, which can vanish` : 'ends the rule'}, so FOLLOW(${p.lhs}) flows into FOLLOW(${B}); it brings ${x}.` })) changed = true;
      });
    }
  }
  steps.push({ phase: 'FOLLOW', type: 'DONE', message: 'FOLLOW is complete: a whole pass added nothing.', snapshot: { first: snap(first), follow: snap(follow) } });
  return { first, follow, steps };
}

/* ───────────── LR(0) items ───────────── */
export const itemKey = (it) => `${it.prod}.${it.dot}`;

/** Closure of a kernel. Each added item records the item whose dot stood before its left side. */
export function closure(kernel, augmented) {
  const nts = new Set(augmented.nonterminals);
  const items = kernel.map((it) => ({ ...it, kernel: true, from: null }));
  const seen = new Set(items.map(itemKey));
  for (let i = 0; i < items.length; i++) {
    const p = augmented.productions[items[i].prod];
    const B = p.rhs[items[i].dot];
    if (!nts.has(B)) continue;
    for (const q of augmented.productions) {
      if (q.lhs !== B) continue;
      const it = { prod: q.id, dot: 0 };
      if (seen.has(itemKey(it))) continue;
      seen.add(itemKey(it));
      items.push({ ...it, kernel: false, from: itemKey(items[i]) });
    }
  }
  return items;
}

const kernelKey = (kernel) => kernel.map(itemKey).sort().join(' ');

/** The canonical collection of LR(0) item sets, built state by state, symbol by symbol. */
export function buildLr0(augmented, { maxStates = MAX_LR_STATES } = {}) {
  const states = [], transitions = [], steps = [];
  const byKernel = new Map();
  const addState = (kernel) => {
    const k = kernelKey(kernel);
    if (byKernel.has(k)) return { state: byKernel.get(k), isNew: false };
    if (states.length >= maxStates) throw new LrLimitError(maxStates);
    const state = { id: states.length, items: closure(kernel, augmented) };
    states.push(state); byKernel.set(k, state);
    return { state, isNew: true };
  };
  const { state: s0 } = addState([{ prod: 0, dot: 0 }]);
  steps.push({ phase: 'ITEMS', type: 'START', state: 0, message: `I0 = closure({ ${augmented.start} → • ${augmented.original} }).` });
  for (let i = 0; i < states.length; i++) {
    const I = states[i];
    const symbols = [];
    for (const it of I.items) {
      const X = augmented.productions[it.prod].rhs[it.dot];
      if (X !== undefined && !symbols.includes(X)) symbols.push(X);
    }
    for (const X of symbols) {
      const moved = I.items.filter((it) => augmented.productions[it.prod].rhs[it.dot] === X);
      const kernel = moved.map((it) => ({ prod: it.prod, dot: it.dot + 1 }));
      const { state, isNew } = addState(kernel);
      transitions.push({ from: I.id, symbol: X, to: state.id });
      steps.push({ phase: 'ITEMS', type: 'GOTO', from: I.id, symbol: X, to: state.id, isNew, moved: moved.map(itemKey),
        message: `GOTO(I${I.id}, ${X}): move the dot over ${X} in ${moved.length === 1 ? 'one item' : `${moved.length} items`}${isNew ? `, giving a new state I${state.id}.` : `; that is I${state.id}, already built.`}` });
    }
  }
  steps.push({ phase: 'ITEMS', type: 'DONE', message: `The collection is complete: ${states.length} item sets.` });
  return { states, transitions, steps, start: s0.id };
}

/* ───────────── SLR(1) table ───────────── */
const actionText = (a) => (a.kind === 'shift' ? `s${a.to}` : a.kind === 'reduce' ? `r${a.prod}` : a.kind === 'accept' ? 'acc' : `${a.to}`);
export { actionText };

/** ACTION and GOTO, one entry per step. A cell that receives two different actions is a conflict. */
export function buildSlrTable(augmented, lr0, follow) {
  const nts = new Set(augmented.nonterminals);
  const cells = new Map();          // `${state}\u0000${symbol}` → actions[]
  const steps = [];
  const conflicts = [];
  const put = (state, symbol, action, why) => {
    const k = `${state}\u0000${symbol}`;
    const list = cells.get(k) ?? [];
    const same = list.some((a) => actionText(a) === actionText(action));
    if (!same) list.push(action);
    cells.set(k, list);
    const conflict = !same && list.length > 1;
    if (conflict && !conflicts.some((c) => c.state === state && c.symbol === symbol)) conflicts.push({ state, symbol });
    steps.push({ phase: 'TABLE', type: 'ENTRY', state, symbol, action, changed: !same, conflict,
      kind: conflict ? (list.every((a) => a.kind === 'reduce') ? 'reduce/reduce' : 'shift/reduce') : null, ...why });
  };
  for (const I of lr0.states) {
    for (const t of lr0.transitions.filter((x) => x.from === I.id)) {
      const items = I.items.filter((it) => augmented.productions[it.prod].rhs[it.dot] === t.symbol).map(itemKey);
      if (nts.has(t.symbol))
        put(I.id, t.symbol, { kind: 'goto', to: t.to }, { rule: 'GOTO', items,
          message: `GOTO(I${I.id}, ${t.symbol}) = I${t.to}, so GOTO[${I.id}, ${t.symbol}] = ${t.to}.` });
      else
        put(I.id, t.symbol, { kind: 'shift', to: t.to }, { rule: 'SHIFT', items,
          message: `GOTO(I${I.id}, ${t.symbol}) = I${t.to} on a terminal, so ACTION[${I.id}, ${t.symbol}] = shift ${t.to}.` });
    }
    for (const it of I.items) {
      const p = augmented.productions[it.prod];
      if (it.dot !== p.rhs.length) continue;
      if (p.id === 0) {
        put(I.id, END_MARKER, { kind: 'accept' }, { rule: 'ACCEPT', items: [itemKey(it)],
          message: `I${I.id} contains ${p.lhs} → ${p.rhs.join(' ')} •, so ACTION[${I.id}, $] = accept.` });
        continue;
      }
      for (const a of follow[p.lhs])
        put(I.id, a, { kind: 'reduce', prod: p.id }, { rule: 'REDUCE', items: [itemKey(it)], followOf: p.lhs,
          message: `I${I.id} contains ${show(p)} •, and ${a} ∈ FOLLOW(${p.lhs}), so ACTION[${I.id}, ${a}] = reduce by production ${p.id}.` });
    }
  }
  steps.push({ phase: 'TABLE', type: 'VERDICT', ok: conflicts.length === 0, conflicts: conflicts.map((c) => ({ ...c })),
    message: conflicts.length === 0
      ? 'Every cell holds at most one action, so the grammar is SLR(1).'
      : `${conflicts.length === 1 ? 'One cell holds' : `${conflicts.length} cells hold`} more than one action, so the grammar is not SLR(1).` });
  return { cells, conflicts, steps, get: (state, symbol) => cells.get(`${state}\u0000${symbol}`) ?? [] };
}

/* ───────────── Parse ───────────── */
/** Table-driven shift-reduce parse. Stack entries are { state, symbol } (the bottom has symbol null). */
export function parseLr(augmented, table, tokens) {
  const input = [...tokens, END_MARKER];
  const stack = [{ state: 0, symbol: null }];
  const steps = [];
  const view = () => stack.map((e) => ({ ...e }));
  let ip = 0;
  for (let guard = 0; guard < 10000; guard++) {
    const s = stack.at(-1).state, a = input[ip];
    const acts = table.get(s, a);
    const base = { state: s, lookahead: a, pointer: ip, stackBefore: view() };
    if (acts.length === 0) {
      steps.push({ phase: 'PARSE', type: 'REJECT', ...base, stack: view(),
        message: `ACTION[${s}, ${a}] is blank: no item in I${s} expects ${a === END_MARKER ? 'the end of the input' : a} here.` });
      return { result: 'REJECT', steps };
    }
    if (acts.length > 1) {
      steps.push({ phase: 'PARSE', type: 'REJECT', ...base, stack: view(),
        message: `ACTION[${s}, ${a}] holds ${acts.map(actionText).join(' and ')}: a conflict, so the parser cannot choose.` });
      return { result: 'REJECT', steps };
    }
    const act = acts[0];
    if (act.kind === 'accept') {
      steps.push({ phase: 'PARSE', type: 'ACCEPT', ...base, action: act, stack: view(),
        message: `ACTION[${s}, $] = accept: the input reduced to ${augmented.original}.` });
      return { result: 'ACCEPT', steps };
    }
    if (act.kind === 'shift') {
      stack.push({ state: act.to, symbol: a }); ip++;
      steps.push({ phase: 'PARSE', type: 'SHIFT', ...base, action: act, stack: view(), pointer: ip,
        message: `ACTION[${s}, ${a}] = s${act.to}: push ${a} and state ${act.to}, then read the next symbol.` });
      continue;
    }
    const p = augmented.productions[act.prod];
    const popped = stack.splice(stack.length - p.rhs.length, p.rhs.length);
    const exposed = stack.at(-1).state;
    const gotos = table.get(exposed, p.lhs);
    const to = gotos.length === 1 ? gotos[0].to : null;
    if (to === null) {
      steps.push({ phase: 'PARSE', type: 'REJECT', ...base, stack: view(),
        message: `After reducing by ${show(p)}, GOTO[${exposed}, ${p.lhs}] is blank.` });
      return { result: 'REJECT', steps };
    }
    stack.push({ state: to, symbol: p.lhs });
    steps.push({ phase: 'PARSE', type: 'REDUCE', ...base, action: act, production: { ...p, rhs: [...p.rhs] }, popped: popped.map((e) => ({ ...e })),
      exposed, goto: to, stack: view(),
      message: `ACTION[${s}, ${a}] = r${p.id}: pop ${p.rhs.length === 0 ? 'nothing (ε)' : `${p.rhs.length} symbol${p.rhs.length === 1 ? '' : 's'}`}, uncovering state ${exposed}; GOTO[${exposed}, ${p.lhs}] = ${to}, so push ${p.lhs} and ${to}.` });
  }
  steps.push({ phase: 'PARSE', type: 'REJECT', state: stack.at(-1).state, lookahead: input[ip], pointer: ip, stack: view(), message: 'Parser did not terminate (internal guard).' });
  return { result: 'REJECT', steps };
}
