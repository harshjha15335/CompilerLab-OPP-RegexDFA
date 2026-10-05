// Generic replay controller: { steps, count, playing, speed }. It replays steps that an
// algorithm already produced; it never calls an algorithm.
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { stepAt } from './selectors.js';

export const SPEEDS = [0.5, 1, 2, 4];
const BASE_MS = 1100;

export const SettingsContext = createContext({ speed: 1, setSpeed: () => {}, reduced: false, setReduced: () => {} });
export const useSettings = () => useContext(SettingsContext);

// Remembers where each steps[] was left, so returning to a stage resumes at the same step.
const memory = new WeakMap();

function reducer(state, action) {
  const total = state.steps.length;
  const clamp = (v) => Math.max(0, Math.min(total, v));
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
    default: return state;
  }
}

export function useReplay(steps, { markers = [], active = true } = {}) {
  const { speed, setSpeed } = useSettings();
  const [state, dispatch] = useReducer(reducer, steps, (s) => ({ steps: s, count: Math.min(memory.get(s) ?? 0, s.length), playing: false }));
  if (state.steps !== steps) dispatch({ type: 'bind', steps });
  const bound = state.steps === steps;
  const count = bound ? state.count : 0;
  const playing = bound && state.playing;
  const total = steps.length;

  const live = useRef({ markers, speed });
  live.current = { markers, speed };

  const api = useMemo(() => ({
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
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target;
      const tag = el?.tagName;
      const kind = tag === 'INPUT' ? el.type : null;
      const typing = tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
        || (tag === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(kind));
      if (typing) return;                                  // never steal keys from a text field
      const nativeStep = kind === 'range' && !e.shiftKey;  // the timeline slider already moves on arrows / Home / End
      switch (e.key) {
        case 'ArrowLeft': if (nativeStep) return; e.shiftKey ? api.prevPhase() : api.back(); break;
        case 'ArrowRight': if (nativeStep) return; e.shiftKey ? api.nextPhase() : api.next(); break;
        case ' ':
          // let Space activate the focused control
          if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || kind === 'checkbox' || kind === 'radio') return;
          api.toggle(); break;
        case 'Home': if (nativeStep) return; api.start(); break;
        case 'End': if (nativeStep) return; api.end(); break;
        case '[': api.slower(); break;
        case ']': api.faster(); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, api]);

  return { steps, count, total, playing, markers, step: stepAt(steps, count), nextStep: steps[count] ?? null, api };
}
