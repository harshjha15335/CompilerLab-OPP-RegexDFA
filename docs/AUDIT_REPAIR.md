# Audit repair (October 2026)

A read-only audit of `4152567` found **0 P0/P1, 7 P2 and 28 P3 defects**, plus one missing item (M-01). This change set repairs them without rebuilding the app. The full reports, with before/after evidence from every tool, live outside the repository in `COMPILER_LAB_IMPROVEMENT/`; this page is the in-repo summary.

## What changed for a user

- **Results never pretend to be current.**
  - An edited string shows "Not run yet" and names the string the results belong to.
  - An unchecked grammar or regex shows "Out of date" on later stages, with "Check grammar now" / "Build tree now".
  - Changing the reduction mode re-runs the submitted string, never the draft.
- **No silent data loss.**
  - Loading a sample over unchecked edits asks first, in a native `<dialog>` (Cancel is focused; Escape cancels; focus returns).
  - The user's own grammar stays available as "Your grammar".
- **Nothing is checked for the user.** Stage 1 shows no result until **Check grammar** is pressed; loading an example only fills the editor; stages 2–4 ask for the check first (picking a grammar in their header menu checks it). The same holds for regular expressions: nothing is built until **Build tree**, and regex stages 2–5 wait for it. Coming back to stage 1 always starts unchecked, so a grammar can be checked again and again; stages 2–4 keep the last check.
- **Inputs survive a refresh** (sessionStorage, for the tab).
- **Stage 1 → stage 5** hands over the checked grammar plus a sentence it derives, never its terminal list.
- **The homepage specimen** pauses and resumes correctly with Space.
- **Large DFAs:**
  - a layered layout with routed edges and collision-free labels;
  - zoom, pan, Fit and Reset (buttons, Ctrl/⌘ + wheel, drag, keyboard);
  - opens at a readable scale and follows the current state;
  - shows the transition table above 120 states;
  - stops construction with an explanation above 500 states.
- **Input limits with plain messages:** regex of at most 400 characters and 100 nesting levels. Positions count characters (code points), so 😀 is one symbol.
- **Copy:**
  - counted conflict wording;
  - no shouted verdict;
  - "At the end of the expression";
  - grammar notes for no terminals, unreachable or non-productive symbols;
  - stage 5 named "Classic N vs Safeguarded";
  - a stage 5 note on the method's limits.
- **Accessibility:**
  - a real disabled button for the end stage arrows;
  - native text or roles instead of ignored `aria-label`s;
  - an accessible DFA summary of only what is drawn;
  - AA contrast for the waiting block and placeholders;
  - focusable scroll regions;
  - 44 px targets on phones.
- **Layout:**
  - 1000–1199 px windows under 860 px tall scroll instead of clipping;
  - phones fit at 320 px;
  - scroll shades on inner scrollers;
  - opaque trace header;
  - transform-only keycap press;
  - every step animation ≤ 700 ms.
- **Design tokens:** roles for typography, semantic colour, elevation and control padding (`src/styles/tokens.css`).

## What did not change

- **Algorithm outputs.** A differential run of the pre-repair core against the repaired core found **0 differences**:
  - 3,524 regexes;
  - 60,780 simulations;
  - 408 grammars;
  - 12,090 Classic/Safeguarded parses.
  All pre-existing tests pass unmodified.
- **Dependencies:** none added.
- **Offline delivery:** `dist/index.html` still opens from `file://`, with zero network requests.
- **One bundle.** Code splitting would emit ES-module chunks that Chrome blocks on `file://`. Lighthouse mobile performance therefore stays at 86–87 (desktop 100), measured over a simulated slow-4G link that the double-click delivery never uses.

## Tests

- `test/repair.test.ts`: 11 tests covering D-05, D-08 to D-14, D-25, D-26 and D-35. `npm test` runs 53 tests.
- `scripts/verify.mjs --only=repair`: 16 browser checks covering D-01 to D-35. The full verifier and a 9-viewport matrix (320 px to 1920 px, plus 200% zoom) pass; see [verification-results.md](verification-results.md).
