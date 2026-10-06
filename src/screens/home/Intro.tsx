// First-visit intro: extruded ⋖ ⋗ ≐ glyphs assemble into the specimen's precedence table and hand
// off to the real DOM table. Under 4 s, skippable (button, Esc, any key), remembered.
// kind '3d': the separately built three.js bundle (assets/intro.js), injected as a classic script.
// kind 'css': no WebGL: the same hand-off with DOM glyphs and CSS 3D, in about 1.8 s.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Glyph, IntroHandle, IntroTarget } from '../../intro/protocol.ts';
import { Keycap } from '../../ui/hardware.tsx';
import { cx } from '../../ui/kit.tsx';

const HARD_CAP_MS = 3900;
const LOAD_TIMEOUT_MS = 1500;

function collectTargets(): IntroTarget[] {
  return [...document.querySelectorAll<HTMLElement>('.specimen .ptable .pcell .rel')].map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { glyph: (el.dataset.rel ?? '⋖') as Glyph, x: r.left + r.width / 2, y: r.top + r.height / 2, size: parseFloat(cs.fontSize) || 20, color: cs.color };
  });
}

function loadIntroScript(): Promise<void> {
  if (window.CompilerLabIntro) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    if (import.meta.env.DEV) { s.type = 'module'; s.src = '/src/intro/three-intro.ts'; }
    else s.src = './assets/intro.js';            // classic script: allowed on file:// pages
    s.async = true;
    const t = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
    s.onload = () => { clearTimeout(t); window.CompilerLabIntro ? resolve() : reject(new Error('no module')); };
    s.onerror = () => { clearTimeout(t); reject(new Error('load failed')); };
    document.head.appendChild(s);
  });
}

function CssHandoff({ targets, onSettled }: { targets: IntroTarget[]; onSettled: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const els = [...(layer.current?.children ?? [])] as HTMLElement[];
    const w = window.innerWidth, h = window.innerHeight;
    const anims = els.map((el, i) => {
      const t = targets[i];
      // deterministic scatter: glyphs start as a loose stack left of centre, tilted in depth
      const sx = w * 0.3 + Math.sin(i * 2.3) * w * 0.16, sy = h * 0.45 + Math.cos(i * 1.7) * h * 0.22;
      return el.animate([
        { transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) rotateX(${50 + (i % 5) * 6}deg) rotateY(${-30 + (i % 7) * 9}deg) scale(1.9)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${t.x}px, ${t.y}px) translate(-50%, -50%) rotateX(0deg) rotateY(0deg) scale(1)`, opacity: 1 },
      ], { duration: 1150, delay: Math.min(i * 18, 420), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
    });
    Promise.all(anims.map((a) => a.finished)).then(onSettled, () => {});
    return () => anims.forEach((a) => a.cancel());
  }, [targets, onSettled]);
  return (
    <div className="intro__css" ref={layer} aria-hidden="true">
      {targets.map((t, i) => <span key={i} className="intro__glyph" style={{ fontSize: t.size, color: t.color }}>{t.glyph}</span>)}
    </div>
  );
}

export function Intro({ kind, onDone }: { kind: '3d' | 'css'; onDone: () => void }) {
  const [mode, setMode] = useState(kind);
  const [targets, setTargets] = useState<IntroTarget[] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const finished = useRef(false);
  const finish = useRef(() => {});
  finish.current = () => {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    setTimeout(onDone, 280);
  };

  // targets are read once the specimen has rendered its finished table and the fonts have settled
  useEffect(() => {
    let r1 = 0, r2 = 0, live = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    (fonts?.ready ?? Promise.resolve()).then(() => {
      r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => { if (live) setTargets(collectTargets()); }); });
    });
    return () => { live = false; cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  // skip: Esc, Enter or any other key; hard cap so it never runs longer than 4 s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Tab' && e.key !== 'Shift') { e.preventDefault(); finish.current(); } };
    window.addEventListener('keydown', onKey, { capture: true });
    const cap = setTimeout(() => finish.current(), HARD_CAP_MS);
    return () => { window.removeEventListener('keydown', onKey, { capture: true }); clearTimeout(cap); };
  }, []);

  useEffect(() => {
    if (mode !== '3d' || !targets || !canvas.current) return undefined;
    let handle: IntroHandle | null = null, cancelled = false;
    loadIntroScript().then(() => {
      if (cancelled || !canvas.current) return;
      try {
        handle = window.CompilerLabIntro!.play(canvas.current, targets, {
          onSettled: () => finish.current(),
          onDone: () => finish.current(),
          onFail: () => { if (!cancelled) setMode('css'); },
        });
      } catch { setMode('css'); }
    }, () => { if (!cancelled) setMode('css'); });
    return () => { cancelled = true; handle?.stop(); };
  }, [mode, targets]);

  return (
    <div className={cx('intro', `intro--${mode}`, leaving && 'is-leaving')} data-intro={mode}>
      {mode === '3d' && <canvas ref={canvas} className="intro__canvas" aria-hidden="true" />}
      {mode === 'css' && targets && <CssHandoff targets={targets} onSettled={() => finish.current()} />}
      <p className="intro__caption" aria-live="polite">Three relations decide every move: <b>⋖</b> shift, <b>≐</b> shift, <b>⋗</b> reduce.</p>
      <div className="intro__skip">
        <Keycap label="Skip the intro" shortcut="Escape" onPress={() => finish.current()} wide><span className="keycap__text">Skip intro</span></Keycap>
      </div>
    </div>
  );
}
