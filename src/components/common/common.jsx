import { Fragment } from 'react';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

const REL_INFO = {
  '⋖': { kind: 'yields', name: 'yields precedence to' },
  '⋗': { kind: 'takes', name: 'takes precedence over' },
  '≐': { kind: 'equal', name: 'has equal precedence with' },
};

/** Precedence relation glyph. Drawn as inline SVG so it renders identically on every machine,
 *  whether or not a math font with ⋖ ⋗ ≐ is installed. The literal character stays in the label. */
export function Rel({ r, className }) {
  const info = REL_INFO[r];
  if (!info) return <span className={className}>{r}</span>;
  return (
    <span className={cx('rel', `rel--${info.kind}`, className)} role="img" aria-label={`${r} (${info.name})`}>
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        {r === '⋖' && <><polyline points="15.5,3.5 4.5,10 15.5,16.5" /><circle cx="12.6" cy="10" r="1.7" /></>}
        {r === '⋗' && <><polyline points="4.5,3.5 15.5,10 4.5,16.5" /><circle cx="7.4" cy="10" r="1.7" /></>}
        {r === '≐' && <><line x1="3.5" y1="9.5" x2="16.5" y2="9.5" /><line x1="3.5" y1="14.5" x2="16.5" y2="14.5" /><circle cx="10" cy="4.6" r="1.7" /></>}
      </svg>
    </span>
  );
}

export const relName = (r) => REL_INFO[r]?.name ?? '';

/** Text from the algorithm core, with relation characters and ASCII arrows (A --a--> B) drawn properly. */
export function Tx({ children }) {
  const parts = String(children ?? '').split(/([⋖⋗≐]|--\S+-->)/);
  return <>{parts.map((p, i) => {
    if (REL_INFO[p]) return <Rel key={i} r={p} />;
    const arrow = /^--(\S+)-->$/.exec(p);
    if (arrow) return <span key={i} className="arrowlab" role="img" aria-label={`on ${arrow[1]} goes to`}><i>{arrow[1]}</i></span>;
    return <Fragment key={i}>{p}</Fragment>;
  })}</>;
}

/** A set typeset as mathematics: { 1, 2, 3 } */
export function SetText({ items, className }) {
  return <span className={cx('mset', className)}>{items.length ? `{ ${items.join(', ')} }` : '{ }'}</span>;
}

export function Production({ p, marks, active }) {
  return (
    <span className={cx('prod', active && 'is-active')}>
      <span className="prod__lhs">{p.lhs}</span>
      <span className="prod__arrow" aria-label="derives">→</span>
      {p.rhs.map((s, i) => <span key={i} className={cx('prod__sym', marks?.has(i) && 'is-marked')}>{s}</span>)}
    </span>
  );
}

export function ProductionList({ grammar, activeId, marks, title = 'Grammar source' }) {
  return (
    <section className="pane-block">
      <h3 className="label">{title}</h3>
      <ol className="prodlist">
        {grammar.productions.map((p) => (
          <li key={p.id} className={cx(p.id === activeId && 'is-active')} aria-current={p.id === activeId ? 'true' : undefined}>
            <span className="prodlist__no">{p.id}</span>
            <Production p={p} marks={p.id === activeId ? marks : undefined} active={p.id === activeId} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Final ACCEPT / REJECT stamp. Distinguished by word, glyph and border style, not only colour. */
export function Verdict({ result, reason, compact }) {
  const ok = result === 'ACCEPT';
  return (
    <div className={cx('verdict', ok ? 'verdict--accept' : 'verdict--reject', compact && 'verdict--compact')} role="status">
      <svg className="verdict__glyph" viewBox="0 0 24 24" aria-hidden="true">
        {ok ? <polyline points="4,13 10,19 20,5" /> : <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>}
      </svg>
      <div>
        <strong className="verdict__word">{result}</strong>
        {reason && <p className="verdict__reason"><Tx>{reason}</Tx></p>}
      </div>
    </div>
  );
}

/** Explanation panel shared by every replay: what changed, why, which rule, what comes next. */
export function StepNote({ replay, children, idle }) {
  const { count, total, nextStep } = replay;
  return (
    <section className="note" aria-label="Step explanation">
      <header className="note__head">
        <h3 className="label">This step</h3>
        <span className="note__count">{count === 0 ? 'not started' : `${count} of ${total}`}</span>
      </header>
      <div className="note__body" aria-live="polite" key={count}>
        {count === 0 ? <p className="note__idle">{idle}</p> : children}
      </div>
      {nextStep && (
        <footer className="note__next">
          <span className="label">Next</span>
          <p><Tx>{nextStep.message}</Tx></p>
        </footer>
      )}
    </section>
  );
}

export function NoteRow({ label, children }) {
  return (
    <div className="note__row">
      <span className="label">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function Tag({ kind = 'plain', children }) {
  return <span className={cx('tag', `tag--${kind}`)}>{children}</span>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
      {action}
    </div>
  );
}

/** Stage header: number, title, and at most one line the user needs before starting. */
export function PlateHead({ no, title, children, aside }) {
  return (
    <header className="plate__head">
      <span className="plate__no">{no}</span>
      <div className="plate__titles">
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {aside && <div className="plate__aside">{aside}</div>}
    </header>
  );
}
