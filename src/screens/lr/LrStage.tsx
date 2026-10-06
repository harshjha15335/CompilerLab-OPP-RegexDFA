import { hashFor, type Chapter } from '../../data/nav.ts';
import { Tag } from '../../ui/kit.tsx';
import { Plate } from '../../ui/plate.tsx';

/** Honest placeholder: LR parsing is not implemented in this build. */
export function LrStage({ chapter }: { chapter: Chapter }) {
  return (
    <Plate chapter={chapter} stage={null} title="LR parsing" aside={<Tag kind="progress">In progress</Tag>}>
      <div className="lr">
        <p className="lr__lead">This plate is reserved for LR parsing. Nothing on it runs yet.</p>
        <p>When it is built it will follow the same pattern as the operator-precedence plates: a grammar, the item sets, the parsing table, then a step-by-step parse.</p>
        <ol className="lr__plan" aria-label="Planned stages (not implemented)">
          <li><span className="mono">1</span> Augmented grammar and LR(0) items <Tag kind="progress">Not built</Tag></li>
          <li><span className="mono">2</span> Canonical collection and GOTO <Tag kind="progress">Not built</Tag></li>
          <li><span className="mono">3</span> ACTION / GOTO table <Tag kind="progress">Not built</Tag></li>
          <li><span className="mono">4</span> Parse a string <Tag kind="progress">Not built</Tag></li>
        </ol>
        <p><a className="btn" href={hashFor('opp', 'grammar')}>Open operator precedence instead</a></p>
      </div>
    </Plate>
  );
}
