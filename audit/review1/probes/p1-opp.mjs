// Phase 2.3/2.4/2.5: OPP fixtures vs hand-derived ground truth (notes unit-2 pp.57-59; derivation in report §2)
import { parseGrammar, validateOperatorGrammar } from '../../../src/algorithms/grammar.js';
import { computeSets } from '../../../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../../../src/algorithms/precedence.js';
import { parseString } from '../../../src/algorithms/parser.js';
const build = (txt) => { const g = parseGrammar(txt).grammar; const L = computeSets(g, 'LEADING'), T = computeSets(g, 'TRAILING'); return { g, L, T, t: buildPrecedenceTable(g, L.sets, T.sets) }; };
let pass = 0, fail = 0; const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : '  ' + detail}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]));

// (b) expression grammar
const X = build('E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id');
const expL = { E: ['(', '*', '+', 'id'], T: ['(', '*', 'id'], F: ['(', 'id'] }, expT = { E: [')', '*', '+', 'id'], T: [')', '*', 'id'], F: [')', 'id'] };
ok('LEADING expr grammar', eq(sorted(X.L.sets), expL), JSON.stringify(sorted(X.L.sets)));
ok('TRAILING expr grammar', eq(sorted(X.T.sets), expT), JSON.stringify(sorted(X.T.sets)));
// hand table (rows = left/stack terminal, cols = right/lookahead), '' = blank
const H = {
  '+': { '+': '⋗', '*': '⋖', '(': '⋖', ')': '⋗', id: '⋖', $: '⋗' },
  '*': { '+': '⋗', '*': '⋗', '(': '⋖', ')': '⋗', id: '⋖', $: '⋗' },
  '(': { '+': '⋖', '*': '⋖', '(': '⋖', ')': '≐', id: '⋖', $: '' },
  ')': { '+': '⋗', '*': '⋗', '(': '', ')': '⋗', id: '', $: '⋗' },
  id: { '+': '⋗', '*': '⋗', '(': '', ')': '⋗', id: '', $: '⋗' },
  $: { '+': '⋖', '*': '⋖', '(': '⋖', ')': '', id: '⋖', $: '' } };
let cells = 0, mism = [];
for (const a in H) for (const b in H[a]) { cells++; const got = X.t.get(a, b).join('/'); if (got !== H[a][b]) mism.push(`${a},${b}: tool=${got || '∅'} hand=${H[a][b] || '∅'}`); }
ok(`6x6 table vs hand derivation (${cells} cells)`, mism.length === 0, mism.join('; '));
ok('expr grammar verdict OPERATOR_PRECEDENCE', X.t.verdict === 'OPERATOR_PRECEDENCE');
// notes' table p.58 subset (id + * $) for the AMBIGUOUS grammar E->E+E|E*E|(E)|-E|id with precedence imposed by hand
const notes = { id: { id: '', '+': '⋗', '*': '⋗', $: '⋗' }, '+': { id: '⋖', '+': '⋗', '*': '⋖', $: '⋗' }, '*': { id: '⋖', '+': '⋗', '*': '⋗', $: '⋗' }, $: { id: '⋖', '+': '⋖', '*': '⋖', $: '' } };
let m2 = []; for (const a in notes) for (const b in notes[a]) { const got = X.t.get(a, b).join('/'); if (got !== notes[a][b]) m2.push(`${a},${b}`); }
ok('unambiguous grammar reproduces the notes\' hand-resolved (id,+,*,$) table', m2.length === 0, m2.join(' '));
// trace id+id*id
const tr = parseString(X.g, X.t, 'id+id*id');
console.log('   trace id+id*id:', tr.steps.map((s) => `${s.type}${s.handle ? '[' + s.handle.symbols.map((h) => h.symbol).join(' ') + ']' : ''}`).join(' → '), '=>', tr.result);
ok('id+id*id ACCEPT', tr.result === 'ACCEPT');
const reds = tr.steps.filter((s) => s.type === 'REDUCE').map((s) => `${s.production.lhs}->${s.production.rhs.join('')}`);
console.log('   reductions:', reds.join(', '));
const tr2 = parseString(X.g, X.t, '(id+id)*id');
console.log('   trace (id+id)*id:', tr2.steps.map((s) => s.type[0]).join(''), '=>', tr2.result);
ok('(id+id)*id ACCEPT', tr2.result === 'ACCEPT');

// ambiguous grammar from the notes (p.57-58): conflicts expected
const A = build('E -> E + E | E * E | ( E ) | id');
const conf = A.t.conflicts.map((c) => `(${c.left},${c.right})`);
console.log('   ambiguous grammar conflicts:', conf.join(' '));
ok('ambiguous E->E+E|E*E: conflict at (+,+)', conf.includes('(+,+)'));
ok('ambiguous E->E+E|E*E: conflict at (+,*)', conf.includes('(+,*)'));
ok('ambiguous grammar verdict NOT_OPERATOR_PRECEDENCE', A.t.verdict === 'NOT_OPERATOR_PRECEDENCE');
// same relation derived twice is not a conflict
const D = build('E -> E + T | E + T | T\nT -> id');
ok('duplicate relation is not a conflict', D.t.conflicts.length === 0 && D.t.steps.some((s) => s.type === 'ADD_RELATION' && !s.changed));
// ≐ cases: terminal-NT-terminal, adjacent terminals, length-1 production
const Q = build('S -> a A b | c d\nA -> e');
ok('≐ for a A b (R2)', Q.t.get('a', 'b').includes('≐'));
ok('≐ for adjacent c d (R1)', Q.t.get('c', 'd').includes('≐'));
ok('length-1 production A->e adds no ≐', !Q.t.steps.some((s) => s.productionId === 3 && s.relation === '≐'));
// unit chain + NT followed by terminal first
const U1 = build('S -> A\nA -> B\nB -> b + B | b');
console.log('   unit chain LEADING:', JSON.stringify(sorted(U1.L.sets)), 'TRAILING:', JSON.stringify(sorted(U1.T.sets)));
ok('unit chain S->A->B: LEADING(S)={b}, TRAILING(S)={+,b} (hand-derived; my first expectation was wrong)', eq(sorted(U1.L.sets).S, ['b']) && eq(sorted(U1.T.sets).S, ['+', 'b']));
const N1 = build('S -> A + b\nA -> c');
ok('first symbol NT then terminal: LEADING(S)={+,c}', eq(sorted(N1.L.sets).S, ['+', 'c']), JSON.stringify(N1.L.sets));
ok('fixed point terminates and logs "No set change"', X.L.steps.some((s) => s.changed === false && /No set change/.test(s.message)) && X.L.steps.at(-1).type === 'DONE');
console.log(`\n${pass} passed, ${fail} failed`);
