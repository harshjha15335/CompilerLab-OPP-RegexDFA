import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, Stage } from '../../data/nav.ts';
import type { RelationStep, TableStep } from '../../core/index.ts';
import type { OkGrammar } from '../../replay/pipelines.ts';
import { cellKey, conflictsOf, phaseMarkers, tableAt, type Cell } from '../../replay/selectors.ts';
import { useReplay } from '../../replay/useReplay.ts';
import { all, beam, morph, nudge, pop } from '../../motion/fx.ts';
import { Dock } from '../../ui/hardware.tsx';
import { Production, Rel, Row, SetText, Tag, Tx } from '../../ui/kit.tsx';
import { nextStageOf, Plate, StepNote, useStepFx } from '../../ui/plate.tsx';
import { PrecTable, RelationLegend, type CellMark } from './PrecTable.tsx';

export const REL_RULES: Record<string, string> = {
  R1: '… a b …  gives  a ≐ b',
  R2: '… a B b …  gives  a ≐ b',
  R3: '… a B …  gives  a ⋖ each terminal in LEADING(B)',
  R4: '… B b …  gives  each terminal in TRAILING(B) ⋗ b',
  R5: '$ ⋖ each terminal in LEADING(S), the start symbol',
  R6: 'each terminal in TRAILING(S) ⋗ $',
};

/** Which LEADING/TRAILING entry a relation came from (R3–R6), so provenance can show it. */
export function viaSet(s: { rule: string; nonTerminal: string | null }) {
  if (!s.nonTerminal || s.rule === 'R2') return null;
  return { kind: s.rule === 'R3' || s.rule === 'R5' ? 'LEADING' as const : 'TRAILING' as const, nt: s.nonTerminal };
}

/** Provenance: the rule, production and LEADING/TRAILING entry behind every relation in a cell. */
export function Provenance({ cell, a, idPrefix, onClose, onJump, takeFocus }:
  { cell: Cell; a: OkGrammar; idPrefix: string; onClose: () => void; onJump?: (step: number) => void; takeFocus?: boolean }) {
  const close = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  // focus moves into the sheet only when the user opened it, never during playback
  useEffect(() => { if (takeFocus) close.current?.focus({ preventScroll: true }); }, [cell.left, cell.right, takeFocus]);
  // the sheet grows out of the cell that was clicked (shared-element morph, once, on open)
  useLayoutEffect(() => {
    if (!takeFocus) return undefined;
    return morph(sheet.current, document.querySelector(`[data-table="${idPrefix}"][data-cell="${CSS.escape(cell.left)} ${CSS.escape(cell.right)}"]`));
  }, [cell.left, cell.right, idPrefix, takeFocus]);
  return (
    <section ref={sheet} className="sheet sheet--prov" aria-label={`Where cell ${cell.left}, ${cell.right} came from`}>
      <header className="sheet__head">
        <h2 className="section-title">Cell <span className="mono">({cell.left}, {cell.right})</span></h2>
        {cell.conflict && <Tag kind="conflict">Conflict: {cell.relations.length} relations</Tag>}
        <button ref={close} type="button" className="btn btn--quiet" onClick={onClose}>Close</button>
      </header>
      <ol className="provlist">
        {cell.sources.map((s) => {
          const p = a.grammar.productions.find((x) => x.id === s.productionId);
          const v = viaSet(s);
          const set = v ? (v.kind === 'LEADING' ? a.leading.sets : a.trailing.sets)[v.nt] : null;
          return (
            <li key={s.step}>
              {onJump ? <button type="button" className="linkbtn" onClick={() => onJump(s.step)}>Step {s.step}</button> : <span className="provlist__step">Step {s.step}</span>}
              <div>
                <p className="provlist__rel"><span className="mono">{cell.left}</span> <Rel r={s.relation} /> <span className="mono">{cell.right}</span> by rule {s.rule}{!s.changed && <em>, again (no conflict)</em>}</p>
                <p className="provlist__src">{p ? <>from <Production p={p} /></> : <>from the end marker around the start symbol <span className="mono">{a.grammar.start}</span></>}</p>
                {v && set && <p className="provlist__src">using <span className="mono">{v.kind}({v.nt}) = </span><SetText items={set} /></p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function TableStage({ chapter, stage, a }: { chapter: Chapter; stage: Stage; a: OkGrammar }) {
  const { grammar, table, leading, trailing } = a;
  const steps = table.steps;
  const markers = useMemo(() => phaseMarkers<TableStep>(steps,
    (s) => (s.type === 'VERDICT' ? 'verdict' : s.productionId ?? '$'),
    (s) => (s.type === 'VERDICT' ? 'verdict' : s.productionId ? `P${s.productionId}` : '$ rules')), [steps]);
  const replay = useReplay(steps, { markers });
  const { count, step } = replay;
  const [selected, setSelected] = useState<CellMark | null>(null);
  const [dismissedAt, setDismissedAt] = useState(-1);
  const onSelect = useCallback((c: CellMark) => setSelected((s) => (s && s.left === c.left && s.right === c.right ? null : c)), []);
  const cells = useMemo(() => tableAt(steps, count), [steps, count]);
  const conflicts = conflictsOf(cells);
  const add: RelationStep | null = step?.type === 'ADD_RELATION' ? step : null;
  const prod = add ? grammar.productions.find((p) => p.id === add.productionId) ?? null : null;
  const kind = add ? (add.conflict && add.changed ? 'conflict' : add.changed ? 'new' : 'dup') : null;
  const v = add ? viaSet(add) : null;
  // A step that creates a conflict shows that cell's provenance, so both derivations are on screen
  // at once. Derived from the step (not stored), so stepping Back closes it again.
  const shown: CellMark | null = selected ?? (kind === 'conflict' && add && dismissedAt !== count ? { left: add.left, right: add.right } : null);
  const selectedCell = shown ? cells.get(cellKey(shown.left, shown.right)) ?? null : null;
  const body = useRef<HTMLDivElement>(null);

  useStepFx(replay, ({ step: s, rich }) => {
    if (s.type !== 'ADD_RELATION' || (s.conflict && s.changed)) return undefined;     // conflicts are instant and structural
    const root = body.current;
    const cell = root?.querySelector('.ptable .pcell.is-changed');
    const glyphs = cell?.querySelectorAll('.rel');
    const glyph = glyphs?.[glyphs.length - 1];
    if (!s.changed) return nudge(glyph);
    if (!rich) return pop(glyph);
    // cause first (the production or set entry it came from), then the value
    return all(beam(root?.querySelector('[data-cause]'), cell, { duration: 300 }), pop(glyph, { delay: 260 }));
  });

  return (
    <Plate chapter={chapter} stage={stage}
      aside={conflicts.length ? <Tag kind="conflict">{conflicts.length === 1 ? '1 conflicting cell' : `${conflicts.length} conflicting cells`}</Tag>
        : count === steps.length ? <Tag kind="accept">Conflict-free</Tag> : null}
      dock={<Dock replay={replay} label="Precedence table" next={a.conflictFree ? nextStageOf(chapter, stage) : null} />}>
      <div className="split split--figure" ref={body}>
        <div className="figure figure--table">
          <PrecTable axes={table.axes} cells={cells} changed={add ? { left: add.left, right: add.right } : null} changeKind={kind}
            selected={shown} onSelect={onSelect}
            loupe={kind !== 'conflict'} idPrefix="tbl" caption="Precedence relations. Row: topmost terminal on the stack. Column: lookahead terminal." />
          <RelationLegend />
          {conflicts.length > 0 && (
            <p className="conflict-note" role="status">
              <Tag kind="conflict">Conflict</Tag>
              {conflicts.map((c) => `(${c.left}, ${c.right})`).join(', ')} {conflicts.length === 1 ? 'holds' : 'each hold'} two relations.
              A parser reaching {conflicts.length === 1 ? 'that cell' : 'those cells'} could not choose between shift and reduce, so this grammar has no precedence parser.
            </p>
          )}
        </div>
        <aside className="inspector">
          {selectedCell && <Provenance key={cellKey(selectedCell.left, selectedCell.right)} cell={selectedCell} a={a} idPrefix="tbl"
            takeFocus={selected !== null} onClose={() => { setSelected(null); setDismissedAt(count); }} onJump={replay.api.goto} />}
          {shown && !selectedCell && (
            <section className="sheet"><header className="sheet__head"><h2 className="section-title">Cell <span className="mono">({shown.left}, {shown.right})</span></h2>
              <button type="button" className="btn btn--quiet" onClick={() => { setSelected(null); setDismissedAt(count); }}>Close</button></header>
              <p>Still blank at this step. A blank cell means the parser reports an error if it ever needs it.</p></section>
          )}
          <StepNote replay={replay} idle="The table starts blank. Each step writes one relation. Click any filled cell to see where it came from.">
            {add && (
              <>
                <p className="note__headline note__rel">
                  <span className="mono">{add.left}</span><Rel r={add.relation} /><span className="mono">{add.right}</span>
                  <Tag kind={kind === 'conflict' ? 'conflict' : kind === 'new' ? 'new' : 'dup'}>{kind === 'conflict' ? 'Conflict' : kind === 'new' ? 'New' : 'Already there'}</Tag>
                </p>
                {kind === 'conflict'
                  ? <p className="note__warn">Cell ({add.left}, {add.right}) now holds {cells.get(cellKey(add.left, add.right))?.relations.length} different relations. The parser could not choose between shift and reduce here.</p>
                  : <p><Tx>{add.message}</Tx></p>}
                <Row label="From">
                  <span data-cause={v ? undefined : ''}>{prod ? <><span className="mono">{prod.id}.</span> <Production p={prod} active /></> : <>the end marker <span className="mono">$</span> around <span className="mono">{grammar.start}</span></>}</span>
                </Row>
                {v && (
                  <Row label="Using">
                    <span data-cause=""><span className="mono">{v.kind}({v.nt}) = </span><SetText items={(v.kind === 'LEADING' ? leading : trailing).sets[v.nt]} /></span>
                  </Row>
                )}
                <Row label={`Rule ${add.rule}`}><span className="mono"><Tx>{REL_RULES[add.rule]}</Tx></span></Row>
                {kind === 'dup' && <p className="note__aside">The cell already held this relation. Writing it again is not a conflict.</p>}
              </>
            )}
            {step?.type === 'VERDICT' && (
              <>
                <p className="note__headline">{step.ok ? 'An operator-precedence grammar' : 'Not an operator-precedence grammar'}{' '}
                  <Tag kind={step.ok ? 'accept' : 'conflict'}>{step.ok ? 'Conflict-free' : 'Conflict'}</Tag></p>
                <p><Tx>{step.message}</Tx></p>
              </>
            )}
          </StepNote>
        </aside>
      </div>
    </Plate>
  );
}
