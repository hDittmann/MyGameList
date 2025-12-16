"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";

import LoginModal from "../components/LoginModal";
import LogoutConfirmModal from "../components/LogoutConfirmModal";
import { useFirebaseUser } from "../hooks/useFirebaseUser";
import { getFirebaseAuth } from "../lib/firebaseClient";

export default function SiteHeader() {
  const { user } = useFirebaseUser();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoggedIn = Boolean(user);

  async function handleLogout() {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch (err) {
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
              <Link href="/top-games" className="cursor-pointer border border-white/30 bg-white/5 px-2 py-1 transition-colors hover:border-white/60 hover:bg-white/10 hover:text-white">
                Top Games
              </Link>
              <Link href="/new-releases" className="cursor-pointer border border-white/30 bg-white/5 px-2 py-1 transition-colors hover:border-white/60 hover:bg-white/10 hover:text-white">
                New Releases
              </Link>
              <Link href="/my-collection" className="cursor-pointer border border-white/30 bg-white/5 px-2 py-1 transition-colors hover:border-white/60 hover:bg-white/10 hover:text-white">
                My Collection
              </Link>
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
                onClick={() => setIsLoginOpen(true)}
                className="cursor-pointer border-2 border-(--border-strong) bg-(--surface) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white transition-colors hover:border-white/70 hover:bg-white/10 hover:text-white"
              >
                Login
              </button>
            )}
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
    </header>
  );
}
