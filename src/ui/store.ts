// localStorage for per-viewer conveniences only (intro seen, note dismissed, settings). Every access
// is guarded: private windows and blocked storage simply fall back to "not remembered".
export const KEYS = { intro: 'cl.intro.seen.v2', note: 'cl.note.keys.v1', reduced: 'cl.reduced', lens: 'cl.lens' } as const;

export function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
export function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* not remembered this time */ }
}
