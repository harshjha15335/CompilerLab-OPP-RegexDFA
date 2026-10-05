import { Empty, PlateHead } from '../components/common/common.jsx';
import { GrammarStage } from '../components/GrammarEditor/GrammarStage.jsx';
import { SetsStage } from '../components/LeadingTrailing/SetsStage.jsx';
import { TableStage } from '../components/PrecedenceTable/TableStage.jsx';
import { ParseStage } from '../components/ParseBench/ParseStage.jsx';
import { ModesStage } from '../components/ParseBench/ModesStage.jsx';

function LrPlaceholder() {
  return (
    <div className="plate">
      <PlateHead no="02" title="LR Parsing">Reserved workspace inside the Bottom-Up Parsing shell.</PlateHead>
      <div className="plate__body plate__body--single">
        <Empty title="This workspace will host the LR parsing branch.">
          LR parsing is not implemented in this build. Operator-precedence parsing, the other bottom-up
          method in this shell, is complete under chapter 01.
        </Empty>
      </div>
    </div>
  );
}

/** A stage that needs results the grammar cannot provide yet. */
function Blocked({ stage, model, go }) {
  const { analysis } = model;
  const reason = analysis.status === 'empty'
    ? 'Enter productions to begin. Separate grammar symbols with spaces.'
    : 'This grammar cannot be used by the operator-precedence parser. Its errors are listed on the Grammar stage.';
  return (
    <div className="plate">
      <PlateHead no={stage.no} title={stage.title} />
      <div className="plate__body plate__body--single">
        <Empty title="No valid operator grammar yet." action={<button type="button" className="btn" onClick={() => go('grammar')}>Open 1.1 Grammar</button>}>
          {reason}
        </Empty>
      </div>
    </div>
  );
}

export function BottomUpPage({ chapter, model, stage, go }) {
  if (chapter.id === 'lr') return <LrPlaceholder />;
  const props = { model, go, stage };
  if (stage.id === 'grammar') return <GrammarStage {...props} />;
  if (model.analysis.status !== 'ok') return <Blocked {...props} />;
  switch (stage.id) {
    case 'sets': return <SetsStage {...props} />;
    case 'table': return <TableStage {...props} />;
    case 'parse': return <ParseStage {...props} />;
    case 'modes': return <ModesStage {...props} />;
    default: return null;
  }
}
