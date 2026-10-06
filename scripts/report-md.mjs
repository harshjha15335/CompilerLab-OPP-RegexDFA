// Turns artifacts/report.json (written by scripts/verify.mjs) into docs/verification-results.md:
// every check, grouped, with pass/fail. Usage: node scripts/report-md.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const r = JSON.parse(readFileSync('artifacts/report.json', 'utf8'));
const groups = new Map();
for (const x of r.results) { if (!groups.has(x.group)) groups.set(x.group, []); groups.get(x.group).push(x); }
const esc = (t) => t.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
let md = `# Verification results (every check)\n\nGenerated from \`artifacts/report.json\` by \`scripts/report-md.mjs\`.\n`
  + `Run against \`${decodeURIComponent(r.base)}\` (a renamed, nested copy of \`dist/\`, opened from file:// with the network off).\n\n`
  + `**${r.pass} passed, ${r.fail} failed.**\n\n`;
for (const [g, list] of groups) {
  const p = list.filter((x) => x.ok).length;
  md += `## ${g} (${p}/${list.length})\n\n| Result | Check |\n| --- | --- |\n`;
  for (const x of list) md += `| ${x.ok ? 'pass' : '**FAIL**'} | ${esc(x.name)}${x.ok ? '' : `<br>${esc(x.detail)}`} |\n`;
  md += '\n';
}
writeFileSync('docs/verification-results.md', md);
console.log(`docs/verification-results.md: ${r.pass} passed, ${r.fail} failed, ${groups.size} groups`);
