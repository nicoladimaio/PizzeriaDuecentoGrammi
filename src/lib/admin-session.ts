// Firebase tiene l'admin collegato a tempo indeterminato (la sessione resta nel
// browser anche chiudendolo). Qui si salva l'ora dell'ultima attività
// nell'area riservata: se è passato troppo tempo, all'accesso successivo si
// esce e va reinserita la password.

import { signOut, type Auth } from "firebase/auth";

export const ADMIN_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;

const STORAGE_KEY = "dg-admin-last-activity";
// mousemove e scroll scattano di continuo: basta aggiornare ogni tanto.
const WRITE_THROTTLE_MS = 30 * 1000;

let lastWrite = 0;

const readLastActivity = (): number | null => {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

export const markAdminActivity = (force = false) => {
  const now = Date.now();
  if (!force && now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // Archiviazione non disponibile (es. navigazione privata bloccata).
  }
};

/** Vero se non c'è attività registrata o se l'ultima è troppo vecchia. */
export const isAdminSessionExpired = (): boolean => {
  const lastActivity = readLastActivity();
  return (
    lastActivity === null ||
    Date.now() - lastActivity > ADMIN_INACTIVITY_LIMIT_MS
  );
};

export const signOutAdmin = async (auth: Auth) => {
  lastWrite = 0;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
  await signOut(auth);
};
