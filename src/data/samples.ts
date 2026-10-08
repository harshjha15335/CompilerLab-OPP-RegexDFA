// Built-in sample library. Grammar symbols are whitespace-separated (the core's lexer); input
// strings may omit spaces because the core tokenizes by longest match.
export type SampleKind = 'valid' | 'conflict' | 'invalid';
export interface GrammarSample { id: string; title: string; kind: SampleKind; shows: string; text: string; strings: string[]; compare?: string }
export interface RegexSample { id: string; source: string; shows: string; strings: string[]; error?: boolean }

export const GRAMMAR_SAMPLES: GrammarSample[] = [
  {
    id: 'expr', title: 'Expression grammar', kind: 'valid',
    shows: 'A conflict-free table: * binds tighter than +, and parentheses override both.',
    text: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id',
    strings: ['id + id * id', '( id + id ) * id', 'id + * id', '( id + id'],
    compare: 'id + id * id',
  },
  {
    id: 'modes', title: 'Classic N vs Safeguarded', kind: 'valid',
    shows: 'Classic N accepts id/id+id*id, which this grammar does not generate. Safeguarded rejects it.',
    text: 'S -> A + B\nA -> id * id\nB -> id / id',
    strings: ['id/id+id*id', 'id*id+id/id', 'id*id', 'id+id'],
    compare: 'id/id+id*id',
  },
  {
    id: 'conflict', title: 'Ambiguous expressions', kind: 'conflict',
    shows: 'Cells (+, +) and (+, *) each receive two relations, so no precedence parser exists.',
    text: 'E -> E + E | E * E | ( E ) | id',
    strings: [],
  },
  {
    id: 'adjacent', title: 'Adjacent non-terminals', kind: 'invalid',
    shows: 'S → A B puts two non-terminals side by side, which an operator grammar forbids.',
    text: 'S -> A B\nA -> a\nB -> b',
    strings: [],
  },
  {
    id: 'epsilon', title: 'An ε-production', kind: 'invalid',
    shows: 'A → ε derives the empty string, which an operator grammar forbids.',
    text: 'S -> A a\nA -> ε | b',
    strings: [],
  },
];

export const EXPR_SAMPLE = GRAMMAR_SAMPLES[0];
export const MODES_SAMPLE = GRAMMAR_SAMPLES[1];

// The core appends the end marker # itself; never type it here.
export const REGEX_SAMPLES: RegexSample[] = [
  { id: 'abb', source: '(a|b)*abb', shows: 'The textbook example: 6 positions, 4 states.', strings: ['abb', 'ab', 'aabb', 'babb', 'abba'] },
  { id: 'abcd', source: 'a(b|c)*d', shows: 'A star over a union between two fixed symbols.', strings: ['ad', 'abcbd', 'abc'] },
  { id: 'plus', source: '(ab|a)+b?', shows: 'Plus and optional: followpos from a + node.', strings: ['ab', 'aab', 'abab', 'b'] },
  { id: 'stars', source: 'a*b*c?', shows: 'Every factor is nullable, so the start state accepts.', strings: ['', 'aabbc', 'ca'] },
  { id: 'abplus', source: 'ab+', shows: 'One or more b after a.', strings: ['abbb', 'a'] },
  { id: 'opt', source: 'ab?c', shows: 'An optional middle symbol.', strings: ['ac', 'abc', 'abbc'] },
  { id: 'escape', source: 'a\\*b', shows: 'An escaped * is an ordinary character.', strings: ['a*b', 'ab'] },
  { id: 'err-paren', source: 'ab(c|d', shows: 'The parenthesis is never closed.', strings: [], error: true },
  { id: 'err-hash', source: 'a#b', shows: '# is reserved for the end marker.', strings: [], error: true },
];
