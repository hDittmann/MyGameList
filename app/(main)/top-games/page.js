"use client";

import { Bebas_Neue } from "next/font/google";

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFirebaseUser } from "../../hooks/useFirebaseUser";
import { getFirebaseDb } from "../../lib/firebaseClient";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import NoticeModal from "../../components/NoticeModal";
import ExpandableText from "../../components/ExpandableText";
import { FilterPill, FilterRange, FilterTextInput } from "../../components/FilterControls";
import { useUserSettings } from "../../hooks/useUserSettings";
import TagPickerModal from "../../components/TagPickerModal";

function getDisplayRating(game) {
  return game?.total_rating ?? game?.aggregated_rating ?? game?.rating ?? null;
}

function getDisplayVoteCount(game) {
  return game?.total_rating_count ?? game?.aggregated_rating_count ?? game?.rating_count ?? null;
}

function formatRating(value) {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n <= 0) return "—";
  return n.toFixed(1);
}

function formatReleaseDate(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "TBD";
  const d = new Date(s * 1000);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function getDisplayRankedRating(game) {
  const raw = game?.weighted_rating;
  const weighted = raw == null ? null : Number(raw);
  if (Number.isFinite(weighted) && weighted > 0) return weighted;
  return getDisplayRating(game);
}

function getTags(game) {
  return Array.isArray(game?.tags) ? game.tags : [];
}

export default function TopGames() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState({});
  const [expandedTags, setExpandedTags] = useState({});
  const [notice, setNotice] = useState(null);
  const { user } = useFirebaseUser();
  const { settings } = useUserSettings(user);
  const router = useRouter();
  const [collectionIds, setCollectionIds] = useState(() => new Set());

  const [hideMature, setHideMature] = useState(true);
  const [minRating, setMinRating] = useState(0);
  const [minRatingUi, setMinRatingUi] = useState(0);
  const [tagFilters, setTagFilters] = useState([]);
  const [tagFilterText, setTagFilterText] = useState("");

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagPickerDraft, setTagPickerDraft] = useState([]);

  const SUMMARY_PREVIEW_CHARS = 220;

  useEffect(() => {
    // initialize from settings
    const nextHideMature = typeof settings?.hideMature === "boolean" ? settings.hideMature : true;
    const nextMin = Number(settings?.minRating) || 0;
    const nextTags = Array.isArray(settings?.tagFilters) ? settings.tagFilters.filter(Boolean) : [];

    setHideMature(nextHideMature);
    setMinRating(nextMin);
    setMinRatingUi(nextMin);
    setTagFilters(nextTags);
    setTagFilterText(nextTags.join(", "));

    // apply settings immediately.
    load({ q: activeQuery, nextPage: 1, nextMinRating: nextMin, nextTagFilters: nextTags, nextHideMature });
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      setCollectionIds(new Set());
      return;
    }

    let cancelled = false;

    async function fetchIds() {
      try {
        const db = getFirebaseDb();
        const colRef = collection(db, "users", user.uid, "games");
        const snap = await getDocs(colRef);
        if (cancelled) return;
        setCollectionIds(new Set(snap.docs.map((d) => String(d.id))));
      } catch {
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
  }, [user]);

  const normalizedTagFilters = useMemo(() => {
    return (tagFilters ?? []).map((t) => String(t).trim()).filter(Boolean);
  }, [tagFilters]);

  const handleAdd = useCallback(
    async (game) => {
      if (!user) {
        setNotice({
          title: "Sign in",
          message: "Please sign in to add games to your collection.",
          buttonText: "Go to My Collection",
          onAction: async () => router.push("/my-collection"),
        });
        return;
      }

      if (collectionIds.has(String(game?.id))) {
        setNotice({ title: "Already added", message: "That game is already in your collection." });
        return;
      }

      try {
        // show some quick debug info if something's off
        if (user && !user.uid) {
          setNotice({ title: "Auth", message: "Logged in user found but missing uid — check auth state in console." });
        }
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid, "games", String(game.id));
        await setDoc(ref, {
          id: game.id,
          title: game.name ?? game.title ?? "",
          name: game.name ?? game.title ?? "",
          summary: game.summary ?? null,
          first_release_date: game.first_release_date ?? null,
          coverUrl: game.coverUrl ?? null,
          coverImageId: game.coverImageId ?? null,
          steamUrl: game.steamUrl ?? null,
          addedAt: serverTimestamp(),
        });
        // notify collection component to refresh (fallback for blocked realtime)
        try {
          window.dispatchEvent(new CustomEvent("collection:changed"));
        } catch { }
        setNotice({ title: "Added", message: `${game.name ?? game.title} added to your collection.` });
      } catch (err) {
        console.error("Failed to add game:", err);
        // attempt rest fallback write (works without webchannel)
        try {
          const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
          const docId = String(game.id);
          const idToken = await user.getIdToken();
          const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${user.uid}/games?documentId=${docId}`;
          const fields = {
            id: { integerValue: String(game.id) },
            title: { stringValue: String(game.name ?? game.title ?? "") },
            name: { stringValue: String(game.name ?? game.title ?? "") },
            addedAt: { timestampValue: new Date().toISOString() },
          };

          if (typeof game?.summary === "string" && game.summary.trim()) {
            fields.summary = { stringValue: game.summary };
          }
          if (Number.isFinite(Number(game?.first_release_date))) {
            fields.first_release_date = { integerValue: String(Number(game.first_release_date)) };
          }
          if (typeof game?.coverUrl === "string" && game.coverUrl.trim()) {
            fields.coverUrl = { stringValue: game.coverUrl };
          }
          if (typeof game?.coverImageId === "string" && game.coverImageId.trim()) {
            fields.coverImageId = { stringValue: game.coverImageId };
          }

          const body = { fields };

          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`REST write failed: ${res.status} ${text}`);
          }

          try { window.dispatchEvent(new CustomEvent("collection:changed")); } catch { }
          setNotice({ title: "Added", message: `${game.name ?? game.title} added to your collection.` });
        } catch (restErr) {
          console.error("REST fallback failed:", restErr);
          setNotice({ title: "Error", message: `Failed to add game: ${err?.message ?? String(err)} (see console)` });
        }
      }
    },
    [user, router, collectionIds]
  );

  async function load({ q, nextPage, nextMinRating, nextTagFilters, nextHideMature }) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "20");
      params.set("page", String(nextPage));
      if (q && q.trim()) params.set("q", q.trim());

      const min = Number(nextMinRating ?? minRating) || 0;
      const tags = Array.isArray(nextTagFilters) ? nextTagFilters : normalizedTagFilters;
      const hm = typeof nextHideMature === "boolean" ? nextHideMature : hideMature;

      if (min > 0) params.set("minRating", String(min));
      if (tags.length) params.set("tags", tags.join(","));
      params.set("hideMature", hm ? "1" : "0");

      const res = await fetch(`/api/igdb/top-games?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load IGDB data");

      setGames(Array.isArray(data?.games) ? data.games : []);
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="border-b-2 border-(--border) px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div style={{ width: '100px', height: '56px' }}>
              <h1 className="text-xl" style={{ fontFamily: bebas.style.fontFamily, lineHeight: '80px' }}>
                TOP GAMES
              </h1>
            </div>
            <form
              className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto"
              onSubmit={(e) => {
                e.preventDefault();
                const q = query.trim();
                setActiveQuery(q);
                load({ q, nextPage: 1 });
              }}
            >
              <div className="relative w-full lg:w-72">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search games"
                  className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 pr-9 text-sm text-foreground placeholder:text-(--muted)"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    title="Clear"
                    disabled={loading}
                    onClick={() => {
                      setQuery("");
                      setActiveQuery("");
                      load({ q: "", nextPage: 1 });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-(--muted) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <div className="min-w-[16rem] flex-1">
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
                      load({ q: activeQuery, nextPage: 1, nextMinRating: v });
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
                    setTagPickerDraft(normalizedTagFilters);
                    setTagPickerOpen(true);
                  }}
                  placeholder="Click to pick tags"
                  title="Filter by tags"
                  className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-4 py-3">
          <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Page {page}</div>
          <div>
            {activeQuery ? (
              <span className="ml-3 text-m tracking-[0.15em] text-(--muted)">SEARCH: {activeQuery}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => load({ q: activeQuery, nextPage: Math.max(1, page - 1) })}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={loading || !hasMore}
              onClick={() => load({ q: activeQuery, nextPage: page + 1 })}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-6 text-sm text-(--muted)">{error}</div>
        ) : loading ? (
          <div className="px-4 py-6 text-sm text-(--muted)">Loading…</div>
        ) : games.length === 0 ? (
          <div className="px-4 py-6 text-sm text-(--muted)">No results.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            {games.map((g) => (
              <article key={g.id} className="border-2 border-(--border) bg-(--surface)">
                <div className="grid grid-cols-[9rem_1fr] gap-4 p-4">
                  <div className="h-48 w-36 overflow-hidden border-2 border-(--border) bg-(--surface-muted)">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="text-base font-semibold text-foreground wrap-break-word whitespace-normal">
                      {g.name}
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
                        <span className="uppercase tracking-[0.35em]">Reviews</span>
                        <div className="mt-1 text-sm text-foreground">{getDisplayVoteCount(g) ?? "—"}</div>
                      </div>
                      <div>
                        <span className="uppercase tracking-[0.35em]">Rating</span>
                        <div className="mt-1 text-sm text-foreground">{formatRating(getDisplayRankedRating(g))}</div>
                      </div>
                      <div>
                        <span className="uppercase tracking-[0.35em]">Release</span>
                        <div className="mt-1 text-sm text-foreground">{formatReleaseDate(g.first_release_date)}</div>
                      </div>
                      <div>
                        <span className="uppercase tracking-[0.35em]">Tags</span>
                        <div className="mt-1 text-sm">
                          {(() => {
                            const id = g.id;
                            const expanded = Boolean(expandedTags?.[id]);
                            const all = getTags(g);
                            if (!all.length) return <span className="text-(--muted)">—</span>;

                            const wanted = normalizedTagFilters.map((t) => t.toLowerCase());
                            const hasFilter = wanted.length > 0;
                            const matched = hasFilter
                              ? all.filter((tag) => wanted.some((w) => String(tag).toLowerCase().includes(w)))
                              : [];
                            const hasMore = hasFilter ? all.length > matched.length : true;
                            const toggle = () => setExpandedTags((prev) => ({ ...prev, [id]: !expanded }));

                            if (!hasFilter) {
                              if (!expanded) {
                                return (
                                  <button
                                    type="button"
                                    onClick={toggle}
                                    className="cursor-pointer text-(--muted) hover:underline underline-offset-4"
                                  >
                                    Show tags
                                  </button>
                                );
                              }
                              return (
                                <div className="grid gap-1">
                                  <div className="text-foreground leading-snug wrap-break-word">{all.join(", ")}</div>
                                  <button
                                    type="button"
                                    onClick={toggle}
                                    className="cursor-pointer text-left text-(--muted) hover:underline underline-offset-4"
                                  >
                                    Hide tags
                                  </button>
                                </div>
                              );
                            }

                            if (!expanded) {
                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-foreground leading-snug wrap-break-word">{matched.join(", ")}</span>
                                  {hasMore ? (
                                    <button
                                      type="button"
                                      onClick={toggle}
                                      className="cursor-pointer text-(--muted) hover:underline underline-offset-4"
                                    >
                                      Show more...
                                    </button>
                                  ) : null}
                                </div>
                              );
                            }

                            return (
                              <div className="grid gap-1">
                                <div className="text-foreground leading-snug wrap-break-word">{all.join(", ")}</div>
                                <button
                                  type="button"
                                  onClick={toggle}
                                  className="cursor-pointer text-left text-(--muted) hover:underline underline-offset-4"
                                >
                                  Show less
                                </button>
                              </div>
                            );
                          })()}
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

                    <div className="mt-3">
                      {(() => {
                        const already = collectionIds.has(String(g?.id));
                        return (
                          <button
                            type="button"
                            onClick={() => handleAdd(g)}
                            disabled={already}
                            className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-1 text-xs uppercase tracking-[0.35em] text-(--muted) disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {already ? "Added" : "Add to Collection"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-(--border) px-4 py-3">
          <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Page {page}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => load({ q: activeQuery, nextPage: Math.max(1, page - 1) })}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={loading || !hasMore}
              onClick={() => load({ q: activeQuery, nextPage: page + 1 })}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        buttonText={notice?.buttonText ?? "OK"}
        onClose={() => setNotice(null)}
        onAction={notice?.onAction}
      />

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
          load({ q: activeQuery, nextPage: 1, nextTagFilters: committed });
        }}
      />
    </div>
  );
}
