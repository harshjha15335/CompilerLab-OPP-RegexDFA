import { useMemo, useState } from 'react';
import { hashFor, type Chapter, type Stage } from '../../data/nav.ts';
import type { ParseStep } from '../../core/index.ts';
import type { OppModel } from '../../models.ts';
import type { OkGrammar } from '../../replay/pipelines.ts';
import { cellKey, tableAt } from '../../replay/selectors.ts';
import { useReplay } from '../../replay/useReplay.ts';
import { conflictSentence } from '../../replay/wording.ts';
import { Dock } from '../../ui/hardware.tsx';
import { cx, DirtyHint, Empty, Rel, Tag, Verdict } from '../../ui/kit.tsx';
import { nextStageOf, Plate } from '../../ui/plate.tsx';
import { Bench, ModeSwitch } from './Bench.tsx';
import { PrecTable } from './PrecTable.tsx';

const NONE: ParseStep[] = [];

export function ConflictBlock({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkGrammar }) {
  return (
    <Plate chapter={chapter} stage={stage}>
      <Empty title="This grammar's table has a conflict, so there is nothing to parse with."
        action={<a className="btn" href={hashFor('opp', 'table')}>Open 3 Precedence table</a>}>
        {conflictSentence(a.table.conflicts.map((c) => ({ ...c, relations: a.table.get(c.left, c.right) })), 'Cell ')}
        A precedence parser needs exactly one relation per cell.
      </Empty>
    </Plate>
  );
}

function TraceTable({ steps, tokens, count, onJump }: { steps: ParseStep[]; tokens: string[]; count: number; onJump: (n: number) => void }) {
  const input = (s: ParseStep) => [...tokens.slice(s.type === 'SHIFT' ? s.pointer - 1 : s.pointer), '$'].join(' ');
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
              <td className="mono trace__stack">{(s.stackBefore ?? s.stack).map((x) => x.symbol).join(' ')}</td>
              <td className="mono trace__input">{input(s)}</td>
              <td className="trace__act">{s.relation && <><Rel r={s.relation} />{' '}</>}<b>{s.type === 'SHIFT' ? 'Shift' : s.type === 'REDUCE' ? 'Reduce' : s.type}</b>
                {s.type === 'REDUCE' && <span className="mono"> {s.production!.lhs} → {s.production!.rhs.join(' ')}</span>}
                {s.type === 'SHIFT' && <span className="mono"> {s.lookahead}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ParseStage({ chapter, stage, model, a }: { chapter: Chapter; stage: Stage; model: OppModel; a: OkGrammar }) {
  const { run, parseDraft, setParseDraft, parseReq, parse, setMode, strings, parseDirty } = model;
  const steps = run?.steps ?? NONE;
  const markers = useMemo(() => { let k = 0; return steps.flatMap((s, i) => (s.type === 'REDUCE' ? [{ at: i + 1, label: `reduce ${++k}` }] : [])); }, [steps]);
  const replay = useReplay(steps, { markers });
  const [tab, setTab] = useState<'trace' | 'table'>('trace');
  const finalCells = useMemo(() => tableAt(a.table.steps, a.table.steps.length), [a]);
  const { step, count } = replay;
  const lookup = step && step.top && step.lookahead && !(step.top === '$' && step.lookahead === '$') ? { left: step.top, right: step.lookahead } : null;
  const finished = count === steps.length && steps.length > 0;

  const controls = (
    <form className="controls" onSubmit={(e) => { e.preventDefault(); parse(parseDraft, parseReq.mode); }}>
      <label className="field">
        <span className="label">Input string</span>
        <input type="text" className="field__input" value={parseDraft} spellCheck={false} autoComplete="off" autoCapitalize="off"
          onChange={(e) => setParseDraft(e.target.value)} placeholder="id + id * id" />
      </label>
      <button type="submit" className="btn btn--primary">Parse</button>
      <ModeSwitch mode={parseReq.mode} onChange={setMode} name="parse-mode" />
      {strings.length > 0 && (
        <div className="chips" role="group" aria-label="Example strings">
          {strings.map((s) => (
            <button key={s} type="button" className={cx('chip', s === parseReq.input && 'is-on')} aria-pressed={s === parseReq.input} onClick={() => parse(s, parseReq.mode)}>{s}</button>
          ))}
        </div>
      )}
      {parseDirty && <DirtyHint shown={parseReq.input} action="Parse" what="string" />}
    </form>
  );

  if (!run || steps.length === 0)
    return (
      <Plate chapter={chapter} stage={stage} controls={controls}>
        <div className="figure figure--center">
          <Verdict result="REJECT" reason={`${run?.reason ?? 'Nothing to parse.'} This grammar's terminals are: ${a.grammar.terminals.join('  ')}`} />
        </div>
      </Plate>
    );

  return (
    <Plate chapter={chapter} stage={stage} controls={controls}
      aside={finished ? <Tag kind={run.result === 'ACCEPT' ? 'accept' : 'reject'}>{run.result === 'ACCEPT' ? 'Accepted' : 'Rejected'}</Tag> : null}
      dock={<Dock replay={replay} label="Parse" next={nextStageOf(chapter, stage)} />}>
      <div className="split split--figure">
        <div className="figure figure--bench">
          <Bench step={step} tokens={run.tokens} mode={parseReq.mode} fx={replay.animate ? (replay.rich ? 'rich' : 'fast') : null} />
        </div>
        <aside className="inspector inspector--tabs">
          <div className="tabs" role="tablist" aria-label="Parse views">
            {([['trace', 'Trace'], ['table', 'Table lookup']] as const).map(([id, text]) => (
              <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
                className={cx('tabs__tab', tab === id && 'is-on')} onClick={() => setTab(id)}>{text}</button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabs__panel">
            {tab === 'trace'
              ? <TraceTable steps={steps} tokens={run.tokens} count={count} onJump={replay.api.goto} />
              : (
                <div className="lookup">
                  <PrecTable axes={a.table.axes} cells={finalCells} read={lookup} idPrefix="parse" compact caption="Finished precedence table. The cell this step reads is outlined." />
                  <p className="help">{lookup
                    ? <>This step reads row <b className="mono">{lookup.left}</b>, column <b className="mono">{lookup.right}</b>{finalCells.get(cellKey(lookup.left, lookup.right)) ? ' (dashed outline).' : ': blank, so the string is rejected.'}</>
                    : 'Each step reads one cell: row = topmost stack terminal, column = lookahead.'}</p>
                </div>
              )}
          </div>
        </aside>
      </div>
    </Plate>
  );
}
