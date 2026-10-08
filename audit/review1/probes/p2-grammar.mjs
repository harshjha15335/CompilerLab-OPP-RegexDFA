// 2.1 grammar parsing edge cases, 2.2 validation. Must never throw.
import { parseGrammar, validateOperatorGrammar } from '../../../src/algorithms/grammar.js';
const show = (txt) => {
  let out;
  try {
    const r = parseGrammar(txt); const v = r.ok ? validateOperatorGrammar(r.grammar) : null;
    out = { parseOk: r.ok, errors: r.errors.map((e) => e.message), prods: r.grammar.productions.map((p) => `${p.id}:${p.lhs}->[${p.rhs.join('|')}]`), nts: r.grammar.nonterminals, terms: r.grammar.terminals, start: r.grammar.start, validate: v && { ok: v.ok, errors: v.errors.map((e) => e.message) } };
  } catch (e) { out = { THREW: e.message }; }
  console.log(JSON.stringify(txt), '\n   ', JSON.stringify(out));
};
for (const t of [
  'E -> E + T | T\nT -> id',          // baseline
  'E->E+T|T\nT->id',                   // no spaces
  'E → E + T | T\nT → id',             // unicode arrow
  'S -> a A\nA -> ε', 'S -> a A\nA -> eps', 'S -> a A\nA -> epsilon', 'S -> a A\nA -> λ', 'S -> a A\nA -> ', 'S -> a A | ',
  'S -> a\n\n\nS -> b',                 // blank lines
  'E -> id | id',                       // duplicate production
  'S -> A + b',                         // A never defined (becomes terminal)
  'S -> a $ b',                         // $ misuse
  '$ -> a',                             // $ as lhs
  'S -> A B | a\nA -> a\nB -> b',       // adjacent NTs in first alt
  'S -> a | A B\nA -> a\nB -> b',       // adjacent NTs in 2nd alt
  'S -> a | b | A ε\nA -> a',           // ε in 3rd alt
  'garbage', '->', '-> a', 'A B -> c', 'S -> a -> b', '', '   ', '\u0000', 'S -> ' + 'a '.repeat(2000),
  'S -> id_num + id_num', 'S -> ( S ) | x\n// comment line',
]) show(t);
