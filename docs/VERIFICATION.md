# Verification report

Deliverable 7. Every result below comes from `node scripts/verify.mjs`, run against the **production build**. The script copies `dist/` into a renamed,
nested folder (`…/compiler lab verify/nested/renamed build/`), opens it from `file://` in Chromium with the network switched off, and drives
the real UI. The full list of checks is in [verification-results.md](verification-results.md), generated from the run's `report.json`.

**Final full run: 733 passed, 0 failed.**

- **Unit tests:** `npm test`, 32/32 pass (12 core, 8 schema, 9 replay, 3 specimen).
- **Audit viewports** (UI/UX audit, `audit/`): every screen at 1440×900, 1280×800, 768×1024, 390×844 and 360×800, **1137 passed, 0 failed**. Below 1000 px the page scrolls and must be the only scroller.
- **Typecheck:** `npm run typecheck` is clean (strict).
- **Contrast:** `npm run check:contrast`, 41/41 pairs.
- **Dependency audit:** `npm audit --audit-level=high`, 0 vulnerabilities.

Environment: a Linux container with no GPU, Chromium 141 (Playwright's `chromium-1194`), 4 CPU cores.

## Results by requirement

| Requirement (brief, Phase 5) | Result |
| --- | --- |
| Screenshots at 1366×768, 1280×720, 1920×1080 for every screen and mode, including the homepage | **Pass.** 45 screens and modes × 3 viewports, plus the homepage at 820×1000 and 390×844: 137 screen views, each with 5 layout checks (screenshots in `artifacts/screenshots/`; a curated set is in [`docs/screenshots/`](screenshots/)) |
| No clipped text: `scrollWidth > clientWidth` with overflow hidden | **Pass at all 143.** Also fails on clipping by `contain: paint` and on content pushed sideways inside a scroll box. Both were added after they hid real bugs; see the [audit log](AUDIT-LOG.md#4-failures-the-verification-loop-caught-and-the-fixes). |
| No two interactive elements overlapping | **Pass at all 143** (only the visible part, clipped by scroll containers, is compared) |
| No more than one vertical scrollbar in the workspace | **Pass at all 143.** No page scroll at the desktop sizes; one page scrollbar allowed at the two narrow homepage sizes. |
| Added: no text overlapping text or a control | **Pass at all 137.** Timeline tick labels are included even though their track is `aria-hidden`. With label fitting switched off, this check fails on 7 parse and LEADING/TRAILING screens. |
| Keyboard-only: full Operator Precedence demo | **Pass.** Tab to door I → Enter → Tab to "Derive LEADING and TRAILING" → End (LEADING(E) = { +, *, (, id }) → Tab to Next stage → → → ← lands on step 2 → End shows Conflict-free → parse: Space plays and pauses, End reaches ACCEPT → Classic vs Safeguarded opens on S → A + B with `id/id+id*id`; End shows Classic **ACCEPT** and Safeguarded **REJECT** |
| Keyboard-only: full RE→DFA demo | **Pass.** Tab to door III → type `(a|b)*abb`, Enter → props → End → followpos → DFA → simulation → End accepts `abb` |
| Speed dial and timeline by keyboard; `[` `]` | **Pass** |
| prefers-reduced-motion | **Pass.** No intro; the specimen is static and finished ("40 of 40") with a **Replay** keycap; stepping runs **0** animations and draws 0 overlays; every step is still explained (corner brackets + note). A stored preference (`cl.reduced`) does the same. |
| Grayscale legibility of ⋖ ⋗ ≐ and conflict cells | **Pass.** Under `filter: grayscale(1)` the weakest glyph is **6.27:1** against its cell (needs 4.5). The three relations differ by glyph. All 4 conflict cells carry fracture marks, a ×2 count and a slash. [Screenshot](screenshots/grayscale-conflict-table.png) |
| 60 fps under CPU throttling | **Pass**, 4× throttling, three 4-second runs per scenario, median run judged. See the table below. |
| Homepage acceptance (5) | **Pass.** See below. |
| Built `dist/` opened from a nested folder with the network disabled | **Pass.** Zero network requests and zero page/console errors or failed requests across the whole run. |
| Forward then Back yields an identical rendered snapshot | **Pass.** `.plate__body` innerHTML compared at **every** step of 8 stages (183 steps), pressing Back immediately, mid-animation (40 ms), and after the animation settles; no overlay left behind |

### Frame rate at 4× CPU throttling

| Scenario | Median fps | Animation frames over 25 ms (median run; all three runs) | Step commits, worst frame |
| --- | --- | --- | --- |
| Homepage specimen running | 59.9 | 1/235 (0/235, 1/235, 1/235) | 5, 17 ms |
| Precedence table playing at 2× with motion | 59.9 | 7/225 (6/222, 7/225, 14/214) | 6, 17 ms |
| Parse bench playing at 1× with motion | 59.9 | 1/236 (1/236, 1/236, 4/229) | 3, 17 ms |
| DFA simulation playing | 59.9 | 2/235 (1/236, 2/235, 3/234) | 3, 17 ms |

The precedence-table row rose from 2 to 7 slow frames after the UI/UX audit made its cells about 15% larger (a larger loupe filter area). It is recorded rather than hidden; see `audit/UI_UX_FINAL_REPORT.md` §12.

**Read this with the following caveat.** The container has no GPU. These numbers use Chrome's own software compositor
(`--disable-gpu-compositing`), which is what a GPU-less machine uses for page compositing. With ANGLE/SwiftShader, which emulates a GPU on the
CPU and was used for every other check so that WebGL works, the same pages drop 6–11% of frames whatever the app does: measured 17/170 vs
4/236 on the same page. An idle page drops nothing, and turning the app's effects off removes only part of the drops. Real GPUs were not
measured. The fixes that brought the app itself under 2% are in the [audit log](AUDIT-LOG.md), items 7–10.

### Homepage acceptance

| Check | Result |
| --- | --- |
| 1. First view fits 1366×768: no page scroll, no clipped or overlapping text | **Pass** |
| 2. A test asserts the specimen's table equals `buildPrecedenceTable` | **Pass.** `test/specimen.test.ts` compares every cell of the data; `verify.mjs` compares all 36 rendered cells with the core |
| 3. All three doors reachable and operable by keyboard; Tab order headline → doors → specimen controls | **Pass.** The recorded Tab sequence is rail → door ×3 → specimen (the headline block has no links since the UI/UX audit); Enter on each door opens `#/opp/grammar`, `#/lr`, `#/regex/tree` |
| 4. Zero network requests; works from the built `dist/` offline | **Pass** |
| 5. A screenshot with the logo removed still reads as a compiler tool, not a SaaS landing page | **Needs a human.** The screenshot is [screenshots/home-without-logo.png](screenshots/home-without-logo.png). My reading: a grammar, a precedence table filling in with relation glyphs, parse tokens, plate numbering, a drafting-style title block with the project and team, and a ruled strip of three tool entries; no hero image, feature grid, stats or gradient call-to-action. The script only produces the image; it does not judge it. |
| Specimen failure (`#/?fault=specimen`) | **Pass.** "The specimen couldn't run. Open Examples to load a grammar." is shown and the three doors still work |
| Project title block | **Pass.** Project name (ParseLens) and title, team, both members with registration numbers, and year are fully visible in the first view. There is no course row and no navigation-instructions note, at the team's request. |

### Intro

| Check | Result |
| --- | --- |
| First visit with WebGL (SwiftShader) plays the 3D intro and hands off in under 4 s | **Pass.** 2.31 s from page load with the full flight, in a re-run of the intro group after adding a "skipped" marker. In the final full run it handed off at 1.38 s: the frame-time monitor saw slow emulated-GL frames and jumped to the landing (Plan B). Both paths were observed. |
| After the hand-off the DOM table's glyphs are visible and the intro is remembered | **Pass** |
| A return visit skips straight to the specimen | **Pass** |
| Esc skips the intro | **Pass** (about 0.6 s including the 280 ms fade) |
| CSS hand-off (`#/?intro=css`) runs and finishes | **Pass.** [Frame](screenshots/intro-css-frame.png) |
| WebGL disabled (`--disable-webgl --disable-3d-apis`): CSS hand-off, then a static specimen with Replay | **Pass.** [Screenshot](screenshots/no-webgl-home.png) |

### Fonts, glyphs and bundle

- IBM Plex Math is loaded from the bundle and used for ⋖ ⋗ ≐ (`document.fonts.check` is true and the glyph mode is `font`). Plex Sans, Serif and Mono load from the bundle. The inline-SVG fallback renders (`#…?glyphs=svg`, [screenshot](screenshots/1366x768--opp-table-svg-glyphs.png)).
- The bundle scan finds no `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` or `EventSource`; no `getUserMedia` or `mediaDevices`; no `eval` or `new Function`; no `dangerouslySetInnerHTML` in `src`; no analytics hosts.
- Sizes: app `index-*.js` **562 KB** min (180 KB gzip), the 3D intro `intro.js` **541 KB** (138 KB gzip, first visit only). The old UI's single bundle was 1.9 MB.

## Screenshots (1366×768 unless noted)

| | |
| --- | --- |
| Homepage, live specimen ![](screenshots/1366x768--home.png) | Homepage, provenance of a cell ![](screenshots/1366x768--home-provenance.png) |
| Homepage at 390 px ![](screenshots/390x844--home-narrow-390.png) | Homepage, logo removed ![](screenshots/home-without-logo.png) |
| 3D intro mid-flight ![](screenshots/intro-3d-frame.png) | Examples sheet ![](screenshots/1366x768--examples.png) |
| Grammar: adjacent non-terminals ![](screenshots/1366x768--opp-grammar-adjacent.png) | LEADING and TRAILING ![](screenshots/1366x768--opp-sets.png) |
| Precedence table with the loupe ![](screenshots/1366x768--opp-table.png) | Conflict: provenance opens on the conflicting cell ![](screenshots/1366x768--opp-table-conflict.png) |
| Provenance sheet ![](screenshots/1366x768--opp-table-provenance.png) | Parse: reduce with the handle ![](screenshots/1366x768--opp-parse-reduce.png) |
| Classic vs Safeguarded opens on S → A + B ![](screenshots/1366x768--opp-modes-open.png) | …and diverges at step 10 ![](screenshots/1366x768--opp-modes-diverge.png) |
| Regex: malformed ![](screenshots/1366x768--regex-malformed.png) | nullable / firstpos / lastpos ![](screenshots/1366x768--regex-props.png) |
| followpos ![](screenshots/1366x768--regex-follow.png) | DFA construction ![](screenshots/1366x768--regex-dfa-end.png) |
| Simulation ![](screenshots/1366x768--regex-sim.png) | LR placeholder ![](screenshots/1366x768--lr.png) |
| 1920×1080 ![](screenshots/1920x1080--opp-table.png) | 1280×720 ![](screenshots/1280x720--opp-table.png) |

## What this does not prove

- Only Chromium was tested (the lab target). Firefox and Safari are untested.
- Frame rates on real GPUs were not measured; see the caveat above.
- Whether the homepage "reads as a compiler tool" is a human judgement.
- The DFA layout is checked for label/node overlaps on 12 automata up to 8 states. Larger automata may need the Plan C toggle described in the [design](design/DESIGN.md#risks-with-plan-b-and-plan-c).
