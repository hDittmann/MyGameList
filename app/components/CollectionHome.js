"use client";

import { useEffect, useState, useCallback } from "react";
import { useFirebaseUser } from "../hooks/useFirebaseUser";
import { getFirebaseDb } from "../lib/firebaseClient";
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
      if (!user) return alert("Sign in to remove items");
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "games", String(gameId));
        await deleteDoc(ref);
        try { window.dispatchEvent(new CustomEvent("collection:changed")); } catch { }
        alert("Removed from collection.");
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
          alert("Removed from collection.");
        } catch (restErr) {
          console.error("REST delete failed:", restErr);
          alert("Failed to remove item (see console)");
        }
      }
    },
    [user]
  );

  const handleRating = useCallback(
    async (gameId, value) => {
      if (!user) return alert("Sign in to rate items");
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
          alert("Failed to set rating (see console)");
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
                  <div className="grid grid-cols-[7.5rem_1fr] gap-4 p-4">
                    <div className="h-40 w-30 overflow-hidden border-2 border-(--border) bg-(--surface-muted)">
                      {g.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-foreground">{g.title ?? g.name ?? "Untitled"}</div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-(--muted)">
                        <div>
                          <span className="uppercase tracking-[0.35em]">Added</span>
                          <div className="mt-1 text-sm text-foreground">{g.addedAt?.toDate ? g.addedAt.toDate().toLocaleString() : "—"}</div>
                        </div>
                        <div>
                          <span className="uppercase tracking-[0.35em]">Release</span>
                          <div className="mt-1 text-sm text-foreground">{g.first_release_date ? new Date(g.first_release_date * 1000).toLocaleDateString() : (g.releaseDate ?? "TBD")}</div>
                        </div>
                      </div>

                      {g.summary ? (
                        <p className="mt-3 max-h-16 overflow-hidden text-xs text-(--muted)">{g.summary}</p>
                      ) : (
                        <p className="mt-3 text-xs text-(--muted)">No description.</p>
                      )}

                      <div className="mt-3 flex items-center gap-3">
                        <label className="text-xs text-(--muted)">Your Rating:</label>
                        <select
                          value={g.rating ?? "0"}
                          onChange={(e) => handleRating(g.id, e.target.value)}
                          className="border-2 border-(--border) bg-(--surface-muted) px-2 py-1 text-sm"
                        >
                          <option value="0">No rating</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemove(g.id)}
                          className="cursor-pointer border-2 border-(--border) bg-red-600 px-3 py-1 text-xs uppercase tracking-[0.35em] text-white"
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
    </div>
  );
}
