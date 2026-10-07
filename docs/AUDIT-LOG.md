# Audit log

Deliverable 8: what changed, why, and what the verification loop caught. This covers the work on branch
`claude/practical-johnson-s2bqni`, starting from `main` at `3d7915d` ("Regenerate screenshots").

## 1. The algorithm core was not changed

- `compiler-lab-core.zip` (attached) was unpacked into a scratch folder and compared with `src/algorithms` and `test/partA|partB`.
  `diff -r` showed them **byte-identical**.
- No file under `src/algorithms/` was edited. The UI reaches the core only through the typed facade `src/core/index.ts`, which
  imports the JS modules and states their signatures. `src/core/types.ts` describes the `steps[]` schema the core already emits.
  `test/schema.test.js` pins the same contract at runtime.
- The 12 core tests (`test/partA.test.js`, `test/partB.test.js`) pass unchanged, as do 19 other tests (31 in total).

## 2. What was replaced

The whole UI layer was rebuilt in strict TypeScript.

| Removed | Replaced by |
| --- | --- |
| `src/App.jsx`, `src/main.jsx`, `src/components/**`, `src/pages/**` | `src/App.tsx`, `src/main.tsx`, `src/shell/`, `src/ui/`, `src/screens/{home,opp,regex,lr}/` |
| `src/replay/*.js` | `src/replay/*.ts` (same logic, typed; the existing replay tests now import the TS modules) |
| `src/motion/effects.js` (Motion `animate`, committed inline styles; overlays inside the compared DOM) | `src/motion/fx.ts` (WAAPI with no lasting fill, overlays in a 0×0 fixed layer outside the app root, global `cancelAllFx`) |
| `src/motion/Board.jsx` (cursor spotlight and pointer tilt on diagrams) | Removed: decorative, and 3D/tilt on diagrams is excluded by the brief |
| `src/components/DFAGraph/DFA3D.jsx` (3D DFA inspector) | Removed: the brief excludes 3D from diagrams |
| Cytoscape DFA renderer | `src/screens/regex/DfaGraph.tsx` + pure layout `dfaLayout.ts` (SVG) |
| `src/styles/*.css` (Inter / JetBrains Mono) | New token system and styles; IBM Plex Sans/Serif/Mono + IBM Plex Math |
| `scripts/audit-build.mjs` (puppeteer, 106 checks) | `scripts/verify.mjs` (Playwright core, 733 checks in the final run) + `scripts/lib/browser.mjs` |
| `vite.config.js` | `vite.config.ts` (portable IIFE) + `vite.intro.config.ts` (separate 3D intro script) |

New tests: `test/specimen.test.ts` (homepage specimen equals `buildPrecedenceTable`) and a DFA-layout overlap test in
`test/replay.test.js`. The forward-then-Back identity test runs in a real browser, in `scripts/verify.mjs` (group `replay`): every step of
eight stages, with Back pressed immediately, mid-animation, and after the animation settles.

## 3. Supply chain

| Item | Before | After |
| --- | --- | --- |
| Version ranges | caret (`^`) | **exact pins**; `.npmrc` `save-exact=true` |
| Install scripts | allowed | `.npmrc` **`ignore-scripts=true`**; install with `npm ci --ignore-scripts` |
| Audit gate | none | `npm run audit:deps` = `npm audit --audit-level=high` → **0 vulnerabilities** |
| Lockfile | committed | committed (87 locked packages, 37 top-level folders installed on Linux) |
| PostCSS | 8.5.29 (transitive) | pinned through `overrides` to **8.5.29** |
| Vite | ^8.3.0 | **8.3.3** |

**Advisory floors, checked rather than trusted.** I queried npm's bulk advisory endpoint with every published version (6 Oct 2026):

- **PostCSS**: the latest advisory, [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), affects `<= 8.5.22`, so the floor is
  **≥ 8.5.23**. The earlier claim was correct. The others: [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) affects `<= 8.5.17`;
  [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) affects `<= 8.5.11`.
- **Vite 8**: [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) (high) and the launch-editor advisory
  [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) affect `<= 8.0.15`, so the floor is **≥ 8.0.16**. The 8.0.x line also has
  [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583) and [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r) at `<= 8.0.4`.
  We pin 8.3.3. All Vite advisories concern the dev server, not the built output.

| Package | Change | Note |
| --- | --- | --- |
| `@react-three/fiber`, `@react-three/drei` | removed | Not needed: the intro is plain three.js in its own script |
| `cytoscape` | removed | 425 KB min; replaced by SVG |
| `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` | removed | Replaced by IBM Plex |
| `puppeteer-core` | removed | Replaced by `playwright-core` 1.63.0 (no browser download; uses the local Chromium) |
| `@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-serif`, `@fontsource/ibm-plex-mono` 5.3.0 | added | OFL; no install scripts |
| `three` 0.186.1 | kept | Bundled only into `assets/intro.js` |
| `typescript` 7.0.2, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@types/three` 0.186.0, `@types/node` 22.20.5 | added (dev) | `@types/three` pulls in type-only packages that are never bundled |
| `@ibm/plex-math` | **not installed** | Its `postinstall` runs `ibmtelemetry` (telemetry at install time). The single unmodified woff2 is vendored at `src/assets/fonts/IBMPlexMath-Regular.woff2` with `IBMPlexMath-OFL.txt`; the SHA-256 matches the tarball file. |
| `fsevents` | transitive (Vite, macOS only) | The only locked package that declares an install script. It ships prebuilt and is skipped on Linux/Windows. |

**Runtime rules, checked by `scripts/verify.mjs` on every run:**

- no `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` or `EventSource` in the bundles;
- no `getUserMedia` or `mediaDevices`;
- no `eval` or `new Function`;
- no `dangerouslySetInnerHTML` in `src`;
- no analytics hosts;
- **zero network requests** with the app opened from `file://` and the network off.

The 3D geometry is procedural (`THREE.Shape` + `ExtrudeGeometry`). The matcaps are drawn on a canvas, and the loupe's displacement map is generated at
build time by `scripts/gen-lens-map.mjs`. No model, texture or font is downloaded.

**Third-party code copied: none.** These techniques were re-implemented, with credit in the source:

- the loupe's displacement-map refraction, after `@samasante/liquid-glass` (MIT), credited in `src/ui/Loupe.tsx`;
- ideas only from Bruno Simon's folio-2019 (MIT: matcaps instead of lights, fake blob shadows) and Magic UI's animated beam (MIT).

React Bits (MIT + Commons Clause) was studied but nothing was copied, including the camera-requesting `ReflectiveCard`.

## 4. Failures the verification loop caught, and the fixes

Every item below was a FAIL in `scripts/verify.mjs` or in a screenshot review before it was fixed. After each fix the loop was run again.

| # | Found | Cause | Fix |
| --- | --- | --- | --- |
| 1 | Dock filled half the plate on screens without a controls row | `grid-template-rows` assumed a controls row was present | Plate is a flex column; the body takes the remaining height |
| 2 | Grammar examples ran off the bottom at 720 px | Long list in the non-scrolling column | Moved into the result column, the screen's only scroller |
| 3 | "Clipped text" on every precedence table | Corner labels hidden with a home-made 1 px clip | Replaced with one `.sr-only` description |
| 4 | Examples sheet: page behind it still focusable and overlapping | No inert background | `inert` on rail and main while the sheet is open |
| 5 | DOM differed after → then ← at the last table step | The loupe remounted and React `useId` produced a new filter id | Deterministic filter id per table |
| 6 | DOM differed after forward/Back at conflict steps (found while building) | Conflict provenance was opened by an effect that set state | Derived from the current step instead; closing is keyed to the step |
| 7 | 33% of animation frames over 25 ms on the homepage at 4× CPU | The beam overlay was a full-viewport SVG repainted every frame | Overlays are sized to their path's bounding box, each in its own small layer; `#fx-layer` is 0×0 |
| 8 | About 0.5 s stall on the first table step | Loupe displacement map generated on a canvas and PNG-encoded at runtime | Generated once at build time and inlined (`?inline`) |
| 9 | Long frames on every table step | Motion `layoutId` on 49 cells, re-measured each step | One-shot FLIP (`fx.morph`) on click; memoised cells; layout/paint containment on figure and inspector; the filtered loupe gets its own compositing layer and is never animated |
| 10 | fps still 6–11% long frames in parse/sim | Not the app: SwiftShader GL compositing redraws the whole viewport on the CPU every animated frame (17/170 long vs 4/236 with Chrome's software compositor on the same page) | The fps check runs on Chrome's software compositor; WebGL checks keep SwiftShader. The evidence is recorded in `scripts/lib/browser.mjs` and in VERIFICATION.md. |
| 11 | Console error on the specimen-failure test | React logs errors that a boundary has already handled | `onCaughtError` reports them with `console.warn`; uncaught errors still reach the console |
| 12 | Parse trace: Action column hidden behind a sideways scroll (screenshot review) | `nowrap` columns in a 400 px inspector | Fixed column widths and wrapping stacks; **new verifier check** fails on any horizontal overflow inside a scroll box |
| 13 | Loupe covered the conflicting cell's fracture marks (screenshot review) | The loupe was shown on conflict steps | Hidden on conflict steps (conflicts are instant and structural); loupe cells no longer wrap |
| 14 | DFA active-edge arrowhead grew with stroke width | Default `markerUnits` | `markerUnits="userSpaceOnUse"` |
| 15 | Raw `C --b--> D` in the "Next" line | The core's message format | Rendered as "C on b goes to D" |
| 16 | At 390 px the plate label drew under the rail's Keys/Settings (screenshot review) | The rail wraps on narrow screens, but its grid row stayed 52 px | Rail row is `auto` below 1000 px. **New verifier check:** text overlapping text or a control (tight glyph boxes, clipped to scroll containers, ignoring text under opaque floating panels and sticky headers) |
| 17 | Classic-mode trace: the Input column text ran into the Action column | `nowrap` in a fixed-width column | Input wraps |
| 18 | Comparison benches 56 px taller than their figure at the divergence step, with the overflow silently cut | `contain: paint` clips like `overflow: hidden`, and the clipped-text check did not know that | **The check now treats paint containment as clipping.** Compact benches drop the two long sentences (they are in the inspector) and tighten gaps |
| 19 | 8-state DFA figure 6 px too tall at 768 px | Transition table rows | Tighter rows in the DFA figure |
| 20 | Trailing "Back restores exact DOM: followpos @3" flake from the old UI | Old effects committed inline styles (Motion) and drew overlays inside the compared container | WAAPI with no lasting fill plus overlays outside the app root; checked now at **every** step of eight stages, three timings each |
| 21 | Parse dock: tick labels "reduce 1 … reduce 5" overlapped (reported by the team) | Labels were spaced by fraction of the track (12%), not by their measured width; the text-overlap check skipped them because the track is `aria-hidden` | Labels are measured and fitted: a label that would touch its neighbour hides, and end labels anchor inward. The overlap check now includes tick labels. **New verifier rule.** Shown failing on 7 screens with fitting off |
| 22 | "Stored reduced-motion preference stops all motion" failed once in a full run | The test wrote `cl.reduced` and reloaded immediately, racing the storage backend under load | The preference is seeded before the app boots |
| 23 | UI/UX de-vibe audit: chapter pages overflowed sideways at 768/390/360 px (91 views), two scrollers on narrow screens, homepage hero template, planned chapter with equal weight, and more | The product was verified only at desktop sizes | See [`audit/UI_UX_FINAL_REPORT.md`](../audit/UI_UX_FINAL_REPORT.md). **New verifier rules:** at most one scroller below 1000 px, a modal-locked page is not a scroller, no unexpected homepage tab stops |
| 24 | Homepage specimen spilled over the chapter doors full-screen on a laptop at 150% scaling (reported by the team, about 1265×590 CSS px); chapter plates clipped their figures | The desktop layout assumed one screen of at least 720 px height | Homepage scrolls instead of overlapping when it cannot fit; below 720 px tall chapter pages scroll with the dock pinned to the bottom. **New verifier size:** 1265×590; content behind the sticky dock counts as covered (`elementFromPoint`) |
| 25 | Precedence table at 2× failed the frame-rate budget (16/203 slow frames) | `container-type: inline-size` on the figure, added to size the table from its width | Width derived from the viewport and known columns instead: 3/228. Bisected against the pre-audit build on the same machine |
| 26 | Keyboard demo: arrow keys after Next stage moved the *previous* stage's replay | The View Transition kept the old page mounted while it snapshotted (600+ ms with software rendering) | Keys are ignored while a route change is in flight; a snapshot slower than 120 ms skips the cross-fade |

## 5. Known limitations (not hidden)

- **LR parsing is not implemented.** Chapter II is an honest placeholder.
- **Dark theme was cut** (scope ladder rung 8).
- **Only Chromium was verified** (Chrome/Edge are the lab target). Firefox and Safari are untested.
- **Frame rates were measured in a GPU-less container** with Chrome's software compositor at 4× CPU throttling. Real GPUs should do
  better, but that was not measured.
- **The "reads as a compiler tool without the logo" check needs a human.** The verifier only writes the screenshot
  (`docs/screenshots/home-without-logo.png`).
- DFAs above 8 states use the ring layout. Edges may cross there; labels and nodes are checked not to overlap for the tested automata.
