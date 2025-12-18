"use client";

import { useCallback, useEffect, useRef } from "react";

export default function NoticeModal({ open, title, message, buttonText = "OK", busy, onClose, onAction }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // focus the modal so enter/escape works even if the input behind it still has focus
    const id = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = useCallback(() => {
    if (busy) return;
    onClose?.();
  }, [busy, onClose]);

  const action = useCallback(async () => {
    if (busy) return;
    if (onAction) {
      await onAction();
    }
    onClose?.();
  }, [busy, onAction, onClose]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      className={`fixed inset-0 z-50 grid place-items-center px-4 transition-opacity duration-150 ease-out motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0"
        } bg-black/60`}
      onClick={() => {
        if (!open) return;
        close();
      }}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          action();
        }
      }}
      tabIndex={open ? -1 : undefined}
    >
      <div
        className={`w-full max-w-md border-2 border-(--border) bg-(--surface) transition-all duration-150 ease-out motion-reduce:transition-none ${open ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b-2 border-(--border) px-4 py-3">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h2>
        </div>

        <div className="px-4 py-4">
          {message ? <p className="text-sm text-(--muted)">{message}</p> : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={action}
              disabled={busy}
              className="cursor-pointer border-2 border-(--border-strong) bg-(--surface-muted) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-foreground transition-colors hover:bg-(--surface) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
