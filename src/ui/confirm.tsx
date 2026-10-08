// One accessible confirmation dialog for the whole app, built on the native <dialog>:
// showModal() makes the rest of the page inert and traps focus, Escape cancels, and focus
// returns to whatever opened it.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ConfirmRequest { title: string; body: ReactNode; confirm: string; cancel?: string }

export function useConfirm(): [(r: ConfirmRequest) => Promise<boolean>, ReactNode] {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const settle = useRef<((ok: boolean) => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);

  const ask = useCallback((r: ConfirmRequest) => new Promise<boolean>((resolve) => {
    settle.current?.(false);
    opener.current = document.activeElement as HTMLElement | null;
    settle.current = resolve;
    setReq(r);
  }), []);

  const close = useCallback((ok: boolean) => {
    const d = dialog.current;
    if (d?.open) d.close();
    setReq(null);
    const done = settle.current; settle.current = null;
    const back = opener.current; opener.current = null;
    // restore focus after the dialog has gone, even if the opener re-rendered
    if (back && back.isConnected) back.focus();
    done?.(ok);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!req || !d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    cancelBtn.current?.focus();                 // the safe choice has focus first
  }, [req]);

  const node = req ? (
    <dialog ref={dialog} className="confirm" aria-labelledby="confirm-title" aria-describedby="confirm-body"
      onCancel={(e) => { e.preventDefault(); close(false); }}>
      <h2 id="confirm-title" className="confirm__title">{req.title}</h2>
      <div id="confirm-body" className="confirm__body">{req.body}</div>
      <div className="confirm__actions">
        <button type="button" ref={cancelBtn} className="btn" onClick={() => close(false)}>{req.cancel ?? 'Cancel'}</button>
        <button type="button" className="btn btn--danger" onClick={() => close(true)}>{req.confirm}</button>
      </div>
    </dialog>
  ) : null;
  return [ask, node];
}
