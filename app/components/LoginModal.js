"use client";

import { useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import {
  getFirebaseAuth,
  getFirebaseDb,
} from "../lib/firebaseClient";

function getFriendlyAuthError(err) {
  const code = err?.code;
  switch (code) {
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter a password.";
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return err?.message ?? "Something went wrong. Try again.";
  }
}

// pretty decent email validation (not perfect, but good enough for ui feedback)
function validateEmail(value) {
  const email = String(value).trim();
  // rfc 5322-ish pattern (simplified but solid)
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

export default function LoginModal({ open, onClose }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const emailInputRef = useRef(null);
  const closeTimerRef = useRef(null);
  const openTimerRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (open) {
      setIsMounted(true);
      setIsVisible(false);

      // delay the visibility so the fadein works
      openTimerRef.current = setTimeout(() => {
        setIsVisible(true);
        openTimerRef.current = null;
      }, 20);
      return;
    }

    setIsVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setIsMounted(false);
      closeTimerRef.current = null;
    }, 160);
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    // clears past error msgs
    setError("");
    setVerificationSent(false);
  }, [open]);

  function getFormIssue() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return "Email is required.";
    if (!validateEmail(trimmedEmail)) return "Enter a valid email address.";
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    return "";
  }

  function close() {
    // keeps the modal thingy open if its doin something
    if (busy) {
      return;
    }

    setError("");
    setVerificationSent(false);
    onClose?.();
  }

  async function upsertUserDoc(user, { isNewUser }) {
    // creates/updates user info in firestore
    const db = getFirebaseDb();
    const ref = doc(db, "users", user.uid);
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email ?? null,
        emailVerified: user.emailVerified ?? false,
        updatedAt: serverTimestamp(),
        ...(isNewUser ? { createdAt: serverTimestamp() } : {}),
        lastLoginAt: serverTimestamp(),
        ...(isNewUser
          ? {
            settings: {
              hideMature: true,
              minRating: 0,
              tagFilters: [],
              theme: "dark",
              font: "default",
            },
          }
          : {}),
      },
      { merge: true }
    );
  }

  async function handleSignIn() {
    setError("");

    const issue = getFormIssue();
    if (issue) {
      setError(issue);
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await upsertUserDoc(cred.user, { isNewUser: false });
      setPassword("");
      close();
    } catch (err) {
      setError(getFriendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount() {
    setError("");

    const issue = getFormIssue();
    if (issue) {
      setError(issue);
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // send verification email to the new user
      try {
        await sendEmailVerification(cred.user);
        setVerificationSent(true);
        setError(""); // clear any previous errors
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
        setError("Account created, but we couldn't send the verification email. Try refreshing.");
      }

      await upsertUserDoc(cred.user, { isNewUser: true });
      setPassword("");

      // sign out the newly-created user so they can't use the app
      // before verifying their email (firebase auto-signs-in on create).
      try {
        await auth.signOut();
      } catch (signOutErr) {
        console.error("Failed to sign out after account creation:", signOutErr);
      }

      // don't close yet—show verification message
      // close(); // removed so user sees the success message
    } catch (err) {
      setError(getFriendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!isMounted) {
    return null;
  }

  async function handleSignIn() {
    setError("");

    const issue = getFormIssue();
    if (issue) {
      setError(issue);
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

      // check if email is verified
      if (!cred.user.emailVerified) {
        setError("Please verify your email before signing in. Check your inbox for a verification link.");
        auth.signOut(); // sign them out
        setBusy(false);
        return;
      }

      await upsertUserDoc(cred.user, { isNewUser: false });
      setPassword("");
      close();
    } catch (err) {
      setError(getFriendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog" aria-modal="true"
      className={`fixed inset-0 z-50 grid place-items-center px-4 transition-opacity duration-150 ease-in-out motion-reduce:transition-none ${isVisible ? "opacity-100" : "opacity-0"
        } bg-black/60`}
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          handleSignIn();
        }
      }}
      tabIndex={-1}
    >
      <div
        className={`w-full max-w-md border-2 border-(--border) bg-(--surface) transition-all duration-150 ease-in-out motion-reduce:transition-none ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-(--border) px-4 py-3">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            {verificationSent ? "Check Your Email" : "Login"}
          </h2>
          <button
            type="button"
            className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-2 py-1 text-xs uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            onClick={close}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="px-4 py-4">
          <div className="space-y-3">
            {verificationSent ? (
              <div className="border-2 border-green-600/50 bg-green-500/10 px-3 py-3 text-sm text-green-300">
                Account created! Check your email ({email.trim()}) to verify your account.
                <br />
                <span className="mt-2 block text-xs text-(--muted)">
                  After verifying, close this and sign in.
                </span>
              </div>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Email</span>
                  <input
                    ref={emailInputRef}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                    disabled={busy}
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.35em] text-(--muted)">Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="mt-2 w-full border-2 border-(--border) bg-(--surface) px-3 py-2 text-sm text-foreground placeholder:text-(--muted)"
                    disabled={busy}
                  />
                </label>

                {error ? (
                  <div className="border-2 border-(--border) bg-(--surface-muted) px-3 py-2 text-sm text-(--muted)">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={busy || Boolean(getFormIssue())}
                    className="cursor-pointer border-2 border-(--border-strong) bg-(--surface-muted) px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-foreground transition-colors hover:bg-(--surface) disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "Working..." : "Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    disabled={busy || Boolean(getFormIssue())}
                    className="cursor-pointer border-2 border-(--border) bg-(--surface-muted) px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-(--muted) transition-colors hover:bg-(--surface) hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Create Account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}