import { Fragment, memo, type CSSProperties } from 'react';
import { cellKey, type Cell } from '../../replay/selectors.ts';
import { cx, Rel, REL_INFO } from '../../ui/kit.tsx';

export type CellMark = { left: string; right: string };
export type ChangeKind = 'new' | 'dup' | 'conflict';

/** Corner brackets: the non-colour signal for "this step wrote here". */
export const Corners = () => <span className="corners" aria-hidden="true"><i /><i /><i /><i /></span>;

function cellLabel(a: string, b: string, cell: Cell | undefined) {
  if (!cell) return `Row ${a}, column ${b}: blank`;
  if (cell.conflict) return `Row ${a}, column ${b}: conflict, ${cell.relations.length} relations ${cell.relations.join(' and ')}`;
  return `${a} ${cell.relations[0]} ${b}: ${a} ${REL_INFO[cell.relations[0]].name} ${b}`;
}

const Glyphs = memo(function Glyphs({ cell }: { cell: Cell }) {
  return <>{cell.relations.map((r, i) => <Fragment key={r}>{i > 0 && <span className="pcell__slash" aria-hidden="true">/</span>}<Rel r={r} label={false} /></Fragment>)}</>;
}, (p, n) => p.cell.relations.join() === n.cell.relations.join());

/** One cell. Memoised on primitive props, so a step re-renders only the cells it touches. */
const PCell = memo(function PCell({ a, b, cell, isChanged, changeKind, isRead, sel, onSelect, idPrefix }: {
  a: string; b: string; cell: Cell | undefined; isChanged: boolean; changeKind: ChangeKind | null; isRead: boolean; sel: boolean;
  onSelect?: (c: CellMark) => void; idPrefix: string;
}) {
  return (
    <td className={cx('pcell', cell?.conflict && 'is-conflict', isChanged && 'is-changed', isChanged && changeKind && `is-${changeKind}`,
      isRead && 'is-read', sel && 'is-selected', !cell && 'is-blank')}
      data-cell={`${a} ${b}`} data-table={idPrefix}>
      {onSelect ? (
        <button type="button" className="pcell__btn" onClick={() => onSelect({ left: a, right: b })}
          aria-label={`${cellLabel(a, b, cell)}. Show where it came from.`} aria-pressed={sel}>
          {cell ? <Glyphs cell={cell} /> : null}
        </button>
      ) : (
        <span className="pcell__btn" role="img" aria-label={cellLabel(a, b, cell)}>{cell ? <Glyphs cell={cell} /> : null}</span>
      )}
      {cell?.conflict && <><span className="pcell__fracture" aria-hidden="true" /><span className="pcell__count" aria-hidden="true">×{cell.relations.length}</span></>}
      {(isChanged || isRead) && <Corners />}
    </td>
  );
}, (p, n) => p.a === n.a && p.b === n.b && p.isChanged === n.isChanged && p.changeKind === n.changeKind && p.isRead === n.isRead
  && p.sel === n.sel && p.onSelect === n.onSelect && p.idPrefix === n.idPrefix
  && (p.cell?.relations.join() ?? '') === (n.cell?.relations.join() ?? ''));

/** Operator-precedence relation table. Rows: topmost stack terminal. Columns: lookahead.
 *  `cells` is tableAt(steps, count); this component only draws it. */
export function PrecTable({ axes, cells, changed, changeKind, read, selected, onSelect, idPrefix, caption, compact }: {
  axes: string[]; cells: Map<string, Cell>; changed?: CellMark | null; changeKind?: ChangeKind | null; read?: CellMark | null;
  selected?: CellMark | null; onSelect?: (c: CellMark) => void; idPrefix: string; caption: string; compact?: boolean;
}) {
  const isSel = (a: string, b: string) => selected?.left === a && selected?.right === b;
  return (
    <div className={cx('ptable-wrap', compact && 'ptable-wrap--compact')} style={{ '--n': axes.length } as CSSProperties}>
      <table className="ptable">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="ptable__corner" scope="col"><span className="sr-only">Stack terminal down, lookahead across</span></th>
            {axes.map((b) => <th key={b} scope="col" className={cx((changed?.right === b || read?.right === b) && 'is-band')}>{b}</th>)}
          </tr>
        </thead>
        <tbody>
          {axes.map((a) => (
            <tr key={a}>
              <th scope="row" className={cx((changed?.left === a || read?.left === a) && 'is-band')}>{a}</th>
              {axes.map((b) => (
                <PCell key={b} a={a} b={b} cell={cells.get(cellKey(a, b))} idPrefix={idPrefix} onSelect={onSelect}
                  isChanged={changed?.left === a && changed?.right === b} changeKind={changed?.left === a && changed?.right === b ? changeKind ?? null : null}
                  isRead={read?.left === a && read?.right === b} sel={isSel(a, b)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RelationLegend() {
  return (
    <ul className="legend" aria-label="Relation legend">
      <li><Rel r="⋖" /><span>shift (yields)</span></li>
      <li><Rel r="≐" /><span>shift, same handle</span></li>
      <li><Rel r="⋗" /><span>reduce (takes)</span></li>
      <li><span className="legend__blank" aria-hidden="true" /><span>blank: error</span></li>
      <li><span className="legend__conflict" aria-hidden="true" /><span>two relations: conflict</span></li>
    </ul>
  );
}
