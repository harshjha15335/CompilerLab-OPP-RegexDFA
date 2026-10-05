import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useReplay } from '../../replay/useReplay.js';
import { cellKey, conflictsOf, phaseMarkers, tableAt } from '../../replay/selectors.js';
import { cx, NoteRow, PlateHead, Production, Rel, SetText, StepNote, Tag, Tx } from '../common/common.jsx';
import { StepPlayer } from '../StepPlayer/StepPlayer.jsx';
import { PrecedenceTable, RelationLegend } from './PrecedenceTable.jsx';
import { all, beam, DUR, EASE, emphasize, pop, useStepEffect } from '../../motion/effects.js';

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
            <b> ({c.relations.length} relations)</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CellProvenance({ cell, grammar, onClose, onJump }) {
  return (
    <motion.section className="inspect" aria-label="Cell provenance" key={`${cell.left} ${cell.right}`}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: DUR.algorithm, ease: EASE }}>
      <header>
        <h3 className="label">Provenance · cell (<span className="mono">{cell.left}</span>, <span className="mono">{cell.right}</span>)</h3>
        <button type="button" className="linkbtn" onClick={onClose}>Close</button>
      </header>
      {cell.conflict && <p><Tag kind="conflict">CONFLICT: {cell.relations.length} RELATIONS</Tag></p>}
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
                {!s.changed && <em> Same relation again, so no conflict.</em>}
              </span>
            </li>
          );
        })}
      </ol>
    </motion.section>
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
  const body = useRef(null);
  // A new conflict opens its own provenance, so both derivations are on screen at once.
  useEffect(() => { if (replay.forward && step?.conflict && step.changed) setSelected({ left: step.left, right: step.right }); }, [replay.forward, step]);
  useStepEffect(replay, ({ step: s, rich }) => {
    if (s.type !== 'ADD_RELATION') return undefined;
    const root = body.current;
    const cell = root?.querySelector('.pcell.is-active');
    const glyphs = cell?.querySelectorAll('.rel');
    const glyph = glyphs?.[glyphs.length - 1];
    if (!s.changed) return emphasize(glyph);                       // same relation again: nothing is inserted
    if (!rich) return pop(glyph);
    const wait = 0.34;                                             // cause first, then the value
    return all(beam(root, { from: '[data-cause]', to: cell, duration: wait }), pop(glyph, { delay: wait - 0.04 }));
  });

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Precedence relation table"
        aside={conflicts.length ? <Tag kind="conflict">{conflicts.length} CONFLICT {conflicts.length === 1 ? 'CELL' : 'CELLS'}</Tag> : null}>
        Two different relations in one cell is a conflict. The same relation twice is not.
      </PlateHead>
      <div className="plate__body cols cols--table" ref={body}>
        <section className="pane pane--table">
          <PrecedenceTable axes={table.axes} cells={cells} active={isAdd ? { left: step.left, right: step.right } : null}
            activeState={activeState} selected={selected} onSelect={setSelected} />
          <RelationLegend />
          <ConflictRoll conflicts={conflicts} onSelect={setSelected} />
        </section>

        <section className="pane pane--note">
          <StepNote replay={replay} idle="The table starts blank. Each step inserts one relation. Select a filled cell to see where it came from.">
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
                  <span data-cause={viaSet ? undefined : ''}>{prod ? <><span className="mono">{prod.id}.</span> <Production p={prod} active /></> : <span>the end marker <span className="mono">$</span> around the start symbol {grammar.start}</span>}</span>
                </NoteRow>
                <NoteRow label="Because"><Tx>{step.explanation}</Tx></NoteRow>
                {viaSet && (
                  <NoteRow label="Source set">
                    <span data-cause=""><span className="mono">{viaSet.kind}({viaSet.nt}) = </span>
                    <SetText items={(viaSet.kind === 'LEADING' ? leading : trailing).sets[viaSet.nt]} /></span>
                  </NoteRow>
                )}
                <NoteRow label={`Rule ${step.rule}`}><span className="mono"><Tx>{REL_RULES[step.rule]}</Tx></span></NoteRow>
                {activeState === 'dup' && <p className="note__aside">The cell already held this relation. That is not a conflict.</p>}
                {activeState === 'conflict' && <p className="note__aside note__aside--conflict">The cell now holds {cells.get(cellKey(step.left, step.right))?.relations.length} different relations, so the parser cannot choose between shift and reduce here.</p>}
              </>
            )}
            {step?.type === 'VERDICT' && (
              <>
                <p className={cx('note__verdict', step.ok ? 'is-ok' : 'is-bad')}>
                  {step.ok ? 'OPERATOR-PRECEDENCE GRAMMAR' : 'NOT AN OPERATOR-PRECEDENCE GRAMMAR'}
                </p>
                <p><Tx>{step.message}</Tx></p>
                
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
