import { useCallback, useMemo, useState } from 'react';
import { GRAMMAR_SAMPLES } from '../data/samples.js';
import { analyzeGrammar, runParse, runCompare } from '../replay/pipelines.js';
import { MODES } from '../algorithms/parser.js';

const first = GRAMMAR_SAMPLES[0];
const NO_STRINGS = [];

/** Part A state. Each algorithm runs once per committed input (useMemo), never per step. */
export function useOppModel() {
  const [draft, setDraft] = useState(first.text);
  const [committed, setCommitted] = useState(first.text);
  const [parseDraft, setParseDraft] = useState(first.strings[0]);
  const [parseReq, setParseReq] = useState({ input: first.strings[0], mode: MODES.SAFEGUARDED });
  const [cmpInput, setCmpInput] = useState(first.compare);

  const analysis = useMemo(() => analyzeGrammar(committed), [committed]);
  const sample = GRAMMAR_SAMPLES.find((s) => s.text === committed) ?? null;
  const strings = sample?.strings ?? NO_STRINGS;
  const canParse = analysis.status === 'ok' && analysis.conflictFree;

  const run = useMemo(() => (canParse ? runParse(analysis, parseReq.input, parseReq.mode) : null), [canParse, analysis, parseReq]);
  const cmp = useMemo(() => (canParse ? runCompare(analysis, cmpInput) : null), [canParse, analysis, cmpInput]);
  const fixtureRows = useMemo(() => (canParse ? strings.map((s) => runCompare(analysis, s)) : []), [canParse, analysis, strings]);

  const commit = useCallback(() => setCommitted(draft), [draft]);
  const loadSample = useCallback((s) => {
    setDraft(s.text); setCommitted(s.text);
    const str = s.strings[0] ?? '';
    setParseDraft(str);
    setParseReq((r) => ({ ...r, input: str }));
    setCmpInput(s.compare ?? str);
  }, []);
  const parse = useCallback((input, mode) => { setParseDraft(input); setParseReq({ input, mode }); }, []);

  return { draft, setDraft, committed, commit, dirty: draft !== committed, analysis, sample, strings, canParse,
    parseDraft, setParseDraft, parseReq, parse, run, cmpInput, setCmpInput, cmp, fixtureRows, loadSample };
}
