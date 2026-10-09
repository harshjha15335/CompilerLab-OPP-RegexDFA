import { Component, useMemo, useState, type ReactNode } from 'react';
import { CHAPTERS, hashFor } from '../../data/nav.ts';
import { useSettings } from '../../replay/useReplay.ts';
import { cx, Tag } from '../../ui/kit.tsx';
import { Specimen } from './Specimen.tsx';
import { buildSpecimen, type Specimen as Spec } from './specimen.ts';

class SpecimenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="specimen specimen--failed" role="alert" aria-labelledby="specimen-title">
        <h2 className="label" id="specimen-title">Live specimen</h2>
        <p>The specimen couldn't run. Open the grammar stage to load one.</p>
        <a className="btn" href={hashFor('opp', 'grammar')}>Open 1 Grammar</a>
      </section>
    );
  }
}

function SpecimenSource({ render }: { render: (s: Spec) => ReactNode }) {
  // building inside render lets the error boundary catch an algorithm failure
  const spec = useMemo(() => buildSpecimen(), []);
  return <>{render(spec)}</>;
}

/** A chapter entry. A planned chapter is set quieter than a working one: hierarchy follows what exists. */
function Door({ id, numeral, title, pipeline, href, planned }: { id: string; numeral: string; title: string; pipeline: string[]; href: string; planned?: boolean }) {
  const [on, setOn] = useState(false);
  const at = on ? 1 : 0;
  return (
    <li className={cx('door', planned && 'door--planned')}>
      <a href={href} className="door__link" onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}
        aria-describedby={`door-${id}-pipe`}>
        <span className="door__numeral" aria-hidden="true">{numeral}</span>
        <span className="door__title">{title}{planned && <> <Tag kind="progress">Planned</Tag></>}</span>
        <span className="door__pipe" id={`door-${id}-pipe`}>
          {pipeline.map((w, i) => (
            <span key={w} className={cx('door__stage', i === at && 'is-at')}>
              {i > 0 && <span className="door__arrow" aria-hidden="true">→</span>}
              <span className="door__word">{w}{i === at && <i className="door__mark" aria-hidden="true" />}</span>
            </span>
          ))}
        </span>
      </a>
    </li>
  );
}

export function Home({ onUse }: { onUse: () => void }) {
  const { reduced } = useSettings();
  return (
    <div className="home">
      <section className="home__lead" aria-labelledby="home-title">
        <h1 className="home__title" id="home-title">How a compiler decides what to do next.</h1>
        <p className="home__sub">Build the precedence table for a grammar, one relation at a time. Then watch a parser use it.</p>
        <dl className="titleblock" aria-label="Project">
          <div><dt>Project</dt><dd><b className="titleblock__name wordmark">Parse<span className="wordmark__lens">Lens</span></b><span>Interactive GUI for Operator Precedence Parsing and RE → DFA (direct method)</span></dd></div>
          <div><dt>Team</dt><dd>Team Compilers</dd></div>
          <div><dt>Members</dt><dd><span>Harsh Jha <span className="titleblock__id">24BCE0568</span></span><span>Anuj Deshpande <span className="titleblock__id">24BCE0794</span></span></dd></div>
          <div><dt>Semester</dt><dd>Fall Semester 26–27</dd></div>
        </dl>
      </section>

      <nav className="doors" aria-label="Tools">
        <ol>
          {CHAPTERS.map((c) => (
            <Door key={c.id} id={c.id} numeral={c.numeral} title={c.title} pipeline={c.pipeline}
              href={hashFor(c.id, c.stages[0]?.id)} planned={c.stages.length === 0} />
          ))}
        </ol>
      </nav>

      <div className="home__specimen">
        <SpecimenBoundary>
          <SpecimenSource render={(spec) => <Specimen spec={spec} mode={reduced ? 'static' : 'live'} onUse={onUse} />} />
        </SpecimenBoundary>
      </div>
    </div>
  );
}
