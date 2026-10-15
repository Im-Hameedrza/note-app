"use client";
import { useEffect, useRef, useState } from "react";
export default function ConfirmModal({ icon: Icon, title, description, confirmText, onConfirm, onClose, variant = "primary", error }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element.showModal(); cancel.current?.focus();
    return () => { element.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  async function confirm() {
    if (busy.current) return;
    busy.current = true; setPending(true); setLocalError("");
    try { if (await onConfirm() !== false) onClose(); }
    catch (failure) { setLocalError(failure.message || "Could not complete this action. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  function keyboard(event) {
    if (event.key !== "Tab") return;
    const buttons = [...dialog.current.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
  }
  return <dialog ref={dialog} aria-modal="true" aria-label={title} aria-busy={pending} onKeyDown={keyboard}
    onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[500px] overflow-y-auto rounded-2xl border-0 bg-surface p-0 text-text-primary shadow-xl backdrop:bg-overlay/60">
    <div className="flex gap-4 px-6 py-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-secondary"><Icon size={24} className={variant === "danger" ? "text-danger" : "text-text-primary"} /></div><div className="min-w-0"><h2 className="mb-1 text-lg font-semibold">{title}</h2><p className="text-base leading-6 text-text-secondary">{description}</p></div></div>
    {(error || localError) && <p role="alert" className="px-6 pb-4 text-sm text-danger">{error || localError}</p>}
    <div className="flex flex-wrap justify-end gap-3 border-t border-border px-6 py-5">
      <button ref={cancel} type="button" disabled={pending} onClick={onClose} className="rounded-xl bg-surface-secondary px-5 py-3 font-medium text-text-secondary disabled:opacity-50">Cancel</button>
      <button type="button" disabled={pending} onClick={confirm} className={"rounded-xl px-5 py-3 font-medium disabled:opacity-50 " + (variant === "danger" ? "bg-danger text-on-danger hover:bg-danger/85" : "bg-primary text-on-primary hover:bg-primary-hover")}>{pending ? "Please wait..." : confirmText}</button>
    </div>
  </dialog>;
}
