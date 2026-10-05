import { useMemo, useState } from 'react';
import { useReplay } from '../../replay/useReplay.js';
import { cellKey, tableAt } from '../../replay/selectors.js';
import { cx, Empty, PlateHead, Tag, Verdict } from '../common/common.jsx';
import { StepPlayer } from '../StepPlayer/StepPlayer.jsx';
import { PrecedenceTable } from '../PrecedenceTable/PrecedenceTable.jsx';
import { Bench, ModeSwitch, TraceTable } from './Bench.jsx';

const NONE = [];

export function ConflictBlock({ analysis, go, stage }) {
  return (
    <div className="plate">
      <PlateHead no={stage.no} title={stage.title} />
      <div className="plate__body plate__body--single">
        <Empty title="Build a conflict-free precedence table before parsing a string."
          action={<button type="button" className="btn" onClick={() => go('table')}>Open 1.3 Precedence table</button>}>
          {analysis.table.conflicts.map((c) => `Cell (${c.left}, ${c.right})`).join(', ')}{' '}
          {analysis.table.conflicts.length === 1 ? 'contains' : 'each contain'} more than one precedence relation.
        </Empty>
      </div>
    </div>
  );
}

export function ParseStage({ model, go, stage }) {
  const { analysis, canParse, run, parseDraft, setParseDraft, parseReq, parse, strings } = model;
  const steps = run?.steps ?? NONE;
  const markers = useMemo(() => {
    let k = 0;
    return steps.flatMap((s, i) => (s.type === 'REDUCE' ? [{ at: i + 1, label: `R${++k}` }] : []));
  }, [steps]);
  const replay = useReplay(steps, { markers, active: canParse });
  const [view, setView] = useState('trace');
  const finalCells = useMemo(() => (canParse ? tableAt(analysis.table.steps, analysis.table.steps.length) : new Map()), [analysis, canParse]);
  if (!canParse) return <ConflictBlock analysis={analysis} go={go} stage={stage} />;
  const { step, count } = replay;
  const lookup = step && step.top && step.lookahead && !(step.top === '$' && step.lookahead === '$') ? { left: step.top, right: step.lookahead } : null;

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Shift / reduce parse"
        aside={count === steps.length && steps.length > 0 ? <Tag kind={run.result === 'ACCEPT' ? 'accept' : 'reject'}>{run.result}</Tag> : <Tag kind="plain">{parseReq.mode === 'classic' ? 'CLASSIC N' : 'SAFEGUARDED'}</Tag>}>
      </PlateHead>
      <form className="controls" onSubmit={(e) => { e.preventDefault(); parse(parseDraft, parseReq.mode); }}>
        <label className="field">
          <span className="label">Input string</span>
          <input type="text" className="field__input" value={parseDraft} spellCheck={false} autoComplete="off"
            onChange={(e) => setParseDraft(e.target.value)} placeholder="id + id * id" />
        </label>
        <button type="submit" className="btn btn--primary">Parse</button>
        <ModeSwitch mode={parseReq.mode} onChange={(m) => parse(parseDraft, m)} />
        {strings.length > 0 && (
          <div className="chips" role="group" aria-label="Sample strings">
            <span className="label">Samples</span>
            {strings.map((s) => (
              <button key={s} type="button" className={cx('chip', s === parseReq.input && 'is-on')} onClick={() => parse(s, parseReq.mode)}>{s}</button>
            ))}
          </div>
        )}
      </form>
      {steps.length === 0 ? (
        <div className="plate__body plate__body--single">
          <Verdict result="REJECT" reason={`${run.reason} Use only this grammar's terminals: ${analysis.grammar.terminals.join(' ')}`} />
        </div>
      ) : (
        <div className="plate__body cols cols--parse">
          <section className="pane pane--bench">
            <Bench step={step} tokens={run.tokens} mode={parseReq.mode} fx={replay.animate ? (replay.rich ? 'rich' : 'fast') : null} />
          </section>
          <section className="pane pane--side">
            <div className="tabs" role="tablist" aria-label="Side panel">
              {[['trace', 'Trace'], ['table', 'Precedence table']].map(([id, text]) => (
                <button key={id} type="button" role="tab" aria-selected={view === id} className={cx('tabs__tab', view === id && 'is-on')} onClick={() => setView(id)}>{text}</button>
              ))}
            </div>
            {view === 'trace'
              ? <TraceTable steps={steps} tokens={run.tokens} count={count} onJump={replay.api.goto} />
              : (
                <div className="lookup">
                  <PrecedenceTable axes={analysis.table.axes} cells={finalCells} lookup={lookup} compact />
                  <p className="help">
                    {lookup
                      ? <>Lookup for this step: row <b className="mono">{lookup.left}</b>, column <b className="mono">{lookup.right}</b>{finalCells.get(cellKey(lookup.left, lookup.right)) ? '.' : ': blank, so the string is rejected.'}</>
                      : 'The cell consulted at each step is bracketed here.'}
                  </p>
                </div>
              )}
          </section>
        </div>
      )}
      {steps.length > 0 && <StepPlayer replay={replay} label="Parse" />}
    </div>
  );
}
