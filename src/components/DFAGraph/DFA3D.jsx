// Optional 3D inspector for the DFA. It draws the same canonical DFA and the same frozen layout
// as the 2D graph (graphModel.js), with a shallow depth offset per state. The 2D graph and the
// transition table stay the reference views; nothing here feeds back into them.
import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei/web/Html';
import { Line } from '@react-three/drei/core/Line';
import * as THREE from 'three';
import { edgeId, layoutDfa, visibleEdgeLabels } from './graphModel.js';
import { useSettings } from '../../replay/useReplay.js';
import { cx } from '../common/common.jsx';

const R = 0.44;                                             // disc radius
const DEPTH = [0, 0.4, -0.3, 0.25, -0.15, 0.35, -0.4, 0.1];  // shallow, fixed z per state
const UNIT = 1 / 100;                                        // layout px -> scene units

function palette(el) {
  const css = getComputedStyle(el);
  const v = (n) => css.getPropertyValue(n).trim();
  return { ink: v('--text'), paper: v('--surface'), muted: v('--muted'), hl: v('--hl'), mark: v('--mark') };
}

/** Scene geometry, computed once per DFA. */
function buildScene(dfa) {
  const model = layoutDfa(dfa);
  const cx0 = (Math.min(...model.nodes.map((n) => n.x)) + Math.max(...model.nodes.map((n) => n.x))) / 2;
  const cy0 = (Math.min(...model.nodes.map((n) => n.y)) + Math.max(...model.nodes.map((n) => n.y))) / 2;
  const pos = {};
  model.nodes.forEach((n, i) => { pos[n.id] = new THREE.Vector3((n.x - cx0) * UNIT, -(n.y - cy0) * UNIT, DEPTH[i % DEPTH.length]); });
  const edges = model.edges.map((e) => {
    const a = pos[e.from], b = pos[e.to];
    let points;
    if (e.loop) {
      const c = new THREE.Vector3(a.x, a.y + R + 0.2, a.z);
      points = Array.from({ length: 28 }, (_, i) => { const t = (-70 - (i / 27) * 220) * Math.PI / 180; return new THREE.Vector3(c.x + Math.cos(t) * 0.26, c.y + Math.sin(t) * 0.26 + 0.02, c.z); });
    } else {
      const dir = new THREE.Vector3().subVectors(b, a);
      const flat = new THREE.Vector3(dir.x, dir.y, 0).normalize();
      const side = new THREE.Vector3(flat.y, -flat.x, 0);        // forward and backward edges bend to opposite sides
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).addScaledVector(side, e.bend * UNIT * 1.9);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const all = curve.getPoints(40);
      points = all.filter((p) => p.distanceTo(a) > R + 0.02 && p.distanceTo(b) > R + 0.12);
    }
    const end = points[points.length - 1], before = points[points.length - 2];
    const tangent = new THREE.Vector3().subVectors(end, before).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    return { ...e, points, tip: end.clone().addScaledVector(tangent, 0.06), quat, label: points[Math.floor(points.length / 2)] };
  });
  const xs = Object.values(pos).map((p) => p.x), ys = Object.values(pos).map((p) => p.y);
  return { pos, edges, width: Math.max(...xs) - Math.min(...xs) + 2.4, height: Math.max(...ys) - Math.min(...ys) + 2.5 };
}

function StateDisc({ s, at, C, active, source, portal }) {
  const lift = useRef(null);
  const { invalidate } = useThree();
  const { reduced } = useSettings();
  const target = active ? 0.2 : 0;                           // the current state steps slightly forward
  useEffect(() => { if (reduced && lift.current) lift.current.position.z = target; invalidate(); }, [target, reduced, invalidate]);
  useFrame(() => {
    const g = lift.current;
    if (!g || Math.abs(g.position.z - target) < 0.002) return;
    g.position.z += (target - g.position.z) * 0.22;
    invalidate();
  });
  const edge = source ? C.mark : C.ink;
  return (
    <group position={at}>
      <group ref={lift}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R, R, 0.07, 56]} />
          <meshStandardMaterial color={active ? C.hl : C.paper} emissive={active ? C.hl : C.paper} emissiveIntensity={0.42} roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0, 0, 0.046]}><ringGeometry args={[R - 0.024, R, 72]} /><meshBasicMaterial color={edge} /></mesh>
        {s.accepting && <mesh position={[0, 0, 0.046]}><ringGeometry args={[R - 0.095, R - 0.075, 72]} /><meshBasicMaterial color={edge} /></mesh>}
        {active && <mesh position={[0, 0, 0.0]}><ringGeometry args={[R + 0.07, R + 0.1, 72]} /><meshBasicMaterial color={C.ink} /></mesh>}
        <Html center position={[0, 0, 0.06]} zIndexRange={[5, 0]} portal={portal} style={{ pointerEvents: 'none' }}>
          <div className={cx('dfa3d__label', active && 'is-active')}>{s.name}</div>
        </Html>
        <Html center position={[0, -R - 0.17, 0.06]} zIndexRange={[5, 0]} portal={portal} style={{ pointerEvents: 'none' }}>
          <div className="dfa3d__label"><small>{`{${s.positions.join(',')}}`}</small></div>
        </Html>
      </group>
    </group>
  );
}

function Edge({ e, label, C, active, portal }) {
  return (
    <group>
      <Line points={e.points} color={C.ink} lineWidth={active ? 3.6 : 1.4} />
      <mesh position={e.tip} quaternion={e.quat}><coneGeometry args={[active ? 0.075 : 0.05, 0.15, 14]} /><meshBasicMaterial color={C.ink} /></mesh>
      <Html center position={e.label} zIndexRange={[4, 0]} portal={portal} style={{ pointerEvents: 'none' }}>
        <span className={cx('dfa3d__sym', active && 'is-active')}>{label}</span>
      </Html>
    </group>
  );
}

/** A small marker that rides the taken edge once per step. */
function Runner({ points, tick, C }) {
  const ref = useRef(null);
  const t = useRef(1);
  const { invalidate } = useThree();
  useEffect(() => { t.current = 0; invalidate(); }, [tick, points, invalidate]);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (t.current >= 1) { m.visible = false; return; }
    t.current = Math.min(1, t.current + dt / 0.28);
    const f = t.current * (points.length - 1), i = Math.min(points.length - 2, Math.floor(f));
    m.position.lerpVectors(points[i], points[i + 1], f - i);
    m.position.z += 0.08;
    m.visible = true;
    invalidate();
  });
  return <mesh ref={ref} visible={false}><sphereGeometry args={[0.075, 20, 20]} /><meshBasicMaterial color={C.hl} /></mesh>;
}

function Scene({ dfa, scene, C, states, labels, activeState, activeEdge, sourceState, tick, look, portal }) {
  const rig = useRef(null);
  const { invalidate, camera, size } = useThree();
  const { reduced } = useSettings();
  // frame the whole automaton once; the camera never travels afterwards
  useEffect(() => {
    const fov = (camera.fov * Math.PI) / 180, aspect = size.width / Math.max(1, size.height);
    const dist = Math.max(scene.height / (2 * Math.tan(fov / 2)), scene.width / (2 * Math.tan(fov / 2) * aspect)) + 0.6;
    camera.position.set(0, dist * 0.16, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, scene, invalidate]);
  // pointer tilt, constrained to ±3° / ±5°
  useFrame(() => {
    const g = rig.current;
    if (!g) return;
    const tx = reduced ? 0 : -look.current.y * (3 * Math.PI / 180), ty = reduced ? 0 : look.current.x * (5 * Math.PI / 180);
    if (Math.abs(g.rotation.x - tx) < 0.0005 && Math.abs(g.rotation.y - ty) < 0.0005) return;
    g.rotation.x += (tx - g.rotation.x) * 0.14;
    g.rotation.y += (ty - g.rotation.y) * 0.14;
    invalidate();
  });
  const start = scene.pos[dfa.start];
  const taken = activeEdge ? scene.edges.find((e) => e.id === edgeId(activeEdge.from, activeEdge.to)) : null;
  return (
    <group ref={rig}>
      <ambientLight intensity={2.2} />
      <directionalLight position={[2, 4, 6]} intensity={1.6} />
      {states.has(dfa.start) && (
        <group>
          <Line points={[[start.x - R - 0.85, start.y, start.z], [start.x - R - 0.16, start.y, start.z]]} color={C.muted} lineWidth={1.4} />
          <mesh position={[start.x - R - 0.1, start.y, start.z]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.05, 0.15, 14]} /><meshBasicMaterial color={C.muted} /></mesh>
        </group>
      )}
      {scene.edges.map((e) => labels.has(e.id) && <Edge key={e.id} e={e} label={labels.get(e.id)} C={C} active={taken?.id === e.id} portal={portal} />)}
      {dfa.states.map((s) => states.has(s.name) && <StateDisc key={s.name} s={s} at={scene.pos[s.name]} C={C} active={s.name === activeState} source={s.name === sourceState} portal={portal} />)}
      {taken && tick != null && !reduced && <Runner points={taken.points} tick={tick} C={C} />}
    </group>
  );
}

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const hasWebGL = () => { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

export function DFA3D({ dfa, visibleStates, visibleTransitions, activeState, activeEdge, sourceState, tick }) {
  const box = useRef(null);
  const look = useRef({ x: 0, y: 0 });
  const portal = useRef(null);   // labels live in a node we own, so they outlive the canvas teardown cleanly
  const { theme } = useSettings();
  const [C, setC] = useState(null);
  const scene = useMemo(() => buildScene(dfa), [dfa]);
  const states = useMemo(() => new Set(visibleStates ?? dfa.states.map((s) => s.name)), [visibleStates, dfa]);
  const labels = useMemo(() => visibleEdgeLabels(visibleTransitions ?? dfa.transitions), [visibleTransitions, dfa]);
  useEffect(() => { if (box.current) setC(palette(box.current)); }, [theme]);
  const [ok] = useState(hasWebGL);
  const fallback = <p className="dfa3d__note">The 3D inspector needs WebGL, which this browser has not made available. The 2D graph shows the same automaton.</p>;
  const move = (e) => {
    const r = box.current.getBoundingClientRect();
    look.current = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
    box.current.firstChild?.dispatchEvent?.(new Event('lookchange'));
  };
  return (
    <div className="dfa3d" ref={box} onPointerMove={move} onPointerLeave={() => { look.current = { x: 0, y: 0 }; }}
      role="img" aria-label={`3D view of the DFA. ${dfa.states.length} states, start ${dfa.start}, accepting ${dfa.accepting.join(', ') || 'none'}. The 2D graph and the table carry the same information.`}>
      {!ok ? fallback : C && (
        <Guard fallback={fallback}>
          <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 32, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: true }}>
            <Wake look={look} />
            <Scene dfa={dfa} scene={scene} C={C} states={states} labels={labels} activeState={activeState} activeEdge={activeEdge} sourceState={sourceState} tick={tick} look={look} portal={portal} />
          </Canvas>
        </Guard>
      )}
      <div className="dfa3d__labels" ref={portal} />
      <p className="dfa3d__note">Move the pointer to tilt. Rendering pauses when nothing changes.</p>
    </div>
  );
}

// With frameloop="demand" nothing renders until asked: wake the loop when the pointer target changes.
function Wake({ look }) {
  const { invalidate, gl } = useThree();
  useEffect(() => {
    const el = gl.domElement.parentElement?.parentElement;
    if (!el) return undefined;
    const wake = () => invalidate();
    el.addEventListener('pointermove', wake);
    el.addEventListener('pointerleave', wake);
    return () => { el.removeEventListener('pointermove', wake); el.removeEventListener('pointerleave', wake); };
  }, [invalidate, gl, look]);
  return null;
}
