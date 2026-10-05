import { useCallback, useEffect, useMemo, useState } from 'react';
import { NAV, parseHash, hashFor } from './data/nav.js';
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

function PlateIndex({ chapter, stage }) {
  return (
    <nav className="index" aria-label="Plate index">
      {NAV.map((group) => (
        <section key={group.group} className="index__group">
          <h2 className="index__path"><span>Compiler Lab</span> / {group.group}</h2>
          <ol className="index__chapters">
            {group.chapters.map((c) => {
              const current = c.id === chapter.id;
              return (
                <li key={c.id} className={cx('chapter', current && 'is-current')}>
                  <a className="chapter__link" href={hashFor(c.id, c.stages[0]?.id)} aria-current={current && !c.stages.length ? 'page' : undefined}>
                    <span className="chapter__no">{c.no}</span>
                    <span className="chapter__title">{c.title}{c.subtitle && <small>{c.subtitle}</small>}</span>
                  </a>
                  <span className="chapter__bar" aria-hidden="true" />
                  {current && c.stages.length > 0 && (
                    <ol className="stages">
                      {c.stages.map((s) => (
                        <li key={s.id}>
                          <a className={cx('stage', s.id === stage?.id && 'is-current')} href={hashFor(c.id, s.id)}
                            aria-current={s.id === stage?.id ? 'step' : undefined}>
                            <span className="stage__no">{s.no}</span>
                            <span>{s.title}</span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </nav>
  );
}

export default function App() {
  const route = useHashRoute();
  const [speed, setSpeed] = useState(1);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const settings = useMemo(() => ({ speed, setSpeed, reduced, setReduced }), [speed, reduced]);
  // Models live here so inputs and results survive navigation between chapters.
  const opp = useOppModel();
  const regex = useRegexModel();
  const { chapter, stage, go } = route;

  return (
    <SettingsContext.Provider value={settings}>
      <div className="app" data-motion={reduced ? 'reduced' : 'full'}>
        <a className="skip" href="#work">Skip to workspace</a>
        <header className="masthead">
          <p className="masthead__mark">Compiler Lab</p>
          <p className="masthead__plate">
            <span>{chapter.group}</span>
            <b>{chapter.no} · {chapter.title}</b>
            {stage && <span>{stage.no} {stage.title}</span>}
          </p>
          <label className="masthead__toggle">
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
            <span>Reduced motion</span>
          </label>
        </header>
        <div className="sheet">
          <PlateIndex chapter={chapter} stage={stage} />
          <main className="work" id="work" tabIndex={-1}>
            {chapter.id === 'regex'
              ? <RegexToDfaPage model={regex} stage={stage} go={(id) => go('regex', id)} />
              : <BottomUpPage chapter={chapter} model={opp} stage={stage} go={(id) => go('opp', id)} />}
          </main>
        </div>
      </div>
    </SettingsContext.Provider>
  );
}
