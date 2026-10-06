# ParseLens: design and build plan

Deliverables 2–5 of the brief. Deliverable 1 is [EFFECT-CATALOG.md](EFFECT-CATALOG.md). Deliverable 6 is the code. Deliverable 7 is
[../VERIFICATION.md](../VERIFICATION.md). Deliverable 8 is [../AUDIT-LOG.md](../AUDIT-LOG.md).

**Assumptions** (no questions were asked back):

- The algorithm core in `src/algorithms` is byte-identical to the attached `compiler-lab-core.zip`. I checked this with `diff -r`. It is treated as frozen.
- The lab machines run Chrome or Edge, so Chromium is the verified target. Other browsers are expected to work but were not tested.
- The product is named **ParseLens** (after the table loupe). The wordmark is heavy IBM Plex Sans ("Parse" in ink, "Lens" in brass). The mark is a brass-rimmed loupe magnifying a ⋗ relation over a table grid. At the team's request the title block has no course row, and the rail has no Keys or Settings menus. Shortcuts are still shown on each keycap's tooltip. Reduced motion follows the OS setting (`prefers-reduced-motion`).
- At the team's request, the project details sit in a title block in the homepage's first view (not a footer), and the first-visit navigation note was removed.
- Light theme only. A dark "blueprint" plate is on the scope-cut ladder.

---

## 2. Direction

### Two alternatives considered

**A. Signal Bench.** The tool becomes a bench oscilloscope. The plate is a dark instrument panel. Algorithm
steps are traces that scroll across a phosphor grid, and the transport is a row of illuminated hardware switches.
The metaphor fits "watching a machine run", and step playback maps naturally onto a sweep. But it drifts straight into the
anti-patterns: glow, neon on dark, and decorative scanlines. A dark panel also makes the formal objects (tables and grammars set in
mono) harder to read on a projector, which is where this tool is used.

**B. Typeset Proof.** The tool becomes a printer's proof sheet. Everything is typography: galley columns, marginal
notes, and proofreader's marks for changes (a caret for an insertion, a strike for a conflict). It would be very clear and very
calm, and it degrades perfectly to print. But it has no hardware: nothing to press, no dial, no lens. The brief asks for tactile 3D
controls and one intro, and here motion would collapse into fades.

### Chosen: the Compiler Laboratory Plate, evolved

A flat, printed drafting plate on a desk, with machined hardware sitting on top of it. **The contrast between the
two is the identity.**

| Printed (2D, flat, ink on paper) | Machined (CSS 3D, light and shadow) |
| --- | --- |
| Plates I–III with registration marks, plate numbers ("Plate I.3"), a drafting grid only behind figures | Keycaps with real press travel (120 ms), mirrored by keyboard shortcuts |
| Every formal object: grammars, sets, tables, stacks, trees, DFAs | A knurled brass speed dial with five detents |
| A highlighter fill for "written this step", a dashed brass outline for "read this step" | A weighted brass scrub thumb on the timeline |
| Serif plate titles, sans body, mono only for formal objects | The loupe: a brass-bezelled lens over the active table cell (the only glass) |

**Why this one.** It is the only option where *every* decorative element has a job. The highlighter and the brass outline are the two
signals that explain each step. The hardware is the transport. The loupe shows the cell being written. It keeps the formal
objects crisp and 2D, and it reads as a lab instrument even without the logo.

---

## Stack decision (with evidence)

All sizes were measured on this machine by building each library alone as an IIFE (`vite build`, minified), excluding React where it is a peer.

| Starting position | Decision | Evidence |
| --- | --- | --- |
| React + Vite + TypeScript, base `./` | **Kept.** The UI is strict TS. The core stays plain JS behind a typed facade (`src/core/index.ts`). | TS 7.0.2 typechecks the project. Node 22 runs `.ts` tests directly (type stripping), so `npm test` needs no build step. The core is unchanged. |
| Motion for state-to-state and shared-element animation | **Kept**, for presence (drawers, sheets), the mode-switch underline, the door pipeline marker, and the route fallback. | **Changed:** the precedence-table provenance morph is no longer `layoutId` on 49 cells. Every cell registered with Motion's projection, which re-measured on every step. It is now a one-shot FLIP (`fx.morph`) measured only on click. |
| GSAP only for scripted sequences | **Rejected.** | 1. Its license is GreenSock's "Standard no charge", which is not OSI (see the catalog). 2. Every sequence we need is under 400 ms and expressible as WAAPI keyframes with delays. 3. One engine means one cancellation path: `cancelAllFx()` stops everything when the user seeks, which is the central safety rule. |
| Native View Transitions for chapter/page changes, with a Motion fallback; evaluate ssgoi | **Native VT kept**, with a 150 ms Motion opacity fallback. **ssgoi rejected.** | ssgoi re-inserts the detached outgoing DOM node to animate it out (`create-ssgoi-transition-context.ts`). That conflicts with "rendered DOM is only React's render of `steps[count]`". VT is already in Chromium. |
| CSS 3D transforms for tactile controls | **Kept.** | Keycaps (`perspective` + `translateZ` + `rotateX` press), dial, thumb. No WebGL in controls. |
| ONE lazy R3F canvas (Drei only as needed) for the intro | **Changed: plain three.js, no R3F, no Drei**, built as a *separate classic script* (`dist/assets/intro.js`) injected only on a first visit with WebGL and motion allowed. | `file://` forbids module scripts and Rollup cannot code-split an IIFE build. So a lazy chunk is impossible in the main bundle, and R3F needs React in the same realm. Measured: R3F + three is **893 KB min / 235 KB gz**; the plain-three intro is **555 KB / 138 KB gz** and the app bundle never contains it. Drei's `Text3D` needs a font JSON download, so glyphs are procedural `Shape` + `ExtrudeGeometry` instead. |
| Liquid-glass refraction only as a loupe, behind a flag, with a flat fallback | **Kept**, rewritten (about 40 lines plus a build-time map), flag stored as `cl.lens` (Glass by default, `flat` for the flat lens); the Settings menu was later removed. | The technique is from `@samasante/liquid-glass` (MIT): `filter:url()` on a copy of the content, not `backdrop-filter`. The map is generated at build time (`scripts/gen-lens-map.mjs`) because generating it on a canvas cost about 0.5 s on the first table step. |
| No Lenis in the workspace (intro only), no Theatre, no postprocessing | **Lenis rejected entirely** (the intro does not scroll). Theatre rejected (studio is AGPL-3.0). Postprocessing rejected. | — |
| Cytoscape primary behind a neutral DFA model, with a hand-written SVG fallback | **Changed: hand-written SVG is primary, Cytoscape removed.** | Cytoscape is **425 KB min / 134 KB gz**, about twice React + ReactDOM (212/65). It draws on canvas, so edges cannot be stroke-drawn with the same motion as the tree, and labels are invisible to the DOM checks. Our DFAs have ≤ 8 states. The neutral model `src/screens/regex/dfaLayout.ts` is pure and tested: `test/replay.test.js` asserts zero label/label and label/node overlaps for 12 automata, in row and ring layouts. Plan B below covers larger graphs. |
| Syntax tree: hand-written SVG | **Kept.** | — |

Result: the app bundle went from **1.9 MB (old UI) to 573 KB min / 177 KB gz**. The intro bundle is 555 KB / 138 KB gz and is fetched once, from disk, on a first visit only.

---

## 3. Design tokens

The tokens live in [`src/styles/tokens.css`](../../src/styles/tokens.css). Contrast is computed by `npm run check:contrast`
(`scripts/check-contrast.ts`, WCAG 2.x relative luminance) and the build is not done if a pair fails.

### Colour roles and their non-colour signals

| Role | Token | Hex | Non-colour signal (always present) |
| --- | --- | --- | --- |
| Paper | `--plate` / `--plate-2` / `--desk` | #FAF8F2 / #F1EDE3 / #E2DDD0 | — |
| Ink (text) | `--ink` / `--ink-2` / `--ink-3` | #1C1E21 / #4A4D52 / #5F6166 | — |
| Meaning-bearing border | `--line` | #77705F | — |
| ⋖ yields (shift) | `--rel-yields` | #1D4C91 | The glyph ⋖ itself (shape) and the legend word "shift" |
| ⋗ takes (reduce) | `--rel-takes` | #8A3A0C | The glyph ⋗ and "reduce" |
| ≐ equal (shift, same handle) | `--rel-equal` | #1C5F45 | The glyph ≐ and "same handle" |
| Written this step | `--changed` + `--changed-edge` | #F5D86A + #7A5A00 | **Corner brackets** on the cell, plus a "New" tag with a + glyph |
| Read this step (active pair) | `--read` | #7D5A0E | **Dashed** outline (stack/lookahead cell, production, rule, source set) |
| Active row/column | `--band` | #F0E7CC | Header cells only, together with the bracketed or dashed cell |
| Conflict | `--conflict` + `--conflict-wash` | #A0123A + #F7E1E6 | **Fracture marks** in two corners, an **×2** count, a **slash** between the two glyphs, and the word "Conflict" |
| Accept | `--accept` + `--accept-wash` | #1B6534 + #E1EEDF | **Double border**, ✓ glyph, the word ACCEPT |
| Reject | `--reject` + `--reject-wash` | #9B2114 + #F6E2DC | **Dashed border**, ✗ glyph, the word REJECT |
| Hardware | `--cap-*`, `--brass*` | see file | — |
| Focus | `--focus` | #1D4C91 | 2 px ring, 2 px offset, on every control |

### Computed contrast (text ≥ 4.5:1, meaning-bearing borders and strokes ≥ 3:1)

| Foreground | Background | Role | Ratio | Needs | Result |
| --- | --- | --- | --- | --- | --- |
| `--ink` #1C1E21 | `--plate` #FAF8F2 | body text | 15.73:1 | 4.5:1 | pass |
| `--ink` #1C1E21 | `--plate-2` #F1EDE3 | text in table heads and wells | 14.29:1 | 4.5:1 | pass |
| `--ink` #1C1E21 | `--desk` #E2DDD0 | rail text on the desk | 12.32:1 | 4.5:1 | pass |
| `--ink-2` #4A4D52 | `--plate` #FAF8F2 | secondary text | 7.99:1 | 4.5:1 | pass |
| `--ink-2` #4A4D52 | `--plate-2` #F1EDE3 | secondary text in wells | 7.26:1 | 4.5:1 | pass |
| `--ink-3` #5F6166 | `--plate` #FAF8F2 | captions | 5.84:1 | 4.5:1 | pass |
| `--ink-3` #5F6166 | `--plate-2` #F1EDE3 | captions in wells | 5.30:1 | 4.5:1 | pass |
| `--ink-3` #5F6166 | `--desk` #E2DDD0 | captions on the desk | 4.57:1 | 4.5:1 | pass |
| `--line` #77705F | `--plate` #FAF8F2 | cell, tape and stack borders | 4.63:1 | 3:1 | pass |
| `--line` #77705F | `--plate-2` #F1EDE3 | borders inside wells | 4.21:1 | 3:1 | pass |
| `--rel-yields` #1D4C91 | `--plate` #FAF8F2 | ⋖ glyph | 7.93:1 | 4.5:1 | pass |
| `--rel-takes` #8A3A0C | `--plate` #FAF8F2 | ⋗ glyph | 7.35:1 | 4.5:1 | pass |
| `--rel-equal` #1C5F45 | `--plate` #FAF8F2 | ≐ glyph | 7.13:1 | 4.5:1 | pass |
| `--rel-yields` #1D4C91 | `--changed` #F5D86A | ⋖ on the highlighter | 5.98:1 | 4.5:1 | pass |
| `--rel-takes` #8A3A0C | `--changed` #F5D86A | ⋗ on the highlighter | 5.54:1 | 4.5:1 | pass |
| `--rel-equal` #1C5F45 | `--changed` #F5D86A | ≐ on the highlighter | 5.38:1 | 4.5:1 | pass |
| `--ink` #1C1E21 | `--changed` #F5D86A | text on the highlighter | 11.86:1 | 4.5:1 | pass |
| `--ink` #1C1E21 | `--band` #F0E7CC | header text in the active band | 13.53:1 | 4.5:1 | pass |
| `--read` #7D5A0E | `--band` #F0E7CC | dashed outline next to the band | 5.09:1 | 3:1 | pass |
| `--changed-edge` #7A5A00 | `--changed` #F5D86A | corner brackets on the highlighter | 4.53:1 | 3:1 | pass |
| `--changed-edge` #7A5A00 | `--plate` #FAF8F2 | corner brackets on paper | 6.01:1 | 3:1 | pass |
| `--read` #7D5A0E | `--plate` #FAF8F2 | dashed "read" outline | 5.92:1 | 3:1 | pass |
| `--read` #7D5A0E | `--plate-2` #F1EDE3 | dashed outline in wells | 5.38:1 | 3:1 | pass |
| `--conflict` #A0123A | `--plate` #FAF8F2 | conflict text and fracture marks | 7.48:1 | 4.5:1 | pass |
| `--conflict` #A0123A | `--conflict-wash` #F7E1E6 | text in a conflicting cell | 6.38:1 | 4.5:1 | pass |
| `--rel-yields` / `-takes` / `-equal` | `--conflict-wash` #F7E1E6 | glyphs inside a conflicting cell | 6.76 / 6.27 / 6.08:1 | 4.5:1 | pass |
| `--accept` #1B6534 | `--plate` / `--accept-wash` | ACCEPT | 6.69 / 5.92:1 | 4.5:1 | pass |
| `--reject` #9B2114 | `--plate` / `--reject-wash` | REJECT | 7.54 / 6.42:1 | 4.5:1 | pass |
| `--cap-edge` #8F877A | `--plate` #FAF8F2 | keycap outline | 3.34:1 | 3:1 | pass |
| `--ink` #1C1E21 | `--cap-top` #FCFBF7 | keycap legend | 16.13:1 | 4.5:1 | pass |
| `--brass-lo` #6E531B | `--plate` #FAF8F2 | speed-dial ticks | 6.78:1 | 3:1 | pass |
| `--focus` #1D4C91 | `--plate` / `--desk` / `--plate-2` | focus ring | 7.93 / 6.21 / 7.20:1 | 3:1 | pass |

All 39 pairs pass. Grayscale legibility is also checked in the browser (`scripts/verify.mjs`): with `filter: grayscale(1)`, the
weakest relation glyph is still 5.38:1 against its cell, because luminance contrast is unchanged by desaturation.

### Type

| Role | Face | Size / line | Used for |
| --- | --- | --- | --- |
| Display | IBM Plex Serif 500 | 40/44 | Homepage headline only |
| Title | IBM Plex Serif 500 | 26/30 | Plate titles |
| Section | IBM Plex Sans 600 | 17/22 | Sheet headings, set blocks, note headlines |
| Body | IBM Plex Sans 400 | 15/22 | Explanations |
| Caption | IBM Plex Sans 400 | 13/18 | Help, metadata, timeline labels |
| Formal | IBM Plex Mono 400/500 | 16/21 | Grammars, stacks, tapes, tables, sets (and nothing else) |
| Math | IBM Plex Math 400 | 1.3 em | ⋖ ⋗ ≐ and arrows (via `unicode-range`) |

**Exactly two label styles exist:**

1. `.label`: Sans 500, 13 px, sentence case, `--ink-2`.
2. `.tag`: Sans 600, 12 px, bordered, with a glyph, sentence case.

There is no uppercase letter-spaced mono anywhere. ACCEPT/REJECT appear in caps because they are the parser's literal output, set in the
verdict stamp, not as labels.

**Fonts are bundled locally.** Sans, Serif and Mono come from `@fontsource` packages (no install scripts). Plex Math is the unmodified
`IBMPlexMath-Regular.woff2` from IBM's `@ibm/plex-math@1.1.0` tarball, vendored with its OFL. The package itself is not installed because
its postinstall runs `ibmtelemetry`. `tokens.css` references the font as `url('../assets/fonts/…')`, so Vite rewrites it. **The glyphs were verified
with fontTools:** U+22D6 ⋖ (`uni22D6`), U+22D7 ⋗ (`uni22D7`) and U+2250 ≐ (`uni2250`) are all present. If the face fails to load,
`src/ui/glyphs.ts` switches every `<Rel>` to an inline-SVG drawing (`#…?glyphs=svg` forces it for testing).

---

## Layout at 1366×768

There is no permanent sidebar. A 52 px rail holds the chapters. The stage drawer drops from the plate header. The workspace gets the full width.

```
┌─ rail 52px ───────────────────────────────────────────────────────────────────────────────────┐
│ ◧ ParseLens       Bottom-Up   Regex → DFA   Examples                                          │
├─ plate ───────────────────────────────────────────────────────────────────────────────────────┤
│ Plate I.3 · Operator precedence                                                                │
│ Precedence table     Insert one relation at a time…        [Conflict-free]   ‹ [Stage 3 of 5 ▾] › │
├───────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ figure (drafting grid)                                        │ inspector (the ONE scroller)  │
│   ┌──┬──┬──┬──┬──┬──┬──┐                                      │  This step            14 of 30│
│   │╲ │+ │* │( │) │id│$ │                                      │  ( ⋖ +   [+ New]              │
│   ├──┼──┼──┼──┼──┼──┼──┤      loupe ◯ sits on the cell        │  From   5. F → ( E )          │
│   │+ │⋗ │⋖ │⋖ │  │⋖ │  │      being written                   │  Using  LEADING(E) = {…}      │
│   │  …                                                        │  Rule R3  … a B … gives …     │
│   └──┴──┴──┴──┴──┴──┴──┘                                      │  ─────────                    │
│   ⋖ shift  ≐ same handle  ⋗ reduce  □ blank  ▨ conflict       │  Next  ( ⋖ * because …        │
├─ dock (hardware tray) ────────────────────────────────────────┴───────────────────────────────┤
│ [⏮][◀][ ▶ Play ][▶][⏭]  Step 14 of 30   P1 ──── P3 ──▮──── $ rules ────────   (dial)  Next 4 → │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

Per-screen arrangement (all at 1366×768, inspector 400 px, dock 76 px):

| Screen | Controls row | Figure (left) | Inspector (right, scrolls if needed) |
| --- | --- | --- | --- |
| I.1 Grammar | — | Line-numbered editor, help line, **Check grammar** | Result (valid / invalid with fixes / conflict warning), numbered productions, examples |
| I.2 LEADING and TRAILING | — | Productions with the edge symbols marked, rule list, LEADING and TRAILING blocks | This step / Next, member provenance sheet |
| I.3 Precedence table | — | Table + loupe, legend, conflict sentence | Provenance sheet (grows out of the clicked cell), This step / Next |
| I.4 Parse a string | Input, Parse, mode switch, example chips | Bench: stack, relation box, tape, decision with "After" stack | Tabs: Trace (scrolls) / Table lookup (cell outlined) |
| I.5 Classic vs Safeguarded | Grammar S → A + B, string `id/id+id*id`, Compare | Two benches side by side | Why they disagree, where Safeguarded stops, example strings table |
| II LR parsing | — | Honest placeholder: "Nothing on it runs yet", the planned stages each tagged "Not built" | — |
| III.1 Syntax tree | Expression, Build tree | Augmented expression, SVG tree, legend; or the malformed message with a caret | Positions table, examples |
| III.2 nullable / firstpos / lastpos | — | Tree built bottom-up (ghost outlines for nodes not yet computed) | This step: the three values, rule, children read |
| III.3 followpos | — | Tree with this step's followpos arrows | followpos table (rows clickable), provenance, This step |
| III.4 DFA construction | — | SVG DFA (fixed layout, undiscovered parts hidden), transition table | This step (positions, union, result), followpos reference |
| III.5 Simulation | Test string, Run, chips | Input tape, DFA with the current-state ring | This step / readout, transition table with the hit cell |

---

## 3b. Homepage: the Specimen Plate

### 1366×768

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◧ ParseLens      Bottom-Up   Regex → DFA   Examples                                           │
├──────────────────────────────────────┬────────────────────────────────────────────────────────┤
│ Plate I · Operator precedence        │ Live specimen                Running the real algorithm│
│                                      │ ┆E → E + T | T┆  (active production, dashed brass)     │
│ How a compiler decides               │  T → T * F | F                                         │
│ what to do next.          (40px serif)│  F → ( E ) | id                                       │
│                                      │ ┌──┬──┬──┬──┬──┬──┬──┐                                │
│ Build the precedence table for a     │ │╲ │+ │* │( │) │id│$ │   ← relations appear one every │
│ grammar, one relation at a time.     │ │+ │⋗ │⋖ │… │  │  │  │     ~700 ms, with a beam from   │
│ Then watch a parser use it.          │ └──┴──┴──┴──┴──┴──┴──┘     their production            │
│                                      │ id ⋗ +   rule R4               (paused: full sentence) │
│ Operator precedence →  Regex → DFA → │ Parse [id][+][id][*][id][$]   ⋖ … → ✓ ACCEPT           │
│ ┌─────────┬────────────────────────┐ │ [ ❚❚ Pause ][◀][▶]  12 of 40           [Use this grammar]│
│ │Project  │ParseLens: OPP, RE → DFA│ │                                                        │
│ │Team     │Team Compilers          │ │                                                        │
│ │Members  │Harsh Jha 24BCE0568     │ │                                                        │
│ │         │Anuj Deshpande 24BCE0794│ │                                                        │
│ │Year     │2026                    │ │                                                        │
│ └─────────┴────────────────────────┘ │                                                        │
├──────────────────────────────────────┴────────────────────────────────────────────────────────┤
│ I  Operator precedence         │ II LR parsing [In progress]    │ III Regex → DFA                │
│    grammar → table → parse      │    items → table → parse        │     tree → followpos → DFA     │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

DOM order, which is also the Tab order, is **headline block → doors strip → specimen**. CSS grid areas place the specimen top right.
On door hover or focus, the underline under the pipeline moves from the first stage word to the second (Motion `layoutId`, 160 ms, no bounce).

### Narrow (< 900 px)

```
┌──────────────────────────┐
│ ◧ ParseLens  …           │
│ Plate I                  │
│ How a compiler decides   │
│ what to do next.         │
│ sub · links · title block│
├──────────────────────────┤
│ I  Operator precedence   │   doors: a vertical ruled list
│    grammar → table → …   │
├──────────────────────────┤
│ II LR parsing  [In prog] │
├──────────────────────────┤
│ III Regex → DFA          │
├──────────────────────────┤
│ Live specimen            │   specimen under the headline block
│ grammar · table · parse  │   (provenance sheet stacks under the table)
└──────────────────────────┘
```

The page may scroll vertically here (one scrollbar). There is no horizontal scroll, which is verified at 820 and 390 px wide.

### Specimen step-source mapping

| Specimen element | Comes from |
| --- | --- |
| Grammar lines, active production | `parseGrammar(EXPR)` via `analyzeGrammar`; `step.productionId` of the current `ADD_RELATION` |
| Table cells after *k* frames | `tableAt(table.steps, min(k, tableFrames))`, the same selector the real tool uses. `test/specimen.test.ts` asserts it equals `buildPrecedenceTable` cell by cell, and `verify.mjs` checks the rendered DOM against it. |
| Highlight (+ corner brackets) | `ADD_RELATION.left/right`, with `changed` choosing new vs already there |
| Caption, playing | `left relation right` + `rule` |
| Caption, paused | The step's own `message`, verbatim from the core |
| Parse tape, read cell (dashed) | `parseString(…, 'id + id * id', 'safeguarded').steps[k − tableFrames]`: `pointer`, `top`, `lookahead`, `relation` |
| ACCEPT stamp | The final parse step's `type` |
| Loop | Table (700 ms/frame) → parse (900 ms/frame) → hold 2.6 s on ACCEPT → frame 0. Scaled by the speed dial. |
| Pauses when | Play keycap, ← → Home End, focus entering the table, the tab hidden |

States: running, paused (explanation shown), static (reduced motion or no WebGL: finished and accepted, with a **Replay** keycap), failed
(`#/?fault=specimen`: "The specimen couldn't run. Open Examples to load a grammar." The doors still work.)

---

## 4. Motion map

There is one ease for algorithm data, `cubic-bezier(.2,.7,.2,1)`, with no overshoot. **Only a single forward step animates.** Back, seek, phase
jumps, End and Home are instant and cancel anything in flight (`cancelAllFx()`). Effects run *after* React has rendered the step,
use `Element.animate()` with no lasting fill, and draw travelling things in `#fx-layer` (outside the app root). So the DOM at rest
is exactly React's render of `steps[count]`, and `verify.mjs` checks this at every step of every stage, including going Back mid-animation.

| Event | What moves | Duration | At ≥ 2× speed | Reduced motion |
| --- | --- | --- | --- | --- |
| Relation inserted (table and specimen) | A dashed path draws from the source (production or LEADING/TRAILING entry) to the cell and a dot rides it; then the glyph scales in (0.8 → 1) | 300 + 220 ms (glyph starts at 260 ms) | Glyph pop only (220 ms) | Cell already filled, highlighter + brackets |
| Relation found again | Glyph nudges (1 → 1.12 → 1) | 300 ms | same | "Already there" tag |
| Conflict | **Instant**: second glyph, slash, fracture marks, ×2 count, crimson border; provenance of the cell opens | 0 | 0 | same |
| LEADING/TRAILING member enters a set | Path from the production to the member, then the member settles 10 px | 300 + 220 ms | Settle only | Highlighted member |
| Member found again | Nudge | 300 ms | same | Dashed member + "No set change" |
| SHIFT | A copy of the lookahead token flies from the tape to the new stack slot (the real slot stays transparent until it lands) | 260 ms | 150 ms | Highlighted new slot |
| REDUCE | Handle bracket scales in, handle slots pull together 35 %, then the handle collapses into the produced slot | 120 + 260 + 180 ms (staggered, about 420 ms total) | One 150 ms collapse | Bracket + "handle" label, highlighted result |
| ACCEPT / REJECT | **Instant** stamp: double border vs dashed border, glyph, word | 0 | 0 | same |
| Tree node computed | Edges to its children re-draw from child to node, then firstpos, lastpos and "nullable" appear in turn | 200 ms + reveals at 160/250/340 ms | Node pop | All annotations shown |
| followpos update | Followpos arrows re-draw between leaves; a path runs from the node to the followpos row; new members pop | 260 + 320 ms, pops at 280 ms | Pops only | Underlined members + "new" tag |
| DFA edge discovered | The edge re-draws in the highlight colour over itself; a new state gets a settling ring | 260 ms + ring at 220 ms | same | Highlighted edge label + filled state |
| DFA simulation move | A marker travels along the edge taken, then a ring settles on the new current state | 260 ms + ring 350 ms | same | Ring and highlight shown statically |
| Provenance sheet opens | The sheet grows out of the clicked cell (FLIP) | 240 ms | same | Appears |
| Chapter / stage change | View Transition cross-fade; plate title and rail marker morph | 180–240 ms | — | None |
| Keycap press | Face travels 3 px, skirt shadow shrinks; also on the matching key | 120 ms | — | Instant |
| Intro (first visit) | Extruded ⋖ ⋗ ≐ fly onto the table's cells, then cross-fade to the DOM table | 2.25 s flight + 0.25 s hold + 0.28 s fade (< 4 s, hard cap 3.9 s) | — | Not shown |

---

## 5. Build plan, safety nets and scope ladder

### Ordered steps and checkpoints (as executed)

| # | Step | Checkpoint |
| --- | --- | --- |
| 1 | Freeze the core; compare it with the zip | `diff -r` clean; 12 core tests pass |
| 2 | Toolchain: pinned deps, `.npmrc ignore-scripts`, advisory floors, TS strict, typed facade | `npm ci --ignore-scripts`, `npm audit` 0, `tsc` clean |
| 3 | Port the replay layer to TS, keeping its tests | 27 existing tests pass; 4 added (31) |
| 4 | Tokens + contrast checker | 39/39 pairs pass |
| 5 | Shell, hardware, all stages | Screens render with no console errors |
| 6 | Homepage, specimen, intro (3D + CSS) | Specimen test passes; the intro hands off |
| 7 | Motion layer | Back-identity check at every step |
| 8 | Verification loop; fix every failure | `node scripts/verify.mjs` 0 failures at 3 viewports |

### Risks with Plan B and Plan C

| Risk | Trigger | Plan B (switching cost) | Plan C (switching cost) |
| --- | --- | --- | --- |
| WebGL unavailable or context lost on a lab PC | `getContext` returns null; `webglcontextlost`; script fails to load in 1.5 s | **Implemented:** the CSS 3D hand-off (same targets, DOM glyphs, about 1.8 s), then a static specimen with Replay (0, already built) | Skip the intro entirely and show the static specimen (one flag, `?intro=off`) |
| The 3D intro janks on an integrated GPU | The first 12 frames average over 34 ms | **Implemented:** jump straight to the landing frame and hand off | Hard cap at 3.9 s: the overlay is removed whatever the scene is doing (implemented) |
| View Transitions unsupported | `!('startViewTransition' in document)` | **Implemented:** 150 ms Motion opacity fade on the new page | Instant swap (also used under reduced motion) |
| Animation / React-state desync | Any non-forward move; a new `steps[]` bound; reduced motion switched on | **Implemented:** effects only read the DOM React rendered; `cancelAllFx()` runs in `useLayoutEffect` before paint; no inline styles left (WAAPI, no lasting fill) | Turn motion off globally (the reduced-motion path is complete and verified) |
| Cytoscape or SVG layout overlap | `overlaps(layoutDfa(dfa))` non-empty (unit test); a DFA with > 8 states | Ring layout with chords bent toward the centre (implemented, tested at 8 states) | Treat the transition table as canonical: hide the graph behind an "Open graph" toggle (about half a day) |
| Bundle too large | App > 700 KB min (Vite warning limit set there) | Intro already split out; Cytoscape and GSAP removed | Drop the variable sans for static 400/600 (−100 KB of fonts); drop Plex Serif for Plex Sans titles |
| A dependency fails the audit | `npm audit --audit-level=high` non-zero | Pin the patched version, or `overrides` (done for PostCSS ≥ 8.5.23) | Remove the dependency: Motion is replaceable by the WAAPI layer already used for step effects (about 1 day) |
| `dist/index.html` by double-click (`file://` blocks module scripts) | — | **Chosen:** one classic deferred IIFE script (`portableHtml` in `vite.config.ts`) plus a separately built classic `intro.js` injected at runtime. Verified from a renamed nested folder with the network off. | **Also shipped:** `npm run serve` (zero-dependency Node static server) for machines that block `file://` scripts entirely. A single-file build was rejected because it would inline the 555 KB intro into every load. |

### Scope-cut ladder (drop from the top first)

1. Glass refraction on the loupe, falling back to the flat lens (one setting, already a flag)
2. The 3D intro, replaced by the CSS hand-off
3. The CSS hand-off, replaced by the static specimen
4. Provenance FLIP morph (instant sheet)
5. Beams (cause-to-value paths): keep pops only, as at 2× speed
6. Ring/travel in the simulation
7. View Transitions
8. Dark "blueprint" plate (**already cut**: not built)
9. LR parsing (**not in scope**: honest placeholder)

**Minimum viable premium** is rungs 1–7 cut. That leaves the printed plate, the keycap/dial/timeline hardware, the highlighter-and-brackets
step language, conflict fracture marks, the provenance sheets, the specimen homepage, and full keyboard control. All of that works with motion
off, and the verification loop runs it that way in its reduced-motion checks.
