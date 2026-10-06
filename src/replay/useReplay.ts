// Generic replay controller: { steps, count, playing }. It replays steps that an algorithm already
// produced; it never calls an algorithm. Rendering is a pure function of steps[count]; motion is a
// separate overlay that only ever plays for a single forward step (see src/motion/fx.ts).
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import { stepAt } from './selectors.ts';
import type { Marker } from './selectors.ts';
import { cancelAllFx } from '../motion/fx.ts';

export const SPEEDS = [0.5, 1, 1.5, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
const BASE_MS = 1100;

export type Lens = 'glass' | 'flat';
export interface Settings {
  speed: Speed; setSpeed: (s: Speed) => void;
  reduced: boolean; setReduced: (r: boolean) => void;
  lens: Lens; setLens: (l: Lens) => void;
}
export const SettingsContext = createContext<Settings>({
  speed: 1, setSpeed: () => {}, reduced: false, setReduced: () => {}, lens: 'glass', setLens: () => {},
});
export const useSettings = () => useContext(SettingsContext);

/** Keycaps listen for this so a keyboard shortcut visibly presses the matching control. */
export type KeyId = 'start' | 'back' | 'play' | 'next' | 'end' | 'slower' | 'faster';
export const pressKeycap = (id: KeyId) => window.dispatchEvent(new CustomEvent('cl:keycap', { detail: id }));

// Remembers where each steps[] was left, so returning to a stage resumes at the same step.
const memory = new WeakMap<readonly unknown[], number>();

interface State { steps: readonly unknown[]; count: number; playing: boolean }
type Action =
  | { type: 'bind'; steps: readonly unknown[] } | { type: 'goto'; count: number } | { type: 'move'; by: number }
  | { type: 'tick' } | { type: 'pause' } | { type: 'toggle' } | { type: 'phase'; dir: 1 | -1; markers: Marker[] };

function reducer(state: State, action: Action): State {
  const total = state.steps.length;
  const clamp = (v: number) => Math.max(0, Math.min(total, v));
  switch (action.type) {
    case 'bind': return { steps: action.steps, count: Math.min(memory.get(action.steps) ?? 0, action.steps.length), playing: false };
    case 'goto': return { ...state, count: clamp(action.count), playing: false };
    case 'move': return { ...state, count: clamp(state.count + action.by), playing: false };
    case 'tick': { const count = clamp(state.count + 1); return { ...state, count, playing: count < total }; }
    case 'pause': return { ...state, playing: false };
    case 'toggle':
      if (state.playing) return { ...state, playing: false };
      return { ...state, count: state.count >= total ? 0 : state.count, playing: total > 0 };
    case 'phase': {
      const marks = action.markers.map((m) => m.at);
      const target = action.dir < 0
        ? [...marks].reverse().find((at) => at < state.count) ?? 0
        : marks.find((at) => at > state.count) ?? total;
      return { ...state, count: clamp(target), playing: false };
    }
  }
}

export interface ReplayApi {
  start(): void; end(): void; back(): void; next(): void; goto(c: number): void; toggle(): void; pause(): void;
  prevPhase(): void; nextPhase(): void; slower(): void; faster(): void;
}
export interface Replay<S> {
  steps: readonly S[]; count: number; total: number; playing: boolean; markers: Marker[];
  step: S | null; nextStep: S | null; api: ReplayApi;
  /** true only when this render is exactly one step after the previous one */
  forward: boolean;
  /** forward and motion allowed */
  animate: boolean;
  /** animate and slow enough for the longer, explanatory sequences */
  rich: boolean;
}

export function isTyping(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  const tag = e?.tagName;
  const kind = tag === 'INPUT' ? (e as HTMLInputElement).type : null;
  return tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(e?.isContentEditable)
    || (tag === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(kind ?? ''));
}

export function useReplay<S>(steps: readonly S[], { markers = [], active = true }: { markers?: Marker[]; active?: boolean } = {}): Replay<S> {
  const { speed, setSpeed, reduced } = useSettings();
  const [state, dispatch] = useReducer(reducer, steps, (s): State => ({ steps: s, count: Math.min(memory.get(s) ?? 0, s.length), playing: false }));
  if (state.steps !== steps) dispatch({ type: 'bind', steps });
  const bound = state.steps === steps;
  const count = bound ? state.count : Math.min(memory.get(steps) ?? 0, steps.length);
  const playing = bound && state.playing;
  const total = steps.length;

  const live = useRef({ markers, speed });
  live.current = { markers, speed };
  // Motion is only played for a single forward step. Jumps, Back and scrubbing show the state at once.
  const prev = useRef({ steps, count });
  const forward = prev.current.steps === steps && count === prev.current.count + 1;
  useLayoutEffect(() => {
    // Anything other than one step forward cancels whatever is still moving, before paint.
    if (!(prev.current.steps === steps && count === prev.current.count + 1) && (prev.current.steps !== steps || prev.current.count !== count)) cancelAllFx();
    prev.current = { steps, count };
  }, [steps, count]);
  const animate = forward && !reduced;
  const rich = animate && speed < 2;      // long explanatory motion is skipped at 2x and above

  const api = useMemo<ReplayApi>(() => ({
    start: () => dispatch({ type: 'goto', count: 0 }),
    end: () => dispatch({ type: 'goto', count: Infinity }),
    back: () => dispatch({ type: 'move', by: -1 }),
    next: () => dispatch({ type: 'move', by: 1 }),
    goto: (c) => dispatch({ type: 'goto', count: c }),
    toggle: () => dispatch({ type: 'toggle' }),
    pause: () => dispatch({ type: 'pause' }),
    prevPhase: () => dispatch({ type: 'phase', dir: -1, markers: live.current.markers }),
    nextPhase: () => dispatch({ type: 'phase', dir: 1, markers: live.current.markers }),
    slower: () => setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(live.current.speed) - 1)]),
    faster: () => setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(live.current.speed) + 1)]),
  }), [setSpeed]);

  useEffect(() => { memory.set(steps, count); }, [steps, count]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setTimeout(() => dispatch({ type: 'tick' }), BASE_MS / speed);
    return () => clearTimeout(id);
  }, [playing, count, speed]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (isTyping(el)) return;                                   // never steal keys from a text field
      const tag = el?.tagName;
      const role = el?.getAttribute?.('role');
      // controls that own the arrow keys while focused (timeline, speed dial, radio groups)
      const ownsArrows = (tag === 'INPUT' && (el as HTMLInputElement).type === 'range') || role === 'slider' || role === 'radio';
      if (el?.closest?.('[data-own-keys]')) return;
      switch (e.key) {
        case 'ArrowLeft': if (ownsArrows && !e.shiftKey) return; if (e.shiftKey) api.prevPhase(); else { pressKeycap('back'); api.back(); } break;
        case 'ArrowRight': if (ownsArrows && !e.shiftKey) return; if (e.shiftKey) api.nextPhase(); else { pressKeycap('next'); api.next(); } break;
        case ' ':
          if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || role === 'radio') return;  // Space activates the focused control
          pressKeycap('play'); api.toggle(); break;
        case 'Home': if (ownsArrows) return; pressKeycap('start'); api.start(); break;
        case 'End': if (ownsArrows) return; pressKeycap('end'); api.end(); break;
        case '[': pressKeycap('slower'); api.slower(); break;
        case ']': pressKeycap('faster'); api.faster(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, api]);

  return { steps, count, total, playing, markers, step: stepAt(steps, count), nextStep: steps[count] ?? null, api, forward, animate, rich };
}
