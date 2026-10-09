// Phase 5 verification loop for the PRODUCTION build.
// Copies dist/ into a renamed, nested temp folder, opens it from file:// with the network OFF, and:
//  - screenshots every screen and mode at 1366×768, 1280×720 and 1920×1080 (+ two narrow sizes for the homepage)
//  - fails on clipped text (overflow hidden/clip with scrollWidth/Height > clientWidth/Height),
//    on overlapping interactive elements, and on more than one vertical scrollbar
//  - drives a full Operator Precedence demo and a full RE→DFA demo with the keyboard only
//  - checks reduced motion, grayscale legibility of ⋖ ⋗ ≐ and conflict cells, frame rate under 4× CPU
//    throttling, the five homepage acceptance checks, a WebGL-free run,
//    forward-then-Back DOM identity on every replay stage, and scans the bundle for network/eval/camera code.
// Usage: npm run build && node scripts/verify.mjs [--publish] [--quick]
//   --publish  also writes a curated set of screenshots to docs/screenshots/
//   --quick    one viewport only (1366×768)
//   --viewports=1280x720,…  override the screen viewports
//   --only=a,b  run only these groups: screens home keyboard replay reduced grayscale fps intro fonts repair bundle
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './lib/browser.mjs';
import { buildSpecimen, specimenTable } from '../src/screens/home/specimen.ts';
import { cellKey } from '../src/replay/selectors.ts';

const argv = process.argv.slice(2);
const PUBLISH = argv.includes('--publish');
const QUICK = argv.includes('--quick');
const ONLY = argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const want = (g) => !ONLY || ONLY.includes(g);   // groups: screens home keyboard replay reduced grayscale fps intro fonts bundle
if (!existsSync('dist/index.html')) { console.error('dist/ is missing. Run `npm run build` first.'); process.exit(2); }

const ART = resolve('artifacts');
const SHOTS = join(ART, 'screenshots');
rmSync(ART, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
const DIR = join(tmpdir(), 'compiler lab verify', 'nested', 'renamed build');
rmSync(join(tmpdir(), 'compiler lab verify'), { recursive: true, force: true });
cpSync('dist', DIR, { recursive: true });
const BASE = pathToFileURL(join(DIR, 'index.html')).href;
console.log(`Verifying ${BASE}\n`);

const VP_ARG = argv.find((a) => a.startsWith('--viewports='))?.slice(12).split(',').map((v) => v.split('x').map(Number));
const VIEWPORTS = VP_ARG ?? (QUICK ? [[1366, 768]] : [[1366, 768], [1280, 720], [1920, 1080]]);
const results = [];
let pass = 0, fail = 0;
const check = (group, name, ok, detail = '') => {
  results.push({ group, name, ok: Boolean(ok), detail: ok ? '' : String(detail).slice(0, 2000) });
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n         ${String(detail).slice(0, 600).replace(/\n/g, '\n         ')}`}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Most checks look at stages 2–4, which only show results once the grammar has been checked: start those
// sessions as a user who pressed Check grammar on the default grammar (the "repair" group tests the unchecked start).
const SEEN = () => { try { localStorage.setItem('cl.intro.seen.v2', '1'); localStorage.setItem('cl.note.keys.v1', '1'); } catch {} };
const CHECKED = () => { try { if (!sessionStorage.getItem('cl.session.v1')) sessionStorage.setItem('cl.session.v1', JSON.stringify({ opp: { checked: true }, regex: { built: true } })); } catch {} };

/* ── page plumbing ─────────────────────────────────────── */
const allNet = [], allErrors = [];
async function open(browser, { viewport = [1366, 768], reduced = false, init = SEEN, storage = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference', offline: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(CHECKED);
  if (init) await ctx.addInitScript(init);
  if (Object.keys(storage).length) await ctx.addInitScript((s) => { try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch {} }, storage);
  const page = await ctx.newPage();
  page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) allNet.push(u); });
  page.on('pageerror', (e) => allErrors.push(`pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') allErrors.push(`console.error ${m.text()}`); });
  page.on('requestfailed', (r) => allErrors.push(`requestfailed ${r.url()}`));
  return { ctx, page };
}
async function go(page, hash) {
  await page.goto('about:blank');
  await page.goto(BASE + hash);
  await page.waitForSelector('.app');
  await page.evaluate(() => document.fonts.ready);
  await sleep(250);
}
async function keys(page, key, n = 1, gap = 12) { for (let i = 0; i < n; i++) { await page.keyboard.press(key); if (gap) await sleep(gap); } }
const readout = (page) => page.$eval('.dock__readout b', (e) => Number(e.textContent)).catch(() => null);
const total = (page) => page.$eval('.dock__readout .dock__of', (e) => Number(e.textContent.replace(/\D/g, ''))).catch(() => null);
const clickText = (page, text, sel = 'button, a') => page.evaluate(([t, s]) => {
  const el = [...document.querySelectorAll(s)].find((e) => e.textContent.replace(/\s+/g, ' ').trim() === t)
    ?? [...document.querySelectorAll(s)].find((e) => e.textContent.includes(t));
  el?.click(); return Boolean(el);
}, [text, sel]);

/* ── layout checks (run in the page) ───────────────────── */
function layoutProbe() {
  const out = { clipped: [], overlaps: [], scrollers: [], hscroll: false };
  const desc = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}${txt ? ` "${txt}"` : ''}`;
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // timeline tick labels sit in an aria-hidden track but are visible text, so they are checked like any other text
  const decorative = (el) => !el.closest('.timeline__ticklabel') && el.closest('[aria-hidden="true"], .sr-only, svg, #fx-layer, .intro, [inert]');
  // a dock pinned with position: sticky (short windows) is an opaque bar that content scrolls behind
  const stickyDock = (el) => { const d = el?.closest?.('.dock'); return d && getComputedStyle(d).position === 'sticky' ? d : null; };
  for (const el of document.querySelectorAll('body *')) {
    if (decorative(el) || !shown(el)) continue;
    const cs = getComputedStyle(el);
    const hid = (v) => v === 'hidden' || v === 'clip';
    const paintClip = /paint|content|strict/.test(cs.contain) && cs.overflowY === 'visible';   // contain: paint clips too
    if ((hid(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) || (hid(cs.overflowY) && el.scrollHeight > el.clientHeight + 1)
      || (paintClip && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)))
      out.clipped.push(`${desc(el)} [content ${el.scrollWidth}×${el.scrollHeight} in ${el.clientWidth}×${el.clientHeight}]`);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.tagName !== 'TEXTAREA')
      out.scrollers.push(desc(el));
    // content pushed sideways out of a scroll box is hidden content too
    if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1 && el.tagName !== 'TEXTAREA')
      out.clipped.push(`${desc(el)} [scrolls sideways: content ${el.scrollWidth} wide in ${el.clientWidth}]`);
  }
  const se = document.scrollingElement;
  const pageLocked = getComputedStyle(document.documentElement).overflowY === 'hidden';   // a modal sheet locks the page
  if (se.scrollHeight > innerHeight + 1 && !pageLocked) out.scrollers.push('the page itself');
  if (se.scrollWidth > innerWidth + 1) out.hscroll = true;
  const sel = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="slider"], [role="radio"], [role="tab"], [role="switch"]';
  const visRect = (el) => {
    const r = el.getBoundingClientRect();
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const q = p.getBoundingClientRect();
        x1 = Math.max(x1, q.left); y1 = Math.max(y1, q.top); x2 = Math.min(x2, q.right); y2 = Math.min(y2, q.bottom);
      }
    }
    x1 = Math.max(x1, 0); y1 = Math.max(y1, 0); x2 = Math.min(x2, innerWidth); y2 = Math.min(y2, innerHeight);
    return x2 - x1 > 1 && y2 - y1 > 1 ? { x1, y1, x2, y2 } : null;
  };
  const boxes = [...document.querySelectorAll(sel)]
    .filter((el) => !el.closest('[aria-hidden="true"], [inert], #fx-layer') && shown(el))
    .map((el) => ({ el, r: visRect(el) })).filter((b) => b.r);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.x2, b.r.x2) - Math.max(a.r.x1, b.r.x1), h = Math.min(a.r.y2, b.r.y2) - Math.max(a.r.y1, b.r.y1);
      // scrolled behind the sticky dock: covered, not overlapping (checked at the overlap's centre)
      if (w > 1 && h > 1 && Boolean(stickyDock(a.el)) !== Boolean(stickyDock(b.el))) {
        const cx = (Math.max(a.r.x1, b.r.x1) + Math.min(a.r.x2, b.r.x2)) / 2, cy = (Math.max(a.r.y1, b.r.y1) + Math.min(a.r.y2, b.r.y2)) / 2;
        if (stickyDock(document.elementFromPoint(cx, cy))) continue;
      }
      if (w > 1 && h > 1) out.overlaps.push(`${desc(a.el)}  ×  ${desc(b.el)}  (${Math.round(w)}×${Math.round(h)}px)`);
    }
  // text that collides with a control or with other text (tight line boxes from Range.getClientRects)
  out.textOverlaps = [];
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || decorative(el) || !shown(el) || el.closest('#fx-layer, svg')) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const q of rg.getClientRects()) {
      if (q.width <= 2 || q.height <= 2) continue;
      // a line box spans the font's whole ascent/descent; trim to the glyph body so tight leading is not a "collision"
      const r = { left: q.left, right: q.right, top: q.top + q.height * 0.2, bottom: q.bottom - q.height * 0.2 };
      // only the part of the text that its scroll containers actually show
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX !== 'visible' || ps.overflowY !== 'visible') {
          const c = p.getBoundingClientRect();
          r.left = Math.max(r.left, c.left); r.top = Math.max(r.top, c.top); r.right = Math.min(r.right, c.right); r.bottom = Math.min(r.bottom, c.bottom);
        }
      }
      if (r.right - r.left <= 2 || r.bottom - r.top <= 2) continue;
      // text hidden under an opaque floating panel (drawer, popover, sheet) is not visible text
      const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      if (top && !el.contains(top) && !top.contains(el) && (top.closest('.drawer, .pop__panel, .sheetwrap, .specimen__prov') || (stickyDock(top) && !stickyDock(el)))) continue;
      texts.push({ el, r, t: n.textContent.trim().slice(0, 30) });
    }
  }
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const floating = (e) => e.closest('.drawer, .pop__panel, .sheetwrap, .specimen__prov');
  for (const tx of texts)
    for (const b of boxes) {
      if (b.el.contains(tx.el) || tx.el.contains(b.el)) continue;
      if (floating(tx.el) && !floating(b.el)) continue;      // a floating panel covers the control underneath
      if (Boolean(stickyDock(b.el)) !== Boolean(stickyDock(tx.el))) {   // one side has scrolled behind the sticky dock
        const cx = (Math.max(tx.r.left, b.r.x1) + Math.min(tx.r.right, b.r.x2)) / 2, cy = (Math.max(tx.r.top, b.r.y1) + Math.min(tx.r.bottom, b.r.y2)) / 2;
        if (stickyDock(document.elementFromPoint(cx, cy))) continue;
      }
      if (b.el.closest('tbody') && tx.el.closest('thead th') && getComputedStyle(tx.el.closest('th')).position === 'sticky') continue;   // sticky header covers scrolled rows
      const r = { left: b.r.x1, right: b.r.x2, top: b.r.y1, bottom: b.r.y2 };
      if (hit(tx.r, r)) out.textOverlaps.push(`text "${tx.t}" under ${desc(b.el)}`);
    }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++)
      if (texts[i].el !== texts[j].el && !texts[i].el.contains(texts[j].el) && !texts[j].el.contains(texts[i].el) && hit(texts[i].r, texts[j].r)
        && !(Boolean(texts[i].el.closest('thead')) !== Boolean(texts[j].el.closest('thead')) && (texts[i].el.closest('thead th') ?? texts[j].el.closest('thead th')) && getComputedStyle(texts[i].el.closest('thead th') ?? texts[j].el.closest('thead th')).position === 'sticky'))
        out.textOverlaps.push(`text "${texts[i].t}" × text "${texts[j].t}"`);
  return out;
}

/* ── screens ───────────────────────────────────────────── */
const firstConflictStep = async (page) => { for (let i = 0; i < 80; i++) { if (await page.$('.ptable .pcell.is-conflict.is-changed')) return true; await keys(page, 'ArrowRight', 1, 5); } return false; };
const SCREENS = [
  { id: 'home', hash: '#/', wait: 1600 },
  { id: 'home-paused', hash: '#/', act: async (p) => { await keys(p, 'ArrowRight', 9); } },
  { id: 'home-provenance', hash: '#/', act: async (p) => { await keys(p, 'End'); await sleep(100); await p.click('.specimen .pcell__btn:has(.rel)'); } },
  { id: 'home-narrow-820', hash: '#/', viewports: [[820, 1000]], pageScrollOk: true },
  { id: 'home-narrow-390', hash: '#/', viewports: [[390, 844]], pageScrollOk: true },
  { id: 'stage-drawer', hash: '#/opp/table', act: async (p) => { await p.click('.stages__toggle'); await sleep(250); } },
  { id: 'opp-grammar', hash: '#/opp/grammar' },
  { id: 'opp-grammar-adjacent', hash: '#/opp/grammar', act: (p) => clickText(p, 'Adjacent non-terminals', '.sample') },
  { id: 'opp-grammar-epsilon', hash: '#/opp/grammar', act: (p) => clickText(p, 'An ε-production', '.sample') },
  { id: 'opp-grammar-conflict', hash: '#/opp/grammar', act: (p) => clickText(p, 'Ambiguous expressions', '.sample') },
  { id: 'opp-sets', hash: '#/opp/sets', act: (p) => keys(p, 'ArrowRight', 20) },
  { id: 'opp-sets-end', hash: '#/opp/sets', act: (p) => keys(p, 'End') },
  { id: 'opp-table', hash: '#/opp/table', act: (p) => keys(p, 'ArrowRight', 14) },
  { id: 'opp-table-end', hash: '#/opp/table', act: (p) => keys(p, 'End') },
  { id: 'opp-table-provenance', hash: '#/opp/table', act: async (p) => { await keys(p, 'End'); await p.click('[data-cell="+ *"] .pcell__btn'); await sleep(350); } },
  { id: 'opp-table-conflict', hash: '#/opp/grammar', act: async (p) => { await clickText(p, 'Ambiguous expressions', '.sample'); await p.evaluate(() => { location.hash = '#/opp/table'; }); await sleep(400); await firstConflictStep(p); await sleep(300); } },
  { id: 'opp-table-conflict-end', hash: '#/opp/grammar', act: async (p) => { await clickText(p, 'Ambiguous expressions', '.sample'); await p.evaluate(() => { location.hash = '#/opp/table'; }); await sleep(400); await keys(p, 'End'); } },
  { id: 'opp-parse-conflict-blocked', hash: '#/opp/grammar', act: async (p) => { await clickText(p, 'Ambiguous expressions', '.sample'); await p.evaluate(() => { location.hash = '#/opp/parse'; }); await sleep(400); } },
  { id: 'opp-invalid-blocked', hash: '#/opp/grammar', act: async (p) => { await clickText(p, 'Adjacent non-terminals', '.sample'); await p.evaluate(() => { location.hash = '#/opp/sets'; }); await sleep(400); } },
  { id: 'opp-parse-shift', hash: '#/opp/parse', act: (p) => keys(p, 'ArrowRight', 1) },
  { id: 'opp-parse-reduce', hash: '#/opp/parse', act: (p) => keys(p, 'ArrowRight', 2) },
  { id: 'opp-parse-lookup', hash: '#/opp/parse', act: async (p) => { await keys(p, 'ArrowRight', 3); await clickText(p, 'Table lookup', '[role="tab"]'); } },
  { id: 'opp-parse-accept', hash: '#/opp/parse', act: (p) => keys(p, 'End') },
  { id: 'opp-parse-reject', hash: '#/opp/parse', act: async (p) => { await clickText(p, 'id + * id', '.chip'); await sleep(150); await keys(p, 'End'); } },
  { id: 'opp-parse-classic', hash: '#/opp/parse', act: async (p) => { await clickText(p, 'Classic N', '[role="radio"]'); await sleep(150); await keys(p, 'ArrowRight', 5); } },
  { id: 'opp-modes-open', hash: '#/opp/modes' },
  { id: 'opp-modes-diverge', hash: '#/opp/modes', act: (p) => keys(p, 'ArrowRight', 10) },
  { id: 'opp-modes-end', hash: '#/opp/modes', act: (p) => keys(p, 'End') },
  { id: 'lr', hash: '#/lr' },
  { id: 'regex-tree', hash: '#/regex/tree' },
  { id: 'regex-malformed', hash: '#/regex/tree', act: async (p) => { await clickText(p, 'ab(c|d', '.sample'); await p.click('button:has-text("Build tree")'); } },
  { id: 'regex-reserved-hash', hash: '#/regex/tree', act: async (p) => { await clickText(p, 'a#b', '.sample'); await p.click('button:has-text("Build tree")'); } },
  { id: 'regex-props', hash: '#/regex/props', act: (p) => keys(p, 'ArrowRight', 7) },
  { id: 'regex-props-end', hash: '#/regex/props', act: (p) => keys(p, 'End') },
  { id: 'regex-follow', hash: '#/regex/follow', act: (p) => keys(p, 'ArrowRight', 3) },
  { id: 'regex-follow-provenance', hash: '#/regex/follow', act: async (p) => { await keys(p, 'End'); await p.click('.ftable__btn'); } },
  { id: 'regex-dfa', hash: '#/regex/dfa', act: (p) => keys(p, 'ArrowRight', 4) },
  { id: 'regex-dfa-end', hash: '#/regex/dfa', act: (p) => keys(p, 'End') },
  { id: 'regex-dfa-big', hash: '#/regex/tree', act: async (p) => { await p.fill('.field__input--regex', '(a|b)*a(a|b)(a|b)'); await p.keyboard.press('Enter'); await sleep(150); await p.evaluate(() => { location.hash = '#/regex/dfa'; }); await sleep(400); await keys(p, 'End'); } },
  { id: 'regex-sim', hash: '#/regex/sim', act: (p) => keys(p, 'ArrowRight', 3) },
  { id: 'regex-sim-accept', hash: '#/regex/sim', act: (p) => keys(p, 'End') },
  { id: 'regex-sim-reject', hash: '#/regex/sim', act: async (p) => { await clickText(p, 'ab', '.chip'); await sleep(150); await keys(p, 'End'); } },
];

const browser = await launch();
const screenshots = [];

console.log('— screens × viewports: clipping, overlap, scrollbars —');
if (want('screens')) for (const s of SCREENS) {
  for (const vp of s.viewports ?? VIEWPORTS) {
    const { ctx, page } = await open(browser, { viewport: vp, storage: s.storage ?? {} });
    try {
      await go(page, s.hash);
      if (s.act) await s.act(page);
      await sleep(s.wait ?? 650);
      const tag = `${vp[0]}x${vp[1]}`;
      mkdirSync(join(SHOTS, tag), { recursive: true });
      const file = join(SHOTS, tag, `${s.id}.png`);
      await page.screenshot({ path: file });
      screenshots.push({ id: s.id, vp: tag, file });
      const L = await page.evaluate(layoutProbe);
      const scrollers = L.scrollers;
      // the desktop rule (no page scroll) applies at >= 1000 x 720; in narrower or shorter windows the page is
      // the one allowed scroller (see the narrow and short-window layouts in shell.css)
      const pageOk = s.pageScrollOk || vp[0] < 1000 || vp[1] < 720 || (vp[0] < 1200 && vp[1] < 860);   // matches the short-window CSS in shell.css
      check('layout', `${s.id} @ ${tag}: no clipped text`, L.clipped.length === 0, L.clipped.join('\n'));
      check('layout', `${s.id} @ ${tag}: no overlapping interactive elements`, L.overlaps.length === 0, L.overlaps.join('\n'));
      check('layout', `${s.id} @ ${tag}: no text overlapping other text or a control`, L.textOverlaps.length === 0, L.textOverlaps.slice(0, 12).join('\n'));
      check('layout', `${s.id} @ ${tag}: at most one vertical scrollbar${pageOk ? '' : ', no page scroll'}`,
        scrollers.length <= 1 && (pageOk || !scrollers.includes('the page itself')), scrollers.join(' | '));
      check('layout', `${s.id} @ ${tag}: no horizontal page scroll`, !L.hscroll);
    } catch (e) {
      check('layout', `${s.id} @ ${vp.join('x')}: screen could be driven`, false, e.message);
    }
    await ctx.close();
  }
}

/* ── homepage acceptance ───────────────────────────────── */
console.log('\n— homepage acceptance —');
if (want('home')) {
  const { ctx, page } = await open(browser, { init: () => { try { localStorage.setItem('cl.intro.seen.v2', '1'); } catch {} } });
  await go(page, '#/');
  const L = await page.evaluate(layoutProbe);
  check('home', '1. first view fits 1366×768: no page scroll, no clipped text, no overlaps',
    !L.scrollers.includes('the page itself') && L.clipped.length === 0 && L.overlaps.length === 0, JSON.stringify(L));
  // 2. the specimen table equals buildPrecedenceTable (the unit test checks the data; this checks the DOM)
  await keys(page, 'End'); await sleep(200);
  const spec = buildSpecimen();
  const expected = specimenTable(spec, spec.frames.length);
  const dom = await page.$$eval('.specimen .ptable td', (tds) => tds.map((td) => [td.dataset.cell, [...td.querySelectorAll('.rel')].map((r) => r.dataset.rel).join('')]));
  const mism = dom.filter(([k, v]) => { const [a, b] = k.split(' '); return (expected.get(cellKey(a, b))?.relations.join('') ?? '') !== v; });
  check('home', `2. specimen table equals buildPrecedenceTable (${dom.length} cells compared)`, dom.length === spec.a.table.axes.length ** 2 && mism.length === 0, JSON.stringify(mism));
  // 3. tab order: headline → doors → specimen controls; doors operable by keyboard.
  //    The headline block has no links of its own (the doors are the single entry), so it may have no tab stops.
  await go(page, '#/');
  const order = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return a.closest('.skip') ? 'skip' : a.closest('.rail') ? 'rail' : a.closest('.home__lead') ? 'headline' : a.closest('.doors') ? 'door' : a.closest('.specimen') ? 'specimen' : 'other';
    });
    if (where) order.push(where);
  }
  // one pass through the page: stop where focus wraps back to the first stop
  const wrap = order.indexOf(order[0], 1);
  if (wrap > 0) order.length = wrap;
  const firstOf = (k) => order.indexOf(k), lastOf = (k) => order.lastIndexOf(k);
  const okOrder = !order.includes('other') && firstOf('door') >= 0 && firstOf('door') > lastOf('headline') && firstOf('specimen') > lastOf('door') && order.filter((x) => x === 'door').length === 3;
  check('home', `3a. Tab order is headline → doors (3) → specimen controls`, okOrder, order.join(' → '));
  const doors = [];
  for (const [idx, want] of [[0, '#/opp/grammar'], [1, '#/lr'], [2, '#/regex/tree']]) {
    await go(page, '#/');
    await page.focus(`.doors .door:nth-child(${idx + 1}) a`);
    await page.keyboard.press('Enter');
    await sleep(300);
    doors.push([want, await page.evaluate(() => location.hash)]);
  }
  check('home', '3b. all three doors open their tool with Enter', doors.every(([w, h]) => h === w), JSON.stringify(doors));
  // 4. zero network requests (counted across this whole run; reported at the end too)
  check('home', '4. zero network requests so far', allNet.length === 0, allNet.join('\n'));
  // 5. logo removed: a screenshot for human review
  await go(page, '#/');
  await page.evaluate(() => { document.querySelector('.rail__brand').style.visibility = 'hidden'; });
  await sleep(900);
  await page.screenshot({ path: join(SHOTS, 'home-without-logo.png') });
  check('home', '5. logo-removed screenshot written for review (artifacts/screenshots/home-without-logo.png)', true);
  // the project title block is part of the first view, and there is no navigation-instructions note
  await go(page, '#/');
  const tb = await page.evaluate(() => {
    const el = document.querySelector('.home__lead .titleblock');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { text: el.textContent, inView: r.top >= 0 && r.bottom <= innerHeight, note: Boolean(document.querySelector('.firstnote')) };
  });
  check('home', 'project title block (project, team, members, year) is fully visible in the first view; no course row, no navigation note',
    Boolean(tb) && tb.inView && !tb.note && !tb.text.includes('Course') && ['ParseLens', 'Interactive GUI for Operator Precedence Parsing', 'Team Compilers', 'Harsh Jha', '24BCE0568', 'Anuj Deshpande', '24BCE0794', '2026'].every((t) => tb.text.includes(t)),
    JSON.stringify(tb));
  await ctx.close();
}

/* ── keyboard-only demos ───────────────────────────────── */
async function arrive(page, hash) {
  await page.waitForFunction((h) => location.hash === h, hash, { timeout: 3000 }).catch(() => {});
  await page.waitForSelector('.plate__title'); await sleep(450);
}
async function tabTo(page, pred, max = 120) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    // a scroll region made focusable (src/ui/scrollFocus.ts) contains its controls' text; it is a stop, not the target
    if (await page.evaluate(() => document.activeElement?.dataset?.scrollFocus === '1')) continue;
    if (await page.evaluate(pred)) return true;
  }
  return false;
}
console.log('\n— keyboard-only demos —');
if (want('keyboard')) {
  const { ctx, page } = await open(browser);
  await go(page, '#/');
  const steps = [];
  const log = (s, ok) => steps.push(`${ok ? '✓' : '✗'} ${s}`);
  let ok = await tabTo(page, () => document.activeElement?.closest('.door') && document.activeElement.textContent.includes('Operator precedence'));
  log('Tab to door I', ok);
  await page.keyboard.press('Enter'); await sleep(300);
  log('Enter opens 1 Grammar', (await page.evaluate(() => location.hash)) === '#/opp/grammar');
  ok = await tabTo(page, () => document.activeElement?.textContent === 'Check grammar');
  await page.keyboard.press('Enter'); await sleep(200);
  log('Tab to "Check grammar" and press it (the result only appears after the check)', ok && Boolean(await page.$('.result--ok')));
  ok = await tabTo(page, () => document.activeElement?.textContent?.includes('Derive LEADING and TRAILING'));
  log('Tab to "Derive LEADING and TRAILING"', ok);
  await page.keyboard.press('Enter'); await arrive(page, '#/opp/sets');
  await page.keyboard.press('End'); await sleep(200);
  log('LEADING/TRAILING: End shows the final step', (await readout(page)) === (await total(page)));
  const leadE = await page.evaluate(() => [...document.querySelectorAll('.setline')].find((l) => l.textContent.startsWith('LEADING(E)'))?.textContent.replace(/\s+/g, ''));
  log(`LEADING(E) = ${leadE}`, leadE === 'LEADING(E)={+,*,(,id}');
  ok = await tabTo(page, () => document.activeElement?.getAttribute('aria-label')?.startsWith('Next stage'));
  log('Tab to "Next stage"', ok);
  await page.keyboard.press('Enter'); await arrive(page, '#/opp/table');
  await keys(page, 'ArrowRight', 3); await keys(page, 'ArrowLeft', 1);
  log('Table: → → → ← lands on step 2', (await readout(page)) === 2);
  await page.keyboard.press('End'); await sleep(200);
  log('Table: End reaches the verdict "Conflict-free"', await page.$eval('.plate__aside', (e) => e.textContent.includes('Conflict-free')));
  ok = await tabTo(page, () => document.activeElement?.getAttribute('aria-label')?.startsWith('Next stage'));
  await page.keyboard.press('Enter'); await arrive(page, '#/opp/parse');
  log('Parse stage reached by keyboard', ok && (await page.evaluate(() => location.hash)) === '#/opp/parse');
  await page.keyboard.press(' '); await sleep(1300); await page.keyboard.press(' ');
  log('Space plays and pauses', ((await readout(page)) ?? 0) >= 1);
  await page.keyboard.press('End'); await sleep(200);
  log('Parse: End reaches ACCEPT for id + id * id', await page.$eval('.decision', (e) => e.textContent.includes('ACCEPT')));
  ok = await tabTo(page, () => document.activeElement?.getAttribute('aria-label')?.startsWith('Next stage'));
  await page.keyboard.press('Enter'); await arrive(page, '#/opp/modes');
  // visible text only: productions carry a screen-reader-only "derives" between the sides
  const opening = await page.evaluate(() => { const g = document.querySelector('.controls__grammar')?.cloneNode(true); g?.querySelectorAll('.sr-only').forEach((n) => n.remove()); return { g: g?.textContent.replace(/\s+/g, ' '), s: document.querySelector('.controls .field__input')?.value }; });
  log(`Classic vs Safeguarded opens on S → A + B with ${opening.s}`, ok && opening.g?.replace(/\s/g, '').includes('S→A+B') && opening.s === 'id/id+id*id');
  await page.keyboard.press('End'); await sleep(200);
  const verdicts = await page.$$eval('.duo .verdict__word', (v) => v.map((x) => x.textContent));
  log(`End: Classic ${verdicts[0]}, Safeguarded ${verdicts[1]}`, verdicts[0] === 'ACCEPT' && verdicts[1] === 'REJECT');
  check('keyboard', 'full Operator Precedence demo with the keyboard only', steps.every((s) => s.startsWith('✓')), steps.join('\n'));

  // RE → DFA
  const st = [];
  const log2 = (s, ok2) => st.push(`${ok2 ? '✓' : '✗'} ${s}`);
  await go(page, '#/');
  ok = await tabTo(page, () => document.activeElement?.closest('.door') && document.activeElement.textContent.includes('Regex'));
  log2('Tab to door III', ok);
  await page.keyboard.press('Enter'); await sleep(300);
  ok = await tabTo(page, () => document.activeElement?.classList.contains('field__input--regex'));
  await page.keyboard.press('Control+A'); await page.keyboard.type('(a|b)*abb'); await page.keyboard.press('Enter'); await sleep(200);
  log2('Type (a|b)*abb and build with Enter', ok && (await page.$('.tree')) !== null);
  ok = await tabTo(page, () => document.activeElement?.textContent?.includes('Compute node properties'));
  await page.keyboard.press('Enter'); await arrive(page, '#/regex/props');
  log2('Open 2 node properties', ok && (await page.evaluate(() => location.hash)) === '#/regex/props');
  for (const [stage, want] of [['follow', '#/regex/follow'], ['dfa', '#/regex/dfa'], ['sim', '#/regex/sim']]) {
    await page.keyboard.press('End'); await sleep(150);
    ok = await tabTo(page, () => document.activeElement?.getAttribute('aria-label')?.startsWith('Next stage'));
    await page.keyboard.press('Enter'); await arrive(page, want);
    log2(`End, then Next stage to ${stage}`, ok && (await page.evaluate(() => location.hash)) === want);
    if (stage === 'sim') break;
  }
  await page.keyboard.press('End'); await sleep(200);
  log2('Simulation: End accepts abb', await page.$eval('.inspector', (e) => e.textContent.includes('ACCEPT')));
  check('keyboard', 'full RE→DFA demo with the keyboard only', st.every((s) => s.startsWith('✓')), st.join('\n'));

  // timeline by keyboard
  await go(page, '#/opp/table');
  await page.focus('.timeline__range'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  check('keyboard', `timeline is operable by keyboard (step ${await readout(page)})`, (await readout(page)) === 2);
  check('keyboard', 'there is no speed dial (removed in the Review-1 audit)', (await page.$$('.dial, [aria-label="Playback speed"]')).length === 0);
  await page.keyboard.press('Escape'); await page.click('.plate__title');
  await page.keyboard.press('PageDown'); await sleep(300);
  const down = await page.evaluate(() => location.hash);
  await page.keyboard.press('PageUp'); await sleep(300);
  check('keyboard', `PageDown / PageUp move between stages (${down})`, down === '#/opp/parse' && (await page.evaluate(() => location.hash)) === '#/opp/table');
  // the grammar picker on stages 2–4 switches the analysed grammar without going back to stage 1
  const verdictTag = async () => { await page.click('.plate__title'); await page.keyboard.press('End'); await sleep(300); return page.$eval('.plate__aside .tag', (e) => e.textContent).catch(() => ''); };
  await page.selectOption('.picker__select', 'conflict'); await sleep(300);
  const conflictAside = await verdictTag();
  await page.selectOption('.picker__select', 'adjacent'); await sleep(300);
  const invalidPicker = (await page.$$('.picker__select')).length === 1 && /no valid operator grammar/i.test(await page.textContent('.plate__body'));
  await page.selectOption('.picker__select', 'expr'); await sleep(300);
  check('keyboard', 'grammar picker on the table plate loads a conflicting grammar, an invalid one (picker stays), and back',
    /conflicting cell/.test(conflictAside) && invalidPicker && /Conflict-free/.test(await verdictTag()), conflictAside);
  await ctx.close();
}

/* ── forward then Back yields the identical DOM ───────── */
console.log('\n— forward then Back restores the identical rendered DOM —');
if (want('replay')) {
  const { ctx, page } = await open(browser);
  const snap = () => page.evaluate(() => {
    const body = document.querySelector('.plate__body')?.innerHTML ?? '';
    const fx = document.getElementById('fx-layer')?.childElementCount ?? 0;
    return { html: body, fx, step: document.querySelector('.dock__readout b')?.textContent };
  });
  for (const hash of ['#/opp/sets', '#/opp/table', '#/opp/parse', '#/opp/modes', '#/regex/props', '#/regex/follow', '#/regex/dfa', '#/regex/sim']) {
    await go(page, hash);
    const n = await total(page);
    const bad = [];
    for (let k = 0; k < n; k++) {
      const before = await snap();
      await page.keyboard.press('ArrowRight');
      await sleep([0, 40, 420][k % 3]);                 // Back immediately, mid-animation, and after it settles
      await page.keyboard.press('ArrowLeft');
      await sleep(30);
      const after = await snap();
      if (after.html !== before.html || after.fx !== 0) bad.push(`step ${k}: ${after.html === before.html ? `${after.fx} overlay(s) left` : 'DOM differs'}`);
      await page.keyboard.press('ArrowRight');
      await sleep(5);
    }
    check('replay', `${hash}: Back restores the exact DOM at all ${n} steps (incl. mid-animation)`, bad.length === 0, bad.slice(0, 6).join('\n'));
  }
  await ctx.close();
}

/* ── reduced motion ────────────────────────────────────── */
console.log('\n— reduced motion —');
if (want('reduced')) {
  const { ctx, page } = await open(browser, { reduced: true, init: () => {} });
  await go(page, '#/');
  await sleep(500);
  const home = await page.evaluate(() => ({ anims: document.getAnimations().length, count: document.querySelector('.specimen__count')?.textContent, key: document.querySelector('.specimen__controls .keycap')?.getAttribute('aria-label') }));
  check('reduced', `prefers-reduced-motion: static, finished specimen with a Replay keycap and no animations (${home.count}, "${home.key}")`,
    home.anims === 0 && /^(\d+) of \1$/.test(home.count ?? '') && home.key === 'Replay the specimen', JSON.stringify(home));
  await go(page, '#/opp/table');
  const anims = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowRight'); anims.push(await page.evaluate(() => document.getAnimations().length + (document.getElementById('fx-layer')?.childElementCount ?? 0))); }
  check('reduced', 'stepping forward runs no animations and draws no overlays', anims.every((a) => a === 0), anims.join(','));
  const still = await page.evaluate(() => ({ cell: Boolean(document.querySelector('.pcell.is-changed .corners')), note: document.querySelector('.note__headline')?.textContent }));
  check('reduced', 'every step is still explained without motion (corner brackets + note)', still.cell && Boolean(still.note), JSON.stringify(still));
  await ctx.close();
  // seeded before the app boots (writing it mid-session and reloading races the storage backend under load)
  const { ctx: c2, page: p2 } = await open(browser, { storage: { 'cl.reduced': '1' } });
  await go(p2, '#/opp/table');
  for (let i = 0; i < 6; i++) await p2.keyboard.press('ArrowRight');
  const n2 = await p2.evaluate(() => [...document.getAnimations().map((a) => `${a.constructor.name} ${a.animationName ?? a.transitionProperty ?? ''} on ${a.effect?.target?.tagName}.${a.effect?.target?.getAttribute?.('class')}`),
    ...[...(document.getElementById('fx-layer')?.children ?? [])].map((c) => `overlay ${c.className}`)]);
  check('reduced', 'a stored reduced-motion preference (cl.reduced) also stops all motion', n2.length === 0, n2.join('\n'));
  await c2.close();
}

/* ── grayscale legibility ──────────────────────────────── */
console.log('\n— grayscale legibility —');
if (want('grayscale')) {
  const { ctx, page } = await open(browser);
  await go(page, '#/opp/grammar');
  await clickText(page, 'Ambiguous expressions', '.sample');
  await page.click('text=Check grammar'); await sleep(150);   // examples only fill the editor; the check analyses them
  await page.evaluate(() => { location.hash = '#/opp/table'; }); await sleep(300);
  await keys(page, 'End');
  await page.addStyleTag({ content: 'html { filter: grayscale(1); }' });
  await sleep(300);
  await page.screenshot({ path: join(SHOTS, 'grayscale-conflict-table.png') });
  const g = await page.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !b.startsWith('rgba(0, 0, 0, 0)') && b !== 'transparent') return b; } return 'rgb(255,255,255)'; };
    const rels = [...document.querySelectorAll('.ptable .rel')].map((r) => ({ g: r.dataset.rel, c: ratio(getComputedStyle(r).color, bgOf(r)) }));
    const kinds = [...new Set(rels.map((r) => r.g))];
    const conflicts = [...document.querySelectorAll('.pcell.is-conflict')].map((c) => ({ fracture: Boolean(c.querySelector('.pcell__fracture')), count: c.querySelector('.pcell__count')?.textContent, slash: Boolean(c.querySelector('.pcell__slash')) }));
    return { min: Math.min(...rels.map((r) => r.c)), kinds, conflicts };
  });
  check('grayscale', `⋖ ⋗ ≐ keep ≥ 4.5:1 luminance contrast in grayscale (min ${g.min.toFixed(2)}:1)`, g.min >= 4.5);
  check('grayscale', `the three relations are told apart by glyph shape, not colour (${g.kinds.join(' ')})`, g.kinds.length === 3);
  check('grayscale', `conflict cells carry structure, not just colour: fracture marks, ×2 count, slash between glyphs (${g.conflicts.length} cells)`,
    g.conflicts.length >= 2 && g.conflicts.every((c) => c.fracture && c.count === '×2' && c.slash), JSON.stringify(g.conflicts));
  await ctx.close();
}

/* ── frame rate under CPU throttling ───────────────────── */
console.log('\n— frame rate with 4× CPU throttling (Chrome software compositing) —');
if (want('fps')) {
  const swBrowser = await launch({ compositing: 'software' });
  const { ctx, page } = await open(swBrowser);
  // Frames are classified: a "commit" frame is one in which the step changed (React renders the new
  // state, the browser lays it out and rasterises it); every other frame is an "animation" frame.
  // Motion must hold 60 fps on animation frames; commit frames are reported separately with their worst time.
  const once = async (hash, start) => {
    await go(page, hash);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    if (start) await start(page);
    const r = await page.evaluate(() => new Promise((resolve) => {
      const target = document.querySelector('.dock__readout b, .specimen__count');
      let changed = false;
      const mo = new MutationObserver(() => { changed = true; });
      if (target) mo.observe(target, { childList: true, characterData: true, subtree: true });
      const anim = [], commit = []; let last = 0; const t0 = performance.now();
      const f = (t) => {
        if (last) (changed ? commit : anim).push(t - last);
        changed = false; last = t;
        if (t - t0 < 4000) requestAnimationFrame(f); else { mo.disconnect(); resolve({ anim, commit }); }
      };
      requestAnimationFrame(f);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
    const all = [...r.anim, ...r.commit].sort((a, b) => a - b);
    return { fps: 1000 / all[Math.floor(all.length / 2)], longAnim: r.anim.filter((x) => x > 25).length, anim: r.anim.length, commits: r.commit.length, worstCommit: Math.max(0, ...r.commit) };
  };
  // three 4-second runs per scenario; the median run (by long-frame share) is judged, all three are reported
  const measure = async (hash, label, start) => {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await once(hash, start));
    runs.sort((a, b) => a.longAnim / a.anim - b.longAnim / b.anim);
    const m = runs[1];
    const share = (x) => `${x.longAnim}/${x.anim}`;
    check('fps', `${label}: median ${m.fps.toFixed(1)} fps; animation frames over 25 ms: ${share(m)} (runs: ${runs.map(share).join(', ')}); ${m.commits} step commits, worst ${m.worstCommit.toFixed(0)} ms`,
      m.fps >= 55 && m.longAnim / Math.max(1, m.anim) <= 0.05 && m.worstCommit < 120, JSON.stringify(runs));
  };
  await measure('#/', 'homepage specimen running');
  await measure('#/opp/table', 'precedence table playing with motion', async (p) => { await p.keyboard.press(' '); });
  await measure('#/opp/parse', 'parse bench playing with motion', async (p) => { await p.keyboard.press(' '); });
  await measure('#/regex/sim', 'DFA simulation playing', async (p) => { await p.keyboard.press(' '); });
  await ctx.close();
  await swBrowser.close();
}

/* ── no WebGL needed ───────────────────────────────────── */
console.log('\n— runs without WebGL —');
if (want('intro')) {
  const noGl = await launch({ webgl: false });
  const c4 = await noGl.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
  await c4.addInitScript(CHECKED);
  const p4 = await c4.newPage();
  p4.on('pageerror', (e) => allErrors.push(`pageerror (no WebGL) ${e.message}`));
  await p4.goto(BASE + '#/'); await sleep(800);
  const gl = await p4.evaluate(() => { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl') || c.getContext('webgl2')); });
  await p4.goto(BASE + '#/opp/table'); await sleep(600);
  const ok = await p4.evaluate(() => Boolean(document.querySelector('.ptable td')));
  check('intro', `with WebGL disabled (${gl ? 'still available!' : 'disabled'}) the precedence table renders`, !gl && ok);
  await noGl.close();
}

/* ── fonts and glyphs ──────────────────────────────────── */
console.log('\n— fonts —');
if (want('fonts')) {
  const { ctx, page } = await open(browser);
  await go(page, '#/opp/table');
  await keys(page, 'End');
  const f = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      loaded: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family.replace(/"/g, '')),
      rels: document.querySelectorAll('.rel').length,
      svgRels: document.querySelectorAll('.rel.rel--svg svg').length,
    };
  });
  check('fonts', 'IBM Plex Sans, Serif and Mono loaded from the bundle', ['IBM Plex Sans Variable', 'IBM Plex Serif', 'IBM Plex Mono'].every((n) => f.loaded.includes(n)), f.loaded.join(', '));
  check('fonts', `every relation glyph ⋖ ⋗ ≐ is inline SVG, no glyph font needed (${f.svgRels}/${f.rels})`, f.rels > 10 && f.svgRels === f.rels, JSON.stringify(f));
  check('fonts', 'no IBM Plex Math face is declared', ![...(await page.evaluate(() => [...document.fonts].map((x) => x.family)))].some((n) => /Math/.test(n) && /Plex/.test(n)));
  await ctx.close();
}


/* ── static scan of the built bundle ───────────────────── */
/* ── repairs from COMPILER_LAB_AUDIT (D-xx) ───────────── */
console.log('\n— audit repairs (D-01 … D-35) —');
if (want('repair')) {
  const { ctx, page } = await open(browser);
  // D-01: the specimen's Space pauses the one loop that runs; Space again resumes it from the same frame
  await go(page, '#/');
  await page.evaluate(() => document.activeElement?.blur());
  const specCount = () => page.$eval('.specimen__count', (e) => Number(e.textContent.split(' ')[0]));
  const specState = () => page.$eval('.specimen__state', (e) => e.textContent);
  await sleep(900);
  await page.keyboard.press(' '); await sleep(100);
  const p0 = await specCount(), s0 = await specState();
  await sleep(2200);
  const p1 = await specCount();
  await page.keyboard.press(' '); await sleep(1600);
  const p2 = await specCount(), s2 = await specState();
  await page.keyboard.press(' '); await sleep(100);
  const p3 = await specCount(); await sleep(1500);
  const p4 = await specCount();
  check('repair', `D-01 specimen: Space pauses (${s0}, frame ${p0} → ${p1}), resumes (${s2}, → ${p2}), pauses again (${p3} → ${p4})`,
    s0 === 'Paused' && p1 === p0 && /Running/.test(s2) && p2 > p0 && p4 === p3);
  // Nothing is shown as checked until the user presses Check grammar
  {
    const fresh = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
    await fresh.addInitScript(() => { try { localStorage.setItem('cl.intro.seen.v2', '1'); } catch {} });
    const fp = await fresh.newPage();
    await fp.goto(BASE + '#/opp/grammar'); await sleep(300);
    const before = await fp.evaluate(() => ({ result: document.querySelector('.result')?.textContent ?? '', valid: Boolean(document.querySelector('.result--ok')), prods: Boolean(document.querySelector('.prodlist')) }));
    await fp.goto(BASE + '#/opp/sets'); await sleep(300);
    const blocked = await fp.evaluate(() => /not been checked/.test(document.querySelector('.plate__body')?.textContent ?? '') && !document.querySelector('.setblock'));
    await fp.goto(BASE + '#/opp/grammar'); await sleep(300);
    await fp.click('text=Check grammar'); await sleep(200);
    const after = await fp.evaluate(() => Boolean(document.querySelector('.result--ok')));
    await fp.goto(BASE + '#/opp/sets'); await sleep(300);
    const sets = Boolean(await fp.$('.setblock'));
    check('repair', 'stage 1 shows no result until Check grammar; stages 2–4 wait for it; after the check both appear',
      /Not checked yet/.test(before.result) && !before.valid && !before.prods && blocked && after && sets, JSON.stringify({ before, blocked, after, sets }));
    // the same for the regex chapter: nothing is built until Build tree
    await fp.goto(BASE + '#/regex/tree'); await sleep(300);
    const r0 = await fp.evaluate(() => ({ msg: /Not built yet/.test(document.querySelector('.figure--tree')?.textContent ?? ''), tree: Boolean(document.querySelector('.tree')) }));
    await fp.goto(BASE + '#/regex/dfa'); await sleep(300);
    const rBlocked = await fp.evaluate(() => /has not been built/.test(document.querySelector('.plate__body')?.textContent ?? '') && !document.querySelector('.dfa'));
    await fp.goto(BASE + '#/regex/tree'); await sleep(300);
    await fp.click('button:has-text("Build tree")'); await sleep(200);
    const rTree = Boolean(await fp.$('.tree'));
    await fp.goto(BASE + '#/regex/dfa'); await sleep(300);
    const rDfa = Boolean(await fp.$('.dfa'));
    check('repair', 'regex stage 1 builds nothing until Build tree; stages 2–5 wait for it; after building both appear',
      r0.msg && !r0.tree && rBlocked && rTree && rDfa, JSON.stringify({ r0, rBlocked, rTree, rDfa }));
    await fresh.close();
  }
  // D-06: the disabled stage arrow is a real disabled button with a name
  await go(page, '#/opp/grammar');
  const arrow = await page.$eval('.stages__step.is-off', (e) => ({ tag: e.tagName, disabled: e.disabled, name: e.getAttribute('aria-label') }));
  check('repair', `D-06 first-stage "previous" arrow is <${arrow.tag.toLowerCase()} disabled> named "${arrow.name}"`, arrow.tag === 'BUTTON' && arrow.disabled && /Previous stage/.test(arrow.name));
  // D-04: a sample over unchecked edits asks first; Cancel keeps the text and returns focus; Replace loads it
  const mine = 'E -> E - T | T\nT -> id';
  await page.fill('#grammar-text', mine);
  await page.click('.samples .sample >> nth=1');
  await sleep(150);
  const dlg = await page.evaluate(() => { const d = document.querySelector('dialog.confirm'); return { open: Boolean(d?.open), focus: document.activeElement?.textContent }; });
  await page.keyboard.press('Escape'); await sleep(150);
  const kept = await page.$eval('#grammar-text', (e) => e.value);
  const back = await page.evaluate(() => document.activeElement?.classList.contains('sample'));
  const gone = await page.evaluate(() => !document.querySelector('dialog.confirm'));
  await page.click('.samples .sample >> nth=1'); await sleep(150);
  await page.getByRole('button', { name: 'Replace', exact: true }).click(); await sleep(200);
  const replaced = await page.$eval('#grammar-text', (e) => e.value);
  check('repair', 'D-04 unchecked edits: a dialog asks (focus on Cancel); Escape keeps the text and restores focus; Replace loads the sample',
    dlg.open && dlg.focus === 'Cancel' && kept === mine && back && gone && replaced !== mine, JSON.stringify({ dlg, kept, back, gone }));
  // … and the user's text is still one choice away
  await page.click('.samples .sample >> text=Your grammar'); await sleep(200);
  check('repair', 'D-04 "Your grammar" brings the replaced text back', (await page.$eval('#grammar-text', (e) => e.value)) === mine);
  // D-34: checking an unchanged grammar is acknowledged
  await page.click('text=Check grammar'); await sleep(100); await page.click('text=Check grammar'); await sleep(100);
  check('repair', 'D-34 re-checking an unchanged grammar says so', /nothing changed/.test(await page.$eval('.actions__state', (e) => e.textContent)));
  // D-03: later stages flag unchecked grammar edits and offer the check
  await page.fill('#grammar-text', 'E -> E + T | T\nT -> id\nZ -> z');
  await page.goto(BASE + '#/opp/table'); await sleep(300);
  const stale = await page.$('.stale');
  await page.click('.stale >> text=Check grammar now'); await sleep(300);
  const after = await page.$('.stale');
  const axes = await page.$$eval('.plate__body .ptable thead th', (t) => t.map((x) => x.textContent.trim()).filter(Boolean));
  check('repair', `D-03 stage 3 marks results "Out of date" while stage 1 is unchecked; "Check grammar now" updates them (axes ${axes.join(' ')})`,
    Boolean(stale) && !after && axes.includes('z'));
  // D-02: an edited parse string is flagged; switching the mode re-runs the shown string, not the draft
  await go(page, '#/opp/grammar');
  await page.click('.samples .sample >> nth=0'); await sleep(200);
  await page.click('text=Check grammar'); await sleep(200);
  await page.goto(BASE + '#/opp/parse'); await sleep(300);
  const input = '.plate__controls .field__input';
  await page.fill(input, 'id * id');
  const hint = await page.$eval('.dirtyhint', (e) => e.textContent).catch(() => '');
  await page.click('.modes__opt >> text=Classic N'); await sleep(200);
  const traceInput = await page.$eval('.trace tbody tr td.trace__input', (e) => e.textContent);
  check('repair', `D-02 parse: "Not run yet" names the shown string; the mode switch keeps it (${traceInput})`,
    /Not run yet/.test(hint) && /id \+ id \* id/.test(hint) && traceInput.startsWith('id + id * id'), hint);
  await page.click('.modes__opt >> text=Safeguarded'); await sleep(100);
  // D-05: stage 1 → stage 5 hands over a sentence the grammar derives
  await page.goto(BASE + '#/opp/modes'); await sleep(300);
  await page.click('text=Use the grammar from stage 1'); await sleep(300);
  const handed = await page.$eval('.controls .field__input', (e) => e.value);
  const safe = await page.$$eval('.duo .bench__title .tag', (t) => t.map((x) => x.textContent));
  check('repair', `D-05 stage 5 receives "${handed}" (a sentence, not the terminal list) and Safeguarded accepts it`, handed !== '+ * ( ) id' && safe[1] === 'Accepted', JSON.stringify(safe));
  // Coming back to stage 1 always starts unchecked (check again and again); later stages keep the last check
  await page.goto(BASE + '#/opp/grammar'); await sleep(200);
  await page.click('text=Check grammar'); await sleep(150);
  const shownAfterCheck = Boolean(await page.$('.result--ok'));
  await page.goto(BASE + '#/opp/sets'); await sleep(300);
  const setsStill = Boolean(await page.$('.setblock'));
  await page.goto(BASE + '#/opp/grammar'); await sleep(300);
  const hiddenAgain = !(await page.$('.result--ok')) && /Not checked yet/.test(await page.$eval('.actions__state', (e) => e.textContent));
  await page.click('text=Check grammar'); await sleep(150);
  const firstAgain = (await page.$eval('.actions__state', (e) => e.textContent)) === 'Checked';
  check('repair', 'stage 1 resets to "Not checked yet" on every visit and can be checked again; stage 2 keeps the last check',
    shownAfterCheck && setsStill && hiddenAgain && firstAgain && Boolean(await page.$('.result--ok')), JSON.stringify({ shownAfterCheck, setsStill, hiddenAgain, firstAgain }));
  // LR parsing is its own chapter: the Bottom-Up (operator precedence) tab is not marked current there
  await page.goto(BASE + '#/lr'); await sleep(200);
  const railLr = await page.$$eval('.rail__link.is-current, .rail__link[aria-current]', (e) => e.map((x) => x.textContent));
  const plateNo = await page.$('.plate__no');
  check('repair', `LR page marks no operator-precedence tab as current (${JSON.stringify(railLr)}); no "Plate …" line`, railLr.length === 0 && !plateNo);
  // D-22: a refresh keeps the inputs (sessionStorage)
  await page.goto(BASE + '#/opp/grammar'); await sleep(200);
  await page.fill('#grammar-text', 'S -> a + S | a');
  // A refresh a human could make: Chromium commits sessionStorage asynchronously, and a reload in the same
  // millisecond under heavy test load can read an older snapshot even though the app's last write (also on
  // pagehide) held the new text (traced while diagnosing this check).
  await sleep(300);
  await page.reload(); await sleep(400);
  check('repair', 'D-22 a refresh keeps the unchecked grammar', (await page.$eval('#grammar-text', (e) => e.value)) === 'S -> a + S | a', await page.$eval('#grammar-text', (e) => e.value).catch((e) => String(e)));
  await page.evaluate(() => sessionStorage.clear());
  // D-17: the LR placeholder's title names the chapter once
  await go(page, '#/lr');
  check('repair', `D-17 title "${await page.title()}"`, (await page.title()) === 'LR parsing · ParseLens');
  // D-35: the DFA's accessible summary at step 2 does not reveal the finished automaton
  await go(page, '#/regex/dfa');
  await keys(page, 'ArrowRight', 2); await sleep(200);
  const label = await page.$eval('.dfa__svg', (e) => e.getAttribute('aria-label'));
  check('repair', 'D-35 DFA summary at step 2 lists only what is drawn', /so far/.test(label) && !/Accepting: D/.test(label), label);
  // D-25 / D-26: a 32-state DFA opens readable and zooms, fits and resets; a 1,024-state one stops with a message
  await go(page, '#/regex/tree');
  await page.fill('.field__input--regex', '(a|b)*a(a|b)(a|b)(a|b)(a|b)'); await page.keyboard.press('Enter');
  await page.goto(BASE + '#/regex/dfa'); await sleep(400); await keys(page, 'End'); await sleep(300);
  const z0 = await page.$eval('.dfa__zoom', (e) => e.textContent);
  await page.click('button[aria-label="Zoom in"]'); await sleep(100);
  const z1 = await page.$eval('.dfa__zoom', (e) => e.textContent);
  await page.click('.toolbtn >> text=Fit'); await sleep(100);
  const z2 = await page.$eval('.dfa__zoom', (e) => e.textContent);
  await page.click('.toolbtn >> text=Reset'); await sleep(100);
  const z3 = await page.$eval('.dfa__zoom', (e) => e.textContent);
  check('repair', `D-25 32-state DFA: opens at "${z0}", zoom in "${z1}", Fit "${z2}", Reset "${z3}"`, /%/.test(z0) && z1 !== z0 && z2 === 'Whole graph' && z3 === z0);
  await go(page, '#/regex/tree');
  const t0 = Date.now();
  await page.fill('.field__input--regex', '(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)'); await page.keyboard.press('Enter'); await sleep(200);
  const msg = await page.$eval('.result--bad', (e) => e.textContent).catch(() => '');
  check('repair', `D-26 a 1,024-state DFA stops in ${Date.now() - t0} ms with a plain message`, /more than 500 states/.test(msg) && Date.now() - t0 < 4000, msg);
  // D-11: a deeply nested expression is a diagnostic, not a crash
  await page.fill('.field__input--regex', '('.repeat(150) + 'a' + ')'.repeat(150)); await page.keyboard.press('Enter'); await sleep(200);
  const deep = await page.$eval('.result--bad', (e) => e.textContent).catch(() => '');
  await page.fill('.field__input--regex', '('.repeat(3000) + 'a' + ')'.repeat(3000)); await page.keyboard.press('Enter'); await sleep(200);
  const huge = await page.$eval('.result--bad', (e) => e.textContent).catch(() => '');
  const wide = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1);
  check('repair', 'D-11 150 nested parentheses and a 6,001-character expression give friendly diagnostics, no page overflow',
    /more than 100 levels/.test(deep) && /limit is 400/.test(huge) && !/call stack/i.test(deep + huge) && !wide, deep.slice(0, 200));
  await page.evaluate(() => sessionStorage.clear());
  await ctx.close();
}

await browser.close();

console.log('\n— bundle scan —');
if (want('bundle')) {
  const files = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => join('dist/assets', f));
  const hits = (re) => files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(re)].map((m) => `${f.split('/').pop()}: …${m.input.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, ' ')}…`));
  const scan = [
    ['no fetch() / XMLHttpRequest / sendBeacon / WebSocket / EventSource', /\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource\(/g],
    ['no camera or microphone code (getUserMedia, mediaDevices)', /getUserMedia|mediaDevices/g],
    ['no eval / new Function', /\beval\(|new Function\(/g],
    ['no dangerouslySetInnerHTML in our source', null],
    ['no analytics hosts', /google-analytics|googletagmanager|segment\.io|mixpanel|sentry\.io|plausible|posthog/g],
  ];
  for (const [name, re] of scan) {
    if (!re) {
      const src = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? src(join(d, e.name)) : [join(d, e.name)]));
      const bad = src('src').filter((f) => /\.(t|j)sx?$/.test(f) && readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'));
      check('bundle', name, bad.length === 0, bad.join('\n'));
      continue;
    }
    const h = hits(re);
    check('bundle', name, h.length === 0, h.slice(0, 8).join('\n'));
  }
  const sizes = files.map((f) => `${f.split('/').pop()} ${(readFileSync(f).length / 1024).toFixed(0)} KB`);
  check('bundle', `bundle sizes: ${sizes.join(', ')}`, true);
}

console.log('\n— network and console —');
check('offline', `zero network requests across the whole run`, allNet.length === 0, [...new Set(allNet)].join('\n'));
check('offline', `no page errors, console errors or failed requests`, allErrors.length === 0, [...new Set(allErrors)].join('\n'));

writeFileSync(join(ART, 'report.json'), JSON.stringify({ base: BASE, pass, fail, results, screenshots: screenshots.map((s) => ({ id: s.id, vp: s.vp })) }, null, 2));
if (PUBLISH) {
  const pub = resolve('docs/screenshots');
  rmSync(pub, { recursive: true, force: true });
  mkdirSync(pub, { recursive: true });
  for (const s of screenshots) {
    if (s.vp !== '1366x768' && !['home', 'opp-table', 'opp-modes-open', 'regex-dfa-end', 'home-narrow-390', 'home-narrow-820'].includes(s.id)) continue;
    copyFileSync(s.file, join(pub, `${s.vp}--${s.id}.png`));
  }
  for (const f of ['home-without-logo.png', 'grayscale-conflict-table.png'])
    if (existsSync(join(SHOTS, f))) copyFileSync(join(SHOTS, f), join(pub, f));
  console.log(`\nPublished screenshots to docs/screenshots/`);
}
console.log(`\n${pass} passed, ${fail} failed  (report: artifacts/report.json, screenshots: artifacts/screenshots/)`);
process.exit(fail ? 1 : 0);
