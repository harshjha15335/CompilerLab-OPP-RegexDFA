// Runs the algorithm core ONCE per input and packages result + steps[] for replay.
// No algorithm logic lives here; this file only sequences the tested modules.
import {
  buildDirect, buildPrecedenceTable, DfaLimitError, MAX_DFA_STATES, compareModes, computeSets, parseGrammar, parseRegex, parseString,
  simulateDfa, tokenize, validateOperatorGrammar, treeSteps,
  buildLr0, buildSlrTable, computeFirstFollow, LrLimitError, MAX_LR_STATES, parseLr, prepareLrGrammar,
} from '../core/index.ts';
import type {
  Comparison, CoreTable, Dfa, FfStep, Grammar, GrammarError, Lr0, LrGrammar, LrRun, Mode, ParseRun, SetMap, SetStep, SimRun, SlrTable, TreeStep,
} from '../core/index.ts';

export type GrammarAnalysis =
  | { status: 'empty' | 'syntax' | 'invalid'; errors: GrammarError[]; grammar: Grammar }
  | {
      status: 'ok'; errors: GrammarError[]; grammar: Grammar;
      leading: ReturnType<typeof computeSets>; trailing: ReturnType<typeof computeSets>;
      table: CoreTable; setSteps: SetStep[]; conflictFree: boolean;
    };
export type OkGrammar = Extract<GrammarAnalysis, { status: 'ok' }>;

export function analyzeGrammar(text: string): GrammarAnalysis {
  const parsed = parseGrammar(text);
  if (!parsed.ok)
    return { status: parsed.errors.every((e) => e.code === 'EMPTY') ? 'empty' : 'syntax', errors: parsed.errors, grammar: parsed.grammar };
  const { grammar } = parsed;
  const check = validateOperatorGrammar(grammar);
  if (!check.ok) return { status: 'invalid', errors: check.errors, grammar };
  const leading = computeSets(grammar, 'LEADING');
  const trailing = computeSets(grammar, 'TRAILING');
  const table = buildPrecedenceTable(grammar, leading.sets, trailing.sets);
  return { status: 'ok', errors: [], grammar, leading, trailing, table,
    setSteps: [...leading.steps, ...trailing.steps], conflictFree: table.conflicts.length === 0 };
}

export interface ParseResult extends ParseRun { input: string; mode: Mode; tokens: string[]; tokenError: string | null }
export function runParse(analysis: OkGrammar, input: string, mode: Mode): ParseResult {
  const tk = tokenize(input, analysis.grammar.terminals);
  const run = parseString(analysis.grammar, analysis.table, input, mode);
  return { ...run, input, mode, tokens: tk.ok ? tk.tokens : [], tokenError: tk.ok ? null : tk.error };
}

export interface CompareResult extends Comparison { input: string; tokens: string[] }
export function runCompare(analysis: OkGrammar, input: string): CompareResult {
  const tk = tokenize(input, analysis.grammar.terminals);
  return { ...compareModes(analysis.grammar, analysis.table, input), input, tokens: tk.ok ? tk.tokens : [] };
}

export type RegexAnalysis =
  | { status: 'empty' | 'error'; error: string; position: number | null; source: string }
  | ({ status: 'ok'; source: string } & ReturnType<typeof buildDirect> & {
      propSteps: Extract<ReturnType<typeof buildDirect>['steps'][number], { phase: 'PROPERTIES' }>[];
      followSteps: Extract<ReturnType<typeof buildDirect>['steps'][number], { phase: 'FOLLOWPOS' }>[];
      dfaSteps: Extract<ReturnType<typeof buildDirect>['steps'][number], { phase: 'DFA' }>[];
      treeSteps: TreeStep[];
    });
export type OkRegex = Extract<RegexAnalysis, { status: 'ok' }>;

export function analyzeRegex(source: string): RegexAnalysis {
  const parsed = parseRegex(source);
  if (!parsed.ok) return { status: source.length ? 'error' : 'empty', error: parsed.error, position: parsed.position ?? 0, source };
  let direct: ReturnType<typeof buildDirect>;
  try {
    direct = buildDirect(parsed.ast);
  } catch (e) {
    // position null: the problem is the size of the automaton, not one character of the source
    if (e instanceof DfaLimitError)
      return { status: 'error', source, position: null,
        error: `This expression's DFA needs more than ${MAX_DFA_STATES} states, so construction was stopped. `
          + 'The direct method can grow exponentially: (a|b)*a(a|b)(a|b)… doubles the states with every extra (a|b). Use a shorter expression.' };
    return { status: 'error', source, position: null, error: 'This expression is too complex to analyse. Shorten it or reduce the nesting.' };
  }
  return {
    status: 'ok', source, ...direct,
    propSteps: direct.steps.filter((s) => s.phase === 'PROPERTIES'),
    followSteps: direct.steps.filter((s) => s.phase === 'FOLLOWPOS'),
    dfaSteps: direct.steps.filter((s) => s.phase === 'DFA'),
    treeSteps: treeSteps(direct.root, direct.nodes),
  } as OkRegex;
}

export interface SimResult extends SimRun { input: string }
export const runSimulation = (dfa: Dfa, input: string): SimResult => ({ ...simulateDfa(dfa, input), input });

export type LrAnalysis =
  | { status: 'empty' | 'syntax' | 'invalid' | 'too-large'; errors: GrammarError[]; grammar: Grammar }
  | {
      status: 'ok'; errors: GrammarError[]; grammar: Grammar; augmented: LrGrammar;
      first: SetMap; follow: SetMap; ffSteps: FfStep[]; lr0: Lr0; table: SlrTable; conflictFree: boolean;
    };
export type OkLr = Extract<LrAnalysis, { status: 'ok' }>;

export function analyzeLr(text: string): LrAnalysis {
  const prep = prepareLrGrammar(text);
  if (!prep.ok)
    return { status: prep.errors.every((e) => e.code === 'EMPTY') ? 'empty' : prep.errors.some((e) => e.code === 'SYNTAX') ? 'syntax' : 'invalid',
      errors: prep.errors, grammar: prep.grammar };
  const { grammar, augmented } = prep;
  let lr0: Lr0;
  try {
    lr0 = buildLr0(augmented);
  } catch (e) {
    if (e instanceof LrLimitError)
      return { status: 'too-large', grammar, errors: [{ code: 'SYNTAX', message: `This grammar needs more than ${MAX_LR_STATES} LR(0) item sets, so construction was stopped. Use a smaller grammar.` }] };
    throw e;
  }
  const ff = computeFirstFollow(grammar);
  const table = buildSlrTable(augmented, lr0, ff.follow);
  return { status: 'ok', errors: [], grammar, augmented, first: ff.first, follow: ff.follow, ffSteps: ff.steps, lr0, table,
    conflictFree: table.conflicts.length === 0 };
}

export interface LrParseResult extends LrRun { input: string; tokens: string[]; tokenError: string | null }
export function runLrParse(a: OkLr, input: string): LrParseResult {
  const tk = tokenize(input, a.grammar.terminals);
  if (!tk.ok) return { result: 'REJECT', steps: [], input, tokens: [], tokenError: tk.error };
  return { ...parseLr(a.augmented, a.table, tk.tokens), input, tokens: tk.tokens, tokenError: null };
}
