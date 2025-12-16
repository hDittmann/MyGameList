"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { getFirebaseAuth } from "../lib/firebaseClient";

export function useFirebaseUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => { };
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      });
    } catch {
      queueMicrotask(() => setLoading(false));
    }

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
