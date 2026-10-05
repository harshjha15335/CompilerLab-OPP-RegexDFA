// Plate index: chapters and the numbered stages inside each.
export const NAV = [
  {
    group: 'Bottom-Up Parsing',
    chapters: [
      {
        id: 'opp', no: '01', title: 'Operator Precedence',
        stages: [
          { id: 'grammar', no: '1.1', title: 'Grammar' },
          { id: 'sets', no: '1.2', title: 'LEADING / TRAILING' },
          { id: 'table', no: '1.3', title: 'Precedence table' },
          { id: 'parse', no: '1.4', title: 'Parse bench' },
          { id: 'modes', no: '1.5', title: 'Reduction modes' },
        ],
      },
      { id: 'lr', no: '02', title: 'LR Parsing', stages: [] },
    ],
  },
  {
    group: 'Lexical Analysis',
    chapters: [
      {
        id: 'regex', no: '03', title: 'Regex → DFA', subtitle: 'Direct method',
        stages: [
          { id: 'tree', no: '3.1', title: 'Expression & syntax tree' },
          { id: 'props', no: '3.2', title: 'nullable · firstpos · lastpos' },
          { id: 'follow', no: '3.3', title: 'followpos' },
          { id: 'dfa', no: '3.4', title: 'DFA construction' },
          { id: 'sim', no: '3.5', title: 'Test strings' },
        ],
      },
    ],
  },
];

export const CHAPTERS = NAV.flatMap((g) => g.chapters.map((c) => ({ ...c, group: g.group })));

export function parseHash(hash) {
  const [, chapterId, stageId] = (hash || '').replace(/^#/, '').split('/');
  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];
  const stage = chapter.stages.find((s) => s.id === stageId) ?? chapter.stages[0] ?? null;
  return { chapter, stage };
}

export const hashFor = (chapterId, stageId) => `#/${chapterId}${stageId ? `/${stageId}` : ''}`;
