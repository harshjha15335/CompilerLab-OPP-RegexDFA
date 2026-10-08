// localStorage for per-viewer conveniences only (settings). Every access
// is guarded: private windows and blocked storage simply fall back to "not remembered".
export const KEYS = { reduced: 'cl.reduced' } as const;

export function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
export function write(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* not remembered this time */ }
}

/** Per-tab session state (the inputs on screen), so a refresh keeps the user's grammar, expression and strings.
 *  sessionStorage, not localStorage: closing the tab starts fresh. Guarded like the settings store. */
const SESSION_KEY = 'cl.session.v1';
export function readSession<T extends object>(): Partial<T> {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}
export function writeSession(patch: object) {
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...readSession(), ...patch })); } catch { /* not remembered */ }
}
