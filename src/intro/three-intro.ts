// The 3D intro (built separately into assets/intro.js, never imported by the app).
// Extruded ⋖ ⋗ ≐ glyphs fly from a loose cloud onto the exact screen positions of the specimen
// table's cells, then hand off to the DOM table. All geometry is procedural (THREE.Shape +
// ExtrudeGeometry); materials are matcaps generated on a canvas at runtime. No files are loaded.
// (Blob shadows under each glyph were tried and removed: on the paper they read as grey dust.)
import {
  CanvasTexture, ExtrudeGeometry, Group, Mesh, MeshMatcapMaterial, PerspectiveCamera, Scene, Shape, SRGBColorSpace, WebGLRenderer,
  type BufferGeometry,
} from 'three';
import type { Glyph, IntroHandle, IntroModule, IntroOptions, IntroTarget } from './protocol.ts';

const FLY_S = 1.55;          // each glyph's flight
const STAGGER_S = 0.022;     // between glyphs (capped)
const MAX_STAGGER_S = 0.7;
const FOV = 35;

/** A thick stroke from a to b as a closed quad (unit-box coordinates). */
function bar(s: Shape | null, ax: number, ay: number, bx: number, by: number, t: number): Shape {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = (-dy / l) * (t / 2), ny = (dx / l) * (t / 2);
  const shape = s ?? new Shape();
  shape.moveTo(ax + nx, ay + ny); shape.lineTo(bx + nx, by + ny); shape.lineTo(bx - nx, by - ny); shape.lineTo(ax - nx, ay - ny); shape.closePath();
  return shape;
}
function dot(x: number, y: number, r: number): Shape { const s = new Shape(); s.absarc(x, y, r, 0, Math.PI * 2, false); return s; }

function glyphShapes(g: Glyph): Shape[] {
  const t = 0.12;
  if (g === '≐') return [bar(null, -0.42, 0.02, 0.42, 0.02, t), bar(null, -0.42, -0.26, 0.42, -0.26, t), dot(0, 0.3, 0.08)];
  const dir = g === '⋖' ? 1 : -1;               // ⋖ opens to the right, ⋗ to the left
  return [bar(null, -0.42 * dir, 0, 0.42 * dir, 0.34, t), bar(null, -0.42 * dir, 0, 0.42 * dir, -0.34, t), dot(0.14 * dir, 0, 0.075)];
}

/** Ink-on-metal matcap: the relation's ink colour with a soft top-left sheen (no glow). */
function matcap(color: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = color; x.fillRect(0, 0, 128, 128);
  const shade = x.createRadialGradient(64, 64, 20, 64, 64, 64);
  shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = shade; x.fillRect(0, 0, 128, 128);
  const sheen = x.createRadialGradient(46, 40, 2, 46, 40, 46);
  sheen.addColorStop(0, 'rgba(255,250,235,0.75)'); sheen.addColorStop(1, 'rgba(255,250,235,0)');
  x.fillStyle = sheen; x.fillRect(0, 0, 128, 128);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const ease = (p: number) => 1 - (1 - p) ** 3;
const rand = (i: number) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

function play(canvas: HTMLCanvasElement, targets: IntroTarget[], opts: IntroOptions): IntroHandle {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    queueMicrotask(() => opts.onFail(String(e)));
    return { stop() {} };
  }
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  // one world unit = one CSS pixel on the z = 0 plane, origin at the viewport centre
  const camera = new PerspectiveCamera(FOV, w / h, 1, 5000);
  camera.position.z = h / 2 / Math.tan((FOV * Math.PI) / 360);

  const geos = new Map<Glyph, BufferGeometry>();
  const geoFor = (g: Glyph) => {
    let geo = geos.get(g);
    if (!geo) {
      geo = new ExtrudeGeometry(glyphShapes(g), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, curveSegments: 14 });
      geo.center();
      geos.set(g, geo);
    }
    return geo;
  };
  const mats = new Map<string, MeshMatcapMaterial>();
  const matFor = (c: string) => { let m = mats.get(c); if (!m) { m = new MeshMatcapMaterial({ matcap: matcap(c) }); mats.set(c, m); } return m; };

  const items = targets.map((t, i) => {
    const group = new Group();
    const mesh = new Mesh(geoFor(t.glyph), matFor(t.color));
    group.add(mesh);
    scene.add(group);
    const size = t.size * 1.05;
    return {
      group, size,
      from: { x: (rand(i) - 0.62) * w * 0.7, y: (rand(i + 9) - 0.5) * h * 0.6, z: 260 + rand(i + 3) * 380, rx: (rand(i + 5) - 0.5) * 3, ry: (rand(i + 7) - 0.5) * 4 },
      to: { x: t.x - w / 2, y: h / 2 - t.y },
      delay: Math.min(i * STAGGER_S, MAX_STAGGER_S),
    };
  });
  const total = MAX_STAGGER_S + FLY_S;

  let raf = 0, start = 0, settled = false, stopped = false;
  const frames: number[] = [];
  let last = 0, skipTo = -1;
  const render = (now: number) => {
    if (stopped) return;
    if (!start) start = now;
    if (last) frames.push(now - last);
    last = now;
    // frame-time monitor: if the first frames are slow (integrated GPU), jump to the landing
    if (frames.length === 12 && frames.reduce((s, v) => s + v, 0) / 12 > 34) { skipTo = total; canvas.dataset.skipped = 'slow-frames'; }
    const t = skipTo >= 0 ? skipTo : (now - start) / 1000;
    for (const it of items) {
      const p = ease(Math.max(0, Math.min(1, (t - it.delay) / FLY_S)));
      const z = it.from.z * (1 - p);
      it.group.position.set(it.from.x + (it.to.x - it.from.x) * p, it.from.y + (it.to.y - it.from.y) * p, z);
      it.group.rotation.set(it.from.rx * (1 - p), it.from.ry * (1 - p), 0);
      it.group.scale.setScalar(it.size * (0.7 + 0.3 * p));
    }
    renderer.render(scene, camera);
    if (t >= total && !settled) { settled = true; opts.onSettled(); }
    if (t >= total + 0.25) { opts.onDone(); return; }
    raf = requestAnimationFrame(render);
  };

  const lost = (e: Event) => { e.preventDefault(); stop(); opts.onFail('context lost'); };
  const hidden = () => { if (document.hidden) skipTo = total; };
  canvas.addEventListener('webglcontextlost', lost);
  document.addEventListener('visibilitychange', hidden);
  raf = requestAnimationFrame(render);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('webglcontextlost', lost);
    document.removeEventListener('visibilitychange', hidden);
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => { m.matcap?.dispose(); m.dispose(); });
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return { stop };
}

const api: IntroModule = { play };
window.CompilerLabIntro = api;
