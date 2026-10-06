// Motion layer. Every effect is a one-shot overlay played AFTER React has rendered the state for a
// step. Rules that keep motion from ever owning algorithm state:
//  1. Effects use Element.animate() with fill 'none' or 'backwards' only, so when an animation ends
//     or is cancelled no inline style remains: the DOM is exactly what React rendered.
//  2. Travelling things (ghost tokens, provenance paths, markers) are drawn in #fx-layer, a fixed
//     layer outside the app root, and removed when they end or are cancelled.
//  3. Every running effect is registered; cancelAllFx() stops all of them at once. The replay
//     controller calls it on Back, seek, phase jumps and when a new steps[] is bound.
export const EASE = 'cubic-bezier(.2,.7,.2,1)';
export const DUR: Record<"press" | "fast" | "normal" | "algorithm" | "path", number> = { press: 120, fast: 150, normal: 220, algorithm: 300, path: 340 };

type Stop = () => void;
const noop: Stop = () => {};
const running = new Set<Stop>();
const NS = 'http://www.w3.org/2000/svg';

const reducedNow = () =>
  typeof document === 'undefined' || document.documentElement.dataset.motion === 'reduced';

function track(stop: Stop): Stop {
  let done = false;
  const once = () => { if (done) return; done = true; running.delete(once); stop(); };
  running.add(once);
  return once;
}

export function cancelAllFx() {
  for (const stop of [...running]) stop();
}

/** Number of overlay effects alive right now (used by the verification script). */
export const liveFxCount = () => running.size;

function layer(): HTMLElement {
  let el = document.getElementById('fx-layer');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-layer';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

function play(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Stop {
  if (!el || reducedNow() || typeof (el as HTMLElement).animate !== 'function') return noop;
  const a = (el as HTMLElement).animate(frames, { easing: EASE, fill: 'backwards', ...opts });
  const stop = track(() => a.cancel());
  a.finished.then(stop, stop);
  return stop;
}

export const all = (...stops: (Stop | undefined | null)[]): Stop => () => stops.forEach((s) => s && s());

/** A freshly inserted glyph or value scales and fades into place. */
export const pop = (el: Element | null | undefined, { delay = 0, duration = DUR.normal, from = 0.8 } = {}) =>
  play(el, [{ opacity: 0, transform: `scale(${from})` }, { opacity: 1, transform: 'none' }], { duration, delay });

/** A new set member settles in from a short distance. */
export const settle = (el: Element | null | undefined, { delay = 0, duration = DUR.normal, dy = -10 } = {}) =>
  play(el, [{ opacity: 0, transform: `translateY(${dy}px)` }, { opacity: 1, transform: 'none' }], { duration, delay });

/** Something that already existed is found again: a short nudge, no new content. */
export const nudge = (el: Element | null | undefined, { duration = DUR.algorithm } = {}) =>
  play(el, [{ transform: 'none' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'none' }], { duration, fill: 'none' });

/** Reveal an element (SVG text, annotation) after a delay. */
export const reveal = (el: Element | null | undefined, { delay = 0, duration = DUR.fast } = {}) =>
  play(el, [{ opacity: 0 }, { opacity: 1 }], { duration, delay });

/** Collapse elements toward their common centre (reduce: the handle pulls together). */
export function gather(els: Element[], { delay = 0, duration = DUR.algorithm } = {}): Stop {
  if (!els.length) return noop;
  const rects = els.map((e) => e.getBoundingClientRect());
  const cx = (rects[0].left + rects[rects.length - 1].right) / 2;
  return all(...els.map((e, i) => {
    const dx = cx - (rects[i].left + rects[i].width / 2);
    return play(e, [{ transform: 'none' }, { transform: `translateX(${dx * 0.35}px) scale(.94)` }], { duration, delay, fill: 'none' });
  }));
}

/** Shared-element morph: `el` (just mounted) grows out of `from` (the thing that was clicked).
 *  A single FLIP measured once on open, instead of keeping every possible source registered. */
export function morph(el: Element | null | undefined, from: Element | null | undefined, { duration = 240 } = {}): Stop {
  if (!el || !from) return noop;
  const a = from.getBoundingClientRect(), b = el.getBoundingClientRect();
  if (!a.width || !b.width) return noop;
  return play(el, [
    { transformOrigin: 'top left', transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`, opacity: 0.4 },
    { transformOrigin: 'top left', transform: 'none', opacity: 1 },
  ], { duration });
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** A visual copy of `from` travels to `to`. The real target is already rendered; it is only
 *  transparent (by animation, not by style) until the copy lands. */
export function fly(from: Element | null | undefined, to: Element | null | undefined, { duration = 260, delay = 0, shrink = false } = {}): Stop {
  if (!from || !to || reducedNow()) return noop;
  const ra = from.getBoundingClientRect(), rb = to.getBoundingClientRect();
  if (!ra.width || !rb.width) return noop;
  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  ghost.querySelectorAll('.slot__mark, .tcell__mark, .handle__label, .handle__bracket').forEach((n) => n.remove());
  ghost.classList.add('fx-ghost');
  Object.assign(ghost.style, { left: `${ra.left}px`, top: `${ra.top}px`, width: `${ra.width}px`, height: `${ra.height}px` });
  layer().appendChild(ghost);
  const a = center(ra), b = center(rb);
  const s = shrink ? Math.max(0.3, rb.width / ra.width) : 1;
  const anim = ghost.animate(
    [{ transform: 'none', opacity: 1 }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${s})`, opacity: shrink ? 0.4 : 1 }],
    { duration, delay, easing: EASE, fill: 'both' });
  const hide = (to as HTMLElement).animate([{ opacity: 0 }, { opacity: 0 }], { duration: duration + delay, fill: 'none' });
  const stop = track(() => { anim.cancel(); hide.cancel(); ghost.remove(); });
  anim.finished.then(stop, stop);
  return stop;
}

/** An SVG overlay just big enough for `d` (given in viewport coordinates), so animating it only
 *  repaints a small layer instead of the whole screen. Returns the svg, its path and its offset. */
function overlaySvg(d: string, box: { x1: number; y1: number; x2: number; y2: number }, pad = 8) {
  const svg = document.createElementNS(NS, 'svg');
  const x = Math.floor(Math.min(box.x1, box.x2) - pad), y = Math.floor(Math.min(box.y1, box.y2) - pad);
  const w = Math.ceil(Math.abs(box.x2 - box.x1) + pad * 2), h = Math.ceil(Math.abs(box.y2 - box.y1) + pad * 2);
  svg.setAttribute('class', 'fx-svg');
  svg.setAttribute('width', String(w)); svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  svg.style.left = `${x}px`; svg.style.top = `${y}px`;
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('pathLength', '1');
  svg.appendChild(path);
  layer().appendChild(svg);
  return { svg, path };
}

/** A causal path from the thing that caused a value to the place the value appears: the path draws
 *  once, a dot rides it, then it fades. Drawn in the fixed overlay so it never touches app DOM. */
export function beam(from: Element | null | undefined, to: Element | null | undefined, { duration = DUR.path, delay = 0 } = {}): Stop {
  if (!from || !to || reducedNow()) return noop;
  const ra = from.getBoundingClientRect(), rb = to.getBoundingClientRect();
  if (!ra.width || !rb.width) return noop;
  const ltr = ra.left + ra.width / 2 < rb.left + rb.width / 2;
  const x1 = ltr ? ra.right : ra.left, y1 = ra.top + ra.height / 2;
  const x2 = ltr ? rb.left : rb.right, y2 = rb.top + rb.height / 2;
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  const { svg, path } = overlaySvg(d, { x1, y1, x2, y2 });
  svg.classList.add('fx-beam');
  const dot = document.createElement('span');
  dot.className = 'fx-dot';
  dot.style.offsetPath = `path("${d}")`;
  layer().appendChild(dot);
  const opts = { duration, delay, easing: EASE, fill: 'both' as const };
  const a1 = path.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], opts);
  const a2 = dot.animate([{ offsetDistance: '0%', opacity: 0 }, { offsetDistance: '15%', opacity: 1, offset: 0.15 }, { offsetDistance: '100%', opacity: 1 }], opts);
  const a3 = svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.normal, delay: delay + duration + 180, fill: 'both' });
  const a4 = dot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.normal, delay: delay + duration + 180, fill: 'forwards' });
  const stop = track(() => { a1.cancel(); a2.cancel(); a3.cancel(); a4.cancel(); svg.remove(); dot.remove(); });
  a3.finished.then(stop, stop);
  return stop;
}

/** Re-draw an existing SVG stroke (an edge just discovered, a followpos arrow) as an overlay copy
 *  that draws on top of it, so the large figure SVG is never repainted frame by frame. */
export function drawOver(el: SVGGeometryElement | null | undefined, { delay = 0, duration = DUR.algorithm, cls = '' } = {}): Stop {
  if (!el || reducedNow()) return noop;
  const m = el.getScreenCTM();
  const len = el.getTotalLength?.();
  if (!m || !len) return noop;
  const pts: string[] = [];
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const p = el.getPointAtLength((len * i) / N);
    const q = new DOMPoint(p.x, p.y).matrixTransform(m);
    pts.push(`${i ? 'L' : 'M'} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
    x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y); x2 = Math.max(x2, q.x); y2 = Math.max(y2, q.y);
  }
  const { svg, path } = overlaySvg(pts.join(' '), { x1, y1, x2, y2 });
  svg.classList.add('fx-draw');
  if (cls) svg.classList.add(cls);
  const a = path.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1, opacity: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0, opacity: 1, offset: 0.8 }, { strokeDasharray: '1 1', strokeDashoffset: 0, opacity: 0 }],
    { duration: duration * 1.25, delay, easing: EASE, fill: 'both' });
  const stop = track(() => { a.cancel(); svg.remove(); });
  a.finished.then(stop, stop);
  return stop;
}

/** A ring that settles around an element (DFA current state): an overlay DOM circle animated with
 *  transform and opacity only, which the compositor can run without repainting the graph. */
export function ring(el: Element | null | undefined, { delay = 0, duration = DUR.normal } = {}): Stop {
  if (!el || reducedNow()) return noop;
  const r = el.getBoundingClientRect();
  if (!r.width) return noop;
  const o = document.createElement('span');
  o.className = 'fx-ring';
  Object.assign(o.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  layer().appendChild(o);
  const a = o.animate([{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 0 }], { duration: duration * 1.6, delay, easing: EASE, fill: 'both' });
  const stop = track(() => { a.cancel(); o.remove(); });
  a.finished.then(stop, stop);
  return stop;
}

/** A marker dot travels through viewport points (DFA simulation: along the edge just taken). */
export function travel(points: { x: number; y: number }[], { duration = 260, delay = 0 } = {}): Stop {
  if (points.length < 2 || reducedNow()) return noop;
  const dot = document.createElement('span');
  dot.className = 'fx-marker';
  layer().appendChild(dot);
  const frames = points.map((p, i) => ({ transform: `translate(${p.x}px, ${p.y}px)`, opacity: i === 0 ? 0 : 1 }));
  const anim = dot.animate(frames, { duration, delay, easing: 'linear', fill: 'both' });
  const stop = track(() => { anim.cancel(); dot.remove(); });
  anim.finished.then(stop, stop);
  return stop;
}
