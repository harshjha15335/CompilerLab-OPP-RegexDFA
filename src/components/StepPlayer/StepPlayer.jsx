import { SPEEDS, useSettings } from '../../replay/useReplay.js';
import { CHAPTERS, hashFor, parseHash } from '../../data/nav.js';
import { cx } from '../common/common.jsx';

const Icon = ({ children }) => <svg className="tbtn__icon" viewBox="0 0 12 12" aria-hidden="true">{children}</svg>;
const IStart = () => <Icon><rect x="1" y="1.5" width="1.8" height="9" rx="0.6" /><polygon points="10.5,1.5 10.5,10.5 3.8,6" /></Icon>;
const IBack = () => <Icon><polygon points="9.5,1.5 9.5,10.5 2.5,6" /></Icon>;
const INext = () => <Icon><polygon points="2.5,1.5 2.5,10.5 9.5,6" /></Icon>;
const IEnd = () => <Icon><rect x="9.2" y="1.5" width="1.8" height="9" rx="0.6" /><polygon points="1.5,1.5 1.5,10.5 8.2,6" /></Icon>;
const IPlay = () => <Icon><polygon points="2.5,1 2.5,11 10.5,6" /></Icon>;
const IPause = () => <Icon><rect x="2.2" y="1.5" width="2.8" height="9" rx="0.6" /><rect x="7" y="1.5" width="2.8" height="9" rx="0.6" /></Icon>;

// The stage after the one on screen, so the dock can offer it when a replay ends.
function nextStage() {
  const { chapter, stage } = parseHash(window.location.hash);
  const i = chapter.stages.findIndex((s) => s.id === stage?.id);
  const next = chapter.stages[i + 1];
  if (next) return { title: next.title, href: hashFor(chapter.id, next.id) };
  const other = CHAPTERS.find((c) => c.id !== chapter.id && c.stages.length);
  return other && chapter.id === 'opp' ? { title: other.title, href: hashFor(other.id, other.stages[0].id) } : null;
}

/** Shared playback dock. Purely a view over a useReplay() controller. */
export function StepPlayer({ replay, label }) {
  const { count, total, playing, markers, api } = replay;
  const { speed, setSpeed } = useSettings();
  const frac = total ? count / total : 0;
  const next = nextStage();
  // label a marker only when it will not collide with the previous label
  let lastLabelled = -1;
  const marks = markers.map((m) => {
    const at = total ? m.at / total : 0;
    const labelled = at - lastLabelled >= 0.1;
    if (labelled) lastLabelled = at;
    return { ...m, frac: at, labelled };
  });
  return (
    <div className="transport" role="group" aria-label={`${label} playback controls`}>
      <div className="transport__group">
        <button type="button" className="tbtn" onClick={api.start} disabled={count === 0} aria-label="First step" title="First step (Home)"><IStart /></button>
        <button type="button" className="tbtn" onClick={api.back} disabled={count === 0} aria-label="Previous step" title="Previous step (←)"><IBack /></button>
        <button type="button" className={cx('tbtn tbtn--play', playing && 'is-on')} onClick={api.toggle} disabled={!total}
          aria-pressed={playing} title="Play or pause (Space)">
          {playing ? <IPause /> : <IPlay />}<span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button type="button" className="tbtn" onClick={api.next} disabled={count >= total} aria-label="Next step" title="Next step (→)"><INext /></button>
        <button type="button" className="tbtn" onClick={api.end} disabled={count >= total} aria-label="Last step" title="Last step (End)"><IEnd /></button>
      </div>
      <output className="transport__readout" aria-label="Current step">
        <span className="transport__word">Step</span><b>{count}</b><i>/</i><span>{total}</span>
      </output>
      <div className="timeline" style={{ '--frac': frac }}>
        <div className="timeline__marks">
          {marks.map((m) => (
            <button key={m.at} type="button" tabIndex={-1} className={cx('timeline__mark', count >= m.at && 'is-passed', m.frac > 0.9 && 'is-flipped')}
              style={{ '--at': m.frac }} onClick={() => api.goto(m.at)} title={`Jump to ${m.label} (step ${m.at})`}>
              <i aria-hidden="true" />
              {m.labelled && <span>{m.label}</span>}
            </button>
          ))}
        </div>
        <input type="range" className="timeline__range" min={0} max={total} step={1} value={count} disabled={!total}
          onChange={(e) => api.goto(Number(e.target.value))}
          aria-label={`${label} timeline`} aria-valuetext={`Step ${count} of ${total}`} />
      </div>
      <div className="speed" role="radiogroup" aria-label="Playback speed">
        {SPEEDS.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={speed === v} className={cx('speed__opt', speed === v && 'is-on')}
            onClick={() => setSpeed(v)} title={`${v}× speed ([ slower, ] faster)`}>{v}×</button>
        ))}
      </div>
      {next && <a className={cx('transport__next', count >= total && total > 0 && 'is-ready')} href={next.href}>{next.title}<INext /></a>}
    </div>
  );
}
