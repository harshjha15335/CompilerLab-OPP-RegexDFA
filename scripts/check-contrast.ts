// Computes WCAG 2.x contrast for every meaning-bearing colour pair in src/styles/tokens.css.
// Text must reach 4.5:1, meaning-bearing borders and glyph strokes 3:1. Exits non-zero on failure.
// Usage: node scripts/check-contrast.ts [--markdown]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8');
const tokens: Record<string, string> = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2];

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
export const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

type Pair = [fg: string, bg: string, min: 4.5 | 3, role: string];
const PAIRS: Pair[] = [
  ['ink', 'plate', 4.5, 'body text'],
  ['ink', 'plate-2', 4.5, 'text in table heads and wells'],
  ['ink', 'desk', 4.5, 'rail text on the desk'],
  ['ink-2', 'plate', 4.5, 'secondary text'],
  ['ink-2', 'plate-2', 4.5, 'secondary text in wells'],
  ['ink-3', 'plate', 4.5, 'captions'],
  ['ink-3', 'plate-2', 4.5, 'captions in wells'],
  ['ink-3', 'desk', 4.5, 'captions on the desk'],
  ['line', 'plate', 3, 'cell, tape and stack borders'],
  ['line', 'plate-2', 3, 'borders inside wells'],
  ['rel-yields', 'plate', 4.5, '⋖ glyph in an empty-state cell'],
  ['rel-takes', 'plate', 4.5, '⋗ glyph'],
  ['rel-equal', 'plate', 4.5, '≐ glyph'],
  ['rel-yields', 'changed', 4.5, '⋖ glyph on the highlighter (cell just written)'],
  ['rel-takes', 'changed', 4.5, '⋗ glyph on the highlighter'],
  ['rel-equal', 'changed', 4.5, '≐ glyph on the highlighter'],
  ['ink', 'changed', 4.5, 'text on the highlighter'],
  ['ink', 'band', 4.5, 'header text in the active row/column band'],
  ['read', 'band', 3, 'dashed outline next to the band'],
  ['changed-edge', 'changed', 3, 'corner brackets on the highlighter'],
  ['changed-edge', 'plate', 3, 'corner brackets on paper'],
  ['read', 'plate', 3, 'dashed outline of what a step read'],
  ['read', 'plate-2', 3, 'dashed outline in wells'],
  ['conflict', 'plate', 4.5, 'conflict text and fracture marks'],
  ['conflict', 'conflict-wash', 4.5, 'text in a conflicting cell'],
  ['rel-yields', 'conflict-wash', 4.5, '⋖ inside a conflicting cell'],
  ['rel-takes', 'conflict-wash', 4.5, '⋗ inside a conflicting cell'],
  ['rel-equal', 'conflict-wash', 4.5, '≐ inside a conflicting cell'],
  ['accept', 'plate', 4.5, 'ACCEPT text'],
  ['accept', 'accept-wash', 4.5, 'ACCEPT stamp'],
  ['reject', 'plate', 4.5, 'REJECT text'],
  ['reject', 'reject-wash', 4.5, 'REJECT stamp'],
  ['cap-edge', 'plate', 3, 'keycap outline'],
  ['ink', 'cap-top', 4.5, 'keycap legend'],
  ['brass-lo', 'plate', 3, 'speed-dial ticks'],
  ['ink', 'brass-hi', 4.5, 'text on the brass dial face'],
  ['focus', 'plate', 3, 'focus ring'],
  ['focus', 'desk', 3, 'focus ring on the desk'],
  ['focus', 'plate-2', 3, 'focus ring in wells'],
];

const rows = PAIRS.map(([fg, bg, min, role]) => {
  if (!tokens[fg] || !tokens[bg]) throw new Error(`missing token ${fg} or ${bg}`);
  const r = ratio(tokens[fg], tokens[bg]);
  return { fg, bg, hexFg: tokens[fg], hexBg: tokens[bg], min, role, r, ok: r >= min };
});

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--markdown')) {
    console.log('| Foreground | Background | Role | Ratio | Needs | Result |\n| --- | --- | --- | --- | --- | --- |');
    for (const x of rows) console.log(`| \`--${x.fg}\` ${x.hexFg} | \`--${x.bg}\` ${x.hexBg} | ${x.role} | ${x.r.toFixed(2)}:1 | ${x.min}:1 | ${x.ok ? 'pass' : '**FAIL**'} |`);
  } else for (const x of rows) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.r.toFixed(2).padStart(5)}:1 (needs ${x.min})  --${x.fg} on --${x.bg}  ${x.role}`);
  const bad = rows.filter((x) => !x.ok);
  if (bad.length) { console.error(`\n${bad.length} pair(s) below threshold`); process.exit(1); }
}

export { rows as contrastRows };
