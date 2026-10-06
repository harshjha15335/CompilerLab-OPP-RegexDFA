// Homepage acceptance: the live specimen's table equals buildPrecedenceTable for the sample grammar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpecimen, specimenTable, SPECIMEN_GRAMMAR } from '../src/screens/home/specimen.ts';
import { buildPrecedenceTable, computeSets, parseGrammar } from '../src/core/index.ts';
import { cellKey } from '../src/replay/selectors.ts';

test('specimen table equals buildPrecedenceTable for the sample grammar, cell by cell', () => {
  const { grammar } = parseGrammar(SPECIMEN_GRAMMAR);
  const core = buildPrecedenceTable(grammar, computeSets(grammar, 'LEADING').sets, computeSets(grammar, 'TRAILING').sets);
  const s = buildSpecimen();
  const shown = specimenTable(s, s.frames.length);
  for (const a of core.axes)
    for (const b of core.axes)
      assert.deepEqual([...(shown.get(cellKey(a, b))?.relations ?? [])].sort(), [...core.get(a, b)].sort(), `cell (${a}, ${b})`);
  assert.equal(shown.size, core.cells.size);
  assert.equal(core.conflicts.length, 0);
});

test('specimen frames: table first, then the parse of id + id * id, which is accepted', () => {
  const s = buildSpecimen();
  assert.ok(s.tableFrames > 0);
  assert.ok(s.frames.slice(0, s.tableFrames).every((f) => f.kind === 'relation'));
  assert.ok(s.frames.slice(s.tableFrames).every((f) => f.kind === 'parse'));
  assert.equal(s.result, 'ACCEPT');
  assert.equal(s.frames.at(-1)!.step.type, 'ACCEPT');
  assert.equal(specimenTable(s, 0).size, 0);
  // the table never changes during the parse frames
  assert.equal(specimenTable(s, s.tableFrames).size, specimenTable(s, s.frames.length).size);
});

test('specimen fault injection throws (the page shows a fallback instead of crashing)', () => {
  assert.throws(() => buildSpecimen(undefined, undefined, true));
});
