"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebaseClient";

function clampNumber(value, { min, max }) {
  // helper so we don't write weird stuff into firestore
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Number.isFinite(min) && n < min) return min;
  if (Number.isFinite(max) && n > max) return max;
  return n;
}

export default function GameDataModal({ open, game, user, onClose, onSaved, onError }) {
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [hoursPlayed, setHoursPlayed] = useState("");
  const [notes, setNotes] = useState("");

  const title = useMemo(() => game?.title ?? game?.name ?? "Game", [game]);

  useEffect(() => {
    if (!open) return;
    const p = game?.playthrough ?? {};
    setStatus(typeof p?.status === "string" ? p.status : "");
    setRating(game?.rating != null ? String(game.rating) : "");
    setHoursPlayed(p?.hoursPlayed != null ? String(p.hoursPlayed) : "");
    setNotes(typeof p?.notes === "string" ? p.notes : "");
  }, [open, game]);

  const close = useCallback(() => {
    if (isSaving) return;
    onClose?.();
  }, [isSaving, onClose]);

  const save = useCallback(async () => {
    if (isSaving) return;
    if (!user || !game?.id) {
      onError?.("Sign in to edit game data.");
      return;
    }

    setIsSaving(true);
    try {
      // status and rating are stored separately, but we edit them together here
      const nextStatus = ["playing", "completed", "dropped", "plan"].includes(String(status))
        ? String(status)
        : null;

      const nextRatingNum = clampNumber(rating, { min: 0, max: 10 });
      const nextRating = nextRatingNum && nextRatingNum > 0 ? nextRatingNum : null;

      const payload = {
        status: nextStatus,
        hoursPlayed: clampNumber(hoursPlayed, { min: 0, max: 1000000 }),
        notes: notes.trim() || null,
      };

      const db = getFirebaseDb();
      const ref = doc(db, "users", user.uid, "games", String(game.id));
      await updateDoc(ref, {
        playthrough: payload,
        playthroughUpdatedAt: serverTimestamp(),
        rating: nextRating,
        ratingUpdatedAt: serverTimestamp(),
      });

      try {
        window.dispatchEvent(new CustomEvent("collection:changed"));
      } catch { }

      onSaved?.();
      close();
    } catch (err) {
      console.error("Failed to save game data:", err);
      onError?.("Failed to save game data (see console). ");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, user, game, status, rating, hoursPlayed, notes, onSaved, onError, close]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center px-4 bg-black/60"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          save();
        }
      }}
      tabIndex={-1}
    >
      <div
        className="w-full max-w-lg border-2 border-(--border) bg-(--surface)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-(--border) px-4 py-3">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            Edit
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={isSaving}
            className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="text-sm font-semibold text-foreground">{title}</div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground"
              >
                <option value="">—</option>
                <option value="playing">Playing</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
                <option value="plan">Plan to Play</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Your Rating</span>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground"
              >
                <option value="">—</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    {n}/10
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Hours Played</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={hoursPlayed}
                onChange={(e) => setHoursPlayed(e.target.value)}
                className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
              />
            </label>

            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Achievements</div>
              <div className="mt-2 text-sm text-(--muted)">Achievements: Not Yet Implemented</div>
            </div>

            <div className="sm:col-span-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="cursor-pointer border-2 border-(--border-strong) bg-(--surface-muted) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-foreground transition-colors hover:bg-(--surface) disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
