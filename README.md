# Compiler Lab

**Interactive GUI for Operator Precedence Parsing and Conversion of Regular Expression to DFA using the Direct Method**

A step-by-step teaching instrument for two Compiler Design topics:

1. **Operator precedence parsing** — grammar validation, LEADING / TRAILING, the precedence relation
   table, shift/reduce parsing with visible handles, and Classic N vs Safeguarded reduction.
2. **Regular expression → DFA (direct method)** — syntax tree, nullable / firstpos / lastpos,
   followpos, DFA construction, and test-string simulation.

Every stage is a replay of the `steps[]` emitted by a tested algorithm core. At each step the
screen answers: what changed, why, which rule caused it, and what happens next.

## Run

```bash
npm install
npm run dev        # development server (prints the local URL)
npm test           # algorithm, step-schema and replay tests (node:test)
```

## Build the submission

```bash
npm run build      # output: dist/
```

`dist/` is self-contained (one HTML file, one script, bundled Inter and JetBrains Mono fonts; no CDN, no network).
Supported ways to launch it:

- **Double-click `dist/index.html`** — opens from `file://` in Chrome or Edge. The folder can be
  renamed, nested or copied to a USB drive; keep `index.html` and `assets/` together.
- `npm run serve` — serves `dist/` at `http://127.0.0.1:4173/` with a zero-dependency Node script.
- `npm run preview` — Vite's preview server.

Navigation uses the URL hash (`#/opp/table`, `#/regex/dfa`, …), so refresh and browser
Back/Forward work in all three cases.

### Offline audit (optional)

```bash
npm run build
npm run audit:offline
```

Copies `dist/` into a renamed, nested temp folder, opens it from `file://` in headless Chrome/Edge
with the network disabled, and drives the real UI through 106 checks (fixtures, keyboard, Back
restoring state, navigation, refresh, no outgoing requests). It also regenerates the screenshots in
`docs/screenshots/`. Needs a local Chrome or Edge (`CHROME_PATH` overrides the location).

## Interface

- **Top bar:** the three workspaces (Operator Precedence, LR Parsing, Regex → DFA), a shortcuts list,
  a reduced-motion switch and a light/dark theme switch.
- **Stage stepper:** each workspace is a numbered pipeline; the current stage is marked.
- **Workspace:** the figure on the left, the explanation for the current step on the right.
- **Playback dock:** step, play, scrub, change speed, then continue to the next stage.

Two signals are used everywhere. A **yellow fill** marks what the current step changed. A **blue
outline** marks what the step read or compared. Relations, accepting states, handles and conflicts
also carry a glyph, shape or label, so nothing depends on colour alone.

## Motion and the 3D inspector

Motion is an overlay on the replay, never part of it. Effects in `src/motion/effects.js` run after
React has rendered a step, and only when the replay moved forward by exactly one step. Jumping,
scrubbing and stepping Back show the state at once. With **Reduced motion** on, nothing travels and
every highlight, bracket and label is still there. At 2× speed and above the long paths are skipped.

| Event | What moves |
| --- | --- |
| New set member | drops in from a short distance; a duplicate is only emphasised |
| New relation | a path runs from the source set or production to the cell, then the glyph appears |
| Conflict | second glyph joins the first, fracture marks draw, provenance opens |
| SHIFT | the lookahead token travels from the input tape onto the stack |
| REDUCE | bracket draws, the handle pulls together and collapses into its replacement |
| Tree node computed | edges draw up to the node, then nullable, firstpos, lastpos appear in turn |
| followpos update | a marker rides a path from the tree node to the table row |
| DFA transition | construction: edge then state fade in; simulation: a marker rides the edge |

The DFA stages have a **2D / 3D inspector** switch. 3D (three.js via React Three Fiber) draws the
same automaton and layout with a small depth offset per state. It renders only when something
changes and is unmounted while 2D is selected. 2D and the transition table remain the reference.

## Architecture

```
src/algorithms/*.js      plain JavaScript, no UI: result + steps[]
        ↓
src/replay/pipelines.js  runs each algorithm once per input
src/replay/selectors.js  pure folds: state visible after N steps
src/replay/useReplay.js  { steps, count, playing, speed } + keyboard
        ↓
src/components/*         render only (React, hand-written SVG, Cytoscape)
```

React never recomputes LEADING/TRAILING, relations, handles, followpos or DFA states. Moving Back
re-derives the previous view from the same steps, so it is always exact.

| Path | Purpose |
| --- | --- |
| `src/algorithms/` | Tested algorithm core (unchanged) |
| `src/replay/` | Pipelines, selectors, replay hook |
| `src/motion/` | Step effects (paths, flights), diagram board |
| `src/components/StepPlayer/` | Shared playback dock and timeline |
| `src/components/GrammarEditor/` | 1.1 grammar editor, validation, samples |
| `src/components/LeadingTrailing/` | 1.2 set derivation replay |
| `src/components/PrecedenceTable/` | 1.3 relation table, conflicts, provenance |
| `src/components/ParseBench/` | 1.4 stack bench / tape / trace, 1.5 mode comparison |
| `src/components/SyntaxTree/` | Hand-written SVG syntax tree |
| `src/components/FollowposTable/`, `DFATable/`, `DFAGraph/`, `SimulationTape/` | Part B views |
| `src/pages/` | Page composition and per-part state |
| `src/data/` | Sample library and navigation |
| `src/styles/` | Design tokens, base, layout, components |
| `test/` | `partA`, `partB` (core), `schema` (step contract), `replay` (selectors) |
| `scripts/` | `serve-dist.mjs`, `audit-build.mjs` |

## Keyboard

| Key | Action |
| --- | --- |
| `←` / `→` | previous / next step |
| `Space` | play / pause |
| `Home` / `End` | first / final step |
| `[` / `]` | slower / faster |
| `Shift` + `←` / `→` | previous / next phase marker |
| `Ctrl` + `Enter` | validate grammar (in the editor) |

Shortcuts are ignored while typing in a text field.

## Input conventions and known limitations

- Grammar symbols are **separated by spaces** (`F -> ( E ) | id`); `id` is one terminal.
- `|` separates alternatives and `->`/`→` separates the two sides, so neither can be a grammar terminal.
  `$` is reserved as the parser's end marker.
- ε-productions and adjacent non-terminals are rejected: the grammar must be an operator grammar.
- Parsing is only offered for a conflict-free table.
- Regex syntax: `|`, concatenation, `*`, `+`, `?`, `( )`, `\` escapes. No ε, character classes or
  ranges. Unescaped `#` is reserved for augmentation (the app adds it); `$` is an ordinary character there.
- The DFA is partial: a missing transition means reject (no explicit dead state is drawn).
- DFAs with up to 5 states are drawn in a row; larger ones on an ellipse where edges may cross and
  long position sets can overflow their circle. Use **Enlarge graph**; the transition table stays canonical.
- Designed for 1366 px wide and above; below about 1000 px the page scrolls horizontally.
- LR parsing is a placeholder page only.
- The 3D inspector needs WebGL; without it a message points back to the 2D graph. The 3D libraries
  make the bundle about 1.9 MB.
- `file://` launch is verified in Chrome and Edge (Chromium); other browsers were not tested.
