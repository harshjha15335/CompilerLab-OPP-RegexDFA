// Advisory checks on a grammar that already passes the operator-grammar rules. They never change
// the analysis; they explain results that would otherwise look odd (an empty table, a symbol that
// never appears in any derivation).
import type { Grammar } from '../core/index.ts';

export interface GrammarWarning { code: 'NO_TERMINALS' | 'UNREACHABLE' | 'NON_PRODUCTIVE'; symbols: string[]; message: string }

const list = (xs: string[]) => xs.join(', ');

export function grammarWarnings(g: Grammar): GrammarWarning[] {
  const out: GrammarWarning[] = [];
  if (g.productions.length === 0 || !g.start) return out;
  const start = g.start;
  const nts = new Set(g.nonterminals);
  if (g.terminals.length === 0)
    out.push({ code: 'NO_TERMINALS', symbols: [], message: 'The grammar has no terminals, so it derives no string and its precedence table is empty.' });

  // productive: can derive a string of terminals only (least fixed point)
  const productive = new Set<string>();
  for (let changed = true; changed;) {
    changed = false;
    for (const p of g.productions)
      if (!productive.has(p.lhs) && p.rhs.every((s) => !nts.has(s) || productive.has(s))) { productive.add(p.lhs); changed = true; }
  }
  const dead = g.nonterminals.filter((n) => !productive.has(n));
  if (dead.length && g.terminals.length)
    out.push({ code: 'NON_PRODUCTIVE', symbols: dead, message: `${list(dead)} never ${dead.length === 1 ? 'derives' : 'derive'} a string of terminals: every rule for ${dead.length === 1 ? 'it' : 'them'} leads back to a non-terminal that cannot finish.` });

  // reachable from the start symbol
  const reach = new Set<string>([start]);
  for (let changed = true; changed;) {
    changed = false;
    for (const p of g.productions)
      if (reach.has(p.lhs)) for (const s of p.rhs) if (nts.has(s) && !reach.has(s)) { reach.add(s); changed = true; }
  }
  const unreachable = g.nonterminals.filter((n) => !reach.has(n));
  if (unreachable.length)
    out.push({ code: 'UNREACHABLE', symbols: unreachable, message: `${list(unreachable)} ${unreachable.length === 1 ? 'is' : 'are'} never reached from the start symbol ${start}, so ${unreachable.length === 1 ? 'its rules' : 'their rules'} still add relations to the table but no parse can use them.` });
  return out;
}
