import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GRAMMAR_SAMPLES, REGEX_SAMPLES, type GrammarSample, type RegexSample } from '../data/samples.ts';
import { hashFor, type Route } from '../data/nav.ts';
import { useSettings } from '../replay/useReplay.ts';
import { cx, Tag } from '../ui/kit.tsx';

/** A small anchored popover: Esc or a click outside closes it and focus returns to its button. */
function Popover({ label, icon, children, align = 'end' }: { label: string; icon: ReactNode; children: ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);
  return (
    <div className="pop" ref={wrap}>
      <button ref={btn} type="button" className="railbtn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {icon}<span>{label}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id={id} className={cx('pop__panel', `pop__panel--${align}`)} role="dialog" aria-label={label} data-own-keys=""
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.14 }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['← →', 'Previous / next step'],
  ['Space', 'Play or pause'],
  ['Home  End', 'First step / all at once'],
  ['Shift + ← →', 'Previous / next phase'],
  ['[  ]', 'Slower / faster'],
  ['Ctrl + Enter', 'Check the grammar (in the editor)'],
  ['Esc', 'Close a sheet or skip the intro'],
];

export function Rail({ route, onExamples, onReplayIntro, inert }: { route: Route; onExamples: () => void; onReplayIntro: () => void; inert?: boolean }) {
  const { reduced, setReduced, lens, setLens } = useSettings();
  const ch = route.page === 'chapter' ? route.chapter.id : null;
  return (
    <header className="rail" inert={inert}>
      <a className="rail__brand" href={hashFor()} aria-current={route.page === 'home' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="3" /><path d="M15 7 9 12l6 5" /><circle cx="14.6" cy="12" r="1.3" /></svg>
        Compiler Lab
      </a>
      <nav className="rail__nav" aria-label="Chapters">
        <a href={hashFor('opp', 'grammar')} className={cx('rail__link', (ch === 'opp' || ch === 'lr') && 'is-current')} aria-current={ch === 'opp' || ch === 'lr' ? 'page' : undefined}>Bottom-Up</a>
        <a href={hashFor('regex', 'tree')} className={cx('rail__link', ch === 'regex' && 'is-current')} aria-current={ch === 'regex' ? 'page' : undefined}>Regex → DFA</a>
        <button type="button" className="rail__link" onClick={onExamples}>Examples</button>
      </nav>
      <div className="rail__tools">
        <Popover label="Keys" icon={<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="5" width="16" height="10" rx="2" /><path d="M5.5 8.5h1M9.5 8.5h1M13.5 8.5h1M6 11.5h8" /></svg>}>
          <dl className="keys">{SHORTCUTS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
        </Popover>
        <Popover label="Settings" icon={<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3" /><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.3 4.3l2.1 2.1M13.6 13.6l2.1 2.1M4.3 15.7l2.1-2.1M13.6 6.4l2.1-2.1" /></svg>}>
          <div className="settings">
            <label className="switch">
              <input type="checkbox" role="switch" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
              <span className="switch__track" aria-hidden="true" />
              <span>Reduced motion <span className="switch__hint">States change instantly; nothing travels.</span></span>
            </label>
            <fieldset className="radios">
              <legend className="label">Table loupe</legend>
              <label><input type="radio" name="lens" checked={lens === 'glass'} onChange={() => setLens('glass')} /> Glass (refracting rim)</label>
              <label><input type="radio" name="lens" checked={lens === 'flat'} onChange={() => setLens('flat')} /> Flat lens</label>
            </fieldset>
            <button type="button" className="btn btn--quiet" onClick={onReplayIntro}>Play the intro again</button>
          </div>
        </Popover>
      </div>
    </header>
  );
}

const KIND = { valid: { tag: 'accept', word: 'Valid' }, conflict: { tag: 'conflict', word: 'Conflict' }, invalid: { tag: 'reject', word: 'Invalid' } } as const;

/** Examples sheet: every built-in grammar and regex, each with one line on what it demonstrates. */
export function Examples({ open, onClose, onGrammar, onRegex }: { open: boolean; onClose: () => void; onGrammar: (s: GrammarSample) => void; onRegex: (s: RegexSample) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const back = document.activeElement as HTMLElement | null;
    const t = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && panel.current) {                     // keep focus inside the sheet
        const f = [...panel.current.querySelectorAll<HTMLElement>('button, a[href]')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)!.focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { cancelAnimationFrame(t); window.removeEventListener('keydown', onKey, true); back?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheetwrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <motion.div ref={panel} className="examples" role="dialog" aria-modal="true" aria-labelledby="examples-title" data-own-keys=""
            initial={{ x: 24 }} animate={{ x: 0 }} exit={{ x: 24 }} transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}>
            <header className="examples__head">
              <h2 className="section-title" id="examples-title">Examples</h2>
              <button type="button" className="btn btn--quiet" onClick={onClose}>Close</button>
            </header>
            <h3 className="label">Grammars, for operator precedence</h3>
            <ul className="examples__list">
              {GRAMMAR_SAMPLES.map((s) => (
                <li key={s.id}>
                  <button type="button" className="example" onClick={() => onGrammar(s)}>
                    <span className="example__title">{s.title} <Tag kind={KIND[s.kind].tag}>{KIND[s.kind].word}</Tag></span>
                    <span className="example__code mono">{s.text.split('\n').join('   ')}</span>
                    <span className="example__shows">{s.shows}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="label">Regular expressions, for the direct method</h3>
            <ul className="examples__list">
              {REGEX_SAMPLES.map((s) => (
                <li key={s.id}>
                  <button type="button" className="example" onClick={() => onRegex(s)}>
                    <span className="example__title mono">{s.source} {s.error && <Tag kind="reject">Malformed</Tag>}</span>
                    <span className="example__shows">{s.shows}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
