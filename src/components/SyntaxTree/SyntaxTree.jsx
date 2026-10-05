import { useMemo } from 'react';
import { cx } from '../common/common.jsx';

const GAP_X = 112, GAP_Y = 60, R = 19, PAD_X = 86, PAD_TOP = 34, PAD_BOTTOM = 78;
const GLYPH = { or: '|', cat: '·', star: '*', plus: '+', opt: '?' };
export const NODE_NAME = { or: 'union', cat: 'concatenation', star: 'Kleene star', plus: 'plus', opt: 'optional', leaf: 'leaf' };
const setStr = (a) => `{${a.join(',')}}`;

/** Drawing geometry only: leaves spread left to right, parents centred over their children. */
function layoutTree(root) {
  const place = new Map();
  let leafIndex = 0, maxDepth = 0;
  (function walk(n, depth) {
    maxDepth = Math.max(maxDepth, depth);
    let x;
    if (n.type === 'leaf') x = leafIndex++ * GAP_X;
    else {
      const xs = n.children.map((c) => walk(c, depth + 1));
      x = xs.reduce((a, b) => a + b, 0) / xs.length;
    }
    place.set(n.id, { x: x + PAD_X, y: depth * GAP_Y + PAD_TOP + R });
    return x;
  })(root, 0);
  return { place, width: Math.max(1, leafIndex - 1) * GAP_X + PAD_X * 2, height: maxDepth * GAP_Y + PAD_TOP + PAD_BOTTOM + R * 2 };
}

/** Hand-drawn SVG of the real AST from the core (including the augmenting # leaf).
 *  props: Map nodeId -> {nullable, firstpos, lastpos} for nodes whose properties are known.
 *  arcs: { from, to[], changed }: temporary followpos arrows between leaves.
 *  built: Set of node ids that exist so far. Others are drawn as faint outlines, and the edges
 *  of the node being built draw toward it. Omit it to show the whole tree. */
export function SyntaxTree({ root, nodes, props, activeId, readIds, annotate = 'none', arcs, selectedId, onSelect, built }) {
  const { place, width, height } = useMemo(() => layoutTree(root), [root]);
  const leafByPos = useMemo(() => new Map(nodes.filter((n) => n.type === 'leaf').map((n) => [n.pos, n])), [nodes]);
  const baseY = height - PAD_BOTTOM + 18;

  return (
    <svg className={cx('tree', built && 'tree--build')} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Syntax tree of the augmented regular expression" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="tree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="tree__arrowhead" />
        </marker>
      </defs>
      <g className="tree__edges">
        {nodes.flatMap((n) => (n.children ?? []).map((c) => {
          const a = place.get(n.id), b = place.get(c.id);
          // drawn from the child up to the parent, so the stroke grows toward the node being built
          return <line key={`${n.id}-${c.id}`} x1={b.x} y1={b.y} x2={a.x} y2={a.y} pathLength="1"
            className={cx(activeId === n.id && readIds?.has(c.id) && 'is-read', built && !built.has(n.id) && 'is-ghost', built && activeId === n.id && 'is-drawing')} />;
        }))}
      </g>
      {arcs && arcs.to.map((q) => {
        const a = place.get(leafByPos.get(arcs.from).id), b = place.get(leafByPos.get(q).id);
        const y0 = a.y + R + 22, y1 = b.y + R + 22;
        const d = arcs.from === q
          ? `M ${a.x - 9} ${y0} C ${a.x - 30} ${baseY + 26}, ${a.x + 30} ${baseY + 26}, ${a.x + 9} ${y0}`
          : `M ${a.x} ${y0} C ${a.x} ${baseY + 34}, ${b.x} ${baseY + 34}, ${b.x} ${y1}`;
        return <path key={q} d={d} className={cx('tree__arc', !arcs.changed && 'is-dup')} markerEnd="url(#tree-arrow)" />;
      })}
      {nodes.map((n) => {
        const { x, y } = place.get(n.id);
        const p = props?.get(n.id);
        const leaf = n.type === 'leaf';
        const active = activeId === n.id;
        const read = readIds?.has(n.id);
        const show = p && (annotate === 'all' || ((active || read) && annotate !== 'none'));
        const label = leaf
          ? `Leaf ${n.symbol}, position ${n.pos}${n.isEnd ? ' (end marker)' : ''}`
          : `${NODE_NAME[n.type]} node`;
        return (
          <g key={n.id} className={cx('tnode', leaf ? 'tnode--leaf' : 'tnode--op', n.isEnd && 'tnode--end', active && 'is-active', read && 'is-read',
            p && 'is-known', selectedId === n.id && 'is-selected', built && !built.has(n.id) && 'is-ghost')}
            transform={`translate(${x} ${y})`} tabIndex={onSelect ? 0 : undefined} role={onSelect ? 'button' : 'img'}
            aria-label={`${label}${p ? `. nullable ${p.nullable}, firstpos ${setStr(p.firstpos)}, lastpos ${setStr(p.lastpos)}` : ''}`}
            onClick={onSelect ? () => onSelect(n) : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(n); } } : undefined}>
            {active && <g className="tnode__brackets" aria-hidden="true">
              <path d={`M ${-R - 9} ${-R - 2} v -7 h 7`} /><path d={`M ${R + 9} ${-R - 2} v -7 h -7`} />
              <path d={`M ${-R - 9} ${R + 2} v 7 h 7`} /><path d={`M ${R + 9} ${R + 2} v 7 h -7`} />
            </g>}
            {leaf
              ? <><rect x={-R} y={-R} width={R * 2} height={R * 2} className="tnode__shape" />{n.isEnd && <rect x={-R + 4} y={-R + 4} width={R * 2 - 8} height={R * 2 - 8} className="tnode__inner" />}</>
              : <circle r={R} className="tnode__shape" />}
            <text className="tnode__glyph" dy="0.35em">{leaf ? n.symbol : GLYPH[n.type]}</text>
            {leaf && <text className="tnode__pos" y={R + 16}>{n.pos}</text>}
            {show && (
              <g className="tnode__sets" key={active ? 'a' : 's'}>
                <text className="tnode__first" x={-R - 7} dy="0.35em">{setStr(p.firstpos)}</text>
                <text className="tnode__last" x={R + 7} dy="0.35em">{setStr(p.lastpos)}</text>
                {p.nullable && <text className="tnode__nullable" y={leaf ? R + 30 : R + 14}>nullable</text>}
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function TreeLegend({ sets }) {
  return (
    <ul className="legend legend--tree" aria-label="Tree legend">
      <li><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /></svg><span>operator node</span></li>
      <li><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="2" width="16" height="16" /></svg><span>leaf, position below</span></li>
      <li><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="2" width="16" height="16" /><rect x="5" y="5" width="10" height="10" /></svg><span># end marker</span></li>
      {sets && <li><span className="mono">{'{f}'} ○ {'{l}'}</span><span>firstpos left, lastpos right</span></li>}
    </ul>
  );
}
