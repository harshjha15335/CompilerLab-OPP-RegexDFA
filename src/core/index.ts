// Typed facade over the algorithm core. The core files are imported unchanged; this module only
// states their signatures. Nothing here computes anything.
import * as G from '../algorithms/grammar.js';
import * as LT from '../algorithms/leadingTrailing.js';
import * as PT from '../algorithms/precedence.js';
import * as PA from '../algorithms/parser.js';
import * as RX from '../algorithms/regex.js';
import * as DM from '../algorithms/direct.js';
import type {
  Comparison, CoreTable, Dfa, DirectStep, Grammar, GrammarError, LeafNode, Mode, ParseRun, RegexNode,
  SetKind, SetMap, SetStep, SimRun,
} from './types.ts';

export * from './types.ts';

export const END_MARKER = G.END_MARKER as '$';
export const MODES = PA.MODES as { CLASSIC: 'classic'; SAFEGUARDED: 'safeguarded' };

export const parseGrammar = G.parseGrammar as (text: string) => { ok: boolean; errors: GrammarError[]; grammar: Grammar };
export const validateOperatorGrammar = G.validateOperatorGrammar as (g: Grammar) => { ok: boolean; errors: GrammarError[] };
export const computeSets = LT.computeSets as (g: Grammar, kind: SetKind) => { sets: SetMap; steps: SetStep[] };
export const buildPrecedenceTable = PT.buildPrecedenceTable as (g: Grammar, leading: SetMap, trailing: SetMap) => CoreTable;
export const tokenize = PA.tokenize as (input: string, terminals: string[]) => { ok: true; tokens: string[] } | { ok: false; error: string };
export const parseString = PA.parseString as (g: Grammar, t: CoreTable, input: string, mode?: Mode) => ParseRun;
export const compareModes = PA.compareModes as (g: Grammar, t: CoreTable, input: string) => Comparison;
export const parseRegex = RX.parseRegex as (src: string) => { ok: true; ast: RegexNode } | { ok: false; error: string; position?: number };
export const buildDirect = DM.buildDirect as (ast: RegexNode) => {
  root: RegexNode; nodes: RegexNode[]; leaves: LeafNode[]; followpos: Record<string, number[]>; dfa: Dfa; steps: DirectStep[]; endPos: number;
};
export const simulateDfa = DM.simulateDfa as (dfa: Dfa, input: string) => SimRun;
