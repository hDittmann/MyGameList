"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebaseClient";
import { normalizeTheme } from "../lib/themes";

const DEFAULT_SETTINGS = {
  hideMature: true,
  tagFilters: [],
  minRating: 0,
  theme: "dark",
};

export function useUserSettings(user) {
  const uid = user?.uid ?? null;
  const [snapshotState, setSnapshotState] = useState({
    uid: null,
    username: "",
    settings: DEFAULT_SETTINGS,
  });

  useEffect(() => {
    if (!uid) return;

    // realtime subscription to users/{uid}, so settings changes apply instantly

    const db = getFirebaseDb();
    const ref = doc(db, "users", uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        // keep this defensive, because the doc can be missing or partially filled
        const data = snap.exists() ? snap.data() : null;
        const nextUsername = typeof data?.username === "string" ? data.username : "";
        const nextSettings = data?.settings ?? {};

        setSnapshotState({
          uid,
          username: nextUsername,
          settings: {
            hideMature: typeof nextSettings?.hideMature === "boolean" ? nextSettings.hideMature : true,
            tagFilters: Array.isArray(nextSettings?.tagFilters) ? nextSettings.tagFilters.filter(Boolean) : [],
            minRating: Number(nextSettings?.minRating) || 0,
            theme: normalizeTheme(nextSettings?.theme),
          },
        });
      },
      () => {
        // if snapshot errors out (network, perms, etc), just fall back to defaults
        setSnapshotState({ uid, username: "", settings: DEFAULT_SETTINGS });
      }
    );

    return () => unsub();
  }, [uid]);

  const loading = Boolean(uid) && snapshotState.uid !== uid;
  const username = uid ? snapshotState.username : "";
  const settings = uid ? snapshotState.settings : DEFAULT_SETTINGS;

  return { loading, username, settings };
}

