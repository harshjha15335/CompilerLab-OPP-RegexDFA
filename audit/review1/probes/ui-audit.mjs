// Phase 3 UI probe for the Review-1 audit. Drives the BUILT app (dist/, file://, network off) with Playwright.
// Usage: npm run build && node audit/review1/probes/ui-audit.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from '../../../scripts/lib/browser.mjs';

const out = resolve(process.argv[2] ?? 'audit/review1/ui');
mkdirSync(out, { recursive: true });
const BASE = pathToFileURL(resolve('dist/index.html')).href;
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? `  — ${detail}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();
async function page(vp = [1366, 768]) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, offline: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('cl.intro.seen.v2', '1'); localStorage.setItem('cl.note.keys.v1', '1'); } catch {} });
  const p = await ctx.newPage();
  return { ctx, p };
}
const go = async (p, hash) => { await p.goto(BASE + hash); await p.waitForSelector('.app'); await sleep(500); };
const readout = (p) => p.$eval('.dock__readout b', (e) => Number(e.textContent)).catch(() => null);

// ── 1. The defects listed in the brief, checked against the current build at the three sizes ──
for (const vp of [[1366, 768], [1280, 720], [1920, 1080]]) {
  const tag = `${vp[0]}x${vp[1]}`;
  const { ctx, p } = await page(vp);
  await go(p, '#/opp/modes');
  await p.screenshot({ path: join(out, `${tag}-modes.png`) });
  const m = await p.evaluate(() => {
    const clipped = (el) => el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && getComputedStyle(el).overflow !== 'visible';
    const title = document.querySelector('.plate__title');
    // a permanent NAVIGATION sidebar (the defect in the brief's screenshot): tall, wide, and made of links.
    // The step-explanation panel (.inspector) is content, not navigation, and is not counted.
    const side = [...document.querySelectorAll('aside, .sidebar, nav')].filter((e) => !e.closest('.inspector') && e.querySelectorAll('a, button').length >= 3)
      .map((e) => e.getBoundingClientRect()).filter((r) => r.height > innerHeight * 0.6 && r.width > innerWidth * 0.2);
    const upper = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim() && getComputedStyle(e).textTransform === 'uppercase');
    const boxedNums = [...document.querySelectorAll('body *')].filter((e) => /^\d+\.\d+$/.test(e.textContent.trim()) && getComputedStyle(e).borderTopStyle !== 'none' && e.children.length === 0);
    const rows = [...document.querySelectorAll('.cmptable tbody tr')].map((r) => r.textContent.replace(/\s+/g, ' ').trim());
    return { title: title?.textContent, titleClipped: clipped(title), sidebars: side.length, uppercase: upper.map((e) => e.textContent.trim()).slice(0, 8), boxedNums: boxedNums.length,
      grammar: document.querySelector('.controls__grammar')?.textContent.replace(/\s+/g, ' '), input: document.querySelector('.controls .field__input')?.value, rows };
  });
  check(`${tag} modes: heading fully visible ("${m.title}")`, m.title && !m.titleClipped);
  check(`${tag} modes: no permanent sidebar taking ≥20% width`, m.sidebars === 0, `${m.sidebars}`);
  check(`${tag} no all-caps label styling on the modes screen`, m.uppercase.length === 0, m.uppercase.join(' | '));
  check(`${tag} no boxed section numbers like "1.5"`, m.boxedNums === 0, `${m.boxedNums}`);
  if (tag === '1366x768') {
    check('comparison opens on S → A + B with id/id+id*id', m.grammar?.replace(/\s/g, '').includes('S→A+B') && m.input === 'id/id+id*id', `${m.grammar} / ${m.input}`);
    check('comparison rows are not all ACCEPT/ACCEPT', m.rows.length > 0 && !m.rows.every((r) => /ACCEPT.*ACCEPT/.test(r) && !/REJECT/.test(r)), m.rows.join(' || '));
  }
  // $ tile vs id tile, lookahead label vs neighbours: geometric overlap on the parse and modes benches
  for (const hash of ['#/opp/parse', '#/opp/modes']) {
    await go(p, hash);
    await p.keyboard.press('End'); await sleep(250);
    const ov = await p.evaluate(() => {
      const boxes = [...document.querySelectorAll('.slot, .tcell, .slot__mark, .tcell__mark, .handle__label')].map((e) => ({ e, r: e.getBoundingClientRect(), t: e.textContent.trim() })).filter((b) => b.r.width && b.r.height);
      const hits = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 1 && h > 1) hits.push(`"${a.t}" × "${b.t}"`);
      }
      return hits;
    });
    check(`${tag} ${hash}: no tile or label overlaps another (incl. "$" vs "id", "lookahead" label)`, ov.length === 0, ov.slice(0, 5).join(', '));
  }
  await ctx.close();
}

// ── 2. Shortcuts never fire while typing; every Tab stop shows a focus ring ──
{
  const { ctx, p } = await page();
  await go(p, '#/opp/parse');
  const before = await readout(p);
  await p.click('.controls .field__input');
  for (const k of ['ArrowRight', 'ArrowRight', 'End', ' ', ']', 'Home']) await p.keyboard.press(k);
  await sleep(300);
  check('shortcuts (→, End, Space, ], Home) do not fire while typing in the input', (await readout(p)) === before, `readout ${before} → ${await readout(p)}`);
  await p.keyboard.press('Escape');
  await p.click('.plate__title'); // move focus out of the input
  await p.keyboard.press('ArrowRight'); await sleep(150);
  check('the same → steps the replay once focus leaves the input', (await readout(p)) === before + 1);
  const noRing = [];
  for (const hash of ['#/', '#/opp/grammar', '#/opp/table', '#/opp/parse', '#/opp/modes', '#/regex/tree', '#/regex/sim']) {
    await go(p, hash);
    for (let i = 0; i < 60; i++) {
      await p.keyboard.press('Tab');
      const f = await p.evaluate(() => {
        const a = document.activeElement; if (!a || a === document.body) return null;
        const cs = getComputedStyle(a);
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1) || /\d+px/.test(cs.boxShadow) || (a.matches('.keycap') && cs.outlineStyle !== 'none');
        return { ring, d: `${a.tagName.toLowerCase()}.${a.className || ''} "${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 24)}"` };
      });
      if (f && !f.ring) noRing.push(`${hash} ${f.d}`);
    }
  }
  check('every Tab stop on 7 screens shows a visible focus ring', noRing.length === 0, [...new Set(noRing)].slice(0, 6).join(' | '));
  await ctx.close();
}

// ── 3. The viva flow, counting clicks (keyboard stepping is not counted) ──
{
  const { ctx, p } = await page();
  const flow = [];
  let clicks = 0;
  const click = async (sel, text) => { clicks++; if (text) await p.locator(sel, { hasText: text }).first().click(); else await p.click(sel); await sleep(350); };
  const stepDone = async (name, ok, note = '') => { flow.push({ name, clicks, ok: Boolean(ok), note }); console.log(`  viva ${name}: ${clicks} click(s) ${ok ? 'OK' : 'NOT REACHED'} ${note}`); clicks = 0; };
  await go(p, '#/');
  await click('.door__link', 'Operator precedence');
  await stepDone('1 load expression grammar', await p.evaluate(() => location.hash === '#/opp/grammar' && document.querySelector('.editor__text')?.value.includes('E -> E + T')));
  await click('.sample', 'Adjacent non-terminals');
  await stepDone('2 invalid-grammar error from the sample list', await p.evaluate(() => /adjacent non-terminals/i.test(document.body.textContent)));
  await click('.sample', 'Expression grammar');
  await click('a.stages__step[aria-label^="Next stage"]');
  await p.keyboard.press('End'); await sleep(200);
  await stepDone('3 step through LEADING/TRAILING', await p.evaluate(() => location.hash === '#/opp/sets'), '(→ / End by keyboard)');
  await click('a.stages__step[aria-label^="Next stage"]');
  await p.keyboard.press('End'); await sleep(200);
  await stepDone('4 step through the table', await p.evaluate(() => location.hash === '#/opp/table' && /Conflict-free/.test(document.querySelector('.plate__aside')?.textContent ?? '')));
  // 5: switch to the conflicting grammar from where we are (the plate-header picker counts as one click)
  const pick = async (id) => { clicks++; await p.selectOption('.picker__select', id); await sleep(350); };
  await pick('conflict');
  await p.keyboard.press('End'); await sleep(200);
  await stepDone('5 conflicting grammar and its verdict', await p.evaluate(() => /conflicting cell/i.test(document.querySelector('.plate__aside')?.textContent ?? '')), '(picker on the table plate)');
  await pick('expr');
  await click('a.stages__step[aria-label^="Next stage"]');
  await p.keyboard.press('End'); await sleep(200);
  await stepDone('6 parse id+id*id', await p.evaluate(() => /ACCEPT/.test(document.querySelector('.decision')?.textContent ?? '') && document.querySelector('.controls .field__input')?.value.replace(/\s/g, '') === 'id+id*id'));
  await click('a.stages__step[aria-label^="Next stage"]');
  await p.keyboard.press('End'); await sleep(200);
  await stepDone('7 Classic vs Safeguarded', await p.evaluate(() => [...document.querySelectorAll('.duo .verdict__word')].map((e) => e.textContent).join('/') === 'ACCEPT/REJECT'));
  await click('.rail__link', 'Regex');
  for (let i = 0; i < 4; i++) { await p.keyboard.press('End'); await p.keyboard.press('PageDown'); await sleep(350); }
  await p.keyboard.press('End'); await sleep(200);
  await stepDone('8 (a|b)*abb → tree → followpos → DFA → simulate abb', await p.evaluate(() => location.hash === '#/regex/sim' && /ACCEPT/.test(document.querySelector('.inspector')?.textContent ?? '')), '(End + PageDown by keyboard)');
  writeFileSync(join(out, 'viva-flow.json'), JSON.stringify(flow, null, 2));
  for (const f of flow) check(`viva step ${f.name}: reached with ≤2 clicks`, f.ok && f.clicks <= 2, `${f.clicks} clicks${f.note ? ' ' + f.note : ''}`);
  await ctx.close();
}

await browser.close();
writeFileSync(join(out, 'ui-audit.json'), JSON.stringify(results, null, 2));
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - fails} passed, ${fails} failed`);
