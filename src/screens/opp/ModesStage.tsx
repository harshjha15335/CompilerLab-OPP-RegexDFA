import { useMemo, useState } from 'react';
import type { Chapter, Stage } from '../../data/nav.ts';
import { MODES_SAMPLE } from '../../data/samples.ts';
import type { ParseStep } from '../../core/index.ts';
import type { OppModel } from '../../models.ts';
import { safeguardedRejection } from '../../replay/selectors.ts';
import { useReplay } from '../../replay/useReplay.ts';
import { Dock } from '../../ui/hardware.tsx';
import { cx, Empty, Production, Tag } from '../../ui/kit.tsx';
import { Plate } from '../../ui/plate.tsx';
import { Bench } from './Bench.tsx';

interface Pair { classic: ParseStep | null; safeguarded: ParseStep | null; message: string }
const NONE: Pair[] = [];
const Result = ({ r }: { r: 'ACCEPT' | 'REJECT' }) => <Tag kind={r === 'ACCEPT' ? 'accept' : 'reject'}>{r === 'ACCEPT' ? 'Accepts' : 'Rejects'}</Tag>;

export function ModesStage({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: OppModel }) {
  const { cmp, cmpInput, setCmpInput, cmpRows, cmpAnalysis, cmpText, compareWith, committed, ok } = model;
  const [draft, setDraft] = useState(cmpInput);
  // pair the two existing step lists by step number; nothing is recomputed
  const steps = useMemo<Pair[]>(() => {
    if (!cmp) return NONE;
    const n = Math.max(cmp.classic.steps.length, cmp.safeguarded.steps.length);
    return Array.from({ length: n }, (_, i) => {
      const c = cmp.classic.steps[i] ?? null, s = cmp.safeguarded.steps[i] ?? null;
      return { classic: c, safeguarded: s, message: `Classic N: ${c?.message ?? 'finished'}  Safeguarded: ${s?.message ?? 'finished'}` };
    });
  }, [cmp]);
  const markers = useMemo(() => {
    if (!cmp) return [];
    const m = [];
    if (cmp.firstStateDivergence) m.push({ at: cmp.firstStateDivergence, label: 'stacks differ' });
    if (cmp.firstDecisionDivergence && cmp.firstDecisionDivergence !== cmp.firstStateDivergence) m.push({ at: cmp.firstDecisionDivergence, label: 'decisions differ' });
    return m;
  }, [cmp]);
  const replay = useReplay(steps, { markers, active: Boolean(cmp) });
  const usingOwn = cmpText !== MODES_SAMPLE.text;
  const grammar = cmpAnalysis.grammar;

  const controls = (
    <form className="controls" onSubmit={(e) => { e.preventDefault(); setCmpInput(draft); }}>
      <div className="controls__grammar" aria-label="Grammar being compared">
        <span className="label">Grammar</span>
        <span className="inline-prods">{grammar.productions.map((p) => <Production key={p.id} p={p} />)}</span>
      </div>
      <label className="field">
        <span className="label">String</span>
        <input type="text" className="field__input" value={draft} spellCheck={false} autoComplete="off" autoCapitalize="off" onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button type="submit" className="btn btn--primary">Compare</button>
      {usingOwn
        ? <button type="button" className="btn btn--quiet" onClick={() => { setDraft(MODES_SAMPLE.compare!); compareWith(MODES_SAMPLE.text, MODES_SAMPLE.compare!); }}>Back to S → A + B</button>
        : ok?.conflictFree && committed !== MODES_SAMPLE.text && <button type="button" className="btn btn--quiet" onClick={() => { const s = ok.grammar.terminals.join(' '); setDraft(s); compareWith(committed, s); }}>Use the grammar from stage 1</button>}
    </form>
  );

  if (!cmp)
    return (
      <Plate chapter={chapter} stage={stage} controls={controls}>
        <Empty title="This grammar cannot be compared.">It needs a conflict-free precedence table. Go back to S → A + B, or fix the grammar in stage 1.</Empty>
      </Plate>
    );

  const { count, step } = replay;
  const rej = safeguardedRejection(cmp);
  const side = (k: 'classic' | 'safeguarded') => { const list = cmp[k].steps; return count === 0 ? null : list[Math.min(count, list.length) - 1] ?? null; };
  const rows = cmpRows.some((r) => r.input === cmp.input) ? cmpRows : [...cmpRows, cmp];

  return (
    <Plate chapter={chapter} stage={stage} controls={controls}
      aside={<Tag kind={cmp.differ ? 'conflict' : 'plain'}>{cmp.differ ? 'The modes disagree' : 'The modes agree'}</Tag>}
      dock={<Dock replay={replay} label="Mode comparison" />}>
      <div className="split split--figure">
        <div className="figure figure--duo">
          {(['classic', 'safeguarded'] as const).map((k) => (
            <section key={k} className={cx('duo', `duo--${k}`)} aria-label={k === 'classic' ? 'Classic N' : 'Safeguarded'}>
              <Bench compact title={<>{k === 'classic' ? 'Classic N' : 'Safeguarded'} <Result r={cmp[k].result} /></>} mode={k} tokens={cmp.tokens}
                fx={replay.animate && count <= cmp[k].steps.length ? (replay.rich ? 'rich' : 'fast') : null}
                step={side(k)} finished={count > cmp[k].steps.length || Boolean(step && !step[k] && count > 0)} />
            </section>
          ))}
        </div>
        <aside className="inspector">
          <section className="block">
            <h2 className="section-title">Why they can disagree</h2>
            <p><b>Classic N</b> forgets which non-terminal a reduction produced: every reduced handle becomes the same <span className="mono">N</span>.</p>
            <p><b>Safeguarded</b> keeps the set of non-terminals each reduced item could be, so it only accepts reductions the grammar allows.</p>
          </section>
          {cmp.differ && rej && (
            <section className="block block--alert" role="status">
              <h2 className="section-title">Where Safeguarded stops</h2>
              <p>At <button type="button" className="linkbtn" onClick={() => replay.api.goto(rej.step)}>step {rej.step}</button>
                {rej.atReduction && rej.handle
                  ? <>, the handle <b className="mono">{rej.handle.symbols.map((h) => h.symbol).join(' ')}</b> matches no production with those non-terminals.
                    {!usingOwn && rej.handle.symbols.map((h) => h.symbol).join(' ') === '{B} + {A}'
                      ? <> <span className="mono">S → A + B</span> needs A on the left and B on the right, but this stack has them the other way round.</> : null}
                    {' '}Classic N sees only <span className="mono">N</span> in every non-terminal position, so it reduces anyway{cmp.classic.result === 'ACCEPT' ? ' and accepts a string the grammar does not generate' : ''}.</>
                  : <>: {rej.reason}</>}</p>
            </section>
          )}
          <table className="cmptable">
            <caption className="label">Example strings for this grammar</caption>
            <thead><tr><th scope="col">String</th><th scope="col">Classic N</th><th scope="col">Safeguarded</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.input} className={cx(r.input === cmp.input && 'is-current', r.differ && 'is-differ')}>
                  <th scope="row"><button type="button" className="linkbtn mono" onClick={() => { setDraft(r.input); setCmpInput(r.input); }} aria-pressed={r.input === cmp.input}>{r.input || '(empty)'}</button></th>
                  <td><Result r={r.classic.result} /></td>
                  <td><Result r={r.safeguarded.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>
      </div>
    </Plate>
  );
}
