"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useFirebaseUser } from "../hooks/useFirebaseUser";
import { getFirebaseDb } from "../lib/firebaseClient";
import ConfirmModal from "./ConfirmModal";
import NoticeModal from "./NoticeModal";
import ExpandableText from "./ExpandableText";
import AddGameModal from "./AddGameModal";
import GameDataModal from "./GameDataModal";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function CollectionHome() {
  const { user, loading } = useFirebaseUser();
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [ratingPickerFor, setRatingPickerFor] = useState(null);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const [removeConfirmFor, setRemoveConfirmFor] = useState(null);
  const [notice, setNotice] = useState(null);
  const [gameDataFor, setGameDataFor] = useState(null);

  const SUMMARY_PREVIEW_CHARS = 220;

  const ratingPickerSelector = useMemo(() => {
    if (ratingPickerFor == null) return null;
    return `[data-rating-popup-id="${String(ratingPickerFor)}"]`;
  }, [ratingPickerFor]);

  useEffect(() => {
    if (!ratingPickerSelector) return;

    function onPointerDown(e) {
      const container = document.querySelector(ratingPickerSelector);
      if (!container) return;
      if (container.contains(e.target)) return;
      setRatingPickerFor(null);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setRatingPickerFor(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ratingPickerSelector]);

  function formatAddedDate(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : null;
      return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) : "—";
    } catch {
      return "—";
    }
  }

  function formatUserRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return `${n}/10`;
  }

  useEffect(() => {
    setGames([]);
    setError(null);
    if (!user) return undefined;

    const db = getFirebaseDb();
    const col = collection(db, "users", user.uid, "games");
    const q = query(col, orderBy("addedAt", "desc"));
    // realtime subscription
    const unsub = onSnapshot(
      q,
      (snap) => {
        setGames(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Failed to listen to user games:", err);
        setError(err?.message ?? String(err));
      }
    );

    // fallback: fetch once in case realtime channel is blocked by extensions
    async function fetchOnce() {
      try {
        const s = await getDocs(q);
        setGames(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to fetch user games:", err);
      }
    }

    fetchOnce();

    // listen for manual refresh events (dispatched after add)
    function onCollectionChanged() {
      fetchOnce();
    }
    window.addEventListener("collection:changed", onCollectionChanged);

    return () => {
      unsub();
      window.removeEventListener("collection:changed", onCollectionChanged);
    };
  }, [user]);

  const handleRemove = useCallback(
    async (gameId) => {
      if (!user) {
        setNotice({ title: "Sign in", message: "Sign in to remove items." });
        return;
      }
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "games", String(gameId));
        await deleteDoc(ref);
        try { window.dispatchEvent(new CustomEvent("collection:changed")); } catch { }
        setNotice({ title: "Removed", message: "Removed from your collection." });
      } catch (err) {
        console.error("Failed to delete (SDK):", err);
        // REST fallback delete
        try {
          const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          const idToken = await user.getIdToken();
          const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${user.uid}/games/${gameId}`;
          const res = await fetch(url, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!res.ok) {
            const t = await res.text();
            throw new Error(`REST delete failed: ${res.status} ${t}`);
          }
          try { window.dispatchEvent(new CustomEvent("collection:changed")); } catch { }
          setNotice({ title: "Removed", message: "Removed from your collection." });
        } catch (restErr) {
          console.error("REST delete failed:", restErr);
          setNotice({ title: "Error", message: "Failed to remove item (see console)." });
        }
      }
    },
    [user]
  );

  const handleRating = useCallback(
    async (gameId, value) => {
      if (!user) {
        setNotice({ title: "Sign in", message: "Sign in to rate items." });
        return;
      }
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "games", String(gameId));
        await updateDoc(ref, {
          rating: Number(value),
          ratingUpdatedAt: serverTimestamp(),
        });
        try { window.dispatchEvent(new CustomEvent("collection:changed")); } catch { }
      } catch (err) {
        console.error("Failed to update rating (SDK):", err);
        // REST fallback: patch document with new fields
        try {
          const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          const idToken = await user.getIdToken();
          const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${user.uid}/games/${gameId}`;
          const body = {
            fields: {
              rating: { integerValue: String(Number(value)) },
              ratingUpdatedAt: { timestampValue: new Date().toISOString() },
            },
          };
          const res = await fetch(url, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const t = await res.text();
            throw new Error(`REST patch failed: ${res.status} ${t}`);
          }
          try { window.dispatchEvent(new CustomEvent("collection:changed")); } catch { }
        } catch (restErr) {
          console.error("REST rating update failed:", restErr);
          setNotice({ title: "Error", message: "Failed to set rating (see console)." });
        }
      }
    },
    [user]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="flex items-center justify-between gap-4 border-b-2 border-(--border) px-4 py-3">
          <div>
            <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              MyGameList
            </h1>
            <p className="mt-1 text-xs tracking-[0.35em] text-(--muted)">COLLECTION</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-5 py-3 text-sm uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
          >
            Add Game
          </button>
        </div>

        <div className="px-4 py-6">
          {loading ? (
            <div className="text-sm text-(--muted)">Checking login…</div>
          ) : !user ? (
            <div className="text-sm text-(--muted)">Log in to add game data</div>
          ) : error ? (
            <div className="text-sm text-(--muted)">Error loading collection: {error}</div>
          ) : games.length === 0 ? (
            <div className="text-sm text-(--muted)">No entries yet.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              {games.map((g) => (
                <article key={g.id} className="border-2 border-(--border) bg-(--surface)">
                  <div className="grid grid-cols-[9rem_1fr] gap-4 p-4">
                    <div>
                      <div className="h-48 w-36 overflow-hidden border-2 border-(--border) bg-(--surface-muted)">
                        {g.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => setGameDataFor(g)}
                        className="mt-2 w-full cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
                      >
                        Game Data
                      </button>
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-foreground">{g.title ?? g.name ?? "Untitled"}</div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-(--muted)">
                        <div>
                          <span className="uppercase tracking-[0.35em]">Added</span>
                          <div className="mt-1 text-sm text-foreground">{formatAddedDate(g.addedAt)}</div>
                        </div>
                        <div>
                          <span className="uppercase tracking-[0.35em]">Release</span>
                          <div className="mt-1 text-sm text-foreground">
                            {g.first_release_date ? new Date(g.first_release_date * 1000).toLocaleDateString() : (g.releaseDate ?? "TBD")}
                          </div>
                        </div>
                      </div>

                      <ExpandableText
                        id={g.id}
                        text={g.summary}
                        expanded={Boolean(expandedSummaries?.[g.id])}
                        onToggle={(id, next) => setExpandedSummaries((prev) => ({ ...prev, [id]: next }))}
                        previewChars={SUMMARY_PREVIEW_CHARS}
                      />

                      <div className="mt-3 flex items-center gap-2">
                        <label className="text-xs text-(--muted)">Your Rating:</label>

                        <div className="relative" data-rating-popup-id={String(g.id)}>
                          <button
                            type="button"
                            onClick={() => setRatingPickerFor((cur) => (String(cur) === String(g.id) ? null : g.id))}
                            className="w-24 cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-center text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
                          >
                            {formatUserRating(g.rating)}
                          </button>

                          {String(ratingPickerFor) === String(g.id) ? (
                            <div className="absolute right-0 top-full z-10 mt-2 w-64 border-2 border-(--border) bg-(--surface) p-2">
                              <div className="grid grid-cols-5 gap-2">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => {
                                      handleRating(g.id, n);
                                      setRatingPickerFor(null);
                                    }}
                                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-2 py-2 text-xs font-semibold text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  handleRating(g.id, 0);
                                  setRatingPickerFor(null);
                                }}
                                className="mt-2 w-full cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
                              >
                                Clear
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => setRemoveConfirmFor({ id: g.id, title: g.title ?? g.name ?? "this game" })}
                          className="ml-auto cursor-pointer border-2 border-(--border) bg-red-600 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={Boolean(removeConfirmFor)}
        title="Remove Game"
        message={
          removeConfirmFor
            ? `Remove ${removeConfirmFor.title} from your collection? Your data for this game will be gone.`
            : ""
        }
        cancelText="Cancel"
        confirmText="Remove"
        danger
        onCancel={() => setRemoveConfirmFor(null)}
        onConfirm={async () => {
          const id = removeConfirmFor?.id;
          setRemoveConfirmFor(null);
          if (id == null) return;
          await handleRemove(id);
        }}
      />

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        buttonText={notice?.buttonText ?? "OK"}
        onClose={() => setNotice(null)}
        onAction={notice?.onAction}
      />

      <AddGameModal
        open={isAddOpen}
        user={user}
        onClose={() => setIsAddOpen(false)}
        onNotice={(n) => setNotice(n)}
      />

      <GameDataModal
        open={Boolean(gameDataFor)}
        game={gameDataFor}
        user={user}
        onClose={() => setGameDataFor(null)}
        onSaved={() => setNotice({ title: "Saved", message: "Game data updated." })}
        onError={(msg) => setNotice({ title: "Error", message: msg })}
      />
    </div>
  );
}
