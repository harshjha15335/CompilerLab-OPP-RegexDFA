// Moving a grammar from stage 1 to the mode comparison (stage 5). The data contract: stage 5 receives the
// *checked* grammar text plus a test string. The string must be a sentence of that grammar, so the
// comparison is meaningful; it is chosen from strings the user already has, never invented.
import { runParse, type OkGrammar } from './pipelines.ts';

/** First candidate the Safeguarded parser accepts (Safeguarded never accepts a string outside L(G)
 *  in any test so far); '' when none qualifies, so the UI asks for one instead of guessing. */
export function pickCompareString(grammar: OkGrammar, candidates: readonly string[]): string {
  if (!grammar.conflictFree) return '';
  for (const c of candidates) {
    if (!c.trim()) continue;
    if (runParse(grammar, c, 'safeguarded').result === 'ACCEPT') return c;
  }
  return '';
}
