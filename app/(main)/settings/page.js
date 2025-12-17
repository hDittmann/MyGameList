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
import { FilterSection, FilterRange, FilterSelect } from "../../components/FilterControls";
import TagPickerModal from "../../components/TagPickerModal";

export default function SettingsPage() {
  const { user, loading } = useFirebaseUser();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [username, setUsername] = useState("");
  const [usernameLoaded, setUsernameLoaded] = useState(false);

  const [hideMature, setHideMature] = useState(true);
  const [minRating, setMinRating] = useState(0);
  const [minRatingUi, setMinRatingUi] = useState(0);
  const [tagFilterText, setTagFilterText] = useState("");

  const [theme, setTheme] = useState("dark");
  const [font, setFont] = useState("default");

  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const normalizedTags = useMemo(() => {
    return tagFilterText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }, [tagFilterText]);

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
        if (settings && typeof settings.hideMature === "boolean") {
          setHideMature(settings.hideMature);
        }
        const nextMinRating = Number(settings?.minRating) || 0;
        setMinRating(nextMinRating);
        setMinRatingUi(nextMinRating);

        setTheme(settings?.theme === "light" ? "light" : "dark");
        setFont(settings?.font === "readable" ? "readable" : "default");

        const tagFilters = Array.isArray(settings?.tagFilters) ? settings.tagFilters : null;
        if (tagFilters && tagFilters.length) {
          setTagFilterText(tagFilters.join(", "));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setUsernameLoaded(true);
      }
    }

    load();
  }, [user]);

  async function saveSettings() {
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
          settings: {
            hideMature: Boolean(hideMature),
            minRating: Number(minRating) || 0,
            tagFilters: normalizedTags,
            theme: theme === "light" ? "light" : "dark",
            font: font === "readable" ? "readable" : "default",
          },
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

  async function deleteAccount() {
    if (!user) return;
    setBusy(true);
    try {
      // Best-effort: delete auth user (may require re-authentication).
      await user.delete();
      setNotice({ title: "Account", message: "Account deleted." });
    } catch (err) {
      console.error("Account delete failed:", err);
      setNotice({
        title: "Account",
        message:
          "Account delete needs a recent login. This button is wired, but deletion may fail until re-auth flow is added.",
      });
    } finally {
      try {
        const auth = getFirebaseAuth();
        await signOut(auth);
      } catch { }
      setBusy(false);
      router.push("/my-collection");
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="border-2 border-(--border) bg-(--surface)">
        <div className="flex items-center justify-between gap-4 border-b-2 border-(--border) px-4 py-3">
          <div>
            <h1 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              SETTINGS
            </h1>
            <p className="mt-1 text-xs tracking-[0.35em] text-(--muted)">ACCOUNT</p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/my-collection")}
            className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground"
          >
            Back
          </button>
        </div>

        <div className="px-4 py-6">
          {loading ? (
            <div className="text-sm text-(--muted)">Checking login…</div>
          ) : !user ? (
            <div className="text-sm text-(--muted)">Sign in to access settings.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="border-2 border-(--border) bg-(--surface) p-4">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Username</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={usernameLoaded ? "(optional)" : "Loading…"}
                    disabled={busy || !usernameLoaded}
                    className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                  />
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="border-2 border-(--border) bg-(--surface) p-4">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Password</div>
                <p className="mt-2 text-sm text-(--muted)">
                  Send a password reset email to your account.
                </p>
                <div className="mt-3">
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

              <FilterSection title="Filters">
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Tag filters</div>
                  <div className="mt-2">
                    <input
                      value={tagFilterText}
                      readOnly
                      onClick={() => setTagPickerOpen(true)}
                      placeholder="Click to pick tags"
                      disabled={busy}
                      title="Filter by tags"
                      className="w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted) disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                  <p className="mt-2 text-xs text-(--muted)">
                    Applied across IGDB browsing and search.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Filters
                  </button>
                </div>
              </FilterSection>

              <FilterSection title="Accessibility">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Theme</div>
                    <div className="mt-2">
                      <FilterSelect
                        value={theme}
                        onChange={(v) => setTheme(v === "light" ? "light" : "dark")}
                        disabled={busy}
                        title="Theme"
                      >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                      </FilterSelect>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Font</div>
                    <div className="mt-2">
                      <FilterSelect
                        value={font}
                        onChange={(v) => setFont(v === "readable" ? "readable" : "default")}
                        disabled={busy}
                        title="Font"
                      >
                        <option value="default">Default</option>
                        <option value="readable">Readable</option>
                      </FilterSelect>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Accessibility
                  </button>
                </div>

              </FilterSection>

              <div className="border-2 border-(--border) bg-(--surface) p-4">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Session</div>
                <p className="mt-2 text-sm text-(--muted)">Log out of this device.</p>
                <div className="mt-3">
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

              <div className="border-2 border-(--border) bg-(--surface) p-4">
                <div className="text-xs uppercase tracking-[0.35em] text-(--muted)">Danger Zone</div>
                <p className="mt-2 text-sm text-(--muted)">
                  Wiping data removes your collection entries.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmWipeOpen(true)}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-red-600 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Wipe Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={busy}
                    className="cursor-pointer border-2 border-(--border) bg-red-600 px-3 py-2 text-xs uppercase tracking-[0.35em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete Account
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
        open={confirmDeleteOpen}
        title="Delete Account"
        message="This will attempt to delete your account. You will be logged out. Continue?"
        cancelText="Cancel"
        confirmText="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          setConfirmDeleteOpen(false);
          await deleteAccount();
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

      <TagPickerModal
        open={tagPickerOpen}
        selectedTags={normalizedTags}
        onChange={(next) => setTagFilterText((next ?? []).join(", "))}
        onClose={() => setTagPickerOpen(false)}
      />
    </div>
  );
}
