// Pure replay selectors. They never run an algorithm: they only fold the steps[] an algorithm
// already emitted. `count` is the number of steps applied so far, so count = 0 is the untouched
// initial state and count = steps.length is the final one. Because every selector is a pure
// function of (steps, count), stepping Back always restores exactly the previous visual state.
import type {
  DfaStep, FollowStep, PropStep, Relation, RelRule, SetKind, SetMap, SetStep, SimStep, TableStep,
} from '../core/index.ts';
import type { CompareResult } from './pipelines.ts';

export const cellKey = (left: string, right: string) => `${left}\u0000${right}`;

export const stepAt = <S>(steps: readonly S[], count: number): S | null => (count > 0 ? steps[count - 1] ?? null : null);

/** LEADING or TRAILING sets visible after `count` steps (uses the snapshots the core emits). */
export function setsAt(steps: readonly SetStep[], count: number, kind: SetKind, nonterminals: string[]): SetMap {
  for (let i = Math.min(count, steps.length) - 1; i >= 0; i--)
    if (steps[i].phase === kind && steps[i].snapshot) return steps[i].snapshot;
  return Object.fromEntries(nonterminals.map((n) => [n, []]));
}

export interface SetSource { step: number; rule: string; productionId: number; changed: boolean; message: string }
/** Every derivation attempt (first insertion and later duplicates) for one set member. */
export function setProvenance(steps: readonly SetStep[], count: number, kind: SetKind, nonTerminal: string, element: string): SetSource[] {
  const out: SetSource[] = [];
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type === `ADD_${kind}` && 'nonTerminal' in s && s.nonTerminal === nonTerminal && s.element === element)
      out.push({ step: i + 1, rule: s.rule, productionId: s.productionId, changed: s.changed, message: s.message });
  }
  return out;
}

export interface CellSource { step: number; relation: Relation; rule: RelRule; productionId: number | null; nonTerminal: string | null; explanation: string; changed: boolean }
export interface Cell { left: string; right: string; relations: Relation[]; sources: CellSource[]; conflict: boolean }

/** Precedence table visible after `count` steps, with per-cell provenance. */
export function tableAt(steps: readonly TableStep[], count: number): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type !== 'ADD_RELATION') continue;
    const k = cellKey(s.left, s.right);
    let cell = cells.get(k);
    if (!cell) { cell = { left: s.left, right: s.right, relations: [], sources: [], conflict: false }; cells.set(k, cell); }
    if (!cell.relations.includes(s.relation)) cell.relations.push(s.relation);
    cell.sources.push({ step: i + 1, relation: s.relation, rule: s.rule, productionId: s.productionId,
      nonTerminal: s.nonTerminal, explanation: s.explanation, changed: s.changed });
    cell.conflict = cell.relations.length > 1;
  }
  return cells;
}

export const conflictsOf = (cells: Map<string, Cell>) => [...cells.values()].filter((c) => c.conflict);

export interface NodeProps { nullable: boolean; firstpos: number[]; lastpos: number[]; rule: string; step: number }
/** nullable / firstpos / lastpos known after `count` steps, keyed by node id. */
export function nodePropsAt(steps: readonly PropStep[], count: number): Map<number, NodeProps> {
  const props = new Map<number, NodeProps>();
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    props.set(s.nodeId, { nullable: s.nullable, firstpos: s.firstpos, lastpos: s.lastpos, rule: s.rule, step: i + 1 });
  }
  return props;
}

/** followpos table visible after `count` steps. */
export function followposAt(steps: readonly FollowStep[], count: number, positions: number[]): Record<string, number[]> {
  const n = Math.min(count, steps.length);
  return n > 0 ? steps[n - 1].snapshot : Object.fromEntries(positions.map((p) => [p, []]));
}

export interface FollowSource { step: number; added: number[]; nodeId: number; rule: string; changed: boolean }
export function followposProvenance(steps: readonly FollowStep[], count: number, position: number): FollowSource[] {
  const out: FollowSource[] = [];
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.position === position) out.push({ step: i + 1, added: s.added, nodeId: s.nodeId, rule: s.rule, changed: s.changed });
  }
  return out;
}

export interface SeenState { name: string; positions: number[]; accepting: boolean; step: number }
export interface SeenTransition { from: string; symbol: string; to: string; step: number }
/** DFA discovered after `count` steps of the DFA phase. */
export function dfaAt(steps: readonly DfaStep[], count: number) {
  const states: SeenState[] = [], transitions: SeenTransition[] = [];
  let done = false;
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type === 'DFA_START') states.push({ name: s.state, positions: s.positions, accepting: s.accepting, step: i + 1 });
    else if (s.type === 'DFA_TRANSITION') {
      if (s.isNew) states.push({ name: s.to, positions: s.positions, accepting: s.accepting, step: i + 1 });
      transitions.push({ from: s.from, symbol: s.symbol, to: s.to, step: i + 1 });
    } else done = true;
  }
  return { states, transitions, done };
}

export interface SimView {
  started: boolean; state: string | null; index: number;
  edge: { from: string; to: string; symbol: string } | null;
  failedAt: number | null; verdict: 'ACCEPT' | 'REJECT' | null;
}
/** DFA simulation state after `count` steps. */
export function simAt(steps: readonly SimStep[], count: number): SimView {
  const s = stepAt(steps, count);
  if (!s) return { state: null, index: 0, edge: null, verdict: null, started: false, failedAt: null };
  return {
    started: true,
    state: s.type === 'MOVE' ? s.to : s.state,
    index: s.index,
    edge: s.type === 'MOVE' ? { from: s.from, to: s.to, symbol: s.symbol } : null,
    failedAt: s.type === 'REJECT' && s.symbol !== undefined ? s.index : null,
    verdict: s.type === 'ACCEPT' || s.type === 'REJECT' ? s.type : null,
  };
}

export interface Marker { at: number; label: string }
/** Timeline markers: one wherever keyOf(step) changes. `at` is a count (1-based step number). */
export function phaseMarkers<S>(steps: readonly S[], keyOf: (s: S, i: number) => unknown, labelOf: (s: S, i: number) => unknown = keyOf): Marker[] {
  const out: Marker[] = [];
  let prev: unknown;
  steps.forEach((s, i) => {
    const k = keyOf(s, i);
    if (k === undefined || k === null) return;
    if (k !== prev) out.push({ at: i + 1, label: String(labelOf(s, i)) });
    prev = k;
  });
  return out;
}

/** In a compareModes() result: the safeguarded step that rejects, and whether it is a failed reduction. */
export function safeguardedRejection(cmp: CompareResult) {
  const i = cmp.safeguarded.steps.findIndex((s) => s.type === 'REJECT');
  if (i < 0) return null;
  const s = cmp.safeguarded.steps[i];
  return { step: i + 1, atReduction: Boolean(s.handle), handle: s.handle ?? null, reason: s.reason ?? '' };
}

export type { SetMap };
