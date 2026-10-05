import { useRef } from 'react';
import { useSettings } from '../replay/useReplay.js';
import { cx } from '../components/common/common.jsx';

/** A diagram surface with a faint drafting grid, a cursor spotlight and (optionally) a very
 *  small pointer tilt. Purely presentational: it only writes CSS variables on pointer events,
 *  so nothing runs while the pointer is still. Disabled under reduced motion. */
export function Board({ className, tilt = false, children }) {
  const ref = useRef(null);
  const { reduced } = useSettings();
  const move = (e) => {
    const el = ref.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    if (tilt) {
      el.style.setProperty('--ry', `${(px - 0.5) * 3}deg`);     // ±1.5°
      el.style.setProperty('--rx', `${(0.5 - py) * 2}deg`);     // ±1°
    }
    el.dataset.lit = 'true';
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    delete el.dataset.lit;
  };
  return (
    <div className={cx('board', tilt && 'board--tilt', className)} ref={ref} onPointerMove={move} onPointerLeave={leave}>
      <div className="board__plane">{children}</div>
    </div>
  );
}
