"use client";

import { Bebas_Neue } from "next/font/google";

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

import { useEffect, useState, useCallback } from "react";
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
} from "firebase/firestore";

export default function CollectionHome() {
  const { user, loading } = useFirebaseUser();
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const [removeConfirmFor, setRemoveConfirmFor] = useState(null);
  const [notice, setNotice] = useState(null);
  const [gameDataFor, setGameDataFor] = useState(null);

  const SUMMARY_PREVIEW_CHARS = 220;

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

  function formatStatus(rawStatus, completionPercent) {
    const s = typeof rawStatus === "string" ? rawStatus : "";
    if (s === "playing") return "Playing";
    if (s === "completed") return "Completed";
    if (s === "dropped") return "Dropped";
    if (s === "plan") return "Plan to Play";

    const pct = Number(completionPercent);
    if (Number.isFinite(pct) && pct >= 100) return "Completed";
    if (Number.isFinite(pct) && pct > 0) return "Playing";
    return "—";
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="flex items-center justify-between gap-4 border-b-2 border-(--border) px-4 py-3">
          <div>
            <h1 className="text-xl" style={{ fontFamily: bebas.style.fontFamily }}>
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
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setRemoveConfirmFor({ id: g.id, title: g.title ?? g.name ?? "this game" })}
                        className="mt-2 w-full cursor-pointer border-2 border-(--border) bg-red-600 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="min-w-0">
                      <div className="text-base font-semibold text-foreground wrap-break-word whitespace-normal">
                        {g.title ?? g.name ?? "Untitled"}
                        {g.steamUrl ? (
                          <a
                            href={g.steamUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 inline-flex align-middle text-(--muted) hover:text-foreground"
                            title="Open on Steam"
                            aria-label="Open on Steam"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.28 2.69 7.93 6.46 9.36l-2.3-3.33a2.7 2.7 0 0 1 3.1-3.97l2.61 1.09a4.8 4.8 0 1 0 4.22-7.02 4.79 4.79 0 0 0-4.78 4.8c0 .45.06.9.18 1.33l-2.7-1.13a4.24 4.24 0 0 0-1.61-.33c-1.26 0-2.45.55-3.26 1.52L3.3 12.1A8.7 8.7 0 0 1 12 3.3c4.8 0 8.7 3.9 8.7 8.7S16.8 20.7 12 20.7c-1.18 0-2.3-.22-3.33-.65l1.65 2.38c.33.03.67.05 1.01.05 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
                            </svg>
                          </a>
                        ) : null}
                      </div>
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

                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-(--muted)">
                        <div>
                          <span className="uppercase tracking-[0.35em]">Status</span>
                          <div className="mt-1 text-sm text-foreground">
                            {formatStatus(g?.playthrough?.status, g?.playthrough?.completionPercent)}
                          </div>
                        </div>
                        <div>
                          <span className="uppercase tracking-[0.35em]">Your Rating</span>
                          <div className="mt-1 text-sm text-foreground">{formatUserRating(g.rating)}</div>
                        </div>
                        <div>
                          <span className="uppercase tracking-[0.35em]">Hours</span>
                          <div className="mt-1 text-sm text-foreground">
                            {g?.playthrough?.hoursPlayed != null ? String(g.playthrough.hoursPlayed) : "—"}
                          </div>
                        </div>
                        <div>
                          <span className="uppercase tracking-[0.35em]">Achievements</span>
                          <div className="mt-1 text-sm text-foreground">Not Yet Implemented</div>
                        </div>
                      </div>

                      <ExpandableText
                        id={g.id}
                        text={g.summary}
                        expanded={Boolean(expandedSummaries?.[g.id])}
                        onToggle={(id, next) => setExpandedSummaries((prev) => ({ ...prev, [id]: next }))}
                        previewChars={SUMMARY_PREVIEW_CHARS}
                      />

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
