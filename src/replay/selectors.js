// Pure replay selectors. They never run an algorithm: they only fold the steps[] an
// algorithm already emitted. `count` is the number of steps applied so far, so
// count = 0 is the untouched initial state and count = steps.length is the final one.
// Because every selector is a pure function of (steps, count), stepping Back always
// restores exactly the previous visual state.

export const cellKey = (left, right) => `${left}\u0000${right}`;

export const stepAt = (steps, count) => (count > 0 ? steps[count - 1] : null);

/** LEADING or TRAILING sets visible after `count` steps (uses the snapshots the core emits). */
export function setsAt(steps, count, kind, nonterminals) {
  for (let i = Math.min(count, steps.length) - 1; i >= 0; i--)
    if (steps[i].phase === kind && steps[i].snapshot) return steps[i].snapshot;
  return Object.fromEntries(nonterminals.map((n) => [n, []]));
}

/** Every derivation attempt (first insertion and later duplicates) for one set member. */
export function setProvenance(steps, count, kind, nonTerminal, element) {
  const out = [];
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type === `ADD_${kind}` && s.nonTerminal === nonTerminal && s.element === element)
      out.push({ step: i + 1, rule: s.rule, productionId: s.productionId, changed: s.changed, message: s.message });
  }
  return out;
}

/** Precedence table visible after `count` steps, with per-cell provenance. */
export function tableAt(steps, count) {
  const cells = new Map();
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

export const conflictsOf = (cells) => [...cells.values()].filter((c) => c.conflict);

/** nullable / firstpos / lastpos known after `count` steps, keyed by node id. */
export function nodePropsAt(steps, count) {
  const props = new Map();
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type === 'NODE_PROPS')
      props.set(s.nodeId, { nullable: s.nullable, firstpos: s.firstpos, lastpos: s.lastpos, rule: s.rule, step: i + 1 });
  }
  return props;
}

/** followpos table visible after `count` steps. */
export function followposAt(steps, count, positions) {
  for (let i = Math.min(count, steps.length) - 1; i >= 0; i--)
    if (steps[i].type === 'ADD_FOLLOWPOS') return steps[i].snapshot;
  return Object.fromEntries(positions.map((p) => [p, []]));
}

export function followposProvenance(steps, count, position) {
  const out = [];
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type === 'ADD_FOLLOWPOS' && s.position === position)
      out.push({ step: i + 1, added: s.added, nodeId: s.nodeId, rule: s.rule, changed: s.changed });
  }
  return out;
}

/** DFA discovered after `count` steps of the DFA phase. */
export function dfaAt(steps, count) {
  const states = [], transitions = [];
  let done = false;
  for (let i = 0; i < Math.min(count, steps.length); i++) {
    const s = steps[i];
    if (s.type === 'DFA_START') states.push({ name: s.state, positions: s.positions, accepting: s.accepting, step: i + 1 });
    else if (s.type === 'DFA_TRANSITION') {
      if (s.isNew) states.push({ name: s.to, positions: s.positions, accepting: s.accepting, step: i + 1 });
      transitions.push({ from: s.from, symbol: s.symbol, to: s.to, step: i + 1 });
    } else if (s.type === 'DFA_DONE') done = true;
  }
  return { states, transitions, done };
}

/** DFA simulation state after `count` steps. */
export function simAt(steps, count) {
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

/** Timeline markers: one wherever keyOf(step) changes. `at` is a count (1-based step number). */
export function phaseMarkers(steps, keyOf, labelOf = keyOf) {
  const out = [];
  let prev;
  steps.forEach((s, i) => {
    const k = keyOf(s, i);
    if (k === undefined || k === null) return;
    if (k !== prev) out.push({ at: i + 1, label: String(labelOf(s, i)) });
    prev = k;
  });
  return out;
}

/** In a compareModes() result: the safeguarded step that rejects, and whether it is a failed reduction. */
export function safeguardedRejection(cmp) {
  const i = cmp.safeguarded.steps.findIndex((s) => s.type === 'REJECT');
  if (i < 0) return null;
  const s = cmp.safeguarded.steps[i];
  return { step: i + 1, atReduction: Boolean(s.handle), handle: s.handle ?? null, reason: s.reason };
}
