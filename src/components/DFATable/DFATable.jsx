import { cx } from '../common/common.jsx';

/** Transition table: the canonical correctness view of the DFA.
 *  `states` and `transitions` are whatever is visible at the current step. */
export function DFATable({ alphabet, states, transitions, start, activeCell, activeState, freshState, showPositions = true }) {
  const target = (from, symbol) => transitions.find((t) => t.from === from && t.symbol === symbol)?.to;
  return (
    <div className="dtable-wrap">
      <table className="dtable">
        <caption className="sr-only">DFA transition table</caption>
        <thead>
          <tr>
            <th scope="col">State</th>
            {showPositions && <th scope="col">Positions</th>}
            {alphabet.map((a) => <th key={a} scope="col" className={cx('dtable__sym', activeCell?.symbol === a && 'is-active')}>{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {states.length === 0 && <tr><td className="dtable__empty" colSpan={alphabet.length + 2}>No state yet.</td></tr>}
          {states.map((s) => (
            <tr key={s.name} className={cx(activeState === s.name && 'is-active', freshState === s.name && 'is-fresh')}>
              <th scope="row">
                <span className="dtable__marks" aria-hidden="true">{s.name === start ? '→' : ''}</span>
                <span className={cx('dtable__state', s.accepting && 'is-accepting')}>{s.name}</span>
                <span className="sr-only">{s.name === start ? ' start state' : ''}{s.accepting ? ' accepting state' : ''}</span>
              </th>
              {showPositions && <td className="dtable__pos">{`{${s.positions.join(',')}}`}</td>}
              {alphabet.map((a) => {
                const to = target(s.name, a);
                const hit = activeCell && activeCell.from === s.name && activeCell.symbol === a;
                return (
                  <td key={a} className={cx('dtable__cell', hit && 'is-hit', to === undefined && 'is-blank')}>
                    {to ?? <span aria-label="no transition">—</span>}
                    {hit && <span className="corners" aria-hidden="true"><i /><i /><i /><i /></span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="help dtable__key"><span aria-hidden="true">→</span> start · <span className="dtable__state is-accepting">X</span> accepting · — no transition (reject)</p>
    </div>
  );
}
