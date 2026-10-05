// Motion layer. Every effect here is a one-shot overlay played AFTER React has rendered the
// state for a step. Effects never hold algorithm state: if none of them run (reduced motion,
// fast playback, stepping backwards) the screen is already correct.
import { useLayoutEffect } from 'react';
import { animate } from 'motion';

export const DUR = { fast: 0.14, normal: 0.22, algorithm: 0.3, scene: 0.45 };
export const EASE = [0.2, 0.7, 0.2, 1];
const NS = 'http://www.w3.org/2000/svg';
const noop = () => {};

/** Run `play` once each time the replay lands on a new step by stepping forward. */
export function useStepEffect(replay, play, extra = []) {
  useLayoutEffect(() => {
    if (!replay.animate || !replay.step) return undefined;
    return play({ step: replay.step, rich: replay.rich }) ?? undefined;
  }, [replay.steps, replay.count, ...extra]); // eslint-disable-line react-hooks/exhaustive-deps
}

const whenDone = (controls, fn) => { (controls.finished ?? controls).then(fn, fn); };
const settle = (controls, done) => { whenDone(controls, done); return () => { controls.stop(); done(); }; };

// Inline styles an animation may leave behind. They are removed when it ends, so the DOM at rest
// is exactly what React rendered (stepping Back then compares equal, not just looks equal).
const LEFTOVER = ['opacity', 'transform', 'scale', 'translate', 'rotate', 'will-change'];
/** animate() that cleans up after itself. */
export function run(el, keyframes, options) {
  const c = animate(el, keyframes, options);
  const clear = () => {
    LEFTOVER.forEach((p) => el.style.removeProperty(p));
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  };
  whenDone(c, clear);
  // stop() freezes the element where it is; clear again on the next frame in case that write lands late
  return { stop() { c.stop(); clear(); requestAnimationFrame(clear); } };
}

/** Scale-and-fade a freshly inserted glyph or item into place. */
export function pop(el, { delay = 0, duration = DUR.normal, from = 0.85 } = {}) {
  if (!el) return noop;
  const c = run(el, { opacity: [0, 1], scale: [from, 1] }, { duration, delay, ease: EASE });
  return () => c.stop();
}

/** Drop an item in from a short distance (8-24px): used for new set members. */
export function settleIn(el, { dy = -16, delay = 0, duration = DUR.normal } = {}) {
  if (!el) return noop;
  const c = run(el, { opacity: [0, 1], y: [dy, 0] }, { duration, delay, ease: EASE });
  return () => c.stop();
}

/** Brief emphasis of something that already exists (duplicate discovery, source state). */
export function emphasize(el, { duration = DUR.algorithm } = {}) {
  if (!el) return noop;
  const c = run(el, { scale: [1, 1.14, 1] }, { duration, ease: EASE });
  return () => c.stop();
}

/** Move a visual copy of `from` onto `to`, so the eye sees one thing travel. The real target
 *  is already rendered; it is only hidden for the length of the flight. */
export function fly(root, { from, to, duration = 0.25, delay = 0, shrink = false } = {}) {
  const a = typeof from === 'string' ? root?.querySelector(from) : from;
  const b = typeof to === 'string' ? root?.querySelector(to) : to;
  const host = root?.closest('.app');
  if (!a || !b || !host) return noop;
  const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const ghost = a.cloneNode(true);
  ghost.classList.add('fx-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, { position: 'fixed', left: `${ra.left}px`, top: `${ra.top}px`, width: `${ra.width}px`, height: `${ra.height}px`, margin: 0, zIndex: 60, pointerEvents: 'none' });
  host.appendChild(ghost);
  b.style.visibility = 'hidden';
  const dx = rb.left + rb.width / 2 - (ra.left + ra.width / 2);
  const dy = rb.top + rb.height / 2 - (ra.top + ra.height / 2);
  const scale = shrink ? Math.min(1, rb.width / ra.width) : 1;
  const c = animate(ghost, { x: [0, dx], y: [0, dy], scale: [1, scale], opacity: shrink ? [1, 0.25] : [1, 1] }, { duration, delay, ease: EASE });
  let landed = null;
  return settle(c, () => {
    ghost.remove();
    b.style.removeProperty('visibility');
    if (b.getAttribute('style') === '') b.removeAttribute('style');
    if (!landed) landed = run(b, { scale: [0.92, 1] }, { duration: DUR.fast, ease: EASE });
  });
}

/** Draw a causal path from the thing that caused a value to the place the value appears.
 *  The path draws once, a marker rides it, then it fades. Returns the time the marker arrives. */
export function beam(root, { from, to, duration = 0.34, delay = 0 } = {}) {
  const a = typeof from === 'string' ? root?.querySelector(from) : from;
  const b = typeof to === 'string' ? root?.querySelector(to) : to;
  if (!a || !b || !root) return noop;
  const r0 = root.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
  const leftToRight = ra.left + ra.width / 2 < rb.left + rb.width / 2;
  const x1 = (leftToRight ? ra.right : ra.left) - r0.left, y1 = ra.top + ra.height / 2 - r0.top;
  const x2 = (leftToRight ? rb.left : rb.right) - r0.left, y2 = rb.top + rb.height / 2 - r0.top;
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'fx-beam');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('pathLength', '1');
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('r', '4.5');
  dot.style.offsetPath = `path("${d}")`;
  svg.append(path, dot);
  root.appendChild(svg);
  const opts = { duration, delay, ease: EASE };
  const draw = animate(path, { strokeDashoffset: [1, 0] }, opts);
  const ride = animate(dot, { offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 1] }, opts);
  const fade = animate(svg, { opacity: [1, 0] }, { duration: DUR.normal, delay: delay + duration + 0.22 });
  return settle(fade, () => { draw.stop(); ride.stop(); svg.remove(); });
}

/** Move a marker through screen points inside `root` (edge traversal in the DFA). */
export function travel(root, points, { duration = 0.25, delay = 0 } = {}) {
  if (!root || points.length < 2) return noop;
  const dot = document.createElement('span');
  dot.className = 'fx-marker';
  dot.setAttribute('aria-hidden', 'true');
  root.appendChild(dot);
  const c = animate(dot, { x: points.map((p) => p.x), y: points.map((p) => p.y), opacity: [0, 1, ...points.slice(2).map(() => 1), 0.9] },
    { duration, delay, ease: 'linear' });
  return settle(c, () => dot.remove());
}

/** Combine cleanups from several effects. */
export const all = (...stops) => () => stops.forEach((s) => s && s());
