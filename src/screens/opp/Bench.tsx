import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { Mode, ParseStep, StackItem } from '../../core/index.ts';
import { all, fly, gather, pop } from '../../motion/fx.ts';
import { cx, Production, Rel, Verdict } from '../../ui/kit.tsx';

const START: StackItem[] = [{ symbol: '$', kind: 'T' }];

/** What the bench shows for one parser step: the configuration the decision was made on, and the
 *  stack that results. Everything is read from the step; nothing is recomputed. */
export function benchView(step: ParseStep | null) {
  if (!step) return { stack: START, after: null, pointer: 0, acting: false };
  const acting = step.type === 'SHIFT' || step.type === 'REDUCE';
  return {
    stack: acting ? step.stackBefore! : step.stack,
    after: acting ? step.stack : null,
    pointer: step.type === 'SHIFT' ? step.pointer - 1 : step.pointer,
    acting,
  };
}

function Slot({ item, top, fresh }: { item: StackItem; top?: boolean; fresh?: boolean }) {
  return (
    <span className={cx('slot', item.kind === 'N' ? 'slot--nt' : 'slot--t', top && 'is-top', fresh && 'is-fresh')}>
      {item.symbol}
      {top && <span className="slot__mark" aria-hidden="true">top terminal</span>}
    </span>
  );
}

export function StackRow({ stack, handle, markTop = true, fresh = -1, failed, label }: {
  stack: StackItem[]; handle?: ParseStep['handle'] | null; markTop?: boolean; fresh?: number; failed?: boolean; label: string;
}) {
  let topIndex = -1;
  if (markTop) for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === 'T') { topIndex = i; break; }
  const out: ReactNode[] = [];
  for (let i = 0; i < stack.length; i++) {
    if (handle && i === handle.from) {
      out.push(
        <span key="handle" className={cx('handle', failed && 'handle--failed')}>
          <span className="handle__cells">{stack.slice(handle.from, handle.to + 1).map((it, j) => <Slot key={j} item={it} top={handle.from + j === topIndex} />)}</span>
          <span className="handle__bracket" aria-hidden="true" />
          <span className="handle__label" aria-hidden="true">{failed ? 'no production matches' : 'handle'}</span>
        </span>,
      );
      i = handle.to;
    } else out.push(<Slot key={i} item={stack[i]} top={i === topIndex} fresh={i === fresh} />);
  }
  return (
    <div className="stackrow" role="img"
      aria-label={`${label}, bottom to top: ${stack.map((s) => s.symbol).join(' ')}${handle ? `. Handle: ${handle.symbols.map((s) => s.symbol).join(' ')}` : ''}`}>
      {out}
    </div>
  );
}

export function InputTape({ tokens, pointer }: { tokens: string[]; pointer: number }) {
  const cells = [...tokens, '$'];
  return (
    <div className="tape" role="img" aria-label={`Input: ${cells.join(' ')}. Lookahead: ${cells[pointer] ?? 'none'}.`}>
      {cells.map((t, i) => (
        <span key={i} className={cx('tcell', i < pointer && 'is-used', i === pointer && 'is-look')}>
          {t}
          {i === pointer && <span className="tcell__mark" aria-hidden="true">lookahead</span>}
        </span>
      ))}
    </div>
  );
}

const DECIDES: Record<string, string> = {
  '⋖': 'the stack terminal yields, so the lookahead is shifted',
  '≐': 'both terminals belong to the same handle, so the lookahead is shifted',
  '⋗': 'the stack terminal takes precedence, so a handle is complete and is reduced',
};

/** Motion for one parser step; the markup is already the final state. */
function playStep(root: HTMLElement, step: ParseStep, rich: boolean) {
  const freshCell = root.querySelector('.bench__after .slot.is-fresh');
  if (step.type === 'SHIFT')
    return fly(root.querySelector('.tape .tcell.is-look'), freshCell, { duration: rich ? 260 : 150 });
  if (step.type !== 'REDUCE') return undefined;                               // ACCEPT / REJECT are instant
  const cells = [...root.querySelectorAll('.handle .slot')];
  if (!rich) return fly(root.querySelector('.handle__cells'), freshCell, { duration: 150, shrink: true });
  return all(
    pop(root.querySelector('.handle__bracket'), { duration: 120, from: 0.2 }),
    gather(cells, { delay: 110, duration: 260 }),
    fly(root.querySelector('.handle__cells'), freshCell, { delay: 240, duration: 180, shrink: true }),
  );
}

/** Stack + current relation + input tape + decision, for one step. */
export function Bench({ step, tokens, mode, title, compact, finished, fx }: {
  step: ParseStep | null; tokens: string[]; mode: Mode; title?: ReactNode; compact?: boolean; finished?: boolean; fx: 'rich' | 'fast' | null;
}) {
  const v = benchView(step);
  const type = step?.type;
  const done = type === 'ACCEPT' || type === 'REJECT';
  const handle = step?.handle ?? null;
  const produced = type === 'REDUCE' && handle && v.after ? v.after[handle.from].symbol : null;
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (fx && step && root.current ? playStep(root.current, step, fx === 'rich') : undefined), [step, fx]);
  return (
    <div className={cx('bench', compact && 'bench--compact')} ref={root}>
      {title && <h3 className="bench__title">{title}</h3>}
      <div className="bench__zone">
        <span className="label">Stack</span>
        <StackRow stack={v.stack} handle={handle} failed={type === 'REJECT'} label="Stack" />
      </div>
      <div className="bench__relation">
        {step && !finished ? (
          <>
            <span className="relbox" aria-label={step.relation ? `${step.top} ${step.relation} ${step.lookahead}` : `${step.top} and ${step.lookahead}: no relation`}>
              <span className="relbox__term">{step.top}</span>
              {step.relation ? <Rel r={step.relation} label={false} /> : <span className="relbox__none">{step.top === '$' && step.lookahead === '$' ? 'end' : 'blank'}</span>}
              <span className="relbox__term">{step.lookahead}</span>
            </span>
            <span className="bench__why">
              {step.relation ? <>Top terminal <b className="mono">{step.top}</b>, lookahead <b className="mono">{step.lookahead}</b>: {DECIDES[step.relation]}.</>
                : step.top === '$' && step.lookahead === '$' ? 'Both end markers meet, so the parse is over.'
                : <>Cell (<span className="mono">{step.top}</span>, <span className="mono">{step.lookahead}</span>) is blank, so there is no move.</>}
            </span>
          </>
        ) : <span className="bench__why">{finished ? 'This mode has already finished.' : 'The stack holds only $. Press → to start.'}</span>}
      </div>
      <div className="bench__zone">
        <span className="label">Input</span>
        <InputTape tokens={tokens} pointer={v.pointer} />
      </div>
      <div className={cx('decision', type && `decision--${type.toLowerCase()}`)}>
        {!step && <p className="decision__idle">No move yet.</p>}
        {type === 'SHIFT' && (
          <>
            <p className="decision__act"><b>Shift</b> <span className="mono">{step!.lookahead}</span> onto the stack and advance the input.</p>
            <div className="bench__after"><span className="label">After</span><StackRow stack={v.after!} markTop={false} fresh={v.after!.length - 1} label="Stack after" /></div>
          </>
        )}
        {type === 'REDUCE' && handle && (
          <>
            <p className="decision__act"><b>Reduce</b> <span className="mono">{handle.symbols.map((s) => s.symbol).join(' ')}</span> by <Production p={step!.production!} /></p>
            <p className="decision__mode">{mode === 'classic'
              ? <>Classic N replaces the handle with <b className="mono">N</b>, forgetting which non-terminal it was.</>
              : <>Safeguarded replaces it with <b className="mono">{produced}</b>: every non-terminal it could be.</>}</p>
            <div className="bench__after"><span className="label">After</span><StackRow stack={v.after!} markTop={false} fresh={handle.from} label="Stack after" /></div>
          </>
        )}
        {done && <Verdict result={type} reason={step!.reason} compact={compact} />}
      </div>
    </div>
  );
}

export function ModeSwitch({ mode, onChange, name }: { mode: Mode; onChange: (m: Mode) => void; name: string }) {
  return (
    <div className="modes" role="radiogroup" aria-labelledby={`${name}-label`}>
      <span className="label" id={`${name}-label`}>Reduction mode</span>
      <div className="modes__row">
        {([['safeguarded', 'Safeguarded'], ['classic', 'Classic N']] as const).map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={mode === id} className={cx('modes__opt', mode === id && 'is-on')}
            onClick={() => onChange(id)}
            onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); onChange(mode === 'classic' ? 'safeguarded' : 'classic'); } }}>
            {mode === id && <motion.i layoutId={`${name}-rule`} className="modes__rule" aria-hidden="true" transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }} />}
            <span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
