"use client";

import { useMemo, useState } from "react";

export default function Home() {
  const isLoggedIn = false;
  const [isAddOpen, setIsAddOpen] = useState(false);
  const myAnimeList = useMemo(() => [], []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b-2 border-(--border) bg-(--primary)">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="text-white">
                <div className="text-[0.65rem] uppercase tracking-[0.5em] text-white/70">Database</div>
                <div className="text-2xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  MyGameList
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/80">
                <span className="border border-white/30 bg-white/5 px-2 py-1">Top Games</span>
                <span className="border border-white/30 bg-white/5 px-2 py-1">New Releases</span>
              </nav>
              <button
                type="button"
                className="border-2 border-(--border-strong) bg-(--surface) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="border-2 border-(--border) bg-(--surface)">
          <div className="flex items-center justify-between gap-4 border-b-2 border-(--border) px-4 py-3">
            <div>
              <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
                My Anime List
              </h1>
              <p className="mt-1 text-xs uppercase tracking-[0.35em] text-(--muted)">
                Your entries
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="border-2 border-(--border) bg-(--surface-muted) px-5 py-3 text-sm uppercase tracking-[0.35em] text-(--muted)"
            >
              Add Game
            </button>
          </div>

          {!isLoggedIn ? (
            <div className="px-4 py-6 text-sm text-(--muted)">
              Log in to add game data
            </div>
          ) : myAnimeList.length === 0 ? (
            <div className="px-4 py-6 text-sm text-(--muted)">No entries yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-(--surface-muted) text-xs uppercase tracking-[0.25em] text-(--muted)">
                  <tr>
                    <th className="border-b-2 border-(--border) px-4 py-3 text-left">Title</th>
                    <th className="border-b-2 border-(--border) px-4 py-3 text-left">Status</th>
                    <th className="border-b-2 border-(--border) px-4 py-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {myAnimeList.map((item) => (
                    <tr key={item.id} className="odd:bg-(--surface) even:bg-(--surface-muted)">
                      <td className="border-b border-(--border) px-4 py-3">
                        <div className="font-semibold text-foreground">{item.title}</div>
                      </td>
                      <td className="border-b border-(--border) px-4 py-3 text-(--muted)">
                        {item.status ?? "—"}
                      </td>
                      <td className="border-b border-(--border) px-4 py-3 text-right">
                        <span className="inline-block min-w-[2.5rem]">{item.rating ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
          onClick={() => setIsAddOpen(false)}
        >
          <div
            className="w-full max-w-lg border-2 border-(--border) bg-(--surface)"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-(--border) px-4 py-3">
              <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
                Add Game
              </h2>
              <button
                type="button"
                className="border-2 border-(--border) bg-(--surface-muted) px-2 py-1 text-xs uppercase tracking-[0.35em] text-(--muted)"
                onClick={() => setIsAddOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="px-4 py-4">
              <p className="text-sm text-(--muted)">
                Big box for lots of games lule
              </p>

              <div className="mt-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Search</span>
                  <input
                    type="search"
                    placeholder="Search games"
                    className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                    disabled
                  />
                </label>
                <div className="mt-3 text-sm text-(--muted)">
                  {isLoggedIn ? "Search will appear here." : "Log in to add game data"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
