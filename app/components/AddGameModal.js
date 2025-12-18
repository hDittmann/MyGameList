"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebaseClient";
import { FilterRange } from "./FilterControls";
import { useUserSettings } from "../hooks/useUserSettings";
import TagPickerModal from "./TagPickerModal";
import SteamIcon from "./SteamIcon";

export default function AddGameModal({ open, user, onClose, onNotice }) {
  const { settings } = useUserSettings(user);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [games, setGames] = useState([]);
  const [collectionIds, setCollectionIds] = useState(() => new Set());

  const [hideMature, setHideMature] = useState(true);
  const [minRating, setMinRating] = useState(0);
  const [minRatingUi, setMinRatingUi] = useState(0);
  const [tagFilters, setTagFilters] = useState([]);
  const [tagFilterText, setTagFilterText] = useState("");

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerDraft, setTagPickerDraft] = useState([]);

  const close = useCallback(() => {
    if (!open) return;
    onClose?.();
  }, [open, onClose]);

  async function load({ q, nextPage, append, nextMinRating, nextTagFilters, nextHideMature }) {
    // fetch a filtered/paginated slice from our server route (keeps igdb creds server-side)
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "20");
      params.set("page", String(nextPage));
      if (q && q.trim()) params.set("q", q.trim());

      const min = Number(nextMinRating ?? minRating) || 0;
      const tags = Array.isArray(nextTagFilters) ? nextTagFilters : normalizedTags;
      const hm = typeof nextHideMature === "boolean" ? nextHideMature : hideMature;
      if (min > 0) params.set("minRating", String(min));
      if (tags.length) params.set("tags", tags.join(","));
      params.set("hideMature", hm ? "1" : "0");

      const res = await fetch(`/api/igdb/top-games?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load IGDB data");
      const nextGames = Array.isArray(data?.games) ? data.games : [];
      setGames((prev) => (append ? [...prev, ...nextGames] : nextGames));
      setHasMore(Boolean(data?.hasMore));
      setPage(nextPage);
    } catch (e) {
      setError(e?.message ?? "Something went wrong");
      setGames([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveQuery("");
    setGames([]);
    setPage(1);
    setHasMore(false);
    setError(null);

    // initialize modal filters from saved settings
    const nextHideMature = typeof settings?.hideMature === "boolean" ? settings.hideMature : true;
    const nextMin = Number(settings?.minRating) || 0;
    const nextTags = Array.isArray(settings?.tagFilters) ? settings.tagFilters.filter(Boolean) : [];

    setHideMature(nextHideMature);
    setMinRating(nextMin);
    setMinRatingUi(nextMin);
    setTagFilters(nextTags);
    setTagFilterText(nextTags.join(", "));

    load({ q: "", nextPage: 1, append: false, nextMinRating: nextMin, nextTagFilters: nextTags, nextHideMature });
  }, [open, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    if (!user) {
      setCollectionIds(new Set());
      return;
    }

    // keep a quick set of ids so we can disable "add" for stuff you already own

    let cancelled = false;

    async function fetchIds() {
      try {
        const db = getFirebaseDb();
        const colRef = collection(db, "users", user.uid, "games");
        const snap = await getDocs(colRef);
        if (cancelled) return;
        const next = new Set(snap.docs.map((d) => String(d.id)));
        setCollectionIds(next);
      } catch (e) {
        if (!cancelled) setCollectionIds(new Set());
      }
    }

    fetchIds();

    function onCollectionChanged() {
      fetchIds();
    }
    window.addEventListener("collection:changed", onCollectionChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("collection:changed", onCollectionChanged);
    };
  }, [open, user]);

  // prevent background scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const normalizedTags = useMemo(() => {
    return (tagFilters ?? []).map((t) => String(t).trim()).filter(Boolean);
  }, [tagFilters]);

  const availableTagsByType = useMemo(() => {
    const merged = { genres: [], themes: [], modes: [], perspectives: [] };
    const seen = {
      genres: new Set(),
      themes: new Set(),
      modes: new Set(),
      perspectives: new Set(),
    };

    function add(type, value) {
      const name = String(value ?? "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen[type].has(key)) return;
      seen[type].add(key);
      merged[type].push(name);
    }

    for (const g of games ?? []) {
      const t = g?.tagsByType;
      if (!t) continue;
      for (const x of t.genres ?? []) add("genres", x);
      for (const x of t.themes ?? []) add("themes", x);
      for (const x of t.modes ?? []) add("modes", x);
      for (const x of t.perspectives ?? []) add("perspectives", x);
    }

    merged.genres.sort((a, b) => a.localeCompare(b));
    merged.themes.sort((a, b) => a.localeCompare(b));
    merged.modes.sort((a, b) => a.localeCompare(b));
    merged.perspectives.sort((a, b) => a.localeCompare(b));
    return merged;
  }, [games]);

  function renderTagGroups(game) {
    const byType = game?.tagsByType;
    if (!byType || typeof byType !== "object") return null;

    const groups = [
      ["Genres", byType.genres],
      ["Themes", byType.themes],
      ["Modes", byType.modes],
      ["Perspectives", byType.perspectives],
    ];

    const rows = groups
      .filter(([, list]) => Array.isArray(list) && list.length)
      .map(([label, list]) => (
        <div key={label} className="text-xs text-(--muted)">
          <span className="uppercase tracking-[0.35em]">{label}</span>
          <div className="mt-1 text-sm text-foreground">{list.join(", ")}</div>
        </div>
      ));

    if (!rows.length) return null;
    return <div className="mt-2 grid grid-cols-1 gap-2">{rows}</div>;
  }

  const handleAdd = useCallback(
    async (game) => {
      if (!user) {
        onNotice?.({ title: "Sign in", message: "Please sign in to add games to your collection." });
        return;
      }

      if (collectionIds.has(String(game?.id))) {
        onNotice?.({ title: "Already added", message: "That game is already in your collection." });
        return;
      }

      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "games", String(game.id));
        await setDoc(
          ref,
          {
            id: game.id,
            title: game.name ?? game.title ?? "",
            name: game.name ?? game.title ?? "",
            summary: game.summary ?? null,
            first_release_date: game.first_release_date ?? null,
            coverUrl: game.coverUrl ?? null,
            coverImageId: game.coverImageId ?? null,
            steamUrl: game.steamUrl ?? null,
            addedAt: serverTimestamp(),
          },
          { merge: true }
        );
        try {
          window.dispatchEvent(new CustomEvent("collection:changed"));
        } catch { }
        onNotice?.({ title: "Added", message: `${game.name ?? game.title ?? "Game"} added to your collection.` });
        close();
      } catch (err) {
        console.error("Failed to add game:", err);
        onNotice?.({ title: "Error", message: "Failed to add game (see console)." });
      }
    },
    [user, onNotice, close, collectionIds]
  );

  if (!open) return null;

  return (
    <>
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
        }}
        tabIndex={-1}
      >
        <div
          className="flex w-full max-w-3xl max-h-[90vh] flex-col border-2 border-(--border) bg-(--surface)"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b-2 border-(--border) px-4 py-3">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              Add Game
            </h2>
            <button
              type="button"
              onClick={close}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
            >
              Close
            </button>
          </div>

          <div className="px-4 py-4 overflow-y-auto">
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                const q = query.trim();
                setActiveQuery(q);
                load({ q, nextPage: 1, append: false });
              }}
            >
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games"
                className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Search
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setQuery("");
                    setActiveQuery("");
                    setTagFilters([]);
                    setTagFilterText("");
                    setTagPickerDraft([]);
                    load({ q: "", nextPage: 1, append: false, nextTagFilters: [] });
                  }}
                  className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Min rating</div>
                  <div className="text-xs text-(--muted)">{minRatingUi > 0 ? `${minRatingUi}+` : "Any"}</div>
                </div>
                <div className="mt-2">
                  <FilterRange
                    value={minRatingUi}
                    onChange={setMinRatingUi}
                    onCommit={(v) => {
                      setMinRating(v);
                      load({ q: activeQuery, nextPage: 1, append: false, nextMinRating: v });
                    }}
                    min={0}
                    max={100}
                    step={1}
                    title="Minimum rating"
                  />
                </div>
              </div>

              <div className="min-w-56 flex-1">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Tags</div>
                <input
                  value={tagFilterText}
                  readOnly
                  onClick={() => {
                    setTagPickerDraft(normalizedTags);
                    setTagPickerOpen(true);
                  }}
                  placeholder="Click to pick tags"
                  title="Filter results by tags"
                  className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                />
              </div>
            </div>

            {activeQuery ? (
              <p className="mt-3 text-xs tracking-[0.35em] text-(--muted)">SEARCH: {activeQuery}</p>
            ) : (
              <p className="mt-3 text-xs tracking-[0.35em] text-(--muted)">POPULAR GAMES</p>
            )}

            {error ? <div className="mt-3 text-sm text-(--muted)">Error: {error}</div> : null}

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {games.map((g) => (
                <article key={g.id} className="border-2 border-(--border) bg-(--surface) p-3">
                  <div className="flex gap-3">
                    <div className="h-20 w-16 overflow-hidden border-2 border-(--border) bg-(--surface-muted)">
                      {g.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground wrap-break-word whitespace-normal">
                        {g.name}
                        {g.steamUrl ? (
                          <a
                            href={g.steamUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 inline-flex items-center text-(--muted) hover:text-foreground"
                            title="Open on Steam"
                            aria-label="Open on Steam"
                          >
                            <SteamIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-(--muted)">
                            {g.first_release_date ? new Date(g.first_release_date * 1000).toLocaleDateString() : "TBD"}
                          </div>
                          {(() => {
                            const already = collectionIds.has(String(g?.id));
                            return (
                              <button
                                type="button"
                                onClick={() => handleAdd(g)}
                                disabled={!user || already}
                                className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-1 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {already ? "Added" : "Add"}
                              </button>
                            );
                          })()}
                        </div>

                        {renderTagGroups(g)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-(--muted)">
                {loading ? "Loading…" : `${games.length} results`}
              </div>
              {hasMore ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => load({ q: activeQuery, nextPage: page + 1, append: true })}
                  className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Load more
                </button>
              ) : null}
            </div>

            {!user ? (
              <div className="mt-4 text-sm text-(--muted)">Sign in to add games.</div>
            ) : null}
          </div>
        </div>
      </div>

      <TagPickerModal
        open={tagPickerOpen}
        selectedTags={tagPickerDraft}
        availableTagsByType={availableTagsByType}
        onChange={(next) => setTagPickerDraft(next ?? [])}
        onClose={() => {
          setTagPickerOpen(false);
          const committed = tagPickerDraft ?? [];
          setTagFilters(committed);
          setTagFilterText(committed.join(", "));
          load({ q: activeQuery, nextPage: 1, append: false, nextTagFilters: committed });
        }}
      />
    </>
  );
}
