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
//   --only=a,b  run only these groups: screens home keyboard replay reduced grayscale fps intro fonts bundle
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './lib/browser.mjs';

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
const SEEN = () => { try { localStorage.setItem('cl.intro.seen.v2', '1'); localStorage.setItem('cl.note.keys.v1', '1'); } catch {} };

/* ── page plumbing ─────────────────────────────────────── */
const allNet = [], allErrors = [];
async function open(browser, { viewport = [1366, 768], reduced = false, init = SEEN, storage = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference', offline: true, deviceScaleFactor: 1 });
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
      if (top && !el.contains(top) && !top.contains(el) && (top.closest('.drawer, .pop__panel, .sheetwrap') || (stickyDock(top) && !stickyDock(el)))) continue;
      texts.push({ el, r, t: n.textContent.trim().slice(0, 30) });
    }
  }
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const floating = (e) => e.closest('.drawer, .pop__panel, .sheetwrap');
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
  { id: 'opp-table-svg-glyphs', hash: '#/opp/table?glyphs=svg', act: (p) => keys(p, 'ArrowRight', 14) },
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
  { id: 'regex-malformed', hash: '#/regex/tree', act: (p) => clickText(p, 'ab(c|d', '.sample') },
  { id: 'regex-reserved-hash', hash: '#/regex/tree', act: (p) => clickText(p, 'a#b', '.sample') },
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
      const pageOk = s.pageScrollOk || vp[0] < 1000 || vp[1] < 720;
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
  // 3. tab order: headline → doors; doors operable by keyboard.
  //    The headline block has no links of its own (the doors are the single entry), so it may have no tab stops.
  await go(page, '#/');
  const order = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const where = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return a.closest('.skip') ? 'skip' : a.closest('.rail') ? 'rail' : a.closest('.home__lead') ? 'headline' : a.closest('.doors') ? 'door' : 'other';
    });
    if (where) order.push(where);
  }
  // one pass through the page: stop where focus wraps back to the first stop
  const wrap = order.indexOf(order[0], 1);
  if (wrap > 0) order.length = wrap;
  const firstOf = (k) => order.indexOf(k), lastOf = (k) => order.lastIndexOf(k);
  const okOrder = !order.includes('other') && firstOf('door') >= 0 && firstOf('door') > lastOf('headline') && order.filter((x) => x === 'door').length === 3;
  check('home', `3a. Tab order is headline → doors (3)`, okOrder, order.join(' → '));
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
  const opening = await page.evaluate(() => ({ g: document.querySelector('.controls__grammar')?.textContent.replace(/\s+/g, ' '), s: document.querySelector('.controls .field__input')?.value }));
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

  // speed dial and timeline by keyboard
  await go(page, '#/opp/table');
  await page.focus('.dial__knob'); await page.keyboard.press('ArrowRight');
  const speed = await page.$eval('.dial__knob', (e) => e.getAttribute('aria-valuetext'));
  await page.focus('.timeline__range'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  check('keyboard', `speed dial and timeline are operable by keyboard (${speed}, step ${await readout(page)})`, speed === '1.5× speed' && (await readout(page)) === 2);
  await page.keyboard.press('Escape');
  await page.keyboard.press(']'); await page.keyboard.press('[');
  check('keyboard', '[ and ] change speed', (await page.$eval('.dial__knob', (e) => e.getAttribute('aria-valuetext'))) === '1.5× speed');
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
  const homeAnims = await page.evaluate(() => document.getAnimations().length);
  check('reduced', `prefers-reduced-motion: the homepage runs no animations (${homeAnims})`, homeAnims === 0);
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
      const target = document.querySelector('.dock__readout b');
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
  await measure('#/opp/table', 'precedence table playing at 2× with motion', async (p) => { await p.keyboard.press(']'); await p.keyboard.press(']'); await p.keyboard.press(' '); });
  await measure('#/opp/parse', 'parse bench playing at 1× with motion', async (p) => { await p.keyboard.press(' '); });
  await measure('#/regex/sim', 'DFA simulation playing', async (p) => { await p.keyboard.press(' '); });
  await ctx.close();
  await swBrowser.close();
}

/* ── no WebGL needed ───────────────────────────────────── */
console.log('\n— runs without WebGL —');
if (want('intro')) {
  const noGl = await launch({ webgl: false });
  const c4 = await noGl.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
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
  const f = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      math: document.fonts.check('20px "IBM Plex Math"', '⋖⋗≐'),
      loaded: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family.replace(/"/g, '')),
      mode: document.querySelector('.rel')?.classList.contains('rel--svg') ? 'svg' : 'font',
    };
  });
  check('fonts', `IBM Plex Math loaded from the bundle and used for ⋖ ⋗ ≐ (${f.mode})`, f.math && f.loaded.includes('IBM Plex Math') && f.mode === 'font', JSON.stringify(f));
  check('fonts', 'IBM Plex Sans, Serif and Mono loaded from the bundle', ['IBM Plex Sans Variable', 'IBM Plex Serif', 'IBM Plex Mono'].every((n) => f.loaded.includes(n)), f.loaded.join(', '));
  await go(page, '#/opp/table?glyphs=svg'); await keys(page, 'End');
  check('fonts', 'inline-SVG fallback for the relation glyphs renders', (await page.$$('.rel--svg svg')).length > 10);
  await ctx.close();
}

await browser.close();

/* ── static scan of the built bundle ───────────────────── */
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
