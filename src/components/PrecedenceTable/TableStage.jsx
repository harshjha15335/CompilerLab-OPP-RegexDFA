import { useMemo, useState } from 'react';
import { useReplay } from '../../replay/useReplay.js';
import { cellKey, conflictsOf, phaseMarkers, tableAt } from '../../replay/selectors.js';
import { cx, NoteRow, PlateHead, Production, Rel, SetText, StepNote, Tag, Tx } from '../common/common.jsx';
import { StepPlayer } from '../StepPlayer/StepPlayer.jsx';
import { PrecedenceTable, RelationLegend } from './PrecedenceTable.jsx';

export const REL_RULES = {
  R1: '… a b …  ⟹  a ≐ b',
  R2: '… a B b …  ⟹  a ≐ b',
  R3: '… a B …  ⟹  a ⋖ every terminal in LEADING(B)',
  R4: '… B b …  ⟹  every terminal in TRAILING(B) ⋗ b',
  R5: '$ ⋖ every terminal in LEADING(S),  S = start symbol',
  R6: 'every terminal in TRAILING(S) ⋗ $,  S = start symbol',
};

function ConflictRoll({ conflicts, onSelect }) {
  if (!conflicts.length) return null;
  return (
    <section className="conflicts" aria-label="Conflicting cells">
      <p className="conflicts__head"><Tag kind="conflict">CONFLICT</Tag> This table is not conflict-free.</p>
      <ul>
        {conflicts.map((c) => (
          <li key={cellKey(c.left, c.right)}>
            <button type="button" className="linkbtn" onClick={() => onSelect({ left: c.left, right: c.right })}>
              Cell ({c.left}, {c.right})
            </button>
            <span> contains more than one precedence relation: </span>
            <span className="conflicts__rels">{c.relations.map((r, i) => <span key={r}>{i > 0 && ' / '}<Rel r={r} /></span>)}</span>
            <b> — {c.relations.length} RELATIONS</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CellProvenance({ cell, grammar, onClose, onJump }) {
  return (
    <section className="inspect" aria-label="Cell provenance">
      <header>
        <h3 className="label">Provenance · cell (<span className="mono">{cell.left}</span>, <span className="mono">{cell.right}</span>)</h3>
        <button type="button" className="linkbtn" onClick={onClose}>Close</button>
      </header>
      {cell.conflict && <p><Tag kind="conflict">CONFLICT — {cell.relations.length} RELATIONS</Tag> Distinct relations were derived for this cell.</p>}
      <ol className="provlist provlist--cell">
        {cell.sources.map((s) => {
          const p = grammar.productions.find((x) => x.id === s.productionId);
          return (
            <li key={s.step}>
              <button type="button" className="linkbtn" onClick={() => onJump(s.step)}>Step {s.step}</button>
              <span>
                <span className="mono">{cell.left}</span> <Rel r={s.relation} /> <span className="mono">{cell.right}</span>
                {' '}by {s.rule}{p ? <> from <Production p={p} /></> : ' (end-marker rule)'}
                <br />because <Tx>{s.explanation}</Tx>.
                {!s.changed && <em> Same relation again — not a conflict.</em>}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function TableStage({ model, stage }) {
  const { grammar, table, leading, trailing } = model.analysis;
  const steps = table.steps;
  const markers = useMemo(() => phaseMarkers(steps,
    (s) => (s.type === 'VERDICT' ? 'verdict' : s.productionId ?? '$'),
    (s) => (s.type === 'VERDICT' ? 'verdict' : s.productionId ? `P${s.productionId}` : '$ rules')), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [selected, setSelected] = useState(null);
  const cells = useMemo(() => tableAt(steps, count), [steps, count]);
  const conflicts = conflictsOf(cells);
  const isAdd = step?.type === 'ADD_RELATION';
  const prod = isAdd ? grammar.productions.find((p) => p.id === step.productionId) : null;
  const activeState = isAdd ? (step.conflict ? 'conflict' : step.changed ? 'new' : 'dup') : null;
  const selectedCell = selected ? cells.get(cellKey(selected.left, selected.right)) : null;
  const viaSet = isAdd && step.nonTerminal && step.rule !== 'R2'
    ? { kind: step.rule === 'R3' || step.rule === 'R5' ? 'LEADING' : 'TRAILING', nt: step.nonTerminal } : null;

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Precedence relation table"
        aside={conflicts.length ? <Tag kind="conflict">{conflicts.length} CONFLICT {conflicts.length === 1 ? 'CELL' : 'CELLS'}</Tag> : <Tag kind="plain">{cells.size} cells filled</Tag>}>
        One relation is inserted per step. A cell that receives two different relations is a conflict; the same relation twice is not.
      </PlateHead>
      <div className="plate__body cols cols--table">
        <section className="pane pane--table">
          <PrecedenceTable axes={table.axes} cells={cells} active={isAdd ? { left: step.left, right: step.right } : null}
            activeState={activeState} selected={selected} onSelect={setSelected} />
          <RelationLegend />
          <ConflictRoll conflicts={conflicts} onSelect={setSelected} />
        </section>

        <section className="pane pane--note">
          <StepNote replay={replay} idle="The table starts blank. Each step reads one production (or an end-marker rule) and inserts one relation. Select any filled cell to see where it came from.">
            {isAdd && (
              <>
                <p className="note__relation">
                  <span className="mono">{step.left}</span><Rel r={step.relation} /><span className="mono">{step.right}</span>
                  <Tag kind={activeState === 'conflict' ? 'conflict' : activeState === 'new' ? 'new' : 'plain'}>
                    {activeState === 'conflict' ? 'CONFLICT' : activeState === 'new' ? 'NEW' : 'ALREADY PRESENT'}
                  </Tag>
                </p>
                <p><Tx>{step.message}</Tx></p>
                <NoteRow label="Derived from">
                  {prod ? <><span className="mono">{prod.id}.</span> <Production p={prod} active /></> : <span>the end marker <span className="mono">$</span> around the start symbol {grammar.start}</span>}
                </NoteRow>
                <NoteRow label="Because"><Tx>{step.explanation}</Tx></NoteRow>
                {viaSet && (
                  <NoteRow label="Source set">
                    <span className="mono">{viaSet.kind}({viaSet.nt}) = </span>
                    <SetText items={(viaSet.kind === 'LEADING' ? leading : trailing).sets[viaSet.nt]} />
                  </NoteRow>
                )}
                <NoteRow label={`Rule ${step.rule}`}><span className="mono"><Tx>{REL_RULES[step.rule]}</Tx></span></NoteRow>
                {activeState === 'dup' && <p className="note__aside">The cell already held this relation. Several rules may derive the same relation; that is not a conflict.</p>}
                {activeState === 'conflict' && <p className="note__aside note__aside--conflict">The cell now holds {cells.get(cellKey(step.left, step.right))?.relations.length} distinct relations. The parser could not decide between shift and reduce here.</p>}
              </>
            )}
            {step?.type === 'VERDICT' && (
              <>
                <p className={cx('note__verdict', step.ok ? 'is-ok' : 'is-bad')}>
                  {step.ok ? 'OPERATOR-PRECEDENCE GRAMMAR' : 'NOT AN OPERATOR-PRECEDENCE GRAMMAR'}
                </p>
                <p><Tx>{step.message}</Tx></p>
                {!step.ok && <p className="note__aside">Construction was not stopped at the first conflict, so every conflicting cell can be inspected.</p>}
              </>
            )}
          </StepNote>
          {selectedCell && <CellProvenance cell={selectedCell} grammar={grammar} onClose={() => setSelected(null)} onJump={replay.api.goto} />}
          {selected && !selectedCell && (
            <section className="inspect"><header><h3 className="label">Provenance</h3>
              <button type="button" className="linkbtn" onClick={() => setSelected(null)}>Close</button></header>
              <p>Cell ({selected.left}, {selected.right}) is still blank at this step.</p></section>
          )}
        </section>
      </div>
      <StepPlayer replay={replay} label="Precedence table" />
    </div>
  );
}
