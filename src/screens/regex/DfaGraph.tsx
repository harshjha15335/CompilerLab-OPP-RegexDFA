import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Dfa } from '../../core/index.ts';
import { all, drawOver, ring, travel } from '../../motion/fx.ts';
import { cx, useMedia } from '../../ui/kit.tsx';
import { edgeId, layoutDfa, setText, visibleEdgeLabels } from './dfaLayout.ts';

/** Hand-written SVG DFA over a fixed layout. Undiscovered parts keep their place (hidden), so the
 *  frame never changes during construction. fx: 'build' draws the new edge then the new state;
 *  'sim' sends a marker along the edge just taken. */
export function DfaGraph({ dfa, visibleStates, visibleTransitions, activeState, activeEdge, sourceState, freshState, stuck, fx }: {
  dfa: Dfa; visibleStates?: string[]; visibleTransitions?: { from: string; to: string; symbol: string }[];
  activeState?: string | null; activeEdge?: { from: string; to: string; symbol: string } | null; sourceState?: string | null;
  freshState?: string | null; stuck?: boolean; fx?: 'build' | 'sim' | null;
}) {
  // phones read the automaton top to bottom at close to full size instead of a long row shrunk to fit
  const column = useMedia('(max-width: 640px)');
  const geo = useMemo(() => layoutDfa(dfa, undefined, column ? 'column' : 'row'), [dfa, column]);
  const states = useMemo(() => new Set(visibleStates ?? dfa.states.map((s) => s.name)), [visibleStates, dfa]);
  const labels = useMemo(() => visibleEdgeLabels(visibleTransitions ?? dfa.transitions), [visibleTransitions, dfa]);
  const svg = useRef<SVGSVGElement>(null);
  const activeId = activeEdge ? edgeId(activeEdge.from, activeEdge.to) : null;

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

  const summary = `DFA with ${dfa.states.length} states. Start state ${dfa.start}. Accepting: ${dfa.accepting.join(', ') || 'none'}. `
    + dfa.transitions.map((t) => `${t.from} on ${t.symbol} goes to ${t.to}`).join('; ') + '.';
  const { box } = geo;
  return (
    <figure className="dfa">
      <svg ref={svg} className="dfa__svg" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label={summary} preserveAspectRatio="xMidYMid meet">
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
          return (
            <g key={e.id} data-edge={e.id} className={cx('dedge', label === undefined && 'is-hidden', hot && 'is-active')}>
              <path className="dedge__line" d={e.d} pathLength={1} markerEnd={hot ? 'url(#dfa-arrow-hot)' : 'url(#dfa-arrow)'} />
              <g className="dedge__label" transform={`translate(${e.lx} ${e.ly})`}>
                <rect x={-((label ?? '').length * 8.6 + 10) / 2} y={-11} width={(label ?? '').length * 8.6 + 10} height={22} rx={4} />
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
      <figcaption className="legend legend--graph">
        <span><svg viewBox="0 0 28 12" aria-hidden="true"><line x1="1" y1="6" x2="24" y2="6" /><path d="M20 2 26 6 20 10" /></svg>start</span>
        <span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" /><circle cx="10" cy="10" r="5.5" /></svg>accepting (double ring)</span>
        <span><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6" /><circle className="lg-ring" cx="10" cy="10" r="9" /></svg>current state</span>
      </figcaption>
    </figure>
  );
}
