import {
  waitForPendingWrites,
  type Firestore,
  type QuerySnapshot,
} from "firebase/firestore";
import { getClientAuth } from "@/lib/firebase-auth";

// Il menu pubblico è in cache sul server (lib/public-menu.ts). Invece di
// avvisare il server da ogni singolo salvataggio del pannello, ci si aggancia
// agli ascoltatori in tempo reale delle collezioni del menu: qualunque
// modifica vista (piatti, categorie, ingredienti, foto, traduzioni) fa
// partire, dopo una breve pausa, la richiesta di aggiornamento.

const REFRESH_DELAY_MS = 1500;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const refreshPublicMenu = async (db: Firestore) => {
  try {
    // Il server deve rileggere dati già salvati su Firestore, non in viaggio.
    await waitForPendingWrites(db);
    const token = await getClientAuth().currentUser?.getIdToken();
    if (!token) return;
    const response = await fetch("/api/admin/menu/revalidate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // Non blocca il pannello: il menu pubblico si aggiorna comunque entro 10 minuti.
    console.warn("Aggiornamento del menu pubblico non riuscito.", error);
  }
};

const scheduleRefresh = (db: Firestore) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshPublicMenu(db);
  }, REFRESH_DELAY_MS);
};

/**
 * Da chiamare dentro il callback di `onSnapshot` di una collezione del menu.
 * Ignora il primo caricamento; ogni modifica successiva programma
 * l'aggiornamento del menu pubblico (più modifiche ravvicinate = una sola richiesta).
 */
export const createMenuChangeWatcher = (db: Firestore) => {
  let initialLoad = true;
  return (snapshot: QuerySnapshot) => {
    if (initialLoad) {
      initialLoad = false;
      return;
    }
    if (snapshot.docChanges().length > 0) scheduleRefresh(db);
  };
};
