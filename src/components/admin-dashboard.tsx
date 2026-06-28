"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import { isAllowedAdminEmail } from "@/lib/auth";
import { AdminMenuPanel } from "@/components/admin-menu-panel";
import {
  AdminReservationsPanel,
  type SettingsLeaveGuard,
} from "@/components/admin-reservations-panel";
import type { ReservationSettings, ReservationStatus } from "@/types/reservation";

type AdminSection = "home" | "reservations" | "menu" | "settings";

type ReservationSummary = {
  date?: unknown;
  time?: unknown;
  status?: unknown;
  guests?: unknown;
};

type MenuEntrySummary = {
  visible?: unknown;
};

const ADMIN_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;
const defaultReservationSettings: ReservationSettings = {
  openTime: "19:00",
  closeTime: "23:00",
  slotMinutes: 30,
  capacityPerSlot: 40,
  insideActive: true,
  outsideActive: true,
  insideCapacityPerSlot: 40,
  outsideCapacityPerSlot: 24,
  workingDays: [1, 2, 3, 4, 5, 6, 0],
  holidays: [],
  specialOpenings: [],
  weeklyDisabledSlots: {},
};

const deriveTotalCapacity = (settings: ReservationSettings): number => {
  const total =
    (settings.insideActive ? settings.insideCapacityPerSlot : 0) +
    (settings.outsideActive ? settings.outsideCapacityPerSlot : 0);
  return total > 0 ? total : settings.capacityPerSlot;
};

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDashboardDate = () =>
  new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

function AdminNavIcon({ icon }: { icon: AdminSection }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "admin-bottom-icon-svg",
    "aria-hidden": true,
  };

  if (icon === "home") {
    return (
      <svg {...commonProps}>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (icon === "reservations") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M8 3.5v3" />
        <path d="M16 3.5v3" />
        <path d="M4 9.5h16" />
        <path d="M8 13h3" />
        <path d="M8 16.5h6" />
      </svg>
    );
  }

  if (icon === "menu") {
    return (
      <svg {...commonProps}>
        <path d="M5 4.5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M15.4 8.6l-.6-1.45-1.5.2-.95-1.15-1.15.95-1.45-.6-.6 1.45-1.5.2.2 1.5-1.15.95.95 1.15-.6 1.45 1.45.6.2 1.5 1.5-.2.95 1.15 1.15-.95 1.45.6.6-1.45 1.5-.2-.2-1.5 1.15-.95-.95-1.15.6-1.45-1.45-.6-.2-1.5Z" />
    </svg>
  );
}

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
    initialSection ?? "home",
  );
  const [reservations, setReservations] = useState<ReservationSummary[]>([]);
  const [visibleMenuItemsCount, setVisibleMenuItemsCount] = useState(0);
  const [visibleMenuCategoriesCount, setVisibleMenuCategoriesCount] =
    useState(0);
  const [menuIngredientsCount, setMenuIngredientsCount] = useState(0);
  const [reservationSettings, setReservationSettings] = useState<ReservationSettings>(
    defaultReservationSettings,
  );
  const [settingsLeaveGuard, setSettingsLeaveGuard] =
    useState<SettingsLeaveGuard | null>(null);
  const [pendingSectionChange, setPendingSectionChange] =
    useState<AdminSection | null>(null);
  const [showUnsavedSettingsModal, setShowUnsavedSettingsModal] =
    useState(false);
  const [leavingAfterSave, setLeavingAfterSave] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    let active = true;

    const resolveCurrentSession = async () => {
      try {
        if (typeof auth.authStateReady === "function") {
          await auth.authStateReady();
        }
      } catch {
        // Ignore and fall back to the auth listener below.
      }

      if (!active) return;

      const user = auth.currentUser;
      if (!user || !isAllowedAdminEmail(user.email)) {
        setBooting(false);
        router.replace("/riservato/accesso-200g");
        return;
      }

      setBooting(false);
    };

    void resolveCurrentSession();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !isAllowedAdminEmail(user.email)) {
        setBooting(false);
        router.replace("/riservato/accesso-200g");
        return;
      }

      setBooting(false);
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [router]);

  useEffect(() => {
    if (booting) return;

    const auth = getClientAuth();

    const clearInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };

    const expireSession = async () => {
      clearInactivityTimer();
      await signOut(auth);
      router.replace("/riservato/accesso-200g");
    };

    const resetInactivityTimer = () => {
      clearInactivityTimer();
      inactivityTimerRef.current = setTimeout(() => {
        void expireSession();
      }, ADMIN_INACTIVITY_LIMIT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "mousemove",
      "touchstart",
      "scroll",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, {
        passive: true,
      });
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetInactivityTimer();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    resetInactivityTimer();

    return () => {
      clearInactivityTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer);
      });
    };
  }, [booting, router]);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "reservations"),
      (snapshot) => {
        setReservations(
          snapshot.docs.map((doc) => doc.data() as ReservationSummary),
        );
      },
      () => {
        setReservations([]);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (booting) return;

    let ignore = false;

    const loadReservationSettings = async () => {
      try {
        const auth = getClientAuth();
        if (typeof auth.authStateReady === "function") {
          await auth.authStateReady();
        }

        const user = auth.currentUser;
        if (!user || !isAllowedAdminEmail(user.email)) {
          if (!ignore) {
            setReservationSettings(defaultReservationSettings);
          }
          return;
        }

        const token = await user.getIdToken();
        const response = await fetch("/api/admin/reservations/settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await response.json()) as {
          settings?: ReservationSettings;
        };

        if (!ignore && response.ok && data.settings) {
          setReservationSettings(data.settings);
        }
      } catch {
        if (!ignore) {
          setReservationSettings(defaultReservationSettings);
        }
      }
    };

    void loadReservationSettings();
    return () => {
      ignore = true;
    };
  }, [booting]);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_items"),
      (snapshot) => {
        setVisibleMenuItemsCount(
          snapshot.docs.filter(
            (doc) => (doc.data() as MenuEntrySummary).visible !== false,
          ).length,
        );
      },
      () => {
        setVisibleMenuItemsCount(0);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_categories"),
      (snapshot) => {
        setVisibleMenuCategoriesCount(
          snapshot.docs.filter(
            (doc) => (doc.data() as MenuEntrySummary).visible !== false,
          ).length,
        );
      },
      () => {
        setVisibleMenuCategoriesCount(0);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_ingredients"),
      (snapshot) => {
        setMenuIngredientsCount(snapshot.size);
      },
      () => {
        setMenuIngredientsCount(0);
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

  const openSection = (section: AdminSection) => {
    if (activeSection === "settings") {
      attemptLeaveSettings({ nextSection: section });
      return;
    }

    setActiveSection(section);
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

  const currentDay = todayKey();
  const activeReservations = reservations.filter((reservation) => {
    const status = reservation.status as ReservationStatus | undefined;
    return (
      typeof reservation.date === "string" &&
      reservation.date >= currentDay &&
      (status === "pending" || status === "proposed" || status === "confirmed")
    );
  });

  const pendingReservationsCount = activeReservations.filter(
    (reservation) => reservation.status === "pending",
  ).length;
  const proposedReservationsCount = activeReservations.filter(
    (reservation) => reservation.status === "proposed",
  ).length;
  const reservationsAttentionCount =
    pendingReservationsCount + proposedReservationsCount;

  const todayReservations = activeReservations.filter(
    (reservation) =>
      reservation.date === currentDay && reservation.status === "confirmed",
  );
  const todayGuestsCount = todayReservations.reduce((sum, reservation) => {
    return sum + (typeof reservation.guests === "number" ? reservation.guests : 0);
  }, 0);
  const firstReservationTime =
    todayReservations
      .map((reservation) =>
        typeof reservation.time === "string" ? reservation.time : "",
      )
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))[0] ?? "--:--";

  const dashboardDate = formatDashboardDate();
  const activeRoomsCount =
    Number(reservationSettings.insideActive) + Number(reservationSettings.outsideActive);
  const totalCapacity = deriveTotalCapacity(reservationSettings);
  const occupancyRatio =
    totalCapacity > 0
      ? Math.min((todayGuestsCount / totalCapacity) * 100, 100)
      : 0;
  const topbarTitle =
    activeSection === "home"
      ? "Ciao Giuseppe"
      : activeSection === "reservations"
        ? "Prenotazioni"
        : activeSection === "menu"
          ? "Menù"
          : "Impostazioni";

  return (
    <section className="admin-shell">
      <div className="admin-topbar">
        <h2>{topbarTitle}</h2>
        {activeSection === "home" ? <p>{dashboardDate}</p> : null}
      </div>

      {activeSection === "home" ? (
        <div className="admin-home-grid">
          <article className="admin-home-card">
            <div className="admin-home-card-head">
              <span className="admin-home-card-icon" aria-hidden>
                <AdminNavIcon icon="reservations" />
              </span>
              <span className="admin-home-card-label">Prenotazioni</span>
            </div>
            <strong className="admin-home-card-metric">
              {todayReservations.length}
            </strong>
            <p className="admin-home-card-copy">
              {todayReservations.length > 0
                ? "Coperti confermati oggi"
                : "Nessuna prenotazione per oggi"}
            </p>
            <div className="admin-home-card-meta">
              {todayReservations.length > 0 ? (
                <>
                  <span>Coperti: {todayGuestsCount}</span>
              <div
                className="admin-home-progress"
                aria-hidden
              >
                <span
                  className="admin-home-progress-bar"
                  style={{ width: `${occupancyRatio}%` }}
                />
              </div>
              <span className="admin-home-meta-neutral">
                🕘 Prima: {firstReservationTime}
              </span>
                </>
              ) : null}
              {reservationsAttentionCount > 0 ? (
                <span className="admin-home-meta-warm">
                  ⚠️ Da gestire: {reservationsAttentionCount}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="admin-home-card-action"
              onClick={() => openSection("reservations")}
            >
              Vai alle prenotazioni
            </button>
          </article>

          <article className="admin-home-card">
            <div className="admin-home-card-head">
              <span className="admin-home-card-icon" aria-hidden>
                <AdminNavIcon icon="menu" />
              </span>
              <span className="admin-home-card-label">Menu</span>
            </div>
            <strong className="admin-home-card-metric">
              {visibleMenuItemsCount}
            </strong>
            <p className="admin-home-card-copy">Piatti online</p>
            <div className="admin-home-card-meta">
              <span>{visibleMenuCategoriesCount} categorie</span>
              <span>{menuIngredientsCount} ingredienti</span>
            </div>
            <button
              type="button"
              className="admin-home-card-action"
              onClick={() => openSection("menu")}
            >
              Apri menu
            </button>
          </article>

          <article className="admin-home-card">
            <div className="admin-home-card-head">
              <span className="admin-home-card-icon" aria-hidden>
                <AdminNavIcon icon="settings" />
              </span>
              <span className="admin-home-card-label">Servizio</span>
            </div>
            <strong className="admin-home-card-metric admin-home-card-metric-text">
              Oggi
            </strong>
            <p className="admin-home-card-copy">
              Assetto del servizio prenotazioni di oggi
            </p>
            <div className="admin-home-card-meta">
              <span>Sale attive: {activeRoomsCount}</span>
              <span>Capienza totale: {totalCapacity}</span>
              <span>
                Servizio: {reservationSettings.openTime} - {reservationSettings.closeTime}
              </span>
            </div>
            <button
              type="button"
              className="admin-home-card-action"
              onClick={() => openSection("settings")}
            >
              Apri impostazioni
            </button>
          </article>
        </div>
      ) : null}

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
            activeSection === "home"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => openSection("home")}
          aria-label="Homepage"
          title="Homepage"
        >
          <span className="admin-bottom-symbol" aria-hidden>
            <AdminNavIcon icon="home" />
          </span>
        </button>
        <button
          type="button"
          className={
            activeSection === "reservations"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => openSection("reservations")}
          aria-label="Prenotazioni"
          title="Prenotazioni"
        >
          {reservationsAttentionCount > 0 ? (
            <span className="admin-bottom-badge">
              {reservationsAttentionCount}
            </span>
          ) : null}
          <span className="admin-bottom-symbol" aria-hidden>
            <AdminNavIcon icon="reservations" />
          </span>
        </button>
        <button
          type="button"
          className={
            activeSection === "menu"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => openSection("menu")}
          aria-label="Menu"
          title="Menu"
        >
          <span className="admin-bottom-symbol" aria-hidden>
            <AdminNavIcon icon="menu" />
          </span>
        </button>
        <button
          type="button"
          className={
            activeSection === "settings"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => openSection("settings")}
          aria-label="Impostazioni"
          title="Impostazioni"
        >
          <span className="admin-bottom-symbol" aria-hidden>
            <AdminNavIcon icon="settings" />
          </span>
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
