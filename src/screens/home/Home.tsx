import { useState } from 'react';
import { motion } from 'motion/react';
import { CHAPTERS, hashFor } from '../../data/nav.ts';
import { cx, Tag } from '../../ui/kit.tsx';

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
              <span className="door__word">{w}{i === at && <motion.i layoutId={`door-mark-${id}`} className="door__mark" aria-hidden="true" transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }} />}</span>
            </span>
          ))}
        </span>
      </a>
    </li>
  );
}

export function Home() {
  return (
    <div className="home">
      <section className="home__lead" aria-labelledby="home-title">
        <h1 className="home__title" id="home-title">How a compiler decides what to do next.</h1>
        <p className="home__sub">Build the precedence table for a grammar, one relation at a time. Then watch a parser use it.</p>
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
              href={hashFor(c.id, c.stages[0]?.id)} planned={c.stages.length === 0} />
          ))}
        </ol>
      </nav>
    </div>
  );
}
