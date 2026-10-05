// Runs the algorithm core ONCE per input and packages result + steps[] for replay.
// No algorithm logic lives here; this file only sequences the tested modules.
import { parseGrammar, validateOperatorGrammar } from '../algorithms/grammar.js';
import { computeSets } from '../algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../algorithms/precedence.js';
import { parseString, compareModes, tokenize } from '../algorithms/parser.js';
import { parseRegex } from '../algorithms/regex.js';
import { buildDirect, simulateDfa } from '../algorithms/direct.js';

export function analyzeGrammar(text) {
  const parsed = parseGrammar(text);
  if (!parsed.ok)
    return { status: parsed.errors.every((e) => e.code === 'EMPTY') ? 'empty' : 'syntax', errors: parsed.errors, grammar: parsed.grammar };
  const { grammar } = parsed;
  const check = validateOperatorGrammar(grammar);
  if (!check.ok) return { status: 'invalid', errors: check.errors, grammar };
  const leading = computeSets(grammar, 'LEADING');
  const trailing = computeSets(grammar, 'TRAILING');
  const table = buildPrecedenceTable(grammar, leading.sets, trailing.sets);
  return { status: 'ok', errors: [], grammar, leading, trailing, table,
    setSteps: [...leading.steps, ...trailing.steps], conflictFree: table.conflicts.length === 0 };
}

export function runParse(analysis, input, mode) {
  const tk = tokenize(input, analysis.grammar.terminals);
  const run = parseString(analysis.grammar, analysis.table, input, mode);
  return { ...run, input, mode, tokens: tk.ok ? tk.tokens : [], tokenError: tk.ok ? null : tk.error };
}

export function runCompare(analysis, input) {
  const tk = tokenize(input, analysis.grammar.terminals);
  return { ...compareModes(analysis.grammar, analysis.table, input), input, tokens: tk.ok ? tk.tokens : [] };
}

export function analyzeRegex(source) {
  const parsed = parseRegex(source);
  if (!parsed.ok) return { status: source.length ? 'error' : 'empty', error: parsed.error, position: parsed.position ?? 0, source };
  const direct = buildDirect(parsed.ast);
  const phase = (name) => direct.steps.filter((s) => s.phase === name);
  return { status: 'ok', source, ...direct,
    propSteps: phase('PROPERTIES'), followSteps: phase('FOLLOWPOS'), dfaSteps: phase('DFA') };
}

export const runSimulation = (dfa, input) => ({ ...simulateDfa(dfa, input), input });
