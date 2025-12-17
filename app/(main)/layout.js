"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import LoginModal from "../components/LoginModal";
import { useFirebaseUser } from "../hooks/useFirebaseUser";
import { useUserSettings } from "../hooks/useUserSettings";

function SiteHeader() {
  const { user } = useFirebaseUser();
  const { username } = useUserSettings(user);
  const pathname = usePathname();
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const isLoggedIn = Boolean(user);

  function navClass(href) {
    const isActive = pathname === href;
    return `cursor-pointer border px-2 py-1 transition-colors ${isActive
      ? "border-white/70 bg-white/15 text-white"
      : "border-white/30 bg-white/5 hover:border-white/60 hover:bg-white/10 hover:text-white"
      }`;
  }

  const displayName = (typeof username === "string" && username.trim())
    ? username.trim()
    : (user?.email ?? "Account");

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
              <Link
                href="/top-games"
                className={navClass("/top-games")}
              >
                Top Games
              </Link>
              <Link
                href="/new-releases"
                className={navClass("/new-releases")}
              >
                New Releases
              </Link>
              <Link
                href="/my-collection"
                className={navClass("/my-collection")}
              >
                My Collection
              </Link>
            </nav>
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <div
                  className="max-w-[16rem] truncate text-xs font-semibold uppercase tracking-[0.35em] text-white"
                  title={displayName}
                >
                  {displayName}
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className={`grid h-9 w-10 place-items-center cursor-pointer border-2 border-(--border-strong) text-xs font-semibold uppercase tracking-[0.35em] text-white transition-colors hover:border-white/70 hover:bg-white/10 hover:text-white ${pathname === "/settings" ? "bg-white/10" : "bg-(--surface)"
                    }`}
                  aria-label="Settings"
                  title="Settings"
                >
                  ⚙
                </button>
              </div>
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
    </header>
  );
}

export default function MainLayout({ children }) {
  const { user } = useFirebaseUser();
  const { settings } = useUserSettings(user);

  useEffect(() => {
    const theme = settings?.theme === "light" ? "light" : "dark";
    const font = settings?.font === "readable" ? "readable" : "default";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.font = font;
  }, [settings?.theme, settings?.font]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {children}
    </main>
  );
}

