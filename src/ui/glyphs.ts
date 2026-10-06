// Relation glyphs are typeset with IBM Plex Math (verified to contain U+22D6 ⋖, U+22D7 ⋗, U+2250 ≐).
// If that face fails to load, every <Rel> switches to a tiny inline-SVG drawing instead.
import { useSyncExternalStore } from 'react';
import { hashFlag } from '../data/nav.ts';

export type GlyphMode = 'font' | 'svg';
let mode: GlyphMode = 'font';
const listeners = new Set<() => void>();
const set = (m: GlyphMode) => { if (m !== mode) { mode = m; listeners.forEach((l) => l()); } };

export function initGlyphs() {
  if (hashFlag('glyphs') === 'svg') { set('svg'); return; }          // verification hook
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.load) return;
  fonts.load('20px "IBM Plex Math"', '⋖⋗≐').then(
    (faces) => { if (!faces.length) set('svg'); },
    () => set('svg'),
  );
}

export const useGlyphMode = () =>
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => mode, () => 'font' as GlyphMode);
