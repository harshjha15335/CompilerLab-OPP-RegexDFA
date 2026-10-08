// The homepage specimen's frame source. Every frame comes from the real algorithm modules
// (parseGrammar, computeSets, buildPrecedenceTable, parseString) via the replay pipelines; there is
// no recorded or hand-written data. test/specimen.test.ts checks the table against the core.
import { EXPR_SAMPLE } from '../../data/samples.ts';
import type { ParseStep, RelationStep } from '../../core/index.ts';
import { analyzeGrammar, runParse, type OkGrammar } from '../../replay/pipelines.ts';
import { tableAt } from '../../replay/selectors.ts';

export const SPECIMEN_GRAMMAR = EXPR_SAMPLE.text;
export const SPECIMEN_STRING = 'id + id * id';

export type Frame = { kind: 'relation'; step: RelationStep; message: string } | { kind: 'parse'; step: ParseStep; message: string };

export interface Specimen { a: OkGrammar; frames: Frame[]; tableFrames: number; result: 'ACCEPT' | 'REJECT' }

export function buildSpecimen(text = SPECIMEN_GRAMMAR, input = SPECIMEN_STRING): Specimen {
  const a = analyzeGrammar(text);
  if (a.status !== 'ok' || !a.conflictFree) throw new Error('The specimen grammar is not a conflict-free operator grammar.');
  const rel = a.table.steps.filter((s): s is RelationStep => s.type === 'ADD_RELATION');
  const run = runParse(a, input, 'safeguarded');
  const frames: Frame[] = [
    ...rel.map((step) => ({ kind: 'relation' as const, step, message: step.message })),
    ...run.steps.map((step) => ({ kind: 'parse' as const, step, message: step.message })),
  ];
  return { a, frames, tableFrames: rel.length, result: run.result };
}

/** The table visible after `count` frames: exactly the core's relation steps, replayed. */
export const specimenTable = (s: Specimen, count: number) =>
  tableAt(s.a.table.steps, Math.min(count, s.tableFrames));
