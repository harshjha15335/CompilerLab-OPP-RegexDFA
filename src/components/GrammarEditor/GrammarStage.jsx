import { useRef } from 'react';
import { GRAMMAR_SAMPLES } from '../../data/samples.js';
import { cx, PlateHead, ProductionList, Tag } from '../common/common.jsx';

const HINTS = {
  ADJACENT_NONTERMINALS: 'Operator grammars cannot contain adjacent non-terminals.',
  EPSILON: 'Rewrite the grammar so that no alternative is empty.',
  RESERVED: '$ marks the bottom of the stack and the end of the input in the parser.',
  SYNTAX: 'Write one rule per line, for example  E -> E + T | T',
};
const KIND_LABEL = { valid: 'VALID', conflict: 'CONFLICT', invalid: 'INVALID' };

function lineOf(error, grammar) {
  if (error.line) return error.line;
  return grammar.productions.find((p) => p.id === error.productionId)?.line ?? null;
}

function Result({ model, go }) {
  const { analysis, dirty } = model;
  const { grammar, errors, status } = analysis;
  if (dirty)
    return (
      <div className="result result--pending" role="status">
        <p className="result__head"><Tag kind="plain">EDITED</Tag> Press <b>Validate grammar</b> (Ctrl + Enter) to check this text.</p>
      </div>
    );
  if (status === 'empty')
    return (
      <div className="result" role="status">
        <p className="result__head">Enter productions to begin.</p>
        <p>Separate grammar symbols with spaces.</p>
      </div>
    );
  if (status !== 'ok')
    return (
      <div className="result result--invalid" role="alert">
        <p className="result__head"><Tag kind="reject">INVALID</Tag> {status === 'syntax'
          ? 'These lines could not be read as productions.'
          : 'This grammar cannot be used by the operator-precedence parser.'}</p>
        <ul className="errors">
          {errors.map((e, i) => {
            const line = lineOf(e, grammar);
            return (
              <li key={i}>
                <span className="errors__where">
                  {e.productionId ? `Production ${e.productionId}` : 'Syntax'}{line ? ` · line ${line}` : ''}
                </span>
                <span className="errors__msg">{e.message}</span>
                {HINTS[e.code] && e.code !== 'EPSILON' && <span className="errors__hint">{HINTS[e.code]}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  return (
    <div className="result result--valid" role="status">
      <p className="result__head"><Tag kind="accept">VALID</Tag> Operator grammar: no ε-productions, no adjacent non-terminals.</p>
      <dl className="facts">
        <div><dt>Start symbol</dt><dd>{grammar.start}</dd></div>
        <div><dt>Non-terminals</dt><dd>{grammar.nonterminals.join('  ')}</dd></div>
        <div><dt>Terminals</dt><dd>{grammar.terminals.join('  ')}</dd></div>
        <div><dt>Productions</dt><dd>{grammar.productions.length}</dd></div>
      </dl>
      {!analysis.conflictFree && (
        <p className="result__warn">
          <Tag kind="conflict">CONFLICT</Tag> Its precedence table is not conflict-free. Stage 1.3 shows where each conflict appears.
        </p>
      )}
      <button type="button" className="btn btn--primary" onClick={() => go('sets')}>Continue to 1.2 LEADING / TRAILING</button>
    </div>
  );
}

export function GrammarStage({ model, go, stage }) {
  const { draft, setDraft, commit, dirty, analysis, loadSample, committed } = model;
  const gutter = useRef(null);
  const lines = draft.split('\n');
  const errorLines = new Set(dirty ? [] : analysis.errors.map((e) => lineOf(e, analysis.grammar)).filter(Boolean));
  const showProductions = !dirty && analysis.grammar.productions.length > 0;

  return (
    <div className="plate">
      <PlateHead no={stage.no} title="Operator grammar">
        One rule per line. Separate symbols with spaces: <code>id</code> is one terminal.
      </PlateHead>
      <div className="plate__body cols cols--grammar">
        <section className="pane">
          <div className="pane-block pane-block--grow">
            <label className="label" htmlFor="grammar-text">Productions</label>
            <div className="editor">
              <div className="editor__gutter" ref={gutter} aria-hidden="true">
                {lines.map((_, i) => <span key={i} className={cx(errorLines.has(i + 1) && 'is-error')}>{i + 1}</span>)}
              </div>
              <textarea id="grammar-text" className="editor__text" value={draft} spellCheck={false} wrap="off"
                autoCapitalize="off" autoCorrect="off"
                onChange={(e) => setDraft(e.target.value)}
                onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.target.scrollTop; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); } }}
                aria-describedby="grammar-help" />
            </div>
            <p id="grammar-help" className="help">
              <code>A -&gt; α | β</code> · the first rule's left side is the start symbol · <code>$</code> is reserved.
            </p>
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={commit}>Validate grammar</button>
              <span className="actions__state">{dirty ? 'Not validated yet' : analysis.status === 'ok' ? 'Validated' : 'Validated, see result'}</span>
            </div>
          </div>
        </section>

        <section className="pane">
          <div className="pane-block">
            <h3 className="label">Validation result</h3>
            <Result model={model} go={go} />
          </div>
          {showProductions && <ProductionList grammar={analysis.grammar} title="Numbered productions (one per alternative)" />}
        </section>

        <section className="pane">
          <div className="pane-block">
            <h3 className="label">Sample library</h3>
            <ol className="samples">
              {GRAMMAR_SAMPLES.map((s, i) => (
                <li key={s.id}>
                  <button type="button" className={cx('sample', s.text === committed && !dirty && 'is-current')} onClick={() => loadSample(s)}>
                    <span className="sample__no">{String.fromCharCode(65 + i)}</span>
                    <span className="sample__main">
                      <span className="sample__title">{s.title} <Tag kind={s.kind === 'valid' ? 'accept' : s.kind === 'conflict' ? 'conflict' : 'reject'}>{KIND_LABEL[s.kind]}</Tag></span>
                      <span className="sample__code">{s.text.split('\n').join('  ·  ')}</span>
                      <span className="sample__note">{s.note}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}
