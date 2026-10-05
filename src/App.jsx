import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHAPTERS, parseHash, hashFor } from './data/nav.js';
import { SettingsContext } from './replay/useReplay.js';
import { cx } from './components/common/common.jsx';
import { BottomUpPage } from './pages/BottomUpPage.jsx';
import { RegexToDfaPage } from './pages/RegexToDfaPage.jsx';
import { useOppModel } from './pages/useOppModel.js';
import { useRegexModel } from './pages/useRegexModel.js';

// Hash navigation keeps the production bundle portable: it works from file:// and any nested folder.
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((chapterId, stageId) => { window.location.hash = hashFor(chapterId, stageId); }, []);
  return { ...parseHash(hash), go };
}

const stored = (key, fallback) => { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const store = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* private mode: keep the setting for this visit only */ } };

const SHORTCUTS = [
  ['←  →', 'Previous / next step'],
  ['Space', 'Play or pause'],
  ['Home  End', 'First / last step'],
  ['[  ]', 'Slower / faster'],
  ['Shift + ←  →', 'Previous / next phase'],
  ['Ctrl + Enter', 'Validate the grammar'],
];

function Shortcuts() {
  return (
    <details className="keys">
      <summary className="iconbtn" aria-label="Keyboard shortcuts">
        <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="5" width="16" height="10" rx="2" /><path d="M5.5 8.5h1M9.5 8.5h1M13.5 8.5h1M6 11.5h8" /></svg>
        <span>Shortcuts</span>
      </summary>
      <dl className="keys__list">
        {SHORTCUTS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}
      </dl>
    </details>
  );
}

function Stepper({ chapter, stage }) {
  if (!chapter.stages.length) return null;
  const at = chapter.stages.findIndex((s) => s.id === stage?.id);
  return (
    <nav className="stepper" aria-label={`${chapter.title} stages`}>
      <ol>
        {chapter.stages.map((s, i) => (
          <li key={s.id}>
            <a className={cx('stage', i === at && 'is-current', i < at && 'is-done')} href={hashFor(chapter.id, s.id)}
              aria-current={i === at ? 'step' : undefined}>
              <span className="stage__no" aria-hidden="true">{i + 1}</span>
              <span>{s.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function App() {
  const route = useHashRoute();
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [theme, setTheme] = useState(() => (stored('compiler-lab-theme', 'light') === 'dark' ? 'dark' : 'light'));
  const settings = useMemo(() => ({ speed, setSpeed, reduced, setReduced, theme }), [speed, reduced, theme]);
  // Models live here so inputs and results survive navigation between workspaces.
  const opp = useOppModel();
  const regex = useRegexModel();
  const { chapter, stage, go } = route;
  const flip = () => setTheme((t) => { const next = t === 'dark' ? 'light' : 'dark'; store('compiler-lab-theme', next); return next; });

  return (
    <SettingsContext.Provider value={settings}>
      <div className="app" data-motion={reduced ? 'reduced' : 'full'} data-theme={theme}>
        <a className="skip" href="#work">Skip to workspace</a>
        <header className="topbar">
          <a className="brand" href={hashFor('opp', 'grammar')}>
            <svg className="brand__mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" /><path d="M14.5 7 8.5 12l6 5" /><circle cx="15.5" cy="12" r="1.4" /></svg>
            <span>Compiler Lab</span>
          </a>
          <nav className="parts" aria-label="Workspaces">
            {CHAPTERS.map((c) => (
              <a key={c.id} className={cx('chapter', c.id === chapter.id && 'is-current')} href={hashFor(c.id, c.stages[0]?.id)}
                aria-current={c.id === chapter.id ? 'page' : undefined}>
                <span className="chapter__title">{c.title}</span>
              </a>
            ))}
          </nav>
          <div className="topbar__tools">
            <Shortcuts />
            <label className="switch">
              <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
              <i aria-hidden="true" />
              <span>Reduced motion</span>
            </label>
            <button type="button" className="iconbtn" onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><path className="fill" d="M10 3.5a6.5 6.5 0 0 1 0 13z" /></svg>
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>
        <Stepper chapter={chapter} stage={stage} />
        <main className="work" id="work" tabIndex={-1}>
          {chapter.id === 'regex'
            ? <RegexToDfaPage model={regex} stage={stage} go={(id) => go('regex', id)} />
            : <BottomUpPage chapter={chapter} model={opp} stage={stage} go={(id) => go('opp', id)} />}
        </main>
      </div>
    </SettingsContext.Provider>
  );
}
