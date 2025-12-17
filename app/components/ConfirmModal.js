"use client";

import { useCallback } from "react";

export default function ConfirmModal({
  open,
  title,
  message,
  cancelText = "Cancel",
  confirmText = "Confirm",
  busy,
  danger,
  onCancel,
  onConfirm,
}) {
  const cancel = useCallback(() => {
    if (busy) return;
    onCancel?.();
  }, [busy, onCancel]);

  const confirm = useCallback(async () => {
    if (busy) return;
    await onConfirm?.();
  }, [busy, onConfirm]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      className={`fixed inset-0 z-50 grid place-items-center px-4 transition-opacity duration-150 ease-out motion-reduce:transition-none ${open ? "opacity-100" : "pointer-events-none opacity-0"
        } bg-black/60`}
      onClick={() => {
        if (!open) return;
        cancel();
      }}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          confirm();
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
              onClick={cancel}
              disabled={busy}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className={`cursor-pointer border-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${danger
                  ? "border-(--border) bg-red-600 text-white"
                  : "border-(--border-strong) bg-(--surface) text-white hover:border-white/70 hover:bg-white/10 hover:text-white"
                }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
