// Grammar parsing + operator-grammar validation. No UI code here.
const EPS = new Set(['ε', 'eps', 'epsilon', 'λ']);
export const END_MARKER = '$';

// A symbol run: an identifier (letters, digits, _, ' for primes like E') or one other character.
const RUNS = /[A-Za-z_][A-Za-z0-9_']*|[^A-Za-z0-9_'\s]/g;

/** Parse "E -> E + T | T" lines. Symbols are whitespace-separated (so "id" is one terminal). A chunk written
 *  without spaces that contains a non-terminal ("E+T", "(E)") is split into single symbols; a chunk that
 *  contains no non-terminal ("id", "<=") stays one terminal, so multi-character operators need spaces. */
export function parseGrammar(text) {
  const errors = [];
  const productions = [];
  const lines = text.split(/\r?\n/);
  const lhsNames = new Set(lines.map((l) => l.split(/->|→/)).filter((m) => m.length === 2).map((m) => m[0].trim()));
  const symbols = (chunk) => {
    if (lhsNames.has(chunk)) return [chunk];
    const runs = chunk.match(RUNS) ?? [chunk];
    return runs.length > 1 && runs.some((r) => lhsNames.has(r)) ? runs : [chunk];
  };
  lines.forEach((raw, ln) => {
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;
    const m = line.split(/->|→/);
    if (m.length !== 2) {
      errors.push({ code: 'SYNTAX', line: ln + 1, message: `Line ${ln + 1}: expected "A -> alternatives".` });
      return;
    }
    const lhs = m[0].trim();
    if (!lhs || /\s/.test(lhs)) {
      errors.push({ code: 'SYNTAX', line: ln + 1, message: `Line ${ln + 1}: the left side must be a single symbol.` });
      return;
    }
    m[1].split('|').forEach((alt) => {
      const toks = alt.trim().split(/\s+/).filter(Boolean).flatMap(symbols);
      productions.push({ id: productions.length + 1, lhs, rhs: toks, line: ln + 1 });
    });
  });
  const nonterminals = [...new Set(productions.map((p) => p.lhs))];
  const ntSet = new Set(nonterminals);
  const terminals = [];
  productions.forEach((p) =>
    p.rhs.forEach((s) => { if (!ntSet.has(s) && !EPS.has(s) && !terminals.includes(s)) terminals.push(s); }));
  if (!productions.length && !errors.length)
    errors.push({ code: 'EMPTY', message: 'Enter productions to begin.' });
  return {
    ok: errors.length === 0,
    errors,
    grammar: { productions, nonterminals, terminals, start: productions[0]?.lhs ?? null },
  };
}

const show = (p) => `${p.lhs} → ${p.rhs.length ? p.rhs.join(' ') : 'ε'}`;

/** Operator grammar = no ε-productions, no two adjacent non-terminals in any RHS. */
export function validateOperatorGrammar(grammar) {
  const errors = [];
  const nt = new Set(grammar.nonterminals);
  for (const p of grammar.productions) {
    if (p.rhs.length === 0 || p.rhs.some((s) => EPS.has(s))) {
      errors.push({ code: 'EPSILON', productionId: p.id,
        message: `Production ${p.id} (${show(p)}) derives ε. Operator grammars cannot contain ε-productions.` });
      continue;
    }
    for (let i = 0; i + 1 < p.rhs.length; i++) {
      if (nt.has(p.rhs[i]) && nt.has(p.rhs[i + 1])) {
        errors.push({ code: 'ADJACENT_NONTERMINALS', productionId: p.id,
          message: `Production ${p.id} (${show(p)}) contains adjacent non-terminals: ${p.rhs[i]} ${p.rhs[i + 1]}.` });
      }
    }
    if (p.lhs === END_MARKER || p.rhs.includes(END_MARKER))
      errors.push({ code: 'RESERVED', productionId: p.id,
        message: `Production ${p.id} uses "$", which is reserved as the end marker.` });
  }
  return { ok: errors.length === 0, errors };
}
