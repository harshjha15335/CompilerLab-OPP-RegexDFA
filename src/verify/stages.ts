// One Verification per stage: how the stage's result is checked, and the live outcome of each check.
import type { OkGrammar, OkLr, OkRegex, CompareResult, ParseResult, LrParseResult, SimResult } from '../replay/pipelines.ts';
import type { RegexNode } from '../core/index.ts';
import {
  allStrings, check, earley, edgeTerminalsBySearch, firstFollowByGraph, lrItemChecks, operatorGrammarChecks, relationsByDefinition,
  rightmostDerivationCheck, sameSet, show, slrTableByDefinition, sourceSymbols, sourceToJsRegex, thompson, type Check, type Verification,
} from './independent.ts';

const fmtRel = (r: string) => r;
const mismatch = (a: string[]) => (a.length > 6 ? `${a.slice(0, 6).join(', ')} … (${a.length} in all)` : a.join(', '));

/* ───────────── Operator precedence ───────────── */
export function verifyOppGrammar(a: { grammar: OkGrammar['grammar']; status: string }): Verification {
  const checks = operatorGrammarChecks(a.grammar.productions);
  const indep = checks.every((c) => c.state === 'pass');
  checks.push(check(`The tool's verdict (${a.status === 'ok' ? 'valid' : 'invalid'}) agrees with these rules`, indep === (a.status === 'ok')));
  return { method: 'Each production is re-read by a separate checker that applies the definition of an operator grammar: no right side may be empty, no two non-terminals may stand side by side, and $ is reserved. Its verdict must equal the tool\'s.', checks };
}

export function verifyOppSets(a: OkGrammar): Verification {
  const L = edgeTerminalsBySearch(a.grammar.productions, 'LEADING');
  const T = edgeTerminalsBySearch(a.grammar.productions, 'TRAILING');
  const checks: Check[] = [];
  for (const n of a.grammar.nonterminals) {
    checks.push(check(`LEADING(${n}) = ${show(a.leading.sets[n])}`, sameSet(a.leading.sets[n], L[n] ?? []), `derivation search gives ${show(L[n] ?? [])}`));
  }
  for (const n of a.grammar.nonterminals) {
    checks.push(check(`TRAILING(${n}) = ${show(a.trailing.sets[n])}`, sameSet(a.trailing.sets[n], T[n] ?? []), `derivation search gives ${show(T[n] ?? [])}`));
  }
  return { method: 'The sets are recomputed by searching derivations instead of applying the rules in passes: a ∈ LEADING(A) exactly when A ⇒+ a… or A ⇒+ B a…. Only the first (or last) two symbols of a sentential form matter, so the search is finite. Each set must match.', checks };
}

export function verifyOppTable(a: OkGrammar): Verification {
  const L = edgeTerminalsBySearch(a.grammar.productions, 'LEADING');
  const T = edgeTerminalsBySearch(a.grammar.productions, 'TRAILING');
  const want = relationsByDefinition(a.grammar.productions, a.grammar.start!, L, T);
  const have = new Set<string>();
  for (const c of a.table.cells.values()) for (const r of c.relations) have.add(`${c.left} ${r} ${c.right}`);
  const missing = [...want].filter((r) => !have.has(r)), extra = [...have].filter((r) => !want.has(r));
  const cellsWithTwo = new Map<string, Set<string>>();
  for (const r of want) { const [x, rel, y] = r.split(' '); const k = `${x} ${y}`; if (!cellsWithTwo.has(k)) cellsWithTwo.set(k, new Set()); cellsWithTwo.get(k)!.add(rel); }
  const conflicts = [...cellsWithTwo.values()].filter((s) => s.size > 1).length;
  return {
    method: 'Every relation is derived again straight from the definitions (≐ for a b and a B b, ⋖ from LEADING, ⋗ from TRAILING, and the two $ rules), using the independently searched sets. The two tables must hold exactly the same relations, and the conflict count must agree.',
    checks: [
      check(`All ${want.size} relations required by the definitions are in the table`, missing.length === 0, mismatch(missing.map(fmtRel))),
      check('The table holds no relation the definitions do not give', extra.length === 0, mismatch(extra)),
      check(`Conflicting cells: ${a.table.conflicts.length} (definition gives ${conflicts})`, conflicts === a.table.conflicts.length),
    ],
  };
}

export function verifyOppParse(a: OkGrammar, run: ParseResult): Verification {
  const inL = earley(a.grammar.productions, a.grammar.start!, run.tokens);
  const reductions = run.steps.filter((s) => s.type === 'REDUCE');
  const badHandles = reductions.filter((s) => {
    const p = s.production!; const h = s.handle!.symbols;
    return h.length !== p.rhs.length || p.rhs.some((x, i) => !a.grammar.nonterminals.includes(x) ? h[i].kind !== 'T' || h[i].symbol !== x : h[i].kind !== 'N');
  });
  const checks: Check[] = [
    check(`Every reduction's handle matches its production (${reductions.length} reductions)`, badHandles.length === 0),
  ];
  if (run.tokenError) checks.push({ label: 'The input could not be split into terminals, so nothing was parsed', state: 'note' });
  else {
    const agree = inL === (run.result === 'ACCEPT');
    checks.push(agree
      ? check(`An Earley parser says the string is ${inL ? 'in' : 'not in'} the language; the tool ${run.result === 'ACCEPT' ? 'accepted' : 'rejected'} it`, true)
      : run.mode === 'classic'
        ? { label: `Earley says the string is ${inL ? 'in' : 'not in'} the language, but Classic N ${run.result === 'ACCEPT' ? 'accepted' : 'rejected'} it`, state: 'note', detail: 'Expected: Classic N forgets which non-terminal was reduced. Stage 5 shows Safeguarded getting it right.' }
        : check(`Earley says the string is ${inL ? 'in' : 'not in'} the language; the tool ${run.result === 'ACCEPT' ? 'accepted' : 'rejected'} it`, false));
  }
  return { method: 'Membership is decided a second way by an Earley parser, which works for any context-free grammar and shares no code with the precedence parser. Each reduction is also checked against the production it names.', checks };
}

export function verifyOppModes(a: { grammar: OkGrammar['grammar'] }, cmp: CompareResult): Verification {
  const inL = earley(a.grammar.productions, a.grammar.start!, cmp.tokens);
  const c = cmp.classic.result === 'ACCEPT', s = cmp.safeguarded.result === 'ACCEPT';
  return {
    method: 'An Earley parser decides whether the string really is in the language. Safeguarded must always agree with it; Classic N is allowed to differ, and that difference is what this stage demonstrates.',
    checks: [
      check(`Safeguarded ${s ? 'accepts' : 'rejects'}; Earley says the string is ${inL ? 'in' : 'not in'} the language`, s === inL),
      c === inL ? check(`Classic N ${c ? 'accepts' : 'rejects'}, which also agrees`, true)
        : { label: `Classic N ${c ? 'accepts' : 'rejects'}: it disagrees with the language`, state: 'note', detail: 'This is the known weakness of Classic N: every reduced symbol becomes N, so different non-terminals look alike.' },
    ],
  };
}

/* ───────────── Regex → DFA ───────────── */
const nodeName = (n: RegexNode) => (n.type === 'leaf' ? `${n.symbol}${n.pos}` : `${n.type} node ${n.id}`);

export function verifyRegexTree(r: OkRegex): Verification {
  const leaves = r.leaves.filter((l) => !l.isEnd).map((l) => l.symbol);
  const fromText = sourceSymbols(r.source);
  const js = sourceToJsRegex(r.source);
  const nfa = thompson(r.root);
  const symbolAt = Object.fromEntries(r.leaves.map((l) => [l.pos, l.symbol]));
  const alphabet = [...new Set(leaves)];
  const strings = allStrings(alphabet, 1500);
  const differ = js ? strings.filter((s) => js.test(s.join('')) !== nfa.accepts(symbolAt, s, r.endPos)).map((s) => s.join('') || 'ε') : [];
  return {
    method: 'The leaves of the tree are compared with the symbols read straight from the text. The tree is then turned into an automaton (Thompson\'s construction), and that automaton must accept exactly the strings that the browser\'s own regular-expression engine accepts for the original text.',
    checks: [
      check(`The leaves, left to right, are the expression's symbols: ${leaves.join(' ')}`, leaves.length === fromText.length && leaves.every((s, i) => s === fromText[i]), `text gives ${fromText.join(' ')}`),
      check(`Positions are numbered 1 to ${r.endPos} without gaps, # last`, r.leaves.every((l, i) => l.pos === i + 1) && r.leaves.at(-1)!.isEnd === true),
      check(`The tree matches the same strings as the browser's RegExp (${strings.length} strings tried)`, js !== null && differ.length === 0, js ? mismatch(differ) : 'the browser could not read the expression'),
    ],
  };
}

export function verifyRegexProps(r: OkRegex): Verification {
  const nfa = thompson(r.root);
  const leavesIn = (n: RegexNode): number[] => (n.type === 'leaf' ? [n.pos!] : n.children!.flatMap(leavesIn));
  const bad = { n: [] as string[], f: [] as string[], l: [] as string[] };
  for (const n of r.nodes) {
    if (nfa.nullable(n.id) !== n.nullable) bad.n.push(nodeName(n));
    if (nfa.firstpos(n.id).join() !== [...n.first].sort((a, b) => a - b).join()) bad.f.push(nodeName(n));
    if (nfa.lastpos(n.id, leavesIn(n)).join() !== [...n.last].sort((a, b) => a - b).join()) bad.l.push(nodeName(n));
  }
  return {
    method: 'Each subtree is turned into its own Thompson automaton. nullable means its end can be reached on ε moves alone; firstpos are the positions that can be read first; lastpos are the positions after which the end is reachable on ε. These are compared with the tool\'s values for every node.',
    checks: [
      check(`nullable agrees on all ${r.nodes.length} nodes`, bad.n.length === 0, mismatch(bad.n)),
      check(`firstpos agrees on all ${r.nodes.length} nodes`, bad.f.length === 0, mismatch(bad.f)),
      check(`lastpos agrees on all ${r.nodes.length} nodes`, bad.l.length === 0, mismatch(bad.l)),
    ],
  };
}

export function verifyRegexFollow(r: OkRegex): Verification {
  const nfa = thompson(r.root);
  const bad = r.leaves.filter((l) => nfa.followpos(l.pos).join() !== [...(r.followpos[l.pos] ?? [])].sort((a, b) => a - b).join());
  return {
    method: 'followpos(p) is read off the Thompson automaton of the whole augmented expression: after taking the edge of position p, the positions whose edges can be taken next on ε moves. It must equal the table built from the concatenation and star rules.',
    checks: [
      check(`followpos agrees for all ${r.leaves.length} positions`, bad.length === 0, bad.map((l) => `followpos(${l.pos}): automaton gives {${nfa.followpos(l.pos).join(',')}}`).join('; ')),
      check(`The end marker's position ${r.endPos} has an empty followpos`, (r.followpos[r.endPos] ?? []).length === 0),
    ],
  };
}

export function verifyRegexDfa(r: OkRegex): Verification {
  const { dfa } = r;
  const js = sourceToJsRegex(r.source);
  const nfa = thompson(r.root);
  const symbolAt = Object.fromEntries(r.leaves.map((l) => [l.pos, l.symbol]));
  const strings = allStrings(dfa.alphabet, 2500);
  const run = (s: string[]) => { let q: string | undefined = dfa.start; for (const c of s) { q = dfa.transitions.find((t) => t.from === q && t.symbol === c)?.to; if (!q) return false; } return dfa.accepting.includes(q); };
  const vsNfa = strings.filter((s) => run(s) !== nfa.accepts(symbolAt, s, r.endPos)).map((s) => s.join('') || 'ε');
  const vsJs = js ? strings.filter((s) => run(s) !== js.test(s.join(''))).map((s) => s.join('') || 'ε') : ['(not readable)'];
  const det = dfa.states.every((q) => dfa.alphabet.every((a) => dfa.transitions.filter((t) => t.from === q.name && t.symbol === a).length <= 1));
  const acc = dfa.states.every((q) => q.accepting === q.positions.includes(r.endPos));
  const maxLen = strings.reduce((m, s) => Math.max(m, s.length), 0);
  return {
    method: 'The DFA is run on every string over its alphabet up to a fixed length, and each verdict is compared with two independent recognisers: a Thompson NFA built from the tree, and the browser\'s own RegExp engine reading the original text.',
    checks: [
      check('Deterministic: at most one move per state and symbol', det),
      check(`A state accepts exactly when it contains position ${r.endPos} (#)`, acc),
      check(`Agrees with the NFA on all ${strings.length} strings up to length ${maxLen}`, vsNfa.length === 0, mismatch(vsNfa)),
      check(`Agrees with the browser's RegExp on the same ${strings.length} strings`, vsJs.length === 0, mismatch(vsJs)),
    ],
  };
}

export function verifyRegexSim(r: OkRegex, sim: SimResult): Verification {
  const js = sourceToJsRegex(r.source);
  const nfa = thompson(r.root);
  const symbolAt = Object.fromEntries(r.leaves.map((l) => [l.pos, l.symbol]));
  const input = [...sim.input];
  const want = js?.test(sim.input) ?? null;
  const n = nfa.accepts(symbolAt, input, r.endPos);
  const got = sim.result === 'ACCEPT';
  const label = sim.input === '' ? 'the empty string' : `"${sim.input}"`;
  return {
    method: 'The verdict for this string is decided again by the browser\'s RegExp engine (on the original text) and by a Thompson NFA. Both must agree with the DFA.',
    checks: [
      check(`Browser RegExp ${want ? 'matches' : 'does not match'} ${label}; the DFA ${got ? 'accepts' : 'rejects'}`, want === got),
      check(`Thompson NFA ${n ? 'accepts' : 'rejects'} ${label}; the DFA ${got ? 'accepts' : 'rejects'}`, n === got),
    ],
  };
}

/* ───────────── LR ───────────── */
export function verifyLrGrammar(a: OkLr): Verification {
  const g = a.augmented;
  return {
    method: 'The augmented grammar is checked against its definition: one new start symbol, used nowhere else, with a single rule S′ → S, and the original rules kept unchanged and in order.',
    checks: [
      check(`The new start symbol ${g.start} does not occur in the original grammar`, !a.grammar.nonterminals.includes(g.start) && !a.grammar.terminals.includes(g.start)),
      check(`Production 0 is ${g.start} → ${g.original}`, g.productions[0].lhs === g.start && g.productions[0].rhs.join(' ') === g.original),
      check(`The original ${a.grammar.productions.length} productions follow, unchanged`, a.grammar.productions.every((p, i) => g.productions[i + 1].lhs === p.lhs && g.productions[i + 1].rhs.join(' ') === p.rhs.join(' '))),
    ],
  };
}

export function verifyLrItems(a: OkLr): Verification {
  return {
    method: 'Closure and GOTO are recomputed by a separate routine. Every item set must equal the closure of its own kernel, every edge must lead to the closure of the items with the dot moved, and no state may be built twice.',
    checks: lrItemChecks(a.augmented, a.lr0.states, a.lr0.transitions),
  };
}

export function verifyLrSets(a: OkLr): Verification {
  const g = firstFollowByGraph(a.grammar.productions, a.grammar.start!);
  const checks: Check[] = [];
  for (const n of a.grammar.nonterminals) checks.push(check(`FIRST(${n}) = ${show(a.first[n])}`, sameSet(a.first[n], g.first[n]), `graph method gives ${show(g.first[n])}`));
  for (const n of a.grammar.nonterminals) checks.push(check(`FOLLOW(${n}) = ${show(a.follow[n])}`, sameSet(a.follow[n], g.follow[n]), `graph method gives ${show(g.follow[n])}`));
  return { method: 'FIRST and FOLLOW are recomputed as reachability in a graph (A → X when X can begin a rule for A; B → A when B can end a rule for A) instead of by repeated passes. Every set must match.', checks };
}

export function verifyLrTable(a: OkLr): Verification {
  const g = firstFollowByGraph(a.grammar.productions, a.grammar.start!);
  const want = slrTableByDefinition(a.augmented, a.lr0.states, a.lr0.transitions, g.follow);
  const bad: string[] = [];
  const keys = new Set([...want.keys(), ...a.table.cells.keys()]);
  for (const k of keys) {
    const mine = (a.table.cells.get(k) ?? []).map((x) => (x.kind === 'shift' ? `s${x.to}` : x.kind === 'reduce' ? `r${x.prod}` : x.kind === 'accept' ? 'acc' : `${x.to}`));
    if (!sameSet(mine, want.get(k) ?? [])) bad.push(k.replace('\u0000', ', '));
  }
  const conflicts = [...want.values()].filter((s) => s.size > 1).length;
  return {
    method: 'The table is rebuilt from the definition of SLR(1): shift and GOTO from the item-set edges, reduce A → α on each terminal in FOLLOW(A) (taken from the graph method), accept on $. Every cell must match.',
    checks: [
      check(`All ${keys.size} filled cells match the definition`, bad.length === 0, mismatch(bad)),
      check(`Conflicting cells: ${a.table.conflicts.length} (definition gives ${conflicts})`, conflicts === a.table.conflicts.length),
      check('Exactly one accept entry', [...want.values()].filter((s) => s.has('acc')).length === 1),
    ],
  };
}

export function verifyLrParse(a: OkLr, run: LrParseResult): Verification {
  const inL = earley(a.grammar.productions, a.grammar.start!, run.tokens);
  const reductions = run.steps.filter((s) => s.type === 'REDUCE').map((s) => s.production!);
  const d = run.result === 'ACCEPT' ? rightmostDerivationCheck(a.grammar.start!, a.grammar.nonterminals, reductions, run.tokens) : null;
  return {
    method: 'An Earley parser decides membership independently. For an accepted string, the reductions are replayed backwards: they must form a rightmost derivation from the start symbol to exactly the input.',
    checks: [
      check(`Earley says the string is ${inL ? 'in' : 'not in'} the language; the LR parser ${run.result === 'ACCEPT' ? 'accepted' : 'rejected'} it`, inL === (run.result === 'ACCEPT')),
      d ? check(`The ${reductions.length} reductions, reversed, are a rightmost derivation of the input`, d.ok, d.error || d.lines.join(' ⇒ '))
        : { label: 'Rejected, so there is no derivation to replay', state: 'note' },
    ],
  };
}
