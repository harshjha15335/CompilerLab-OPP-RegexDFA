import { Component, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CHAPTERS, hashFor, hashFlag } from '../../data/nav.ts';
import { hasWebGL } from '../../intro/protocol.ts';
import { useSettings } from '../../replay/useReplay.ts';
import { cx, Tag } from '../../ui/kit.tsx';
import { KEYS, read, write } from '../../ui/store.ts';
import { Intro } from './Intro.tsx';
import { Specimen } from './Specimen.tsx';
import { buildSpecimen, type Specimen as Spec } from './specimen.ts';

class SpecimenBoundary extends Component<{ children: ReactNode; onExamples: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="specimen specimen--failed" role="alert" aria-labelledby="specimen-title">
        <h2 className="label" id="specimen-title">Live specimen</h2>
        <p>The specimen couldn't run. Open Examples to load a grammar.</p>
        <button type="button" className="btn" onClick={this.props.onExamples}>Open Examples</button>
      </section>
    );
  }
}

function SpecimenSource({ render }: { render: (s: Spec) => ReactNode }) {
  // building inside render lets the error boundary catch an algorithm failure
  const spec = useMemo(() => buildSpecimen(undefined, undefined, hashFlag('fault') === 'specimen'), []);
  return <>{render(spec)}</>;
}

function Door({ id, numeral, title, pipeline, href, progress }: { id: string; numeral: string; title: string; pipeline: string[]; href: string; progress?: boolean }) {
  const [on, setOn] = useState(false);
  const at = on ? 1 : 0;
  return (
    <li className="door">
      <a href={href} className="door__link" onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}
        aria-describedby={`door-${id}-pipe`}>
        <span className="door__numeral" aria-hidden="true">{numeral}</span>
        <span className="door__title">{title}{progress && <> <Tag kind="progress">In progress</Tag></>}</span>
        <span className="door__pipe" id={`door-${id}-pipe`}>
          {pipeline.map((w, i) => (
            <span key={w} className={cx('door__stage', i === at && 'is-at')}>
              {i > 0 && <span className="door__arrow" aria-hidden="true">→</span>}
              <span className="door__word">{w}{i === at && <motion.i layoutId={`door-mark-${id}`} className="door__mark" aria-hidden="true" transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }} />}</span>
            </span>
          ))}
        </span>
      </a>
    </li>
  );
}

export function Home({ onUse, onExamples }: { onUse: () => void; onExamples: () => void }) {
  const { reduced } = useSettings();
  const webgl = useMemo(() => hasWebGL(), []);
  const forced = hashFlag('intro');                                  // verification hook: ?intro=3d|css|off
  const [introSeen, setIntroSeen] = useState(() => read(KEYS.intro) === '1');
  const intro: '3d' | 'css' | null = forced === 'off' ? null
    : forced === '3d' || forced === 'css' ? forced
    : reduced || introSeen ? null : webgl ? '3d' : 'css';
  const [introDone, setIntroDone] = useState(intro === null);
  const staticSpecimen = reduced || !webgl || hashFlag('specimen') === 'static';
  const mode = !introDone ? 'hidden' : staticSpecimen ? 'static' : 'live';

  return (
    <div className="home">
      <section className="home__lead" aria-labelledby="home-title">
        <p className="label">Plate I · Operator precedence</p>
        <h1 className="home__title" id="home-title">How a compiler decides what to do next.</h1>
        <p className="home__sub">Build the precedence table for a grammar, one relation at a time. Then watch a parser use it.</p>
        <p className="home__links">
          <a className="textlink" href={hashFor('opp', 'grammar')}>Operator precedence <span aria-hidden="true">→</span></a>
          <a className="textlink" href={hashFor('regex', 'tree')}>Regex → DFA <span aria-hidden="true">→</span></a>
        </p>
        <dl className="titleblock" aria-label="Project">
          <div><dt>Project</dt><dd><b className="titleblock__name wordmark">Parse<span className="wordmark__lens">Lens</span></b><span>Interactive GUI for Operator Precedence Parsing and RE → DFA (direct method)</span></dd></div>
          <div><dt>Team</dt><dd>Team Compilers</dd></div>
          <div><dt>Members</dt><dd><span>Harsh Jha <span className="titleblock__id">24BCE0568</span></span><span>Anuj Deshpande <span className="titleblock__id">24BCE0794</span></span></dd></div>
          <div><dt>Year</dt><dd>2026</dd></div>
        </dl>
      </section>

      <nav className="doors" aria-label="Tools">
        <ol>
          {CHAPTERS.map((c) => (
            <Door key={c.id} id={c.id} numeral={c.numeral} title={c.title} pipeline={c.pipeline}
              href={hashFor(c.id, c.stages[0]?.id)} progress={c.id === 'lr'} />
          ))}
        </ol>
      </nav>

      <div className="home__specimen">
        <SpecimenBoundary onExamples={onExamples}>
          <SpecimenSource render={(spec) => <Specimen spec={spec} mode={mode} onUse={onUse} />} />
        </SpecimenBoundary>
      </div>


      {intro && !introDone && (
        <Intro kind={intro} onDone={() => { write(KEYS.intro, '1'); setIntroSeen(true); setIntroDone(true); }} />
      )}
    </div>
  );
}
