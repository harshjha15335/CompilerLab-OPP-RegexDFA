import { useEffect, useMemo, useRef } from 'react';
import cytoscape from 'cytoscape';
import { edgeId, layoutDfa, visibleEdgeLabels } from './graphModel.js';

// Mirrors styles/tokens.css (Cytoscape draws on canvas and cannot read CSS variables).
const C = { ink: '#171A1C', paper: '#FCFAF4', strong: '#555A57', accent: '#075E6B', handle: '#765000', inactive: '#6A6C67' };
const MONO = '"IBM Plex Mono", "Cascadia Mono", Consolas, "Courier New", monospace';

const STYLE = [
  { selector: 'node', style: {
    shape: 'ellipse', width: 'data(size)', height: 'data(size)', 'background-color': C.paper,
    'border-width': 2, 'border-color': C.ink, 'border-style': 'solid',
    label: 'data(label)', 'text-wrap': 'wrap', 'text-valign': 'center', 'text-halign': 'center',
    'font-family': MONO, 'font-size': 15, 'line-height': 1.25, color: C.ink, 'font-weight': 500,
  } },
  { selector: 'node.accepting', style: { 'border-style': 'double', 'border-width': 7 } },   // true double ring
  { selector: 'node.ghost', style: { width: 1, height: 1, 'border-width': 0, 'background-opacity': 0, label: 'start', 'text-halign': 'left', 'text-margin-x': -4, 'font-size': 13, color: C.strong, 'font-family': MONO } },
  { selector: 'node.source', style: { 'border-width': 4 } },
  { selector: 'node.accepting.source', style: { 'border-width': 9 } },
  { selector: 'node.active', style: { 'outline-width': 4, 'outline-color': C.accent, 'outline-offset': 6, 'outline-style': 'solid', 'border-color': C.accent, color: C.accent, 'font-weight': 600 } },
  { selector: 'node.fresh', style: { 'outline-width': 2, 'outline-color': C.handle, 'outline-offset': 6, 'outline-style': 'dashed' } },
  { selector: 'node.dead', style: { 'outline-style': 'dashed' } },
  { selector: 'edge', style: {
    width: 1.6, 'line-color': C.ink, 'target-arrow-color': C.ink, 'target-arrow-shape': 'triangle', 'arrow-scale': 1.15,
    'curve-style': 'straight', label: 'data(label)', 'font-family': MONO, 'font-size': 16, 'font-weight': 500, color: C.ink,
    'text-background-color': C.paper, 'text-background-opacity': 1, 'text-background-padding': 3, 'text-background-shape': 'rectangle',
  } },
  { selector: 'edge.bent', style: { 'curve-style': 'unbundled-bezier', 'control-point-distances': 'data(bend)', 'control-point-weights': 0.5 } },
  { selector: 'edge.loop', style: { 'curve-style': 'bezier', 'loop-direction': '0deg', 'loop-sweep': '-48deg', 'control-point-step-size': 62 } },
  { selector: 'edge.start', style: { width: 1.6, 'line-color': C.strong, 'target-arrow-color': C.strong, label: '' } },
  { selector: 'edge.active', style: { width: 4.5, 'line-color': C.accent, 'target-arrow-color': C.accent, 'arrow-scale': 1.5, color: C.accent, 'font-weight': 600, 'font-size': 19, 'z-index': 10 } },
  // hidden, not removed: undiscovered parts still occupy their place, so the frame never changes
  { selector: '.hidden', style: { visibility: 'hidden' } },
];

/** Cytoscape is only the renderer. It receives the canonical DFA plus which parts are visible
 *  and active; node positions are preset once per DFA and locked, so nothing ever rearranges. */
export function DFAGraph({ dfa, visibleStates, visibleTransitions, activeState, activeEdge, sourceState, freshState, stuck, tools }) {
  const box = useRef(null);
  const cyRef = useRef(null);
  const model = useMemo(() => layoutDfa(dfa), [dfa]);

  useEffect(() => {
    const pos = Object.fromEntries(model.nodes.map((n) => [n.id, n]));
    const size = Math.min(104, Math.max(60, ...dfa.states.map((s) => s.positions.join(',').length * 8.6 + 34)));
    const start = pos[dfa.start];
    const cy = cytoscape({
      container: box.current,
      elements: [
        { data: { id: '__start', label: 'start' }, position: { x: start.x - size / 2 - 58, y: start.y }, classes: 'ghost' },
        ...dfa.states.map((s) => ({
          data: { id: s.name, label: `${s.name}\n{${s.positions.join(',')}}`, size },
          position: { x: pos[s.name].x, y: pos[s.name].y }, classes: s.accepting ? 'accepting' : '',
        })),
        { data: { id: '__startEdge', source: '__start', target: dfa.start, label: '' }, classes: 'start' },
        ...model.edges.map((e) => ({
          data: { id: e.id, source: e.from, target: e.to, label: '', bend: e.bend },
          classes: e.loop ? 'loop' : e.bend ? 'bent' : '',
        })),
      ],
      layout: { name: 'preset' },
      style: STYLE,
      userZoomingEnabled: false, userPanningEnabled: false, boxSelectionEnabled: false,
      autoungrabify: true, autounselectify: true, minZoom: 0.3, maxZoom: 1.6,
    });
    cyRef.current = cy;
    const fit = () => { cy.resize(); cy.fit(cy.elements(), 18); if (cy.zoom() > 1.3) { cy.zoom(1.3); cy.center(); } };
    // fit against the complete graph so the frame is identical at every step
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box.current);
    document.fonts?.ready.then(() => { if (!cy.destroyed()) { cy.style().update(); fit(); } });
    return () => { ro.disconnect(); cy.destroy(); cyRef.current = null; };
  }, [dfa, model]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const states = new Set(visibleStates ?? dfa.states.map((s) => s.name));
    const labels = visibleEdgeLabels(visibleTransitions ?? dfa.transitions);
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        if (n.id() === '__start') return;
        n.toggleClass('hidden', !states.has(n.id()));
        n.toggleClass('active', n.id() === activeState);
        n.toggleClass('dead', n.id() === activeState && Boolean(stuck));
        n.toggleClass('source', n.id() === sourceState);
        n.toggleClass('fresh', n.id() === freshState);
      });
      cy.edges().forEach((e) => {
        if (e.id() === '__startEdge') { e.toggleClass('hidden', !states.has(dfa.start)); return; }
        const label = labels.get(e.id());
        e.toggleClass('hidden', label === undefined);
        e.data('label', label ?? '');
        e.toggleClass('active', Boolean(activeEdge) && e.id() === edgeId(activeEdge.from, activeEdge.to));
      });
    });
  }, [dfa, model, visibleStates, visibleTransitions, activeState, activeEdge, sourceState, freshState, stuck]);

  const summary = `DFA with ${dfa.states.length} states. Start state ${dfa.start}. Accepting: ${dfa.accepting.join(', ') || 'none'}. `
    + dfa.transitions.map((t) => `${t.from} on ${t.symbol} goes to ${t.to}`).join('; ') + '.';
  return (
    <figure className="dfagraph">
      <div className="dfagraph__canvas" ref={box} role="img" aria-label={summary} />
      <figcaption className="legend legend--graph">
        <span><i className="lg lg--start" aria-hidden="true" />start arrow</span>
        <span><i className="lg lg--accept" aria-hidden="true" />accepting (double ring)</span>
        <span><i className="lg lg--active" aria-hidden="true" />current state (outer ring)</span>
        {tools && <span className="legend__tools">{tools}</span>}
      </figcaption>
    </figure>
  );
}
