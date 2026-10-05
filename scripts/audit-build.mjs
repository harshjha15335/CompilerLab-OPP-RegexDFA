// End-to-end audit of the PRODUCTION build. It copies dist/ into a differently named, nested
// folder, opens that copy straight from file:// with the network switched off, and drives the
// real UI: keyboard, replay, fixtures, navigation, refresh. Screenshots land in docs/screenshots.
// Optional tool (not part of `npm test`): needs a local Chrome or Edge.
//   npm run build && npm run audit:offline
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && existsSync(p));
if (!chrome) { console.error('No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.'); process.exit(2); }
if (!existsSync('dist/index.html')) { console.error('dist/ is missing. Run `npm run build` first.'); process.exit(2); }

const dir = join(tmpdir(), 'compiler lab offline audit', 'nested', 'renamed-build');
rmSync(dir, { recursive: true, force: true });
cpSync('dist', dir, { recursive: true });
const shots = resolve(process.argv[2] ?? 'docs/screenshots');
mkdirSync(shots, { recursive: true });
const base = pathToFileURL(join(dir, 'index.html')).href;
console.log(`Auditing ${base}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 650 });
await page.setOfflineMode(true);
const external = [], errors = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('about:')) external.push(u); });
page.on('requestfailed', (r) => errors.push('requestfailed ' + r.url()));
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text()); });

const go = async (hash, fresh = true) => { if (fresh) await page.goto('about:blank'); await page.goto(base + hash); await sleep(350); };
const key = async (k, n = 1, shift = false) => { for (let i = 0; i < n; i++) { if (shift) await page.keyboard.down('Shift'); await page.keyboard.press(k); if (shift) await page.keyboard.up('Shift'); await sleep(12); } await sleep(60); };
const step = () => page.$eval('.transport__readout b', (e) => Number(e.textContent));
const total = () => page.$eval('.transport__readout span:last-child', (e) => Number(e.textContent));
const rowsOf = (sel) => page.$$eval(sel, (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim()).join(' ')));
const text = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
const clickText = (t) => page.evaluate((t) => { const all = [...document.querySelectorAll('button,a,label')]; const el = all.find((e) => e.textContent.trim() === t) ?? all.find((e) => e.textContent.includes(t)); el?.click(); return Boolean(el); }, t);
const body = () => page.$eval('.plate__body', (e) => e.innerHTML);
const shot = async (name) => { await sleep(380); await page.screenshot({ path: `${shots}/${name}.png` }); };
const noOverflow = async (name) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), `no page-level scroll at 1366x650: ${name}`);
const backRestores = async (name, at) => {
  await key('Home'); await key('ArrowRight', at);
  const before = await body();
  await key('ArrowRight'); const moved = await body(); await key('ArrowLeft');
  ok(before !== moved && before === await body(), `Back restores the exact previous state: ${name} @${at}`);
};

console.log('— shell / offline —');
await go('#/opp/grammar');
ok(await page.$('.app') !== null, 'app renders from file:// in nested renamed folder');
ok(await page.evaluate(async () => { await document.fonts.ready; const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''))); return ['IBM Plex Mono', 'IBM Plex Sans', 'IBM Plex Serif'].every((f) => loaded.has(f)); }), 'local IBM Plex fonts loaded');
ok((await text('.chapter__title')).join('|').includes('Operator Precedence') && (await text('.chapter__title')).join('|').includes('LR Parsing'), 'Bottom-Up shell lists Operator Precedence and LR Parsing');
await noOverflow('grammar'); await shot('01-shell-grammar-valid');
await clickText('LR Parsing'); await sleep(200);
ok((await text('.empty__title'))[0]?.includes('will host the LR parsing branch'), 'LR placeholder does not claim to be implemented');
ok(page.url().endsWith('#/lr'), 'hash navigation to LR');
await page.goBack(); await sleep(200);
ok(page.url().endsWith('#/opp/grammar') && await page.$('.editor__text') !== null, 'browser Back returns to the grammar stage');

console.log('— grammar validation —');
await clickText('Adjacent non-terminals'); await sleep(150);
let t = (await text('.result')).join(' ');
ok(/cannot be used by the operator-precedence parser/.test(t) && /Production 1/.test(t) && /adjacent non-terminals: A B/.test(t) && /cannot contain adjacent non-terminals/.test(t), 'adjacent non-terminal error is precise', t);
ok((await text('.editor__gutter .is-error')).join() === '1', 'error line marked in gutter');
await shot('03-grammar-error-adjacent');
await clickText('ε-production'); await sleep(150);
t = (await text('.result')).join(' ');
ok(/Production 2/.test(t) && /line 2/.test(t) && /derives ε/.test(t) && /cannot contain ε-productions/.test(t), 'epsilon error is precise', t);
await page.click('.editor__text'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace');
await clickText('Validate grammar'); await sleep(150);
ok(/Enter productions to begin/.test((await text('.result')).join(' ')), 'empty grammar message');
await page.keyboard.type('E E + T'); await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control'); await sleep(150);
ok(/could not be read as productions/.test((await text('.result')).join(' ')), 'syntax error via Ctrl+Enter');
await clickText('LEADING / TRAILING'); await sleep(150);
ok(/No valid operator grammar yet/.test((await text('.empty__title')).join(' ')), 'later stages are blocked for an invalid grammar');

console.log('— LEADING / TRAILING —');
await go('#/opp/sets');
ok(await step() === 0, 'replay starts at step 0');
ok((await text('.setline__set')).every((s) => s === '{ }'), 'all sets empty at start');
await key('ArrowRight', 3); ok(await step() === 3, '→ advances one step each press');
await key('ArrowLeft'); ok(await step() === 2, '← goes back');
await key('End'); const n = await total(); ok(await step() === n, 'End jumps to final step');
const sets = Object.fromEntries((await text('.setline')).map((l) => { const [k, v] = l.split('='); return [k, v.replace(/[{} ]/g, '').replace(/,(?=,)/g, '').split(',').filter(Boolean).sort().join(' ')]; }));
const want = { 'LEADING(E)': '( * + id', 'LEADING(T)': '( * id', 'LEADING(F)': '( id', 'TRAILING(E)': ') * + id', 'TRAILING(T)': ') * id', 'TRAILING(F)': ') id' };
ok(JSON.stringify(sets) === JSON.stringify(want), 'final sets equal the audited fixture', JSON.stringify(sets));
await key('Home'); ok(await step() === 0, 'Home returns to start');
await key('ArrowRight', 1, true); const m1 = await step(); await key('ArrowRight', 1, true); const m2 = await step();
ok(m1 === 1 && m2 > m1, `Shift+→ jumps between phase markers (${m1}, ${m2})`);
await key('ArrowLeft', 1, true); ok(await step() === m1, 'Shift+← returns to previous marker');
await backRestores('sets', 20);
// a duplicate discovery is a visible step
await key('Home'); let dup = false; for (let i = 0; i < n && !dup; i++) { await page.keyboard.press('ArrowRight'); await sleep(8); dup = await page.evaluate(() => /No set change/.test(document.querySelector('.note__body')?.textContent ?? '')); }
ok(dup, 'duplicate discovery shows "No set change"');
await shot('04b-sets-duplicate');
await key('Home'); await key('ArrowRight', 9); await shot('04-sets-derivation');
// play / pause
await key('Home'); await page.keyboard.press(']'); await page.keyboard.press(']'); await sleep(50);
ok((await page.$eval('.speed__opt.is-on', (e) => e.textContent)) === '4×', '] raises speed to 4×');
await page.keyboard.press(' '); await sleep(1000); const playing = await step(); await page.keyboard.press(' '); await sleep(80); const paused = await step(); await sleep(600);
ok(playing >= 2 && await step() === paused, `Space plays and pauses (reached step ${paused})`);
await page.keyboard.press('['); await page.keyboard.press('['); await sleep(50);
ok((await page.$eval('.speed__opt.is-on', (e) => e.textContent)) === '1×', '[ lowers speed back to 1×');
await page.$eval('.timeline__range', (el) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '30'); el.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(80);
ok(await step() === 30, 'timeline scrub jumps to a step');
await clickText('+'); // inspect a member
await noOverflow('sets');
// keyboard-only: buttons reachable and operable
await page.focus('.tbtn'); const tabbed = await page.evaluate(() => document.activeElement.className);
ok(tabbed.includes('tbtn'), 'transport buttons are focusable');

console.log('— precedence table —');
await go('#/opp/table');
ok((await page.$$('.pcell__btn')).length === 0, 'table blank at step 0');
await key('ArrowRight', 14); await shot('05a-table-insert');
ok(/LEADING|TRAILING|adjacent/.test((await text('.note__body')).join(' ')), 'relation step shows its reason');
await backRestores('table', 9);
await key('End');
const cellLabels = await page.$$eval('.pcell__btn', (els) => els.map((e) => e.getAttribute('aria-label').split(':')[0]));
for (const c of ['+ ⋖ *', '* ⋗ +', '+ ⋗ +', '( ≐ )', '$ ⋖ id', 'id ⋗ $']) ok(cellLabels.includes(c), `cell ${c}`);
ok(!cellLabels.some((c) => c.startsWith('id') && c.endsWith(' id')), '(id, id) is blank');
ok(/OPERATOR-PRECEDENCE GRAMMAR/.test((await text('.note__verdict')).join()) && !/NOT/.test((await text('.note__verdict')).join()), 'verdict: operator-precedence grammar');
await shot('05-table-complete');
await page.click('.pcell__btn'); await sleep(120);
ok(/Provenance/.test((await text('.inspect')).join(' ')) && /Step \d+/.test((await text('.inspect')).join(' ')), 'cell provenance lists source steps');
await noOverflow('table');
await go('#/opp/grammar'); await clickText('Ambiguous expression grammar'); await clickText('Precedence table'); await sleep(250);
let firstConflict = 0; const tn = await total();
for (let i = 1; i <= tn; i++) { await page.keyboard.press('ArrowRight'); await sleep(8); if (await page.$('.pcell.is-conflict')) { firstConflict = i; break; } }
ok(firstConflict > 0 && firstConflict < tn, `conflict appears at the step it happens (step ${firstConflict}), construction continues`);
await sleep(100); ok(/CONFLICT/.test((await text('.note__body')).join(' ')), 'conflict step is labelled CONFLICT');
await key('End');
const conf = await page.$$eval('.pcell.is-conflict .pcell__btn', (els) => els.map((e) => e.getAttribute('aria-label')));
ok(conf.some((c) => c.includes('+ and + have 2')) && conf.some((c) => c.includes('+ and * have 2')), 'conflict cells (+,+) and (+,*)', conf.join(' | '));
ok(/NOT AN OPERATOR-PRECEDENCE GRAMMAR/.test((await text('.note__verdict')).join()), 'verdict: NOT AN OPERATOR-PRECEDENCE GRAMMAR');
ok(/Cell \(\+, \*\) contains more than one precedence relation/.test((await text('.conflicts')).join(' ')), 'conflict roll names the cells');
await page.click('.pcell.is-conflict .pcell__btn'); await shot('06-conflict-cell');
await clickText('Parse bench'); await sleep(200);
ok(/Build a conflict-free precedence table before parsing a string/.test((await text('.empty__title')).join()), 'parser blocked until the table is conflict-free');

console.log('— parse bench —');
await go('#/opp/parse');
ok(await step() === 0 && (await text('.stackrow .scell')).join() === '$top terminal', 'stack starts as $');
await key('ArrowRight'); ok(/SHIFT/.test((await text('.decision__act')).join()), 'step 1 is SHIFT'); await shot('07-parse-shift');
await key('ArrowRight'); ok(/REDUCE/.test((await text('.decision__act')).join()) && (await text('.handle .scell')).join() === 'idtop terminal' && (await text('.handle__label')).join() === 'handle', 'REDUCE shows a bracketed handle');
await key('ArrowRight', 6); await shot('08-parse-reduce-handle');
await backRestores('parse', 6);
await key('End'); ok((await text('.verdict__word')).join() === 'ACCEPT', 'id + id * id → ACCEPT (safeguarded)'); await shot('09-parse-accept');
await clickText('Precedence table'); await sleep(100); await key('ArrowLeft', 3); ok(await page.$('.pcell.is-lookup') !== null, 'side table brackets the cell consulted');
await clickText('Trace'); await clickText('Classic N'); await sleep(200); await key('End'); ok((await text('.verdict__word')).join() === 'ACCEPT' && (await text('.trace td.mono')).join(' ').includes('N + N'), 'Classic N mode accepts and writes N');
for (const [s, r] of [['( id + id ) * id', 'ACCEPT'], ['id + * id', 'REJECT'], ['( id + id', 'REJECT']]) { await clickText(s); await sleep(150); await key('End'); ok((await text('.verdict__word')).join() === r, `${s} → ${r}`); }
ok((await text('.verdict__reason')).join().length > 10, 'REJECT carries a reason: ' + (await text('.verdict__reason')).join());
await shot('09b-parse-reject');
await page.focus('.field__input'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('id + x'); await page.keyboard.press('Enter'); await sleep(200);
ok(/Unknown symbol "x"/.test((await text('.verdict__reason')).join()), 'unknown symbol is rejected with a reason');
await page.evaluate(() => document.activeElement.blur());

console.log('— reduction modes —');
await go('#/opp/grammar'); await clickText('Classic N vs Safeguarded'); await clickText('Reduction modes'); await sleep(300);
const rows = await page.$$eval('.cmptable tbody tr', (trs) => trs.map((tr) => [tr.querySelector('.cmptable__pick').textContent, ...[...tr.querySelectorAll('.tag')].map((x) => x.textContent)].join(' | ')));
ok(JSON.stringify(rows) === JSON.stringify(['id * id + id / id | ACCEPT | ACCEPT', 'id / id + id * id | ACCEPT | REJECT', 'id * id | ACCEPT | REJECT', 'id + id | REJECT | REJECT']), 'Classic/Safeguarded fixture table', rows.join(' ; '));
ok((await text('.plate__aside')).join() === 'MODES DIFFER', 'MODES DIFFER banner');
ok(/Step 10/.test((await text('.diverge')).join(' ')) && /\{B\} \+ \{A\}/.test((await text('.diverge')).join(' ')), 'first safeguarded rejection identified (step 10, handle {B} + {A})');
await key('ArrowRight', 10); const words = await text('.pane--bench .decision');
ok(/REDUCE/.test(words[0]) && /REJECT/.test(words[1]), 'at step 10 Classic reduces while Safeguarded rejects');
await noOverflow('modes'); await shot('10-modes-divergence');
await go('#/opp/parse', false); await sleep(100);
await go('#/opp/grammar'); await clickText('Expression grammar'); await clickText('Parse bench'); await sleep(200); await clickText('id + id * id'); await key('ArrowRight', 2);
ok((await text('.decision__mode')).join().includes('{E,F,T}'), 'safeguarded: id reduces to {E,F,T} (unit productions followed)');

console.log('— regex → DFA —');
await go('#/regex/tree');
ok((await page.$$('.tnode')).length === 12 && (await page.$$('.tnode--leaf')).length === 6, 'syntax tree has 12 nodes, 6 leaves');
ok((await text('.tnode--leaf')).join(' ') === 'a1 b2 a3 b4 b5 #6', 'leaves numbered a1 b2 a3 b4 b5 #6');
ok((await text('.tnode--op .tnode__glyph')).sort().join('') === ['|', '*', '·', '·', '·', '·'].sort().join(''), 'tree has the union node, the star and four concatenations');
await noOverflow('tree'); await shot('11-regex-tree');
for (const [src, re] of [['ab(c|d', /"\(" at position 3 has no closing "\)"/], ['a#b', /reserved for direct-method augmentation/]]) { await clickText(src); await sleep(150); ok(re.test((await text('.result--invalid')).join(' ')), `malformed ${src}: positional error`); }
await shot('11b-regex-error');
await page.focus('.field__input--regex'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('\\#a$'); await page.keyboard.press('Enter'); await sleep(200);
ok((await text('.tnode--leaf')).join(' ') === '#1 a2 $3 #4', 'escaped \\# and $ are literals; only the last # is the end marker', (await text('.tnode--leaf')).join(' ') + ' / ' + (await text('.result')).join(' '));
await page.evaluate(() => document.activeElement.blur());
await clickText('(a|b)*abb'); await sleep(150);

await go('#/regex/props'); await key('ArrowRight', 5); await shot('12-props');
await backRestores('props', 6); await key('End');
ok((await rowsOf('.proptable tbody tr')).some((r) => r.includes('star(union) true {1,2} {1,2}')), 'star node: nullable true, firstpos {1,2}, lastpos {1,2}');
ok((await rowsOf('.proptable tbody tr')).at(-1).includes('false {1,2,3} {6}'), 'root: nullable false, firstpos {1,2,3}, lastpos {6}');
await go('#/regex/follow'); await key('ArrowRight', 3); ok((await page.$$('.tree__arc')).length >= 1, 'followpos step draws temporary tree arrows'); await shot('13-followpos-step');
await backRestores('followpos', 3); await key('End');
ok((await rowsOf('.ftable tbody tr')).map((r) => r.replace(/ ?(new|no change|end)/g, '')).join(' ; ') === '1 a { 1, 2, 3 } ; 2 b { 1, 2, 3 } ; 3 a { 4 } ; 4 b { 5 } ; 5 b { 6 } ; 6 # { }', 'followpos equals the fixture', (await rowsOf('.ftable tbody tr')).join(' ; '));
await shot('13b-followpos-complete');
await page.click('.ftable__btn'); await sleep(100); ok(/Step \d/.test((await text('.inspect')).join(' ')), 'followpos provenance lists contributing steps');
await go('#/regex/dfa'); await key('ArrowRight', 4); await backRestores('dfa', 5); await key('End');
ok((await rowsOf('.dtable tbody tr')).join(' ; ') === '→A start state {1,2,3} B A ; B {1,2,3,4} B C ; C {1,2,3,5} B D ; D accepting state {1,2,3,6} B A', 'DFA table equals the fixture', (await rowsOf('.dtable tbody tr')).join(' ; '));
ok(await page.$('.dfagraph__canvas canvas') !== null, 'Cytoscape canvas rendered');
await noOverflow('dfa'); await shot('14-dfa-table-and-graph');
await clickText('Enlarge graph'); await shot('15-dfa-graph-large');
await go('#/regex/sim'); await key('ArrowRight', 3); await shot('16-simulation-step');
await backRestores('sim', 2); await key('End'); ok((await text('.verdict__word')).join() === 'ACCEPT', 'abb → ACCEPT'); await shot('17-simulation-accept');
await clickText('ab'); await sleep(150); await key('End'); ok((await text('.verdict__word')).join() === 'REJECT', 'ab → REJECT'); await shot('17b-simulation-reject');
await page.focus('.field__input'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('abc'); await page.keyboard.press('Enter'); await sleep(150); await page.evaluate(() => document.activeElement.blur()); await key('End');
ok((await text('.verdict__word')).join() === 'REJECT' && (await text('.tcell.is-failed')).join().startsWith('c'), 'abc → REJECT at c (no transition)');
await noOverflow('sim');

console.log('— refresh / motion / network —');
await page.goto(base + '#/regex/dfa'); await sleep(200); await page.reload(); await sleep(400);
ok((await text('.plate__no')).join() === '3.4', 'browser refresh keeps the current stage');
await clickText('Reduced motion'); await sleep(80);
ok(await page.$eval('.app', (e) => e.dataset.motion) === 'reduced', 'Reduced motion toggle sets instant state changes');
await key('ArrowRight', 3); ok(await step() === 3 && (await text('.note__body')).join().length > 20, 'replay still explains every step with reduced motion');
ok(external.length === 0, 'no network request left the file:// origin', external.join(', '));
ok(errors.length === 0, 'no console errors, page errors or failed requests', errors.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
