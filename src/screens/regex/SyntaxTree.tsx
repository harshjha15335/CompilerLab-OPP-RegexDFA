import { useMemo } from 'react';
import type { RegexNode } from '../../core/index.ts';
import type { NodeProps } from '../../replay/selectors.ts';
import { cx } from '../../ui/kit.tsx';

const GAP_X = 104, GAP_Y = 58, R = 18, PAD_X = 72, PAD_TOP = 30, PAD_BOTTOM = 74;
const GLYPH: Record<string, string> = { or: '|', cat: '·', star: '*', plus: '+', opt: '?' };
export const NODE_NAME: Record<string, string> = { or: 'union', cat: 'concatenation', star: 'star', plus: 'plus', opt: 'optional', leaf: 'leaf' };
const setStr = (a: number[]) => `{${a.join(',')}}`;

/** Drawing geometry only: leaves spread left to right, parents centred over their children. */
function layoutTree(root: RegexNode) {
  const place = new Map<number, { x: number; y: number }>();
  let leafIndex = 0, maxDepth = 0;
  (function walk(n: RegexNode, depth: number): number {
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (n.type === 'leaf') x = leafIndex++ * GAP_X;
    else { const xs = n.children!.map((c) => walk(c, depth + 1)); x = xs.reduce((s, v) => s + v, 0) / xs.length; }
    place.set(n.id, { x: x + PAD_X, y: depth * GAP_Y + PAD_TOP + R });
    return x;
  })(root, 0);
  return { place, width: Math.max(1, leafIndex - 1) * GAP_X + PAD_X * 2, height: maxDepth * GAP_Y + PAD_TOP + PAD_BOTTOM + R * 2 };
}

/** Hand-written SVG of the real AST from the core (including the augmenting # leaf).
 *  props: nodes whose nullable/firstpos/lastpos are known. built: ids that exist so far (others are
 *  drawn as faint outlines). arcs: followpos arrows between leaves for the current step. */
export function SyntaxTree({ root, nodes, props, activeId, readIds, annotate = 'none', arcs, built }: {
  root: RegexNode; nodes: RegexNode[]; props?: Map<number, NodeProps>; activeId?: number | null; readIds?: Set<number>;
  annotate?: 'none' | 'active' | 'all'; arcs?: { from: number; to: number[]; changed: boolean } | null; built?: Set<number>;
}) {
  const { place, width, height } = useMemo(() => layoutTree(root), [root]);
  const leafByPos = useMemo(() => new Map(nodes.filter((n) => n.type === 'leaf').map((n) => [n.pos!, n])), [nodes]);
  const baseY = height - PAD_BOTTOM + 16;
  return (
    <svg className={cx('tree', built && 'tree--build')} viewBox={`0 0 ${width} ${height}`} role="group"
      aria-label="Syntax tree of the augmented regular expression" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="tree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="tree__arrowhead" />
        </marker>
      </defs>
      <g className="tree__edges">
        {nodes.flatMap((n) => (n.children ?? []).map((c) => {
          const p = place.get(n.id)!, q = place.get(c.id)!;
          return <line key={`${n.id}-${c.id}`} x1={q.x} y1={q.y} x2={p.x} y2={p.y} pathLength={1}
            className={cx(activeId === n.id && readIds?.has(c.id) && 'is-read', built && !built.has(n.id) && 'is-ghost', built && activeId === n.id && 'is-drawing')} />;
        }))}
      </g>
      {arcs && arcs.to.map((qpos) => {
        const from = leafByPos.get(arcs.from), to = leafByPos.get(qpos);
        if (!from || !to) return null;
        const a = place.get(from.id)!, b = place.get(to.id)!;
        const y0 = a.y + R + 20, y1 = b.y + R + 20;
        const d = arcs.from === qpos
          ? `M ${a.x - 8} ${y0} C ${a.x - 30} ${baseY + 26}, ${a.x + 30} ${baseY + 26}, ${a.x + 8} ${y0}`
          : `M ${a.x} ${y0} C ${a.x} ${baseY + 34}, ${b.x} ${baseY + 34}, ${b.x} ${y1}`;
        return <path key={qpos} d={d} pathLength={1} className={cx('tree__arc', !arcs.changed && 'is-dup')} markerEnd="url(#tree-arrow)" />;
      })}
      {nodes.map((n) => {
        const { x, y } = place.get(n.id)!;
        const p = props?.get(n.id);
        const leaf = n.type === 'leaf';
        const active = activeId === n.id, read = readIds?.has(n.id);
        const show = p && (annotate === 'all' || ((active || read) && annotate === 'active'));
        const name = leaf ? `Leaf ${n.symbol}, position ${n.pos}${n.isEnd ? ', the end marker' : ''}` : `${NODE_NAME[n.type]} node`;
        return (
          <g key={n.id} className={cx('tnode', leaf ? 'tnode--leaf' : 'tnode--op', n.isEnd && 'tnode--end', active && 'is-active', read && 'is-read',
            p && 'is-known', built && !built.has(n.id) && 'is-ghost')} transform={`translate(${x} ${y})`} role="img"
            aria-label={`${name}${p ? `. nullable ${p.nullable}, firstpos ${setStr(p.firstpos)}, lastpos ${setStr(p.lastpos)}` : ''}`}>
            {active && (
              <g className="tnode__brackets" aria-hidden="true">
                <path d={`M ${-R - 8} ${-R - 1} v -7 h 7`} /><path d={`M ${R + 8} ${-R - 1} v -7 h -7`} />
                <path d={`M ${-R - 8} ${R + 1} v 7 h 7`} /><path d={`M ${R + 8} ${R + 1} v 7 h -7`} />
              </g>
            )}
            {leaf
              ? <><rect x={-R} y={-R} width={R * 2} height={R * 2} className="tnode__shape" />{n.isEnd && <rect x={-R + 4} y={-R + 4} width={R * 2 - 8} height={R * 2 - 8} className="tnode__inner" />}</>
              : <circle r={R} className="tnode__shape" />}
            <text className="tnode__glyph" dy="0.35em">{leaf ? n.symbol : GLYPH[n.type]}</text>
            {leaf && <text className="tnode__pos" y={R + 15}>{n.pos}</text>}
            {show && (
              <g className="tnode__sets">
                <text className="tnode__first" x={-R - 6} dy="0.35em">{setStr(p.firstpos)}</text>
                <text className="tnode__last" x={R + 6} dy="0.35em">{setStr(p.lastpos)}</text>
                {p.nullable && <text className="tnode__nullable" y={leaf ? R + 29 : R + 13}>nullable</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function TreeLegend({ sets }: { sets?: boolean }) {
  return (
    <ul className="legend" aria-label="Tree legend">
      <li><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /></svg><span>operator node</span></li>
      <li><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" /></svg><span>leaf, position below</span></li>
      <li><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="15" height="15" /><rect x="6" y="6" width="8" height="8" /></svg><span># end marker</span></li>
      {sets && <li><span className="mono legend__sets">{'{f}'} ○ {'{l}'}</span><span>firstpos left, lastpos right</span></li>}
    </ul>
  );
}
