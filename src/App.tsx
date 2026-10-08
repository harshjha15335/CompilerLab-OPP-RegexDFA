import { useCallback, useEffect, useMemo, useState } from 'react';
import { hashFor, parseHash, type Route } from './data/nav.ts';
import { useOppModel, useRegexModel } from './models.ts';
import { SettingsContext, type Settings } from './replay/useReplay.ts';
import { cancelAllFx } from './motion/fx.ts';
import { Rail } from './shell/Shell.tsx';
import { Home } from './screens/home/Home.tsx';
import { GrammarStage } from './screens/opp/GrammarStage.tsx';
import { SetsStage } from './screens/opp/SetsStage.tsx';
import { TableStage } from './screens/opp/TableStage.tsx';
import { ConflictBlock, ParseStage } from './screens/opp/ParseStage.tsx';
import { GrammarPicker } from './screens/opp/GrammarStage.tsx';
import { ModesStage } from './screens/opp/ModesStage.tsx';
import { LrStage } from './screens/lr/LrStage.tsx';
import { DfaStage, FollowStage, PropsStage, RegexBlocked, SimStage, TreeStage } from './screens/regex/RegexStages.tsx';
import { Empty } from './ui/kit.tsx';
import { Plate, PlateTools } from './ui/plate.tsx';
import { KEYS, read, write } from './ui/store.ts';

/** Hash routing: the hash is the route, so the build works from file:// and any folder. */
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => { cancelAllFx(); setHash(window.location.hash); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return useMemo<Route>(() => parseHash(hash), [hash]);
}

export default function App() {
  const [reduced, setReducedState] = useState(() => {
    const saved = read(KEYS.reduced);
    return saved !== null ? saved === '1' : window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  });
  const setReduced = useCallback((r: boolean) => { write(KEYS.reduced, r ? '1' : '0'); setReducedState(r); }, []);
  const settings = useMemo<Settings>(() => ({ reduced, setReduced }), [reduced, setReduced]);
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'; if (reduced) cancelAllFx(); }, [reduced]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on = (e: MediaQueryListEvent) => { if (read(KEYS.reduced) === null) setReducedState(e.matches); };
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);

  const route = useRoute();
  const opp = useOppModel();
  const regex = useRegexModel();

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
  const picker = route.page === 'chapter' && route.chapter.id === 'opp' && ['sets', 'table', 'parse'].includes(route.stage?.id ?? '')
    ? <GrammarPicker model={opp} /> : null;
  const routeKey = route.page === 'home' ? 'home' : `${route.chapter.id}/${route.stage?.id ?? ''}`;

  return (
    <SettingsContext.Provider value={settings}>
        <div className="app" data-page={route.page === 'home' ? 'home' : route.chapter.id}>
          <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
          <Rail route={route} />
          <main id="main" className="main" tabIndex={-1} key={routeKey}>
            <PlateTools.Provider value={picker}>{page}</PlateTools.Provider>
          </main>
        </div>
    </SettingsContext.Provider>
  );
}

