// Built-in sample library. Grammar symbols are whitespace-separated (the core's lexer).

export const GRAMMAR_SAMPLES = [
  {
    id: 'expr',
    title: 'Expression grammar',
    kind: 'valid',
    note: 'Conflict-free.',
    text: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id',
    strings: ['id + id * id', '( id + id ) * id', 'id + * id', '( id + id'],
    compare: 'id + id * id',
  },
  {
    id: 'conflict',
    title: 'Ambiguous expression grammar',
    kind: 'conflict',
    note: 'Cells (+, +) and (+, *) each receive two relations.',
    text: 'E -> E + E | E * E | ( E ) | id',
    strings: [],
  },
  {
    id: 'adjacent',
    title: 'Adjacent non-terminals',
    kind: 'invalid',
    note: 'S → A B puts two non-terminals side by side.',
    text: 'S -> A B\nA -> a\nB -> b',
    strings: [],
  },
  {
    id: 'epsilon',
    title: 'ε-production',
    kind: 'invalid',
    note: 'A derives ε.',
    text: 'S -> A a\nA -> ε | b',
    strings: [],
  },
  {
    id: 'modes',
    title: 'Classic N vs Safeguarded',
    kind: 'valid',
    note: 'Classic N accepts strings this grammar does not generate.',
    text: 'S -> A + B\nA -> id * id\nB -> id / id',
    strings: ['id * id + id / id', 'id / id + id * id', 'id * id', 'id + id'],
    compare: 'id / id + id * id',
  },
];

// The core appends the end marker # itself; never type it here.
export const REGEX_SAMPLES = [
  { id: 'abb', source: '(a|b)*abb', note: '6 positions, 4 states.', strings: ['abb', 'ab', 'aabb', 'babb', 'abba'] },
  { id: 'abcd', source: 'a(b|c)*d', note: 'Star over a union.', strings: ['ad', 'abcbd', 'abc'] },
  { id: 'plus', source: '(ab|a)+b?', note: 'Plus and optional.', strings: ['ab', 'aab', 'abab', 'b'] },
  { id: 'stars', source: 'a*b*c?', note: 'All factors nullable: the start state accepts.', strings: ['', 'aabbc', 'ca'] },
  { id: 'abplus', source: 'ab+', note: 'One or more b after a.', strings: ['abbb', 'a'] },
  { id: 'opt', source: 'ab?c', note: 'Optional middle symbol.', strings: ['ac', 'abc', 'abbc'] },
  { id: 'escape', source: 'a\\*b', note: 'Escaped * is a literal character.', strings: ['a*b', 'ab'] },
  { id: 'err-paren', source: 'ab(c|d', note: 'Unclosed parenthesis.', strings: [], error: true },
  { id: 'err-hash', source: 'a#b', note: 'Unescaped # is reserved.', strings: [], error: true },
];
