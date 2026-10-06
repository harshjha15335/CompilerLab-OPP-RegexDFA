# Phase 1: Research and effect catalog

**How this was researched.** I read each repository's source without running it. I fetched blob-less trees
(`git clone --filter=blob:none --no-checkout`) and then read individual files with `git show <sha>:<path>`. No
dependencies were installed and no demo was built or run. All links below are pinned to the commit I read.
VisuAlgo and JFLAP are closed source, and their sites are blocked by this environment's network proxy, so those
two entries come from public documentation and search results only. They are marked *secondhand*.

**Where the verdicts point.** Every verdict names the screen of ours it affects:

| Code | Screen |
| --- | --- |
| HOME | Homepage specimen |
| INTRO | First-visit intro |
| SHELL | Rail, drawer and page transitions |
| DOCK | Transport keycaps, dial and timeline |
| G | Grammar |
| S | LEADING / TRAILING |
| T | Precedence table |
| P | Parse bench |
| M | Classic vs Safeguarded |
| RT | Regex syntax tree |
| RP | Node properties |
| F | followpos |
| D | DFA construction |
| SIM | DFA simulation |

## Licenses and attribution duties

| Project | License (read from the repo) | What it means for us |
| --- | --- | --- |
| Motion ([motiondivision/motion](https://github.com/motiondivision/motion/blob/55eb6bbd5f/LICENSE.md)) | MIT | Used as a dependency. The notice ships in `node_modules`, and the bundle keeps the license comments Vite preserves. |
| GSAP ([greensock/GSAP](https://github.com/greensock/GSAP/blob/13e2b79054/package.json)) | GreenSock "Standard 'no charge' license". **Not OSI.** Every source file says "Subject to the terms at https://gsap.com/standard-license". | gsap.com is blocked here, so I could not read the full text. Per search results it forbids use in tools that "build visual animations without code" competing with Webflow. That probably doesn't touch us, but a custom license is a supply-chain review item. **Not adopted** (see the stack decision). |
| Lenis | MIT | Not adopted. |
| React Three Fiber, Drei | MIT | Not adopted (see the stack decision). |
| three.js | MIT | Used, in the intro only. The license header is kept in the intro bundle. |
| Theatre.js ([theatre-js/theatre](https://github.com/theatre-js/theatre/tree/6ea82b938e/packages)) | `@theatre/core` is Apache-2.0. **`@theatre/studio` is AGPL-3.0** (`packages/studio/LICENSE`). | Rejected. The studio, which is the reason to use Theatre, is copyleft. |
| React Bits ([DavidHDev/react-bits](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/LICENSE.md)) | **MIT + Commons Clause.** You "may use … so long as you do not sell, sublicense, or redistribute the components themselves". | Copying a component into a public repo is arguably "redistributing the component". **We copy no React Bits files**; the components are used for study only. |
| Magic UI | MIT | Nothing copied. |
| Motion Primitives ([ibelick/motion-primitives](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/LICENCE.md)) | MIT | Nothing copied. |
| Codrops demos (all inspected repos except IsometricGrids) | MIT ("Copyright (c) 2009 - 202x Codrops") | The Codrops README adds "Don't republish, redistribute or sell 'as-is'". Nothing copied. |
| Codrops IsometricGrids | No LICENSE file. The README says "Integrate or build upon it for free … Don't republish, redistribute or sell 'as-is'". | Study only. |
| Bruno Simon folio-2019 ([license.md](https://github.com/brunosimon/folio-2019/blob/540f13573a/license.md)) | MIT | Nothing copied. Ideas only. |
| 14islands r3f-scroll-rig | MIT | Not adopted. |
| ssgoi ([meursyphus/ssgoi](https://github.com/meursyphus/ssgoi/blob/13b79f278c/LICENSE)) | MIT | Not adopted. |
| @samasante/liquid-glass ([samasante/liquid-glass](https://github.com/samasante/liquid-glass/blob/4e7b769e1d/LICENSE)) | MIT, zero runtime dependencies (React is a peer) | **Technique re-implemented.** No code copied: our loupe is a ~70-line rewrite. A credit comment in `src/ui/Loupe.tsx` and the audit log name the source. |
| Online Python Tutor ([backup](https://github.com/zetaloop/OnlinePythonTutor-Backup/blob/473848d155/LICENSE.txt); the original `pgbovine` repo was deleted in 2020) | MIT ("Copyright (C) Philip Guo") | Patterns only. |
| IBM Plex Math (font) | SIL OFL 1.1 with Reserved Font Name "Plex" | Shipped **unmodified** with `OFL.txt` beside it. It isn't subsetted, because a subset is a modification and would have to drop the "Plex" name. The npm package `@ibm/plex-math` runs an `ibmtelemetry` postinstall, so it is **not installed**: the single woff2 file was vendored instead. |

## Effect catalog

Cost codes: **S** means under 5 KB gzipped and no per-frame work. **M** means 5–40 KB or per-frame work only
while animating. **L** means over 40 KB, a WebGL context, or a permanent per-frame loop.

| # | Effect | Repo + file | What it does | Deps | License | Cost | Security notes | Verdict | Reason (our screen) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Shared-element / layout projection | Motion [`motion-dom/src/projection/node/create-projection-node.ts`](https://github.com/motiondivision/motion/blob/55eb6bbd5f/packages/motion-dom/src/projection/node/create-projection-node.ts) | FLIP-style measurement that animates a `layoutId` element from its old box to its new box | `motion` | MIT | M (runs only during a layout change) | none | **USE** | M: the selected-mode underline. HOME: the door pipeline marker. (The T provenance sheet first used `layoutId` on all 49 cells, but Motion re-measured them on every step; it is now a one-shot FLIP, `fx.morph`.) |
| 2 | Presence (exit animations) | Motion [`framer-motion/src/components/AnimatePresence/index.tsx`](https://github.com/motiondivision/motion/blob/55eb6bbd5f/packages/framer-motion/src/components/AnimatePresence/index.tsx) | Keeps an unmounting node alive for its exit | `motion` | MIT | S | none | **USE** | SHELL: drawer and Examples sheet. T: provenance sheet close. Never used on algorithm state. |
| 3 | Timeline sequences | Motion [`framer-motion/src/animation/animate/sequence.ts`](https://github.com/motiondivision/motion/blob/55eb6bbd5f/packages/framer-motion/src/animation/animate/sequence.ts) | Ordered or overlapping segments with `at:` offsets | `motion` | MIT | S | none | **STUDY ONLY** | The "cause, then value" sequences are built with native WAAPI `Element.animate()` (row 4) so cancelling is a single `.cancel()` call. This is the pattern GSAP would otherwise supply. |
| 4 | Native WAAPI animation wrapper | Motion [`motion-dom/src/animation/NativeAnimation.ts`](https://github.com/motiondivision/motion/blob/55eb6bbd5f/packages/motion-dom/src/animation/NativeAnimation.ts) | Drives `Element.animate()`. Motion commits final styles inline when an animation ends. | browser | MIT | S | none | **REWRITE** | All step effects (T, P, S, F, D, SIM). We call `Element.animate()` with `fill: 'none'` directly, so an effect **never leaves inline styles**. Seeking calls `cancel()`, and the DOM is exactly what React rendered. This fixes the old "Back restores exact DOM" flake. |
| 5 | Reduced-motion hook | Motion [`framer-motion/src/utils/reduced-motion/use-reduced-motion.ts`](https://github.com/motiondivision/motion/blob/55eb6bbd5f/packages/framer-motion/src/utils/reduced-motion/use-reduced-motion.ts) | Mirrors `prefers-reduced-motion` | `motion` | MIT | S | none | **USE** (via `MotionConfig reducedMotion`) | All screens. Our in-app switch also feeds `MotionConfig`. |
| 6 | DrawSVG (stroke draw) | GSAP [`src/DrawSVGPlugin.js`](https://github.com/greensock/GSAP/blob/13e2b79054/src/DrawSVGPlugin.js) | Animates `stroke-dashoffset` against the path length | `gsap` | GSAP Standard | M | custom license | **REWRITE** | D: edge draw. RT: tree edges. Done with `pathLength="1"` plus WAAPI on `stroke-dashoffset`, about 10 lines. |
| 7 | Flip plugin | GSAP [`src/Flip.js`](https://github.com/greensock/GSAP/blob/13e2b79054/src/Flip.js) | Records element state, then animates to a new layout | `gsap` | GSAP Standard | M | custom license | **REJECT** | Same job as row 1, which is already in the bundle for T. |
| 8 | Timeline + ScrollTrigger | GSAP [`src/ScrollTrigger.js`](https://github.com/greensock/GSAP/blob/13e2b79054/src/ScrollTrigger.js) | Scroll-scrubbed timelines | `gsap` | GSAP Standard | M–L | custom license | **REJECT** | The workspace does not scroll. Scrubbing is driven by our timeline (DOCK), not the page. |
| 9 | Kinetic-type page transition | Codrops KineticTypePageTransition [`src/js/typeTransition.js`](https://github.com/codrops/KineticTypePageTransition/blob/ebe926e2f1/src/js/typeTransition.js) | Background letters rotate forward, then sweep out (1.0–1.5 s timeline with `stagger: 0.04`) | gsap, splitting | MIT (Codrops) | M | none | **STUDY ONLY** | SHELL: inspired the stage-number "type slide" in chapter transitions, cut to 240 ms. 1.4 s would block the next keypress. |
| 10 | Scroll-perspective 3D grid | Codrops Scroll3DGrid [`js/index.js`](https://github.com/codrops/Scroll3DGrid/blob/69718a2eff/js/index.js) | Lenis + ScrollTrigger scrub `rotationX`/`z` on an image grid | gsap, lenis | MIT (Codrops) | M | none | **REJECT** | Scroll-driven and decorative. A tilted table hurts reading T. |
| 11 | Magnetic hover | Codrops 3DGridContentPreview [`src/js/magneticFx.js`](https://github.com/codrops/3DGridContentPreview/blob/f16ca5d074/src/js/magneticFx.js) | A per-frame lerp pulls an element toward the cursor | none | MIT (Codrops) | M (a permanent rAF loop while mounted) | none | **REJECT** | Moves click targets, which breaks our "no overlapping interactive boxes" check. Explains nothing. |
| 12 | Isometric CSS 3D grid | Codrops IsometricGrids [`css/component.css`](https://github.com/codrops/IsometricGrids/blob/ab6aba3761/css/component.css) | `transform-style: preserve-3d` with rotateX/rotateZ planes | none | Codrops terms | S | none | **STUDY ONLY** | DOCK: the keycap side faces come from the same `preserve-3d` layering, kept to the controls. |
| 13 | Scroll-based layout (Flip on scroll) | Codrops ScrollBasedLayoutAnimations [`js/index.js`](https://github.com/codrops/ScrollBasedLayoutAnimations/blob/ade47c56f8/js/index.js) | `Flip.getState` then `Flip.to` as the user scrolls | gsap | MIT (Codrops) | M | none | **REJECT** | Scroll is not our time axis. Steps are. |
| 14 | On-scroll character typography | Codrops OnScrollTypographyAnimations [`src/js/index.js`](https://github.com/codrops/OnScrollTypographyAnimations/blob/af28d61d1f/src/js/index.js) | Splits text into `.char` and animates each with ScrollTrigger + Lenis | gsap, lenis | MIT (Codrops) | M | none | **REJECT** | Decorative. Splitting grammar text into characters would also break screen-reader reading of productions. |
| 15 | Matcap materials (lighting without lights) | folio-2019 [`src/javascript/Materials/Matcap.js`](https://github.com/brunosimon/folio-2019/blob/540f13573a/src/javascript/Materials/Matcap.js) | A shader that samples a matcap texture, so no real lights are needed | three | MIT | S (cheap fragment shader) | Loads matcap images | **REWRITE** | INTRO: the glyph material uses `MeshMatcapMaterial` with a **matcap generated on a canvas at runtime** (brass/ink gradient). No image files, no light setup, cheap on integrated GPUs. |
| 16 | 2×2 data-texture gradient floor | folio-2019 [`src/javascript/World/Floor.js`](https://github.com/brunosimon/folio-2019/blob/540f13573a/src/javascript/World/Floor.js) | Background gradient from a 2×2 `DataTexture` | three | MIT | S | none | **STUDY ONLY** | INTRO: our background is the DOM paper behind a transparent canvas, so there's nothing to render. |
| 17 | Fake projected shadows | folio-2019 [`src/javascript/World/Shadows.js`](https://github.com/brunosimon/folio-2019/blob/540f13573a/src/javascript/World/Shadows.js) | Alpha-blended planes under objects instead of shadow maps | three | MIT | S | none | **STUDY ONLY** | INTRO: tried as one soft blob plane under each glyph (cheaper than a shadow map), then removed after screenshot review: on the paper they read as grey dust. |
| 18 | Post-processing blur / glow passes | folio-2019 [`src/javascript/Passes/Glows.js`](https://github.com/brunosimon/folio-2019/blob/540f13573a/src/javascript/Passes/Glows.js) | Full-screen shader passes | three | MIT | L | none | **REJECT** | Glow is on the anti-pattern list, and a full-screen pass doubles fill cost. |
| 19 | Physics car playground | folio-2019 [`src/javascript/World/Car.js`](https://github.com/brunosimon/folio-2019/blob/540f13573a/src/javascript/World/Car.js) / `Physics.js` | cannon.js vehicle | cannon, three | MIT | L | none | **REJECT** | Spectacle with no algorithm meaning. |
| 20 | Areas with key hints | folio-2019 [`src/javascript/World/Area.js`](https://github.com/brunosimon/folio-2019/blob/540f13573a/src/javascript/World/Area.js) | In-world interact zones that show which key to press | gsap, three | MIT | M | none | **STUDY ONLY** | DOCK: keycaps press visibly when the matching keyboard key is used, teaching ←/→/Space. |
| 21 | Liquid-glass SDF lens | liquid-glass [`src/displacement.ts`](https://github.com/samasante/liquid-glass/blob/4e7b769e1d/src/displacement.ts), [`src/Glass.tsx`](https://github.com/samasante/liquid-glass/blob/4e7b769e1d/src/Glass.tsx) | Generates a displacement map on a canvas (R/G = displacement, B = specular), then `feDisplacementMap` via `filter: url()` on a *copy* of the content (not `backdrop-filter`, which is Chromium-only) | react (peer) | MIT | M (map generated once per shape; the filter is GPU-composited) | Clean: no `fetch`, `eval` or `dangerouslySetInnerHTML` in `src/`. The map is a `data:` URI produced locally. | **REWRITE** (minimal) | T: the loupe over the active cell. We need only a circular dome map without chroma, specular or WebGL (the library is ~2,000 lines). Behind a feature flag, with a flat-lens fallback. |
| 22 | WebGL glass over video | liquid-glass [`src/glassWebGL.ts`](https://github.com/samasante/liquid-glass/blob/4e7b769e1d/src/glassWebGL.ts) | GPU version of the same refraction for `<video>` | WebGL2 | MIT | L | none | **REJECT** | We never refract video. A second WebGL context would compete with INTRO. |
| 23 | ssgoi page transitions | ssgoi [`packages/core/src/lib/ssgoi-transition/create-ssgoi-transition-context.ts`](https://github.com/meursyphus/ssgoi/blob/13b79f278c/packages/core/src/lib/ssgoi-transition/create-ssgoi-transition-context.ts) | Router-agnostic page transitions. Precomputes springs into WAAPI keyframes. **Re-inserts the detached outgoing DOM node** to animate it out. | `@ssgoi/react` + core | MIT | M | none | **REJECT** | SHELL: native View Transitions cover our Chromium lab target, and the fallback is a 150 ms Motion fade. Re-inserting old DOM conflicts with the rule that rendered DOM is only ever React's render of `steps[count]`. |
| 24 | View Transitions API (native) | browser (`document.startViewTransition`) | Snapshots old and new DOM and cross-fades or morphs named parts | none | n/a | S | none | **USE** | SHELL: chapter and stage changes. `view-transition-name` on the plate title and rail marker. |
| 25 | Lenis smooth scroll | Lenis [`packages/core/src/lenis.ts`](https://github.com/darkroomengineering/lenis/blob/bc152f90d7/packages/core/src/lenis.ts) | Intercepts `wheel` and re-implements scrolling (`preventDefault`, with opt-out via `data-lenis-prevent`) | none | MIT | M (rAF loop) | none | **REJECT** | The workspace has nested scroll panels (trace, samples), and the brief allows Lenis only on the intro, which doesn't scroll. |
| 26 | r3f-scroll-rig | [`dist/src/components/GlobalCanvas.d.ts`](https://github.com/14islands/r3f-scroll-rig/blob/123663599e/dist/src/components/GlobalCanvas.d.ts) | One global canvas tracking DOM elements in lockstep with Lenis scrolling | r3f, lenis | MIT | L | none | **STUDY ONLY** | INTRO: the "DOM rect → 3D position" idea drives our hand-off. Glyph targets are the specimen table's real cell rectangles. |
| 27 | R3F frameloop on demand | R3F [`packages/fiber/src/core/loop.ts`](https://github.com/pmndrs/react-three-fiber/blob/d604b18bbd/packages/fiber/src/core/loop.ts) | `frameloop: 'demand'` renders only after `invalidate()` | react, three | MIT | M | none | **STUDY ONLY** | INTRO: our plain-three loop stops rendering after the hand-off and on `visibilitychange`. |
| 28 | Drei Text3D | Drei [`src/core/Text3D.tsx`](https://github.com/pmndrs/drei/blob/bf6f4addf4/src/core/Text3D.tsx) | Extruded text from a typeface JSON (`TextGeometry`) | three-stdlib + a font file | MIT | M | Needs a font JSON asset | **REJECT** | INTRO: ⋖ ⋗ ≐ are built procedurally from `THREE.Shape` outlines with `ExtrudeGeometry`. No font download and no typeface conversion. |
| 29 | Drei PerformanceMonitor | Drei [`src/core/PerformanceMonitor.tsx`](https://github.com/pmndrs/drei/blob/bf6f4addf4/src/core/PerformanceMonitor.tsx) | Samples fps, calls `onDecline` | r3f | MIT | S | none | **REWRITE** | INTRO: 15 lines. If the first 12 frames average under 40 fps, skip straight to the hand-off (Plan B for jank). |
| 30 | Drei Float / Center / RoundedBox | Drei [`src/core/Float.tsx`](https://github.com/pmndrs/drei/blob/bf6f4addf4/src/core/Float.tsx) etc. | Idle bobbing, centring, rounded boxes | r3f | MIT | S | none | **REJECT** | Idle motion that explains nothing. |
| 31 | Theatre.js keyframe studio | Theatre [`packages/studio/src/index.ts`](https://github.com/theatre-js/theatre/blob/6ea82b938e/packages/studio/src/index.ts) | Visual keyframe editor | many | **AGPL-3.0** (studio) | L | Copyleft | **REJECT** | A 4 s intro needs four hand-written keyframes, not an editor. |
| 32 | Counter / rolling digits | React Bits [`src/ts-default/Components/Counter/Counter.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Components/Counter/Counter.tsx); Motion Primitives [`components/core/sliding-number.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/sliding-number.tsx) | Digits roll vertically on change | motion (+ react-use-measure) | Commons Clause / MIT | S | none | **REJECT** | DOCK: step numbers change on every keypress, and rolling digits would make "Step 12" unreadable mid-roll. Plain tabular numerals instead. |
| 33 | ElasticSlider | React Bits [`src/ts-default/Components/ElasticSlider/ElasticSlider.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Components/ElasticSlider/ElasticSlider.tsx) | A slider that stretches past its ends | @chakra-ui, react-icons, motion | Commons Clause | M | Heavy extra deps | **STUDY ONLY** | DOCK: the weighted scrub thumb borrows "overshoot shows resistance" as a 2 px squash at the ends. CSS only, no copied code. |
| 34 | CometDial | React Bits [`src/ts-default/Micro/CometDial/CometDial.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Micro/CometDial/CometDial.tsx) | Rotary dial with a trailing comet | motion | Commons Clause | M | none | **STUDY ONLY** | DOCK: our speed dial is a `role="slider"` with five detents. We take the rotary interaction, not the comet trail. |
| 35 | Stepper | React Bits [`src/ts-default/Components/Stepper/Stepper.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Components/Stepper/Stepper.tsx) | Wizard steps with a sliding indicator | motion | Commons Clause | M | none | **REJECT** | A wizard implies one-way progress, but our stages are freely revisitable. The SHELL drawer lists stages instead. |
| 36 | GlassSurface / FluidGlass | React Bits [`GlassSurface.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Components/GlassSurface/GlassSurface.tsx), [`FluidGlass.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Components/FluidGlass/FluidGlass.tsx) | Glass panels (SVG filter / R3F transmission) | r3f, maath, three | Commons Clause | L | none | **REJECT** | Glassmorphism as a surface is on the anti-pattern list. The only glass is the T loupe (row 21). |
| 37 | ReflectiveCard | React Bits [`src/content/Components/ReflectiveCard/ReflectiveCard.jsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/content/Components/ReflectiveCard/ReflectiveCard.jsx) | Card reflecting the **user's webcam**: calls `navigator.mediaDevices.getUserMedia({ video })` on mount (lines 21–37) | none | Commons Clause | L | **Requests the camera on mount** | **REJECT** | Never copied. The audit greps the bundle for `getUserMedia`. |
| 38 | SplitText reveal | React Bits [`SplitText.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/TextAnimations/SplitText/SplitText.tsx) | GSAP SplitText + ScrollTrigger character reveal | gsap (+ plugins) | Commons Clause + GSAP | M | custom license | **REJECT** | Decorative text animation. |
| 39 | DecryptedText / ClickSpark / Magnet / Crosshair | React Bits [`DecryptedText.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/TextAnimations/DecryptedText/DecryptedText.tsx), [`ClickSpark.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Animations/ClickSpark/ClickSpark.tsx), [`Magnet.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Animations/Magnet/Magnet.tsx), [`Crosshair.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Animations/Crosshair/Crosshair.tsx) | Scrambled text, sparks on click, cursor-attracted elements, cursor crosshair | motion / gsap | Commons Clause | S–M | none | **REJECT** | Cursor effects and fake decryption carry no algorithm meaning. Crosshair is a cursor-trail relative. |
| 40 | AnimatedList | React Bits [`AnimatedList.tsx`](https://github.com/DavidHDev/react-bits/blob/ca44b3f9ee/src/ts-default/Components/AnimatedList/AnimatedList.tsx); Magic UI [`animated-list.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/animated-list.tsx) | Items enter on a timer with scale/opacity | motion | Commons Clause / MIT | S | none | **STUDY ONLY** | S: a new set member "enters", but on the step, not a timer. Implemented as a 220 ms WAAPI settle. |
| 41 | Animated beam | Magic UI [`animated-beam.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/animated-beam.tsx) | SVG path between two DOM refs with a moving gradient | motion | MIT | M | none | **REWRITE** | T: a provenance path from the source (production or LEADING/TRAILING entry) to the cell. F: tree node to followpos row. Drawn once per forward step as a dash plus a riding dot, then removed. No looping gradient. |
| 42 | Border beam / shine border / ripple / magic card | Magic UI [`border-beam.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/border-beam.tsx), [`shine-border.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/shine-border.tsx), [`ripple.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/ripple.tsx), [`magic-card.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/magic-card.tsx) | Looping light around borders, cursor spotlight cards | motion, next-themes | MIT | M (infinite loops) | none | **REJECT** | Permanent decorative loops; neon-adjacent. |
| 43 | Number ticker | Magic UI [`number-ticker.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/number-ticker.tsx) | Springs a number from 0 to N on view | motion | MIT | S | none | **REJECT** | This is the "stats strip" pattern the homepage brief forbids. |
| 44 | Dock magnification | Magic UI [`dock.tsx`](https://github.com/magicuidesign/magicui/blob/cdb348cb4c/apps/www/registry/magicui/dock.tsx) | macOS-style icon magnification | motion, cva | MIT | M | none | **REJECT** | Resizing targets under the cursor breaks fixed keycap positions. |
| 45 | Text morph | Motion Primitives [`components/core/text-morph.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/text-morph.tsx) | Per-character layout animation between strings | motion | MIT | S | none | **STUDY ONLY** | HOME: a door's pipeline line ("grammar → table → parse") advances one stage. We move a marker under the stage word (`layoutId`) and leave the letters alone, so the words stay readable. |
| 46 | Transition panel | Motion Primitives [`components/core/transition-panel.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/transition-panel.tsx) | AnimatePresence between indexed panels | motion | MIT | S | none | **STUDY ONLY** | P: the Trace / Table tabs. A crossfade only, 120 ms. |
| 47 | Border trail / magnetic / in-view / scroll-progress | Motion Primitives [`border-trail.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/border-trail.tsx), [`magnetic.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/magnetic.tsx), [`in-view.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/in-view.tsx), [`scroll-progress.tsx`](https://github.com/ibelick/motion-primitives/blob/120f64f6ca/components/core/scroll-progress.tsx) | Decorative trails, cursor attraction, scroll reveals | motion | MIT | S–M | none | **REJECT** | Scroll and cursor driven; no step meaning. |

**Totals.** 47 effects reviewed: **USE 4** (rows 1, 2, 5, 24; three.js core is also used, for the intro only), **REWRITE 6**, **STUDY ONLY 13**, **REJECT 24**.

## How good algorithm visualisers handle step state

### Five patterns to adapt

1. **The trace is computed first; the view is an index into it.** In Python Tutor, the viewer holds
   `curTrace` and `curInstr` and renders `curTrace[curInstr]`
   ([`v5-unity/js/pytutor.ts` lines 153–174](https://github.com/zetaloop/OnlinePythonTutor-Backup/blob/473848d155/v5-unity/js/pytutor.ts#L153-L174)).
   *Adapted:* every screen renders `steps[count]` through pure selectors, so Back is exact.
2. **Two cursors: "just executed" and "next to execute".** Python Tutor draws a light arrow on the line
   just executed and a dark arrow on the next one. *Adapted:* the inspector shows **This step** (what
   changed and why) and **Next** (the next step's own message) together.
3. **Breakpoint ticks on the slider.** Python Tutor's `renderSliderBreakpoints`
   ([same file, line 500](https://github.com/zetaloop/OnlinePythonTutor-Backup/blob/473848d155/v5-unity/js/pytutor.ts#L500))
   marks interesting points on the scrubber. *Adapted:* phase markers on our timeline (LEADING → TRAILING
   passes, one per production, divergence points), reachable with Shift+←/→.
4. **The status panel narrates each action, and pseudocode highlights the rule** (VisuAlgo, *secondhand*:
   [visualgo.net/en/dfsbfs](https://visualgo.net/en/dfsbfs)). *Adapted:* each step names the rule it applied
   (R1–R6, L1–T2, the followpos rules) and highlights that rule in a rule list beside the figure.
5. **"Do step" and "Complete" side by side** (JFLAP NFA→DFA, *secondhand*:
   [conversion pane docs](https://www2.cs.duke.edu/csed/jflap/new/DOCS/gui.deterministic.ConversionPane.html)).
   *Adapted:* every screen has Next **and** End (all-at-once) on the same dock, and End is
   always one key (`End`).

### Five clichés to avoid

1. **Colour as the only signal** (red/green bars in sorting visualisers). Every relation, verdict and
   conflict here also carries a glyph, border style or word.
2. **Auto-play on load with no pause** (many sorting demos). Ours starts paused at step 0, except
   the homepage specimen, which loops but has a visible Pause keycap and stops when focused.
3. **Long tweened morphs that block the next step** (VisuAlgo's slowest speeds, secondhand). Effects cap at 300 ms. A
   new keypress cancels them immediately, and Back/seek never animates.
4. **The "slideshow" e-lecture that hides the controls** (VisuAlgo's e-Lecture overlay, secondhand). Our
   explanations sit beside the figure and never cover it.
5. **Physics, wobble and bouncy springs on data** (common in React visualiser demos). Algorithm data moves on
   one ease curve (`cubic-bezier(.2,.7,.2,1)`), with no overshoot.

Sources consulted through search only: [VisuAlgo DFS/BFS](https://visualgo.net/en/dfsbfs),
[JFLAP NFA→DFA tutorial](https://www.jflap.org/tutorial/fa/nfa2dfa/index.html),
[JFLAP ConversionPane docs (Duke)](https://www2.cs.duke.edu/csed/jflap/new/DOCS/gui.deterministic.ConversionPane.html),
[Python Tutor backup repo](https://github.com/zetaloop/OnlinePythonTutor-Backup),
[Webflow: GSAP becomes free](https://webflow.com/blog/gsap-becomes-free),
[GSAP Standard License (community mirror)](https://gsap.com/community/standard-license/).
