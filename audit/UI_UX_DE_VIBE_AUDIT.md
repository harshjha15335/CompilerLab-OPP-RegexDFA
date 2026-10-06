# UI/UX de-vibe audit

Inputs:
- the baseline in [UI_UX_BASELINE.md](UI_UX_BASELINE.md)
- `devibe_scan.py` (pinned `f7c4aef`; raw output in [`scans/devibe-before-src.json`](scans/devibe-before-src.json))
- the Design Harness **audit** at 5 viewports × 12 routes (pinned `9a9e39b`, audit mode only; reports in [`scans/design-harness-before/`](scans/design-harness-before/))
- a screen-by-screen human review of every route at 1440, 1280, 768, 390 and 360 px.

Scanner output is advisory. Every finding below was checked against the real page.

---

## Part A. Design direction for ParseLens

**Product personality.** A precise, patient instrument, like a drafting plate on a lab bench, not a SaaS landing page.
It shows its working: every mark on screen was written by an algorithm step, and it can say which step and why.

**Target user.** Second-year computer science students in a Compiler Design lab, and the examiner watching over their shoulder.
They use lab machines (Chrome, 1280–1920 px) and sometimes a phone to revise.

**Primary task.** Step through an algorithm (precedence table, shift/reduce parse, followpos, DFA), understanding each step before taking the next.

**Information density.** High in the figure (a table or graph fills the plate), low in prose (one sentence per step).
Desktop shows figure and explanation side by side without page scroll. Phones show the figure first, then the explanation, with one page scroll.

**Brand character.** Printed paper, ink, a brass instrument. ParseLens is named after the loupe that magnifies the active table cell.
The serif is the drafting title lettering (plate titles only). Sans is the instrument UI. Mono is anything formal (grammars, sets, stacks).

**Visual references implied by the product** (structural only, nothing copied): engineering drawing title blocks, printed
mathematical tables, lab instrument panels with physical keys and a dial.

**Interaction style.** Discrete steps with physical feedback (keycaps press 3 px in 120 ms). Motion explains a step and never decorates one.
Every state is reachable without motion.

### Spec

| | Decision |
| --- | --- |
| **Background hierarchy** | `--desk` (the bench) → `--plate` (paper, where the work lives) → `--plate-2` (sunken wells: table heads, gutters, docks) |
| **Surfaces** | One plate per screen. Inside it: a figure on a drafting grid and an inspector separated by a rule, **not** a second card. Panels inside a figure (`setblock`, `duo`) are thin printed frames, not shadowed cards |
| **Primary accent** | Ink `#1C1E21` for primary actions (one primary button per screen). Brass `--brass-lo` is the brand accent (wordmark, loupe, dial, "read" outlines) |
| **Semantic colours** | ⋖ blue, ⋗ sienna, ≐ green, always with a distinct glyph. Highlighter yellow plus corner brackets = written by this step. Dashed brass = read by this step. Crimson plus fracture marks = conflict. Double green border = ACCEPT. Dashed red = REJECT |
| **Borders** | `--line` (≥ 3:1) only where a border carries meaning (cells, tokens, fields). `--rule` for decorative separators |
| **Muted states** | `--ink-2` secondary, `--ink-3` captions (both ≥ 4.5:1 on every surface they sit on) |
| **Display / headings** | Plex Serif 500: 40 px homepage headline (one per site), 26 px plate titles. Nowhere else |
| **Body / labels** | Plex Sans: 15/22 body, 17/22 section titles, 13 px labels and captions. Two label styles only (`.label`, `.tag`) |
| **Numbers / data** | Tabular numerals globally. Step counters in mono |
| **Code** | Plex Mono for grammars, sets, stacks, tables. Plex Math only for ⋖ ⋗ ≐ → |
| **Spacing** | 4 / 8 / 12 / 16 / 24 / 32 (`--s1…--s6`). Page gutter 16 px on every screen and at every size |
| **Radius** | Two steps. `--r-mark` 3 px: printed things (cells, tokens, tags, chips, panels inside figures). `--radius` 6 px: controls and floating things (buttons, fields, segmented controls, menus, sheets). Circles and the rounded non-terminal slot are shapes with meaning. **No pills** |
| **Shadows** | `--shadow-paper` for the one plate lying on the desk. `--shadow-float` only for things that float (drawer, sheets). The keycap and dial bevels are the only hardware shading |
| **Motion** | 120–200 ms, `cubic-bezier(.2,.7,.2,1)`. **Allowed:** keycap press, a single step's write/read/handle effects, menu and sheet entrance, the once-per-visitor intro. **Forbidden:** fade-in on scroll or on load, hover scale, hover rotation, motion on a backwards step or scrub, anything under `prefers-reduced-motion` |
| **Component principles** | One plate, few containers. Hierarchy comes from type and rules, not boxes. One primary action per screen. Tags only for state (New, Conflict, ACCEPT/REJECT, Planned). Planned features look planned, never equal to working ones. Every control is the same height family (32–40 px), with targets of at least 24 px |

---

## Part B. Automated scanner findings and judgment

### `devibe_scan.py src` (before): 3 findings, 0 high, vibe score 6

| # | Rule | Location | Judgment | Reason |
| --- | --- | --- | --- | --- |
| S1 | fade-in animation | `src/ui/plate.tsx:57` (stage drawer: opacity + 6 px, 160 ms) | **Intentional design choice** | A menu entrance at 160 ms, exit symmetric, cancelled under reduced motion. The brief explicitly allows "menus: fast opacity/translate". Not a page-load fade |
| S2 | fade-in animation | `src/shell/Shell.tsx:75` (Examples sheet backdrop, 160 ms) | **Intentional design choice** | Modal backdrop entrance. Same reasoning |
| S3 | neon glow (`text-shadow`) | `src/styles/home.css:86` (`.intro__glyph`) | **False positive** | A stepped dark offset (1–4 px, no blur) that fakes extrusion depth for the CSS fallback intro's glyphs. It is not a glow, and dark brown on paper cannot read as neon |
| S4 | *(not flagged, checked by hand)* "cream + serif tasteful default" | `--plate #FAF8F2`, Plex Serif headline | **Needs human design judgment → keep** | The paper colour and serif are the product's drafting-plate identity, documented in `docs/design/DESIGN.md` since the first design phase. The serif is restricted to two roles (headline, plate titles). The risk is the *homepage hero template* around them, which is fixed in P1-2 |

### Design Harness audit (before): 12 routes × 5 viewports

| # | Finding | Routes | Judgment | Action |
| --- | --- | --- | --- | --- |
| H1 | `visual.text-clipping` on `caption`, `th > span`, `span > span` with a 1×1 px region | home, table, parse, follow, DFA, sim | **False positive** | All are `.sr-only` text (table captions, the corner header's description, ", start state" suffixes). Clipping is how screen-reader-only text works |
| H2 | `a11y.text-contrast` 1.16:1, `--ink-3` on `--brass-lo` | sets, table, parse, modes, follow, DFA | **False positive in pixels, real structural issue** | The timeline tick labels are DOM children of a 1 px brass tick bar, so computed background = brass. Painted, they sit on the dock (≥ 4.5:1). Fixed anyway by making the label a sibling of the tick (P3-2) so the DOM matches what is drawn |
| H3 | `a11y.text-contrast` 1.00:1 on the active "Safeguarded" option | parse | **False positive** | Text is plate-on-ink. The ink comes from an animated sibling layer (`.modes__rule`) that the tool cannot see |
| H4 | `a11y.target-size.minimum`: 20×21 px trace step buttons | parse | **True positive** | P2-6 |
| H5 | `hierarchy.heading-structure`: h1 → h3 | sets, modes | **True positive** | P2-5 |
| H6 | `responsive.fixed-width`: intro caption 438 px wide at 360/390 | home | **True positive** | P0-2 |
| H7 | `responsive.sticky-obstruction`: fixed full-viewport element | home | **Intentional** | The first-visit intro overlay, with a Skip button and Esc. It is shown once and never again |

### VibeCheck

**Not run.** At the pinned commit `45d8695`, its HTTP analyzer resolves the target host and rejects any address that is
private or loopback (`analyzer.py:207-230`), so it cannot analyze the local build. Its own comment at `analyzer.py:680`
confirms the Playwright fallback does not re-check redirects. Running it would mean weakening the SSRF guard or
pointing it at a production URL. The brief forbids both, so it was left out, as the brief allows.

---

## Part C. Findings by priority

### P0: broken

**P0-1. Chapter pages overflow sideways on tablet and phone**
- **Page:** every chapter route (`#/opp/*`, `#/regex/*`, `#/lr`) at 768, 390 and 360 px.
- **Component:** `.app` grid, `.main`, `.plate`, figure contents, controls row, dock.
- **Current issue:** 91 sideways-scroll failures (21 at 768, 35 at 390, 35 at 360). The single-column grid sizes to its widest child (precedence table, chips row, dock), so the whole page widens. The top bar and stage switcher are pushed off-screen, and figure text is cut at the right edge.
- **Why amateur:** "desktop app squeezed onto a phone" is the most common sign that nobody opened the product on a phone.
- **Severity:** P0.
- **Proposed fix:** `minmax(0, 1fr)` columns on `.app` and `.main`, and `min-width: 0` on the plate. A real phone layout below 640 px:
  - top bar on two rows
  - plate header in one column
  - fields and chips full width
  - figure panels stacked (LEADING/TRAILING, Classic/Safeguarded)
  - precedence table cells sized from the viewport width
  - figures scroll sideways inside themselves only when a grammar truly has more columns than fit
  - the dock rearranged into two rows (keys + readout, then the timeline at full width, then dial + Next)
- **Expected improvement:** 0 sideways page scroll at all five sizes, and every control reachable.
- **Implementation risk:** medium. CSS only, inside the existing `max-width: 999px` query plus a new 640 px query. The desktop layout is untouched.

**P0-2. Two scrollbars at once on narrow screens**
- **Page:** all chapter routes at ≤ 999 px.
- **Component:** `.inspector`, `.pane--scroll`, `.scroll` (trace), `.lookup`.
- **Current issue:** the page scrolls (by design below 1000 px), and the inspector and trace still scroll inside it.
- **Why amateur:** nested scroll traps on touch devices.
- **Severity:** P0.
- **Proposed fix:** below 1000 px, inner regions become `overflow: visible`, so only the page scrolls. The verifier's rule becomes "no page scroll at ≥ 1000 px; exactly one scroller below".
- **Expected improvement:** one scroll surface on phones.
- **Implementation risk:** low.

**P0-3. Intro caption runs off both edges on phones; the intro flies glyphs to a target below the fold**
- **Page:** `#/`, first visit, at 390 and 360 px.
- **Component:** `.intro__caption` (`white-space: nowrap`), `Intro`.
- **Current issue:** the caption is 438 px wide on a 360 px screen. On phones the specimen (the intro's landing target) sits below the doors, off-screen, so the flight lands nowhere visible.
- **Why amateur:** a desktop "wow" moment shipped unchanged to mobile.
- **Severity:** P0.
- **Proposed fix:** below 900 px, skip the 3D intro and show the finished static specimen with Replay (the reduced-motion path). The caption wraps with a max width at every size.
- **Expected improvement:** no overflow, and no animation pointing at nothing.
- **Implementation risk:** low (one condition in `Home.tsx`).

**P0-4. Stage drawer overlapped table cells at 768 px**
- **Page:** `#/opp/table` at 768 px.
- **Component:** `.drawer`.
- **Current issue:** the drawer (80vw, anchored right) overlapped the precedence table's buttons, and the verifier counted interactive overlap.
- **Why amateur:** unanchored menu.
- **Severity:** P0 (interactive overlap).
- **Proposed fix:** on narrow screens the drawer spans the plate header width and sits above the table with `--shadow-float`. Re-verify.
- **Implementation risk:** low.

### P1: strong vibe-coded tells

**P1-1. Homepage hero template: eyebrow, big serif headline, sub-heading, two CTA links**
- **Page:** `#/`.
- **Component:** `.home__lead`.
- **Current issue:** "Plate I · Operator precedence" eyebrow, then the 40 px headline, then a sub-heading, then two arrow links ("Operator precedence →", "Regex → DFA →"). The doors strip 300 px below opens the same two chapters, and so does the top bar: three routes to one place.
- **Why vibe-coded:** eyebrow + headline + sub + two CTAs is the stock AI hero skeleton. The duplicated CTAs show no one decided what the entry point is.
- **Severity:** P1.
- **Proposed fix:** remove the eyebrow and the two links. The headline + one sentence + the project title block form the lead, and the **doors are the single entry**. The specimen keeps its own "Use this grammar" primary action.
- **Expected improvement:** one clear path per destination. The lead reads as a plate title block, not a landing hero.
- **Implementation risk:** low. The verifier's Tab-order check (headline → doors → specimen) is updated, since the headline now has no tab stops.

**P1-2. A placeholder chapter presented as an equal third of the product**
- **Page:** `#/` doors strip.
- **Component:** `Door` for LR.
- **Current issue:** "II LR parsing [In progress]" has the same weight, size and hover as the two working chapters. It is the "perfect symmetry, 3 identical items" pattern, padded with a stub.
- **Why vibe-coded:** symmetric three-up layouts filled out regardless of content importance.
- **Severity:** P1.
- **Proposed fix:** keep the numbering (it is the course order) but render the LR door as *planned*: muted ink, a dotted rule, a "Planned" tag, and no hover fill. Give the two working doors 1.4× the width.
- **Expected improvement:** hierarchy matches reality.
- **Implementation risk:** low.

**P1-3. Decorative hover rotation on the logo**
- **Page:** all.
- **Component:** `.rail__brand:hover .logo` (rotates 8°).
- **Why vibe-coded:** hover motion that communicates nothing.
- **Severity:** P1 (small, but exactly the "hover effect everywhere" tell).
- **Proposed fix:** remove it. The logo itself stays, as requested by the team.
- **Implementation risk:** none.

### P2: professional polish

**P2-1. Radius scale had eight values**
- **Page / component:** global (`2/3/4/6/8/12/16 px`).
- **Current issue:** pill test-string chips (16 px) next to 6 px buttons and 3 px tokens.
- **Why amateur:** radius chosen per component, not by role.
- **Proposed fix:** two tokens, `--r-mark` 3 px and `--radius` 6 px, applied by role (Part A). Chips become 3 px tokens, matching the tape cells they produce. Nested segment indicators use `--radius − inset`.
- **Expected improvement:** one shape language.
- **Implementation risk:** low.

**P2-2. Shadows defined ad hoc**
- **Page / component:** plate, drawer, sheets, examples.
- **Proposed fix:** `--shadow-paper` and `--shadow-float` tokens. Flat panels inside figures lose their shadow.
- **Implementation risk:** low.

**P2-3. Page gutters don't line up**
- **Page / component:** rail (16 px), chapter plates (14 px), homepage lead (44 px), homepage doors (32 px).
- **Why amateur:** four left edges on one page.
- **Proposed fix:** one `--gutter: 16px`. Rail, plate and homepage content all start on it.
- **Implementation risk:** low.

**P2-4. Precedence table leaves 60% of the figure empty at 1440 × 900**
- **Page / component:** `#/opp/table`, `.ptable-wrap`.
- **Current issue:** cell size depended only on viewport height, capped at 54 px. On a wide screen the table sits top-left with a large empty grid beside and below it.
- **Proposed fix:** size cells from both the figure's width (container query units) and the viewport height, cap at 64 px, and centre the table and legend in the figure.
- **Expected improvement:** the figure is the hero of the plate, as the direction says.
- **Implementation risk:** medium (the loupe and the effects use `--cell`). Covered by the overlap and clipping checks plus the forward/Back DOM identity check.

**P2-5. Heading levels skip h1 → h3**
- **Page / component:** sets (`ProductionList`, `setblock`), modes and parse (`Bench`).
- **Proposed fix:** the regions directly under a plate title use h2.
- **Implementation risk:** none (classes unchanged).

**P2-6. Trace step buttons 20×21 px (below the WCAG 2.2 AA 24 px target)**
- **Page / component:** `#/opp/parse`, `.trace__jump`.
- **Proposed fix:** a minimum 24×24 px hit area.
- **Implementation risk:** low.

**P2-7. Homepage specimen box stretched with 150 px of empty grid below its controls (1440 × 900)**
- **Page / component:** `.home__specimen`.
- **Proposed fix:** the box hugs its content and centres vertically against the lead.
- **Implementation risk:** low.

**P2-8. Wrapped tape and stack rows on phones: the "lookahead" and "top terminal" marks collide with the row above**
- **Page / component:** `#/opp/parse` and `#/opp/modes` at 360 and 390 px, `.tape` and `.stackrow`.
- **Proposed fix:** a row gap equal to the mark height.
- **Implementation risk:** low.

**P2-9. Token-file header comment corrupted by the rename ("ParseLensoratory Plate")**
- **Page / component:** `tokens.css` line 1.
- **Proposed fix:** fix the text.
- **Implementation risk:** none.

### P3: optional polish

**P3-1. Keycap and dock gradients use raw hex values**
- **Page / component:** `hardware.css`.
- **Judgment:** kept. They are hardware shading local to one component file, with no repetition across files. Tokenizing them would add names without adding consistency.

**P3-2. Timeline tick label is a DOM child of the 1 px tick bar**
- **Page / component:** `hardware.tsx`.
- **Proposed fix:** render the label as a sibling, so assistive tooling and contrast tools see the real background (H2).
- **Implementation risk:** low (the label placement logic is unchanged).

**Considered and rejected:**
- **Removing the 3D intro:** it runs once per visitor, can be skipped by Esc or button, is off under reduced motion, and (after P0-3) is off on phones. It was a brief requirement and lands its glyphs in the real table, so it shows the product rather than decorating it.
- **Removing the glass loupe:** it is the product's namesake and shows the active cell's row and column context.
- **Changing the palette or fonts to satisfy the "cream + serif" heuristic:** see S4.
