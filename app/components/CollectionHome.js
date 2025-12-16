"use client";

import { useState } from "react";
import { useFirebaseUser } from "../hooks/useFirebaseUser";

export default function CollectionHome() {
  const { user } = useFirebaseUser();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const myGameList = [];

  const isLoggedIn = Boolean(user);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="flex items-center justify-between gap-4 border-b-2 border-(--border) px-4 py-3">
          <div>
            <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              MyGameList
            </h1>
            <p className="mt-1 text-xs tracking-[0.35em] text-(--muted)">
              COLLECTION
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-5 py-3 text-sm uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
          >
            Add Game
          </button>
        </div>

        {!isLoggedIn ? (
          <div className="px-4 py-6 text-sm text-(--muted)">Log in to add game data</div>
        ) : myGameList.length === 0 ? (
          <div className="px-4 py-6 text-sm text-(--muted)">No entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm"></table>
          </div>
        )}
      </section>

      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!isAddOpen}
        className={`fixed inset-0 z-50 grid place-items-center px-4 transition-opacity duration-150 ease-out motion-reduce:transition-none ${isAddOpen ? "opacity-100" : "pointer-events-none opacity-0"
          } bg-black/60`}
        onClick={() => {
          if (!isAddOpen) return;
          setIsAddOpen(false);
        }}
      >
        <div
          className={`w-full max-w-lg border-2 border-(--border) bg-(--surface) transition-all duration-150 ease-out motion-reduce:transition-none ${isAddOpen ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
            }`}
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
            <p className="text-sm text-(--muted)">Big box for lots of games lule</p>

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
              <div className="mt-3 text-sm text-(--muted)">{isLoggedIn ? "Search will appear here." : "Log in to add game data"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
