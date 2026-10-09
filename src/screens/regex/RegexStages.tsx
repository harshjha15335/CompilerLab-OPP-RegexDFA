import { useMemo, useRef, useState } from 'react';
import { REGEX_SAMPLES } from '../../data/samples.ts';
import { hashFor, type Chapter, type Stage } from '../../data/nav.ts';
import type { FollowStep, PropStep, RegexNode } from '../../core/index.ts';
import type { RegexModel } from '../../models.ts';
import type { OkRegex } from '../../replay/pipelines.ts';
import { dfaAt, followposAt, followposProvenance, nodePropsAt, phaseMarkers, simAt } from '../../replay/selectors.ts';
import { useReplay } from '../../replay/useReplay.ts';
import { errorPlace } from '../../replay/wording.ts';
import { all, beam, drawOver, nudge, pop, reveal } from '../../motion/fx.ts';
import { Dock } from '../../ui/hardware.tsx';
import { cx, DirtyHint, Empty, Row, SetText, Tag, Tx, Verdict } from '../../ui/kit.tsx';
import { nextStageOf, Plate, StepNote, useStepFx } from '../../ui/plate.tsx';
import { DfaGraph } from './DfaGraph.tsx';
import { NODE_NAME, SyntaxTree, TreeLegend } from './SyntaxTree.tsx';
import { DfaTable, FollowTable, SimTape } from './tables.tsx';

const SHORT: Record<string, string> = { or: 'union', cat: 'concat', star: 'star', plus: 'plus', opt: 'optional' };
const short = (n: RegexNode) => (n.type === 'leaf' ? `${n.symbol}${n.pos}` : SHORT[n.type]);
const describe = (n: RegexNode) => (n.type === 'leaf' ? `${n.symbol}${n.pos}` : `${SHORT[n.type]}(${n.children!.map(short).join(', ')})`);
const braces = (a: number[]) => `{${a.join(',')}}`;


export function RegexBlocked({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: RegexModel }) {
  const an = model.analysis;
  return (
    <Plate chapter={chapter} stage={stage}>
      <Empty title="There is no syntax tree yet." action={<a className="btn" href={hashFor('regex', 'tree')}>Open 1 Syntax tree</a>}>
        {an.status === 'ok' ? '' : an.status === 'empty' ? 'Enter a regular expression first.' : `The expression could not be read: ${an.error}`}
      </Empty>
    </Plate>
  );
}

/* ───────────── 1 Syntax tree ───────────── */
const ERR_WINDOW = 36;   // characters shown either side of the error in a long expression
function ErrorSource({ source, position }: { source: string; position: number }) {
  const all = [...source, ' '];
  // a long expression shows a window around the error, marked with … at the cut ends
  const from = all.length > ERR_WINDOW * 2 + 1 ? Math.max(0, position - ERR_WINDOW) : 0;
  const to = Math.min(all.length, from + ERR_WINDOW * 2 + 1);
  const chars = all.slice(from, to);
  const lead = from > 0 ? '…' : '';
  const at = position - from + lead.length;
  return (
    <pre className="errsrc" aria-hidden="true">
      {lead}{chars.map((c, i) => <span key={i} className={cx(i + from === position && 'is-bad')}>{c}</span>)}{to < all.length ? '…' : ''}
      {'\n'}{' '.repeat(Math.max(0, at))}<span className="errsrc__caret">^</span>
    </pre>
  );
}

export function TreeStage({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: RegexModel }) {
  const { draft, setDraft, commit, dirty, analysis, ok, loadSample, committed, built } = model;
  const shown = built && !dirty;   // results appear only once Build tree has read this exact text
  const controls = (
    <form className="controls" onSubmit={(e) => { e.preventDefault(); commit(); }}>
      <label className="field field--wide">
        <span className="label">Regular expression</span>
        <input type="text" className="field__input field__input--regex" value={draft} spellCheck={false} autoComplete="off" autoCapitalize="off"
          onChange={(e) => setDraft(e.target.value)} placeholder="(a|b)*abb" aria-describedby="regex-help" />
      </label>
      <button type="submit" className="btn btn--primary">Build tree</button>
      <p id="regex-help" className="help controls__help"><code>|</code> union, <code>*</code> <code>+</code> <code>?</code> repeat, <code>( )</code> group, <code>\</code> escape. The end marker <code>#</code> is added for you.</p>
    </form>
  );
  return (
    <Plate chapter={chapter} stage={stage} controls={controls}>
      <div className="split split--figure">
        <div className="figure figure--tree">
          {!built && <div className="result" role="status"><p className="result__head">Not built yet.</p></div>}
          {built && dirty && <p className="result">Edited. Press <b>Build tree</b> (Enter) to read it again.</p>}
          {shown && analysis.status === 'empty' && <Empty title="The expression is empty.">Try <code>(a|b)*abb</code>, or pick an example.</Empty>}
          {shown && analysis.status === 'error' && (
            <div className="result result--bad" role="alert">
              <p className="result__head"><Tag kind="reject">{analysis.position === null ? 'Too large' : 'Malformed'}</Tag> {analysis.error}</p>
              {analysis.position !== null && <ErrorSource source={analysis.source} position={analysis.position} />}
              {analysis.position !== null && <p className="help">{errorPlace(analysis.source, analysis.position)}</p>}
            </div>
          )}
          {shown && ok && (
            <>
              <p className="augmented"><span className="label">Augmented</span> <span className="mono">( {ok.source} ) <b>#</b></span></p>
              <div className="figure__canvas"><SyntaxTree root={ok.root} nodes={ok.nodes} /></div>
              <TreeLegend />
            </>
          )}
        </div>
        <aside className="inspector">
          {shown && ok && (
            <section className="block">
              <h2 className="section-title">Positions</h2>
              <table className="ftable ftable--pos">
                <thead><tr><th scope="col">Position</th>{ok.leaves.map((l) => <th key={l.pos} scope="col">{l.pos}</th>)}</tr></thead>
                <tbody><tr><th scope="row">Symbol</th>{ok.leaves.map((l) => <td key={l.pos}>{l.symbol}</td>)}</tr></tbody>
              </table>
              <p className="help">A DFA state will accept when it contains position {ok.endPos}, the end marker.</p>
              <a className="btn btn--primary" href={hashFor('regex', 'props')}>Compute node properties</a>
            </section>
          )}
          <section className="block">
            <h2 className="section-title">Examples</h2>
            <ul className="samples samples--regex">
              {REGEX_SAMPLES.map((s) => (
                <li key={s.id}>
                  <button type="button" className={cx('sample', s.source === committed && !dirty && 'is-current')} onClick={() => loadSample(s)} aria-pressed={s.source === committed && !dirty}>
                    <span className="sample__title mono">{s.source}</span>
                    {s.error && <Tag kind="reject">Malformed</Tag>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </Plate>
  );
}

/* ───────────── 2 nullable / firstpos / lastpos ───────────── */
export function PropsStage({ chapter, stage, r }: { chapter: Chapter; stage: Stage; r: OkRegex }) {
  const steps = r.propSteps as PropStep[];
  const replay = useReplay(steps);
  const { count, step } = replay;
  const props = useMemo(() => nodePropsAt(steps, count), [steps, count]);
  const byId = useMemo(() => new Map(r.nodes.map((n) => [n.id, n])), [r]);
  const node = step ? byId.get(step.nodeId) ?? null : null;
  const readIds = useMemo(() => new Set((node?.children ?? []).map((c) => c.id)), [node]);
  const built = useMemo(() => new Set(props.keys()), [props]);
  const fig = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ rich }) => {
    const root = fig.current;
    const active = root?.querySelector('.tnode.is-active');
    if (!rich) return pop(active, { from: 0.9 });
    return all(
      ...[...(root?.querySelectorAll<SVGLineElement>('.tree__edges line.is-drawing') ?? [])].map((l) => drawOver(l, { duration: 200 })),
      reveal(active?.querySelector('.tnode__first'), { delay: 160 }),
      reveal(active?.querySelector('.tnode__last'), { delay: 250 }),
      reveal(active?.querySelector('.tnode__nullable'), { delay: 340 }),
    );
  });
  return (
    <Plate chapter={chapter} stage={stage} dock={<Dock replay={replay} label="Node properties" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure">
        <div className="figure figure--tree" ref={fig}>
          <div className="figure__canvas"><SyntaxTree root={r.root} nodes={r.nodes} props={props} activeId={step?.nodeId} readIds={readIds} annotate="all" built={built} /></div>
          <TreeLegend sets />
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle="Nothing is computed yet. Leaves come first, left to right; a parent only after its children.">
            {node && step && (
              <>
                <p className="note__headline"><span className="mono">{describe(node)}</span> <Tag kind="new">{NODE_NAME[node.type]}</Tag></p>
                <dl className="propgrid">
                  <div><dt>nullable</dt><dd>{String(step.nullable)}</dd></div>
                  <div><dt>firstpos</dt><dd><SetText items={step.firstpos} /></dd></div>
                  <div><dt>lastpos</dt><dd><SetText items={step.lastpos} /></dd></div>
                </dl>
                <Row label="Rule">{step.rule}.</Row>
                {node.children && (
                  <Row label="Read from">
                    <ul className="inputs">
                      {node.children.map((c) => <li key={c.id}><span className="mono">{short(c)}</span>: nullable {String(c.nullable)}, firstpos <span className="mono">{braces(c.first)}</span>, lastpos <span className="mono">{braces(c.last)}</span></li>)}
                    </ul>
                  </Row>
                )}
              </>
            )}
          </StepNote>
        </aside>
      </div>
    </Plate>
  );
}

/* ───────────── 3 followpos ───────────── */
export function FollowStage({ chapter, stage, r }: { chapter: Chapter; stage: Stage; r: OkRegex }) {
  const steps = r.followSteps as FollowStep[];
  const byId = useMemo(() => new Map(r.nodes.map((n) => [n.id, n])), [r]);
  const markers = useMemo(() => phaseMarkers(steps, (s) => s.nodeId, (s) => SHORT[byId.get(s.nodeId)!.type]), [steps, byId]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [selected, setSelected] = useState<number | null>(null);
  const allProps = useMemo(() => nodePropsAt(r.propSteps as PropStep[], r.propSteps.length), [r]);
  const positions = useMemo(() => r.leaves.map((l) => l.pos), [r]);
  const follow = followposAt(steps, count, positions);
  const node = step ? byId.get(step.nodeId) ?? null : null;
  const isCat = node?.type === 'cat';
  const readIds = useMemo(() => new Set(isCat && node ? node.children!.map((c) => c.id) : []), [node, isCat]);
  const prov = selected != null ? followposProvenance(steps, count, selected) : [];
  const body = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ step: s, rich }) => {
    const root = body.current;
    const fresh = [...(root?.querySelectorAll('.fitem.is-new, .fitem.is-dup') ?? [])];
    const arcs = [...(root?.querySelectorAll<SVGPathElement>('.tree__arc') ?? [])];
    if (!s.changed) return all(...fresh.map((el) => nudge(el)));
    if (!rich) return all(...fresh.map((el) => pop(el)));
    return all(...arcs.map((a) => drawOver(a, { duration: 260 })),
      beam(root?.querySelector('.tnode.is-active .tnode__shape'), root?.querySelector('.ftable tr.is-active .ftable__set'), { duration: 320 }),
      ...fresh.map((el) => pop(el, { delay: 280 })));
  });
  return (
    <Plate chapter={chapter} stage={stage} dock={<Dock replay={replay} label="followpos" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure" ref={body}>
        <div className="figure figure--tree">
          <div className="figure__canvas">
            <SyntaxTree root={r.root} nodes={r.nodes} props={allProps} activeId={step?.nodeId} readIds={readIds} annotate="active"
              arcs={step ? { from: step.position, to: step.added, changed: step.changed } : null} />
          </div>
          <TreeLegend sets />
        </div>
        <aside className="inspector">
          <FollowTable leaves={r.leaves} follow={follow} active={step} selected={selected} onSelect={(p) => setSelected((s) => (s === p ? null : p))} />
          {selected != null && (
            <section className="sheet" aria-label={`Where followpos(${selected}) came from`}>
              <header className="sheet__head"><h2 className="section-title">followpos({selected})</h2>
                <button type="button" className="btn btn--quiet" onClick={() => setSelected(null)}>Close</button></header>
              {prov.length === 0 ? <p>Nothing has been added to it yet.</p> : (
                <ol className="provlist">
                  {prov.map((p) => (
                    <li key={p.step}><button type="button" className="linkbtn" onClick={() => replay.api.goto(p.step)}>Step {p.step}</button>
                      <span>gains <span className="mono">{braces(p.added)}</span> from <span className="mono">{describe(byId.get(p.nodeId)!)}</span>{p.changed ? '' : ' (no change)'}</span></li>
                  ))}
                </ol>
              )}
            </section>
          )}
          <StepNote replay={replay} idle="Every followpos set starts empty. Only concatenation, star and plus nodes add to it.">
            {node && step && (
              <>
                <p className="note__headline"><span className="mono">followpos({step.position})</span> gains <span className="mono">{braces(step.added)}</span>{' '}
                  <Tag kind={step.changed ? 'new' : 'dup'}>{step.changed ? 'New' : 'No change'}</Tag></p>
                <Row label="Node"><span className="mono">{describe(node)}</span></Row>
                <Row label="Because">{isCat
                  ? <>lastpos(left) = <span className="mono">{braces(node.children![0].last)}</span> and firstpos(right) = <span className="mono">{braces(node.children![1].first)}</span>; position {step.position} is in lastpos(left).</>
                  : <>this {SHORT[node.type]} node repeats its operand: lastpos = <span className="mono">{braces(node.last)}</span>, firstpos = <span className="mono">{braces(node.first)}</span>.</>}</Row>
                <Row label="Rule">{isCat ? 'For c₁·c₂, every position in firstpos(c₂) follows every position in lastpos(c₁).' : 'For c* and c+, every position in firstpos(c) follows every position in lastpos(c).'}</Row>
              </>
            )}
          </StepNote>
        </aside>
      </div>
    </Plate>
  );
}

/* ───────────── 4 DFA construction ───────────── */
export function DfaStage({ chapter, stage, r }: { chapter: Chapter; stage: Stage; r: OkRegex }) {
  const { dfa, dfaSteps: steps, followpos, leaves, endPos } = r;
  const markers = useMemo(() => phaseMarkers(steps,
    (s) => (s.type === 'DFA_START' ? 'start' : s.type === 'DFA_DONE' ? 'done' : s.from),
    (s) => (s.type === 'DFA_START' ? 'start' : s.type === 'DFA_DONE' ? 'done' : `from ${s.from}`)), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const seen = useMemo(() => dfaAt(steps, count), [steps, count]);
  const visibleStates = useMemo(() => seen.states.map((s) => s.name), [seen]);
  const move = step?.type === 'DFA_TRANSITION' ? step : null;
  const from = move ? dfa.states.find((s) => s.name === move.from) ?? null : null;
  const used = move && from ? from.positions.filter((p) => leaves.find((l) => l.pos === p)!.symbol === move.symbol) : [];
  const usedSet = useMemo(() => new Set(used), [used.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeEdge = useMemo(() => (move ? { from: move.from, to: move.to, symbol: move.symbol } : null), [move]);
  const fresh = move && move.isNew ? move.to : step?.type === 'DFA_START' ? step.state : null;
  return (
    <Plate chapter={chapter} stage={stage} dock={<Dock replay={replay} label="DFA construction" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure">
        <div className="figure figure--dfa">
          <div className="figure__canvas figure__canvas--graph">
            <DfaGraph dfa={dfa} visibleStates={visibleStates} visibleTransitions={seen.transitions} activeEdge={activeEdge}
              sourceState={move?.from ?? null} freshState={fresh} fx={replay.animate ? 'build' : null} tableFallback={false} />
          </div>
          <div className="figure__row">
            <section className="block"><h2 className="label">Transition table</h2>
              <DfaTable alphabet={dfa.alphabet} states={seen.states} transitions={seen.transitions} start={dfa.start}
                hit={move ? { from: move.from, symbol: move.symbol } : null} rowState={move?.from ?? null} freshState={fresh} />
            </section>
          </div>
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle="No state yet. The start state is firstpos of the root.">
            {step?.type === 'DFA_START' && (
              <>
                <p className="note__headline">Start state <span className="mono">{step.state} = {braces(step.positions)}</span> <Tag kind="new">New state</Tag></p>
                <p>{step.message}</p>
                <Row label="Accepting?">{step.accepting ? `Yes: it contains position ${endPos} (#).` : `No: position ${endPos} (#) is not in it.`}</Row>
              </>
            )}
            {move && from && (
              <>
                <p className="note__headline"><span className="mono">{move.from}</span> <span className="arrowlab">on {move.symbol}</span> <span className="mono">{move.to}</span>{' '}
                  <Tag kind={move.isNew ? 'new' : 'dup'}>{move.isNew ? 'New state' : 'Existing state'}</Tag></p>
                <Row label="Positions">In <span className="mono">{move.from} = {braces(from.positions)}</span>, the ones labelled <b className="mono">{move.symbol}</b> are <span className="mono">{braces(used)}</span>.</Row>
                <Row label="Union"><span className="mono">{used.map((p) => `followpos(${p})`).join(' ∪ ')} = {braces(move.positions)}</span></Row>
                <Row label="Result">{move.isNew ? <>No state has this set yet, so it becomes <b className="mono">{move.to}</b>.</> : <>That set is already state <b className="mono">{move.to}</b>.</>}
                  {move.accepting && <> It contains position {endPos} (#), so <b className="mono">{move.to}</b> accepts.</>}</Row>
              </>
            )}
            {step?.type === 'DFA_DONE' && (
              <>
                <p className="note__headline">Construction complete</p>
                <p>{step.message}</p>
                <Row label="Accepting">{dfa.accepting.join(', ') || 'none'}: the states containing position {endPos}.</Row>
              </>
            )}
          </StepNote>
          <section className="block">
            <h2 className="label">followpos, from stage 3</h2>
            <FollowTable leaves={leaves} follow={followpos} used={usedSet} />
          </section>
        </aside>
      </div>
    </Plate>
  );
}

/* ───────────── 5 Simulation ───────────── */
export function SimStage({ chapter, stage, model, r }: { chapter: Chapter; stage: Stage; model: RegexModel; r: OkRegex }) {
  const { sim, simDraft, setSimDraft, simInput, simulate, strings, simDirty } = model;
  const { dfa } = r;
  const steps = sim!.steps;
  const replay = useReplay(steps);
  const { count, step } = replay;
  const s = simAt(steps, count);
  const stuck = s.failedAt != null;
  const hit = s.edge ? { from: s.edge.from, symbol: s.edge.symbol } : stuck && step && 'symbol' in step && step.symbol ? { from: s.state!, symbol: step.symbol } : null;
  const state = s.state ? dfa.states.find((q) => q.name === s.state) : null;
  const controls = (
    <form className="controls" onSubmit={(e) => { e.preventDefault(); simulate(simDraft); }}>
      <label className="field">
        <span className="label">Test string</span>
        <input type="text" className="field__input" value={simDraft} spellCheck={false} autoComplete="off" autoCapitalize="off"
          onChange={(e) => setSimDraft(e.target.value)} placeholder="empty string" />
      </label>
      <button type="submit" className="btn btn--primary">Run</button>
      <span className="controls__note mono">{r.source}</span>
      {strings.length > 0 && (
        <div className="chips" role="group" aria-label="Example strings">
          {strings.map((x) => <button key={x} type="button" className={cx('chip', x === simInput && 'is-on')} aria-pressed={x === simInput} onClick={() => simulate(x)}>{x === '' ? 'ε (empty)' : x}</button>)}
        </div>
      )}
      {simDirty && <DirtyHint shown={simInput} action="Run" what="string" />}
    </form>
  );
  return (
    <Plate chapter={chapter} stage={stage} controls={controls}
      aside={s.verdict ? <Tag kind={s.verdict === 'ACCEPT' ? 'accept' : 'reject'}>{s.verdict === 'ACCEPT' ? 'Accepted' : 'Rejected'}</Tag> : null}
      dock={<Dock replay={replay} label="DFA simulation" />}>
      <div className="split split--figure">
        <div className="figure figure--dfa">
          <section className="block"><h2 className="label">Input tape</h2><SimTape input={simInput} index={s.index} failedAt={s.failedAt} readAt={s.edge ? s.index - 1 : undefined} /></section>
          <div className="figure__canvas figure__canvas--graph">
            <DfaGraph dfa={dfa} activeState={s.state} activeEdge={s.edge} stuck={stuck} fx={replay.animate ? 'sim' : null} />
          </div>
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle={`Press → to enter the start state ${dfa.start}.`}>
            {step && !s.verdict && <p className="note__headline"><Tx>{step.message}</Tx></p>}
            {step?.type === 'MOVE' && <p>Row <span className="mono">{step.from}</span>, column <span className="mono">{step.symbol}</span> of the table gives <span className="mono">{step.to}</span>.</p>}
            {s.verdict && step && <Verdict result={s.verdict} reason={step.message} />}
            <dl className="readout">
              <div><dt>Current state</dt><dd>{state ? <><b className="mono">{state.name}</b> <span className="mono">{braces(state.positions)}</span>{state.accepting ? ', accepting' : ''}</> : 'none'}</dd></div>
              <div><dt>Remaining input</dt><dd className="mono">{[...simInput].slice(s.index).join('') || 'ε'}</dd></div>
            </dl>
          </StepNote>
          <section className="block"><h2 className="label">Transition table</h2>
            <DfaTable alphabet={dfa.alphabet} states={dfa.states} transitions={dfa.transitions} start={dfa.start} hit={hit} rowState={s.edge ? s.edge.from : s.state} positions={false} />
          </section>
        </aside>
      </div>
    </Plate>
  );
}
