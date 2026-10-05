// Pure geometry for the DFA drawing. Positions are computed once from the finished DFA
// and never change afterwards, so the graph cannot rearrange during replay or simulation.

export const edgeId = (from, to) => `${from}->${to}`;

export function layoutDfa(dfa) {
  const n = dfa.states.length;
  const row = n <= 5;
  const nodes = dfa.states.map((s, i) => {
    if (row) return { id: s.name, x: i * 170, y: 0 };
    const t = Math.PI + (2 * Math.PI * i) / n;           // start state at the left
    return { id: s.name, x: Math.cos(t) * Math.max(260, n * 44), y: Math.sin(t) * Math.max(175, n * 30) };
  });
  const index = Object.fromEntries(dfa.states.map((s, i) => [s.name, i]));
  const groups = new Map();
  for (const t of dfa.transitions) {
    const id = edgeId(t.from, t.to);
    if (!groups.has(id)) groups.set(id, { id, from: t.from, to: t.to, symbols: [] });
    groups.get(id).symbols.push(t.symbol);
  }
  const edges = [...groups.values()].map((e) => {
    const span = Math.abs(index[e.from] - index[e.to]);
    const reverse = groups.has(edgeId(e.to, e.from));
    // forward and backward edges bend to opposite sides because the offset is relative to direction
    const bend = e.from === e.to ? 0 : row ? (span === 1 && !reverse ? 0 : 30 + 38 * (span - 1)) : 34;
    return { ...e, loop: e.from === e.to, bend };
  });
  return { nodes, edges, row };
}

/** Label for each drawn edge given only the transitions visible so far. */
export function visibleEdgeLabels(transitions) {
  const m = new Map();
  for (const t of transitions) {
    const id = edgeId(t.from, t.to);
    m.set(id, m.has(id) ? `${m.get(id)},${t.symbol}` : t.symbol);
  }
  return m;
}
