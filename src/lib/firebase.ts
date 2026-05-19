import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedApp: FirebaseApp | null = null;

const getClientApp = (): FirebaseApp => {
  if (typeof window === "undefined") {
    throw new Error("Firebase client disponibile solo nel browser.");
  }

  if (cachedApp) return cachedApp;

  if (!firebaseConfig.apiKey) {
    throw new Error("Config Firebase mancante: controlla .env.local");
  }

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
};

export const getClientAuth = (): Auth => getAuth(getClientApp());
export const getClientDb = (): Firestore => getFirestore(getClientApp());
export const getClientStorage = (): FirebaseStorage =>
  getStorage(getClientApp());
