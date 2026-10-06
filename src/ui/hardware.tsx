// Machined hardware that sits on the printed plate: keycaps, the brass speed dial and the scrub
// timeline. Pure CSS 3D (no WebGL). Every control is a real, labelled, keyboard-operable element.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { SPEEDS, useSettings, type KeyId, type Replay, type Speed } from '../replay/useReplay.ts';
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

const DETENT = (i: number) => -120 + i * 60;      // five detents from -120° to +120°

/** Brass speed dial: role="slider" with five detents (0.5×, 1×, 1.5×, 2×, 4×).
 *  Drag to turn, or focus it and use ← → ↑ ↓ Home End; [ and ] work anywhere. */
export function SpeedDial() {
  const { speed, setSpeed } = useSettings();
  const index = SPEEDS.indexOf(speed);
  const knob = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const setIndex = (i: number) => setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i))] as Speed);
  const fromPointer = (x: number, y: number) => {
    const r = knob.current!.getBoundingClientRect();
    const a = (Math.atan2(x - (r.left + r.width / 2), -(y - (r.top + r.height / 2))) * 180) / Math.PI;   // 0° = up
    setIndex(Math.round((Math.max(-140, Math.min(140, a)) + 120) / 60));
  };
  return (
    <div className="dial" data-own-keys="">
      <div ref={knob} className={cx('dial__knob', drag && 'is-turning')} role="slider" tabIndex={0}
        aria-label="Playback speed" aria-valuemin={0} aria-valuemax={SPEEDS.length - 1} aria-valuenow={index}
        aria-valuetext={`${speed}× speed`} aria-keyshortcuts="[ ]"
        style={{ '--angle': `${DETENT(index)}deg` } as CSSProperties}
        onKeyDown={(e) => {
          const k = e.key;
          if (k === 'ArrowRight' || k === 'ArrowUp') setIndex(index + 1);
          else if (k === 'ArrowLeft' || k === 'ArrowDown') setIndex(index - 1);
          else if (k === 'Home') setIndex(0);
          else if (k === 'End') setIndex(SPEEDS.length - 1);
          else return;
          e.preventDefault(); e.stopPropagation();
        }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); fromPointer(e.clientX, e.clientY); }}
        onPointerMove={(e) => { if (drag) fromPointer(e.clientX, e.clientY); }}
        onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
        <span className="dial__cap" aria-hidden="true"><span className="dial__notch" /></span>
      </div>
      <svg className="dial__scale" viewBox="-40 -40 80 80" aria-hidden="true">
        {SPEEDS.map((s, i) => {
          const a = ((DETENT(i) - 90) * Math.PI) / 180;
          return (
            <g key={s} className={cx('dial__tick', i === index && 'is-on')}>
              <line x1={Math.cos(a) * 25} y1={Math.sin(a) * 25} x2={Math.cos(a) * 29} y2={Math.sin(a) * 29} />
              <text x={Math.cos(a) * 35.5} y={Math.sin(a) * 35.5 + 3}>{s}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Scrub timeline: a native range input (keyboard + a11y) under a weighted brass thumb, with phase
 *  ticks. Ticks are drawn, not buttons, so nothing interactive overlaps the slider. */
export function Timeline<S>({ replay, label }: { replay: Replay<S>; label: string }) {
  const { count, total, markers, api } = replay;
  const frac = total ? count / total : 0;
  let last = -1;
  const ticks = markers.map((m) => {
    const at = total ? m.at / total : 0;
    const show = at - last >= 0.12 && at <= 0.94;
    if (show) last = at;
    return { ...m, at, show };
  });
  return (
    <div className="timeline" style={{ '--frac': frac } as CSSProperties}>
      <div className="timeline__ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t.at} className={cx('timeline__tick', count >= Math.round(t.at * total) && 'is-passed')} style={{ '--at': t.at } as CSSProperties}>
            {t.show && <span className="timeline__ticklabel">{t.label}</span>}
          </span>
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
      <SpeedDial />
      {next && (
        <a className={cx('dock__next', count >= total && total > 0 && 'is-ready')} href={next.href}>
          <span className="dock__nextlabel">Next</span> {next.title}
        </a>
      )}
    </div>
  );
}
