import { useRef, useState } from 'react';
import { GRAMMAR_SAMPLES } from '../../data/samples.ts';
import { hashFor, type Chapter, type Stage } from '../../data/nav.ts';
import type { Grammar, GrammarError } from '../../core/index.ts';
import type { OppModel } from '../../models.ts';
import { grammarWarnings } from '../../replay/warnings.ts';
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
      {grammarWarnings(g).map((w) => (
        <p key={w.code} className="result__note"><Tag kind="plain">Note</Tag> {w.message}</p>
      ))}
      {!analysis.conflictFree && (
        <p className="result__warn"><Tag kind="conflict">Conflict</Tag> Its precedence table will have a cell with more than one relation. Stage 3 shows the exact step where that happens.</p>
      )}
      <a className="btn btn--primary" href={hashFor('opp', 'sets')}>Derive LEADING and TRAILING</a>
    </div>
  );
}

export function GrammarStage({ chapter, stage, model }: { chapter: Chapter; stage: Stage; model: OppModel }) {
  const { draft, setDraft, commit, dirty, analysis, loadSample, committed, custom, restoreCustom } = model;
  const gutter = useRef<HTMLDivElement>(null);
  // Checking an unchanged grammar still gets a visible answer (the result itself would not change).
  const [recheck, setRecheck] = useState(false);
  const check = () => { setRecheck(!dirty); commit(); };
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
              onChange={(e) => { setRecheck(false); setDraft(e.target.value); }}
              onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); } }} />
          </div>
          <p id="grammar-help" className="help">One rule per line. Separate symbols with spaces, so <code>id</code> is one terminal. The first rule's left side is the start symbol.</p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={check} aria-keyshortcuts="Control+Enter">Check grammar</button>
            <span className={cx('actions__state', dirty && 'is-dirty')} role="status">
              {dirty ? 'Edited, not checked yet' : recheck ? 'Checked again: nothing changed since the last check' : 'Checked'}</span>
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
            {custom !== null && custom !== committed && (
              <li>
                <button type="button" className="sample" onClick={() => { setRecheck(false); void restoreCustom(); }}>
                  <span className="sample__title">Your grammar</span>
                  <Tag kind="plain">Saved</Tag>
                  <span className="sample__shows">Bring back the grammar you wrote before loading an example.</span>
                </button>
              </li>
            )}
            {GRAMMAR_SAMPLES.map((s) => (
              <li key={s.id}>
                <button type="button" className={cx('sample', s.text === committed && !dirty && 'is-current')} onClick={() => { setRecheck(false); void loadSample(s); }}
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

const CUSTOM = '__custom';

/** Switch the analysed grammar from any later stage, so a viva never has to walk back to stage 1. */
export function GrammarPicker({ model }: { model: OppModel }) {
  const { committed, loadSample, custom, restoreCustom } = model;
  const current = GRAMMAR_SAMPLES.find((s) => s.text === committed);
  // "Your grammar" is listed whenever there is one: the one on display, or one a sample replaced.
  const hasCustom = !current || custom !== null;
  return (
    <label className="picker">
      <span className="picker__label">Grammar</span>
      <select className="picker__select" value={current?.id ?? CUSTOM}
        onChange={(e) => {
          if (e.target.value === CUSTOM) { void restoreCustom(); return; }
          const s = GRAMMAR_SAMPLES.find((x) => x.id === e.target.value);
          if (s) void loadSample(s);
        }}>
        {hasCustom && <option value={CUSTOM}>Your grammar</option>}
        {GRAMMAR_SAMPLES.map((s) => <option key={s.id} value={s.id}>{s.title} ({KIND[s.kind].word.toLowerCase()})</option>)}
      </select>
    </label>
  );
}
