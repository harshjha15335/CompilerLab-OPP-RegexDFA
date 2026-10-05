import { useMemo, useState } from 'react';
import { REGEX_SAMPLES } from '../data/samples.js';
import { useReplay } from '../replay/useReplay.js';
import { dfaAt, followposAt, followposProvenance, nodePropsAt, phaseMarkers, simAt } from '../replay/selectors.js';
import { cx, Empty, NoteRow, PlateHead, SetText, StepNote, Tag, Verdict } from '../components/common/common.jsx';
import { StepPlayer } from '../components/StepPlayer/StepPlayer.jsx';
import { NODE_NAME, SyntaxTree, TreeLegend } from '../components/SyntaxTree/SyntaxTree.jsx';
import { FollowposTable } from '../components/FollowposTable/FollowposTable.jsx';
import { DFATable } from '../components/DFATable/DFATable.jsx';
import { DFAGraph } from '../components/DFAGraph/DFAGraph.jsx';
import { SimulationTape } from '../components/SimulationTape/SimulationTape.jsx';

const SHORT = { or: 'union', cat: 'concat', star: 'star', plus: 'plus', opt: 'optional' };
const short = (n) => (n.type === 'leaf' ? `${n.symbol}${n.pos}` : SHORT[n.type]);
const describe = (n) => (n.type === 'leaf' ? `${n.symbol}${n.pos}` : `${SHORT[n.type]}(${n.children.map(short).join(', ')})`);
const braces = (a) => `{${a.join(',')}}`;

function Blocked({ stage, model, go }) {
  const { analysis } = model;
  return (
    <div className="plate">
      <PlateHead no={stage.no} title={stage.title} />
      <div className="plate__body plate__body--single">
        <Empty title="No syntax tree yet." action={<button type="button" className="btn" onClick={() => go('tree')}>Open 3.1 Expression</button>}>
          {analysis.status === 'empty' ? 'Enter a regular expression to begin.' : analysis.error}
        </Empty>
      </div>
    </div>
  );
}

/* ───────────── 3.1 Expression & syntax tree ───────────── */

function ErrorSource({ source, position }) {
  const chars = [...source, ' '];
  return (
    <pre className="errsrc" aria-hidden="true">
      {chars.map((c, i) => <span key={i} className={cx(i === position && 'is-bad')}>{c}</span>)}
      {'\n'}{' '.repeat(Math.max(0, position))}<span className="errsrc__caret">^</span>
    </pre>
  );
}

function TreeStage({ model, stage, go }) {
  const { draft, setDraft, commit, dirty, analysis, loadSample, committed } = model;
  const ok = analysis.status === 'ok';
  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Regular expression and its syntax tree">
        The end marker <code>#</code> is added for you.
      </PlateHead>
      <form className="controls" onSubmit={(e) => { e.preventDefault(); commit(); }}>
        <label className="field field--wide">
          <span className="label">Regular expression</span>
          <input type="text" className="field__input field__input--regex" value={draft} spellCheck={false} autoComplete="off" autoCapitalize="off"
            onChange={(e) => setDraft(e.target.value)} placeholder="(a|b)*abb" aria-describedby="regex-help" />
        </label>
        <button type="submit" className="btn btn--primary">Build syntax tree</button>
        <span className="actions__state">{dirty ? 'Edited, not built' : ok ? 'Built' : 'Not built'}</span>
        <p id="regex-help" className="help controls__help">
          <code>|</code> union · <code>*</code> <code>+</code> <code>?</code> postfix · <code>( )</code> group · <code>\</code> escape · <code>#</code> reserved
        </p>
      </form>
      <div className="plate__body cols cols--regex">
        <section className="pane pane--tree">
          {dirty && <p className="result result--pending"><Tag kind="plain">EDITED</Tag> Press <b>Build syntax tree</b> (Enter).</p>}
          {!dirty && analysis.status === 'empty' && <Empty title="Enter a regular expression to begin.">For example <code>(a|b)*abb</code>.</Empty>}
          {!dirty && analysis.status === 'error' && (
            <div className="result result--invalid" role="alert">
              <p className="result__head"><Tag kind="reject">MALFORMED</Tag> {analysis.error}</p>
              <ErrorSource source={analysis.source} position={analysis.position} />
              <p className="errors__where">Character {analysis.position + 1} of {analysis.source.length}</p>
            </div>
          )}
          {!dirty && ok && (
            <>
              <p className="augmented"><span className="label">Augmented expression</span>
                <span className="mono">( {analysis.source} ) <b>#</b></span></p>
              <div className="tree-box"><SyntaxTree root={analysis.root} nodes={analysis.nodes} /></div>
              <TreeLegend />
            </>
          )}
        </section>
        <section className="pane">
          {!dirty && ok && (
            <div className="pane-block">
              <h3 className="label">Leaf positions</h3>
              <table className="ftable ftable--pos">
                <thead><tr><th scope="col">Position</th>{analysis.leaves.map((l) => <th key={l.pos} scope="col">{l.pos}</th>)}</tr></thead>
                <tbody><tr><th scope="row">Symbol</th>{analysis.leaves.map((l) => <td key={l.pos}>{l.symbol}</td>)}</tr></tbody>
              </table>
              <p className="help">A DFA state accepts when it contains position {analysis.endPos}, the end marker.</p>
              <button type="button" className="btn btn--primary" onClick={() => go('props')}>Continue to stage 3.2</button>
            </div>
          )}
          <div className="pane-block">
            <h3 className="label">Sample library</h3>
            <ol className="samples samples--regex">
              {REGEX_SAMPLES.map((s) => (
                <li key={s.id}>
                  <button type="button" className={cx('sample', s.source === committed && !dirty && 'is-current')} onClick={() => loadSample(s)}>
                    <span className="sample__main">
                      <span className="sample__title"><span className="mono">{s.source}</span> {s.error && <Tag kind="reject">MALFORMED</Tag>}</span>
                      <span className="sample__note">{s.note}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ───────────── 3.2 nullable / firstpos / lastpos ───────────── */

function PropsStage({ model, stage }) {
  const { analysis } = model;
  const steps = analysis.propSteps;
  const replay = useReplay(steps);
  const { count, step } = replay;
  const props = useMemo(() => nodePropsAt(steps, count), [steps, count]);
  const byId = useMemo(() => new Map(analysis.nodes.map((n) => [n.id, n])), [analysis]);
  const node = step ? byId.get(step.nodeId) : null;
  const readIds = useMemo(() => new Set((node?.children ?? []).map((c) => c.id)), [node]);

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="nullable, firstpos and lastpos"
>
        Bottom-up: a parent is computed after its children.
      </PlateHead>
      <div className="plate__body cols cols--props">
        <section className="pane pane--tree">
          <div className="tree-box"><SyntaxTree root={analysis.root} nodes={analysis.nodes} props={props} activeId={step?.nodeId} readIds={readIds} annotate="all" /></div>
          <TreeLegend sets />
        </section>
        <section className="pane pane--note">
          <StepNote replay={replay} idle="Nothing computed yet. Press Next (→). Leaves come first, left to right.">
            {node && (
              <>
                <p className="note__headline"><span className="mono">{describe(node)}</span> <Tag kind="new">{NODE_NAME[node.type].toUpperCase()}</Tag></p>
                <dl className="propgrid">
                  <div><dt>nullable</dt><dd>{String(step.nullable)}</dd></div>
                  <div><dt>firstpos</dt><dd><SetText items={step.firstpos} /></dd></div>
                  <div><dt>lastpos</dt><dd><SetText items={step.lastpos} /></dd></div>
                </dl>
                <NoteRow label="Rule">{step.rule}.</NoteRow>
                {node.children && (
                  <NoteRow label="Read from">
                    <ul className="inputs">
                      {node.children.map((c) => (
                        <li key={c.id}><span className="mono">{short(c)}</span>: nullable {String(c.nullable)}, firstpos <span className="mono">{braces(c.first)}</span>, lastpos <span className="mono">{braces(c.last)}</span></li>
                      ))}
                    </ul>
                  </NoteRow>
                )}
              </>
            )}
          </StepNote>
          <div className="scrolltable">
            <table className="proptable">
              <caption className="sr-only">Node properties computed so far</caption>
              <thead><tr><th scope="col">#</th><th scope="col">Node</th><th scope="col">nullable</th><th scope="col">firstpos</th><th scope="col">lastpos</th></tr></thead>
              <tbody>
                {steps.slice(0, count).map((s, i) => (
                  <tr key={s.nodeId} className={cx(i + 1 === count && 'is-current')}
                    ref={i + 1 === count ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
                    <td><button type="button" className="trace__jump" onClick={() => replay.api.goto(i + 1)} aria-label={`Go to step ${i + 1}`}>{i + 1}</button></td>
                    <td className="mono">{describe(byId.get(s.nodeId))}</td>
                    <td>{String(s.nullable)}</td>
                    <td className="mono">{braces(s.firstpos)}</td>
                    <td className="mono">{braces(s.lastpos)}</td>
                  </tr>
                ))}
                {count === 0 && <tr><td colSpan={5} className="dtable__empty">Nothing computed yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <StepPlayer replay={replay} label="Node properties" />
    </div>
  );
}

/* ───────────── 3.3 followpos ───────────── */

function FollowStage({ model, stage }) {
  const { analysis } = model;
  const steps = analysis.followSteps;
  const byId = useMemo(() => new Map(analysis.nodes.map((n) => [n.id, n])), [analysis]);
  const markers = useMemo(() => phaseMarkers(steps, (s) => s.nodeId, (s) => SHORT[byId.get(s.nodeId).type]), [steps, byId]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [selected, setSelected] = useState(null);
  const allProps = useMemo(() => nodePropsAt(analysis.propSteps, analysis.propSteps.length), [analysis]);
  const positions = useMemo(() => analysis.leaves.map((l) => l.pos), [analysis]);
  const follow = followposAt(steps, count, positions);
  const node = step ? byId.get(step.nodeId) : null;
  const isCat = node?.type === 'cat';
  const readIds = useMemo(() => new Set(isCat ? node.children.map((c) => c.id) : []), [node, isCat]);
  const prov = selected != null ? followposProvenance(steps, count, selected) : [];

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="followpos"
>
        Only concatenation, star and plus nodes add to followpos.
      </PlateHead>
      <div className="plate__body cols cols--props">
        <section className="pane pane--tree">
          <div className="tree-box">
            <SyntaxTree root={analysis.root} nodes={analysis.nodes} props={allProps} activeId={step?.nodeId} readIds={readIds} annotate="active"
              arcs={step ? { from: step.position, to: step.added, changed: step.changed } : null} />
          </div>
          <TreeLegend sets />
        </section>
        <section className="pane pane--note">
          <FollowposTable leaves={analysis.leaves} follow={follow} active={step} selected={selected} onSelect={setSelected} />
          <StepNote replay={replay} idle="Every followpos set starts empty. Press Next (→).">
            {node && (
              <>
                <p className="note__headline">
                  <span className="mono">followpos({step.position})</span> gains <span className="mono">{braces(step.added)}</span>{' '}
                  <Tag kind={step.changed ? 'new' : 'plain'}>{step.changed ? 'NEW' : 'NO CHANGE'}</Tag>
                </p>
                <NoteRow label="Node"><span className="mono">{describe(node)}</span></NoteRow>
                <NoteRow label="Because">
                  {isCat ? (
                    <>this concatenation node has<br />
                      <span className="mono">lastpos(left) = {braces(node.children[0].last)}</span><br />
                      <span className="mono">firstpos(right) = {braces(node.children[1].first)}</span><br />
                      and position {step.position} is in lastpos(left).</>
                  ) : (
                    <>this {SHORT[node.type]} node repeats its operand:<br />
                      <span className="mono">lastpos(n) = {braces(node.last)}</span><br />
                      <span className="mono">firstpos(n) = {braces(node.first)}</span><br />
                      and position {step.position} is in lastpos(n).</>
                  )}
                </NoteRow>
                <NoteRow label="Rule">{isCat
                  ? 'for c₁c₂: every position in firstpos(c₂) follows every position in lastpos(c₁).'
                  : 'for c* and c+: every position in firstpos(c) follows every position in lastpos(c).'}</NoteRow>
                
              </>
            )}
          </StepNote>
          {selected != null && (
            <section className="inspect" aria-label="followpos provenance">
              <header>
                <h3 className="label">Provenance · followpos({selected})</h3>
                <button type="button" className="linkbtn" onClick={() => setSelected(null)}>Close</button>
              </header>
              {prov.length === 0 ? <p>Nothing has been added to this set yet.</p> : (
                <ol className="provlist">
                  {prov.map((p) => (
                    <li key={p.step}>
                      <button type="button" className="linkbtn" onClick={() => replay.api.goto(p.step)}>Step {p.step}</button>
                      <span>gains <span className="mono">{braces(p.added)}</span> from <span className="mono">{describe(byId.get(p.nodeId))}</span>{p.changed ? '' : ' (no change)'}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </section>
      </div>
      <StepPlayer replay={replay} label="followpos" />
    </div>
  );
}

/* ───────────── 3.4 DFA construction ───────────── */

function DfaStage({ model, stage }) {
  const { analysis } = model;
  const { dfa, dfaSteps: steps, followpos, leaves, endPos } = analysis;
  const markers = useMemo(() => phaseMarkers(steps,
    (s) => (s.type === 'DFA_START' ? 'start' : s.type === 'DFA_DONE' ? 'done' : s.from),
    (s) => (s.type === 'DFA_START' ? 'start' : s.type === 'DFA_DONE' ? 'done' : `from ${s.from}`)), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const seen = useMemo(() => dfaAt(steps, count), [steps, count]);
  const visibleStates = useMemo(() => seen.states.map((s) => s.name), [seen]);
  const isMove = step?.type === 'DFA_TRANSITION';
  const from = isMove ? dfa.states.find((s) => s.name === step.from) : null;
  // operands of the union, listed for the explanation (the result itself comes from the step)
  const used = isMove ? from.positions.filter((p) => leaves.find((l) => l.pos === p).symbol === step.symbol) : [];
  const usedSet = useMemo(() => new Set(used), [step]);
  const activeEdge = useMemo(() => (isMove ? { from: step.from, to: step.to, symbol: step.symbol } : null), [step, isMove]);
  const fresh = isMove && step.isNew ? step.to : step?.type === 'DFA_START' ? step.state : null;
  const [wide, setWide] = useState(false);

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="DFA construction from followpos"
>
        A state is a set of positions.
      </PlateHead>
      <div className="plate__body cols cols--dfa">
        <section className="pane pane--note">
          <StepNote replay={replay} idle="No state yet. Press Next (→). The start state is firstpos(root).">
            {step?.type === 'DFA_START' && (
              <>
                <p className="note__headline">Start state <span className="mono">{step.state} = {braces(step.positions)}</span> <Tag kind="new">NEW STATE</Tag></p>
                <p>{step.message}</p>
                <NoteRow label="Accepting?">{step.accepting ? `Yes: it contains position ${endPos} (#).` : `No: position ${endPos} (#) is not in it.`}</NoteRow>
              </>
            )}
            {isMove && (
              <>
                <p className="note__headline note__move">
                  <span className="mono">{step.from}</span><span className="arrowlab"><i>{step.symbol}</i></span><span className="mono">{step.to}</span>
                  <Tag kind={step.isNew ? 'new' : 'plain'}>{step.isNew ? 'NEW STATE' : 'EXISTING STATE'}</Tag>
                </p>
                <NoteRow label="Positions used">
                  In <span className="mono">{step.from} = {braces(from.positions)}</span>, the positions labelled <b className="mono">{step.symbol}</b> are <span className="mono">{braces(used)}</span>.
                </NoteRow>
                <NoteRow label="Union">
                  <span className="mono">{used.map((p) => `followpos(${p})`).join(' ∪ ')}</span><br />
                  <span className="mono">= {used.map((p) => braces(followpos[p])).join(' ∪ ')}</span><br />
                  <span className="mono">= {braces(step.positions)}</span>
                </NoteRow>
                <NoteRow label="Result">
                  {step.isNew ? <>No existing state has this set, so it becomes the new state <b className="mono">{step.to}</b>.</> : <>That set is the existing state <b className="mono">{step.to}</b>.</>}
                  {step.accepting && <> It contains position {endPos} (#), so <b className="mono">{step.to}</b> is accepting.</>}
                </NoteRow>
              </>
            )}
            {step?.type === 'DFA_DONE' && (
              <>
                <p className="note__headline">Construction complete</p>
                <p>{step.message}</p>
                <NoteRow label="Start">{dfa.start}</NoteRow>
                <NoteRow label="Accepting">{dfa.accepting.join(', ') || 'none'} (states containing position {endPos})</NoteRow>
              </>
            )}
          </StepNote>
        </section>
        <section className="pane pane--graph">
          <DFAGraph dfa={dfa} visibleStates={visibleStates} visibleTransitions={seen.transitions}
            activeEdge={activeEdge} sourceState={isMove ? step.from : null} freshState={fresh}
            tools={<button type="button" className="linkbtn" aria-pressed={wide} onClick={() => setWide((w) => !w)}>{wide ? 'Show tables' : 'Enlarge graph'}</button>} />
          <div className="tworow" hidden={wide}>
            <div className="pane-block">
              <h3 className="label">Transition table</h3>
              <DFATable alphabet={dfa.alphabet} states={seen.states} transitions={seen.transitions} start={dfa.start}
                activeCell={isMove ? { from: step.from, symbol: step.symbol } : null} activeState={isMove ? step.from : null} freshState={fresh} />
            </div>
            <div className="pane-block followref">
              <h3 className="label">followpos (from 3.3)</h3>
              <FollowposTable leaves={leaves} follow={followpos} highlight={usedSet} />
            </div>
          </div>
        </section>
      </div>
      <StepPlayer replay={replay} label="DFA construction" />
    </div>
  );
}

/* ───────────── 3.5 Test strings ───────────── */

function SimStage({ model, stage }) {
  const { analysis, sim, simDraft, setSimDraft, simInput, simulate, strings } = model;
  const { dfa } = analysis;
  const steps = sim.steps;
  const replay = useReplay(steps);
  const { count, step } = replay;
  const s = simAt(steps, count);
  const state = s.state ? dfa.states.find((q) => q.name === s.state) : null;
  const stuck = s.failedAt != null;
  const cell = s.edge ? { from: s.edge.from, symbol: s.edge.symbol } : stuck ? { from: s.state, symbol: step.symbol } : null;
  const chars = [...simInput];

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Running the DFA on a test string"
        aside={s.verdict ? <Tag kind={s.verdict === 'ACCEPT' ? 'accept' : 'reject'}>{s.verdict}</Tag> : <Tag kind="code">{analysis.source}</Tag>}>
      </PlateHead>
      <form className="controls" onSubmit={(e) => { e.preventDefault(); simulate(simDraft); }}>
        <label className="field">
          <span className="label">Test string</span>
          <input type="text" className="field__input" value={simDraft} spellCheck={false} autoComplete="off" autoCapitalize="off"
            onChange={(e) => setSimDraft(e.target.value)} placeholder="empty string" />
        </label>
        <button type="submit" className="btn btn--primary">Run</button>
        {strings.length > 0 && (
          <div className="chips" role="group" aria-label="Sample strings">
            <span className="label">Samples</span>
            {strings.map((x) => (
              <button key={x} type="button" className={cx('chip', x === simInput && 'is-on')} onClick={() => simulate(x)}>{x === '' ? 'ε (empty)' : x}</button>
            ))}
          </div>
        )}
      </form>
      <div className="plate__body cols cols--sim">
        <section className="pane pane--note">
          <div className="pane-block">
            <h3 className="label">Input tape</h3>
            <SimulationTape input={simInput} index={s.index} failedAt={s.failedAt} edgeSymbolAt={s.edge ? s.index - 1 : undefined} />
          </div>
          <div className="pane-block">
            <h3 className="label">Transition table</h3>
            <DFATable alphabet={dfa.alphabet} states={dfa.states} transitions={dfa.transitions} start={dfa.start}
              activeCell={cell} activeState={s.edge ? s.edge.from : s.state} showPositions={false} />
          </div>
        </section>
        <section className="pane pane--graph">
          <DFAGraph dfa={dfa} activeState={s.state} activeEdge={s.edge} stuck={stuck} />
          <div className="tworow tworow--sim">
            <dl className="readout">
              <div><dt>Current state</dt><dd>{state ? <><b className="mono">{state.name}</b> <span className="mono">{braces(state.positions)}</span>{state.accepting ? ' · accepting' : ''}</> : 'none'}</dd></div>
              <div><dt>Transition used</dt><dd>{s.edge
                ? <span className="note__move"><span className="mono">{s.edge.from}</span><span className="arrowlab"><i>{s.edge.symbol}</i></span><span className="mono">{s.edge.to}</span></span>
                : stuck ? <>none from <span className="mono">{s.state}</span> on <span className="mono">{step.symbol}</span></> : 'none'}</dd></div>
              <div><dt>Remaining input</dt><dd className="mono">{chars.slice(s.index).join('') || 'ε'}</dd></div>
            </dl>
            <StepNote replay={replay} idle={`Press Next (→) to enter the start state ${dfa.start}.`}>
              {step && !s.verdict && <p className="note__headline">{step.message}</p>}
              {step?.type === 'MOVE' && <p>Row <span className="mono">{step.from}</span>, column <span className="mono">{step.symbol}</span> gives <span className="mono">{step.to}</span>.</p>}
              {s.verdict && <Verdict result={s.verdict} reason={step.message} />}
            </StepNote>
          </div>
        </section>
      </div>
      <StepPlayer replay={replay} label="DFA simulation" />
    </div>
  );
}

export function RegexToDfaPage({ model, stage, go }) {
  const props = { model, stage, go };
  if (stage.id === 'tree') return <TreeStage {...props} />;
  if (model.analysis.status !== 'ok') return <Blocked {...props} />;
  switch (stage.id) {
    case 'props': return <PropsStage {...props} />;
    case 'follow': return <FollowStage {...props} />;
    case 'dfa': return <DfaStage {...props} />;
    case 'sim': return <SimStage {...props} />;
    default: return null;
  }
}
