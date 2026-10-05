import { Fragment } from 'react';
import { cellKey } from '../../replay/selectors.js';
import { cx, Rel, relName } from '../common/common.jsx';

/** Operator-precedence relation table. Rows = terminal on the stack, columns = lookahead.
 *  `cells` comes from tableAt(steps, count): this component only draws it. */
export function PrecedenceTable({ axes, cells, active, activeState, selected, onSelect, lookup, compact }) {
  return (
    <div className={cx('ptable-wrap', compact && 'ptable-wrap--compact')}>
      <table className="ptable">
        <caption className="sr-only">Precedence relations. Row: topmost terminal on the stack. Column: lookahead terminal.</caption>
        <thead>
          <tr>
            <th className="ptable__corner" scope="col"><span className="ptable__corner-row">stack</span><span className="ptable__corner-col">input</span></th>
            {axes.map((b) => (
              <th key={b} scope="col" className={cx(active?.right === b && 'is-active', lookup?.right === b && 'is-lookup')}>{b}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((a) => (
            <tr key={a}>
              <th scope="row" className={cx(active?.left === a && 'is-active', lookup?.left === a && 'is-lookup')}>{a}</th>
              {axes.map((b) => {
                const cell = cells.get(cellKey(a, b));
                const isActive = active?.left === a && active?.right === b;
                const isLookup = lookup?.left === a && lookup?.right === b;
                const inBand = !isActive && (active?.left === a || active?.right === b);
                const inLook = !isLookup && (lookup?.left === a || lookup?.right === b);
                const cls = cx('pcell', cell?.conflict && 'is-conflict', isActive && 'is-active', isActive && activeState && `is-${activeState}`,
                  inBand && 'in-band', isLookup && 'is-lookup', inLook && 'in-band',
                  selected && selected.left === a && selected.right === b && 'is-selected');
                if (!cell)
                  return <td key={b} className={cls}><span className="sr-only">no relation</span>{(isActive || isLookup) && <Corners />}</td>;
                const label = cell.conflict
                  ? `Conflict: ${a} and ${b} have ${cell.relations.length} relations, ${cell.relations.join(' and ')}`
                  : `${a} ${cell.relations[0]} ${b}: ${a} ${relName(cell.relations[0])} ${b}`;
                return (
                  <td key={b} className={cls}>
                    <button type="button" className="pcell__btn" onClick={() => onSelect?.({ left: a, right: b })} aria-label={`${label}. Show provenance.`}>
                      {cell.relations.map((r, i) => (
                        <Fragment key={r}>{i > 0 && <span className="pcell__slash" aria-hidden="true">/</span>}<Rel r={r} /></Fragment>
                      ))}
                    </button>
                    {cell.conflict && <><span className="pcell__fracture" aria-hidden="true" /><span className="pcell__count" aria-hidden="true">×{cell.relations.length}</span></>}
                    {(isActive || isLookup) && <Corners />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// corner brackets mark the active intersection without relying on colour
const Corners = () => <span className="corners" aria-hidden="true"><i /><i /><i /><i /></span>;

export function RelationLegend() {
  return (
    <ul className="legend" aria-label="Relation legend">
      <li><Rel r="⋖" /> <span>a ⋖ b — a yields precedence: shift</span></li>
      <li><Rel r="≐" /> <span>a ≐ b — same handle: shift</span></li>
      <li><Rel r="⋗" /> <span>a ⋗ b — a takes precedence: reduce</span></li>
      <li><span className="legend__blank" aria-hidden="true" /> <span>blank — no relation: error</span></li>
    </ul>
  );
}
