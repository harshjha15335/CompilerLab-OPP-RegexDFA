// Shared, purely presentational pieces: relation glyphs, tags, verdict stamps, productions, sets.
import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import type { Production as Prod, Relation } from '../core/index.ts';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** True while a CSS media query matches (re-renders when it changes). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (on) => { const mq = window.matchMedia?.(query); mq?.addEventListener?.('change', on); return () => mq?.removeEventListener?.('change', on); },
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}

export const REL_INFO: Record<Relation, { kind: 'yields' | 'takes' | 'equal'; name: string; action: string }> = {
  '⋖': { kind: 'yields', name: 'yields precedence to', action: 'shift' },
  '⋗': { kind: 'takes', name: 'takes precedence over', action: 'reduce' },
  '≐': { kind: 'equal', name: 'has equal precedence with', action: 'shift (same handle)' },
};
export const isRel = (s: string): s is Relation => s in REL_INFO;

/** A precedence relation, drawn as inline SVG: identical on every machine, no font to load or miss. */
export function Rel({ r, className, label = true }: { r: Relation; className?: string; label?: boolean }) {
  const info = REL_INFO[r];
  return (
    <span className={cx('rel', `rel--${info.kind}`, 'rel--svg', className)} data-rel={r}
      role={label ? 'img' : undefined} aria-label={label ? `${r}, ${info.name}` : undefined} aria-hidden={label ? undefined : true}>
      {(
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          {r === '⋖' && <><polyline points="15.5,3.5 4.5,10 15.5,16.5" /><circle cx="12.4" cy="10" r="1.7" /></>}
          {r === '⋗' && <><polyline points="4.5,3.5 15.5,10 4.5,16.5" /><circle cx="7.6" cy="10" r="1.7" /></>}
          {r === '≐' && <><line x1="3.5" y1="10" x2="16.5" y2="10" /><line x1="3.5" y1="15" x2="16.5" y2="15" /><circle cx="10" cy="4.8" r="1.7" /></>}
        </svg>
      )}
    </span>
  );
}

/** Text from the algorithm core, with relation characters drawn as <Rel>. */
export function Tx({ children }: { children: ReactNode }) {
  // the core writes DFA moves as "A --a--> B"; read them as words
  const parts = String(children ?? '').replace(/ --(\S+)--> /g, ' on $1 goes to ').split(/([⋖⋗≐])/);
  return <>{parts.map((p, i) => (isRel(p) ? <Rel key={i} r={p} /> : <Fragment key={i}>{p}</Fragment>))}</>;
}

export type TagKind = 'new' | 'dup' | 'conflict' | 'accept' | 'reject' | 'plain' | 'progress';
const TAG_GLYPH: Record<TagKind, ReactNode> = {
  new: <path d="M6 2v8M2 6h8" />,
  dup: <path d="M2 4h8M2 8h8" />,
  conflict: <path d="M3 2 9 10M9 2 3 10" />,
  accept: <path d="M2 6.5 5 9.5 10 3" />,
  reject: <path d="M3 3l6 6M9 3l-6 6" />,
  plain: null,
  progress: <path d="M2 6h2M5 6h2M8 6h2" />,
};
/** Label style 2: a bordered tag with a glyph, sentence case. */
export function Tag({ kind = 'plain', children }: { kind?: TagKind; children: ReactNode }) {
  return (
    <span className={cx('tag', `tag--${kind}`)}>
      {TAG_GLYPH[kind] && <svg viewBox="0 0 12 12" aria-hidden="true">{TAG_GLYPH[kind]}</svg>}
      {children}
    </span>
  );
}

/** ACCEPT / REJECT stamp: word + glyph + border style (double vs dashed), never colour alone. */
export function Verdict({ result, reason, compact }: { result: 'ACCEPT' | 'REJECT'; reason?: string; compact?: boolean }) {
  const ok = result === 'ACCEPT';
  return (
    <div className={cx('verdict', ok ? 'verdict--accept' : 'verdict--reject', compact && 'verdict--compact')} role="status">
      <svg className="verdict__glyph" viewBox="0 0 24 24" aria-hidden="true">
        {ok ? <polyline points="4,13 10,19 20,5" /> : <><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></>}
      </svg>
      <div className="verdict__text">
        <strong className="verdict__word">{result}</strong>
        {reason && <span className="verdict__reason"><Tx>{reason}</Tx></span>}
      </div>
    </div>
  );
}

export function Production({ p, marks, active }: { p: Prod; marks?: Set<number>; active?: boolean }) {
  return (
    <span className={cx('prod', active && 'is-active')}>
      <span className="prod__lhs">{p.lhs}</span>
      <span className="prod__arrow" aria-label="derives">→</span>
      {p.rhs.map((s, i) => <span key={i} className={cx('prod__sym', marks?.has(i) && 'is-marked')}>{s}</span>)}
    </span>
  );
}

export function ProductionList({ productions, activeId, marks, caption = 'Productions', dataCause }:
  { productions: Prod[]; activeId?: number | null; marks?: Set<number>; caption?: string; dataCause?: boolean }) {
  return (
    <section className="block">
      <h2 className="label">{caption}</h2>
      <ol className="prodlist">
        {productions.map((p) => (
          <li key={p.id} className={cx(p.id === activeId && 'is-active')} aria-current={p.id === activeId ? 'true' : undefined}
            data-cause={dataCause && p.id === activeId ? '' : undefined}>
            <span className="prodlist__no">{p.id}</span>
            <Production p={p} marks={p.id === activeId ? marks : undefined} active={p.id === activeId} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export const SetText = ({ items }: { items: (string | number)[] }) =>
  <span className="mset">{items.length ? `{ ${items.join(', ')} }` : '{ }'}</span>;

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty" role="status">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
      {action}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="note__row">
      <span className="label">{label}</span>
      <div>{children}</div>
    </div>
  );
}
