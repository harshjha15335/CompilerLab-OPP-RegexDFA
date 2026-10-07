# UI/UX de-vibe pass: final report

Companion documents: [baseline](UI_UX_BASELINE.md) · [audit, design direction and prioritised findings](UI_UX_DE_VIBE_AUDIT.md).
Before and after screenshots: [`screenshots/before/`](screenshots/before/), [`screenshots/after/`](screenshots/after/). Scanner output: [`scans/`](scans/).

## 1. Executive summary

ParseLens had a strong, specific design language on desktop: a drafting plate, ink, a brass loupe and keycaps. That was
not the problem. The problems were:
- **The chapter pages did not work on tablets or phones.** At 768, 390 and 360 px, 91 screen views scrolled sideways and 116 showed two scrollbars at once.
- **The homepage lead followed the AI hero template.** An eyebrow, a big heading, a sub-heading and two CTA links duplicated the entries just below them.
- **A placeholder chapter had the same weight as the two working ones.**

All of these are fixed, along with a set of polish items: an eight-value radius mix reduced to two tokens, misaligned
gutters, a half-empty precedence table, skipped heading levels, and targets under 24 px.

Results: the verification suite at the five audit viewports went from **929 pass / 208 fail to 1137 pass / 0 fail**.
The full default suite is **733/0**, and the unit tests are **32/32** (one new). Design Harness findings fell from **209 to 71**,
and every remaining one is a reviewed false positive or an intentional choice. Nothing was changed in the algorithm core,
routes, state, data flow or replay behaviour.

## 2. Original UI problems

From the baseline:
1. **Chapter pages broken on narrow screens.** At 768, 390 and 360 px the page was wider than the screen, with the top bar and stage switcher pushed off-screen and figure text cut off. Inner panes kept scrolling inside the scrolling page.
2. **Intro caption overflow.** The first-visit intro's caption was 438 px wide on a 360 px phone, and the intro flew its glyphs to a target below the fold.
3. **Stage drawer** covered the table's buttons at 768 px, and when opened in the flow it squeezed the plate title into a narrow column.
4. **DFA on phones:** a 4-state row shrunk to about 40%, with about 6 px labels.
5. Homepage hero template and a stub chapter given equal weight (P1).
6. Polish:
   - eight radius values, including pill chips
   - ad-hoc shadows
   - four different left edges on one page
   - the precedence table leaving 60% of its figure empty at 1440 px
   - h1 → h3 skips
   - 20–24 px targets
   - a homepage specimen box stretched over empty grid
   - colliding marks on wrapped token rows
   - a corrupted comment in the token file

## 3. Strongest vibe-coded tells found

1. **Hero template on the homepage.** "Plate I · Operator precedence" eyebrow, then a 40 px serif headline, then a sub-heading, then two arrow links. The top bar and the doors strip already open the same two chapters, so there were three paths to one place.
2. **Perfect three-up symmetry padded with a stub.** "LR parsing [In progress]" had the full weight of a working tool. On its own page, four identical "Not built" tags repeated what the list title already said.
3. **Desktop-only thinking.** The product was verified at three desktop sizes only. On a phone it was the "squeezed desktop" that signals nobody opened it there.
4. **Decorative hover motion** (the logo rotated on hover) and **pill-shaped chips** next to square tokens.

What was *not* a tell, and was kept: the paper colour and the serif (the product's drafting-plate identity, see §5), the
glass loupe (the product's namesake), the keycaps and dial (the replay hardware the whole product is built around), and the
once-per-visitor 3D intro (it lands the real glyphs in the real table, is skippable, is off under reduced motion, and is now off on phones).

## 4. Automated scanner findings

| Tool | How it was run | Before | After |
| --- | --- | --- | --- |
| `vibecoded-design-tells` `devibe_scan.py` @ `f7c4aef` | Only the single script, downloaded at the pinned commit and read in full (standard library only, read-only file access), run with `python3 -I devibe_scan.py src --json` | 3 findings: 0 high, 3 medium; score 6 | 3 findings: 0 high, 3 medium; score 6 (the same three lines, all reviewed: see §5) |
| Design Harness @ `9a9e39b` (archived) | Cloned at the pinned commit. `pnpm install --frozen-lockfile --ignore-scripts`, no browser download. Its `auditUrl` and `writeAuditArtifacts` were called from a small audit-only wrapper ([`scans/dh-audit-wrapper.mjs`](scans/dh-audit-wrapper.mjs)), needed only because its pinned Playwright expects a Chromium build that is not installed. **`loop` / `--agent-cmd` were never used.** No API keys or environment secrets were passed. Targets: `http://127.0.0.1` only, serving a copy of the demo build. Chromium ran with every host except 127.0.0.1 mapped to NOT FOUND | 209 findings over 12 routes × 5 viewports | **71** (see table) |
| VibeCheck @ `45d8695` | **Not run.** Its HTTP analyzer rejects hosts that resolve to loopback or private addresses (`analyzer.py:207-230`), so it cannot audit a local build. Its Playwright fallback does not re-check redirects (`analyzer.py:680`). Weakening the guard or pointing it at production were both forbidden | n/a | n/a |

Design Harness advisory score and finding count per route (higher score is better):

| Route | Before | Findings | After | Findings |
| --- | --- | --- | --- | --- |
| `home` | 94.5 | 21 | 94.5 | 14 |
| `lr` | 100 | 0 | 100 | 0 |
| `opp_grammar` | 100 | 0 | 100 | 0 |
| `opp_sets` | 91 | 21 | **100** | 0 |
| `opp_table` | 91 | 32 | **95** | 12 |
| `opp_parse` | 86.5 | 49 | **91** | 10 |
| `opp_modes` | 86.5 | 13 | **100** | 0 |
| `regex_tree` | 100 | 0 | 100 | 0 |
| `regex_props` | 100 | 0 | 100 | 0 |
| `regex_follow` | 91 | 24 | **95.5** | 5 |
| `regex_dfa` | 91 | 29 | **95.5** | 10 |
| `regex_sim` | 95.5 | 20 | 95.5 | 20 |

**Containment note, reported honestly.** In one Design Harness run, the environment's egress proxy logged 12 rejected
connections from Chromium to `www.google.com:443`. That was Chromium's own background services, not the audited page; the
app makes no network requests, which the verifier checks on every run. My resolver rule did not apply to traffic sent
through the environment's proxy. The wrapper now also passes `--no-proxy-server`, `--disable-background-networking` and
`--disable-component-update`, and the final re-run of four routes produced no outbound attempts.

## 5. False positives rejected (and intentional choices kept)

| Finding | Source | Why it was not changed |
| --- | --- | --- |
| "Fade-in animation" on the stage drawer and the Examples backdrop | devibe | 160 ms menu and modal entrances (the brief allows "menus: fast opacity/translate"), symmetric exit, off under reduced motion. Not a page-load fade |
| "Neon glow" `text-shadow` on `.intro__glyph` | devibe | A stepped 1–4 px dark offset with no blur that fakes extrusion depth in the CSS fallback intro. Dark brown on paper cannot read as neon |
| "Cream + serif tasteful default" (checked by hand; not flagged) | human review | The plate colour and Plex Serif are the documented drafting-plate identity. The serif is limited to two roles (one homepage headline, plate titles). The template-like part was the hero structure, which was fixed |
| `visual.text-clipping` on 1×1 px elements | Design Harness | `.sr-only` table captions and descriptions, which are clipped by design |
| `responsive.fixed-width` on `caption` (1×1 px) | Design Harness | The same screen-reader-only captions |
| Contrast 1.00:1 on the active "Safeguarded" option | Design Harness | The text is light on ink. The ink is an animated sibling layer (`.modes__rule`) that the tool cannot see |
| Sticky full-viewport element on `home` (desktop) | Design Harness | The first-visit intro overlay, skippable with a button or Esc and shown once |
| Contrast 1.16:1 on timeline tick labels | Design Harness | Visually a false positive (the label was a DOM child of the 1 px brass tick). **Fixed anyway**: the label is now a sibling, so the DOM matches what is painted, and the finding is gone |

## 6. Design direction chosen

"A precise, patient instrument: a drafting plate on a lab bench." The full spec (surfaces, colour roles, type roles,
spacing, the two-step radius scale, elevation, motion rules, component principles) is in
[UI_UX_DE_VIBE_AUDIT.md, Part A](UI_UX_DE_VIBE_AUDIT.md#part-a-design-direction-for-parselens). The rules this pass enforced:
- **one plate, few containers**
- **the figure is the hero**
- **one entry per destination**
- **planned things look planned**
- **two radii**
- **paper is flat and only floating things cast shadows**
- **motion explains a step or doesn't happen**
- **phones get a layout, not a shrink**

## 7. Pages and components changed

| Area | Files | Change |
| --- | --- | --- |
| Tokens | `styles/tokens.css` | `--r-mark` / `--radius` scale, `--shadow-paper` / `--shadow-float`, `--gutter`. Fixed the header comment |
| Shell | `styles/shell.css`, `shell/Shell.tsx` | `minmax(0, 1fr)` app and main columns. One gutter. Narrow (≤ 999 px) and phone (≤ 640 px) layouts. Stage drawer becomes an in-flow disclosure on its own row below 1000 px. Examples sheet locks page scroll. Logo hover rotation removed. Chip and tab hover states |
| Base | `styles/base.css` | Radius by role. One shared 120 ms colour transition for flat controls. 24 px minimum on link-buttons. Unused `.textlink` removed |
| Homepage | `screens/home/Home.tsx`, `styles/home.css` | Eyebrow and duplicate CTA links removed. Lead aligned to the gutter. Specimen hugs its content. Planned LR door set quieter and narrower. 3D intro skipped below 900 px. Intro caption wraps |
| LR placeholder | `screens/lr/LrStage.tsx` | "Planned" tag. One "Planned stages, none built yet" caption instead of four "Not built" tags |
| Precedence table | `styles/figures.css` | Cells sized from the figure's width (container units) **and** the viewport height, for any number of terminals, up to 64 px, centred |
| Parse / modes | `styles/figures.css`, `screens/opp/Bench.tsx` | Benches stack below 1000 px. Wrapped token rows leave room for their marks. Trace columns fit phones. 24 px trace targets. h2 bench titles |
| LEADING/TRAILING | `screens/opp/SetsStage.tsx`, `ui/kit.tsx` | h2 region headings. Panels stack on phones |
| DFA | `screens/regex/dfaLayout.ts`, `DfaGraph.tsx`, `ui/kit.tsx` (`useMedia`), `test/replay.test.js` | Phones draw the automaton **top to bottom** (the row layout reflected across the diagonal, then labels re-seated), at close to full size. New unit test: no overlaps, taller than wide, pairwise distances preserved |
| Dock | `styles/hardware.css`, `ui/hardware.tsx` | Below 1000 px: keys + readout, then a full-width timeline, then dial + Next. Tick label is a sibling of its tick |
| Verifier | `scripts/verify.mjs` | The desktop "no page scroll" rule now applies at ≥ 1000 px only, with **at most one scroller** below that. A page locked by a modal is not a scroller. Homepage Tab order allows a lead with no links, classifies the skip link, and rejects any unexpected tab stop |

## 8. Before vs after

| Screen | Before | After |
| --- | --- | --- |
| Homepage, 1440 | Eyebrow + headline + sub + 2 links, then the title block. Lead at x = 44 px, doors at 32 px, logo at 18 px. Specimen box stretched over 150 px of empty grid | Headline + one sentence + title block, all on the 16 px gutter with the logo and doors. Specimen sized to content and centred. Two working doors wide, planned LR door muted |
| Precedence table, 1440 | 54 px cells top-left, about 60% of the figure empty | 62 px cells centred in the figure, legend under the table |
| Parse a string, 768 | Page wider than the screen. Logo cut at the left, stage switch at the right, bench sentence and trace cut | Fits. Stage switch on its own row, bench and trace full width, dock in two rows |
| Precedence table, 390 | Table and top bar overflow sideways | Table cells sized to the screen (≈ 40 px), explanation below, one page scroll |
| Classic vs Safeguarded, 360 | Benches side by side and cut off. "lookahead" mark collides with the row above | Benches stacked. Marks clear their rows |
| DFA construction, 360 | 4-state row shrunk to about 40% (≈ 6 px labels) | Column layout at full size: states, sets and edge labels legible |
| Stage drawer, 768 | Overlay covering table buttons | In-flow disclosure. The table moves down |

See the paired files in `audit/screenshots/before/` and `audit/screenshots/after/`.

## 9. Accessibility improvements

- Heading structure: no more h1 → h3 skips (sets, parse, modes).
- WCAG 2.2 AA target size (2.5.8): trace step buttons and all standalone link-buttons are at least 24 × 24 px.
- The modal Examples sheet now locks the page behind it (focus was already trapped, and Esc already closed it).
- Narrow screens no longer trap touch scrolling in nested scroll regions.
- On phones, the intro (motion pointing at an off-screen target) is replaced by the static, finished specimen with a Replay key.
- The timeline tick label's DOM now matches its painted background.
- Unchanged and still verified: keyboard-only full demos of both algorithms, visible focus everywhere, reduced motion (0 animations while stepping), grayscale legibility of ⋖ ⋗ ≐ (min 6.27:1), and 41/41 token contrast pairs.

## 10. Responsive improvements

The breakpoints are now intentional, not a single "stack it" query:
- **≥ 1000 px wide and ≥ 720 px tall:** the desktop instrument. No page scroll, at most one inner scroller (unchanged).
- **≥ 1000 px wide but under 720 px tall** (e.g. a 1080p laptop at 150% scaling): the page scrolls, the plate grows to its content, the dock stays pinned to the bottom of the window. Added after the team's report.
- **640–999 px:** figure over inspector, page is the only scroller, the dock wraps, Classic and Safeguarded stack, and the stage switch takes its own row.
- **≤ 640 px:**
  - the top bar on two rows, with a 12 px gutter
  - a one-column plate header, and full-width fields and chips
  - the precedence table sized from the screen width
  - stacked LEADING/TRAILING panels
  - phone trace columns
  - a vertical DFA
  - no 3D intro
- Figures for grammars too wide even then scroll inside their figure, never the page.

Verified at 1440×900, 1280×800, 768×1024, 390×844 and 360×800, with every screen and mode at each size: **1137/0**.

## 11. Component and design-system improvements

- Two radius tokens and two shadow tokens replace 8 radius values and 9 ad-hoc shadows. Every remaining raw value is a shape with meaning (circles, the rounded non-terminal slot, keycap bevels).
- One `--gutter` token defines the page edge everywhere.
- One shared state transition for flat controls instead of none.
- `useMedia` hook, used by the DFA graph and available for future responsive components.
- `layoutDfa(dfa, labels, 'row' | 'column')`: the phone layout comes from the same tested geometry, so it cannot drift from the desktop one.
- Dead CSS removed (`.textlink`, the old popover and settings styles).

## 12. Remaining limitations

- **Resolved after the report:** a frame-rate regression on the precedence table (16/203 slow frames, failing the 5% budget on a slower host). It was caused by the container query used to size the table, not by the table's size. It was replaced with a viewport-derived width; the table is back at 3/228. See `docs/AUDIT-LOG.md` items 24–26 for this and two other follow-ups: the short-window layout (laptops at 150% scaling) and keys reaching the wrong page during a slow page transition.
- The devibe score is unchanged (6). The three remaining hits are reviewed intentional choices, and `unslop-ignore` markers were **not** added just to lower the number.
- Very wide grammars (more than about 9 terminals) on a phone scroll sideways inside the table figure. That is acceptable for a formal table, but not ideal.
- Only Chromium was tested. Real GPUs and real touch devices were not.
- No linter is configured in the project. Strict `tsc` is the static check.
- VibeCheck was not run (see §4).

## 13. Test results (final build)

| Check | Result |
| --- | --- |
| `npm run typecheck` (strict) | pass |
| `npm test` | **32/32** (31 existing + 1 new DFA column test) |
| `npm run build` | pass (app 576 KB min / 180 KB gzip, intro 554 KB) |
| `npm run check:contrast` | 41/41 |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `node scripts/verify.mjs` (full default run: 3 desktop sizes, keyboard demos, replay identity, reduced motion, grayscale, fps under 4× CPU throttle, intro, fonts, bundle scan, offline) | **733 passed, 0 failed** (re-run after the follow-up fixes) |
| `node scripts/verify.mjs --only=screens --viewports=1440x900,1280x800,768x1024,390x844,360x800` | **1137 passed, 0 failed** (baseline 929 / 208). With 1265×590 added after the team's report: **1362 / 0** |
| Browser-tested interactions (driven by the verifier) | Navigation, stage drawer, Examples sheet (open, focus trap, Esc, scroll lock), grammar editor and samples, sets provenance, table provenance and conflicts, parse chips, mode switch, trace and table-lookup tabs, comparison table, regex input and errors, DFA build and simulation, dock keys, timeline scrub, speed dial, homepage specimen, intro and skip |

## 14. Final scanner results

- **devibe_scan:** 0 high, 3 medium (reviewed, kept), 0 low. Vibe score 6, verdict text "Some AI defaults present", produced only by the two menu entrances and the extrusion shadow.
- **Design Harness:** 71 findings, down from 209. Zero contrast, target-size, heading or fixed-width findings remain apart from the reviewed false positives in §5. Routes scoring 100: grammar, sets, modes, LR, tree, props.
- **VibeCheck:** not run, for security reasons (§4).

## 15. Final verdict

**A: feels intentionally designed and senior-level** (baseline: **C**, because a strong desktop identity was undermined by broken tablet and phone layouts and a stock hero).

The product now reads as one coherent instrument at every size. It has a single shape language, a single page edge, and
type with clear roles. The figure is always the hero, every destination has one entry, and phones get their own layout,
including a DFA redrawn for the screen. With all motion off it still holds up: every state is drawn statically (the
reduced-motion path is verified), and hierarchy comes from type, rules and the drafting grid, not effects. What keeps it
short of a clean A:
- The once-per-visitor 3D intro and the glass loupe are flourishes a minimalist reviewer could call decorative, though both are tied to the product's subject and name.
- The chapter list still carries an unbuilt LR chapter. It is now honestly marked, but still present.
