import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Dfa } from '../../core/index.ts';
import { all, drawOver, ring, travel } from '../../motion/fx.ts';
import { cx, useMedia } from '../../ui/kit.tsx';
import { edgeId, GRAPH_STATE_LIMIT, graphSummary, layoutDfa, setText, visibleEdgeLabels, type Box } from './dfaLayout.ts';
import { DfaTable } from './tables.tsx';

const MAX_SCALE = 2.5;         // px per drawing unit at the closest zoom
const READABLE_SCALE = 0.8;    // a graph that would be shrunk below LEGIBLE opens at this scale on its start state
const LEGIBLE = 0.55;          // below this fit scale, 14 px edge labels would render under 8 px
const STEP = 1.4;
const AUTO = -1;

/** Camera request: centre in drawing units and scale in px per unit (0 = fit the whole graph). */
interface View { cx: number; cy: number; s: number }

/** Hand-written SVG DFA over a fixed layout. Undiscovered parts keep their place (hidden), so the
 *  frame never changes during construction. fx: 'build' draws the new edge then the new state;
 *  'sim' sends a marker along the edge just taken. Large automata can be zoomed and panned; above
 *  GRAPH_STATE_LIMIT states the transition table replaces the drawing. */
export function DfaGraph({ dfa, visibleStates, visibleTransitions, activeState, activeEdge, sourceState, freshState, stuck, fx, tableFallback = true }: {
  dfa: Dfa; visibleStates?: string[]; visibleTransitions?: { from: string; to: string; symbol: string }[];
  activeState?: string | null; activeEdge?: { from: string; to: string; symbol: string } | null; sourceState?: string | null;
  freshState?: string | null; stuck?: boolean; fx?: 'build' | 'sim' | null;
  /** above the drawing limit, show the transition table here (false when the stage already shows one) */
  tableFallback?: boolean;
}) {
  const tooBig = dfa.states.length > GRAPH_STATE_LIMIT;
  // phones read the automaton top to bottom at close to full size instead of a long row shrunk to fit
  const column = useMedia('(max-width: 640px)');
  const geo = useMemo(() => (tooBig ? null : layoutDfa(dfa, undefined, column ? 'column' : 'row')), [dfa, column, tooBig]);
  const states = useMemo(() => new Set(visibleStates ?? dfa.states.map((s) => s.name)), [visibleStates, dfa]);
  const transitions = visibleTransitions ?? dfa.transitions;
  const labels = useMemo(() => visibleEdgeLabels(transitions), [transitions]);
  const svg = useRef<SVGSVGElement>(null);
  const activeId = activeEdge ? edgeId(activeEdge.from, activeEdge.to) : null;

  // ── zoom and pan: the viewBox is the camera. Scale is CSS px per drawing unit, so zoom is relative
  // to the real viewport (a tall graph in a wide, short frame still zooms correctly). ──
  const box: Box = geo?.box ?? { x: 0, y: 0, w: 1, h: 1 };
  const port = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = port.current;
    if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); setSize((o) => (Math.abs(o.w - r.width) < 1 && Math.abs(o.h - r.height) < 1 ? o : { w: r.width, h: r.height })); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [geo]);
  const fitScale = size.w && size.h ? Math.min(size.w / box.w, size.h / box.h) : 1;
  const maxScale = Math.max(fitScale, MAX_SCALE);
  // The opening view: the whole graph when it is legible that way, otherwise a legible scale on the
  // start state (s = AUTO lets the camera decide once the frame has been measured).
  const initial = useCallback((): View => {
    const s0 = geo?.nodes.find((n) => n.id === dfa.start);
    return s0 ? { cx: s0.x - s0.r - 60 + 400, cy: s0.y, s: AUTO } : { cx: box.x + box.w / 2, cy: box.y + box.h / 2, s: 0 };
  }, [geo, dfa.start]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<View>(initial);
  useEffect(() => { setView(initial()); }, [initial]);
  const cam = camera(view, box, size, fitScale, maxScale);
  const zoomed = cam.s > fitScale * 1.01;
  // Whole graph: the drawing's own box, centred by preserveAspectRatio, so the markup does not depend on
  // the measured frame (stepping Back restores the identical DOM). Zoomed: the camera's window.
  const viewBox = zoomed && size.w ? `${r1(cam.x)} ${r1(cam.y)} ${r1(cam.w)} ${r1(cam.h)}` : `${box.x} ${box.y} ${box.w} ${box.h}`;

  const zoomBy = useCallback((f: number, at?: { x: number; y: number }) => setView((v) => {
    const c = camera(v, box, size, fitScale, maxScale);
    const s = Math.min(maxScale, Math.max(fitScale, c.s * f));
    const p = at ?? { x: c.cx, y: c.cy };
    return { cx: p.x + (c.cx - p.x) * (c.s / s), cy: p.y + (c.cy - p.y) * (c.s / s), s: s <= fitScale * 1.01 ? 0 : s };
  }), [box, size, fitScale, maxScale]);
  const fit = () => setView({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, s: 0 });
  const reset = () => setView(initial());
  const toUnits = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: cam.x + (clientX - r.left) / cam.s, y: cam.y + (clientY - r.top) / cam.s };
  };
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; s: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!zoomed || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy, s: cam.s };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    setView({ cx: d.cx - (e.clientX - d.x) / d.s, cy: d.cy - (e.clientY - d.y) / d.s, s: d.s });
  };
  const endDrag = () => { drag.current = null; };
  // Ctrl / ⌘ + wheel zooms around the pointer; a plain wheel keeps scrolling the page
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, toUnits(e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  // keep the state being worked on in view while zoomed in
  const focusId = activeState ?? freshState ?? null;
  useEffect(() => {
    if (!geo || !focusId || !zoomed) return;
    const n = geo.nodes.find((x) => x.id === focusId);
    if (!n) return;
    const inside = n.x - n.r - 20 > cam.x && n.x + n.r + 20 < cam.x + cam.w && n.y - n.r - 60 > cam.y && n.y + n.r + 20 < cam.y + cam.h;
    if (!inside) setView({ cx: n.x, cy: n.y, s: cam.s });
  }, [focusId, geo]); // eslint-disable-line react-hooks/exhaustive-deps
  // keyboard camera, only while the drawing itself has focus (the replay keys work everywhere else)
  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = 80 / cam.s;
    const move = (dx: number, dy: number) => setView({ cx: cam.cx + dx, cy: cam.cy + dy, s: cam.s });
    switch (e.key) {
      case '+': case '=': zoomBy(STEP); break;
      case '-': case '_': zoomBy(1 / STEP); break;
      case '0': fit(); break;
      case 'ArrowLeft': move(-k, 0); break;
      case 'ArrowRight': move(k, 0); break;
      case 'ArrowUp': move(0, -k); break;
      case 'ArrowDown': move(0, k); break;
      default: return;
    }
    e.preventDefault();
  };

  useLayoutEffect(() => {
    const root = svg.current;
    if (!fx || !activeId || !root) return undefined;
    const path = root.querySelector<SVGPathElement>(`[data-edge="${CSS.escape(activeId)}"] .dedge__line`);
    if (fx === 'build') {
      const fresh = freshState ? root.querySelector(`[data-state="${CSS.escape(freshState)}"] .dstate__body`) : null;
      return all(drawOver(path, { duration: 260 }), fresh ? ring(fresh, { delay: 220 }) : undefined);
    }
    if (!path) return undefined;
    const m = path.getScreenCTM();
    if (!m) return undefined;
    const L = path.getTotalLength();
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t) => { const p = path.getPointAtLength(L * t); return new DOMPoint(p.x, p.y).matrixTransform(m); });
    return all(travel(pts.map((p) => ({ x: p.x, y: p.y })), { duration: 260 }),
      ring(root.querySelector(`[data-state="${CSS.escape(activeEdge!.to)}"] .dstate__ring`), { delay: 220 }));
  }, [fx, activeId, freshState, activeEdge]);

  if (!geo) {
    const shown = dfa.states.filter((s) => states.has(s.name));
    return (
      <figure className="dfa dfa--table">
        <p className="dfa__notice" role="note">This DFA has {dfa.states.length} states, more than the {GRAPH_STATE_LIMIT} that can be drawn legibly,
          so it is {tableFallback ? 'shown as its transition table' : 'not drawn; use the transition table'}. Every state and transition is listed; nothing is left out.</p>
        {tableFallback && <div className="scroll scroll--dfa" tabIndex={0} role="region" aria-label="DFA transition table, scrollable">
          <DfaTable alphabet={dfa.alphabet} states={shown} transitions={transitions} start={dfa.start}
            hit={activeEdge ? { from: activeEdge.from, symbol: activeEdge.symbol } : null} rowState={activeState ?? freshState ?? null} freshState={freshState} />
        </div>}
      </figure>
    );
  }

  const usesCurrent = activeState !== undefined;
  const summary = graphSummary(dfa, states, transitions);
  const pct = Math.round(cam.s * 100);
  return (
    <figure className="dfa">
      <div className="dfa__tools" role="toolbar" aria-label="Graph view" aria-controls="dfa-viewport">
        <button type="button" className="toolbtn" onClick={() => zoomBy(STEP)} disabled={cam.s >= maxScale * 0.99} aria-label="Zoom in">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14M5 7h4M7 5v4" /></svg></button>
        <button type="button" className="toolbtn" onClick={() => zoomBy(1 / STEP)} disabled={!zoomed} aria-label="Zoom out">
          <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14M5 7h4" /></svg></button>
        <button type="button" className="toolbtn toolbtn--text" onClick={fit} disabled={!zoomed}>Fit</button>
        <button type="button" className="toolbtn toolbtn--text" onClick={reset}>Reset</button>
        <span className="dfa__zoom" aria-live="polite">{zoomed ? `${pct}% of actual size` : 'Whole graph'}</span>
        {zoomed && <span className="dfa__hint">Drag to pan</span>}
      </div>
      <div id="dfa-viewport" ref={port} className={cx('dfa__viewport', zoomed && 'is-zoomed')} tabIndex={zoomed ? 0 : undefined}
        data-own-keys={zoomed ? '' : undefined} onKeyDown={zoomed ? onKeyDown : undefined}
        aria-label={zoomed ? 'Zoomed graph. Arrow keys pan, plus and minus zoom, 0 shows the whole graph.' : undefined}
        role={zoomed ? 'group' : undefined}>
        <svg ref={svg} className="dfa__svg" viewBox={viewBox} role="img" aria-label={summary} preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <defs>
            <marker id="dfa-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="dfa__arrowhead" />
            </marker>
            <marker id="dfa-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="dfa__arrowhead dfa__arrowhead--hot" />
            </marker>
          </defs>
          <g className={cx('dstart', !states.has(dfa.start) && 'is-hidden')}>
            <line x1={geo.start.x1} y1={geo.start.y1} x2={geo.start.x2} y2={geo.start.y2} markerEnd="url(#dfa-arrow)" />
            <text x={geo.start.lx} y={geo.start.ly} textAnchor="middle">start</text>
          </g>
          {geo.edges.map((e) => {
            const label = labels.get(e.id);
            const hot = e.id === activeId;
            const w = [...(label ?? '')].length * 8.6 + 10;
            return (
              <g key={e.id} data-edge={e.id} className={cx('dedge', label === undefined && 'is-hidden', hot && 'is-active')}>
                <path className="dedge__line" d={e.d} pathLength={1} markerEnd={hot ? 'url(#dfa-arrow-hot)' : 'url(#dfa-arrow)'} />
                <g className="dedge__label" transform={`translate(${e.lx} ${e.ly})`}>
                  <rect x={-w / 2} y={-11} width={w} height={22} rx={4} />
                  <text dy="0.35em" textAnchor="middle">{label}</text>
                </g>
              </g>
            );
          })}
          {geo.nodes.map((n) => (
            <g key={n.id} data-state={n.id} transform={`translate(${n.x} ${n.y})`}
              className={cx('dstate', !states.has(n.id) && 'is-hidden', n.accepting && 'is-accepting', n.id === activeState && 'is-current',
                n.id === activeState && stuck && 'is-stuck', n.id === sourceState && 'is-source', n.id === freshState && 'is-fresh')}>
              <circle className="dstate__body" r={n.r} />
              {n.accepting && <circle className="dstate__inner" r={n.r - 5} />}
              {n.id === activeState && <circle className="dstate__ring" r={n.r + 7} pathLength={1} />}
              <text className="dstate__name" y={-5} textAnchor="middle">{n.id}</text>
              <text className="dstate__set" y={13} textAnchor="middle">{setText(n.positions)}</text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="legend legend--graph">
        <span><svg viewBox="0 0 28 12" aria-hidden="true"><line x1="1" y1="6" x2="24" y2="6" /><path d="M20 2 26 6 20 10" /></svg>start</span>
        <span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" /><circle cx="10" cy="10" r="5.5" /></svg>accepting (double ring)</span>
        {usesCurrent && <span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" /><circle className="lg-ring" cx="10" cy="10" r="9" /></svg>current state</span>}
        {fx === 'build' || sourceState !== undefined ? <span><svg viewBox="0 0 20 20" aria-hidden="true"><circle className="lg-src" cx="10" cy="10" r="8" /></svg>state being expanded (dashed)</span> : null}
      </figcaption>
    </figure>
  );
}

/** The viewBox actually shown: the requested view at a legal scale, kept over the drawing. */
const r1 = (v: number) => Math.round(v * 10) / 10;

function camera(v: View, box: Box, size: { w: number; h: number }, fitScale: number, maxScale: number) {
  if (v.s === AUTO) v = fitScale >= LEGIBLE ? { cx: box.x + box.w / 2, cy: box.y + box.h / 2, s: 0 } : { ...v, s: READABLE_SCALE };
  const s = v.s === 0 ? fitScale : Math.min(maxScale, Math.max(fitScale, v.s));
  const w = size.w ? size.w / s : box.w, h = size.h ? size.h / s : box.h;
  const cx = w >= box.w ? box.x + box.w / 2 : Math.min(box.x + box.w - w / 2, Math.max(box.x + w / 2, v.cx));
  const cy = h >= box.h ? box.y + box.h / 2 : Math.min(box.y + box.h - h / 2, Math.max(box.y + h / 2, v.cy));
  return { s, cx, cy, w, h, x: cx - w / 2, y: cy - h / 2 };
}
