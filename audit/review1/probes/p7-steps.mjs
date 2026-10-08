import { parseGrammar } from '../../../src/algorithms/grammar.js';
import { computeSets } from '../../../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../../../src/algorithms/precedence.js';
import { parseString } from '../../../src/algorithms/parser.js';
import { parseRegex } from '../../../src/algorithms/regex.js';
import { buildDirect, simulateDfa } from '../../../src/algorithms/direct.js';
const g = parseGrammar('E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id').grammar;
const L = computeSets(g, 'LEADING'), T = computeSets(g, 'TRAILING'); const tb = buildPrecedenceTable(g, L.sets, T.sets);
const pr = parseString(g, tb, 'id+id*id'); const ast = parseRegex('(a|b)*abb').ast; const astBefore = JSON.stringify(ast);
const d = buildDirect(ast); const sim = simulateDfa(d.dfa, 'abb');
const logs = { LEADING: L.steps, TRAILING: T.steps, TABLE: tb.steps, PARSE: pr.steps, DIRECT: d.steps, SIMULATION: sim.steps };
const source = (s) => ['productionId', 'rule', 'sourceSymbols', 'nodeId', 'production', 'handle', 'relation', 'from', 'state', 'position', 'positions', 'pass'].filter((k) => s[k] !== undefined && s[k] !== null);
for (const [name, steps] of Object.entries(logs)) {
  const missing = { phase: 0, type: 0, message: 0, source: 0 };
  for (const s of steps) { for (const k of ['phase', 'type', 'message']) if (s[k] === undefined) missing[k]++; if (!source(s).length && !['VERDICT', 'DONE', 'ACCEPT', 'REJECT', 'SIM_START', 'DFA_DONE'].includes(s.type)) missing.source++; }
  // aliasing: any object/array reachable from two different step records?
  const owner = new Map(); let shared = 0; const examples = new Set();
  const walk = (v, i, path) => { if (!v || typeof v !== 'object') return; if (owner.has(v) && owner.get(v) !== i) { shared++; examples.add(path); return; } owner.set(v, i); for (const k of Object.keys(v)) walk(v[k], i, path + '.' + k); };
  steps.forEach((s, i) => walk(s, i, s.type));
  console.log(`${name.padEnd(10)} ${String(steps.length).padStart(3)} steps  missing phase=${missing.phase} type=${missing.type} message=${missing.message} source=${missing.source}  shared objects between steps=${shared}${shared ? ' e.g. ' + [...examples].slice(0, 3).join(', ') : ''}`);
}
console.log('buildDirect mutates its input AST:', JSON.stringify(ast) !== astBefore);
