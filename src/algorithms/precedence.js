import { END_MARKER } from './grammar.js';
export const REL = { YIELDS: '⋖', TAKES: '⋗', EQUAL: '≐' };
const key = (a, b) => `${a}\u0000${b}`;

/** Build the operator-precedence table one relation at a time. Conflicts are flagged the moment they appear. */
export function buildPrecedenceTable(grammar, leading, trailing) {
  const nt = new Set(grammar.nonterminals);
  const cells = new Map();   // key -> { left, right, relations:Set, sources:[] }
  const steps = [];
  const conflicts = [];
  const put = (left, relation, right, rule, p, via, explanation) => {
    const k = key(left, right);
    let cell = cells.get(k);
    if (!cell) { cell = { left, right, relations: new Set(), sources: [] }; cells.set(k, cell); }
    const isNew = !cell.relations.has(relation);
    const wasConflict = cell.relations.size > 1;
    cell.relations.add(relation);
    cell.sources.push({ relation, rule, productionId: p?.id ?? null, via, explanation });
    const conflict = cell.relations.size > 1;
    if (conflict && !wasConflict) conflicts.push({ left, right });
    steps.push({
      phase: 'RELATIONS', type: 'ADD_RELATION', left, right, relation, rule,
      productionId: p?.id ?? null, nonTerminal: via ?? null, explanation, changed: isNew, conflict,
      message: conflict
        ? `Cell (${left}, ${right}) now holds ${[...cell.relations].join(' and ')}: not an operator-precedence grammar.`
        : isNew ? `${left} ${relation} ${right} because ${explanation}.` : `${left} ${relation} ${right} was already present (${explanation}).`,
    });
  };
  for (const p of grammar.productions) {
    const r = p.rhs;
    const txt = `${p.lhs} → ${r.join(' ')}`;
    for (let i = 0; i < r.length; i++) {
      const x = r[i], y = r[i + 1], z = r[i + 2];
      if (y === undefined) break;
      if (!nt.has(x) && !nt.has(y)) put(x, REL.EQUAL, y, 'R1', p, null, `${x} and ${y} are adjacent in ${txt}`);
      if (z !== undefined && !nt.has(x) && nt.has(y) && !nt.has(z))
        put(x, REL.EQUAL, z, 'R2', p, y, `${x} ${y} ${z} in ${txt} has one non-terminal between the terminals`);
      if (!nt.has(x) && nt.has(y))
        for (const a of leading[y]) put(x, REL.YIELDS, a, 'R3', p, y, `${a} ∈ LEADING(${y}) and ${x} ${y} appear in ${txt}`);
      if (nt.has(x) && !nt.has(y))
        for (const a of trailing[x]) put(a, REL.TAKES, y, 'R4', p, x, `${a} ∈ TRAILING(${x}) and ${x} ${y} appear in ${txt}`);
    }
  }
  const S = grammar.start;
  for (const a of leading[S]) put(END_MARKER, REL.YIELDS, a, 'R5', null, S, `${a} ∈ LEADING(${S}) (start symbol)`);
  for (const a of trailing[S]) put(a, REL.TAKES, END_MARKER, 'R6', null, S, `${a} ∈ TRAILING(${S}) (start symbol)`);

  const axes = [...grammar.terminals, END_MARKER];
  const ok = conflicts.length === 0;
  steps.push({
    phase: 'RELATIONS', type: 'VERDICT', ok,
    message: ok ? 'No cell holds more than one relation: this is an operator-precedence grammar.'
                : `NOT AN OPERATOR-PRECEDENCE GRAMMAR. Conflicting cells: ${conflicts.map((c) => `(${c.left}, ${c.right})`).join(', ')}.`,
  });
  return {
    axes, cells, conflicts, steps, verdict: ok ? 'OPERATOR_PRECEDENCE' : 'NOT_OPERATOR_PRECEDENCE',
    get: (a, b) => { const c = cells.get(key(a, b)); return c ? [...c.relations] : []; },
  };
}
