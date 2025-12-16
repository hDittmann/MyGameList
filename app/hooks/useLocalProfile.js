"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebaseClient";

const USER_ID_KEY = "mygamelist:userId";

function createUserId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useLocalProfile() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    try {
      const storedId = localStorage.getItem(USER_ID_KEY);
      setUserId(storedId);
    } finally {
      setReady(true);
    }
  }, []);

  const isLoggedIn = Boolean(userId);

  const saveProfile = useCallback(
    async () => {
      const id = userId ?? createUserId();

      localStorage.setItem(USER_ID_KEY, id);
      setUserId(id);

      try {
        const db = getFirebaseDb();
        const ref = doc(db, "users", id);
        await setDoc(
          ref,
          {
            updatedAt: serverTimestamp(),
            ...(userId ? {} : { createdAt: serverTimestamp() }),
          },
          { merge: true }
        );
      } catch {
      }

      return { userId: id };
    },
    [userId]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(USER_ID_KEY);
    setUserId(null);
  }, []);

  const profile = useMemo(
    () => ({ userId, isLoggedIn, ready }),
    [userId, isLoggedIn, ready]
  );

  return { profile, saveProfile, logout };
}
