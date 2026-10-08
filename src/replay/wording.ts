// Plain-language wording shared by several stages. Pure, so the tests can pin it down.

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
/** "two relations", "three relations", "7 relations". */
export const relationCount = (n: number) => `${NUMBER_WORDS[n] ?? n} relation${n === 1 ? '' : 's'}`;

/** One sentence naming every conflicting cell with its true relation count. */
export function conflictSentence(cells: readonly { left: string; right: string; relations: readonly unknown[] }[], prefix = ''): string {
  const byCount = new Map<number, string[]>();
  for (const c of cells) {
    const n = c.relations.length;
    byCount.set(n, [...(byCount.get(n) ?? []), `${prefix}(${c.left}, ${c.right})`]);
  }
  return [...byCount.entries()].sort((a, b) => b[0] - a[0])
    .map(([n, names]) => `${names.join(', ')} ${names.length === 1 ? 'holds' : 'each hold'} ${relationCount(n)}`)
    .join('; ') + '.';
}

/** The verdict's detail line without the shouted headline, which the stage already shows. */
export function verdictDetail(message: string, ok: boolean): string {
  if (ok) return message;
  const at = message.indexOf('Conflicting cells:');
  return at >= 0 ? message.slice(at) : message;
}

/** Where a parse error sits, in characters (code points), as plain words. */
export function errorPlace(source: string, position: number | null): string {
  if (position === null) return '';
  const n = [...source].length;
  if (position >= n) return `At the end of the expression, after character ${n}.`;
  return `At character ${position + 1} of ${n} (counted in characters).`;
}
