import { Fragment, useMemo, useRef, useState } from 'react';
import type { Chapter, Stage } from '../../data/nav.ts';
import type { SetAddStep, SetKind, SetMap, SetStep } from '../../core/index.ts';
import type { OkGrammar } from '../../replay/pipelines.ts';
import { phaseMarkers, setProvenance, setsAt } from '../../replay/selectors.ts';
import { useReplay } from '../../replay/useReplay.ts';
import { all, beam, nudge, settle } from '../../motion/fx.ts';
import { Dock } from '../../ui/hardware.tsx';
import { cx, Production, ProductionList, Row, Tag } from '../../ui/kit.tsx';
import { nextStageOf, Plate, StepNote, useStepFx } from '../../ui/plate.tsx';

export const SET_RULES: Record<string, string> = {
  L1: 'A → a …  gives  a ∈ LEADING(A)',
  L1b: 'A → B a …  gives  a ∈ LEADING(A)',
  L2: 'A → B …  gives  LEADING(B) ⊆ LEADING(A)',
  T1: 'A → … a  gives  a ∈ TRAILING(A)',
  T1b: 'A → … a B  gives  a ∈ TRAILING(A)',
  T2: 'A → … B  gives  TRAILING(B) ⊆ TRAILING(A)',
};

const isAdd = (s: SetStep | null): s is SetAddStep => Boolean(s && 'element' in s);

function SetBlock({ kind, sets, nts, step, selected, onPick, waiting }: {
  kind: SetKind; sets: SetMap; nts: string[]; step: SetStep | null; selected: { kind: SetKind; nt: string; el: string } | null;
  onPick: (k: SetKind, nt: string, el: string) => void; waiting: boolean;
}) {
  const act = isAdd(step) && step.phase === kind ? step : null;
  const sourceNt = act && (act.rule === 'L2' || act.rule === 'T2') ? act.sourceSymbols[0] : null;
  return (
    <section className={cx('setblock', waiting && 'is-waiting')} aria-label={`${kind} sets`}>
      <h2 className="section-title">{kind}{waiting && <span className="setblock__wait"> starts after LEADING</span>}</h2>
      {nts.map((n) => (
        <div key={n} className={cx('setline', act?.nonTerminal === n && 'is-target', sourceNt === n && 'is-source')}
          data-cause={sourceNt === n ? '' : undefined}>
          <span className="setline__name">{kind}({n})</span>
          <span className="setline__eq">=</span>
          <span className="setline__set">
            <span aria-hidden="true">{'{ '}</span>
            {(sets[n] ?? []).map((m, i) => {
              const hit = act?.nonTerminal === n && act.element === m;
              const st = hit ? (act.changed ? 'new' : 'dup') : null;
              return (
                <Fragment key={m}>
                  {i > 0 && <span aria-hidden="true">, </span>}
                  <button type="button" className={cx('member', st && `is-${st}`, selected?.kind === kind && selected.nt === n && selected.el === m && 'is-selected')}
                    onClick={() => onPick(kind, n, m)}
                    aria-label={`${m} in ${kind}(${n})${st === 'new' ? ', just added' : st === 'dup' ? ', found again, no change' : ''}. Show where it came from.`}>
                    {m}
                  </button>
                </Fragment>
              );
            })}
            <span aria-hidden="true">{' }'}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

export function SetsStage({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkGrammar }) {
  const { grammar, setSteps: steps, leading } = a;
  const markers = useMemo(() => phaseMarkers(steps,
    (s) => (s.type === 'PASS' ? `${s.phase}${s.pass}` : undefined),
    (s) => (s.type === 'PASS' && s.pass === 1 ? s.phase : s.type === 'PASS' ? `pass ${s.pass}` : '')), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [pick, setPick] = useState<{ kind: SetKind; nt: string; el: string } | null>(null);
  const nts = grammar.nonterminals;
  const L = setsAt(steps, count, 'LEADING', nts);
  const T = setsAt(steps, count, 'TRAILING', nts);
  const add = isAdd(step) ? step : null;
  const prod = add ? grammar.productions.find((p) => p.id === add.productionId) ?? null : null;
  // the edge symbols the rule looked at: the first ones for LEADING, the last ones for TRAILING
  const marks = useMemo(() => {
    if (!prod || !add) return undefined;
    const k = add.sourceSymbols.length, n = prod.rhs.length;
    return new Set(Array.from({ length: k }, (_, i) => (add.phase === 'LEADING' ? i : n - 1 - i)));
  }, [prod, add]);
  const prov = pick ? setProvenance(steps, count, pick.kind, pick.nt, pick.el) : [];
  const body = useRef<HTMLDivElement>(null);
  useStepFx(replay, ({ step: s, rich }) => {
    if (!isAdd(s)) return undefined;
    const root = body.current;
    const el = root?.querySelector('.member.is-new, .member.is-dup');
    if (!s.changed) return nudge(el);
    if (!rich) return settle(el);
    return all(beam(root?.querySelector('.prodlist li.is-active .prod'), el, { duration: 300 }), settle(el, { delay: 260 }));
  });

  return (
    <Plate chapter={chapter} stage={stage}
      aside={<Tag kind="plain">{step && 'phase' in step ? step.phase : 'LEADING'}{step?.type === 'PASS' ? `, pass ${step.pass}` : ''}</Tag>}
      dock={<Dock replay={replay} label="LEADING and TRAILING" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure" ref={body}>
        <div className="figure figure--sets">
          <div className="figure__col">
            <ProductionList productions={grammar.productions} activeId={prod?.id} marks={marks} />
            <section className="block">
              <h2 className="label">Rules</h2>
              <ul className="rules">
                {Object.entries(SET_RULES).map(([id, text]) => (
                  <li key={id} className={cx(add?.rule === id && 'is-active')}><b>{id}</b><span>{text}</span></li>
                ))}
              </ul>
            </section>
          </div>
          <div className="figure__col figure__col--sets">
            <SetBlock kind="LEADING" sets={L} nts={nts} step={step} selected={pick} onPick={(k, nt, el) => setPick({ kind: k, nt, el })} waiting={false} />
            <SetBlock kind="TRAILING" sets={T} nts={nts} step={step} selected={pick} onPick={(k, nt, el) => setPick({ kind: k, nt, el })} waiting={count <= leading.steps.length} />
          </div>
        </div>
        <aside className="inspector">
          <StepNote replay={replay} idle="Every set starts empty. Press → to try the first production.">
            {step?.type === 'PASS' && <><p className="note__headline">{step.phase}, pass {step.pass}</p><p>Every production is tried again, in order. A pass that changes nothing is the last one.</p></>}
            {step?.type === 'DONE' && <><p className="note__headline">{step.phase} is complete</p><p>{step.message}</p></>}
            {add && prod && (
              <>
                <p className="note__headline">
                  {add.changed ? <><b className="mono">{add.element}</b> joins {add.phase}({add.nonTerminal})</> : 'No set change'}
                  {' '}<Tag kind={add.changed ? 'new' : 'dup'}>{add.changed ? 'New' : 'Already there'}</Tag>
                </p>
                <p>{add.message}</p>
                <Row label="Production"><span className="mono">{prod.id}.</span> <Production p={prod} marks={marks} active /></Row>
                <Row label={`Rule ${add.rule}`}><span className="mono">{SET_RULES[add.rule]}</span></Row>
              </>
            )}
          </StepNote>
          {pick && (
            <section className="sheet" aria-label="Where this member came from">
              <header className="sheet__head">
                <h2 className="section-title"><span className="mono">{pick.el}</span> in {pick.kind}({pick.nt})</h2>
                <button type="button" className="btn btn--quiet" onClick={() => setPick(null)}>Close</button>
              </header>
              {prov.length === 0 ? <p>Not derived yet at this step.</p> : (
                <ol className="provlist">
                  {prov.map((p) => (
                    <li key={p.step}>
                      <button type="button" className="linkbtn" onClick={() => replay.api.goto(p.step)}>Step {p.step}</button>
                      <span>{p.changed ? 'Added' : 'Found again'} by rule {p.rule} from production {p.productionId}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </aside>
      </div>
    </Plate>
  );
}
