# Review-1: remove-and-verify audit

Branch `claude/practical-johnson-s2bqni`. The audit started at `5121d44` and ends at the commit that adds this file.
Every claim links to a command output in [`review1/output/`](review1/output/). The probes that produced those outputs are in
[`review1/probes/`](review1/probes/), and each can be re-run with `node audit/review1/probes/<file>` from the repository root.
Anything not run is marked **UNVERIFIED**.

## 1. Verdict

1. **Demo-ready for Part A (A1–A6) and Part B.**
   - Every fixture derived from the notes passes: OPP 17/17, Classic/Safeguarded 8/8, direct method 17/17.
   - The direct-method DFAs had 0 mismatches against JS `RegExp` and an independent Thompson NFA (50,000 strings).
   - Final verifier run: 622/0. Unit tests: 39/39.
2. **Nine real bugs were found and fixed in the core**, each with a regression test that fails on the old code. Three would have shown in a viva:
   - `E->E+T` typed without spaces;
   - `id + id*id` with mixed spacing;
   - `(a | b)*abb` with spaces, where each space silently became an input symbol.
3. **Viva risk 1:** the notes' table on p. 58 is the *ambiguous* grammar `E→E+E|E*E|…` with precedence imposed by hand.
   - For that grammar the tool, correctly, says "not an operator-precedence grammar" and lists 4 conflicting cells.
   - Be ready to say why, and to show that the unambiguous grammar reproduces the p. 58 table exactly.
4. **Viva risk 2:** LR parsing (the chapter next to OPP in the spec) is only a placeholder, labelled *Planned*.
   - The notes' OPP limitations (p. 57: L(G) ≠ L(parser), unary minus, error detection) are not stated in the UI, apart from the Classic-vs-Safeguarded demonstration.
5. **Removed as decoration:** 3D intro (three.js), homepage specimen loop, glass loupe, View Transitions, Examples drawer, the `motion` library, speed dial, IBM Plex Math.
   - `dist/` went from **2.12 MB / 50 files to 0.51 MB / 7 files**.
   - Runtime dependencies went from 7 to 5, and installed packages from 46 to 32.

## 2. Ground truth from the notes

**Sources:**
- Printed *cd-unit2* pp. 26–83. Its text layer was extracted and pages were located by their "Page N" footer.
- Handwritten notes pp. 1–10 and 21–40. These are scans with no text layer, read as images. The LR(0) `S→AA` and direct-method material is in this set. For those I give the derivation, not a page number, where I could not pin one page down.

### 2a. Operator precedence (unit-2 pp. 57–59)

| Item | From the notes | Tool |
| --- | --- | --- |
| Operator grammar (p. 57) | No ε on a right side; no two adjacent non-terminals | `validateOperatorGrammar`: ADJACENT_NONTERMINALS and EPSILON, checked on every alternative. A6 samples "Adjacent non-terminals" and "An ε-production" |
| Relations (p. 57) | `a <. b` yields, `a = b` same precedence, `a .> b` takes | ⋖ ≐ ⋗, same meanings and wording |
| Handle (p. 58) | Scan left to the first `.>`, back over `=` to the nearest `<.` | Stack form: shift on ⋖/≐, reduce on ⋗, pop back to the last ⋖ |
| Trace (p. 59) | `$<.id.>+<.id.>*<.id.>$`. id+id*id → E+id*id → E+E*id → E+E*E → E+E → E, ACCEPT | Reductions F→id, F→id, F→id, T→T*F, E→E+T, then ACCEPT. Same order ([p3-parser.txt](review1/output/p3-parser.txt)) |
| Table (p. 58), rows id + * $ | `id` ⋗ +,*,$; `+` ⋖ id, ⋗ +, ⋖ *, ⋗ $; `*` ⋖ id, ⋗ +, ⋗ *, ⋗ $; `$` ⋖ id,+,* | The unambiguous grammar reproduces all 16 cells ([p1-opp.txt](review1/output/p1-opp.txt)) |

**Hand-derived for E→E+T|T, T→T*F|F, F→(E)|id:**
- LEADING(E)={+,*,(,id}, LEADING(T)={*,(,id}, LEADING(F)={(,id}.
- TRAILING(E)={+,*,),id}, TRAILING(T)={*,),id}, TRAILING(F)={),id}.

| ↓ stack / lookahead → | + | * | ( | ) | id | $ |
| --- | --- | --- | --- | --- | --- | --- |
| **+** | ⋗ | ⋖ | ⋖ | ⋗ | ⋖ | ⋗ |
| **\*** | ⋗ | ⋗ | ⋖ | ⋗ | ⋖ | ⋗ |
| **(** | ⋖ | ⋖ | ⋖ | ≐ | ⋖ | |
| **)** | ⋗ | ⋗ | | ⋗ | | ⋗ |
| **id** | ⋗ | ⋗ | | ⋗ | | ⋗ |
| **$** | ⋖ | ⋖ | ⋖ | | ⋖ | |

The tool matches all 36 cells ([p1-opp.txt](review1/output/p1-opp.txt): `PASS 6x6 table vs hand derivation (36 cells)`).

**Disagreement between the notes and the code: I believe the code.**
- p. 57 starts from `E→EAE|(E)|-E|id`, and p. 58 writes it as `E→E+E|E-E|E*E|E/E|…`. That grammar is ambiguous.
- Rules R3/R4 put both ⋖ and ⋗ into (+,+), (+,\*), (\*,+) and (\*,\*). The p. 58 table resolves them using the usual precedence and associativity, which the notes never derive.
- The tool reports exactly those 4 conflicts.
- I recommend an optional "declare precedence and associativity" mode (finding U5), and have not implemented it. This audit does not change semantics.

**Limitations (p. 57):**
- hard to handle unary minus;
- small class of grammars;
- L(G) ≠ L(parser);
- weak error detection.

**UI:** only L(G) ≠ L(parser) is shown, through Classic N vs Safeguarded (finding U4).

### 2b. LR fixtures (unit-2 pp. 60–83, handwritten LR pages)

These are used only for the LR recommendation in §6, because nothing in LR is implemented.

| Fixture | Ground truth |
| --- | --- |
| LR(0) `S→AA, A→aA\|b` | Augmented `S'→S`. I0 {S'→.S, S→.AA, A→.aA, A→.b}; I1=goto(0,S) {S'→S.}; I2=goto(0,A) {S→A.A, A→.aA, A→.b}; I3=goto(0,a) {A→a.A, A→.aA, A→.b}; I4=goto(0,b) {A→b.}; I5=goto(2,A) {S→AA.}; I6=goto(3,A) {A→aA.}; goto(2/3,a)=I3, goto(2/3,b)=I4. ACTION/GOTO: 0: s3 s4, S=1 A=2; 1: acc on $; 2: s3 s4, A=5; 3: s3 s4, A=6; 4: r3; 5: r1; 6: r2. `aabb$` accepts, popping 2·\|β\| per reduce |
| SLR(1) expression grammar (pp. 63–69) | 12 states I0–I11; reduce only on FOLLOW(LHS) |
| CLR(1) `S→CC, C→cC\|d` (pp. 77–81) | 10 states I0–I9 |
| LALR (pp. 81–82) | Merge I3+I6 → I36, I4+I7 → I47, I8+I9 → I89, giving 7 states |
| Conflicts | `S→A\|a, A→a` is not LR(0) (reduce-reduce in the state after `a`). `E→T+E\|T` is not LR(0) (shift-reduce after T) but is SLR(1) |

### 2c. Direct RE→DFA

`(a|b)*abb#`:
- Leaves: a1 b2 a3 b4 b5 #6.
- followpos: 1:{1,2,3}, 2:{1,2,3}, 3:{4}, 4:{5}, 5:{6}, 6:{}.
- States: A={1,2,3}, B={1,2,3,4}, C={1,2,3,5}, D={1,2,3,6}.
- Transitions: A-a→B, A-b→A, B-a→B, B-b→C, C-a→B, C-b→D, D-a→B, D-b→A. D accepts.
- Every node's nullable/firstpos/lastpos is fixed in regression test B10.

Two more I derived by hand, node by node: `(ab|a)+b?` (11 nodes, 4 states) and `a*b*c?` (10 nodes, 3 states). All 17 checks pass ([p5-regex.txt](review1/output/p5-regex.txt)).

### 2d. Classic N vs Safeguarded fixture

`S→A+B, A→id*id, B→id/id`. Expected and observed (Classic/Safeguarded):

| String | Result |
| --- | --- |
| id\*id+id/id | ACCEPT/ACCEPT |
| id/id+id\*id | ACCEPT/REJECT |
| id\*id+id\*id | ACCEPT/REJECT |
| id/id+id/id | ACCEPT/REJECT |
| id\*id | ACCEPT/REJECT |
| id/id | ACCEPT/REJECT |
| id+id | REJECT/REJECT |
| id\*id+id | REJECT/REJECT |

All 8 match. For `id/id+id*id`, the first state divergence is at action 4 and the first decision divergence at action 10 ([p4-modes.txt](review1/output/p4-modes.txt)).

### 2e. Errors in the notes (flagged, not "fixed")

| Page | Problem |
| --- | --- |
| p. 51 / 54 | The stated input uses `+` but the worked trace uses `*` |
| p. 60 | "The class of grammars parsed by LR methods is a proper subset of those parsed by predictive parsers" is backwards: LL(1) ⊂ LR(1) |
| p. 65 | Goto(I0,F) should be I3, not I2 |
| p. 68 | Goto(I8,+) is listed twice; the second entry should be Goto(I9,\*) |
| p. 69 | goto(I0,id) should be I5. FOLLOW(F) is misprinted. The SLR table is missing GOTO entries in rows 4 and 6 |
| p. 82 | LALR table: row I0 is missing goto S=1, and row I47 is missing r3 on $ |

## 3. Findings

Bug tests B1–B9 fail on `5121d44` (before the fixes) and pass now:
- [regressions-before-fix.txt](review1/output/regressions-before-fix.txt): `# pass 1, # fail 9`. The one pass is B10, a fixture that was never a bug.
- [tests-after.txt](review1/output/tests-after.txt): 39/39.

| ID | Severity | Area | Evidence | Fix | Status |
| --- | --- | --- | --- | --- | --- |
| B1 | MAJOR | logic | `E->E+T\|T` (no spaces) parsed `E+T` as one glued terminal | `grammar.js`: split a chunk around the known non-terminals (da92b70) | fixed + test |
| B3 | MAJOR | logic | `id + id*id` (mixed spacing) was rejected as an unknown symbol | `parser.js` tokenizer runs per whitespace chunk (8939a1f) | fixed + test |
| B7 | MAJOR | logic | `(a \| b)*abb` made the space a numbered position, so the DFA was wrong | `regex.js`: an unescaped space is an error at its position; `\ ` is allowed (b51cfc6) | fixed + test |
| B2 | MINOR | logic | `$ -> a` was accepted as a non-terminal | Reserved check on the LHS (da92b70) | fixed + test |
| B4 | MINOR | logic | Whitespace-only input reported "unknown symbol" | Treated as empty input (8939a1f) | fixed + test |
| B5 | MINOR | logic | Greedy longest-match without backtracking: `abcd` over {ab, abc, cd} was rejected | Memoised DFS, longest first (8939a1f) | fixed + test |
| B6 | MINOR | logic | `parseString` **threw** on a conflicting table. The UI blocked that path, but the core API crashed | Returns REJECT naming the cell (8807b7b) | fixed + test |
| B8 | MINOR | logic | PARSE and SIMULATION steps had no `phase` field | Added (abedcf1) | fixed + test |
| B9 | MINOR | logic | Step records shared arrays, and `buildDirect` mutated its input AST | `structuredClone` and copies (abedcf1). Probe: 0 shared objects ([p7-steps.txt](review1/output/p7-steps.txt)) | fixed + test |
| U1 | MAJOR | UX | Viva step 5 (open the conflicting grammar) and step 6 (parse) took **5 clicks** each, because the grammar could only be changed on stage 1 ([ui-before](review1/ui-before/viva-flow.json)) | **Grammar** menu (native `<select>`) in the plate header of stages 2–4 and their fallbacks (36b17c2) | fixed: 1 and 2 clicks |
| U2 | MINOR | UX | Viva step 8 (regex → simulation) took 5 clicks | PageDown/PageUp change stage, never while typing (36b17c2) | fixed: 1 click + keys |
| U3 | MINOR | UI | IBM Plex Math (401 KB, `font-display: block`) drew only ⋖ ⋗ ≐, and could hide them for up to 3 s | Relations always drawn as inline SVG; font removed (e75186a) | fixed |
| U4 | MINOR | UX | The p. 57 limitations are not stated anywhere except through the Modes demo | Recommend one short "Limits of operator precedence" note on the Modes plate | **open** |
| U5 | MAJOR (viva) | logic/UX | The notes' p. 58 table is hand-resolved for an ambiguous grammar; the tool reports conflicts there (correctly) | Recommend an opt-in "declare precedence/associativity" mode, clearly labelled as not derived from LEADING/TRAILING | **open**, by decision |
| L1 | MAJOR (spec) | scope | LR parsing is a placeholder | See §6 recommendation | **open**, honest placeholder |
| N1–N6 | info | notes | §2e | none (the notes, not the code) | flagged |

## 4. Logic verification matrix

| Algorithm | Fixture / test | Result | Output |
| --- | --- | --- | --- |
| Grammar parse + validate | 28 cases: glued, `→`/`->`, blank lines, ε spellings, `$`, garbage, `\0`, 400-symbol RHS, comments | PASS: nothing throws; the errors name the production | [p2-grammar.txt](review1/output/p2-grammar.txt) |
| LEADING/TRAILING | Expression grammar, unit chain S→A→B, NT-then-terminal, fixed point logs "No set change" | PASS (4/4) | [p1-opp.txt](review1/output/p1-opp.txt) |
| Relation table | 6×6 hand table; the notes' (id,+,\*,$) subtable; R1 and R2 ≐; length-1 production; duplicate relation is not a conflict; ambiguous grammar conflicts at (+,+),(+,\*),(\*,+),(\*,\*) | PASS (all 36 cells) | [p1-opp.txt](review1/output/p1-opp.txt) |
| Shift/reduce parser | id+id\*id and (id+id)\*id full traces; unknown token; empty; `id id`; `( )`; missing operand; prefix terminals; conflicting table | PASS (REJECT reasons are specific) | [p3-parser.txt](review1/output/p3-parser.txt) |
| Classic vs Safeguarded | §2d fixture 8/8; divergence 4/10 | PASS | [p4-modes.txt](review1/output/p4-modes.txt) |
| Fuzz: expression grammar | All 97,655 token strings ≤ 7, compared with brute-force L(G) | 0 false accepts, 0 false rejects (both modes) | [p4-modes.txt](review1/output/p4-modes.txt) |
| Fuzz: S→A+B | All 87,380 strings ≤ 8 | Classic **5 false accepts** (expected); Safeguarded 0/0 | [p4-modes.txt](review1/output/p4-modes.txt) |
| Fuzz: random grammars | 120 random operator grammars, 948 strings | Classic 169 false accepts in 71 grammars; Safeguarded 0/0. No counterexample found; **not a proof** | [p4c-random-grammars.txt](review1/output/p4c-random-grammars.txt) |
| Regex parser | Precedence, escapes, `#` reserved, `a\|\|b`, `()`, trailing `\`, error positions are 1-based | PASS | [p5-regex.txt](review1/output/p5-regex.txt) |
| Direct method | 3 regexes × (every node, followpos, states, transitions, accepting, numbering) | PASS 17/17 | [p5-regex.txt](review1/output/p5-regex.txt) |
| Differential | 10 regexes × 5,000 strings vs JS `RegExp` and a Thompson-NFA subset construction | **0 mismatches / 50,000**; deterministic; no duplicate or unreachable states | [p6-diff.txt](review1/output/p6-diff.txt) |
| Step logs | 6 logs: phase/type/message/source on every step; 0 shared objects; AST not mutated | PASS | [p7-steps.txt](review1/output/p7-steps.txt) |
| Replay determinism | Forward then Back gives an identical DOM at every step of 8 stages, including mid-animation; changing the grammar resets replay (new `steps` array) | PASS | [verify-full.txt](review1/output/verify-full.txt) |

## 5. UI/UX results

**Automated:** `node scripts/verify.mjs` gives **622 passed, 0 failed** ([verify-full.txt](review1/output/verify-full.txt), every check listed in [docs/verification-results.md](../docs/verification-results.md)). The audit viewports, 1440×900, 1280×800, 1265×590, 768×1024, 390×844 and 360×800, give **1152/0**. The run covers:
- screens at 1366×768, 1280×720 and 1920×1080;
- keyboard-only demos;
- Back exactness;
- reduced motion;
- grayscale;
- 60 fps at 4× CPU throttling;
- no WebGL;
- fonts;
- bundle scan;
- 0 network requests.

| Known defect from the brief | Now |
| --- | --- |
| Clipped "Classic N versus Safeguarded r…" heading / right panel | Absent at all 3 sizes (`ui-audit.mjs`, [ui-after](review1/ui-after/)) |
| `$` tile over `id` tile; "LOOKAHEAD" label collision | 0 geometric overlaps on the parse and modes benches, at 3 sizes |
| Two nested scrollbars; permanent sidebar | At most one scroller; no navigation sidebar |
| All-caps tiny mono labels; boxed "1.5" | 0 uppercase-transformed labels; 0 boxed numbers |
| Comparison opens on ACCEPT/ACCEPT | Opens on S→A+B with `id/id+id*id`; the rows differ |
| Shortcuts fire while typing | No: →, End, Space and Home are ignored in inputs; every Tab stop on 7 screens shows a focus ring |
| ⋖ ⋗ ≐ glyph availability | Always inline SVG (32/32 on the table); distinguishable in grayscale (weakest 6.27:1) |
| Contrast | `npm run check:contrast`: all pairs pass ([tests-after.txt](review1/output/tests-after.txt)) |

**Viva flow, clicks** (keyboard stepping not counted; [before](review1/ui-before/viva-flow.json) → [after](review1/ui-after/viva-flow.json)):

| Step | Before | After |
| --- | --- | --- |
| 1 | 1 | 1 |
| 2 | 1 | 1 |
| 3 | 2 | 2 |
| 4 | 1 | 1 |
| 5 | **5** | 1 |
| 6 | **5** | 2 |
| 7 | 1 | 1 |
| 8 | **5** | 1 (+ End/PageDown) |

**"Generic AI look", what remains:**
- The machined keycaps, the brass timeline thumb and the grid-paper plate are a deliberate visual language and are KEEP, because the keycaps are the replay controls.
- No fake stats, no feature grid, no gradient call-to-action and no filler copy were found.
- The decorative items (3D intro, loupe, specimen loop, page cross-fade) are removed.

**Deliberate deviation:** the brief lists `[ ]` among the shortcuts to test. They were the speed controls, and they are removed along with the speed dial. Play now advances at a fixed 1.1 s per step.

## 6. Removal inventory and metrics

| Item | Spec item | Runtime use (evidence) | Verdict | Risk | Commit |
| --- | --- | --- | --- | --- | --- |
| `src/algorithms/*`, `src/core` facade | A1–A5, B | Imported by `replay/pipelines.ts` | KEEP | n/a | |
| Replay controller (`useReplay`), selectors | A2, A3, A5, B (step-by-step) | Every stage | KEEP | | |
| Keycaps and dock | A2–A5 step controls | Every stage | KEEP | | |
| Timeline scrubber | Step-by-step "or all at once" (A2) and phase markers | Every stage; keyboard-checked | KEEP | | |
| Provenance sheet (click a table cell) | A3 "showing the rule/source" | Table stage | KEEP | | |
| Step effects (`src/motion/fx.ts`, WAAPI) | Explains *which* cell or set changed on a forward step | Sets, table, parse, regex stages; off under reduced motion | KEEP | Back exactness verified | |
| Sample lists on stage 1 / regex stage 1 | A6 (an invalid sample), viva flow | | KEEP | | |
| Grammar picker (new) | A4/A5 viva flow | Stages 2–4 | KEEP (added) | | 36b17c2 |
| Hand-written SVG DFA graph | B "DFA graph" | `DfaGraph.tsx`; layout test up to 8 states | KEEP (Cytoscape was never a dependency) | | |
| LR placeholder | Spec "next to LR" | Labelled *Planned* | KEEP, honest | | |
| 3D intro, `three`, `@types/three` | none | First-visit only; 554 KB separate script | **REMOVED** | none: verifier proves no WebGL is needed | 26b78b9 |
| Homepage specimen loop | none (duplicated stage 3) | Homepage | **REMOVED** | none | ab43972 |
| Glass loupe (+ lens map, generator, MIT-credited liquid-glass code) | none | Table stage | **REMOVED** | none; the fps check improved | 6dc5cc6 |
| View Transitions | none | Route change; caused the key-routing bug fixed earlier | **REMOVED** | none | c5bb92a |
| Examples drawer | duplicated the per-stage sample lists | Shell | **REMOVED** | none | f9bd13c |
| `motion` library | none (presence/layout only) | Drawer, mode switch, door marks | **REMOVED** | none | c18d6fe |
| IBM Plex Math + glyph-mode switch; non-Latin font subsets | none | 401 KB font for 3 glyphs | **REMOVED / SIMPLIFIED** | SVG path already verified | e75186a |
| `liveFxCount`, `.pcell__plate`, `hashFlag` | none | 0 references | **REMOVED** | none | a2604aa, e75186a |
| Speed dial and `[ ]` | none | Dock | **REMOVED** | none | ce4ffcd |
| Lenis, GSAP, R3F/Drei, ssgoi, Cytoscape | none | **Not present** (`npm ls`, grep) | n/a | | |
| Analytics, `fetch`, camera/mic, `dangerouslySetInnerHTML`, `eval`, `console.log`, TODO | none | **0 lines** in `src/` ([p11-dead-code.txt](review1/output/p11-dead-code.txt)); 0 network requests at runtime | n/a | | |
| First-visit note | none | **Not present** (removed before this audit) | n/a | | |
| 36 exports used only in their own file | none | Used, just exported unnecessarily | SIMPLIFY (optional, cosmetic) | none | not done |

**Copied third-party code:** none remains. The only copied piece, the MIT liquid-glass loupe, was removed. The fonts are IBM Plex via `@fontsource` (OFL-1.1, npm).

**LL/top-down leak:** 0 matches for FIRST(, FOLLOW(, LL(1), top-down, predictive or recursive descent in `src/` or the bundle ([p8-ll-leak.txt](review1/output/p8-ll-leak.txt)). The 33 `firstpos`/`followpos` hits are direct-method terms.

**Metrics** ([before](review1/output/metrics-before.txt), [after](review1/output/metrics-after.txt)):

| | Before (5121d44) | After |
| --- | --- | --- |
| `dist/` | 2,122,549 B, 50 files | 511,280 B, 7 files |
| App script | 577,703 B (179,241 gzip) | 395,305 B (115,333 gzip) |
| Intro script | 554,315 B | none |
| Fonts | 47 files, 989,752 B | 5 files, 115,196 B |
| Direct deps | 7 runtime + 8 dev | 5 runtime + 7 dev |
| Installed packages / lockfile entries | 46 / 87 | 32 / 74 |
| `src/` | 54 files, 326,891 B | 44 files, 276,724 B |

**Security** ([p9-deps-audit.txt](review1/output/p9-deps-audit.txt)):
- `npm audit --audit-level=low`: **found 0 vulnerabilities**.
- The live npm bulk-advisory query returned `{}` for vite 8.3.3, postcss 8.5.29 (pinned by `overrides`), rolldown 1.2.12 and react 19.3.0.
- The 2026 Vite advisories on 8.x are all fixed by 8.0.16, and all are dev-server only:
  - GHSA-v2wj-q39q-566r: fixed in 8.0.5;
  - GHSA-p9ff-h696-f583: fixed in 8.0.5;
  - GHSA-fx2h-pf6j-xcff: fixed in 8.0.16.
- 8.3.3 is not affected, and `dist/` contains no dev server.

**Offline / file://** ([p10-file-protocol.txt](review1/output/p10-file-protocol.txt)):
- `dist/index.html` loads one **classic `defer` script** (0 `type="module"`) through a relative path. The fonts are relative too.
- The verifier copies `dist/` to `…/compiler lab verify/nested/renamed build/` and opens it over `file://` with the network off. Results: 0 requests and 0 console errors.
- Literally double-clicking it in a desktop file manager is **UNVERIFIED** (no desktop in this container). It is the same `file://` load in Chromium. The fallback is `npm run serve`.

**LR recommendation: (b) keep the honest placeholder for Review-1.**
- (a), a minimal LR(0)/SLR(1) chapter, would need closure/goto, the canonical collection, the ACTION/GOTO table with FOLLOW, a step-by-step trace, and fixtures from §2b. Estimate: **12–16 h** including tests and the verifier.
- Risk: a new FOLLOW computation is exactly the top-down machinery the brief says to keep out of the UI. The notes themselves have 5 table errors on pp. 65–82 to reconcile. A half-finished LR page in a viva is worse than an honest *Planned* label.
- Not implemented.

## 7. Open risks and UNVERIFIED

- **U5:** the examiner may present the p. 58 table for the ambiguous grammar. The tool will show 4 conflicts. That is correct, but it needs the explanation in §2a.
- **U4:** the limitations are not written in the UI.
- **L1:** LR is not implemented.
- **Safeguarded mode soundness:** no counterexample in 120 random grammars plus exhaustive small strings. This is testing, **not a proof**.
- **Real double-click from a file manager:** UNVERIFIED (see §6).
- **Browsers:** Firefox and Safari are UNVERIFIED. Only Chromium (Playwright) was run.
- **Notes page numbers:** handwritten-notes page numbers for the LR(0) `S→AA` and direct-method pages are not cited individually, because the scans have no text layer.
- **The 60 fps figure** is Chrome software compositing at 4× throttling, not the projector laptop.

## 8. Viva sheet (what the code does **now**)

1. **Why does `E→E+E|E*E|(E)|id` get "not an operator-precedence grammar" when the notes have a table for it?**
   - R3 and R4 put both ⋖ and ⋗ into (+,+), (+,\*), (\*,+) and (\*,\*).
   - The notes' table imposes precedence and associativity by hand.
   - The unambiguous grammar E→E+T|T… reproduces that table exactly.
2. **How is LEADING computed, and when does it stop?**
   - For A→γ: add the first terminal of γ, either at γ's start or after a leading non-terminal.
   - If γ starts with B, add LEADING(B).
   - Repeat passes until a pass changes nothing; the log says "No set change".
3. **Which rule gives ( ≐ )?** R2, terminal–non-terminal–terminal in F→( E ). Two adjacent terminals would be R1.
4. **When is a cell a conflict?** When it holds two *different* relations. Deriving the same relation twice is logged and is not a conflict.
5. **What does the parser compare at each step?**
   - The topmost *terminal* on the stack against the lookahead.
   - ⋖ or ≐ means shift; ⋗ means pop back to the last ⋖ and reduce that handle.
   - Blank means REJECT, with the cell named.
6. **Classic N vs Safeguarded, with an example.**
   - Classic N forgets which non-terminal was reduced, so for S→A+B it accepts `id/id+id*id`.
   - Safeguarded keeps the set (with unit-production closure) and rejects at action 10: handle {B}+{A} matches no production.
   - This is the p. 57 weakness, L(G) ≠ L(parser).
7. **Is Safeguarded proven sound?** No. It had 0 false accepts on exhaustive short strings and 120 random grammars, but that is evidence, not proof.
8. **What does `#` do, and why can't I type it?**
   - It is the end marker the direct method appends; its position's presence marks accepting states.
   - A literal `#` must be written `\#`.
   - A space is also an error unless written `\ `.
9. **Which nodes create followpos?**
   - Concatenation c1·c2: lastpos(c1) → firstpos(c2).
   - Star or plus n: lastpos(n) → firstpos(n).
   - `?` creates none.
   - For (a|b)\*abb this gives 1,2 → {1,2,3}, 3 → {4}, 4 → {5}, 5 → {6}.
10. **What is not done, or limited?**
    - LR is a placeholder.
    - There is no precedence/associativity mode.
    - Operator-grammar validation rejects ε and adjacent non-terminals but cannot handle unary minus with two precedences.
    - Only Chromium was tested.
    - The DFA is partial: a missing transition means reject.
