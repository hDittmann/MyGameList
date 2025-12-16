import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

function hasFirebaseConfig(config) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function isFirebaseConfigured() {
  return hasFirebaseConfig(getFirebaseConfig());
}

let cachedApp;
let cachedAuth;
let persistencePromise;

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;

  const config = getFirebaseConfig();
  if (!hasFirebaseConfig(config)) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars in .env.local."
    );
  }

  cachedApp = getApps()[0] ?? initializeApp(config);
  return cachedApp;
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseAuth() {
  if (cachedAuth) return cachedAuth;

  cachedAuth = getAuth(getFirebaseApp());

  persistencePromise ??= setPersistence(cachedAuth, browserLocalPersistence).catch(() => { });

  return cachedAuth;
}
