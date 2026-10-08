// Pure geometry for the DFA drawing (no DOM). Positions are computed once from the finished DFA and
// never change afterwards, so the graph cannot rearrange during construction or simulation.
// test/dfa-layout.test.ts checks every sample for overlapping labels and nodes.
import type { Dfa } from '../../core/index.ts';

export const edgeId = (from: string, to: string) => `${from}->${to}`;

const SET_CH = 7.3;        // width of one 12px IBM Plex Mono character
const LABEL_CH = 8.6;      // width of one 14px IBM Plex Mono character
const GAP = 92;            // free space between neighbouring nodes in the row layout

export interface NodeGeo { id: string; x: number; y: number; r: number; positions: number[]; accepting: boolean }
export interface EdgeGeo { id: string; from: string; to: string; symbols: string[]; loop: boolean; d: string; lx: number; ly: number }
export interface Box { x: number; y: number; w: number; h: number }
export interface DfaGeometry {
  nodes: NodeGeo[]; edges: EdgeGeo[];
  start: { x1: number; y1: number; x2: number; y2: number; lx: number; ly: number };
  box: Box; layout: 'row' | 'column' | 'layered';
}

export const setText = (p: number[]) => `{${p.join(',')}}`;
/** A symbol as an edge label shows it: the separator and blanks are quoted so "a,c" can never be misread. */
export const labelSymbol = (c: string) => (c === ',' || c === "'" || c.trim() === '' ? `'${c === "'" ? "\\'" : c}'` : c);
/** The label of an edge that carries these symbols: "a,b", or "',',a" when a symbol is the comma itself. */
export const edgeLabel = (symbols: readonly string[]) => symbols.map(labelSymbol).join(',');
/** Above this many states the graph is not drawn; the transition table is shown instead. */
export const GRAPH_STATE_LIMIT = 120;
export const labelBox = (text: string, x: number, y: number): Box => {
  const w = [...text].length * LABEL_CH + 10, h = 22;
  return { x: x - w / 2, y: y - h / 2, w, h };
};

type P = { x: number; y: number };
const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: P) => Math.hypot(a.x, a.y) || 1;
const unit = (a: P) => { const l = len(a); return { x: a.x / l, y: a.y / l }; };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** `orient: 'column'` (phones) draws the row layout top-to-bottom: the row geometry reflected across the
 *  diagonal, which keeps every distance, then labels re-seated beside their (now vertical) edges. */
export function layoutDfa(dfa: Dfa, labels?: Map<string, string>, orient: 'row' | 'column' = 'row'): DfaGeometry {
  const g = dfa.states.length <= 7 ? layoutRow(dfa, labels) : layoutLayered(dfa, labels);
  return orient === 'column' && g.layout === 'row' ? toColumn(g, dfa.start, labels) : g;
}

function layoutRow(dfa: Dfa, labels?: Map<string, string>): DfaGeometry {
  const radius = (pos: number[]) => Math.max(27, Math.ceil((setText(pos).length * SET_CH) / 2 + 12));
  let x = 0;
  const nodes: NodeGeo[] = dfa.states.map((s, i) => {
    const r = radius(s.positions);
    if (i > 0) x += radius(dfa.states[i - 1].positions) + r + GAP;
    return { id: s.name, x, y: 0, r, positions: s.positions, accepting: s.accepting };
  });
  const at = new Map(nodes.map((nd, i) => [nd.id, { nd, i }]));

  const groups = groupEdges(dfa);

  const edges: EdgeGeo[] = [...groups.values()].map((g) => {
    const { nd: A, i: ia } = at.get(g.from)!;
    const { nd: B, i: ib } = at.get(g.to)!;
    if (g.from === g.to) return selfLoop(g, A);
    const span = Math.abs(ia - ib);
    const reverse = groups.has(edgeId(g.to, g.from));
    const dir = unit(sub(B, A));
    const normal = { x: dir.y, y: -dir.x };                 // left of the direction: up for left→right
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    let bend = span === 1 && !reverse ? 0 : 34 + 46 * (span - 1);
    {
      // An arc that jumps over nodes must clear them, and clear their self-loops when it bends
      // upward (loops are drawn above). The quadratic's height at fraction u is 4·bend·u(1−u).
      for (let k = Math.min(ia, ib) + 1; k < Math.max(ia, ib); k++) {
        const K = nodes[k];
        const u = (K.x - A.x) / (B.x - A.x);
        const up = normal.y < 0;
        const need = K.r + (up && groups.has(edgeId(K.id, K.id)) ? 72 : 16);
        bend = Math.max(bend, Math.ceil(need / (4 * u * (1 - u))));
      }
    }
    const c = { x: mid.x + normal.x * bend * 2, y: mid.y + normal.y * bend * 2 };
    const ua = unit(sub(c, A)), ub = unit(sub(c, B));
    const p0 = { x: A.x + ua.x * A.r, y: A.y + ua.y * A.r };
    const p2 = { x: B.x + ub.x * (B.r + 3), y: B.y + ub.y * (B.r + 3) };
    const d = bend === 0
      ? `M ${r1(p0.x)} ${r1(p0.y)} L ${r1(p2.x)} ${r1(p2.y)}`
      : `M ${r1(p0.x)} ${r1(p0.y)} Q ${r1(c.x)} ${r1(c.y)} ${r1(p2.x)} ${r1(p2.y)}`;
    // the label sits just outside the curve's apex, on the side the curve bends toward
    const apex = { x: mid.x + normal.x * bend, y: mid.y + normal.y * bend };
    const off = 15;
    return { ...g, loop: false, d, lx: r1(apex.x + normal.x * off), ly: r1(apex.y + normal.y * off) };
  });

  const s0 = at.get(dfa.start)!.nd;
  const start = { x1: s0.x - s0.r - 52, y1: s0.y, x2: s0.x - s0.r - 3, y2: s0.y, lx: s0.x - s0.r - 30, ly: s0.y - 14 };

  return { nodes, edges, start, layout: 'row', box: frame(nodes, edges, start, 'row', labels) };
}

type Group = { id: string; from: string; to: string; symbols: string[] };
function groupEdges(dfa: Dfa) {
  const groups = new Map<string, Group>();
  for (const t of dfa.transitions) {
    const id = edgeId(t.from, t.to);
    if (!groups.has(id)) groups.set(id, { id, from: t.from, to: t.to, symbols: [] });
    groups.get(id)!.symbols.push(t.symbol);
  }
  return groups;
}

/** A self-loop drawn above its state, with its label above the loop. */
function selfLoop(g: Group, A: NodeGeo): EdgeGeo {
  const a0 = (-115 * Math.PI) / 180, a1 = (-65 * Math.PI) / 180;
  const p0 = { x: A.x + A.r * Math.cos(a0), y: A.y + A.r * Math.sin(a0) };
  const p2 = { x: A.x + (A.r + 3) * Math.cos(a1), y: A.y + (A.r + 3) * Math.sin(a1) };
  const lift = A.r + 46;
  const d = `M ${r1(p0.x)} ${r1(p0.y)} C ${r1(A.x - A.r * 0.95)} ${r1(A.y - lift)}, ${r1(A.x + A.r * 0.95)} ${r1(A.y - lift)}, ${r1(p2.x)} ${r1(p2.y)}`;
  return { ...g, loop: true, d, lx: A.x, ly: r1(A.y - A.r - 46) };
}

const hitBox = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const circleHitsBox = (c: { x: number; y: number; r: number }, b: Box, margin = 1) => {
  const cx = Math.max(b.x, Math.min(c.x, b.x + b.w)), cy = Math.max(b.y, Math.min(c.y, b.y + b.h));
  return Math.hypot(c.x - cx, c.y - cy) < c.r + margin;
};
const cubic = (p0: P, c1: P, c2: P, p3: P, t: number) => {
  const u = 1 - t;
  return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y };
};
const quad = (p0: P, c: P, p2: P, t: number) => ({
  x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x,
  y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y,
});

/** Larger automata: states in columns by breadth-first distance from the start state, each column
 *  ordered to sit near its predecessors. Every edge is bent until it clears every other state, and
 *  every label is placed at the first spot along its edge that collides with nothing already placed.
 *  Deterministic: the same DFA always gets the same drawing. */
function layoutLayered(dfa: Dfa, labels?: Map<string, string>): DfaGeometry {
  const radius = (pos: number[]) => Math.max(27, Math.ceil((setText(pos).length * SET_CH) / 2 + 12));
  const groups = groupEdges(dfa);
  // breadth-first depth, in transition order
  const depth = new Map<string, number>([[dfa.start, 0]]);
  const order: string[] = [dfa.start];
  const out = new Map<string, string[]>();
  for (const t of dfa.transitions) out.set(t.from, [...(out.get(t.from) ?? []), t.to]);
  for (let k = 0; k < order.length; k++)
    for (const to of out.get(order[k]) ?? []) if (!depth.has(to)) { depth.set(to, depth.get(order[k])! + 1); order.push(to); }
  for (const s of dfa.states) if (!depth.has(s.name)) { depth.set(s.name, 0); order.push(s.name); }   // unreachable (never from the direct method)
  const cols: string[][] = [];
  for (const id of order) (cols[depth.get(id)!] ??= []).push(id);
  // one barycentre pass: a state sits near the states that lead to it
  const rank = new Map<string, number>();
  cols.forEach((col, d) => {
    if (d > 0) {
      const bary = (id: string) => {
        const from = dfa.transitions.filter((t) => t.to === id && depth.get(t.from) === d - 1).map((t) => rank.get(t.from)!);
        return from.length ? from.reduce((a, b) => a + b, 0) / from.length : Infinity;
      };
      const keyed = col.map((id, i) => ({ id, i, b: bary(id) }));
      keyed.sort((a, b) => a.b - b.b || a.i - b.i);
      col.splice(0, col.length, ...keyed.map((k) => k.id));
    }
    col.forEach((id, i) => rank.set(id, i));
  });
  const byName = new Map(dfa.states.map((s) => [s.name, s]));
  const rMax = Math.max(...dfa.states.map((s) => radius(s.positions)));
  const VGAP = 2 * rMax + 92;            // room for the self-loop and its label above every state
  const nodes: NodeGeo[] = [];
  let x = 0;
  cols.forEach((col, d) => {
    const colR = Math.max(...col.map((id) => radius(byName.get(id)!.positions)));
    if (d > 0) x += Math.max(...cols[d - 1].map((id) => radius(byName.get(id)!.positions))) + colR + 150;
    col.forEach((id, i) => {
      const s = byName.get(id)!;
      // stagger alternate columns by half a row, so straight edges between columns rarely run through a state
      const y = (i - (col.length - 1) / 2) * VGAP + (d % 2 ? VGAP / 4 : 0);
      nodes.push({ id, x: r1(x), y: r1(y), r: radius(s.positions), positions: s.positions, accepting: s.accepting });
    });
  });
  const at = new Map(nodes.map((nd) => [nd.id, nd]));
  const loopZone = (A: NodeGeo) => ({ x: A.x - A.r, y: A.y - A.r - 58, w: A.r * 2, h: 58 });
  const loops = new Set([...groups.values()].filter((g) => g.from === g.to).map((g) => g.from));

  const placed: Box[] = [];
  const text = (g: Group) => labels?.get(g.id) ?? edgeLabel(g.symbols);
  const edges: EdgeGeo[] = [];
  // self-loops first: their labels have a fixed seat
  for (const g of groups.values()) if (g.from === g.to) {
    const e = selfLoop(g, at.get(g.from)!);
    placed.push(labelBox(text(g), e.lx, e.ly));
    edges.push(e);
  }
  for (const g of groups.values()) {
    if (g.from === g.to) continue;
    const A = at.get(g.from)!, B = at.get(g.to)!;
    const reverse = groups.has(edgeId(g.to, g.from));
    const dir = unit(sub(B, A));
    const normal = { x: dir.y, y: -dir.x };
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    // Candidate routes, simplest first; the first that clears every other state (and the self-loops
    // drawn above states) wins, otherwise the one with the most clearance.
    const L = Math.hypot(B.x - A.x, B.y - A.y);
    const sizes: number[] = [];
    for (let b = 30; b <= Math.max(320, L * 0.8); b = Math.round(b * 1.18 + 6)) sizes.push(b);
    const routes: { c1: P; c2: P }[] = [];
    const quadRoute = (bend: number) => {
      const c = { x: mid.x + normal.x * bend * 2, y: mid.y + normal.y * bend * 2 };
      // a quadratic as a cubic: control points two thirds of the way to c
      return { c1: { x: A.x + (c.x - A.x) * 2 / 3, y: A.y + (c.y - A.y) * 2 / 3 }, c2: { x: B.x + (c.x - B.x) * 2 / 3, y: B.y + (c.y - B.y) * 2 / 3 } };
    };
    if (!reverse) routes.push({ c1: A, c2: B });
    const dx = B.x - A.x;
    if (Math.abs(dx) > 1 && !reverse)       // leave and enter sideways, travelling in the gap between columns
      for (const f of [0.5, 0.35, 0.7]) routes.push({ c1: { x: A.x + dx * f, y: A.y }, c2: { x: B.x - dx * f, y: B.y } });
    if (Math.abs(dx) <= 1)                  // same column: a C-shaped detour into the gap beside it
      for (const w of [70, 100, 130]) for (const side of [1, -1]) routes.push({ c1: { x: A.x + side * w, y: A.y }, c2: { x: B.x + side * w, y: B.y } });
    for (const b of reverse ? [...sizes, ...sizes.filter((v) => v >= 95).map((v) => -v)] : sizes.flatMap((v) => [v, -v])) routes.push(quadRoute(b));
    const clearance = (r: { c1: P; c2: P }) => {
      let worst = Infinity;
      for (let k = 1; k < 32; k++) {
        const p = cubic(A, r.c1, r.c2, B, k / 32);
        for (const K of nodes) {
          if (K === A || K === B) continue;
          worst = Math.min(worst, Math.hypot(p.x - K.x, p.y - K.y) - K.r - 10);
          if (loops.has(K.id) && circleHitsBox({ x: p.x, y: p.y, r: 0 }, loopZone(K), 6)) worst = Math.min(worst, -1);
        }
        if (worst < -40) break;
      }
      return worst;
    };
    let route = routes[0], best = -Infinity;
    for (const r of routes) {
      const cl = clearance(r);
      if (cl >= 0) { route = r; break; }
      if (cl > best) { best = cl; route = r; }
    }
    const straight = route.c1 === A && route.c2 === B;
    const ua = unit(sub(straight ? B : route.c1, A)), ub = unit(sub(straight ? A : route.c2, B));
    const p0 = { x: A.x + ua.x * A.r, y: A.y + ua.y * A.r };
    const p2 = { x: B.x + ub.x * (B.r + 3), y: B.y + ub.y * (B.r + 3) };
    const c1 = straight ? p0 : route.c1, c2 = straight ? p2 : route.c2;
    const d = straight
      ? `M ${r1(p0.x)} ${r1(p0.y)} L ${r1(p2.x)} ${r1(p2.y)}`
      : `M ${r1(p0.x)} ${r1(p0.y)} C ${r1(c1.x)} ${r1(c1.y)}, ${r1(c2.x)} ${r1(c2.y)}, ${r1(p2.x)} ${r1(p2.y)}`;
    const at_ = (t: number) => cubic(p0, c1, c2, p2, t);
    // label: the first free spot on the edge (its plate-coloured box masks the line beneath it)
    const label = text(g);
    let spot = at_(0.5);
    let found = false;
    const free = (b: Box) => !placed.some((q) => hitBox(q, b)) && !nodes.some((K) => circleHitsBox(K, b, 2))
      && ![...loops].some((id) => id !== g.from && hitBox(loopZone(at.get(id)!), b));
    for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73, 0.2, 0.8]) {
      const p = at_(t);
      for (const off of [0, 14, -14, 26, -26]) {
        const q = { x: p.x + normal.x * off, y: p.y + normal.y * off };
        if (free(labelBox(label, q.x, q.y))) { spot = q; found = true; break; }
      }
      if (found) break;
    }
    placed.push(labelBox(label, spot.x, spot.y));
    edges.push({ ...g, loop: false, d, lx: r1(spot.x), ly: r1(spot.y) });
  }
  // keep the transition order the DFA lists (the drawing order of edges is stable)
  const pos = new Map([...groups.keys()].map((k, i) => [k, i]));
  edges.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  const s0 = at.get(dfa.start)!;
  const start = { x1: s0.x - s0.r - 52, y1: s0.y, x2: s0.x - s0.r - 3, y2: s0.y, lx: s0.x - s0.r - 30, ly: s0.y - 14 };
  return { nodes, edges, start, layout: 'layered', box: frame(nodes, edges, start, 'layered', labels) };
}

/** Bounding box of everything that is drawn (self-loops sit above a node in a row, left of it in a column). */
function frame(nodes: NodeGeo[], edges: EdgeGeo[], start: DfaGeometry['start'], layout: DfaGeometry['layout'], labels?: Map<string, string>): Box {
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const pts: Box[] = [
    ...nodes.map((nd) => ({ x: nd.x - nd.r, y: nd.y - nd.r, w: nd.r * 2, h: nd.r * 2 })),
    ...edges.map((e) => labelBox(labels?.get(e.id) ?? edgeLabel(e.symbols), e.lx, e.ly)),
    ...edges.filter((e) => e.loop).map((e) => {
      const A = byId.get(e.from)!;
      return layout === 'column' ? { x: A.x - A.r - 50, y: A.y - A.r, w: 50, h: A.r * 2 } : { x: A.x - A.r, y: A.y - A.r - 50, w: A.r * 2, h: 50 };
    }),
    labelBox('start', start.lx, start.ly), { x: start.x1 - 2, y: start.y1 - 2, w: 4, h: 4 },
  ];
  const minX = Math.min(...pts.map((b) => b.x)), minY = Math.min(...pts.map((b) => b.y));
  const maxX = Math.max(...pts.map((b) => b.x + b.w)), maxY = Math.max(...pts.map((b) => b.y + b.h));
  const pad = 14;
  return { x: r1(minX - pad), y: r1(minY - pad), w: r1(maxX - minX + pad * 2), h: r1(maxY - minY + pad * 2) };
}

const swapPath = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, '$2 $1');

function toColumn(g: DfaGeometry, startId: string, labels?: Map<string, string>): DfaGeometry {
  const nodes = g.nodes.map((nd) => ({ ...nd, x: nd.y, y: nd.x }));
  const edges = g.edges.map((e) => {
    const lx = e.ly, ly = e.lx;
    if (e.loop) return { ...e, d: swapPath(e.d), lx: r1(lx), ly: r1(ly) };
    // a row label sat 15 px above or below its edge; beside a vertical edge it needs half its own width
    const w = labelBox(edgeLabel(e.symbols), 0, 0).w;
    const side = lx < 0 ? -1 : 1;                 // every node sits on x = 0; the label keeps its side of the column
    const curveX = lx - side * 15;
    return { ...e, d: swapPath(e.d), lx: r1(curveX + side * (w / 2 + 5)), ly: r1(ly) };
  });
  // the start arrow comes in from above; its label sits to the right (self-loops are on the left)
  const st = nodes.find((nd) => nd.id === startId)!;
  const start = { x1: st.x, y1: st.y - st.r - 52, x2: st.x, y2: st.y - st.r - 3, lx: st.x + 36, ly: st.y - st.r - 30 };
  return { nodes, edges, start, layout: 'column', box: frame(nodes, edges, start, 'column', labels) };
}

/** Label for each drawn edge given only the transitions visible so far ("a,b" when grouped). */
export function visibleEdgeLabels(transitions: { from: string; to: string; symbol: string }[]) {
  const m = new Map<string, string>();
  for (const t of transitions) {
    const id = edgeId(t.from, t.to);
    m.set(id, m.has(id) ? `${m.get(id)},${labelSymbol(t.symbol)}` : labelSymbol(t.symbol));
  }
  return m;
}

/** Pairs of drawn things that collide: label/label and label/node. Used by the layout test. */
export function overlaps(g: DfaGeometry): string[] {
  const out: string[] = [];
  const boxes = g.edges.map((e) => ({ id: e.id, b: labelBox(edgeLabel(e.symbols), e.lx, e.ly) }));
  const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const circleHit = (c: NodeGeo, b: Box) => {
    const cx = Math.max(b.x, Math.min(c.x, b.x + b.w)), cy = Math.max(b.y, Math.min(c.y, b.y + b.h));
    return Math.hypot(c.x - cx, c.y - cy) < c.r + 1;
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].b, boxes[j].b)) out.push(`label ${boxes[i].id} × label ${boxes[j].id}`);
    for (const nd of g.nodes) if (circleHit(nd, boxes[i].b)) out.push(`label ${boxes[i].id} × node ${nd.id}`);
  }
  for (let i = 0; i < g.nodes.length; i++)
    for (let j = i + 1; j < g.nodes.length; j++) {
      const a = g.nodes[i], b = g.nodes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 8) out.push(`node ${a.id} × node ${b.id}`);
    }
  return out;
}

/** Edges (not self-loops) whose drawn curve runs through a state other than its own two ends. */
export function edgesThroughStates(g: DfaGeometry): string[] {
  const out: string[] = [];
  for (const e of g.edges) {
    if (e.loop) continue;
    const n = e.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const p0 = { x: n[0], y: n[1] };
    const pt = (i: number) => ({ x: n[i], y: n[i + 1] });
    const at = (t: number) => (n.length === 8 ? cubic(p0, pt(2), pt(4), pt(6), t) : n.length === 6 ? quad(p0, pt(2), pt(4), t)
      : { x: p0.x + (n[2] - p0.x) * t, y: p0.y + (n[3] - p0.y) * t });
    for (const K of g.nodes) {
      if (K.id === e.from || K.id === e.to) continue;
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const p = at(t);
        if (Math.hypot(p.x - K.x, p.y - K.y) < K.r) { out.push(`edge ${e.id} × node ${K.id}`); break; }
      }
    }
  }
  return out;
}

/** The accessible description of what is drawn at this step (never the parts still hidden). */
export function graphSummary(dfa: Dfa, states: ReadonlySet<string>, transitions: readonly { from: string; to: string; symbol: string }[]) {
  const shown = dfa.states.filter((s) => states.has(s.name));
  if (shown.length === 0) return 'DFA drawing: no state yet.';
  const accepting = shown.filter((s) => s.accepting).map((s) => s.name);
  const done = shown.length === dfa.states.length && transitions.length === dfa.transitions.length;
  return `DFA ${done ? 'with' : 'so far:'} ${shown.length} state${shown.length === 1 ? '' : 's'}. Start state ${dfa.start}. Accepting: ${accepting.join(', ') || 'none yet'}. `
    + (transitions.length ? transitions.map((t) => `${t.from} on ${labelSymbol(t.symbol)} goes to ${t.to}`).join('; ') + '.' : 'No transition yet.');
}

