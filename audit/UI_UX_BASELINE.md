# UI/UX baseline (before the de-vibe pass)

Recorded on branch `claude/practical-johnson-s2bqni` at commit `f8f891c`, with a clean working tree.
Nothing below changes code. It describes what the product was when the audit started.

## 1. Stack

| Area | What the project uses |
| --- | --- |
| Framework | React 19.3 + TypeScript 7 (strict), built by Vite 8 into one classic deferred script (works from `file://`) |
| Routing | Hand-written hash router (`src/data/nav.ts`, `useRoute` in `src/App.tsx`). Hash routes so the build runs from any folder |
| Components | One folder per chapter (`src/screens/opp`, `src/screens/regex`, `src/screens/home`), shared UI in `src/ui` (`plate.tsx`, `hardware.tsx`, `kit.tsx`, `Loupe.tsx`), shell in `src/shell/Shell.tsx` |
| Styling | Plain CSS files per layer (`tokens.css`, `base.css`, `shell.css`, `hardware.css`, `figures.css`, `home.css`, `motion.css`). No Tailwind, no CSS-in-JS |
| UI library | None. No shadcn, Radix or MUI. Every control is hand-written |
| Icons | Inline SVG drawn per use (stroke 1.5–1.8), no icon library. No emoji |
| Animation | `motion` 14 (presence, `layoutId`) plus a hand-written Web Animations layer (`src/motion/fx.ts`) that runs only on a forward step |
| 3D | `three` 0.186, a separate first-visit intro bundle (`dist/assets/intro.js`) |
| Charts | None. The figures (precedence table, syntax tree, DFA) are hand-written HTML tables and SVG |
| State | React state plus a replay controller (`src/replay/useReplay.ts`). Every view is a pure function of `steps[count]` |
| Responsive strategy | Desktop rule (≥ 1000 px): the page never scrolls, and at most one inner region scrolls. Below 1000 px one media query stacks figure over inspector and lets the page scroll. The homepage has its own narrow layout below 900 px |
| Typography | IBM Plex Serif (display and plate titles), Plex Sans Variable (UI), Plex Mono (formal objects), Plex Math (⋖ ⋗ ≐ only). All bundled |
| Color tokens | `src/styles/tokens.css`: desk / plate / plate-2 surfaces, ink 1–3, a line colour for meaningful borders, three relation colours, step signals (highlighter, brass "read" outline, band), verdict colours with washes, and hardware (keycap, brass) |
| Theme | Light only, by design |

## 2. Routes and screens

| Route | Screen |
| --- | --- |
| `#/` | Homepage: headline, project title block, three chapter doors, live specimen (precedence table built by the real algorithm), first-visit 3D intro |
| `#/opp/grammar` | I.1 Grammar editor and operator-grammar check |
| `#/opp/sets` | I.2 LEADING and TRAILING |
| `#/opp/table` | I.3 Precedence table (loupe, provenance, conflicts) |
| `#/opp/parse` | I.4 Shift/reduce parse bench, trace, table lookup |
| `#/opp/modes` | I.5 Classic N vs Safeguarded, two benches side by side |
| `#/lr` | II LR parsing, a planned-chapter placeholder |
| `#/regex/tree` … `#/regex/sim` | III.1–5 syntax tree, nullable/firstpos/lastpos, followpos, DFA construction, simulation |
| (overlay) | Examples sheet, stage drawer, provenance sheets |

## 3. Commands

| Task | Command | Baseline result |
| --- | --- | --- |
| Install | `npm ci --ignore-scripts` | (not re-run; lockfile unchanged) |
| Dev server | `npm run dev` | n/a |
| Build | `npm run build` | **pass** (app `index-*.js` 570 KB min, intro 554 KB) |
| Lint | *no linter is configured*. `tsc` strict is the static check | n/a |
| Typecheck | `npm run typecheck` | **pass** |
| Unit tests | `npm test` | **31/31 pass** |
| Contrast | `npm run check:contrast` | **41/41 pairs pass** |
| Dependency audit | `npm audit --audit-level=high` | **0 vulnerabilities** |
| Browser verification | `node scripts/verify.mjs` (Playwright core + local Chromium, `file://`, network off) | Default desktop sizes: **733/0** (last full run, commit `f8f891c`) |

## 4. Baseline at the audit viewports

`node scripts/verify.mjs --only=screens --viewports=1440x900,1280x800,768x1024,390x844,360x800`
covers 45 screens and modes × 5 viewports, plus two homepage-only narrow sizes.
It finished **929 passed, 208 failed**. Full list: [`scans/verify-baseline-summary.json`](scans/verify-baseline-summary.json).

| Viewport | Failing screens | No sideways page scroll | Scrollbars | Interactive overlap |
| --- | --- | --- | --- | --- |
| 1440×900 | 0 | pass | pass | pass |
| 1280×800 | 0 | pass | pass | pass |
| 768×1024 | 40 | **21 fail** | 32 fail | 1 fail (stage drawer over table cells) |
| 390×844 | 43 | **35 fail** | 42 fail | pass |
| 360×800 | 43 | **35 fail** | 42 fail | pass |

Reading of the scrollbar column: below 1000 px the design deliberately lets the page scroll, so "page scroll" by itself
is expected there. The real defect is **two scrollers at once**: the page, plus the inspector or trace still scrolling
inside it. The sideways scroll is a plain defect. The chapter pages are wider than the screen, which also pushes the
top bar and stage switcher off-screen (see `screenshots/before/390x844-opp-table.png` and `768x1024-opp-parse-reduce.png`).

## 5. Important screenshots (before)

All are in [`audit/screenshots/before/`](screenshots/before/).

- `1440x900-home.png`, `1440x900-opp-table.png`, `1280x800-opp-parse-reduce.png`: desktop, working as designed.
- `768x1024-opp-parse-reduce.png`: the page is wider than the tablet, the logo is clipped at the left and the stage switch at the right.
- `390x844-opp-table.png`, `390x844-opp-parse-reduce.png`, `360x800-regex-dfa-end.png`, `360x800-opp-modes-diverge.png`: phone layouts overflow sideways.
- `dh-home-mobile-360-intro.png` (from Design Harness): the intro caption is 438 px wide on a 360 px screen and runs off both edges.

## 6. Git state at baseline

`git status` was clean, and the branch was even with `origin/claude/practical-johnson-s2bqni`. No unrelated user work was present.
