"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";

import LoginModal from "./components/LoginModal";
import LogoutConfirmModal from "./components/LogoutConfirmModal";
import { useFirebaseUser } from "./hooks/useFirebaseUser";
import { getFirebaseAuth } from "./lib/firebaseClient";

const EMPTY_GAME_LIST = [];

export default function Home() {
  const { user } = useFirebaseUser();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const myGameList = EMPTY_GAME_LIST;

  const isLoggedIn = Boolean(user);

  async function handleLogout() {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch (err) {
      // Keep the UI unchanged but surface the issue for debugging.
      console.error("Failed to sign out", err);
    }
  }

  async function confirmLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await handleLogout();
      setIsLogoutOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  }

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
                <span className="cursor-pointer border border-white/30 bg-white/5 px-2 py-1 transition-colors hover:border-white/60 hover:bg-white/10 hover:text-white">
                  Top Games
                </span>
                <span className="cursor-pointer border border-white/30 bg-white/5 px-2 py-1 transition-colors hover:border-white/60 hover:bg-white/10 hover:text-white">
                  New Releases
                </span>
              </nav>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => setIsLogoutOpen(true)}
                  className="cursor-pointer border-2 border-(--border-strong) bg-(--surface) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white transition-colors hover:border-white/70 hover:bg-white/10 hover:text-white"
                >
                  Logout
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginOpen(true);
                  }}
                  className="cursor-pointer border-2 border-(--border-strong) bg-(--surface) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white transition-colors hover:border-white/70 hover:bg-white/10 hover:text-white"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

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
            <div className="px-4 py-6 text-sm text-(--muted)">
              Log in to add game data
            </div>
          ) : myGameList.length === 0 ? (
            <div className="px-4 py-6 text-sm text-(--muted)">No entries yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
              </table>
            </div>
          )}
        </section>
      </div>

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
              <div className="mt-3 text-sm text-(--muted)">
                {isLoggedIn ? "Search will appear here." : "Log in to add game data"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <LoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      <LogoutConfirmModal
        open={isLogoutOpen}
        busy={isLoggingOut}
        onCancel={() => setIsLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </main>
  );
}