import { cx, Production, Rel, Verdict } from '../common/common.jsx';

const START = [{ symbol: '$', kind: 'T' }];

/** What the bench shows for one parser step: the configuration the decision was made on,
 *  and the stack that results. Everything is read from the step; nothing is recomputed. */
export function benchView(step) {
  if (!step) return { stack: START, after: null, pointer: 0, handle: null, acting: false };
  const acting = step.type === 'SHIFT' || step.type === 'REDUCE';
  return {
    stack: acting ? step.stackBefore : step.stack,
    after: acting ? step.stack : null,
    pointer: step.type === 'SHIFT' ? step.pointer - 1 : step.pointer,
    handle: step.handle ?? null,
    acting,
  };
}

function Cell({ item, top, fresh }) {
  return (
    <span className={cx('scell', item.kind === 'N' ? 'scell--nt' : 'scell--t', top && 'is-top', fresh && 'is-fresh')}>
      {item.symbol}
      {top && <span className="scell__mark" aria-hidden="true">top terminal</span>}
    </span>
  );
}

export function StackRow({ stack, handle, markTop = true, freshIndex = -1, failed }) {
  let topIndex = -1;
  if (markTop) for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind === 'T') { topIndex = i; break; }
  const out = [];
  for (let i = 0; i < stack.length; i++) {
    if (handle && i === handle.from) {
      out.push(
        <span key="handle" className={cx('handle', failed && 'handle--failed')}>
          <span className="handle__cells">
            {stack.slice(handle.from, handle.to + 1).map((it, j) => <Cell key={j} item={it} top={handle.from + j === topIndex} />)}
          </span>
          <span className="handle__bracket" aria-hidden="true" />
          <span className="handle__label">handle</span>
        </span>,
      );
      i = handle.to;
    } else out.push(<Cell key={i} item={stack[i]} top={i === topIndex} fresh={i === freshIndex} />);
  }
  return (
    <div className="stackrow" role="img"
      aria-label={`Stack, bottom to top: ${stack.map((s) => s.symbol).join(' ')}${handle ? `. Handle: ${handle.symbols.map((s) => s.symbol).join(' ')}` : ''}`}>
      <span className="stackrow__base" aria-hidden="true" />
      {out}
      <span className="stackrow__open" aria-hidden="true">top</span>
    </div>
  );
}

export function InputTape({ tokens, pointer }) {
  const cells = [...tokens, '$'];
  return (
    <div className="tape" role="img" aria-label={`Input: ${cells.join(' ')}. Lookahead is ${cells[pointer] ?? 'none'}.`}>
      {cells.map((t, i) => (
        <span key={i} className={cx('tcell', i < pointer && 'is-consumed', i === pointer && 'is-current')}>
          {t}
          {i === pointer && <span className="tcell__mark" aria-hidden="true">lookahead</span>}
        </span>
      ))}
    </div>
  );
}

const DECIDES = {
  '⋖': 'the stack terminal yields precedence, so the lookahead is shifted',
  '≐': 'both terminals belong to the same handle, so the lookahead is shifted',
  '⋗': 'the stack terminal takes precedence, so a handle is complete and must be reduced',
};

/** Stack bench + input tape + current relation + decision, for one step. */
export function Bench({ step, tokens, mode, title, compact, finished }) {
  const v = benchView(step);
  const type = step?.type;
  const done = type === 'ACCEPT' || type === 'REJECT';
  const produced = type === 'REDUCE' ? v.after[v.handle.from].symbol : null;
  return (
    <div className={cx('bench', compact && 'bench--compact')}>
      {title && <h3 className="bench__title">{title}</h3>}
      <div className="bench__zone">
        <span className="label">Stack</span>
        <StackRow stack={v.stack} handle={v.handle} failed={type === 'REJECT'} />
      </div>

      <div className="bench__relation" aria-live="polite">
        {step && !finished ? (
          <>
            <span className="relbox">
              <span className="relbox__term">{step.top}</span>
              {step.relation ? <Rel r={step.relation} /> : <span className="relbox__none">{step.top === '$' && step.lookahead === '$' ? 'end' : 'blank'}</span>}
              <span className="relbox__term">{step.lookahead}</span>
            </span>
            <span className="bench__why">
              {step.relation ? <>top terminal <b className="mono">{step.top}</b> vs lookahead <b className="mono">{step.lookahead}</b>: {DECIDES[step.relation]}.</>
                : step.top === '$' && step.lookahead === '$' ? 'Both end markers meet: the parse is over.'
                : <>The table cell (<span className="mono">{step.top}</span>, <span className="mono">{step.lookahead}</span>) is blank.</>}
            </span>
          </>
        ) : <span className="bench__why">{finished ? 'This mode has already finished.' : 'The stack holds only $. Press Next (→).'}</span>}
      </div>

      <div className="bench__zone">
        <span className="label">Input</span>
        <InputTape tokens={tokens} pointer={v.pointer} />
      </div>

      <div className={cx('decision', type && `decision--${type.toLowerCase()}`)} key={step?.action ?? 0}>
        {!step && <p className="decision__idle">Decision: none yet.</p>}
        {type === 'SHIFT' && (
          <>
            <p className="decision__act"><b>SHIFT</b> push <span className="mono">{step.lookahead}</span> and advance the input.</p>
            <div className="decision__after"><span className="label">After</span><StackRow stack={v.after} markTop={false} freshIndex={v.after.length - 1} /></div>
          </>
        )}
        {type === 'REDUCE' && (
          <>
            <p className="decision__act">
              <b>REDUCE</b> handle <span className="mono">{v.handle.symbols.map((s) => s.symbol).join(' ')}</span> by <Production p={step.production} />
            </p>
            <p className="decision__mode">
              {mode === 'classic'
                ? <>The handle becomes <b className="mono">N</b>.</>
                : <>The handle becomes <b className="mono">{produced}</b>: every non-terminal it can be, following unit productions.</>}
            </p>
            <div className="decision__after"><span className="label">After</span><StackRow stack={v.after} markTop={false} freshIndex={v.handle.from} /></div>
          </>
        )}
        {done && <Verdict result={type} reason={step.reason} compact={compact} />}
      </div>
    </div>
  );
}

/** Conventional trace table; the current row is marked and every row jumps the replay. */
export function TraceTable({ steps, tokens, count, onJump }) {
  const input = (s) => {
    const p = s.type === 'SHIFT' ? s.pointer - 1 : s.pointer;
    return [...tokens.slice(p), '$'].join(' ');
  };
  return (
    <div className="trace-wrap">
      <table className="trace">
        <caption className="sr-only">Parse trace</caption>
        <thead><tr><th scope="col">#</th><th scope="col">Stack</th><th scope="col">Rel.</th><th scope="col">Input</th><th scope="col">Action</th></tr></thead>
        <tbody>
          {steps.map((s, i) => {
            const state = i + 1 === count ? 'is-current' : i + 1 > count ? 'is-future' : '';
            return (
              <tr key={i} className={state} aria-current={i + 1 === count ? 'step' : undefined}
                ref={i + 1 === count ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
                <td><button type="button" className="trace__jump" onClick={() => onJump(i + 1)} aria-label={`Go to step ${i + 1}`}>{i + 1}</button></td>
                <td className="mono">{(s.stackBefore ?? s.stack).map((x) => x.symbol).join(' ')}</td>
                <td>{s.relation ? <Rel r={s.relation} /> : ''}</td>
                <td className="mono trace__input">{input(s)}</td>
                <td className="trace__action">
                  <b>{s.type}</b>
                  {s.type === 'REDUCE' && <span className="mono">{s.production.lhs} → {s.production.rhs.join(' ')}</span>}
                  {s.type === 'SHIFT' && <span className="mono trace__sym"> {s.lookahead}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ModeSwitch({ mode, onChange, name = 'mode' }) {
  return (
    <div className="modes" role="radiogroup" aria-labelledby={`${name}-label`}>
      <span className="label" id={`${name}-label`}>Reduction mode</span>
      <div className="modes__row">
        {[['safeguarded', 'Safeguarded'], ['classic', 'Classic N']].map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={mode === id} className={cx('modes__opt', mode === id && 'is-on')} onClick={() => onChange(id)}>
            <i aria-hidden="true" /><span>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const MODE_TEXT = (
  <>
    <p><b>Classic N</b> forgets the exact non-terminal identity during reductions.</p>
    <p><b>Safeguarded</b> mode retains grammar compatibility information: each reduced item carries the non-terminals it may be.</p>
  </>
);

