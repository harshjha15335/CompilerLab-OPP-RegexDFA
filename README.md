# ParseLens

**Interactive GUI for Operator Precedence Parsing and RE → DFA (direct method)**
Team Compilers: Harsh Jha (24BCE0568), Anuj Deshpande (24BCE0794) · 2026

A step-by-step teaching instrument. Every screen replays the `steps[]` emitted by a tested algorithm
core (`src/algorithms`), one step at a time or all at once. At each step it shows what changed, why,
which rule caused it, and what happens next.

| Chapter | Plates |
| --- | --- |
| I Operator precedence | Grammar check · LEADING and TRAILING · precedence table (with provenance and conflicts) · shift/reduce parse · Classic N vs Safeguarded |
| II LR parsing | Placeholder, honestly labelled *Planned* (nothing on it runs) |
| III Regex → DFA | Syntax tree · nullable/firstpos/lastpos · followpos · DFA construction · simulation |

The homepage shows the project title block, the three chapters and a live specimen: the real algorithm builds the
precedence table for `E → E + T | T …` and then parses `id + id * id`, in a loop. Click any cell (on the homepage or on
stage 3) to see which rule and which production put its relation there.

The Review-1 audit ([audit/REVIEW1_REMOVE_AND_VERIFY.md](audit/REVIEW1_REMOVE_AND_VERIFY.md)) removed decorative features:
the 3D intro, loupe, View Transitions, Examples sheet, the motion library, the speed dial and the IBM Plex Math font
(the homepage specimen was removed and then restored at the team's request). It also fixed nine logic bugs in the core, each with a regression test.

## Run

```bash
npm ci --ignore-scripts   # exact versions from package-lock.json; no install scripts run
npm run dev               # development server
npm test                  # 42 tests: algorithm core, audit regressions, step schema, replay selectors, DFA layout, specimen
npm run typecheck         # TypeScript, strict
npm run check:contrast    # WCAG contrast of every meaning-bearing colour pair
npm run audit:deps        # npm audit, fails on high severity
```

## Build and open offline

```bash
npm run build             # dist/: index.html + assets/ (one app script, five Latin font files; about 0.52 MB)
```

- **Double-click `dist/index.html`**: it opens from `file://` in Chrome or Edge with no server and no network. The folder
  can be renamed, nested or copied to a USB drive; keep `index.html` and `assets/` together.
- If a machine blocks scripts on `file://` pages, run `npm run serve` (zero-dependency Node server) and open
  `http://127.0.0.1:4173/`.

Navigation uses the URL hash (`#/opp/table`, `#/regex/dfa`, …), so refresh and Back/Forward work everywhere. The
grammar, regex and input strings (checked and unchecked) are kept in `sessionStorage` for the tab, so a refresh keeps
them; closing the tab starts fresh. A grammar is only analysed once you press **Check grammar** (or pick one from
the grammar menu on stages 2–4): loading an example just fills the editor, and stages 2–4 wait for the check. If storage is blocked the app still works and simply starts from the examples.

## Verify

```bash
npm run build && node scripts/verify.mjs            # full loop, about 12 minutes
node scripts/verify.mjs --quick                     # one viewport
node scripts/verify.mjs --only=replay,keyboard      # some groups only
node scripts/verify.mjs --publish                   # also refresh docs/screenshots/
```

The script copies `dist/` into a renamed nested folder and opens it from `file://` with the network off. It
screenshots every screen and mode at 1366×768, 1280×720 and 1920×1080, and fails on:

- clipped text, overlapping interactive elements, more than one vertical scrollbar, or any horizontal scroll;
- either keyboard-only demo not completing;
- the DOM differing after forward-then-Back, at any step of any stage (including mid-animation);
- motion running under reduced motion;
- a grayscale contrast problem;
- frame drops at 4× CPU throttling;
- a failed homepage check, or the app needing WebGL;
- network requests, console errors, or `fetch`/`eval`/camera code in the bundle.

The results are in [docs/verification-results.md](docs/verification-results.md) ([docs/VERIFICATION.md](docs/VERIFICATION.md) is the historical first report). It needs a local Chromium, Chrome or Edge (`CHROME_PATH` overrides).

## Keyboard

| Key | Action |
| --- | --- |
| `←` `→` | previous / next step (the on-screen keycap presses too) |
| `Space` | play / pause |
| `Home` `End` | first step / all at once |
| `Shift` + `←` `→` | previous / next phase marker |
| `PageUp` `PageDown` | previous / next stage |
| `Ctrl` + `Enter` | check the grammar (in the editor) |
| `Esc` | close the stage list or a provenance sheet |

Shortcuts are ignored while you type in a text field. The timeline also takes arrow keys when focused.
On stages 2–4 of Operator precedence, the **Grammar** menu in the plate header loads any sample grammar without
going back to stage 1.

## Design and decisions

- [docs/design/EFFECT-CATALOG.md](docs/design/EFFECT-CATALOG.md): research. 47 effects from the named repositories with a
  verdict each, licenses, and step-state patterns from Python Tutor, VisuAlgo and JFLAP.
- [docs/design/DESIGN.md](docs/design/DESIGN.md): direction, stack decision with measured evidence, tokens with computed
  contrast, wireframes, motion map, risks with Plan B/C, scope ladder.
- [audit/REVIEW1_REMOVE_AND_VERIFY.md](audit/REVIEW1_REMOVE_AND_VERIFY.md): Review-1 audit: ground truth from the notes,
  logic findings, UI results, removal inventory and a viva sheet.
- [docs/AUDIT_REPAIR.md](docs/AUDIT_REPAIR.md): the October 2026 audit repair (35 defects): what changed, what did not, and how it is tested.
- [docs/verification-results.md](docs/verification-results.md): every check from the latest verifier run.
- [docs/VERIFICATION.md](docs/VERIFICATION.md): the original verification report (before Review-1).
- [docs/AUDIT-LOG.md](docs/AUDIT-LOG.md): what changed and why, including supply-chain notes.

## Architecture

```
src/algorithms/*.js     tested core (plain JS): result + steps[]
src/core/               typed facade + step schema types over the core
src/replay/             pipelines (run each algorithm once), selectors (pure folds of steps[]), useReplay
src/motion/fx.ts        one-shot WAAPI effects for a single forward step; cancelled on any other move
src/ui/                 kit (SVG relation glyphs, tags, verdicts), hardware (keycaps, timeline), plate
src/screens/            home, opp (5 plates), regex (5 plates), lr (placeholder)
src/styles/             tokens, base, shell, hardware, figures, home, motion
scripts/                verify.mjs, report-md.mjs, check-contrast.ts, serve-dist.mjs
test/                   partA, partB (core), audit-regressions, schema, replay, specimen, repair (audit defects D-xx)
audit/review1/          Review-1 probes (fuzz, differential, UI) and their outputs
```

React never recomputes LEADING/TRAILING, relations, handles, followpos or DFA states: every view is a pure function of
`steps[count]`. Motion only plays for one step forward and leaves no inline styles, so Back is exact.

## Input conventions and limits

- Grammar symbols are separated by spaces (`F -> ( E ) | id`): `id` is one terminal. `|` and `->`/`→` cannot be terminals;
  `$` is reserved. ε-productions and adjacent non-terminals are rejected. Parsing needs a conflict-free table.
- Input strings may omit spaces (`id/id+id*id`); the core splits them by longest match.
- Regex syntax: `|`, concatenation, `*`, `+`, `?`, `( )`, `\` escapes. No ε, classes or ranges. An unescaped `#` is reserved
  (the app adds the end marker). The DFA is partial: a missing transition means reject.
- DFAs with up to 7 states are drawn in a row; larger ones in layered columns (breadth-first from the start state), with
  every edge routed around the states and every label placed where it collides with nothing. Zoom (buttons, Ctrl + wheel,
  + and −), pan (drag, or arrow keys when the drawing has focus), Fit and Reset are on the graph; a graph that would be
  shrunk below legibility opens at a readable scale on its start state. The layout tests cover up to 64 states with no
  overlap and no edge through a state. Above 120 states the transition table replaces the drawing.
- Limits, each with a plain message instead of a freeze or a crash: a regex of at most 400 characters and 100 levels of
  parentheses, and a DFA of at most 500 states (the direct method can grow exponentially). Positions and the simulation
  count characters (Unicode code points), so `😀` is one symbol.
- Grammar symbols may also be typed without spaces (`E->E+T`): a chunk is split around the non-terminals the grammar defines.
- Designed for 1280 px wide and up. Below 1000 px or 720 px tall the plates stack and the page scrolls
  (verified at 768, 390 and 360 px wide and at 1265×590).
- Verified in Chromium. Other browsers were not tested.
