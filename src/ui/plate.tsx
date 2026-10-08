// The printed plate every workspace screen sits on: plate number + title + one line of purpose, a
// stage switcher (prev / drawer / next), the body, and an optional hardware dock.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { CHAPTERS, hashFor, type Chapter, type Stage } from '../data/nav.ts';
import { isTyping, type Replay } from '../replay/useReplay.ts';
import { cx, Tx } from './kit.tsx';

/** Run a motion effect once each time the replay lands on a new step by stepping forward.
 *  The returned cleanup cancels it; any other kind of move cancels every effect (useReplay). */
export function useStepFx<S>(replay: Replay<S>, play: (p: { step: S; rich: boolean }) => (() => void) | void, deps: DependencyList = []) {
  useLayoutEffect(() => {
    if (!replay.animate || !replay.step) return undefined;
    return play({ step: replay.step, rich: replay.rich }) ?? undefined;
  }, [replay.steps, replay.count, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function nextStageOf(chapter: Chapter, stage: Stage | null) {
  const i = chapter.stages.findIndex((s) => s.id === stage?.id);
  const n = chapter.stages[i + 1];
  if (n) return { href: hashFor(chapter.id, n.id), title: `${n.no} ${n.title}` };
  if (chapter.id === 'opp') { const r = CHAPTERS[2]; return { href: hashFor(r.id, r.stages[0].id), title: r.title }; }
  return null;
}

function StageSwitch({ chapter, stage }: { chapter: Chapter; stage: Stage }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const i = chapter.stages.findIndex((s) => s.id === stage.id);
  const prev = chapter.stages[i - 1], next = chapter.stages[i + 1];
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector<HTMLButtonElement>('.stages__toggle')?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);
  useEffect(() => { setOpen(false); }, [stage.id]);
  // PageDown / PageUp move to the next / previous stage (never while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented || isTyping(e.target)) return;
      const to = e.key === 'PageDown' ? next : e.key === 'PageUp' ? prev : null;
      if (!to) return;
      e.preventDefault();
      window.location.hash = hashFor(chapter.id, to.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chapter.id, prev, next]);
  return (
    <div className="stages" ref={wrap}>
      <a className={cx('stages__step', !prev && 'is-off')} href={prev ? hashFor(chapter.id, prev.id) : undefined}
        aria-disabled={!prev || undefined} aria-label={prev ? `Previous stage: ${prev.title}` : 'No previous stage'} aria-keyshortcuts={prev ? 'PageUp' : undefined}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" /></svg>
      </a>
      <button type="button" className="stages__toggle" aria-expanded={open} aria-controls="stage-drawer" onClick={() => setOpen((o) => !o)}>
        Stage {stage.no} of {chapter.stages.length}
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
      </button>
      <a className={cx('stages__step', !next && 'is-off')} href={next ? hashFor(chapter.id, next.id) : undefined}
        aria-disabled={!next || undefined} aria-label={next ? `Next stage: ${next.title}` : 'No next stage'} aria-keyshortcuts={next ? 'PageDown' : undefined}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6 4.5 9.5" /></svg>
      </a>
      {open && (
        <nav id="stage-drawer" className="drawer" aria-label={`${chapter.title} stages`}>
          <ol>
            {chapter.stages.map((s) => (
              <li key={s.id}>
                <a href={hashFor(chapter.id, s.id)} className={cx('drawer__item', s.id === stage.id && 'is-current')} aria-current={s.id === stage.id ? 'step' : undefined}>
                  <span className="drawer__no">{s.no}</span>
                  <span className="drawer__title">{s.title}</span>
                  <span className="drawer__does">{s.does}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}

/** Extra controls a chapter puts in every plate header (the OPP grammar picker on stages 2–4). */
export const PlateTools = createContext<ReactNode>(null);

export function Plate({ chapter, stage, title, aside, children, dock, controls, className }: {
  chapter: Chapter; stage: Stage | null; title?: string; aside?: ReactNode; children: ReactNode; dock?: ReactNode; controls?: ReactNode; className?: string;
}) {
  const tools = useContext(PlateTools);
  return (
    <article className={cx('plate', className)} aria-labelledby="plate-title">
      <header className="plate__head">
        <div className="plate__titles">
          <p className="plate__no">Plate {chapter.numeral}{stage ? `.${stage.no}` : ''} · {chapter.title}</p>
          <h1 className="plate__title" id="plate-title">{title ?? stage?.title ?? chapter.title}</h1>
        </div>
        {stage && <p className="plate__does">{stage.does}</p>}
        <div className="plate__aside">{tools}{aside}</div>
        {stage && <StageSwitch chapter={chapter} stage={stage} />}
      </header>
      {controls && <div className="plate__controls">{controls}</div>}
      <div className="plate__body">{children}</div>
      {dock}
    </article>
  );
}

/** Inspector panel: what this step changed and why, then the next step's own message. */
export function StepNote<S extends { message: string }>({ replay, idle, children }: { replay: Replay<S>; idle: ReactNode; children?: ReactNode }) {
  const { count, total, nextStep } = replay;
  return (
    <section className="note" aria-label="Step explanation">
      <header className="note__head">
        <h2 className="label">This step</h2>
        <span className="note__count">{count === 0 ? 'Not started' : `${count} of ${total}`}</span>
      </header>
      <div className="note__body" aria-live="polite">
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
