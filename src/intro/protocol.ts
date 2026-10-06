// The contract between the app and the separately built 3D intro bundle (assets/intro.js).
// The app never imports three.js: the intro is injected as a classic <script> only on a first
// visit with WebGL and motion allowed, so file:// launches keep working and the main bundle stays small.
export type Glyph = '⋖' | '⋗' | '≐';
export interface IntroTarget { glyph: Glyph; x: number; y: number; size: number; color: string }
export interface IntroHandle { stop(): void }
export interface IntroOptions {
  /** every glyph has landed on its cell: the DOM table may appear underneath */
  onSettled(): void;
  /** the scene is finished (or skipped itself because frames were too slow) */
  onDone(): void;
  /** WebGL failed or the context was lost: fall back to the CSS hand-off */
  onFail(reason: string): void;
}
export interface IntroModule { play(canvas: HTMLCanvasElement, targets: IntroTarget[], opts: IntroOptions): IntroHandle }

declare global { interface Window { CompilerLabIntro?: IntroModule } }

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch { return false; }
}
