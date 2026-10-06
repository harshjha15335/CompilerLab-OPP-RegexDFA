// The loupe: a magnifier over the active precedence-table cell, the only glass in the app.
// Glass mode refracts the rim with an SVG feDisplacementMap; flat mode is the same magnifier
// without refraction. The displacement-map technique follows @samasante/liquid-glass (MIT,
// https://github.com/samasante/liquid-glass, src/displacement.ts); this is a minimal independent
// rewrite: a circular dome, no chromatic split, no specular, no WebGL, no copied code.
import type { ReactNode } from 'react';
import { useSettings } from '../replay/useReplay.ts';

// R/G encode x/y displacement (128 = none). Inside the rim band the samples are pushed outward, so
// content near the edge bends like the edge of a lens; the centre stays undistorted. The map is
// generated at build time by scripts/gen-lens-map.mjs and inlined here as a data: URI.
import lensMap from '../assets/lens-map.png?inline';

/** Positioned and sized by CSS (it scales with the table's --cell). `children` is the magnified
 *  copy of the neighbourhood. The filter works in bounding-box units, so it needs no pixel sizes. */
export function Loupe({ children, id }: { children: ReactNode; id: string }) {
  const { lens } = useSettings();
  const glass = lens === 'glass';
  return (
    <div className={`loupe loupe--${glass ? 'glass' : 'flat'}`} aria-hidden="true">
      {glass && (
        <svg width="0" height="0" className="loupe__defs" focusable="false">
          <filter id={`lens-${id}`} x="0" y="0" width="1" height="1" filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
            <feImage href={lensMap} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="0.16" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
      <div className="loupe__view" style={glass ? { filter: `url(#lens-${id})` } : undefined}>{children}</div>
      <span className="loupe__rim" />
    </div>
  );
}
