import { useCallback, useMemo, useState } from 'react';
import { REGEX_SAMPLES } from '../data/samples.js';
import { analyzeRegex, runSimulation } from '../replay/pipelines.js';

const first = REGEX_SAMPLES[0];

/** Part B state. The direct-method construction runs once per committed expression. */
export function useRegexModel() {
  const [draft, setDraft] = useState(first.source);
  const [committed, setCommitted] = useState(first.source);
  const [simDraft, setSimDraft] = useState(first.strings[0]);
  const [simInput, setSimInput] = useState(first.strings[0]);

  const analysis = useMemo(() => analyzeRegex(committed), [committed]);
  const sample = REGEX_SAMPLES.find((s) => s.source === committed) ?? null;
  const strings = sample?.strings ?? [];
  const sim = useMemo(() => (analysis.status === 'ok' ? runSimulation(analysis.dfa, simInput) : null), [analysis, simInput]);

  const commit = useCallback(() => setCommitted(draft), [draft]);
  const loadSample = useCallback((s) => {
    setDraft(s.source); setCommitted(s.source);
    setSimDraft(s.strings[0] ?? ''); setSimInput(s.strings[0] ?? '');
  }, []);
  const simulate = useCallback((input) => { setSimDraft(input); setSimInput(input); }, []);

  return { draft, setDraft, committed, commit, dirty: draft !== committed, analysis, sample, strings,
    simDraft, setSimDraft, simInput, simulate, sim, loadSample };
}
