import { useMemo, useState } from 'react';
import { useReplay } from '../../replay/useReplay.js';
import { safeguardedRejection } from '../../replay/selectors.js';
import { cx, PlateHead, Tag } from '../common/common.jsx';
import { StepPlayer } from '../StepPlayer/StepPlayer.jsx';
import { Bench, MODE_TEXT } from './Bench.jsx';
import { ConflictBlock } from './ParseStage.jsx';

const NONE = [];
const ResultTag = ({ r }) => <Tag kind={r === 'ACCEPT' ? 'accept' : 'reject'}>{r}</Tag>;

export function ModesStage({ model, go, stage }) {
  const { analysis, canParse, cmp, cmpInput, setCmpInput, fixtureRows } = model;
  const [draft, setDraft] = useState(cmpInput);
  // pair the two existing step lists by step number; nothing is recomputed
  const steps = useMemo(() => {
    if (!cmp) return NONE;
    const n = Math.max(cmp.classic.steps.length, cmp.safeguarded.steps.length);
    return Array.from({ length: n }, (_, i) => {
      const c = cmp.classic.steps[i] ?? null, s = cmp.safeguarded.steps[i] ?? null;
      return { classic: c, safeguarded: s, message: `Classic: ${c?.message ?? 'finished'}  ·  Safeguarded: ${s?.message ?? 'finished'}` };
    });
  }, [cmp]);
  const markers = useMemo(() => {
    if (!cmp) return NONE;
    const m = [];
    if (cmp.firstStateDivergence) m.push({ at: cmp.firstStateDivergence, label: 'stacks differ' });
    if (cmp.firstDecisionDivergence && cmp.firstDecisionDivergence !== cmp.firstStateDivergence) m.push({ at: cmp.firstDecisionDivergence, label: 'decisions differ' });
    return m;
  }, [cmp]);
  const replay = useReplay(steps, { markers, active: canParse });
  if (!canParse) return <ConflictBlock analysis={analysis} go={go} stage={stage} />;
  const { count, step } = replay;
  const rej = safeguardedRejection(cmp);
  const rows = fixtureRows.some((r) => r.input === cmp.input) ? fixtureRows : [...fixtureRows, cmp];
  const pick = (input) => { setDraft(input); setCmpInput(input); };
  const sideStep = (side) => {
    const list = cmp[side].steps;
    return count === 0 ? null : list[Math.min(count, list.length) - 1] ?? null;
  };

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Classic N versus Safeguarded reduction"
        aside={<Tag kind={cmp.differ ? 'conflict' : 'plain'}>{cmp.differ ? 'MODES DIFFER' : 'MODES AGREE'}</Tag>}>
        Same table, same handles. The modes differ in what a reduction leaves on the stack.
      </PlateHead>
      <div className="plate__body cols cols--modes">
        <section className="pane pane--modes-side">
          <form className="controls controls--stack" onSubmit={(e) => { e.preventDefault(); setCmpInput(draft); }}>
            <label className="field">
              <span className="label">String to compare</span>
              <input type="text" className="field__input" value={draft} spellCheck={false} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
            </label>
            <button type="submit" className="btn btn--primary">Compare</button>
          </form>
          <div className={cx('split', cmp.differ && 'is-differ')} role="status">
            <div><span className="label">Classic N</span><ResultTag r={cmp.classic.result} /></div>
            <div><span className="label">Safeguarded</span><ResultTag r={cmp.safeguarded.result} /></div>
            {cmp.differ && rej && <button type="button" className="btn" onClick={() => replay.api.goto(rej.step)}>Go to the divergence (step {rej.step})</button>}
          </div>
          <table className="cmptable">
            <caption className="label">Results for this grammar</caption>
            <thead><tr><th scope="col">String</th><th scope="col">Classic N</th><th scope="col">Safeguarded</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.input} className={cx(r.input === cmp.input && 'is-current', r.differ && 'is-differ')}>
                  <th scope="row">
                    <button type="button" className="cmptable__pick" onClick={() => pick(r.input)} aria-pressed={r.input === cmp.input}>{r.input || '(empty)'}</button>
                    {r.differ && <span className="cmptable__flag">modes differ</span>}
                  </th>
                  <td><ResultTag r={r.classic.result} /></td>
                  <td><ResultTag r={r.safeguarded.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="modes-note">
            <h3 className="label">Why they can differ</h3>
            {MODE_TEXT}
            <dl className="diverge">
              <div>
                <dt>Stacks first read differently</dt>
                <dd>{cmp.firstStateDivergence
                  ? <><button type="button" className="linkbtn" onClick={() => replay.api.goto(cmp.firstStateDivergence)}>Step {cmp.firstStateDivergence}</button>, the first reduction.</>
                  : 'Never.'}</dd>
              </div>
              <div>
                <dt>Decisions first differ</dt>
                <dd>{cmp.firstDecisionDivergence
                  ? <button type="button" className="linkbtn" onClick={() => replay.api.goto(cmp.firstDecisionDivergence)}>Step {cmp.firstDecisionDivergence}</button>
                  : 'Never.'}</dd>
              </div>
              {cmp.differ && rej && (
                <div>
                  <dt>Safeguarded rejects</dt>
                  <dd>
                    <button type="button" className="linkbtn" onClick={() => replay.api.goto(rej.step)}>Step {rej.step}</button>
                    {rej.atReduction
                      ? <>, at handle <b className="mono">{rej.handle.symbols.map((h) => h.symbol).join(' ')}</b>: no production has these non-terminals. Classic N reduces it because it sees only <span className="mono">N</span>.</>
                      : <>: {rej.reason}</>}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </section>
        {steps.length === 0 ? (
          <section className="pane"><p className="note__idle">{cmp.classic.reason}</p></section>
        ) : (
          <>
            {[['classic', 'Classic N'], ['safeguarded', 'Safeguarded']].map(([side, title]) => (
              <section key={side} className="pane pane--bench">
                <Bench compact title={<>{title} <ResultTag r={cmp[side].result} /></>} mode={side} tokens={cmp.tokens}
                  fx={replay.animate && count <= cmp[side].steps.length ? (replay.rich ? 'rich' : 'fast') : null}
                  step={sideStep(side)} finished={count > cmp[side].steps.length || (step && !step[side] && count > 0)} />
              </section>
            ))}
          </>
        )}
      </div>
      {steps.length > 0 && <StepPlayer replay={replay} label="Mode comparison" />}
    </div>
  );
}
