import { useState } from 'react';
import { DFAGraph } from './DFAGraph.jsx';
import { DFA3D } from './DFA3D.jsx';

/** The DFA drawing with a 2D / 3D switch. 2D (Cytoscape) is the default and the reference view.
 *  The 3D canvas is only mounted while it is selected, so it costs nothing otherwise. */
export function DFAView({ tools, tick, fx, onView, ...graph }) {
  const [view, setViewState] = useState('2d');
  const setView = (v) => { setViewState(v); onView?.(v); };
  const toggle = (
    <span className="view-toggle" role="group" aria-label="Graph view">
      <button type="button" aria-pressed={view === '2d'} onClick={() => setView('2d')}>2D</button>
      <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D inspector</button>
    </span>
  );
  if (view === '2d') return <DFAGraph {...graph} fx={fx} tools={<>{tools}{toggle}</>} />;
  return (
    <figure className="dfagraph">
      <DFA3D dfa={graph.dfa} visibleStates={graph.visibleStates} visibleTransitions={graph.visibleTransitions}
        activeState={graph.activeState} activeEdge={graph.activeEdge} sourceState={graph.sourceState} tick={fx ? tick : null} />
      <figcaption className="legend legend--graph">
        <span>Same automaton and layout as the 2D graph, with a small depth offset per state.</span>
        <span className="legend__tools">{tools}{toggle}</span>
      </figcaption>
    </figure>
  );
}
