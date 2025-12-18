"use client";

import { Space_Mono, Bebas_Neue } from "next/font/google";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "700"],
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import LoginModal from "../components/LoginModal";
import { useFirebaseUser } from "../hooks/useFirebaseUser";
import { useUserSettings } from "../hooks/useUserSettings";
import { normalizeTheme } from "../lib/themes";

function SiteHeader() {
  const { user } = useFirebaseUser();
  const { username } = useUserSettings(user);
  const pathname = usePathname();
  const router = useRouter();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const isLoggedIn = Boolean(user);

  function navClass(href) {
    const isActive = pathname === href;
    return `cursor-pointer border-2 px-2 py-1 transition-colors ${isActive
      ? "border-(--border-strong) bg-(--surface) text-foreground"
      : "border-(--border) bg-(--surface-muted) text-(--muted) hover:bg-(--surface) hover:text-foreground"
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
            <div className="text-foreground">
              <div className="text-[0.65rem] uppercase tracking-[0.5em] text-(--muted)">Database</div>
              <div className="text-2xl leading-none" style={{ fontFamily: bebas.style.fontFamily }}>
                MyGameList
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-(--muted)">
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
                  className="max-w-[16rem] truncate text-xs font-semibold uppercase tracking-[0.35em] text-foreground"
                  title={displayName}
                >
                  {displayName}
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className={`grid h-9 w-10 place-items-center cursor-pointer border-2 border-(--border-strong) text-xs font-semibold uppercase tracking-[0.35em] text-foreground transition-colors hover:bg-(--surface) ${pathname === "/settings" ? "bg-(--surface)" : "bg-(--surface-muted)"
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
                className="cursor-pointer border-2 border-(--border-strong) bg-(--surface-muted) px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-foreground transition-colors hover:bg-(--surface)"
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
    // theme lives on <html data-theme>, so css vars just work everywhere
    document.documentElement.dataset.theme = normalizeTheme(settings?.theme);
  }, [settings?.theme]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {children}
    </main>
  );
}

