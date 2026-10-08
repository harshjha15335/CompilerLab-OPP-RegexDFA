import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cellKey } from '../../replay/selectors.ts';
import { useReplay, useSettings } from '../../replay/useReplay.ts';
import { all, beam, nudge, pop } from '../../motion/fx.ts';
import { Icons, Keycap } from '../../ui/hardware.tsx';
import { cx, Production, Rel, Verdict, Tx } from '../../ui/kit.tsx';
import { useStepFx } from '../../ui/plate.tsx';
import { PrecTable, type CellMark } from '../opp/PrecTable.tsx';
import { Provenance } from '../opp/TableStage.tsx';
import { specimenTable, SPECIMEN_STRING, type Frame, type Specimen as Spec } from './specimen.ts';

const TABLE_MS = 700, PARSE_MS = 900, HOLD_MS = 2600;

/** The live specimen: the real precedence table builds itself, then a parser uses it, in a loop.
 *  It pauses when focus enters it or the tab is hidden, and never autoplays under reduced motion. */
export function Specimen({ spec, mode, onUse }: {
  spec: Spec;
  /** live: loops. static: fully built and accepted, with a Replay keycap. */
  mode: 'live' | 'static';
  onUse: () => void;
}) {
  const { speed } = useSettings();
  const total = spec.frames.length;
  const replay = useReplay<Frame>(spec.frames);
  const { count, step, api } = replay;
  const [auto, setAuto] = useState(mode === 'live');
  const [picked, setPicked] = useState<CellMark | null>(null);
  const root = useRef<HTMLElement>(null);
  const onSelect = useCallback((c: CellMark) => { setAuto(false); setPicked((p) => (p && p.left === c.left && p.right === c.right ? null : c)); }, []);

  // initial position: the static specimen shows the finished table
  useEffect(() => {
    if (mode === 'static') { setAuto(false); api.goto(total); }
    if (mode === 'live') setAuto(true);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // the loop: table, parse, hold on ACCEPT, start again
  useEffect(() => {
    if (!auto) return undefined;
    const atEnd = count >= total;
    const wait = atEnd ? HOLD_MS : (count < spec.tableFrames ? TABLE_MS : PARSE_MS) / speed;
    const t = setTimeout(() => (atEnd ? api.goto(0) : api.next()), wait);
    return () => clearTimeout(t);
  }, [auto, mode, count, total, speed, spec.tableFrames, api]);

  // stop when hidden; stop when the user takes over with the keyboard
  useEffect(() => {
    const onVis = () => { if (document.hidden) setAuto(false); };
    const onKey = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) setAuto(false); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('keydown', onKey); };
  }, []);

  const cells = useMemo(() => specimenTable(spec, count), [spec, count]);
  const rel = step?.kind === 'relation' ? step.step : null;
  const ps = step?.kind === 'parse' ? step.step : null;
  const changed = rel ? { left: rel.left, right: rel.right } : null;
  const read = ps && ps.top && ps.lookahead && !(ps.top === '$' && ps.lookahead === '$') ? { left: ps.top, right: ps.lookahead } : null;
  const prod = rel ? spec.a.grammar.productions.find((p) => p.id === rel.productionId) : null;
  const pickedCell = picked ? cells.get(cellKey(picked.left, picked.right)) ?? null : null;
  const tokens = SPECIMEN_STRING.split(' ');
  const pointer = ps ? (ps.type === 'SHIFT' ? ps.pointer - 1 : ps.pointer) : 0;
  const done = count >= total;

  useStepFx(replay, ({ step: f, rich }) => {
    if (f.kind !== 'relation') return undefined;
    const r = root.current;
    const cell = r?.querySelector('.ptable .pcell.is-changed');
    const glyphs = cell?.querySelectorAll('.rel');
    const glyph = glyphs?.[glyphs.length - 1];
    if (!f.step.changed) return nudge(glyph);
    return rich ? all(beam(r?.querySelector('.specimen__grammar li.is-active .prod'), cell, { duration: 280 }), pop(glyph, { delay: 240 })) : pop(glyph);
  });

  const playing = auto;
  const toggle = () => {
    if (!playing && done) api.goto(0);
    setAuto(!playing);
  };
  const keyLabel = playing ? 'Pause' : done ? 'Replay' : 'Play';

  return (
    <section ref={root} className="specimen" aria-labelledby="specimen-title"
      onFocusCapture={(e) => { if ((e.target as HTMLElement).closest('.specimen__table')) setAuto(false); }}>
      <header className="specimen__head">
        <h2 className="label" id="specimen-title">Live specimen</h2>
        <span className="specimen__state">{playing ? 'Running the real algorithm' : done ? 'Finished' : 'Paused'}</span>
      </header>
      <ol className="specimen__grammar" aria-label="Grammar">
        {spec.a.grammar.productions.reduce<{ lhs: string; ids: number[] }[]>((acc, p) => {
          const last = acc.at(-1);
          if (last && last.lhs === p.lhs) last.ids.push(p.id); else acc.push({ lhs: p.lhs, ids: [p.id] });
          return acc;
        }, []).map((g) => (
          <li key={g.lhs} className={cx(prod && g.ids.includes(prod.id) && 'is-active')}>
            {g.ids.map((id, i) => {
              const p = spec.a.grammar.productions.find((x) => x.id === id)!;
              return i === 0 ? <Production key={id} p={p} active={prod?.id === id} />
                : <span key={id} className={cx('specimen__alt', prod?.id === id && 'is-active')}><span aria-hidden="true">|</span> {p.rhs.join(' ')}</span>;
            })}
          </li>
        ))}
      </ol>
      <div className="specimen__table">
        <PrecTable axes={spec.a.table.axes} cells={cells} changed={changed} changeKind={rel ? (rel.changed ? 'new' : 'dup') : null} read={read}
          selected={picked} onSelect={onSelect}
          idPrefix="spec" compact caption="Precedence table of the specimen grammar, built step by step." />
        {pickedCell && (
          <div className="specimen__prov">
            <Provenance key={cellKey(pickedCell.left, pickedCell.right)} cell={pickedCell} a={spec.a} idPrefix="spec" takeFocus onClose={() => setPicked(null)} />
          </div>
        )}
      </div>
      <div className="specimen__caption" aria-live={playing ? 'off' : 'polite'}>
        {count === 0 ? <p>The table starts blank.</p>
          : rel ? (playing
            ? <p className="mono specimen__brief">{rel.left} <Rel r={rel.relation} /> {rel.right} <span className="specimen__rule">rule {rel.rule}{rel.changed ? '' : ', already there'}</span></p>
            : <p><Tx>{rel.message}</Tx></p>)
          : ps ? (playing ? <p className="mono specimen__brief">{ps.type === 'SHIFT' ? 'shift' : ps.type === 'REDUCE' ? 'reduce' : ps.type.toLowerCase()} {ps.relation ? <>({ps.top} <Rel r={ps.relation} /> {ps.lookahead})</> : null}</p>
            : <p><Tx>{ps.message}</Tx></p>) : null}
      </div>
      <div className="specimen__parse" aria-label={`Parsing ${SPECIMEN_STRING}`}>
        <span className="label">Parse</span>
        <span className="specimen__tape" aria-hidden="true">
          {[...tokens, '$'].map((t, i) => <span key={i} className={cx('stok', ps && i < pointer && 'is-used', ps && i === pointer && !done && 'is-look')}>{t}</span>)}
        </span>
        {done ? <Verdict result={spec.result} compact /> : ps?.relation ? <span className="specimen__rel">{ps.top} <Rel r={ps.relation} /> {ps.lookahead}</span> : <span className="specimen__wait">after the table</span>}
      </div>
      <div className="specimen__controls">
        <Keycap label={`${keyLabel} the specimen`} onPress={toggle} wide pressed={playing}>
          {playing ? Icons.pause : done ? Icons.replay : Icons.play}<span className="keycap__text">{keyLabel}</span>
        </Keycap>
        <Keycap label="Previous frame" onPress={() => { setAuto(false); api.back(); }} disabled={count === 0}>{Icons.back}</Keycap>
        <Keycap label="Next frame" onPress={() => { setAuto(false); api.next(); }} disabled={done}>{Icons.next}</Keycap>
        <span className="specimen__count">{count} of {total}</span>
        <button type="button" className="btn" onClick={onUse}>Use this grammar</button>
      </div>
    </section>
  );
}
