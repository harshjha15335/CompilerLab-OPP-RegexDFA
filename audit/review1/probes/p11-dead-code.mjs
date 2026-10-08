// Dead-code scan (equivalent of ts-prune + an unused-CSS check), no network, no installs.
// Exports: every `export const|function|class|type|interface NAME` in src/ that no other file (src, test, scripts) mentions.
// CSS: every .class selector in src/styles that no .ts/.tsx/.js file mentions (as a string or template part).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const code = [...walk('src'), ...walk('test'), ...walk('scripts')].filter((f) => /\.(m?js|tsx?)$/.test(f));
const text = Object.fromEntries(code.map((f) => [f, readFileSync(f, 'utf8')]));
const unusedExports = [];
for (const f of code.filter((x) => x.startsWith('src/'))) {
  for (const m of text[f].matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:const|let|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/g)) {
    const name = m[1], re = new RegExp(`\\b${name}\\b`);
    const elsewhere = code.some((g) => g !== f && re.test(text[g]));
    const local = (text[f].match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
    if (!elsewhere) unusedExports.push(`${f}: ${name}${local > 1 ? ' (used inside its own file only)' : ' (UNUSED)'}`);
  }
}
const css = walk('src/styles').filter((f) => f.endsWith('.css'));
const allCode = Object.values(text).join('\n') + readFileSync('index.html', 'utf8');
const unusedCss = [];
for (const f of css) {
  const cls = new Set([...readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c)));
  for (const c of cls) {
    // BEM modifiers are often built as `${base}--${kind}`: accept a match on the block prefix + '--' or '__' part too
    const parts = [c, ...c.split(/--|__/).slice(1).map((p) => p)];
    const found = allCode.includes(c) || (c.includes('--') && allCode.includes(c.split('--')[0] + '--') && allCode.includes(c.split('--')[1]));
    if (!found) unusedCss.push(`${f}: .${c}`);
  }
}
console.log(`exports scanned in src/: unused or file-local ${unusedExports.length}`); unusedExports.forEach((x) => console.log('  ' + x));
console.log(`CSS classes not referenced by any script: ${unusedCss.length}`); unusedCss.forEach((x) => console.log('  ' + x));
const misc = Object.entries(text).filter(([f]) => f.startsWith('src/')).flatMap(([f, t]) => t.split('\n').map((l, i) => [f, i + 1, l]))
  .filter(([, , l]) => /console\.(log|debug)|\bTODO\b|\bFIXME\b|\bXXX\b|lorem|dangerouslySetInnerHTML|\beval\(|new Function|fetch\(|XMLHttpRequest|getUserMedia|navigator\.sendBeacon/.test(l));
console.log(`console.log / TODO / eval / fetch / innerHTML / camera lines in src/: ${misc.length}`); misc.forEach(([f, n, l]) => console.log(`  ${f}:${n} ${l.trim()}`));
