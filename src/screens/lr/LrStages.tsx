// LR parsing (SLR(1)): grammar → LR(0) item sets → FIRST/FOLLOW → ACTION/GOTO table → parse.
// Every stage replays steps the algorithm core already emitted (src/algorithms/lr.js).
import { Fragment, useMemo, useRef, useState } from 'react';
import { LR_SAMPLES } from '../../data/samples.ts';
import { hashFor, type Chapter, type Stage } from '../../data/nav.ts';
import { actionText, itemKey, type FfAddStep, type FfStep, type LrAction, type LrItem, type LrParseStep, type LrState, type Production as Prod, type SetMap, type SlrEntryStep } from '../../core/index.ts';
import type { LrModel } from '../../models.ts';
import type { OkLr } from '../../replay/pipelines.ts';
import { phaseMarkers, stepAt } from '../../replay/selectors.ts';
import { useReplay } from '../../replay/useReplay.ts';
import { all, beam, nudge, pop, settle } from '../../motion/fx.ts';
import { Dock } from '../../ui/hardware.tsx';
import { cx, DirtyHint, Empty, Production, ProductionList, Row, SetText, Tag, Verdict } from '../../ui/kit.tsx';
import { nextStageOf, Plate, StepNote, useStepFx } from '../../ui/plate.tsx';
import { Corners } from '../opp/PrecTable.tsx';

const KIND: Record<string, { tag: 'accept' | 'conflict'; word: string }> = {
  valid: { tag: 'accept', word: 'SLR(1)' }, conflict: { tag: 'conflict', word: 'Conflict' },
};
const NONE_PARSE: LrParseStep[] = [];

/** One LR(0) item: A → α • β, with the dot drawn as its own mark. */
export function Item({ p, dot, className }: { p: Prod; dot: number; className?: string }) {
  const syms = p.rhs.length ? p.rhs : [];
  return (
    <span className={cx('item', className)}>
      <span className="item__lhs">{p.lhs}</span>
      <span className="item__arrow" aria-hidden="true">→</span><span className="sr-only"> derives </span>
      {syms.map((s, i) => <Fragment key={i}>{i === dot && <span className="item__dot" aria-label="dot">•</span>}<span className="item__sym">{s}</span></Fragment>)}
      {dot === syms.length && <span className="item__dot" aria-label="dot">•</span>}
      {syms.length === 0 && <span className="item__eps">ε</span>}
    </span>
  );
}
const itemText = (p: Prod, dot: number) => `${p.lhs} → ${[...p.rhs.slice(0, dot), '•', ...p.rhs.slice(dot)].join(' ')}`;
const prodText = (p: Prod) => `${p.lhs} → ${p.rhs.length ? p.rhs.join(' ') : 'ε'}`;
const parseKey = (k: string) => { const [prod, dot] = k.split('.').map(Number); return { prod, dot }; };

/* ───────────── 1 Grammar ───────────── */
function GrammarResult({ model, checked }: { model: LrModel; checked: boolean }) {
  const { analysis, dirty } = model;
  if (!checked) return <div className="result" role="status"><p className="result__head">Not checked yet.</p></div>;
  if (dirty) return <div className="result" role="status"><p className="result__head">Edited. Press <b>Check grammar</b> (Ctrl + Enter) to check it again.</p></div>;
  if (analysis.status === 'empty')
    return <div className="result" role="status"><p className="result__head">The editor is empty.</p><p>Type a rule such as <code>E -&gt; E + T | T</code>, or load an example.</p></div>;
  if (analysis.status !== 'ok')
    return (
      <div className="result result--bad" role="alert">
        <p className="result__head"><Tag kind="reject">Invalid</Tag> {analysis.status === 'syntax' ? 'Some lines are not rules.' : analysis.status === 'too-large' ? 'The grammar is too large.' : 'The grammar uses a reserved symbol.'}</p>
        <ul className="errors">
          {analysis.errors.map((e, i) => (
            <li key={i}><span className="errors__where">{e.productionId ? `Production ${e.productionId}` : e.line ? `Line ${e.line}` : 'Grammar'}</span><span className="errors__msg">{e.message}</span></li>
          ))}
        </ul>
      </div>
    );
  const { augmented: g, conflictFree, lr0 } = analysis;
  return (
    <div className="result result--ok" role="status">
      <p className="result__head"><Tag kind="accept">Valid</Tag> A context-free grammar. LR parsing allows ε-rules and non-terminals side by side.</p>
      <dl className="facts">
        <div><dt>Start symbol</dt><dd className="mono">{g.original}, augmented with {g.start}</dd></div>
        <div><dt>Non-terminals</dt><dd className="mono">{g.nonterminals.slice(1).join('  ')}</dd></div>
        <div><dt>Terminals</dt><dd className="mono">{g.terminals.join('  ') || 'none'}</dd></div>
        <div><dt>Item sets</dt><dd className="mono">{lr0.states.length}</dd></div>
      </dl>
      {!conflictFree && (
        <p className="result__warn"><Tag kind="conflict">Conflict</Tag> Its SLR table will have a cell with two actions, so it is not SLR(1). Stage 4 shows the exact entry.</p>
      )}
      <a className="btn btn--primary" href={hashFor('lr', 'items')}>Build the LR(0) item sets</a>
    </div>
  );
}

export function LrGrammarStage({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: LrModel }) {
  const { draft, setDraft, commit, dirty, analysis, loadSample, committed } = model;
  // as in operator precedence: each visit starts unchecked, so the grammar can be checked again and again
  const [checked, setChecked] = useState(false);
  const gutter = useRef<HTMLDivElement>(null);
  const check = () => { setChecked(true); commit(); };
  const lines = draft.split('\n');
  return (
    <Plate chapter={chapter} stage={stage} className="plate--grammar">
      <div className="split split--grammar">
        <section className="pane">
          <label className="label" htmlFor="lr-grammar-text">Productions</label>
          <div className="editor">
            <div className="editor__gutter" ref={gutter} aria-hidden="true">{lines.map((_, i) => <span key={i}>{i + 1}</span>)}</div>
            <textarea id="lr-grammar-text" className="editor__text" value={draft} spellCheck={false} wrap="off" rows={6}
              autoCapitalize="off" autoCorrect="off" aria-describedby="lr-grammar-help"
              onChange={(e) => setDraft(e.target.value)}
              onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); } }} />
          </div>
          <p id="lr-grammar-help" className="help">One rule per line. Separate symbols with spaces. Write <code>ε</code> for an empty alternative. The first rule's left side is the start symbol.</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={check} aria-keyshortcuts="Control+Enter">Check grammar</button>
            <span className={cx('actions__state', dirty && 'is-dirty')} role="status">{!checked ? 'Not checked yet' : dirty ? 'Edited, not checked yet' : 'Checked'}</span>
          </div>
        </section>
        <section className="pane pane--scroll" aria-label="Check result">
          <h2 className="label">Result</h2>
          <GrammarResult model={model} checked={checked} />
          {checked && !dirty && analysis.status === 'ok' && (
            <ProductionList productions={analysis.augmented.productions} caption="Augmented grammar, production 0 added" />
          )}
          <h2 className="label label--gap">Examples</h2>
          <ul className="samples">
            {LR_SAMPLES.map((s) => (
              <li key={s.id}>
                <button type="button" className={cx('sample', s.text === committed && !dirty && 'is-current')} aria-pressed={s.text === committed && !dirty}
                  onClick={() => { setChecked(false); loadSample(s); }}>
                  <span className="sample__title">{s.title}</span>
                  <Tag kind={KIND[s.kind].tag}>{KIND[s.kind].word}</Tag>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Plate>
  );
}

/** Switch the LR grammar from stages 2–5. */
export function LrPicker({ model }: { model: LrModel }) {
  const { committed, loadSample, checked } = model;
  const current = LR_SAMPLES.find((s) => s.text === committed);
  return (
    <label className="picker">
      <span className="picker__label">Grammar</span>
      <select className="picker__select" value={checked ? current?.id ?? '__custom' : ''}
        onChange={(e) => { const s = LR_SAMPLES.find((x) => x.id === e.target.value); if (s) loadSample(s, { check: true }); }}>
        {!checked && <option value="" disabled>Choose a grammar…</option>}
        {checked && !current && <option value="__custom">Your grammar</option>}
        {LR_SAMPLES.map((s) => <option key={s.id} value={s.id}>{s.title} ({KIND[s.kind].word})</option>)}
      </select>
    </label>
  );
}

export function LrBlocked({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: LrModel }) {
  const title = !model.checked ? 'The grammar has not been checked yet.' : 'There is no valid grammar yet.';
  return (
    <Plate chapter={chapter} stage={stage}>
      <Empty title={title} action={<a className="btn btn--primary" href={hashFor('lr', 'grammar')}>Open 1 Grammar</a>}>
        {!model.checked ? <>Press <b>Check grammar</b> on stage 1, or pick a grammar from the menu above.</> : 'Stage 1 lists what is wrong with the current grammar.'}
      </Empty>
    </Plate>
  );
}

/* ───────────── 2 LR(0) item sets ───────────── */
function StateCard({ s, a, visibleItems, transitions, role, moved, symbol }: {
  s: LrState; a: OkLr; visibleItems: boolean; transitions: { symbol: string; to: number }[];
  role: 'source' | 'target-new' | 'target-old' | null; moved?: Set<string>; symbol?: string;
}) {
  const P = a.augmented.productions;
  return (
    <section className={cx('istate', role && `is-${role}`)} aria-label={`Item set I${s.id}`} data-state={s.id}>
      <header className="istate__head">
        <h3 className="istate__name">I<sub>{s.id}</sub></h3>
        {role === 'target-new' && <Tag kind="new">New</Tag>}
        {role === 'target-old' && <Tag kind="dup">Existing</Tag>}
      </header>
      {visibleItems && (
        <ul className="istate__items">
          {s.items.map((it) => {
            const p = P[it.prod];
            const done = it.dot === p.rhs.length;
            return (
              <li key={itemKey(it)} className={cx(!it.kernel && 'is-closure', moved?.has(itemKey(it)) && 'is-moved', done && 'is-complete')}>
                <Item p={p} dot={it.dot} />
              </li>
            );
          })}
        </ul>
      )}
      {transitions.length > 0 && (
        <ul className="istate__out" aria-label={`GOTO from I${s.id}`}>
          {transitions.map((t) => <li key={t.symbol} className={cx(t.symbol === symbol && role === 'source' && 'is-on')}><span className="mono">{t.symbol}</span> → I<sub>{t.to}</sub></li>)}
        </ul>
      )}
    </section>
  );
}

function ClosureList({ items, a }: { items: LrItem[]; a: OkLr }) {
  const P = a.augmented.productions;
  const added = items.filter((it) => !it.kernel);
  if (!added.length) return <p className="help">Closure adds nothing: no dot stands before a non-terminal.</p>;
  return (
    <ul className="inputs">
      {added.map((it) => {
        const src = parseKey(it.from!);
        const B = P[it.prod].lhs;
        return <li key={itemKey(it)}><span className="mono">{itemText(P[it.prod], 0)}</span>, because <span className="mono">{itemText(P[src.prod], src.dot)}</span> has the dot before {B}</li>;
      })}
    </ul>
  );
}

export function ItemsStage({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkLr }) {
  const { lr0 } = a;
  const steps = lr0.steps;
  const markers = useMemo(() => phaseMarkers(steps, (s) => (s.type === 'GOTO' ? s.from : s.type), (s) => (s.type === 'GOTO' ? `from I${s.from}` : s.type === 'START' ? 'I0' : 'done')), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const seen = useMemo(() => {
    const ids: number[] = [], tr: { from: number; symbol: string; to: number }[] = [];
    for (const s of steps.slice(0, count)) {
      if (s.type === 'START') ids.push(s.state);
      if (s.type === 'GOTO') { if (s.isNew) ids.push(s.to); tr.push(s); }
    }
    return { ids, tr };
  }, [steps, count]);
  const go = step?.type === 'GOTO' ? step : null;
  const moved = useMemo(() => new Set(go?.moved ?? []), [go]);
  const target = go ? lr0.states[go.to] : step?.type === 'START' ? lr0.states[0] : null;
  const P = a.augmented.productions;
  const fig = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ step: s, rich }) => {
    const root = fig.current;
    const card = root?.querySelector(`.istate.is-target-new, .istate.is-target-old`);
    card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (s.type === 'GOTO' && !s.isNew) return nudge(card);
    if (s.type !== 'GOTO' || !rich) return pop(card, { from: 0.94 });
    return all(beam(root?.querySelector('.istate.is-source .istate__out li.is-on'), card, { duration: 300 }), pop(card, { from: 0.94, delay: 240 }));
  });
  return (
    <Plate chapter={chapter} stage={stage}
      aside={<Tag kind="plain">{seen.ids.length} item {seen.ids.length === 1 ? 'set' : 'sets'}</Tag>}
      dock={<Dock replay={replay} label="LR(0) item sets" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure">
        <div className="figure figure--items" ref={fig} tabIndex={0} role="region" aria-label="Item sets built so far, scrollable">
          <div className="istates">
            {seen.ids.length === 0 && <p className="help istates__empty">No item set yet. I0 is the closure of {a.augmented.start} → • {a.augmented.original}.</p>}
            {seen.ids.map((id) => {
              const s = lr0.states[id];
              const role = go ? (go.from === id ? 'source' : go.to === id ? (go.isNew ? 'target-new' : 'target-old') : null)
                : step?.type === 'START' && id === 0 ? 'target-new' : null;
              return <StateCard key={id} s={s} a={a} visibleItems transitions={seen.tr.filter((t) => t.from === id)} role={role}
                moved={go?.from === id ? moved : undefined} symbol={go?.symbol} />;
            })}
          </div>
          <ul className="legend" aria-label="Item legend">
            <li><span className="item__dot" aria-hidden="true">•</span><span>the dot: how much of the rule has been seen</span></li>
            <li><span className="legend__closure" aria-hidden="true" /><span>added by closure</span></li>
            <li><span className="legend__moved" aria-hidden="true" /><span>item the dot moves over</span></li>
          </ul>
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle="No item set yet. Press → to build I0, the closure of the start item.">
            {step?.type === 'START' && target && (
              <>
                <p className="note__headline"><span>I<sub>0</sub> = closure({'{'} <span className="mono">{itemText(P[0], 0)}</span> {'}'})</span> <Tag kind="new">New</Tag></p>
                <p>The start item says: nothing is read yet, and the whole input should reduce to {a.augmented.original}.</p>
                <Row label="Closure adds"><ClosureList items={target.items} a={a} /></Row>
              </>
            )}
            {go && target && (
              <>
                <p className="note__headline"><span>GOTO(I<sub>{go.from}</sub>, <span className="mono">{go.symbol}</span>) = I<sub>{go.to}</sub></span>{' '}
                  <Tag kind={go.isNew ? 'new' : 'dup'}>{go.isNew ? 'New state' : 'Existing state'}</Tag></p>
                <Row label="Move the dot">
                  <ul className="inputs">{go.moved.map((k) => { const it = parseKey(k); return <li key={k}><span className="mono">{itemText(P[it.prod], it.dot)}</span> becomes <span className="mono">{itemText(P[it.prod], it.dot + 1)}</span></li>; })}</ul>
                </Row>
                {go.isNew
                  ? <Row label="Closure adds"><ClosureList items={target.items} a={a} /></Row>
                  : <Row label="Result">These kernel items already form I<sub>{go.to}</sub>, so no new state is made. Only the edge is added.</Row>}
                <Row label="Rule">GOTO(I, X) is the closure of every item of I with the dot moved over X.</Row>
              </>
            )}
            {step?.type === 'DONE' && (
              <>
                <p className="note__headline">Collection complete</p>
                <p>{step.message} Every GOTO has been tried from every set.</p>
              </>
            )}
          </StepNote>
        </aside>
      </div>
    </Plate>
  );
}

/* ───────────── 3 FIRST and FOLLOW ───────────── */
export const FF_RULES: Record<string, string> = {
  F1: 'A → a …  gives  a ∈ FIRST(A)',
  F2: 'A → B …  gives  FIRST(B) − ε ⊆ FIRST(A)',
  F3: 'A → ε  gives  ε ∈ FIRST(A)',
  W1: '$ ∈ FOLLOW(S)',
  W2: 'A → … B β  gives  FIRST(β) − ε ⊆ FOLLOW(B)',
  W3: 'A → … B  gives  FOLLOW(A) ⊆ FOLLOW(B)',
};
const isAdd = (s: FfStep | null): s is FfAddStep => Boolean(s && s.type === 'ADD');

function FfBlock({ kind, sets, nts, step, waiting }: { kind: 'FIRST' | 'FOLLOW'; sets: SetMap; nts: string[]; step: FfStep | null; waiting: boolean }) {
  const act = isAdd(step) && step.phase === kind ? step : null;
  const source = act && (act.rule === 'F2' || act.rule === 'W3') ? act.via : null;
  return (
    <section className={cx('setblock', waiting && 'is-waiting')} aria-label={`${kind} sets`}>
      <h2 className="section-title">{kind}{waiting && <span className="setblock__wait"> starts after FIRST</span>}</h2>
      {nts.map((n) => (
        <div key={n} className={cx('setline', act?.nonTerminal === n && 'is-target', source === n && 'is-source')}>
          <span className="setline__name">{kind}({n})</span>
          <span className="setline__eq">=</span>
          <span className="setline__set">
            <span aria-hidden="true">{'{ '}</span>
            {(sets[n] ?? []).map((m, i) => (
              <Fragment key={m}>{i > 0 && <span aria-hidden="true">, </span>}
                <span className={cx('member', act?.nonTerminal === n && act.element === m && 'is-new')}>{m}</span></Fragment>
            ))}
            <span aria-hidden="true">{' }'}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

export function LrSetsStage({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkLr }) {
  const steps = a.ffSteps;
  const markers = useMemo(() => phaseMarkers(steps, (s) => (s.type === 'PASS' ? `${s.phase}${s.pass}` : undefined),
    (s) => (s.type === 'PASS' && s.pass === 1 ? s.phase : s.type === 'PASS' ? `pass ${s.pass}` : '')), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const nts = a.grammar.nonterminals;
  const empty = useMemo(() => Object.fromEntries(nts.map((n) => [n, [] as string[]])), [nts]);
  const snapshot = stepAt(steps, count)?.snapshot ?? { first: empty, follow: empty };
  const add = isAdd(step) ? step : null;
  const prod = add?.productionId ? a.grammar.productions.find((p) => p.id === add.productionId) ?? null : null;
  const firstDone = steps.findIndex((s) => s.phase === 'FOLLOW');
  const body = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ step: s, rich }) => {
    if (!isAdd(s)) return undefined;
    const root = body.current;
    const el = root?.querySelector('.member.is-new');
    if (!rich) return settle(el);
    return all(beam(root?.querySelector('.prodlist li.is-active .prod'), el, { duration: 300 }), settle(el, { delay: 260 }));
  });
  return (
    <Plate chapter={chapter} stage={stage}
      aside={<Tag kind="plain">{step && 'phase' in step ? step.phase : 'FIRST'}{step?.type === 'PASS' ? `, pass ${step.pass}` : ''}</Tag>}
      dock={<Dock replay={replay} label="FIRST and FOLLOW" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure" ref={body}>
        <div className="figure figure--sets">
          <div className="figure__col">
            <ProductionList productions={a.grammar.productions} activeId={prod?.id} />
            <section className="block">
              <h2 className="label">Rules</h2>
              <ul className="rules">
                {Object.entries(FF_RULES).map(([id, text]) => <li key={id} className={cx(add?.rule === id && 'is-active')}><b>{id}</b><span>{text}</span></li>)}
              </ul>
            </section>
          </div>
          <div className="figure__col figure__col--sets">
            <FfBlock kind="FIRST" sets={snapshot.first} nts={nts} step={step} waiting={false} />
            <FfBlock kind="FOLLOW" sets={snapshot.follow} nts={nts} step={step} waiting={count <= firstDone} />
          </div>
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle="Every set starts empty. Press → to start the first pass over the productions.">
            {step?.type === 'PASS' && <><p className="note__headline">{step.phase}, pass {step.pass}</p><p>{step.message} A pass that adds nothing is the last one.</p></>}
            {step?.type === 'DONE' && <><p className="note__headline">{step.phase} is complete</p><p>{step.message}</p></>}
            {add && (
              <>
                <p className="note__headline"><b className="mono">{add.element}</b> joins {add.phase}({add.nonTerminal}) <Tag kind="new">New</Tag></p>
                <p>{add.message}</p>
                {prod && <Row label="Production"><span className="mono">{prod.id}.</span> <Production p={prod} active /></Row>}
                {add.via && <Row label="Copied from"><span className="mono">{add.rule === 'W3' ? 'FOLLOW' : 'FIRST'}({add.via}) = </span><SetText items={(add.rule === 'W3' ? snapshot.follow : snapshot.first)[add.via] ?? []} /></Row>}
                <Row label={`Rule ${add.rule}`}><span className="mono">{FF_RULES[add.rule]}</span></Row>
              </>
            )}
          </StepNote>
          <p className="help">F2 and F3 also apply past symbols that can vanish (derive ε); W3 also applies when everything after B can vanish.
            SLR uses FOLLOW to decide where to reduce: by A → α only when the next input symbol can follow A.</p>
        </aside>
      </div>
    </Plate>
  );
}

/* ───────────── 4 SLR parsing table ───────────── */
type CellMark = { state: number; symbol: string };
function LrTable({ a, cells, changed, conflict, read, compact, caption }: {
  a: OkLr; cells: Map<string, LrAction[]>; changed?: CellMark | null; conflict?: boolean; read?: CellMark | null; compact?: boolean; caption: string;
}) {
  const terms = [...a.augmented.terminals, '$'];
  const nts = a.augmented.nonterminals.slice(1);
  const cell = (state: number, symbol: string) => {
    const acts = cells.get(`${state}\u0000${symbol}`) ?? [];
    const on = changed?.state === state && changed.symbol === symbol;
    const rd = read?.state === state && read.symbol === symbol;
    const label = acts.length ? acts.map(actionText).join(' / ') : 'blank';
    return (
      <td key={symbol} className={cx('lcell', acts.length > 1 && 'is-conflict', on && 'is-changed', on && conflict && 'is-conflict-new', rd && 'is-read', !acts.length && 'is-blank',
        acts.length === 1 && `is-${acts[0].kind}`)} aria-label={`State ${state}, ${symbol}: ${label}`}>
        {acts.map((x, i) => <Fragment key={i}>{i > 0 && <span className="lcell__slash" aria-hidden="true">/</span>}<span>{actionText(x)}</span></Fragment>)}
        {(on || rd) && <Corners />}
      </td>
    );
  };
  return (
    <div className={cx('ltable-wrap', !compact && 'scroll', compact && 'ltable-wrap--compact')} tabIndex={0} role="region" aria-label={`${caption}, scrollable`}>
      <table className="ltable">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr><th rowSpan={2} scope="col" className="ltable__corner">State</th><th colSpan={terms.length} scope="colgroup">ACTION</th><th colSpan={nts.length} scope="colgroup" className="ltable__goto">GOTO</th></tr>
          <tr>{terms.map((t) => <th key={t} scope="col" className={cx((changed?.symbol === t || read?.symbol === t) && 'is-band')}>{t}</th>)}
            {nts.map((n, i) => <th key={n} scope="col" className={cx(i === 0 && 'ltable__goto', (changed?.symbol === n || read?.symbol === n) && 'is-band')}>{n}</th>)}</tr>
        </thead>
        <tbody>
          {a.lr0.states.map((s) => (
            <tr key={s.id}>
              <th scope="row" className={cx((changed?.state === s.id || read?.state === s.id) && 'is-band')}>{s.id}</th>
              {terms.map((t) => cell(s.id, t))}
              {nts.map((n) => cell(s.id, n))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableLegend() {
  return (
    <ul className="legend" aria-label="Table legend">
      <li><span className="mono">s5</span><span>shift, go to state 5</span></li>
      <li><span className="mono">r2</span><span>reduce by production 2</span></li>
      <li><span className="mono">acc</span><span>accept</span></li>
      <li><span className="mono">3</span><span>GOTO state 3</span></li>
      <li><span className="legend__blank" aria-hidden="true" /><span>blank: error</span></li>
      <li><span className="legend__conflict" aria-hidden="true" /><span>two actions: conflict</span></li>
    </ul>
  );
}

const cellsAt = (steps: readonly SlrEntryStep[], count: number) => {
  const cells = new Map<string, LrAction[]>();
  for (const s of steps.slice(0, count)) {
    const k = `${s.state}\u0000${s.symbol}`;
    const list = cells.get(k) ?? [];
    if (s.changed) list.push(s.action);
    cells.set(k, list);
  }
  return cells;
};

export function LrTableStage({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkLr }) {
  const steps = a.table.steps;
  const markers = useMemo(() => phaseMarkers(steps, (s) => (s.type === 'ENTRY' ? s.state : 'verdict'), (s) => (s.type === 'ENTRY' ? `I${s.state}` : 'verdict')), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const entries = useMemo(() => steps.filter((s): s is SlrEntryStep => s.type === 'ENTRY'), [steps]);
  const cells = useMemo(() => cellsAt(entries, Math.min(count, entries.length)), [entries, count]);
  const conflicts = [...cells.values()].filter((l) => l.length > 1).length;
  const e = step?.type === 'ENTRY' ? step : null;
  const P = a.augmented.productions;
  const st = e ? a.lr0.states[e.state] : null;
  const body = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ step: s, rich }) => {
    if (s.type !== 'ENTRY') return undefined;
    const root = body.current;
    const cell = root?.querySelector('.lcell.is-changed');
    cell?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (!s.changed) return nudge(cell);
    if (!rich || s.conflict) return pop(cell);
    return all(beam(root?.querySelector('.istate .is-moved, .istate .is-cause'), cell, { duration: 300 }), pop(cell, { delay: 260 }));
  });
  return (
    <Plate chapter={chapter} stage={stage}
      aside={conflicts ? <Tag kind="conflict">{conflicts === 1 ? '1 conflicting cell' : `${conflicts} conflicting cells`}</Tag> : count === steps.length ? <Tag kind="accept">Conflict-free</Tag> : null}
      dock={<Dock replay={replay} label="SLR table" next={a.conflictFree ? nextStageOf(chapter, stage) : null} />}>
      <div className="split split--figure" ref={body}>
        <div className="figure figure--table">
          <LrTable a={a} cells={cells} changed={e ? { state: e.state, symbol: e.symbol } : null} conflict={Boolean(e?.conflict)}
            caption="SLR parsing table. Rows: states. ACTION columns: terminals and $. GOTO columns: non-terminals." />
          <TableLegend />
          {conflicts > 0 && (
            <p className="conflict-note" role="status"><Tag kind="conflict">Conflict</Tag>
              {conflicts === 1 ? 'One cell holds' : `${conflicts} cells hold`} two actions. The parser could not choose there, so this grammar is not SLR(1).</p>
          )}
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle="The table starts blank. Each step writes one entry, state by state. Productions are numbered as on stage 1.">
            {e && st && (
              <>
                <p className="note__headline"><span>{e.rule === 'GOTO' ? 'GOTO' : 'ACTION'}[{e.state}, <span className="mono">{e.symbol}</span>] = <b className="mono">{actionText(e.action)}</b></span>{' '}
                  <Tag kind={e.conflict ? 'conflict' : e.changed ? 'new' : 'dup'}>{e.conflict ? `${e.kind} conflict` : e.changed ? 'New' : 'Already there'}</Tag></p>
                <p>{e.message}</p>
                {e.conflict && <p className="note__warn">The cell now holds {cells.get(`${e.state}\u0000${e.symbol}`)?.map(actionText).join(' and ')}. A parser in state {e.state} reading {e.symbol} could not choose.</p>}
                <Row label="Because of">
                  <ul className="inputs">{e.items.map((k) => { const it = parseKey(k); return <li key={k} className="mono">{itemText(P[it.prod], it.dot)}</li>; })}</ul>
                </Row>
                {e.rule === 'REDUCE' && e.followOf && <Row label="Using"><span className="mono">FOLLOW({e.followOf}) = </span><SetText items={a.follow[e.followOf]} /></Row>}
                {e.rule === 'REDUCE' && e.action.kind === 'reduce' && <Row label="Production"><span className="mono">{e.action.prod}. {prodText(P[e.action.prod])}</span></Row>}
              </>
            )}
            {step?.type === 'VERDICT' && (
              <>
                <p className="note__headline">{step.ok ? 'An SLR(1) grammar' : 'Not SLR(1)'} <Tag kind={step.ok ? 'accept' : 'conflict'}>{step.ok ? 'Conflict-free' : 'Conflict'}</Tag></p>
                <p>{step.message}</p>
              </>
            )}
          </StepNote>
          {st && <StateCard s={st} a={a} visibleItems transitions={[]} role={null} moved={new Set(e?.items ?? [])} />}
          <ProductionList productions={P} caption="Numbered productions" activeId={e?.action.kind === 'reduce' ? e.action.prod : null} />
        </aside>
      </div>
    </Plate>
  );
}

export function LrConflictBlock({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkLr }) {
  const list = a.table.conflicts.map((c) => `(${c.state}, ${c.symbol})`).join(', ');
  return (
    <Plate chapter={chapter} stage={stage}>
      <Empty title="This grammar's SLR table has a conflict, so there is nothing to parse with."
        action={<a className="btn" href={hashFor('lr', 'table')}>Open 4 SLR parsing table</a>}>
        {a.table.conflicts.length === 1 ? 'Cell' : 'Cells'} {list} {a.table.conflicts.length === 1 ? 'holds' : 'hold'} two actions. An SLR parser needs at most one action per cell.
      </Empty>
    </Plate>
  );
}

/* ───────────── 5 Parse ───────────── */
interface PNode { id: number; label: string; terminal: boolean; children: number[]; step: number }
/** The parse tree the reductions build: a shift adds a leaf, a reduction adds a parent over the popped
 *  nodes. Laid out once from the whole run (leaves along the bottom, each parent one row above its
 *  tallest child), so stepping only reveals nodes and never moves them. */
function parseForest(steps: readonly LrParseStep[]) {
  const nodes: PNode[] = [];
  const stack: number[] = [];
  steps.forEach((s, i) => {
    if (s.type === 'SHIFT') { nodes.push({ id: nodes.length, label: s.lookahead, terminal: true, children: [], step: i + 1 }); stack.push(nodes.length - 1); }
    if (s.type === 'REDUCE' && s.production) {
      const k = s.production.rhs.length;
      let kids = stack.splice(stack.length - k, k);
      if (k === 0) { nodes.push({ id: nodes.length, label: 'ε', terminal: true, children: [], step: i + 1 }); kids = [nodes.length - 1]; }
      nodes.push({ id: nodes.length, label: s.production.lhs, terminal: false, children: kids, step: i + 1 });
      stack.push(nodes.length - 1);
    }
  });
  const height = new Map<number, number>();
  for (const n of nodes) height.set(n.id, n.children.length ? 1 + Math.max(...n.children.map((c) => height.get(c)!)) : 0);
  const x = new Map<number, number>();
  let leaf = 0;
  for (const n of nodes) x.set(n.id, n.children.length ? n.children.reduce((t, c) => t + x.get(c)!, 0) / n.children.length : leaf++);
  const top = Math.max(0, ...height.values());
  return { nodes, x, y: (id: number) => top - height.get(id)!, cols: Math.max(1, leaf), rows: top + 1 };
}

function ParseTree({ forest, count, active }: { forest: ReturnType<typeof parseForest>; count: number; active: number | null }) {
  const GX = 64, GY = 52, PAD = 28;
  const shown = forest.nodes.filter((n) => n.step <= count);
  if (!forest.nodes.length) return null;
  const W = (forest.cols - 1) * GX + PAD * 2, H = (forest.rows - 1) * GY + PAD * 2;
  const at = (id: number) => ({ cx: forest.x.get(id)! * GX + PAD, cy: forest.y(id) * GY + PAD });
  return (
    <svg className="ptree" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" role="img"
      aria-label={shown.length ? `Parse tree so far: ${shown.filter((n) => !n.terminal).length} reductions` : 'Parse tree: nothing yet'}>
      {shown.flatMap((n) => n.children.map((c) => { const a = at(n.id), b = at(c); return <line key={`${n.id}-${c}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} className={cx('ptree__edge', n.step === active && 'is-new')} />; }))}
      {shown.map((n) => {
        const { cx: X, cy: Y } = at(n.id);
        return (
          <g key={n.id} className={cx('ptree__node', n.terminal ? 'is-terminal' : 'is-nt', n.step === active && 'is-new')} transform={`translate(${X} ${Y})`}>
            {n.terminal ? <rect x={-18} y={-13} width={36} height={26} rx={3} /> : <circle r={16} />}
            <text dy="0.35em">{n.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StackView({ stack, popped, pushed }: { stack: { state: number; symbol: string | null }[]; popped?: number; pushed?: boolean }) {
  return (
    <ol className="lstack" aria-label="Stack, bottom first">
      {stack.map((e, i) => (
        <li key={i} className={cx('lstack__cell', pushed && i === stack.length - 1 && 'is-new')}>
          {e.symbol !== null && <span className="lstack__sym">{e.symbol}</span>}
          <span className="lstack__state">{e.state}</span>
        </li>
      ))}
      {popped ? <li className="lstack__popped" aria-label={`${popped} entries popped`}>−{popped}</li> : null}
    </ol>
  );
}

function LrTrace({ steps, tokens, count, onJump }: { steps: readonly LrParseStep[]; tokens: string[]; count: number; onJump: (n: number) => void }) {
  const stackText = (s: LrParseStep) => (s.stackBefore ?? s.stack).map((e) => (e.symbol === null ? `${e.state}` : `${e.symbol} ${e.state}`)).join(' ');
  return (
    <div className="scroll" tabIndex={0} role="region" aria-label="Parse trace, scrollable">
      <table className="trace">
        <caption className="sr-only">Parse trace</caption>
        <colgroup><col className="trace__c-step" /><col /><col className="trace__c-input" /><col className="trace__c-act" /></colgroup>
        <thead><tr><th scope="col">Step</th><th scope="col">Stack</th><th scope="col">Input</th><th scope="col">Action</th></tr></thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i} className={cx(i + 1 === count && 'is-current', i + 1 > count && 'is-future')} aria-current={i + 1 === count ? 'step' : undefined}
              ref={i + 1 === count ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
              <td><button type="button" className="trace__jump" onClick={() => onJump(i + 1)} aria-label={`Go to step ${i + 1}`}>{i + 1}</button></td>
              <td className="mono trace__stack">{stackText(s)}</td>
              <td className="mono trace__input">{[...tokens.slice(s.stackBefore ? (s.type === 'SHIFT' ? s.pointer - 1 : s.pointer) : s.pointer), '$'].join(' ')}</td>
              <td className="trace__act"><b>{s.type === 'SHIFT' ? 'Shift' : s.type === 'REDUCE' ? 'Reduce' : s.type === 'ACCEPT' ? 'Accept' : 'Error'}</b>
                {s.type === 'SHIFT' && <span className="mono"> s{s.action?.kind === 'shift' ? s.action.to : ''}</span>}
                {s.type === 'REDUCE' && s.production && <span className="mono"> {prodText(s.production)}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LrParseStage({ chapter, stage, model, a }: { chapter: Chapter; stage: Stage; model: LrModel; a: OkLr }) {
  const { run, parseDraft, setParseDraft, parseInput, parse, strings, parseDirty } = model;
  const steps = run?.steps ?? NONE_PARSE;
  const markers = useMemo(() => { let k = 0; return steps.flatMap((s, i) => (s.type === 'REDUCE' ? [{ at: i + 1, label: `reduce ${++k}` }] : [])); }, [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [tab, setTab] = useState<'trace' | 'table'>('trace');
  const finished = count === steps.length && steps.length > 0;
  const tokens = run?.tokens ?? [];
  const pointer = step ? step.pointer : 0;
  const stack = step ? step.stack : [{ state: 0, symbol: null }];
  const read = step ? { state: step.state, symbol: step.lookahead } : null;
  const finalCells = a.table.cells;
  const forest = useMemo(() => parseForest(steps), [steps]);
  const fig = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ step: s }) => {
    const root = fig.current;
    if (s.type === 'SHIFT' || s.type === 'REDUCE') return pop(root?.querySelector('.lstack__cell.is-new'), { from: 0.9 });
    return undefined;
  });
  const controls = (
    <form className="controls" onSubmit={(e) => { e.preventDefault(); parse(parseDraft); }}>
      <label className="field">
        <span className="label">Input string</span>
        <input type="text" className="field__input" value={parseDraft} spellCheck={false} autoComplete="off" autoCapitalize="off"
          onChange={(e) => setParseDraft(e.target.value)} placeholder="id + id * id" />
      </label>
      <button type="submit" className="btn btn--primary">Parse</button>
      {strings.length > 0 && (
        <div className="chips" role="group" aria-label="Example strings">
          {strings.map((x) => <button key={x} type="button" className={cx('chip', x === parseInput && 'is-on')} aria-pressed={x === parseInput} onClick={() => parse(x)}>{x === '' ? 'ε (empty)' : x}</button>)}
        </div>
      )}
      {parseDirty && <DirtyHint shown={parseInput} action="Parse" what="string" />}
    </form>
  );
  if (!run || run.tokenError)
    return (
      <Plate chapter={chapter} stage={stage} controls={controls}>
        <div className="figure figure--center">
          <Verdict result="REJECT" reason={`${run?.tokenError ?? 'Nothing to parse.'} This grammar's terminals are: ${a.grammar.terminals.join('  ')}`} />
        </div>
      </Plate>
    );
  const P = a.augmented.productions;
  return (
    <Plate chapter={chapter} stage={stage} controls={controls}
      aside={finished ? <Tag kind={run.result === 'ACCEPT' ? 'accept' : 'reject'}>{run.result === 'ACCEPT' ? 'Accepted' : 'Rejected'}</Tag> : null}
      dock={<Dock replay={replay} label="LR parse" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure">
        <div className="figure figure--lrparse" ref={fig}>
          <section className="block"><h2 className="label">Stack (bottom on the left: symbol over state)</h2>
            <StackView stack={stack} popped={step?.type === 'REDUCE' ? step.popped?.length : undefined} pushed={step?.type === 'SHIFT' || step?.type === 'REDUCE'} /></section>
          <section className="block"><h2 className="label">Input</h2>
            <ol className="ltape" aria-label="Input tokens">
              {[...tokens, '$'].map((t, i) => <li key={i} className={cx('ltape__cell', i < pointer && 'is-read', i === pointer && 'is-at')}
                aria-current={i === pointer ? 'true' : undefined}>{t}</li>)}
            </ol>
          </section>
          <section className="block block--ptree"><h2 className="label">Parse tree, built bottom-up</h2>
            <div className="figure__canvas figure__canvas--ptree">
              {count === 0 || !forest.nodes.some((n) => n.step <= count) ? <p className="help">Each shift adds a leaf; each reduction adds a parent over the symbols it pops.</p>
                : <ParseTree forest={forest} count={count} active={step?.type === 'SHIFT' || step?.type === 'REDUCE' ? count : null} />}
            </div>
          </section>
          <StepNote replay={replay} idle={`The stack holds state 0. Press → to look up ACTION[0, ${tokens[0] ?? '$'}].`}>
            {step && step.type !== 'ACCEPT' && step.type !== 'REJECT' && <p className="note__headline">{step.type === 'SHIFT' ? 'Shift' : 'Reduce'}{' '}
              <span className="mono">{step.action ? actionText(step.action) : ''}</span></p>}
            {step && (step.type === 'ACCEPT' || step.type === 'REJECT') && <Verdict result={step.type} reason={step.message} />}
            {step && step.type !== 'ACCEPT' && step.type !== 'REJECT' && <p>{step.message}</p>}
            {step?.type === 'REDUCE' && step.production && (
              <>
                <Row label="Production"><span className="mono">{step.production.id}. {prodText(step.production)}</span></Row>
                <Row label="Handle"><span className="mono">{step.production.rhs.length ? step.production.rhs.join(' ') : 'ε (nothing to pop)'}</span> on top of the stack becomes <span className="mono">{step.production.lhs}</span></Row>
              </>
            )}
            {step && <Row label="Lookup">row {step.state}, column <span className="mono">{step.lookahead}</span>{step.type === 'REDUCE' ? <>, then GOTO[{step.exposed}, {step.production?.lhs}]</> : null}</Row>}
          </StepNote>
        </div>
        <aside className="inspector inspector--tabs">
          <div className="tabs" role="tablist" aria-label="Parse views">
            {([['trace', 'Trace'], ['table', 'Table lookup']] as const).map(([id, text]) => (
              <button key={id} type="button" role="tab" id={`lrtab-${id}`} aria-selected={tab === id} aria-controls={`lrpanel-${id}`}
                className={cx('tabs__tab', tab === id && 'is-on')} onClick={() => setTab(id)}>{text}</button>
            ))}
          </div>
          <div role="tabpanel" id={`lrpanel-${tab}`} aria-labelledby={`lrtab-${tab}`} className="tabs__panel">
            {tab === 'trace'
              ? <LrTrace steps={steps} tokens={tokens} count={count} onJump={replay.api.goto} />
              : (
                <div className="lookup">
                  <LrTable a={a} cells={finalCells} read={read} compact caption="Finished SLR table. The cell this step reads is outlined." />
                  <p className="help">{read ? <>This step reads row <b className="mono">{read.state}</b>, column <b className="mono">{read.symbol}</b>.</> : 'Each step reads one cell: row = state on top of the stack, column = lookahead.'}</p>
                  <ProductionList productions={P} caption="Numbered productions" activeId={step?.type === 'REDUCE' ? step.production?.id : null} />
                </div>
              )}
          </div>
        </aside>
      </div>
    </Plate>
  );
}
