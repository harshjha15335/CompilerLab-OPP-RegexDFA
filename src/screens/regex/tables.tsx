import { Fragment } from 'react';
import type { LeafNode } from '../../core/index.ts';
import type { FollowStep } from '../../core/index.ts';
import { Corners } from '../opp/PrecTable.tsx';
import { cx } from '../../ui/kit.tsx';

/** position | symbol | followpos, as visible at the current step. */
export function FollowTable({ leaves, follow, active, selected, onSelect, used }: {
  leaves: LeafNode[]; follow: Record<string, number[]>; active?: FollowStep | null; selected?: number | null;
  onSelect?: (p: number) => void; used?: Set<number>;
}) {
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
              {set.map((q, i) => (
                <Fragment key={q}>
                  {i > 0 && <span aria-hidden="true">, </span>}
                  <span className={cx('fitem', isActive && active!.added.includes(q) && (active!.changed ? 'is-new' : 'is-dup'))}>{q}</span>
                </Fragment>
              ))}
              <span aria-hidden="true">{' }'}</span>
            </>
          );
          return (
            <tr key={l.pos} className={cx(isActive && 'is-active', selected === l.pos && 'is-selected', used?.has(l.pos) && 'is-used')}>
              <th scope="row">{l.pos}</th>
              <td className="ftable__sym">{l.symbol}{l.isEnd && <span className="ftable__end"> end</span>}</td>
              <td className="ftable__set">
                {onSelect
                  ? <button type="button" className="ftable__btn" onClick={() => onSelect(l.pos)} aria-label={`followpos(${l.pos}) = {${set.join(', ')}}. Show where it came from.`}>{body}</button>
                  : body}
                {isActive && <span className={cx('ftable__tag', !active!.changed && 'is-dup')}>{active!.changed ? 'new' : 'no change'}</span>}
                {isActive && <Corners />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Transition table: the canonical correctness view of the DFA. */
export function DfaTable({ alphabet, states, transitions, start, hit, rowState, freshState, positions = true }: {
  alphabet: string[]; states: { name: string; positions: number[]; accepting: boolean }[]; transitions: { from: string; symbol: string; to: string }[];
  start: string; hit?: { from: string; symbol: string } | null; rowState?: string | null; freshState?: string | null; positions?: boolean;
}) {
  const target = (from: string, symbol: string) => transitions.find((t) => t.from === from && t.symbol === symbol)?.to;
  return (
    <table className="dtable">
      <caption className="sr-only">DFA transition table</caption>
      <thead>
        <tr>
          <th scope="col">State</th>
          {positions && <th scope="col">Positions</th>}
          {alphabet.map((x) => <th key={x} scope="col" className={cx(hit?.symbol === x && 'is-band')}>{x}</th>)}
        </tr>
      </thead>
      <tbody>
        {states.length === 0 && <tr><td className="dtable__empty" colSpan={alphabet.length + 2}>No state yet.</td></tr>}
        {states.map((s) => (
          <tr key={s.name} className={cx(rowState === s.name && 'is-row', freshState === s.name && 'is-fresh')}>
            <th scope="row">
              <span className="dtable__start" aria-hidden="true">{s.name === start ? '→' : ''}</span>
              <span className={cx('dtable__state', s.accepting && 'is-accepting')}>{s.name}</span>
              <span className="sr-only">{s.name === start ? ', start state' : ''}{s.accepting ? ', accepting state' : ''}</span>
            </th>
            {positions && <td className="dtable__pos">{`{${s.positions.join(',')}}`}</td>}
            {alphabet.map((x) => {
              const to = target(s.name, x);
              const isHit = hit?.from === s.name && hit.symbol === x;
              return (
                <td key={x} className={cx('dtable__cell', isHit && 'is-hit', to === undefined && 'is-blank')}>
                  {to ?? <span aria-label="no transition">–</span>}
                  {isHit && <Corners />}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Input tape for DFA simulation. `index` = symbols consumed so far. */
export function SimTape({ input, index, failedAt, readAt }: { input: string; index: number; failedAt: number | null; readAt?: number }) {
  const chars = [...input];
  if (!chars.length)
    return <div className="tape" role="img" aria-label="Empty input string"><span className="tcell is-look">ε<span className="tcell__mark" aria-hidden="true">empty string</span></span></div>;
  return (
    <div className="tape" role="img" aria-label={`Input ${input}. ${index} of ${chars.length} symbols read.`}>
      {chars.map((ch, i) => (
        <span key={i} className={cx('tcell', i < index && 'is-used', i === index && failedAt !== i && 'is-look', i === readAt && 'is-read', failedAt === i && 'is-failed')}>
          {ch}
          {i === index && failedAt !== i && <span className="tcell__mark" aria-hidden="true">next</span>}
          {i === readAt && <span className="tcell__mark" aria-hidden="true">read</span>}
          {failedAt === i && <span className="tcell__mark" aria-hidden="true">no move</span>}
        </span>
      ))}
      <span className={cx('tcell tcell--end', index >= chars.length && failedAt == null && 'is-look')}>
        <span className="sr-only">end of input</span>
        {index >= chars.length && failedAt == null && <span className="tcell__mark" aria-hidden="true">end</span>}
      </span>
    </div>
  );
}
