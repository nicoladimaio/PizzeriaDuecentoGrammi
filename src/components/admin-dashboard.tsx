"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import { isAllowedAdminEmail } from "@/lib/auth";
import { AdminMenuPanel } from "@/components/admin-menu-panel";
import {
  AdminReservationsPanel,
  type SettingsLeaveGuard,
} from "@/components/admin-reservations-panel";

type AdminSection = "reservations" | "menu" | "settings";

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function AdminDashboard({
  initialSection,
  highlightedCode,
}: {
  initialSection?: AdminSection;
  highlightedCode?: string;
}) {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>(
    initialSection ?? "menu",
  );
  const [pendingReservationsCount, setPendingReservationsCount] = useState(0);
  const [proposedReservationsCount, setProposedReservationsCount] = useState(0);
  const [settingsLeaveGuard, setSettingsLeaveGuard] =
    useState<SettingsLeaveGuard | null>(null);
  const [pendingSectionChange, setPendingSectionChange] =
    useState<AdminSection | null>(null);
  const [showUnsavedSettingsModal, setShowUnsavedSettingsModal] =
    useState(false);
  const [leavingAfterSave, setLeavingAfterSave] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !isAllowedAdminEmail(user.email)) {
        setBooting(false);
        router.replace("/riservato/accesso-200g");
        return;
      }

      setBooting(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    const db = getClientDb();
    const pendingQuery = query(
      collection(db, "reservations"),
      where("status", "==", "pending"),
    );

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const currentDay = todayKey();
        const validCount = snapshot.docs.filter((doc) => {
          const data = doc.data() as { date?: unknown };
          return typeof data.date === "string" && data.date >= currentDay;
        }).length;
        setPendingReservationsCount(validCount);
      },
      () => {
        setPendingReservationsCount(0);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const proposedQuery = query(
      collection(db, "reservations"),
      where("status", "==", "proposed"),
    );

    const unsubscribe = onSnapshot(
      proposedQuery,
      (snapshot) => {
        const currentDay = todayKey();
        const validCount = snapshot.docs.filter((doc) => {
          const data = doc.data() as { date?: unknown };
          return typeof data.date === "string" && data.date >= currentDay;
        }).length;
        setProposedReservationsCount(validCount);
      },
      () => {
        setProposedReservationsCount(0);
      },
    );

    return () => unsubscribe();
  }, []);

  const onLogout = async () => {
    const auth = getClientAuth();
    await signOut(auth);
    router.replace("/");
  };

  const finishPendingLeave = async () => {
    const nextSection = pendingSectionChange;
    const shouldLogout = pendingLogout;

    setShowUnsavedSettingsModal(false);
    setPendingSectionChange(null);
    setPendingLogout(false);

    if (nextSection) {
      setActiveSection(nextSection);
      return;
    }

    if (shouldLogout) {
      await onLogout();
    }
  };

  const attemptLeaveSettings = (options: {
    nextSection?: AdminSection;
    logout?: boolean;
  }) => {
    const hasUnsavedChanges = settingsLeaveGuard?.hasUnsavedChanges() ?? false;

    if (!hasUnsavedChanges) {
      if (options.nextSection) {
        setActiveSection(options.nextSection);
        return;
      }

      if (options.logout) {
        void onLogout();
      }
      return;
    }

    setPendingSectionChange(options.nextSection ?? null);
    setPendingLogout(options.logout === true);
    setShowUnsavedSettingsModal(true);
  };

  const saveAndLeaveSettings = async () => {
    if (!settingsLeaveGuard) return;
    setLeavingAfterSave(true);
    const saved = await settingsLeaveGuard.saveChanges();
    setLeavingAfterSave(false);
    if (saved) {
      await finishPendingLeave();
    }
  };

  if (booting) {
    return <p className="section-subtitle">Caricamento dashboard...</p>;
  }

  const reservationsAttentionCount =
    pendingReservationsCount + proposedReservationsCount;

  const sectionTitle =
    activeSection === "reservations"
      ? "Prenotazioni"
      : activeSection === "menu"
        ? "Menu"
        : "Impostazioni";

  const sectionSubtitle =
    activeSection === "reservations"
      ? "Gestisci richieste, conferme e nuove proposte in una vista ordinata."
      : activeSection === "menu"
        ? "Aggiorna prodotti, categorie, ingredienti e disponibilita in tempo reale."
        : "Configura orari, capienze, giorni lavorativi e aperture straordinarie.";

  return (
    <section className="admin-shell">
      <div className="admin-head admin-head-premium">
        <div>
          <p className="admin-head-kicker">Control Center</p>
          <h2>{sectionTitle}</h2>
        </div>
        {activeSection === "reservations" ? (
          <div className="admin-head-stats" aria-live="polite">
            <span className="admin-stat-pill">
              Nuove: {pendingReservationsCount}
            </span>
            <span className="admin-stat-pill">
              Proposte: {proposedReservationsCount}
            </span>
          </div>
        ) : null}
      </div>

      {activeSection === "menu" ? <AdminMenuPanel /> : null}

      {activeSection === "reservations" ? (
        <AdminReservationsPanel highlightedCode={highlightedCode} />
      ) : null}

      {activeSection === "settings" ? (
        <AdminReservationsPanel
          settingsOnly
          onLogout={() => attemptLeaveSettings({ logout: true })}
          onSettingsLeaveGuardChange={setSettingsLeaveGuard}
        />
      ) : null}

      <div
        className="admin-bottom-nav"
        role="navigation"
        aria-label="Azioni dashboard"
      >
        <button
          type="button"
          className={
            activeSection === "reservations"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() =>
            activeSection === "settings"
              ? attemptLeaveSettings({ nextSection: "reservations" })
              : setActiveSection("reservations")
          }
        >
          {reservationsAttentionCount > 0 ? (
            <span className="admin-bottom-badge">
              {reservationsAttentionCount}
            </span>
          ) : null}
          <span className="admin-bottom-symbol" aria-hidden>
            📅
          </span>
          <span>Prenotazioni</span>
        </button>
        <button
          type="button"
          className={
            activeSection === "menu"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() =>
            activeSection === "settings"
              ? attemptLeaveSettings({ nextSection: "menu" })
              : setActiveSection("menu")
          }
        >
          <span className="admin-bottom-symbol" aria-hidden>
            🍕
          </span>
          <span>Menu</span>
        </button>
        <button
          type="button"
          className={
            activeSection === "settings"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => setActiveSection("settings")}
        >
          <span className="admin-bottom-symbol" aria-hidden>
            ⚙
          </span>
          <span>Impostazioni</span>
        </button>
      </div>

      {showUnsavedSettingsModal ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-leave-settings-modal">
            <div className="admin-modal-head">
              <h3>Modifiche non salvate</h3>
            </div>
            <p>
              Hai aggiornato le impostazioni delle prenotazioni ma non le hai
              ancora salvate.
            </p>
            <p>
              Puoi salvare prima di uscire oppure annullare le modifiche di
              questa sessione.
            </p>
            <div className="booking-step-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void saveAndLeaveSettings()}
                disabled={leavingAfterSave}
              >
                {leavingAfterSave ? "Salvataggio..." : "Salva e continua"}
              </button>
            </div>
            <div className="booking-step-actions two-buttons">
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                disabled={leavingAfterSave}
                onClick={() => {
                  settingsLeaveGuard?.discardChanges();
                  void finishPendingLeave();
                }}
              >
                Annulla modifiche
              </button>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                disabled={leavingAfterSave}
                onClick={() => {
                  setShowUnsavedSettingsModal(false);
                  setPendingSectionChange(null);
                  setPendingLogout(false);
                }}
              >
                Resta nella pagina
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
