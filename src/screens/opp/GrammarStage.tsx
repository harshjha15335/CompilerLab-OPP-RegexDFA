import { useRef } from 'react';
import { GRAMMAR_SAMPLES } from '../../data/samples.ts';
import { hashFor, type Chapter, type Stage } from '../../data/nav.ts';
import type { Grammar, GrammarError } from '../../core/index.ts';
import type { OppModel } from '../../models.ts';
import { cx, ProductionList, Tag } from '../../ui/kit.tsx';
import { Plate } from '../../ui/plate.tsx';

// Plain-language follow-up for each error code (the core's message says what; this says how to fix it).
const FIX: Partial<Record<GrammarError['code'], string>> = {
  ADJACENT_NONTERMINALS: 'Put an operator between them, or merge them into one non-terminal. The parser decides by comparing terminals, so it needs one between every pair of non-terminals.',
  EPSILON: 'Remove the empty alternative. A rule that can vanish leaves the parser with no terminal to compare.',
  RESERVED: '$ marks the bottom of the stack and the end of the input, so a grammar cannot use it. Rename that terminal.',
  SYNTAX: 'Write one rule per line, like  E -> E + T | T',
};
const KIND: Record<string, { tag: 'accept' | 'conflict' | 'reject'; word: string }> = {
  valid: { tag: 'accept', word: 'Valid' }, conflict: { tag: 'conflict', word: 'Conflict' }, invalid: { tag: 'reject', word: 'Invalid' },
};

const lineOf = (e: GrammarError, g: Grammar) => e.line ?? g.productions.find((p) => p.id === e.productionId)?.line ?? null;

function Result({ model }: { model: OppModel }) {
  const { analysis, dirty } = model;
  if (dirty)
    return <div className="result" role="status"><p className="result__head">Edited. Press <b>Check grammar</b> (Ctrl + Enter) to check it again.</p></div>;
  if (analysis.status === 'empty')
    return <div className="result" role="status"><p className="result__head">The editor is empty.</p><p>Type a rule such as <code>E -&gt; E + T | T</code>, or load an example.</p></div>;
  if (analysis.status !== 'ok')
    return (
      <div className="result result--bad" role="alert">
        <p className="result__head"><Tag kind="reject">Invalid</Tag>
          {analysis.status === 'syntax' ? 'Some lines are not rules.' : 'This is not an operator grammar, so the precedence parser cannot use it.'}</p>
        <ul className="errors">
          {analysis.errors.map((e, i) => {
            const line = lineOf(e, analysis.grammar);
            return (
              <li key={i}>
                <span className="errors__where">{e.productionId ? `Production ${e.productionId}` : 'Syntax'}{line ? `, line ${line}` : ''}</span>
                <span className="errors__msg">{e.message}</span>
                {FIX[e.code] && <span className="errors__fix">{FIX[e.code]}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    );
  const g = analysis.grammar;
  return (
    <div className="result result--ok" role="status">
      <p className="result__head"><Tag kind="accept">Valid</Tag> An operator grammar: no ε-productions and no two non-terminals side by side.</p>
      <dl className="facts">
        <div><dt>Start symbol</dt><dd className="mono">{g.start}</dd></div>
        <div><dt>Non-terminals</dt><dd className="mono">{g.nonterminals.join('  ')}</dd></div>
        <div><dt>Terminals</dt><dd className="mono">{g.terminals.join('  ')}</dd></div>
      </dl>
      {!analysis.conflictFree && (
        <p className="result__warn"><Tag kind="conflict">Conflict</Tag> Its precedence table will have a cell with two relations. Stage 3 shows the exact step where that happens.</p>
      )}
      <a className="btn btn--primary" href={hashFor('opp', 'sets')}>Derive LEADING and TRAILING</a>
    </div>
  );
}

export function GrammarStage({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: OppModel }) {
  const { draft, setDraft, commit, dirty, analysis, loadSample, committed } = model;
  const gutter = useRef<HTMLDivElement>(null);
  const lines = draft.split('\n');
  const errorLines = new Set(dirty ? [] : analysis.errors.map((e) => lineOf(e, analysis.grammar)).filter((x): x is number => x !== null));
  return (
    <Plate chapter={chapter} stage={stage} className="plate--grammar">
      <div className="split split--grammar">
        <section className="pane">
          <label className="label" htmlFor="grammar-text">Productions</label>
          <div className={cx('editor', errorLines.size > 0 && 'has-error')}>
            <div className="editor__gutter" ref={gutter} aria-hidden="true">
              {lines.map((_, i) => <span key={i} className={cx(errorLines.has(i + 1) && 'is-error')}>{i + 1}</span>)}
            </div>
            <textarea id="grammar-text" className="editor__text" value={draft} spellCheck={false} wrap="off" rows={6}
              autoCapitalize="off" autoCorrect="off" aria-describedby="grammar-help"
              onChange={(e) => setDraft(e.target.value)}
              onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); } }} />
          </div>
          <p id="grammar-help" className="help">One rule per line. Separate symbols with spaces, so <code>id</code> is one terminal. The first rule's left side is the start symbol.</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={commit} aria-keyshortcuts="Control+Enter">Check grammar</button>
            <span className="actions__state">{dirty ? 'Not checked yet' : 'Checked'}</span>
          </div>
        </section>
        <section className="pane pane--scroll" aria-label="Check result">
          <h2 className="label">Result</h2>
          <Result model={model} />
          {!dirty && analysis.grammar.productions.length > 0 && (
            <ProductionList productions={analysis.grammar.productions} caption="Numbered productions, one per alternative" />
          )}
          <h2 className="label label--gap" id="grammar-examples">Examples</h2>
          <ul className="samples">
            {GRAMMAR_SAMPLES.map((s) => (
              <li key={s.id}>
                <button type="button" className={cx('sample', s.text === committed && !dirty && 'is-current')} onClick={() => loadSample(s)}
                  aria-pressed={s.text === committed && !dirty}>
                  <span className="sample__title">{s.title}</span>
                  <Tag kind={KIND[s.kind].tag}>{KIND[s.kind].word}</Tag>
                  <span className="sample__shows">{s.shows}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Plate>
  );
}
