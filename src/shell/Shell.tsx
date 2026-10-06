import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GRAMMAR_SAMPLES, REGEX_SAMPLES, type GrammarSample, type RegexSample } from '../data/samples.ts';
import { hashFor, type Route } from '../data/nav.ts';
import { cx, Tag } from '../ui/kit.tsx';

export function Rail({ route, onExamples, inert }: { route: Route; onExamples: () => void; inert?: boolean }) {
  const ch = route.page === 'chapter' ? route.chapter.id : null;
  return (
    <header className="rail" inert={inert}>
      <a className="rail__brand" href={hashFor()} aria-current={route.page === 'home' ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="3" /><path d="M15 7 9 12l6 5" /><circle cx="14.6" cy="12" r="1.3" /></svg>
        ParseLens
      </a>
      <nav className="rail__nav" aria-label="Chapters">
        <a href={hashFor('opp', 'grammar')} className={cx('rail__link', (ch === 'opp' || ch === 'lr') && 'is-current')} aria-current={ch === 'opp' || ch === 'lr' ? 'page' : undefined}>Bottom-Up</a>
        <a href={hashFor('regex', 'tree')} className={cx('rail__link', ch === 'regex' && 'is-current')} aria-current={ch === 'regex' ? 'page' : undefined}>Regex → DFA</a>
        <button type="button" className="rail__link" onClick={onExamples}>Examples</button>
      </nav>
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
