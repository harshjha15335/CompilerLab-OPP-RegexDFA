// App-level state for both tools. Each algorithm runs once per committed input (useMemo), never
// per step. Models live in App so inputs and results survive navigation.
import { useCallback, useMemo, useState } from 'react';
import { EXPR_SAMPLE, GRAMMAR_SAMPLES, MODES_SAMPLE, REGEX_SAMPLES, type GrammarSample, type RegexSample } from './data/samples.ts';
import { analyzeGrammar, analyzeRegex, runCompare, runParse, runSimulation, type OkGrammar } from './replay/pipelines.ts';
import type { Mode } from './core/index.ts';

const NONE: string[] = [];

export function useOppModel() {
  const [draft, setDraft] = useState(EXPR_SAMPLE.text);
  const [committed, setCommitted] = useState(EXPR_SAMPLE.text);
  const [parseDraft, setParseDraft] = useState(EXPR_SAMPLE.strings[0]);
  const [parseReq, setParseReq] = useState<{ input: string; mode: Mode }>({ input: EXPR_SAMPLE.strings[0], mode: 'safeguarded' });

  const analysis = useMemo(() => analyzeGrammar(committed), [committed]);
  const sample = GRAMMAR_SAMPLES.find((s) => s.text === committed) ?? null;
  const strings = sample?.strings ?? NONE;
  const ok: OkGrammar | null = analysis.status === 'ok' ? analysis : null;
  const canParse = Boolean(ok?.conflictFree);
  const run = useMemo(() => (ok && canParse ? runParse(ok, parseReq.input, parseReq.mode) : null), [ok, canParse, parseReq]);

  // Stage 5 opens on its own grammar (S → A + B …) where the two modes disagree.
  const [cmpText, setCmpText] = useState(MODES_SAMPLE.text);
  const [cmpInput, setCmpInput] = useState(MODES_SAMPLE.compare!);
  const cmpAnalysis = useMemo(() => analyzeGrammar(cmpText), [cmpText]);
  const cmpOk = cmpAnalysis.status === 'ok' && cmpAnalysis.conflictFree ? cmpAnalysis : null;
  const cmp = useMemo(() => (cmpOk ? runCompare(cmpOk, cmpInput) : null), [cmpOk, cmpInput]);
  const cmpSample = GRAMMAR_SAMPLES.find((s) => s.text === cmpText) ?? null;
  const cmpRows = useMemo(() => (cmpOk ? (cmpSample?.strings ?? []).map((s) => runCompare(cmpOk, s)) : []), [cmpOk, cmpSample]);

  const commit = useCallback(() => setCommitted(draft), [draft]);
  const loadSample = useCallback((s: GrammarSample) => {
    setDraft(s.text); setCommitted(s.text);
    const str = s.strings[0] ?? '';
    setParseDraft(str);
    setParseReq((r) => ({ ...r, input: str }));
  }, []);
  const parse = useCallback((input: string, mode: Mode) => { setParseDraft(input); setParseReq({ input, mode }); }, []);
  const compareWith = useCallback((text: string, input: string) => { setCmpText(text); setCmpInput(input); }, []);

  return {
    draft, setDraft, committed, commit, dirty: draft !== committed, analysis, ok, sample, strings, canParse,
    parseDraft, setParseDraft, parseReq, parse, run, loadSample,
    cmpText, cmpInput, setCmpInput, cmpAnalysis, cmp, cmpRows, cmpSample, compareWith,
  };
}
export type OppModel = ReturnType<typeof useOppModel>;

export function useRegexModel() {
  const first = REGEX_SAMPLES[0];
  const [draft, setDraft] = useState(first.source);
  const [committed, setCommitted] = useState(first.source);
  const [simDraft, setSimDraft] = useState(first.strings[0]);
  const [simInput, setSimInput] = useState(first.strings[0]);

  const analysis = useMemo(() => analyzeRegex(committed), [committed]);
  const ok = analysis.status === 'ok' ? analysis : null;
  const sample = REGEX_SAMPLES.find((s) => s.source === committed) ?? null;
  const strings = sample?.strings ?? NONE;
  const sim = useMemo(() => (ok ? runSimulation(ok.dfa, simInput) : null), [ok, simInput]);

  const commit = useCallback(() => setCommitted(draft), [draft]);
  const loadSample = useCallback((s: RegexSample) => {
    setDraft(s.source); setCommitted(s.source);
    setSimDraft(s.strings[0] ?? ''); setSimInput(s.strings[0] ?? '');
  }, []);
  const simulate = useCallback((input: string) => { setSimDraft(input); setSimInput(input); }, []);

  return { draft, setDraft, committed, commit, dirty: draft !== committed, analysis, ok, sample, strings,
    simDraft, setSimDraft, simInput, simulate, sim, loadSample };
}
export type RegexModel = ReturnType<typeof useRegexModel>;
