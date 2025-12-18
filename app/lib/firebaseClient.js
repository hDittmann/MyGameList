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
let cachedDb;
let cachedAuth;
let persistencePromise;

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;

  const config = getFirebaseConfig();
  if (!hasFirebaseConfig(config)) {
    throw new Error(
      "Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* environment variables."
    );
  }

  // keep a single firebase app instance around (next dev can re-run module init a bunch)
  cachedApp = getApps()[0] ?? initializeApp(config);
  return cachedApp;
}

export function getFirebaseDb() {
  if (cachedDb) return cachedDb;

  // firestore instance is tied to the singleton app above
  cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}

export function getFirebaseAuth() {
  if (cachedAuth) return cachedAuth;

  cachedAuth = getAuth(getFirebaseApp());

  // set auth persistence once; if it fails we just fall back to default behavior
  persistencePromise ??= setPersistence(cachedAuth, browserLocalPersistence).catch(() => { });

  return cachedAuth;
}
