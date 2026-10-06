// Navigation: chapters (top rail) and the stages inside each (stage drawer). Routes use the URL
// hash so the production build works from file:// and from any nested folder.
export interface Stage { id: string; no: number; title: string; does: string }
export interface Chapter { id: 'opp' | 'lr' | 'regex'; numeral: string; title: string; short: string; pipeline: string[]; stages: Stage[] }

export const CHAPTERS: Chapter[] = [
  {
    id: 'opp', numeral: 'I', title: 'Operator precedence', short: 'Bottom-up parsing', pipeline: ['grammar', 'table', 'parse'],
    stages: [
      { id: 'grammar', no: 1, title: 'Grammar', does: 'Check that the grammar is an operator grammar.' },
      { id: 'sets', no: 2, title: 'LEADING and TRAILING', does: 'Derive the edge terminals of every non-terminal.' },
      { id: 'table', no: 3, title: 'Precedence table', does: 'Insert one relation at a time and catch conflicts.' },
      { id: 'parse', no: 4, title: 'Parse a string', does: 'Shift and reduce with the table, handle by handle.' },
      { id: 'modes', no: 5, title: 'Classic vs Safeguarded', does: 'See where forgetting non-terminal names goes wrong.' },
    ],
  },
  { id: 'lr', numeral: 'II', title: 'LR parsing', short: 'Bottom-up parsing', pipeline: ['items', 'table', 'parse'], stages: [] },
  {
    id: 'regex', numeral: 'III', title: 'Regex → DFA', short: 'Direct method', pipeline: ['tree', 'followpos', 'DFA'],
    stages: [
      { id: 'tree', no: 1, title: 'Syntax tree', does: 'Parse the expression and number its positions.' },
      { id: 'props', no: 2, title: 'nullable, firstpos, lastpos', does: 'Compute node properties bottom-up.' },
      { id: 'follow', no: 3, title: 'followpos', does: 'Let concatenation and star nodes fill followpos.' },
      { id: 'dfa', no: 4, title: 'DFA construction', does: 'Turn sets of positions into states.' },
      { id: 'sim', no: 5, title: 'Simulation', does: 'Run test strings through the finished DFA.' },
    ],
  },
];

export type Route =
  | { page: 'home' }
  | { page: 'chapter'; chapter: Chapter; stage: Stage | null };

export function parseHash(hash: string): Route {
  const [path] = (hash || '').replace(/^#/, '').split('?');
  const [, chapterId, stageId] = path.split('/');
  const chapter = CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) return { page: 'home' };
  const stage = chapter.stages.find((s) => s.id === stageId) ?? chapter.stages[0] ?? null;
  return { page: 'chapter', chapter, stage };
}

export const hashFor = (chapterId?: string, stageId?: string) =>
  chapterId ? `#/${chapterId}${stageId ? `/${stageId}` : ''}` : '#/';

/** `?key=value` flags in the hash, e.g. #/?fault=specimen (used by the verification script). */
export const hashFlag = (name: string) =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(name);
