import { Fragment, useMemo, useState } from 'react';
import { useReplay } from '../../replay/useReplay.js';
import { phaseMarkers, setProvenance, setsAt } from '../../replay/selectors.js';
import { cx, NoteRow, PlateHead, Production, ProductionList, StepNote, Tag } from '../common/common.jsx';
import { StepPlayer } from '../StepPlayer/StepPlayer.jsx';

export const SET_RULES = {
  L1: 'A → a …  ⟹  a ∈ LEADING(A)',
  L1b: 'A → B a …  ⟹  a ∈ LEADING(A)',
  L2: 'A → B …  ⟹  LEADING(B) ⊆ LEADING(A)',
  T1: 'A → … a  ⟹  a ∈ TRAILING(A)',
  T1b: 'A → … a B  ⟹  a ∈ TRAILING(A)',
  T2: 'A → … B  ⟹  TRAILING(B) ⊆ TRAILING(A)',
};

/** One set, typeset as mathematics. Members are buttons so their provenance can be inspected. */
export function SetLine({ kind, nonTerminal, members, active, source, onInspect, selected }) {
  return (
    <div className={cx('setline', active && 'is-active', source && 'is-source')}>
      <span className="setline__name">{kind}({nonTerminal})</span>
      <span className="setline__eq">=</span>
      <span className="setline__set">
        <span aria-hidden="true">{'{ '}</span>
        {members.map((m, i) => {
          const hit = active && active.element === m;
          const state = hit ? (active.changed ? 'new' : 'dup') : null;
          return (
            <Fragment key={m}>
              {i > 0 && <span aria-hidden="true">, </span>}
              <button type="button" className={cx('member', state && `is-${state}`, selected === m && 'is-selected')}
                onClick={() => onInspect?.({ kind, nonTerminal, element: m })}
                aria-label={`${m} in ${kind}(${nonTerminal})${state === 'new' ? ', new' : state === 'dup' ? ', already present' : ''}. Show provenance.`}>
                {m}
                {state && <span className="member__tag" key={state}>{state === 'new' ? 'new' : 'already in set'}</span>}
              </button>
            </Fragment>
          );
        })}
        <span aria-hidden="true">{' }'}</span>
      </span>
    </div>
  );
}

function SetBlock({ kind, sets, nonterminals, step, inspect, onInspect, dim }) {
  const act = step?.type === `ADD_${kind}` ? step : null;
  const sourceNt = act && (act.rule === 'L2' || act.rule === 'T2') ? act.sourceSymbols[0] : null;
  return (
    <section className={cx('pane-block setblock', dim && 'is-waiting')} aria-label={`${kind} sets`}>
      <h3 className="label">{kind} {dim && <span className="label__note">— not started</span>}</h3>
      {nonterminals.map((n) => (
        <SetLine key={n} kind={kind} nonTerminal={n} members={sets[n] ?? []}
          active={act?.nonTerminal === n ? act : null} source={sourceNt === n}
          selected={inspect?.kind === kind && inspect.nonTerminal === n ? inspect.element : null}
          onInspect={onInspect} />
      ))}
    </section>
  );
}

export function SetsStage({ model, stage }) {
  const { grammar, setSteps: steps, leading } = model.analysis;
  const markers = useMemo(() => phaseMarkers(steps,
    (s) => (s.type === 'PASS' ? `${s.phase}${s.pass}` : undefined),
    (s) => (s.pass === 1 ? s.phase : `pass ${s.pass}`)), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [inspect, setInspect] = useState(null);
  const nts = grammar.nonterminals;
  const L = setsAt(steps, count, 'LEADING', nts);
  const T = setsAt(steps, count, 'TRAILING', nts);
  const isAdd = step?.type?.startsWith('ADD_');
  const prod = isAdd ? grammar.productions.find((p) => p.id === step.productionId) : null;
  // the edge symbols the rule looked at: first ones for LEADING, last ones for TRAILING
  const marks = useMemo(() => {
    if (!prod) return undefined;
    const k = step.sourceSymbols.length, n = prod.rhs.length;
    return new Set(Array.from({ length: k }, (_, i) => (step.phase === 'LEADING' ? i : n - 1 - i)));
  }, [prod, step]);
  const prov = inspect ? setProvenance(steps, count, inspect.kind, inspect.nonTerminal, inspect.element) : [];

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="LEADING and TRAILING sets"
        aside={<Tag kind="plain">{step?.phase ?? 'LEADING'}{step?.pass ? ` · pass ${step.pass}` : ''}</Tag>}>
        One derivation attempt per step, repeated in passes until no set changes. Attempts that find nothing new stay visible.
      </PlateHead>
      <div className="plate__body cols cols--sets">
        <section className="pane">
          <ProductionList grammar={grammar} activeId={prod?.id} marks={marks} />
          <div className="pane-block">
            <h3 className="label">Rules</h3>
            <ul className="rules">
              {Object.entries(SET_RULES).map(([id, text]) => (
                <li key={id} className={cx(step?.rule === id && 'is-active')}><b>{id}</b><span>{text}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pane pane--sets">
          <SetBlock kind="LEADING" sets={L} nonterminals={nts} step={step} inspect={inspect} onInspect={setInspect} />
          <SetBlock kind="TRAILING" sets={T} nonterminals={nts} step={step} inspect={inspect} onInspect={setInspect}
            dim={count <= leading.steps.length} />
        </section>

        <section className="pane pane--note">
          <StepNote replay={replay} idle="Every set starts empty. Press Next (→) to try the first production, or Play to run to the fixed point.">
            {step?.type === 'PASS' && (
              <>
                <p className="note__headline">{step.phase} · pass {step.pass}</p>
                <p>Every production is examined again, in order. The pass that changes no set is the last one.</p>
              </>
            )}
            {step?.type === 'DONE' && (
              <>
                <p className="note__headline">{step.phase} is complete</p>
                <p>{step.message} The last pass added nothing, so no further pass can.</p>
              </>
            )}
            {isAdd && (
              <>
                <p className="note__headline">
                  {step.changed
                    ? <><b className="mono">{step.element}</b> enters {step.phase}({step.nonTerminal})</>
                    : <>No set change</>}
                  {' '}<Tag kind={step.changed ? 'new' : 'plain'}>{step.changed ? 'NEW' : 'DUPLICATE'}</Tag>
                </p>
                <p>{step.message}</p>
                <NoteRow label="Production"><span className="mono">{prod.id}.</span> <Production p={prod} marks={marks} active /></NoteRow>
                <NoteRow label={`Rule ${step.rule}`}><span className="mono">{SET_RULES[step.rule]}</span></NoteRow>
              </>
            )}
          </StepNote>
          {inspect && (
            <section className="inspect" aria-label="Provenance">
              <header>
                <h3 className="label">Provenance · <span className="mono">{inspect.element}</span> in {inspect.kind}({inspect.nonTerminal})</h3>
                <button type="button" className="linkbtn" onClick={() => setInspect(null)}>Close</button>
              </header>
              {prov.length === 0 ? <p>Not derived yet at this step.</p> : (
                <ol className="provlist">
                  {prov.map((p) => (
                    <li key={p.step}>
                      <button type="button" className="linkbtn" onClick={() => replay.api.goto(p.step)}>Step {p.step}</button>
                      <span>{p.changed ? 'inserted' : 'found again'} by rule {p.rule}, production {p.productionId}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </section>
      </div>
      <StepPlayer replay={replay} label="LEADING / TRAILING" />
    </div>
  );
}
