// Machined hardware that sits on the printed plate: keycaps and the scrub timeline.
// Pure CSS 3D (no WebGL). Every control is a real, labelled, keyboard-operable element.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { type KeyId, type Replay } from '../replay/useReplay.ts';
import { cx } from './kit.tsx';

/** A keycap button. It presses (120 ms travel) when clicked AND when its keyboard shortcut fires. */
export function Keycap({ id, label, shortcut, onPress, disabled, wide, pressed, children, className }: {
  id?: KeyId; label: string; shortcut?: string; onPress: () => void; disabled?: boolean; wide?: boolean;
  pressed?: boolean; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!id) return undefined;
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      if ((e as CustomEvent).detail !== id || !ref.current) return;
      ref.current.dataset.down = '';
      clearTimeout(t);
      t = setTimeout(() => { if (ref.current) delete ref.current.dataset.down; }, 130);
    };
    window.addEventListener('cl:keycap', on);
    return () => { window.removeEventListener('cl:keycap', on); clearTimeout(t); };
  }, [id]);
  return (
    <button ref={ref} type="button" className={cx('keycap', wide && 'keycap--wide', className)} onClick={onPress} disabled={disabled}
      aria-label={label} aria-keyshortcuts={shortcut} aria-pressed={pressed} title={shortcut ? `${label} (${shortcut})` : label}>
      <span className="keycap__skirt" aria-hidden="true" />
      <span className="keycap__face">{children}</span>
    </button>
  );
}

const I = ({ d }: { d: ReactNode }) => <svg className="keycap__icon" viewBox="0 0 12 12" aria-hidden="true">{d}</svg>;
export const Icons = {
  start: <I d={<><rect x="1.5" y="1.5" width="1.6" height="9" /><polygon points="10.5,1.5 10.5,10.5 4,6" /></>} />,
  back: <I d={<polygon points="9.5,1.5 9.5,10.5 2.5,6" />} />,
  next: <I d={<polygon points="2.5,1.5 2.5,10.5 9.5,6" />} />,
  end: <I d={<><rect x="8.9" y="1.5" width="1.6" height="9" /><polygon points="1.5,1.5 1.5,10.5 8,6" /></>} />,
  play: <I d={<polygon points="3,1.2 3,10.8 10.6,6" />} />,
  pause: <I d={<><rect x="2.4" y="1.6" width="2.6" height="8.8" /><rect x="7" y="1.6" width="2.6" height="8.8" /></>} />,
  replay: <I d={<path d="M9.8 6A3.8 3.8 0 1 1 8.4 3M8.6 0.8v2.6H6" fill="none" />} />,
};

type Fit = 'mid' | 'start' | 'end' | 'hidden';
const GAP = 10;   // px of clear space required between two tick labels

/** Places tick labels by their measured width: a label that would touch its neighbour or run off the track is hidden,
 *  and labels at the ends are anchored inward instead of centred. */
function fitLabels(track: HTMLElement): Fit[] {
  const w = track.clientWidth;
  const pad = 8;
  let lastRight = -Infinity;
  return [...track.querySelectorAll<HTMLElement>('.timeline__ticklabel')].map((lab): Fit => {
    const x = Number(lab.dataset.at) * w;
    const lw = lab.offsetWidth;
    let fit: Fit = 'mid';
    let left = x - lw / 2;
    if (left < -pad) { fit = 'start'; left = x; }
    else if (left + lw > w + pad) { fit = 'end'; left = x - lw; }
    if (left < lastRight + GAP || left < -pad || left + lw > w + pad) return 'hidden';
    lastRight = left + lw;
    return fit;
  });
}

/** Scrub timeline: a native range input (keyboard + a11y) under a weighted brass thumb, with phase
 *  ticks. Ticks are drawn, not buttons, so nothing interactive overlaps the slider. */
export function Timeline<S>({ replay, label }: { replay: Replay<S>; label: string }) {
  const { count, total, markers, api } = replay;
  const frac = total ? count / total : 0;
  const track = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState<Fit[]>([]);
  const sig = `${total}|${markers.map((m) => `${m.at}:${m.label}`).join('|')}`;
  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const run = () => { const next = fitLabels(el); setFits((f) => (f.join() === next.join() ? f : next)); };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sig]);
  const ticks = markers.map((m) => ({ ...m, at: total ? m.at / total : 0 }));
  return (
    <div className="timeline" style={{ '--frac': frac } as CSSProperties}>
      <div className="timeline__ticks" aria-hidden="true" ref={track}>
        {ticks.map((t, i) => (
          <Fragment key={t.at}>
            <span className={cx('timeline__tick', count >= Math.round(t.at * total) && 'is-passed')} style={{ '--at': t.at } as CSSProperties} />
            {/* a sibling of the 1 px tick, not its child, so the label's real background is the dock it is painted on */}
            <span className={cx('timeline__ticklabel', `is-${fits[i] ?? 'hidden'}`)} style={{ '--at': t.at } as CSSProperties} data-at={t.at}>{t.label}</span>
          </Fragment>
        ))}
      </div>
      <div className="timeline__rail" aria-hidden="true"><span className="timeline__fill" /></div>
      <input type="range" className="timeline__range" min={0} max={total} step={1} value={count} disabled={!total}
        onChange={(e) => api.goto(Number(e.target.value))} aria-label={`${label} timeline`} aria-valuetext={`Step ${count} of ${total}`} />
      <span className="timeline__thumb" aria-hidden="true" />
    </div>
  );
}

/** The transport tray at the foot of every plate that replays steps. */
export function Dock<S>({ replay, label, next }: { replay: Replay<S>; label: string; next?: { href: string; title: string } | null }) {
  const { count, total, playing, api } = replay;
  return (
    <div className="dock" role="group" aria-label={`${label} playback`}>
      <div className="dock__keys">
        <Keycap id="start" label="First step" shortcut="Home" onPress={api.start} disabled={count === 0}>{Icons.start}</Keycap>
        <Keycap id="back" label="Previous step" shortcut="ArrowLeft" onPress={api.back} disabled={count === 0}>{Icons.back}</Keycap>
        <Keycap id="play" label={playing ? 'Pause' : 'Play'} shortcut="Space" onPress={api.toggle} disabled={!total} wide pressed={playing}>
          {playing ? Icons.pause : Icons.play}<span className="keycap__text">{playing ? 'Pause' : 'Play'}</span>
        </Keycap>
        <Keycap id="next" label="Next step" shortcut="ArrowRight" onPress={api.next} disabled={count >= total}>{Icons.next}</Keycap>
        <Keycap id="end" label="Last step (all at once)" shortcut="End" onPress={api.end} disabled={count >= total}>{Icons.end}</Keycap>
      </div>
      <output className="dock__readout" aria-live="off">
        <span className="dock__word">Step</span> <b>{count}</b> <span className="dock__of">of {total}</span>
      </output>
      <Timeline replay={replay} label={label} />
      {next && (
        <a className={cx('dock__next', count >= total && total > 0 && 'is-ready')} href={next.href}>
          <span className="dock__nextlabel">Next</span> {next.title}
        </a>
      )}
    </div>
  );
}
