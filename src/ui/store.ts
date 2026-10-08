// localStorage for per-viewer conveniences only (settings). Every access
// is guarded: private windows and blocked storage simply fall back to "not remembered".
export const KEYS = { reduced: 'cl.reduced' } as const;

export function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
export function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* not remembered this time */ }
}
