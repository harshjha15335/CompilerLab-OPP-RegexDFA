import { cx } from '../common/common.jsx';

/** Input tape for DFA simulation. `index` = number of symbols consumed so far. */
export function SimulationTape({ input, index, failedAt, edgeSymbolAt }) {
  const chars = [...input];
  if (!chars.length)
    return <div className="tape tape--sim" role="img" aria-label="Empty input string"><span className="tcell tcell--empty is-current">ε<span className="tcell__mark" aria-hidden="true">empty string</span></span></div>;
  return (
    <div className="tape tape--sim" role="img" aria-label={`Input ${input}. ${index} of ${chars.length} symbols read.`}>
      {chars.map((ch, i) => (
        <span key={i} className={cx('tcell', i < index && 'is-consumed', i === index && failedAt !== i && 'is-current', i === edgeSymbolAt && 'is-read', failedAt === i && 'is-failed')}>
          {ch}
          {i === index && failedAt !== i && <span className="tcell__mark" aria-hidden="true">next</span>}
          {i === edgeSymbolAt && <span className="tcell__mark" aria-hidden="true">read</span>}
          {failedAt === i && <span className="tcell__mark" aria-hidden="true">no move</span>}
        </span>
      ))}
      <span className={cx('tcell tcell--end', index >= chars.length && failedAt == null && 'is-current')}>
        <span className="sr-only">end of input</span>
        {index >= chars.length && failedAt == null && <span className="tcell__mark" aria-hidden="true">end</span>}
      </span>
    </div>
  );
}
