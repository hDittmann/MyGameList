"use client";

import { useEffect, useMemo, useState } from "react";

function formatReleaseDate(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "TBD";
  const d = new Date(s * 1000);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function getDisplayRating(game) {
  return game?.total_rating ?? game?.aggregated_rating ?? game?.rating ?? null;
}

function getDisplayRatingCount(game) {
  return game?.total_rating_count ?? game?.aggregated_rating_count ?? game?.rating_count ?? null;
}

function formatRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function formatCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString();
}

export default function NewReleases() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  async function load({ q, nextPage }) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", "20");
      params.set("page", String(nextPage));
      if (q && q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/igdb/new-releases?${params.toString()}`);
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

  useEffect(() => {
    load({ q: "", nextPage: 1 });
  }, []);

  const sortedGames = useMemo(() => {
    const copy = [...games];
    copy.sort((a, b) => {
      const ad = Number(a?.first_release_date ?? -1);
      const bd = Number(b?.first_release_date ?? -1);
      if (bd !== ad) return bd - ad;
      // shows higher rated games first when release dates are the same
      const ar = Number(getDisplayRating(a) ?? -1);
      const br = Number(getDisplayRating(b) ?? -1);
      return br - ar;
    });
    return copy;
  }, [games]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="flex flex-col gap-3 border-b-2 border-(--border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              NEW RELEASES
            </h1>
            <p className="mt-1 text-xs tracking-[0.35em] text-(--muted)">
              {activeQuery ? `SEARCH: ${activeQuery}` : ""}
            </p>
          </div>

          <form
            className="flex w-full items-center gap-2 sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              setActiveQuery(q);
              load({ q, nextPage: 1 });
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games"
              className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted) sm:w-72"
            />
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
                load({ q: "", nextPage: 1 });
              }}
              className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-4 py-3">
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

        {error ? (
          <div className="px-4 py-6 text-sm text-(--muted)">{error}</div>
        ) : loading ? (
          <div className="px-4 py-6 text-sm text-(--muted)">Loading…</div>
        ) : sortedGames.length === 0 ? (
          <div className="px-4 py-6 text-sm text-(--muted)">No releases found.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            {sortedGames.map((g) => (
              <article key={g.id} className="border-2 border-(--border) bg-(--surface)">
                <div className="grid grid-cols-[7.5rem_1fr] gap-4 p-4">
                  <div className="h-40 w-30 overflow-hidden border-2 border-(--border) bg-(--surface-muted)">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-foreground">{g.name}</div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-(--muted)">
                      <div>
                        <span className="uppercase tracking-[0.35em]">Date</span>
                        <div className="mt-1 text-sm text-foreground">{formatReleaseDate(g.first_release_date)}</div>
                      </div>
                      <div>
                        <span className="uppercase tracking-[0.35em]">Rating</span>
                        {(() => {
                          const rating = getDisplayRating(g);
                          const ratingCount = getDisplayRatingCount(g);
                          const ratingCountText = formatCount(ratingCount);

                          if (!Number.isFinite(Number(rating))) {
                            return <div className="mt-1 text-sm text-foreground">Not yet rated</div>;
                          }

                          return (
                            <div className="mt-1 text-sm text-foreground">
                              {formatRating(rating)}
                              {ratingCountText ? <span className="ml-2 text-xs text-(--muted)">({ratingCountText} ratings)</span> : null}
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <span className="uppercase tracking-[0.35em]">IGDB Id</span>
                        <div className="mt-1 text-sm text-foreground">{g.id}</div>
                      </div>
                    </div>

                    {g.summary ? (
                      <p className="mt-3 max-h-16 overflow-hidden text-xs text-(--muted)">{g.summary}</p>
                    ) : (
                      <p className="mt-3 text-xs text-(--muted)">No description.</p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
