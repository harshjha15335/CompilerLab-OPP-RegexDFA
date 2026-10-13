// The step schema emitted by the (unchanged, plain JavaScript) algorithm core in src/algorithms.
// These types describe what the core already produces; test/schema.test.js pins the same contract
// at runtime, so a rename in the core fails a test before it can silently break the UI.

export type Relation = '⋖' | '⋗' | '≐';

export interface Production { id: number; lhs: string; rhs: string[]; line: number }
export interface Grammar { productions: Production[]; nonterminals: string[]; terminals: string[]; start: string | null }
export interface GrammarError { code: 'SYNTAX' | 'EMPTY' | 'EPSILON' | 'ADJACENT_NONTERMINALS' | 'RESERVED'; message: string; line?: number; productionId?: number }

export type SetKind = 'LEADING' | 'TRAILING';
export type SetMap = Record<string, string[]>;
export type SetRule = 'L1' | 'L1b' | 'L2' | 'T1' | 'T1b' | 'T2';

export type SetStep =
  | { phase: SetKind; type: 'PASS'; pass: number; message: string; snapshot: SetMap }
  | { phase: SetKind; type: 'DONE'; message: string; snapshot: SetMap }
  | { phase: SetKind; type: 'ADD_LEADING' | 'ADD_TRAILING'; nonTerminal: string; element: string; rule: SetRule;
      productionId: number; sourceSymbols: string[]; changed: boolean; message: string; snapshot: SetMap };
export type SetAddStep = Extract<SetStep, { type: 'ADD_LEADING' | 'ADD_TRAILING' }>;

export type RelRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';
export type TableStep =
  | { phase: 'RELATIONS'; type: 'ADD_RELATION'; left: string; right: string; relation: Relation; rule: RelRule;
      productionId: number | null; nonTerminal: string | null; explanation: string; changed: boolean; conflict: boolean; message: string }
  | { phase: 'RELATIONS'; type: 'VERDICT'; ok: boolean; message: string };
export type RelationStep = Extract<TableStep, { type: 'ADD_RELATION' }>;

export interface CoreTable {
  axes: string[];
  cells: Map<string, { left: string; right: string; relations: Set<Relation>; sources: unknown[] }>;
  conflicts: { left: string; right: string }[];
  steps: TableStep[];
  verdict: 'OPERATOR_PRECEDENCE' | 'NOT_OPERATOR_PRECEDENCE';
  get: (a: string, b: string) => Relation[];
}

export type Mode = 'classic' | 'safeguarded';
export interface StackItem { symbol: string; kind: 'T' | 'N' }
export interface Handle { from: number; to: number; symbols: StackItem[] }
export interface ParseStep {
  type: 'SHIFT' | 'REDUCE' | 'ACCEPT' | 'REJECT';
  mode: Mode; action: number; message: string;
  top?: string; lookahead?: string; relation?: Relation | null;
  stack: StackItem[]; stackBefore?: StackItem[]; pointer: number;
  handle?: Handle; production?: Production; reason?: string; semanticId?: string;
}
export interface ParseRun { result: 'ACCEPT' | 'REJECT'; reason: string; steps: ParseStep[] }
export interface Comparison {
  classic: ParseRun; safeguarded: ParseRun;
  firstStateDivergence: number | null; firstDecisionDivergence: number | null; differ: boolean;
}

export type RegexNodeType = 'leaf' | 'or' | 'cat' | 'star' | 'plus' | 'opt';
export interface RegexNode {
  id: number; type: RegexNodeType; children?: RegexNode[];
  symbol?: string; pos?: number; isEnd?: boolean;
  nullable: boolean; first: number[]; last: number[];
}
export interface LeafNode extends RegexNode { type: 'leaf'; symbol: string; pos: number }

export type DirectStep =
  | { phase: 'PROPERTIES'; type: 'NODE_PROPS'; nodeId: number; nodeLabel: string; nullable: boolean; firstpos: number[]; lastpos: number[]; rule: string; message: string }
  | { phase: 'FOLLOWPOS'; type: 'ADD_FOLLOWPOS'; position: number; added: number[]; nodeId: number; rule: string; changed: boolean; snapshot: Record<string, number[]>; message: string }
  | { phase: 'DFA'; type: 'DFA_START'; state: string; positions: number[]; accepting: boolean; message: string }
  | { phase: 'DFA'; type: 'DFA_TRANSITION'; from: string; symbol: string; to: string; positions: number[]; isNew: boolean; accepting: boolean; message: string }
  | { phase: 'DFA'; type: 'DFA_DONE'; message: string };
export type PropStep = Extract<DirectStep, { type: 'NODE_PROPS' }>;
export type FollowStep = Extract<DirectStep, { type: 'ADD_FOLLOWPOS' }>;
export type DfaStep = Extract<DirectStep, { phase: 'DFA' }>;

export interface DfaState { name: string; positions: number[]; accepting: boolean }
export interface Transition { from: string; symbol: string; to: string }
export interface Dfa { states: DfaState[]; alphabet: string[]; start: string; accepting: string[]; transitions: Transition[] }

export type SimStep =
  | { type: 'SIM_START'; state: string; index: number; message: string }
  | { type: 'MOVE'; from: string; to: string; symbol: string; index: number; message: string }
  | { type: 'ACCEPT' | 'REJECT'; state: string; index: number; symbol?: string; message: string };
export interface SimRun { result: 'ACCEPT' | 'REJECT'; steps: SimStep[] }

export type TreeStep =
  | { phase: 'TREE'; type: 'TREE_LEAF' | 'TREE_END'; nodeId: number; symbol: string; pos: number; message: string }
  | { phase: 'TREE'; type: 'TREE_NODE' | 'TREE_ROOT'; nodeId: number; op: Exclude<RegexNodeType, 'leaf'>; children: number[]; message: string };

/* LR parsing (SLR(1)) */
export interface LrGrammar { productions: Production[]; nonterminals: string[]; terminals: string[]; start: string; original: string }
export type FfRule = 'F1' | 'F2' | 'F3' | 'W1' | 'W2' | 'W3';
export type FfSnapshot = { first: SetMap; follow: SetMap };
export type FfStep =
  | { phase: 'FIRST' | 'FOLLOW'; type: 'PASS'; pass: number; message: string; snapshot: FfSnapshot }
  | { phase: 'FIRST' | 'FOLLOW'; type: 'DONE'; message: string; snapshot: FfSnapshot }
  | { phase: 'FIRST' | 'FOLLOW'; type: 'ADD'; nonTerminal: string; element: string; rule: FfRule; productionId: number | null;
      via: string | null; skipped?: string[]; beta?: string[]; position?: number; message: string; snapshot: FfSnapshot };
export type FfAddStep = Extract<FfStep, { type: 'ADD' }>;

export interface LrItem { prod: number; dot: number; kernel: boolean; from: string | null }
export interface LrState { id: number; items: LrItem[] }
export interface LrTransition { from: number; symbol: string; to: number }
export type Lr0Step =
  | { phase: 'ITEMS'; type: 'START'; state: number; message: string }
  | { phase: 'ITEMS'; type: 'GOTO'; from: number; symbol: string; to: number; isNew: boolean; moved: string[]; message: string }
  | { phase: 'ITEMS'; type: 'DONE'; message: string };
export interface Lr0 { states: LrState[]; transitions: LrTransition[]; steps: Lr0Step[]; start: number }

export type LrAction = { kind: 'shift'; to: number } | { kind: 'reduce'; prod: number } | { kind: 'accept' } | { kind: 'goto'; to: number };
export type SlrStep =
  | { phase: 'TABLE'; type: 'ENTRY'; state: number; symbol: string; action: LrAction; changed: boolean; conflict: boolean;
      kind: 'shift/reduce' | 'reduce/reduce' | null; rule: 'GOTO' | 'SHIFT' | 'REDUCE' | 'ACCEPT'; items: string[]; followOf?: string; message: string }
  | { phase: 'TABLE'; type: 'VERDICT'; ok: boolean; conflicts: { state: number; symbol: string }[]; message: string };
export type SlrEntryStep = Extract<SlrStep, { type: 'ENTRY' }>;
export interface SlrTable { cells: Map<string, LrAction[]>; conflicts: { state: number; symbol: string }[]; steps: SlrStep[]; get: (state: number, symbol: string) => LrAction[] }

export interface LrStackEntry { state: number; symbol: string | null }
export interface LrParseStep {
  phase: 'PARSE'; type: 'SHIFT' | 'REDUCE' | 'ACCEPT' | 'REJECT'; state: number; lookahead: string; pointer: number;
  stack: LrStackEntry[]; stackBefore?: LrStackEntry[]; action?: LrAction; production?: Production; popped?: LrStackEntry[];
  exposed?: number; goto?: number; message: string;
}
export interface LrRun { result: 'ACCEPT' | 'REJECT'; steps: LrParseStep[] }
