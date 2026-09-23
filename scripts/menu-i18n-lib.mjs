// Supporto comune agli script di traduzione del menu (Firebase Admin da .env).
import fs from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const loadEnvFile = (file) => {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0 || line.trim().startsWith("#")) continue;
    const key = line.slice(0, index).trim();
    if (process.env[key]) continue;
    process.env[key] = line
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
};

export const getDb = () => {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
    process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("Credenziali Firebase Admin mancanti in .env / .env.local");
  }
  const app = initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  return getFirestore(app);
};
