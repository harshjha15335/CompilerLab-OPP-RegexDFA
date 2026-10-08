// Direct RE -> DFA (followpos method). Emits replayable steps; knows nothing about rendering.
const U = (...ss) => [...new Set(ss.flat())].sort((a, b) => a - b);

export function buildDirect(ast) {
  // augment with end marker
  // work on a copy: the caller's AST is never annotated, and every step record owns its arrays
  const root = { type: 'cat', children: [structuredClone(ast), { type: 'leaf', symbol: '#', isEnd: true }] };
  let nid = 0, pos = 0;
  const nodes = [];
  (function number(n) {
    n.children?.forEach(number);        // post-order ids; leaves numbered left to right
    if (n.type === 'leaf') n.pos = ++pos;
    n.id = ++nid; nodes.push(n);
  })(root);
  // leaves must be numbered strictly left-to-right: post-order visit reaches leaves in that order. OK.

  const steps = [];
  const label = (n) => (n.type === 'leaf' ? `${n.symbol}${n.pos}` : n.type);
  for (const n of nodes) {
    const [a, b] = n.children ?? [];
    let nullable, first, last, rule;
    switch (n.type) {
      case 'leaf': nullable = false; first = [n.pos]; last = [n.pos]; rule = 'leaf: nullable false, first = last = {its position}'; break;
      case 'or': nullable = a.nullable || b.nullable; first = U(a.first, b.first); last = U(a.last, b.last); rule = 'union: nullable if either child is; firstpos and lastpos are unions'; break;
      case 'cat': nullable = a.nullable && b.nullable;
        first = a.nullable ? U(a.first, b.first) : a.first; last = b.nullable ? U(a.last, b.last) : b.last;
        rule = 'concatenation: nullable if both are; first includes second\'s only if first child is nullable; last includes first\'s only if second is nullable'; break;
      case 'star': nullable = true; first = a.first; last = a.last; rule = 'star: always nullable; first and last come from the child'; break;
      case 'plus': nullable = a.nullable; first = a.first; last = a.last; rule = 'plus: nullable if child is; first and last come from the child'; break;
      case 'opt': nullable = true; first = a.first; last = a.last; rule = 'optional: always nullable; first and last come from the child'; break;
    }
    Object.assign(n, { nullable, first, last });
    steps.push({ phase: 'PROPERTIES', type: 'NODE_PROPS', nodeId: n.id, nodeLabel: label(n),
      nullable, firstpos: [...first], lastpos: [...last], rule,
      message: `${label(n)}: nullable=${nullable}, firstpos={${first}}, lastpos={${last}}` });
  }
  const leaves = nodes.filter((n) => n.type === 'leaf').sort((x, y) => x.pos - y.pos);
  const symbolAt = Object.fromEntries(leaves.map((l) => [l.pos, l.symbol]));
  const endPos = leaves.at(-1).pos;
  const follow = Object.fromEntries(leaves.map((l) => [l.pos, []]));
  const addFollow = (p, set, n, rule) => {
    const before = follow[p];
    const merged = U(before, set);
    const changed = merged.length !== before.length;
    follow[p] = merged;
    steps.push({ phase: 'FOLLOWPOS', type: 'ADD_FOLLOWPOS', position: p, added: [...set], nodeId: n.id, rule, changed,
      snapshot: Object.fromEntries(Object.entries(follow).map(([k, v]) => [k, [...v]])),
      message: `${rule}: followpos(${p}) gains {${set}}${changed ? '' : ' (no change)'}.` });
  };
  for (const n of nodes) {
    if (n.type === 'cat') {
      const [a, b] = n.children;
      for (const p of a.last) addFollow(p, b.first, n, `concatenation node ${n.id}: firstpos of right child follows each lastpos of left child`);
    } else if (n.type === 'star' || n.type === 'plus') {
      for (const p of n.last) addFollow(p, n.first, n, `${n.type} node ${n.id}: firstpos of the node follows each of its lastpos`);
    }
  }
  // DFA by subset-of-positions construction
  const alphabet = [...new Set(leaves.filter((l) => !l.isEnd).map((l) => l.symbol))].sort();
  const names = []; const name = (i) => (i < 26 ? String.fromCharCode(65 + i) : `S${i}`);
  const states = []; const transitions = [];
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  const addState = (positions) => {
    let s = states.find((q) => same(q.positions, positions));
    if (s) return { s, isNew: false };
    s = { name: name(states.length), positions, accepting: positions.includes(endPos) };
    states.push(s); return { s, isNew: true };
  };
  const start = addState(root.first).s;
  steps.push({ phase: 'DFA', type: 'DFA_START', state: start.name, positions: [...start.positions], accepting: start.accepting,
    message: `Start state ${start.name} = firstpos(root) = {${start.positions}}.` });
  for (let qi = 0; qi < states.length; qi++) {
    const q = states[qi];
    for (const a of alphabet) {
      const target = U(...q.positions.filter((p) => symbolAt[p] === a).map((p) => follow[p]));
      if (!target.length) continue;
      const { s, isNew } = addState(target);
      transitions.push({ from: q.name, symbol: a, to: s.name });
      steps.push({ phase: 'DFA', type: 'DFA_TRANSITION', from: q.name, symbol: a, to: s.name, positions: [...target], isNew, accepting: s.accepting,
        message: `${q.name} on ${a}: union of followpos over positions in {${q.positions}} labelled ${a} = {${target}}${isNew ? ` → new state ${s.name}` : ` → existing state ${s.name}`}.` });
    }
  }
  const dfa = { states, alphabet, start: start.name, accepting: states.filter((s) => s.accepting).map((s) => s.name), transitions };
  steps.push({ phase: 'DFA', type: 'DFA_DONE', message: `DFA complete: ${states.length} states.` });
  return { root, nodes, leaves, followpos: follow, dfa, steps, endPos };
}

export function simulateDfa(dfa, input) {
  const steps = []; let cur = dfa.start;
  steps.push({ phase: 'SIMULATION', type: 'SIM_START', state: cur, index: 0, message: `Start in ${cur}.` });
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const t = dfa.transitions.find((x) => x.from === cur && x.symbol === ch);
    if (!t) {
      steps.push({ phase: 'SIMULATION', type: 'REJECT', state: cur, index: i, symbol: ch, message: `No transition from ${cur} on "${ch}".` });
      return { result: 'REJECT', steps };
    }
    steps.push({ phase: 'SIMULATION', type: 'MOVE', from: cur, to: t.to, symbol: ch, index: i + 1, message: `${cur} --${ch}--> ${t.to}` });
    cur = t.to;
  }
  const ok = dfa.accepting.includes(cur);
  steps.push({ phase: 'SIMULATION', type: ok ? 'ACCEPT' : 'REJECT', state: cur, index: input.length,
    message: ok ? `Input consumed in accepting state ${cur}.` : `Input consumed but ${cur} is not accepting.` });
  return { result: ok ? 'ACCEPT' : 'REJECT', steps };
}
