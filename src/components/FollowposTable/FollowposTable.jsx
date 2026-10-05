import { Fragment } from 'react';
import { cx } from '../common/common.jsx';

/** position | symbol | followpos. `follow` is the snapshot visible at the current step. */
export function FollowposTable({ leaves, follow, active, selected, onSelect, highlight }) {
  return (
    <table className="ftable">
      <caption className="sr-only">followpos table</caption>
      <thead><tr><th scope="col">Position</th><th scope="col">Symbol</th><th scope="col">followpos</th></tr></thead>
      <tbody>
        {leaves.map((l) => {
          const set = follow[l.pos] ?? [];
          const isActive = active?.position === l.pos;
          const body = (
            <>
              <span aria-hidden="true">{'{ '}</span>
              {set.map((q, i) => {
                const fresh = isActive && active.added.includes(q);
                return (
                  <Fragment key={q}>
                    {i > 0 && <span aria-hidden="true">, </span>}
                    <span className={cx('fitem', fresh && (active.changed ? 'is-new' : 'is-dup'))}>{q}</span>
                  </Fragment>
                );
              })}
              <span aria-hidden="true">{' }'}</span>
            </>
          );
          return (
            <tr key={l.pos} className={cx(isActive && 'is-active', selected === l.pos && 'is-selected', highlight?.has(l.pos) && 'is-used')}>
              <th scope="row">{l.pos}</th>
              <td className="ftable__sym">{l.symbol}{l.isEnd && <span className="ftable__end"> end</span>}</td>
              <td className="ftable__set">
                {onSelect
                  ? <button type="button" className="ftable__btn" onClick={() => onSelect(l.pos)} aria-label={`followpos of ${l.pos} is {${set.join(', ')}}. Show provenance.`}>{body}</button>
                  : body}
                {isActive && <span className="ftable__tag">{active.changed ? 'new' : 'no change'}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
