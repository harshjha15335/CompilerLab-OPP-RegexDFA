// App-level state for both tools. Each algorithm runs once per committed input (useMemo), never
// per step. Models live in App so inputs and results survive navigation.
//
// Every input has two values: the *draft* (what is typed) and the *submitted* value the results were
// computed from. `…Dirty` flags say when they differ, so no screen presents results for text it no longer shows.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXPR_SAMPLE, GRAMMAR_SAMPLES, MODES_SAMPLE, REGEX_SAMPLES, type GrammarSample, type RegexSample } from './data/samples.ts';
import { analyzeGrammar, analyzeRegex, runCompare, runParse, runSimulation, type OkGrammar } from './replay/pipelines.ts';
import { pickCompareString } from './replay/transfer.ts';
import { readSession, writeSession } from './ui/store.ts';
import type { Mode } from './core/index.ts';

const NONE: string[] = [];
const isSampleText = (t: string) => GRAMMAR_SAMPLES.some((s) => s.text === t);

interface OppSession { draft: string; committed: string; custom: string | null; parseDraft: string; parseInput: string; mode: Mode; cmpText: string; cmpInput: string }

export function useOppModel() {
  const saved = useMemo(() => readSession<{ opp: OppSession }>().opp ?? null, []);
  const [draft, setDraft] = useState(saved?.draft ?? EXPR_SAMPLE.text);
  const [committed, setCommitted] = useState(saved?.committed ?? EXPR_SAMPLE.text);
  // the user's own grammar is kept here whenever a sample replaces it, so choosing a sample never loses work
  const [custom, setCustom] = useState<string | null>(saved?.custom ?? null);
  const [parseDraft, setParseDraft] = useState(saved?.parseDraft ?? EXPR_SAMPLE.strings[0]);
  const [parseReq, setParseReq] = useState<{ input: string; mode: Mode }>({ input: saved?.parseInput ?? EXPR_SAMPLE.strings[0], mode: saved?.mode ?? 'safeguarded' });

  const analysis = useMemo(() => analyzeGrammar(committed), [committed]);
  const sample = GRAMMAR_SAMPLES.find((s) => s.text === committed) ?? null;
  const strings = sample?.strings ?? NONE;
  const ok: OkGrammar | null = analysis.status === 'ok' ? analysis : null;
  const canParse = Boolean(ok?.conflictFree);
  const run = useMemo(() => (ok && canParse ? runParse(ok, parseReq.input, parseReq.mode) : null), [ok, canParse, parseReq]);

  // Stage 5 opens on its own grammar (S → A + B …) where the two modes disagree.
  const [cmpText, setCmpText] = useState(saved?.cmpText ?? MODES_SAMPLE.text);
  const [cmpInput, setCmpInput] = useState(saved?.cmpInput ?? MODES_SAMPLE.compare!);
  const cmpAnalysis = useMemo(() => analyzeGrammar(cmpText), [cmpText]);
  const cmpOk = cmpAnalysis.status === 'ok' && cmpAnalysis.conflictFree ? cmpAnalysis : null;
  const cmp = useMemo(() => (cmpOk && cmpInput ? runCompare(cmpOk, cmpInput) : null), [cmpOk, cmpInput]);
  const cmpSample = GRAMMAR_SAMPLES.find((s) => s.text === cmpText) ?? null;
  const cmpRows = useMemo(() => (cmpOk ? (cmpSample?.strings ?? []).map((s) => runCompare(cmpOk, s)) : []), [cmpOk, cmpSample]);

  useEffect(() => {
    writeSession({ opp: { draft, committed, custom, parseDraft, parseInput: parseReq.input, mode: parseReq.mode, cmpText, cmpInput } satisfies OppSession });
  }, [draft, committed, custom, parseDraft, parseReq, cmpText, cmpInput]);

  const [checks, setChecks] = useState(0);   // bumps on every Check, so an unchanged re-check is still acknowledged
  const commit = useCallback(() => {
    setCommitted(draft); setChecks((n) => n + 1);
    if (draft.trim() && !isSampleText(draft)) setCustom(draft);
  }, [draft]);
  /** Unchecked edits that a sample would replace (the confirmation dialog asks first). */
  const unsavedEdits = draft !== committed && draft.trim() !== '' && !isSampleText(draft);
  const loadSample = useCallback((s: GrammarSample) => {
    // keep whatever the user wrote, checked or not, as "Your grammar"
    if (draft.trim() && !isSampleText(draft)) setCustom(draft);
    else if (!isSampleText(committed) && committed.trim()) setCustom(committed);
    setDraft(s.text); setCommitted(s.text);
    const str = s.strings[0] ?? '';
    setParseDraft(str);
    setParseReq((r) => ({ ...r, input: str }));
  }, [draft, committed]);
  const restoreCustom = useCallback(() => {
    if (custom == null) return;
    setDraft(custom); setCommitted(custom);
  }, [custom]);
  const parse = useCallback((input: string, mode: Mode) => { setParseDraft(input); setParseReq({ input, mode }); }, []);
  /** Changing the reduction mode re-runs the string that is on display, never an unsubmitted draft. */
  const setMode = useCallback((mode: Mode) => setParseReq((r) => ({ ...r, mode })), []);
  const compareWith = useCallback((text: string, input: string) => { setCmpText(text); setCmpInput(input); }, []);
  /** Stage 1 → stage 5: the checked grammar, with a string it actually derives (or '' — the UI then asks). */
  const stage1CompareString = useMemo(
    () => (ok ? pickCompareString(ok, [parseReq.input, ...(sample?.compare ? [sample.compare] : []), ...strings]) : ''),
    [ok, parseReq.input, sample, strings]);

  return {
    draft, setDraft, committed, commit, checks, dirty: draft !== committed, unsavedEdits, analysis, ok, sample, strings, canParse,
    custom, restoreCustom,
    parseDraft, setParseDraft, parseReq, parse, setMode, run, loadSample, parseDirty: parseDraft !== parseReq.input,
    cmpText, cmpInput, setCmpInput, cmpAnalysis, cmp, cmpRows, cmpSample, compareWith, stage1CompareString,
  };
}
type RawOppModel = ReturnType<typeof useOppModel>;
/** The model the screens see: loading a sample may ask first, so it resolves to whether it happened. */
export type OppModel = Omit<RawOppModel, 'loadSample' | 'restoreCustom'> & { loadSample: (s: GrammarSample) => Promise<boolean>; restoreCustom: () => Promise<void> };

interface RegexSession { draft: string; committed: string; simDraft: string; simInput: string }

export function useRegexModel() {
  const first = REGEX_SAMPLES[0];
  const saved = useMemo(() => readSession<{ regex: RegexSession }>().regex ?? null, []);
  const [draft, setDraft] = useState(saved?.draft ?? first.source);
  const [committed, setCommitted] = useState(saved?.committed ?? first.source);
  const [simDraft, setSimDraft] = useState(saved?.simDraft ?? first.strings[0]);
  const [simInput, setSimInput] = useState(saved?.simInput ?? first.strings[0]);

  const analysis = useMemo(() => analyzeRegex(committed), [committed]);
  const ok = analysis.status === 'ok' ? analysis : null;
  const sample = REGEX_SAMPLES.find((s) => s.source === committed) ?? null;
  const strings = sample?.strings ?? NONE;
  const sim = useMemo(() => (ok ? runSimulation(ok.dfa, simInput) : null), [ok, simInput]);

  useEffect(() => { writeSession({ regex: { draft, committed, simDraft, simInput } satisfies RegexSession }); }, [draft, committed, simDraft, simInput]);

  const commit = useCallback(() => setCommitted(draft), [draft]);
  const loadSample = useCallback((s: RegexSample) => {
    setDraft(s.source); setCommitted(s.source);
    setSimDraft(s.strings[0] ?? ''); setSimInput(s.strings[0] ?? '');
  }, []);
  const simulate = useCallback((input: string) => { setSimDraft(input); setSimInput(input); }, []);

  return { draft, setDraft, committed, commit, dirty: draft !== committed, analysis, ok, sample, strings,
    simDraft, setSimDraft, simInput, simulate, sim, loadSample, simDirty: simDraft !== simInput };
}
export type RegexModel = ReturnType<typeof useRegexModel>;
