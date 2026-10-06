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
  box: Box; layout: 'row' | 'column' | 'ring';
}

export const setText = (p: number[]) => `{${p.join(',')}}`;
export const labelBox = (text: string, x: number, y: number): Box => {
  const w = text.length * LABEL_CH + 10, h = 22;
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
  const g = layoutRowOrRing(dfa, labels);
  return orient === 'column' && g.layout === 'row' ? toColumn(g, dfa.start, labels) : g;
}

function layoutRowOrRing(dfa: Dfa, labels?: Map<string, string>): DfaGeometry {
  const n = dfa.states.length;
  const radius = (pos: number[]) => Math.max(27, Math.ceil((setText(pos).length * SET_CH) / 2 + 12));
  const row = n <= 7;
  let x = 0;
  const nodes: NodeGeo[] = dfa.states.map((s, i) => {
    const r = radius(s.positions);
    if (row) {
      if (i > 0) x += radius(dfa.states[i - 1].positions) + r + GAP;
      return { id: s.name, x, y: 0, r, positions: s.positions, accepting: s.accepting };
    }
    const t = Math.PI + (2 * Math.PI * i) / n;           // start state on the left
    return { id: s.name, x: r1(Math.cos(t) * Math.max(300, n * 58)), y: r1(Math.sin(t) * Math.max(210, n * 42)), r, positions: s.positions, accepting: s.accepting };
  });
  const at = new Map(nodes.map((nd, i) => [nd.id, { nd, i }]));

  const groups = new Map<string, { id: string; from: string; to: string; symbols: string[] }>();
  for (const t of dfa.transitions) {
    const id = edgeId(t.from, t.to);
    if (!groups.has(id)) groups.set(id, { id, from: t.from, to: t.to, symbols: [] });
    groups.get(id)!.symbols.push(t.symbol);
  }

  const edges: EdgeGeo[] = [...groups.values()].map((g) => {
    const { nd: A, i: ia } = at.get(g.from)!;
    const { nd: B, i: ib } = at.get(g.to)!;
    if (g.from === g.to) {
      const a0 = (-115 * Math.PI) / 180, a1 = (-65 * Math.PI) / 180;
      const p0 = { x: A.x + A.r * Math.cos(a0), y: A.y + A.r * Math.sin(a0) };
      const p2 = { x: A.x + (A.r + 3) * Math.cos(a1), y: A.y + (A.r + 3) * Math.sin(a1) };
      const lift = A.r + 46;
      const d = `M ${r1(p0.x)} ${r1(p0.y)} C ${r1(A.x - A.r * 0.95)} ${r1(A.y - lift)}, ${r1(A.x + A.r * 0.95)} ${r1(A.y - lift)}, ${r1(p2.x)} ${r1(p2.y)}`;
      return { ...g, loop: true, d, lx: A.x, ly: r1(A.y - A.r - 46) };
    }
    const span = Math.abs(ia - ib);
    const reverse = groups.has(edgeId(g.to, g.from));
    const dir = unit(sub(B, A));
    const normal = { x: dir.y, y: -dir.x };                 // left of the direction: up for left→right
    const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    let bend: number;
    if (row) {
      bend = span === 1 && !reverse ? 0 : 34 + 46 * (span - 1);
      // An arc that jumps over nodes must clear them, and clear their self-loops when it bends
      // upward (loops are drawn above). The quadratic's height at fraction u is 4·bend·u(1−u).
      for (let k = Math.min(ia, ib) + 1; k < Math.max(ia, ib); k++) {
        const K = nodes[k];
        const u = (K.x - A.x) / (B.x - A.x);
        const up = normal.y < 0;
        const need = K.r + (up && groups.has(edgeId(K.id, K.id)) ? 72 : 16);
        bend = Math.max(bend, Math.ceil(need / (4 * u * (1 - u))));
      }
    } else {
      // ring: neighbours bend outward; chords bend toward the centre so they never pass over a
      // neighbour; an edge with a reverse partner keeps its own side so the pair separates
      const ringSpan = Math.min(span, n - span);
      const towardCentre = normal.x * -mid.x + normal.y * -mid.y > 0 ? 1 : -1;
      bend = reverse ? 26 : ringSpan === 1 ? -towardCentre * 22 : towardCentre * 40;
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

  const layout = row ? 'row' : 'ring';
  return { nodes, edges, start, layout, box: frame(nodes, edges, start, layout, labels) };
}

/** Bounding box of everything that is drawn (self-loops sit above a node in a row, left of it in a column). */
function frame(nodes: NodeGeo[], edges: EdgeGeo[], start: DfaGeometry['start'], layout: DfaGeometry['layout'], labels?: Map<string, string>): Box {
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const pts: Box[] = [
    ...nodes.map((nd) => ({ x: nd.x - nd.r, y: nd.y - nd.r, w: nd.r * 2, h: nd.r * 2 })),
    ...edges.map((e) => labelBox(labels?.get(e.id) ?? e.symbols.join(','), e.lx, e.ly)),
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
    const w = labelBox(e.symbols.join(','), 0, 0).w;
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
    m.set(id, m.has(id) ? `${m.get(id)},${t.symbol}` : t.symbol);
  }
  return m;
}

/** Pairs of drawn things that collide: label/label and label/node. Used by the layout test. */
export function overlaps(g: DfaGeometry): string[] {
  const out: string[] = [];
  const boxes = g.edges.map((e) => ({ id: e.id, b: labelBox(e.symbols.join(','), e.lx, e.ly) }));
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
