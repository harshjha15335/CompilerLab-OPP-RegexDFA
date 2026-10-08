import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { MotionConfig, motion } from 'motion/react';
import { hashFor, parseHash, type Route } from './data/nav.ts';
import { useOppModel, useRegexModel } from './models.ts';
import { SettingsContext, type Lens, type Settings, type Speed } from './replay/useReplay.ts';
import { cancelAllFx } from './motion/fx.ts';
import { Examples, Rail } from './shell/Shell.tsx';
import { Home } from './screens/home/Home.tsx';
import { GrammarStage } from './screens/opp/GrammarStage.tsx';
import { SetsStage } from './screens/opp/SetsStage.tsx';
import { TableStage } from './screens/opp/TableStage.tsx';
import { ConflictBlock, ParseStage } from './screens/opp/ParseStage.tsx';
import { ModesStage } from './screens/opp/ModesStage.tsx';
import { LrStage } from './screens/lr/LrStage.tsx';
import { DfaStage, FollowStage, PropsStage, RegexBlocked, SimStage, TreeStage } from './screens/regex/RegexStages.tsx';
import { Empty } from './ui/kit.tsx';
import { Plate } from './ui/plate.tsx';
import { KEYS, read, write } from './ui/store.ts';

const supportsVT = typeof document !== 'undefined' && 'startViewTransition' in document;

/** Hash routing. Route changes run inside a View Transition when the browser has one (and motion
 *  is allowed); otherwise a short Motion fade on the new page is the fallback. */
function useRoute(reduced: boolean) {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => {
      const next = window.location.hash;
      cancelAllFx();
      if (supportsVT && !reduced && !document.hidden) {
        // While the browser snapshots the old page the old page is still live; mark the route as in flight so
        // replay keys are not sent to the page being left, and if the snapshot is slow (software rendering on a
        // lab machine took 600+ ms) skip the cross-fade rather than leave the new page waiting.
        const root = document.documentElement;
        root.dataset.routing = '';
        let done = false;
        const vt = (document as Document & { startViewTransition: (cb: () => void) => { skipTransition(): void; updateCallbackDone: Promise<void> } })
          .startViewTransition(() => { done = true; flushSync(() => setHash(next)); });
        const slow = setTimeout(() => { if (!done) vt.skipTransition(); }, 120);
        vt.updateCallbackDone.finally(() => { clearTimeout(slow); delete root.dataset.routing; });
      } else setHash(next);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [reduced]);
  return useMemo<Route>(() => parseHash(hash), [hash]);
}

export default function App() {
  const [speed, setSpeed] = useState<Speed>(1);
  const [reduced, setReducedState] = useState(() => {
    const saved = read(KEYS.reduced);
    return saved !== null ? saved === '1' : window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });
  const [lens, setLensState] = useState<Lens>(() => (read(KEYS.lens) === 'flat' ? 'flat' : 'glass'));
  const setReduced = useCallback((r: boolean) => { write(KEYS.reduced, r ? '1' : '0'); setReducedState(r); }, []);
  const setLens = useCallback((l: Lens) => { write(KEYS.lens, l); setLensState(l); }, []);
  const settings = useMemo<Settings>(() => ({ speed, setSpeed, reduced, setReduced, lens, setLens }), [speed, reduced, setReduced, lens, setLens]);
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'; if (reduced) cancelAllFx(); }, [reduced]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on = (e: MediaQueryListEvent) => { if (read(KEYS.reduced) === null) setReducedState(e.matches); };
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);

  const route = useRoute(reduced);
  const opp = useOppModel();
  const regex = useRegexModel();
  const [examples, setExamples] = useState(false);
  const closeExamples = useCallback(() => setExamples(false), []);

  useEffect(() => {
    const title = route.page === 'home' ? 'ParseLens' : `${route.stage?.title ?? route.chapter.title} · ${route.chapter.title} · ParseLens`;
    document.title = title;
  }, [route]);

  const page = (() => {
    if (route.page === 'home')
      return <Home />;
    const { chapter, stage } = route;
    if (chapter.id === 'lr' || !stage) return <LrStage chapter={chapter} />;
    if (chapter.id === 'opp') {
      if (stage.id === 'grammar') return <GrammarStage chapter={chapter} stage={stage} model={opp} />;
      if (stage.id === 'modes') return <ModesStage chapter={chapter} stage={stage} model={opp} />;
      if (!opp.ok)
        return (
          <Plate chapter={chapter} stage={stage}>
            <Empty title="There is no valid operator grammar yet." action={<a className="btn" href={hashFor('opp', 'grammar')}>Open 1 Grammar</a>}>
              {opp.analysis.status === 'empty' ? 'Enter productions first.' : 'Stage 1 lists what is wrong with the current grammar.'}
            </Empty>
          </Plate>
        );
      if (stage.id === 'sets') return <SetsStage chapter={chapter} stage={stage} a={opp.ok} />;
      if (stage.id === 'table') return <TableStage chapter={chapter} stage={stage} a={opp.ok} />;
      if (!opp.ok.conflictFree) return <ConflictBlock chapter={chapter} stage={stage} a={opp.ok} />;
      return <ParseStage chapter={chapter} stage={stage} model={opp} a={opp.ok} />;
    }
    if (stage.id === 'tree') return <TreeStage chapter={chapter} stage={stage} model={regex} />;
    if (!regex.ok) return <RegexBlocked chapter={chapter} stage={stage} model={regex} />;
    if (stage.id === 'props') return <PropsStage chapter={chapter} stage={stage} r={regex.ok} />;
    if (stage.id === 'follow') return <FollowStage chapter={chapter} stage={stage} r={regex.ok} />;
    if (stage.id === 'dfa') return <DfaStage chapter={chapter} stage={stage} r={regex.ok} />;
    return <SimStage chapter={chapter} stage={stage} model={regex} r={regex.ok} />;
  })();
  const routeKey = route.page === 'home' ? 'home' : `${route.chapter.id}/${route.stage?.id ?? ''}`;

  return (
    <SettingsContext.Provider value={settings}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
        <div className="app" data-page={route.page === 'home' ? 'home' : route.chapter.id}>
          <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
          <Rail inert={examples} route={route} onExamples={() => setExamples(true)} />
          <motion.main id="main" className="main" tabIndex={-1} key={routeKey} inert={examples}
            initial={supportsVT || reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            {page}
          </motion.main>
          <Examples open={examples} onClose={closeExamples}
            onGrammar={(s) => { opp.loadSample(s); setExamples(false); window.location.hash = hashFor('opp', 'grammar'); }}
            onRegex={(s) => { regex.loadSample(s); setExamples(false); window.location.hash = hashFor('regex', 'tree'); }} />
        </div>
      </MotionConfig>
    </SettingsContext.Provider>
  );
}

