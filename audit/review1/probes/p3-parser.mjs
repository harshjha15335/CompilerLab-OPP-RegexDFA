import { parseGrammar } from '../../../src/algorithms/grammar.js';
import { computeSets } from '../../../src/algorithms/leadingTrailing.js';
import { buildPrecedenceTable } from '../../../src/algorithms/precedence.js';
import { parseString, tokenize } from '../../../src/algorithms/parser.js';
const build = (txt) => { const g = parseGrammar(txt).grammar; return { g, t: buildPrecedenceTable(g, computeSets(g, 'LEADING').sets, computeSets(g, 'TRAILING').sets) }; };
const X = build('E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id');
const run = (inp, G = X) => { try { const r = parseString(G.g, G.t, inp); return `${r.result}: ${r.reason ?? ''} [${r.steps.length} steps]`; } catch (e) { return `THREW: ${e.message}`; } };
for (const s of ['id+id*id', 'id + id * id', 'id + id*id', 'id  +id', '(id+id)*id', '((id))', '(((id+id)))*id', '', '   ', 'id id', '( )', '()', 'id +', '+ id', 'id + * id', 'id ) ', '( id', 'x', 'id+x', 'idid', '$', 'id $ id'])
  console.log(JSON.stringify(s).padEnd(18), run(s));
console.log('\nprefix terminals: tokenize("abcd", [ab, abc, cd]) =', JSON.stringify(tokenize('abcd', ['ab', 'abc', 'cd'])));
console.log('prefix terminals: tokenize("aab", [a, aa, ab]) =', JSON.stringify(tokenize('aab', ['a', 'aa', 'ab'])));
// full trace id+id*id
const tr = parseString(X.g, X.t, 'id+id*id');
console.log('\nFULL TRACE id+id*id');
for (const s of tr.steps) console.log(`  ${String(s.action).padStart(2)} ${s.type.padEnd(7)} top=${s.top} la=${s.lookahead} rel=${s.relation ?? ''}  stack: ${s.stack.map((x) => x.symbol).join(' ')}  ${s.handle ? 'handle: ' + s.handle.symbols.map((h) => h.symbol).join(' ') + '  via ' + s.production.lhs + '->' + s.production.rhs.join(' ') : ''}`);
const tr2 = parseString(X.g, X.t, '(id+id)*id');
console.log('FULL TRACE (id+id)*id');
for (const s of tr2.steps) console.log(`  ${String(s.action).padStart(2)} ${s.type.padEnd(7)} ${s.top} ${s.relation ?? ''} ${s.lookahead}  stack: ${s.stack.map((x) => x.symbol).join(' ')}`);
// conflicting table: does parseString throw?
const A = build('E -> E + E | E * E | ( E ) | id');
console.log('\nparse on CONFLICTING table:', run('id+id*id', A));
