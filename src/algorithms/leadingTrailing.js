// LEADING / TRAILING as a fixed point. Emits one step per derivation attempt.
const snap = (sets) => Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, [...v]]));

export function computeSets(grammar, kind /* 'LEADING' | 'TRAILING' */) {
  const lead = kind === 'LEADING';
  const nt = new Set(grammar.nonterminals);
  const sets = Object.fromEntries(grammar.nonterminals.map((n) => [n, new Set()]));
  const steps = [];
  const add = (A, el, rule, p, from, text) => {
    const changed = !sets[A].has(el);
    if (changed) sets[A].add(el);
    steps.push({
      phase: kind, type: `ADD_${kind}`, nonTerminal: A, element: el, rule, productionId: p.id,
      sourceSymbols: from, changed,
      message: changed ? `${el} enters ${kind}(${A}) because ${text}.`
                       : `${el} already belongs to ${kind}(${A}). No set change.`,
      snapshot: snap(sets),
    });
  };
  let pass = 0, changedPass = true;
  while (changedPass) {
    pass++;
    changedPass = false;
    steps.push({ phase: kind, type: 'PASS', pass, message: `Pass ${pass}`, snapshot: snap(sets) });
    for (const p of grammar.productions) {
      const r = lead ? p.rhs : [...p.rhs].reverse();   // r[0] is the edge symbol
      const A = p.lhs, X = r[0], Y = r[1];
      const before = steps.length;
      if (!nt.has(X)) add(A, X, lead ? 'L1' : 'T1', p, [X], `${p.lhs} → ${p.rhs.join(' ')} has terminal ${X} at the ${lead ? 'start' : 'end'}`);
      else {
        if (Y !== undefined && !nt.has(Y))
          add(A, Y, lead ? 'L1b' : 'T1b', p, [X, Y], `${p.lhs} → ${p.rhs.join(' ')} has ${Y} next to ${X} at the ${lead ? 'start' : 'end'}`);
        for (const el of [...sets[X]])
          add(A, el, lead ? 'L2' : 'T2', p, [X], `${el} ∈ ${kind}(${X}) and ${p.lhs} → ${p.rhs.join(' ')} starts/ends with ${X}`);
      }
      if (steps.slice(before).some((s) => s.changed)) changedPass = true;
    }
  }
  steps.push({ phase: kind, type: 'DONE', message: `${kind} sets reached a fixed point.`, snapshot: snap(sets) });
  return { sets: snap(sets), steps };
}
