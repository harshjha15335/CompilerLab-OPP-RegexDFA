# ParseLens

**Interactive GUI for Operator Precedence Parsing and RE → DFA (direct method)**
Team Compilers: Harsh Jha (24BCE0568), Anuj Deshpande (24BCE0794) · 2026

A step-by-step teaching instrument. Every screen replays the `steps[]` emitted by a tested algorithm
core (`src/algorithms`, unchanged), one step at a time or all at once. At each step it shows what changed, why,
which rule caused it, and what happens next.

| Chapter | Plates |
| --- | --- |
| I Operator precedence | Grammar check · LEADING and TRAILING · precedence table (with provenance and conflicts) · shift/reduce parse · Classic N vs Safeguarded |
| II LR parsing | Placeholder, honestly labelled *in progress* (nothing on it runs) |
| III Regex → DFA | Syntax tree · nullable/firstpos/lastpos · followpos · DFA construction · simulation |

The homepage is a live specimen: the real algorithm builds the precedence table for `E → E + T | T …` and then
parses `id + id * id`, in a loop. Click any cell to see where its relation came from.

## Run

```bash
npm ci --ignore-scripts   # exact versions from package-lock.json; no install scripts run
npm run dev               # development server
npm test                  # 31 tests: algorithm core, step schema, replay selectors, DFA layout, specimen
npm run typecheck         # TypeScript, strict
npm run check:contrast    # WCAG contrast of every meaning-bearing colour pair
npm run audit:deps        # npm audit, fails on high severity
```

## Build and open offline

```bash
npm run build             # dist/: index.html + assets/ (app script, fonts, and the separate 3D intro script)
```

- **Double-click `dist/index.html`**: it opens from `file://` in Chrome or Edge with no server and no network. The folder
  can be renamed, nested or copied to a USB drive; keep `index.html` and `assets/` together.
- If a machine blocks scripts on `file://` pages, run `npm run serve` (zero-dependency Node server) and open
  `http://127.0.0.1:4173/`.

Navigation uses the URL hash (`#/opp/table`, `#/regex/dfa`, …), so refresh and Back/Forward work everywhere.

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
- a failed homepage acceptance check;
- intro or WebGL-fallback problems;
- network requests, console errors, or `fetch`/`eval`/camera code in the bundle.

The results are in [docs/VERIFICATION.md](docs/VERIFICATION.md). It needs a local Chromium, Chrome or Edge (`CHROME_PATH` overrides).

## Keyboard

| Key | Action |
| --- | --- |
| `←` `→` | previous / next step (the on-screen keycap presses too) |
| `Space` | play / pause |
| `Home` `End` | first step / all at once |
| `Shift` + `←` `→` | previous / next phase marker |
| `[` `]` | slower / faster (the brass dial turns) |
| `Ctrl` + `Enter` | check the grammar (in the editor) |
| `Esc` | close a sheet, skip the intro |

Shortcuts are ignored while you type in a text field. The speed dial and timeline also take arrow keys when focused.

## Design and decisions

- [docs/design/EFFECT-CATALOG.md](docs/design/EFFECT-CATALOG.md): research. 47 effects from the named repositories with a
  verdict each, licenses, and step-state patterns from Python Tutor, VisuAlgo and JFLAP.
- [docs/design/DESIGN.md](docs/design/DESIGN.md): direction, stack decision with measured evidence, tokens with computed
  contrast, wireframes, motion map, risks with Plan B/C, scope ladder.
- [docs/VERIFICATION.md](docs/VERIFICATION.md): verification report with screenshots.
- [docs/AUDIT-LOG.md](docs/AUDIT-LOG.md): what changed and why, including supply-chain notes.

## Architecture

```
src/algorithms/*.js     tested core (plain JS, unchanged): result + steps[]
src/core/               typed facade + step schema types over the core
src/replay/             pipelines (run each algorithm once), selectors (pure folds of steps[]), useReplay
src/motion/fx.ts        one-shot WAAPI effects for a single forward step; cancelled on any other move
src/ui/                 kit (glyphs, tags, verdicts), hardware (keycaps, dial, timeline), plate, loupe
src/screens/            home (specimen, intro), opp (5 plates), regex (5 plates), lr (placeholder)
src/intro/three-intro.ts  the 3D intro, built separately into dist/assets/intro.js
src/styles/             tokens, base, shell, hardware, figures, home, motion
scripts/                verify.mjs, check-contrast.ts, gen-lens-map.mjs, serve-dist.mjs
test/                   partA, partB (core), schema, replay, specimen
```

React never recomputes LEADING/TRAILING, relations, handles, followpos or DFA states: every view is a pure function of
`steps[count]`. Motion only plays for one step forward and leaves no inline styles, so Back is exact.

## Input conventions and limits

- Grammar symbols are separated by spaces (`F -> ( E ) | id`): `id` is one terminal. `|` and `->`/`→` cannot be terminals;
  `$` is reserved. ε-productions and adjacent non-terminals are rejected. Parsing needs a conflict-free table.
- Input strings may omit spaces (`id/id+id*id`); the core splits them by longest match.
- Regex syntax: `|`, concatenation, `*`, `+`, `?`, `( )`, `\` escapes. No ε, classes or ranges. An unescaped `#` is reserved
  (the app adds the end marker). The DFA is partial: a missing transition means reject.
- DFAs with up to 7 states are drawn in a row and larger ones on a ring. The layout test covers automata up to 8 states;
  the transition table is the canonical view.
- Designed for 1280 px wide and up. Below 1000 px the plates stack and the page scrolls. The homepage has a dedicated
  narrow layout (verified at 820 and 390 px).
- Verified in Chromium. Other browsers were not tested.
