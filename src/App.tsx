import { useCallback, useEffect, useMemo, useState } from 'react';
import { hashFor, parseHash, type Route } from './data/nav.ts';
import { EXPR_SAMPLE, type GrammarSample } from './data/samples.ts';
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
import { useConfirm } from './ui/confirm.tsx';
import { watchScrollRegions } from './ui/scrollFocus.ts';
import { Empty, Tag } from './ui/kit.tsx';
import { Plate, PlateNotice, PlateTools } from './ui/plate.tsx';
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
  useEffect(() => watchScrollRegions(document.body), []);
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'; if (reduced) cancelAllFx(); }, [reduced]);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on = (e: MediaQueryListEvent) => { if (read(KEYS.reduced) === null) setReducedState(e.matches); };
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, []);

  const route = useRoute();
  const rawOpp = useOppModel();
  const regex = useRegexModel();
  const [confirm, confirmDialog] = useConfirm();
  // Choosing a sample over unchecked edits asks first (Cancel keeps the editor exactly as it is).
  // Checked custom grammars are kept as "Your grammar", so they need no question.
  const { unsavedEdits, loadSample: load, restoreCustom: restore, draft, custom } = rawOpp;
  const loadSample = useCallback(async (s: GrammarSample) => {
    if (unsavedEdits && !(await confirm({
      title: 'Replace your unchecked edits?',
      body: <><p>The editor on stage 1 has changes that have not been checked yet. Loading “{s.title}” replaces them.</p>
        <p>They stay available afterwards as “Your grammar” in the grammar menu.</p></>,
      confirm: 'Replace',
    }))) return false;
    load(s);
    return true;
  }, [unsavedEdits, load, confirm]);
  const restoreCustom = useCallback(async () => {
    if (unsavedEdits && draft !== custom && !(await confirm({
      title: 'Replace your unchecked edits?',
      body: <p>The editor on stage 1 has changes that have not been checked yet. Bringing back your earlier grammar replaces them.</p>,
      confirm: 'Replace',
    }))) return;
    restore();
  }, [unsavedEdits, draft, custom, restore, confirm]);
  const opp = useMemo(() => ({ ...rawOpp, loadSample, restoreCustom }), [rawOpp, loadSample, restoreCustom]);

  useEffect(() => {
    const title = route.page === 'home' ? 'ParseLens' : (route.stage ? `${route.stage.title} · ${route.chapter.title} · ParseLens` : `${route.chapter.title} · ParseLens`);
    document.title = title;
  }, [route]);

  const page = (() => {
    if (route.page === 'home')
      return <Home onUse={() => { void opp.loadSample(EXPR_SAMPLE).then((done) => { if (done) window.location.hash = hashFor('opp', 'grammar'); }); }} />;
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
  // Results downstream of an edited-but-unchecked input are kept (they are still correct for the last
  // checked input) but are labelled as such, with the one action that brings them up to date.
  const stageId = route.page === 'chapter' ? route.stage?.id ?? '' : '';
  const chapterId = route.page === 'chapter' ? route.chapter.id : '';
  const stale = chapterId === 'opp' && ['sets', 'table', 'parse'].includes(stageId) && opp.dirty
    ? { what: 'grammar', on: 'stage 1', action: 'Check grammar', run: opp.commit, href: hashFor('opp', 'grammar') }
    : chapterId === 'regex' && stageId !== 'tree' && regex.dirty
      ? { what: 'expression', on: 'stage 1', action: 'Build tree', run: regex.commit, href: hashFor('regex', 'tree') }
      : null;
  const notice = stale ? (
    <div className="stale" role="status">
      <p className="stale__text"><Tag kind="progress">Out of date</Tag> The {stale.what} on {stale.on} has edits that have not been checked.
        This plate still shows the last checked {stale.what}.</p>
      <div className="stale__actions">
        <button type="button" className="btn btn--primary" onClick={stale.run}>{stale.action} now</button>
        <a className="btn btn--quiet" href={stale.href}>Review the edits</a>
      </div>
    </div>
  ) : null;
  const routeKey = route.page === 'home' ? 'home' : `${route.chapter.id}/${route.stage?.id ?? ''}`;

  return (
    <SettingsContext.Provider value={settings}>
        <div className="app" data-page={route.page === 'home' ? 'home' : route.chapter.id}>
          <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
          <Rail route={route} />
          <main id="main" className="main" tabIndex={-1} key={routeKey}>
            <PlateTools.Provider value={picker}><PlateNotice.Provider value={notice}>{page}</PlateNotice.Provider></PlateTools.Provider>
          </main>
          {confirmDialog}
        </div>
    </SettingsContext.Provider>
  );
}

