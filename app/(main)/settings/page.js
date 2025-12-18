"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { sendPasswordResetEmail, signOut } from "firebase/auth";

import { useFirebaseUser } from "../../hooks/useFirebaseUser";
import { getFirebaseAuth, getFirebaseDb } from "../../lib/firebaseClient";
import ConfirmModal from "../../components/ConfirmModal";
import NoticeModal from "../../components/NoticeModal";
import { FilterSelect } from "../../components/FilterControls";
import { THEMES, normalizeTheme } from "../../lib/themes";

export default function SettingsPage() {
  const { user, loading } = useFirebaseUser();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [username, setUsername] = useState("");
  const [usernameLoaded, setUsernameLoaded] = useState(false);

  const [theme, setTheme] = useState("dark");

  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : null;
        if (data && typeof data.username === "string") {
          setUsername(data.username);
        }
        const settings = data?.settings;
        setTheme(normalizeTheme(settings?.theme));
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setUsernameLoaded(true);
      }
    }

    load();
  }, [user]);

  useEffect(() => {
    // apply immediately so theme swaps are visible without waiting for firestore.
    document.documentElement.dataset.theme = normalizeTheme(theme);
  }, [theme]);

  async function saveUsername() {
    if (!user) {
      setNotice({ title: "Sign in", message: "Please sign in to edit settings." });
      return;
    }

    const nextUsername = username.trim();
    if (nextUsername && nextUsername.length > 24) {
      setNotice({ title: "Username", message: "Username must be 24 characters or less." });
      return;
    }

    setBusy(true);
    try {
      const db = getFirebaseDb();
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          username: nextUsername || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNotice({ title: "Saved", message: "Settings updated." });
    } catch (err) {
      console.error("Failed to save settings:", err);
      setNotice({ title: "Error", message: "Failed to save settings (see console)." });
    } finally {
      setBusy(false);
    }
  }

  async function saveTheme(nextTheme) {
    if (!user) {
      setNotice({ title: "Sign in", message: "Please sign in to edit settings." });
      return;
    }

    const normalized = normalizeTheme(nextTheme);

    setBusy(true);
    try {
      const db = getFirebaseDb();
      const ref = doc(db, "users", user.uid);
      // update only settings.theme so we don't wipe other nested settings fields.
      await setDoc(
        ref,
        {
          settings: {
            theme: normalized,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to save theme:", err);
      setNotice({ title: "Error", message: "Failed to save theme (see console)." });
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordEmail() {
    if (!user?.email) {
      setNotice({ title: "Password", message: "No email on your account." });
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, user.email);
      setNotice({ title: "Password", message: `Password reset email sent to ${user.email}.` });
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      setNotice({ title: "Error", message: "Failed to send password email (see console)." });
    } finally {
      setBusy(false);
    }
  }

  async function wipeData() {
    if (!user) return;
    setBusy(true);
    try {
      const db = getFirebaseDb();
      const gamesCol = collection(db, "users", user.uid, "games");
      const snap = await getDocs(gamesCol);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      try {
        window.dispatchEvent(new CustomEvent("collection:changed"));
      } catch { }
      setNotice({ title: "Wiped", message: "Your collection data has been removed." });
    } catch (err) {
      console.error("Failed to wipe data:", err);
      setNotice({ title: "Error", message: "Failed to wipe data (see console)." });
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      router.push("/my-collection");
    } catch (err) {
      console.error("Failed to sign out:", err);
      setNotice({ title: "Logout", message: "Failed to log out (see console)." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="flex items-center gap-4 border-b-2 border-(--border) px-4 py-3">
          <div>
            <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              SETTINGS
            </h1>
            <p className="mt-1 text-xs tracking-[0.35em] text-(--muted)">ACCOUNT</p>
          </div>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <div className="text-sm text-(--muted)">Checking login…</div>
          ) : !user ? (
            <div className="text-sm text-(--muted)">Sign in to access settings.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div className="border-2 border-(--border) bg-(--surface) p-3">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Username</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      saveUsername();
                    }}
                    placeholder={usernameLoaded ? "(optional)" : "Loading…"}
                    disabled={busy || !usernameLoaded}
                    className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                  />
                  <button
                    type="button"
                    onClick={saveUsername}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="border-2 border-(--border) bg-(--surface) p-3">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Password</div>
                <p className="mt-2 text-sm text-(--muted)">Send a password reset email to your account.</p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={sendPasswordEmail}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send Email
                  </button>
                </div>
              </div>

              <div className="border-2 border-(--border) bg-(--surface) p-3">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Link Steam account</div>
                <p className="mt-2 text-sm text-(--muted)">Not yet implemented.</p>
              </div>

              <div className="border-2 border-(--border) bg-(--surface) p-3">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Theme</div>
                <div className="mt-2 max-w-xs">
                  <FilterSelect
                    value={theme}
                    onChange={(v) => {
                      const next = normalizeTheme(v);
                      setTheme(next);
                      saveTheme(next);
                    }}
                    disabled={busy}
                    title="Theme"
                  >
                    {THEMES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
              </div>

              <div className="border-2 border-(--border) bg-(--surface) p-3">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Session</div>
                <p className="mt-2 text-sm text-(--muted)">Log out of this device.</p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmLogoutOpen(true)}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Log Out
                  </button>
                </div>
              </div>

              <div className="border-2 border-(--border) bg-(--surface) p-3">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Danger Zone</div>
                <p className="mt-2 text-sm text-(--muted)">Wiping data removes your collection entries.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmWipeOpen(true)}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-red-600 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Wipe Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={confirmWipeOpen}
        title="Wipe Data"
        message="This will remove your collection entries. Continue?"
        cancelText="Cancel"
        confirmText="Wipe"
        danger
        busy={busy}
        onCancel={() => setConfirmWipeOpen(false)}
        onConfirm={async () => {
          setConfirmWipeOpen(false);
          await wipeData();
        }}
      />

      <ConfirmModal
        open={confirmLogoutOpen}
        title="Log Out"
        message="Log out of your account on this device?"
        cancelText="Cancel"
        confirmText="Log Out"
        busy={busy}
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={async () => {
          setConfirmLogoutOpen(false);
          await logout();
        }}
      />

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        buttonText={notice?.buttonText ?? "OK"}
        onClose={() => setNotice(null)}
        onAction={notice?.onAction}
      />

    </div>
  );
}
