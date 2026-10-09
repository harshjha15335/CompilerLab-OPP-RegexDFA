// WCAG 2.1.1 / axe "scrollable-region-focusable": a region that scrolls must be reachable by keyboard so it
// can be scrolled with the arrow keys. Inner scrollers only scroll for some inputs (a long followpos table,
// a big DFA), so they get tabindex="0" exactly while they actually scroll, and lose it again afterwards.
const SCROLLERS = '.inspector, .pane--scroll, .scroll, .lookup, .duo, .figure--dfa';

export function watchScrollRegions(root: HTMLElement): () => void {
  let frame = 0;
  const sync = () => {
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    for (const el of root.querySelectorAll<HTMLElement>(SCROLLERS)) {
      const oy = getComputedStyle(el).overflowY;
      const scrolls = (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
      const ours = el.dataset.scrollFocus === '1';
      if (scrolls && !el.hasAttribute('tabindex')) { el.tabIndex = 0; el.dataset.scrollFocus = '1'; }
      else if (!scrolls && ours) { el.removeAttribute('tabindex'); delete el.dataset.scrollFocus; }
    }
  };
  const later = () => { if (!frame) frame = requestAnimationFrame(sync); };
  const ro = new ResizeObserver(later);
  ro.observe(root);
  // DOM changes (a replay step) are handled in the same task, so the attribute is never a frame behind the
  // content: stepping Back restores the identical DOM. Our own attribute writes are filtered out.
  const mo = new MutationObserver((records) => { if (records.some((r) => r.type === 'childList' || r.attributeName !== 'tabindex')) sync(); });
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', later);
  later();
  return () => { cancelAnimationFrame(frame); ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', later); };
}
