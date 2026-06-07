"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import type { ReservationDoc, ReservationSettings } from "@/types/reservation";

type ActionType = "confirmed" | "rejected" | "proposed";

type ProposalDraft = {
  ownerResponse: string;
  proposedDate: string;
  proposedTime: string;
};

type CalendarCell =
  | { kind: "empty" }
  | { kind: "day"; dateKey: string; day: number };

type DecisionDialogMode = "rejected" | "proposed";

type DecisionAvailability = {
  days: Array<{
    date: string;
    hasAvailability: boolean;
  }>;
  slotsByDate: Record<string, Array<{ time: string; available: boolean }>>;
  error?: string;
};

const weekdayOptions = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mer" },
  { key: 4, label: "Gio" },
  { key: 5, label: "Ven" },
  { key: 6, label: "Sab" },
  { key: 0, label: "Dom" },
];

const defaultSettings: ReservationSettings = {
  openTime: "19:00",
  closeTime: "23:00",
  slotMinutes: 30,
  capacityPerSlot: 40,
  workingDays: [1, 2, 3, 4, 5, 6, 0],
  holidays: [],
  specialOpenings: [],
};

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const monthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
};

const shiftMonth = (value: string, delta: number) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKey(date);
};

const buildMonthCells = (value: string): CalendarCell[] => {
  const [year, month] = value.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstWeekday = (first.getDay() + 6) % 7;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ kind: "empty" });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ kind: "day", dateKey: key, day });
  }

  return cells;
};

const mapSnapshot = (
  snap: QueryDocumentSnapshot,
): ReservationDoc & { id: string } => {
  const data = snap.data() as ReservationDoc;
  return {
    ...data,
    id: snap.id,
  };
};

const normalizeSettings = (
  settings: ReservationSettings,
): ReservationSettings => ({
  ...settings,
  capacityPerSlot:
    typeof settings.capacityPerSlot === "number" &&
    Number.isFinite(settings.capacityPerSlot) &&
    settings.capacityPerSlot > 0
      ? Math.round(settings.capacityPerSlot)
      : 40,
  workingDays: [...new Set(settings.workingDays)].sort((a, b) => a - b),
  holidays: [...new Set(settings.holidays)].sort(),
  specialOpenings: [...new Set(settings.specialOpenings)].sort(),
});

export function AdminReservationsPanel({
  highlightedCode,
}: {
  highlightedCode?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<ReservationDoc & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>({});
  const [selectedCode, setSelectedCode] = useState<string | null>(
    highlightedCode ?? null,
  );

  const [settings, setSettings] =
    useState<ReservationSettings>(defaultSettings);
  const [capacityDraft, setCapacityDraft] = useState(
    String(defaultSettings.capacityPerSlot),
  );
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarPickerMode, setCalendarPickerMode] = useState<
    "holiday" | "opening"
  >("holiday");
  const [holidayMonth, setHolidayMonth] = useState(monthKey(new Date()));
  const [savedSettings, setSavedSettings] =
    useState<ReservationSettings>(defaultSettings);
  const [closeSettingsPromptOpen, setCloseSettingsPromptOpen] = useState(false);
  const [decisionDialogMode, setDecisionDialogMode] =
    useState<DecisionDialogMode | null>(null);
  const [decisionAvailability, setDecisionAvailability] =
    useState<DecisionAvailability | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [activeDecisionAction, setActiveDecisionAction] =
    useState<ActionType | null>(null);

  useEffect(() => {
    const db = getClientDb();
    const q = query(
      collection(db, "reservations"),
      orderBy("createdAtServer", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRows(snapshot.docs.map(mapSnapshot));
        setLoading(false);
      },
      () => {
        setError("Impossibile caricare le prenotazioni.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadSettings = async () => {
      setSettingsLoading(true);
      setSettingsError(null);
      try {
        const auth = getClientAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error("Sessione admin non valida.");
        }

        const response = await fetch("/api/admin/reservations/settings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await response.json()) as {
          settings?: ReservationSettings;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Impossibile caricare impostazioni.");
        }

        if (!ignore && data.settings) {
          const normalized = normalizeSettings(data.settings);
          setSettings(normalized);
          setSavedSettings(normalized);
        }
      } catch (err) {
        if (!ignore) {
          setSettingsError(
            err instanceof Error
              ? err.message
              : "Impossibile caricare impostazioni.",
          );
        }
      } finally {
        if (!ignore) {
          setSettingsLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      ignore = true;
    };
  }, []);

  const orderedRows = useMemo(() => {
    if (!highlightedCode) return rows;
    const idx = rows.findIndex((row) => row.code === highlightedCode);
    if (idx <= 0) return rows;
    const copy = [...rows];
    const [found] = copy.splice(idx, 1);
    copy.unshift(found);
    return copy;
  }, [rows, highlightedCode]);

  useEffect(() => {
    if (!selectedCode && highlightedCode) {
      setSelectedCode(highlightedCode);
    }
  }, [highlightedCode, selectedCode]);

  const selectedReservation = useMemo(() => {
    if (!selectedCode) return null;
    return rows.find((row) => row.code === selectedCode) ?? null;
  }, [rows, selectedCode]);

  const newRows = useMemo(
    () =>
      orderedRows.filter(
        (row) =>
          row.date >= todayKey() &&
          (row.status === "pending" || row.status === "proposed"),
      ),
    [orderedRows],
  );

  const confirmedRows = useMemo(
    () =>
      orderedRows.filter(
        (row) => row.date >= todayKey() && row.status === "confirmed",
      ),
    [orderedRows],
  );

  const oldRows = useMemo(
    () => orderedRows.filter((row) => row.date < todayKey()),
    [orderedRows],
  );

  const holidayCalendarCells = useMemo(
    () => buildMonthCells(holidayMonth),
    [holidayMonth],
  );

  const hasPendingSettingsChanges = useMemo(() => {
    const current = JSON.stringify(normalizeSettings(settings));
    const saved = JSON.stringify(normalizeSettings(savedSettings));
    return current !== saved;
  }, [settings, savedSettings]);

  useEffect(() => {
    const current = todayKey();
    const filteredHolidays = settings.holidays.filter(
      (value) => value >= current,
    );
    const filteredOpenings = settings.specialOpenings.filter(
      (value) => value >= current,
    );
    if (
      filteredHolidays.length !== settings.holidays.length ||
      filteredOpenings.length !== settings.specialOpenings.length
    ) {
      setSettings((prev) => ({
        ...prev,
        holidays: filteredHolidays,
        specialOpenings: filteredOpenings,
      }));
    }
  }, [settings.holidays, settings.specialOpenings]);

  useEffect(() => {
    const safeCapacity =
      typeof settings.capacityPerSlot === "number" &&
      settings.capacityPerSlot > 0
        ? settings.capacityPerSlot
        : 40;
    setCapacityDraft(String(safeCapacity));
  }, [settings.capacityPerSlot]);

  const onDraftChange = (
    code: string,
    key: keyof ProposalDraft,
    value: string,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [code]: {
        ownerResponse: prev[code]?.ownerResponse ?? "",
        proposedDate: prev[code]?.proposedDate ?? "",
        proposedTime: prev[code]?.proposedTime ?? "",
        [key]: value,
      },
    }));
  };

  const loadDecisionAvailability = async (guests: number, code: string) => {
    setDecisionLoading(true);
    setDecisionError(null);

    try {
      const response = await fetch(
        `/api/reservations/availability?guests=${guests}`,
      );
      const data = (await response.json()) as DecisionAvailability;

      if (!response.ok) {
        throw new Error(data.error ?? "Impossibile caricare disponibilita.");
      }

      setDecisionAvailability(data);

      const firstAvailableDate =
        data.days.find((day) => day.hasAvailability)?.date ?? "";
      const firstAvailableTime = firstAvailableDate
        ? ((data.slotsByDate[firstAvailableDate] ?? []).find(
            (slot) => slot.available,
          )?.time ?? "")
        : "";

      setDrafts((prev) => {
        const current = prev[code] ?? {
          ownerResponse: "",
          proposedDate: "",
          proposedTime: "",
        };

        const validDates = new Set(
          data.days.filter((day) => day.hasAvailability).map((day) => day.date),
        );
        let nextDate = current.proposedDate;
        let nextTime = current.proposedTime;

        if (!validDates.has(nextDate)) {
          nextDate = firstAvailableDate;
          nextTime = firstAvailableTime;
        }

        const validTimes = nextDate
          ? (data.slotsByDate[nextDate] ?? [])
              .filter((slot) => slot.available)
              .map((slot) => slot.time)
          : [];

        if (!validTimes.includes(nextTime)) {
          nextTime = validTimes[0] ?? "";
        }

        return {
          ...prev,
          [code]: {
            ...current,
            proposedDate: nextDate,
            proposedTime: nextTime,
          },
        };
      });
    } catch (err) {
      setDecisionAvailability(null);
      setDecisionError(
        err instanceof Error
          ? err.message
          : "Impossibile caricare disponibilita.",
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  const openDecisionDialog = (
    mode: DecisionDialogMode,
    row: ReservationDoc,
  ) => {
    setDecisionError(null);
    setDecisionDialogMode(mode);

    if (mode === "proposed") {
      void loadDecisionAvailability(row.guests, row.code);
      return;
    }

    setDecisionAvailability(null);
  };

  const closeDecisionDialog = () => {
    if (selectedReservation && pendingCode === selectedReservation.code) return;
    setDecisionDialogMode(null);
    setDecisionError(null);
    setDecisionAvailability(null);
  };

  const runDecision = async (row: ReservationDoc, action: ActionType) => {
    setError(null);
    setPendingCode(row.code);
    setActiveDecisionAction(action);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const draft = drafts[row.code] ?? {
        ownerResponse: "",
        proposedDate: "",
        proposedTime: "",
      };

      const response = await fetch(`/api/reservations/${row.code}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ownerResponse: draft.ownerResponse,
          proposedDate: draft.proposedDate,
          proposedTime: draft.proposedTime,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        customerNotificationSent?: boolean;
        customerNotificationError?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Aggiornamento non riuscito.");
      }

      if (
        data.customerNotificationSent === false &&
        data.customerNotificationError
      ) {
        setError(data.customerNotificationError);
      }

      if (action === "confirmed") {
        setSelectedCode(null);
      }

      setDecisionDialogMode(null);
      setDecisionError(null);
      setDecisionAvailability(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore inatteso.";
      setError(message);
      setDecisionError(message);
    } finally {
      setPendingCode(null);
      setActiveDecisionAction(null);
    }
  };

  const saveSettings = async (closeAfterSave = false) => {
    setSettingsError(null);
    setSettingsFeedback(null);
    setSettingsSaving(true);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const response = await fetch("/api/admin/reservations/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Salvataggio non riuscito.");
      }

      const normalized = normalizeSettings(settings);
      setSavedSettings(normalized);
      setSettingsFeedback("Impostazioni prenotazioni salvate.");
      if (closeAfterSave) {
        setCloseSettingsPromptOpen(false);
        setCalendarPickerOpen(false);
        setSettingsOpen(false);
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Errore inatteso.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const requestCloseSettings = () => {
    if (settingsSaving || hasPendingSettingsChanges) {
      setCloseSettingsPromptOpen(true);
      return;
    }
    setCalendarPickerOpen(false);
    setSettingsOpen(false);
  };

  const discardAndCloseSettings = () => {
    setSettings(savedSettings);
    setCloseSettingsPromptOpen(false);
    setCalendarPickerOpen(false);
    setSettingsOpen(false);
  };

  const toggleWorkingDay = (day: number) => {
    setSettings((prev) => {
      const exists = prev.workingDays.includes(day);
      return {
        ...prev,
        workingDays: exists
          ? prev.workingDays.filter((value) => value !== day)
          : [...prev.workingDays, day],
      };
    });
  };

  const removeHoliday = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((entry) => entry !== value),
    }));
  };

  const removeSpecialOpening = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      specialOpenings: prev.specialOpenings.filter((entry) => entry !== value),
    }));
  };

  const finalizeCapacityDraft = () => {
    if (capacityDraft.trim() === "") {
      setCapacityDraft(String(settings.capacityPerSlot ?? 40));
      return;
    }

    const parsed = Number(capacityDraft);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setCapacityDraft(String(settings.capacityPerSlot ?? 40));
      return;
    }

    const normalized = Math.min(500, Math.round(parsed));
    setCapacityDraft(String(normalized));
    if (normalized !== settings.capacityPerSlot) {
      setSettings((prev) => ({ ...prev, capacityPerSlot: normalized }));
    }
  };

  const cleanupOldReservations = async () => {
    setError(null);
    setCleanupPending(true);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const response = await fetch("/api/admin/reservations/cleanup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json()) as {
        deletedCount?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Pulizia non riuscita.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore inatteso.");
    } finally {
      setCleanupPending(false);
    }
  };

  const addHolidayByDate = (dateValue: string) => {
    if (!dateValue) return;
    if (dateValue < todayKey()) return;

    setSettings((prev) => {
      if (calendarPickerMode === "holiday") {
        return {
          ...prev,
          holidays: [...new Set([...prev.holidays, dateValue])].sort(),
          specialOpenings: prev.specialOpenings.filter(
            (entry) => entry !== dateValue,
          ),
        };
      }

      return {
        ...prev,
        specialOpenings: [
          ...new Set([...prev.specialOpenings, dateValue]),
        ].sort(),
        holidays: prev.holidays.filter((entry) => entry !== dateValue),
      };
    });
  };

  const openCalendarPicker = (mode: "holiday" | "opening") => {
    setCalendarPickerMode(mode);
    setCalendarPickerOpen(true);
  };

  const isCalendarDayActive = (dateValue: string) => {
    return calendarPickerMode === "holiday"
      ? settings.holidays.includes(dateValue)
      : settings.specialOpenings.includes(dateValue);
  };

  const statusLabel = (row: ReservationDoc) => {
    const isExpired =
      row.date < todayKey() &&
      (row.status === "pending" || row.status === "proposed");

    if (isExpired) return "Scaduta";
    if (row.status === "pending") return "Nuova";
    if (row.status === "proposed") return "Proposta inviata";
    if (row.status === "confirmed") return "Confermata";
    return "Rifiutata";
  };

  if (loading) {
    return <p className="section-subtitle">Caricamento prenotazioni...</p>;
  }

  return (
    <article className="admin-reservations-layout">
      <section className="card-block">
        <div className="admin-reservations-head">
          <h3>Prenotazioni</h3>
          <div className="admin-reservations-head-actions">
            <button
              type="button"
              className="admin-mini-btn"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙ Impostazioni
            </button>
            <button
              type="button"
              className="admin-mini-btn"
              disabled={cleanupPending}
              onClick={() => void cleanupOldReservations()}
            >
              {cleanupPending ? "Pulizia..." : "Elimina prenotazioni vecchie"}
            </button>
          </div>
        </div>
        {oldRows.length >= 50 ? (
          <p className="admin-old-warning">
            Hai {oldRows.length} prenotazioni vecchie: valuta la pulizia.
          </p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        <div className="admin-reservation-groups">
          <div className="admin-reservation-group">
            <h4>Nuove</h4>
            {newRows.length === 0 ? (
              <p className="section-subtitle">Nessuna prenotazione nuova.</p>
            ) : (
              <div className="admin-reservation-list">
                {newRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={
                      highlightedCode === row.code
                        ? "admin-reservation-item highlighted"
                        : "admin-reservation-item"
                    }
                    onClick={() => setSelectedCode(row.code)}
                  >
                    <span>
                      <strong>{row.customerName}</strong> · {row.date} ·{" "}
                      {row.time}
                    </span>
                    <span className={`badge ${row.status}`}>
                      {statusLabel(row)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="admin-reservation-group">
            <h4>Confermate</h4>
            {confirmedRows.length === 0 ? (
              <p className="section-subtitle">
                Nessuna prenotazione confermata.
              </p>
            ) : (
              <div className="admin-reservation-list">
                {confirmedRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="admin-reservation-item"
                    onClick={() => setSelectedCode(row.code)}
                  >
                    <span>
                      <strong>{row.customerName}</strong> · {row.date} ·{" "}
                      {row.time}
                    </span>
                    <span className={`badge ${row.status}`}>
                      {statusLabel(row)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="admin-reservation-group">
            <h4>Vecchie</h4>
            {oldRows.length === 0 ? (
              <p className="section-subtitle">Nessuna prenotazione vecchia.</p>
            ) : (
              <div className="admin-reservation-list">
                {oldRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="admin-reservation-item"
                    onClick={() => setSelectedCode(row.code)}
                  >
                    <span>
                      <strong>{row.customerName}</strong> · {row.date} ·{" "}
                      {row.time}
                    </span>
                    <span className={`badge ${row.status}`}>
                      {statusLabel(row)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedReservation ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal">
            <div className="admin-modal-head">
              <h3>Dettaglio prenotazione</h3>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                onClick={() => setSelectedCode(null)}
              >
                Chiudi
              </button>
            </div>

            <p>
              <strong>Codice:</strong> {selectedReservation.code}
            </p>
            <p>
              <strong>Cliente:</strong> {selectedReservation.customerName}
            </p>
            <p>
              <strong>Telefono:</strong> {selectedReservation.phone}
            </p>
            <p>
              <strong>Data/Ora richieste:</strong> {selectedReservation.date}{" "}
              alle {selectedReservation.time}
            </p>
            <p>
              <strong>Persone:</strong> {selectedReservation.guests}
            </p>
            <p>
              <strong>Stato:</strong> {statusLabel(selectedReservation)}
            </p>
            <p>
              <strong>Note:</strong> {selectedReservation.notes || "-"}
            </p>

            {(() => {
              const isBusy = pendingCode === selectedReservation.code;

              return (
                <div className="booking-form" style={{ marginTop: "0.7rem" }}>
                  <div className="two-cols admin-decision-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isBusy}
                      onClick={() =>
                        void runDecision(selectedReservation, "confirmed")
                      }
                    >
                      {isBusy ? "Attendi..." : "Conferma"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary admin-modal-btn admin-decision-reject"
                      disabled={isBusy}
                      onClick={() =>
                        openDecisionDialog("rejected", selectedReservation)
                      }
                    >
                      {isBusy ? "Attendi..." : "Rifiuta"}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary admin-modal-btn admin-decision-propose"
                    disabled={isBusy}
                    onClick={() =>
                      openDecisionDialog("proposed", selectedReservation)
                    }
                  >
                    {isBusy ? "Attendi..." : "Proponi nuovo orario"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {selectedReservation && decisionDialogMode ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-calendar-modal">
            <div className="admin-modal-head">
              <h3>
                {decisionDialogMode === "rejected"
                  ? "Rifiuta prenotazione"
                  : "Proponi nuovo orario"}
              </h3>
            </div>

            <div className="booking-form">
              <label>
                Messaggio al cliente (opzionale)
                <textarea
                  value={drafts[selectedReservation.code]?.ownerResponse ?? ""}
                  rows={2}
                  maxLength={300}
                  onChange={(event) =>
                    onDraftChange(
                      selectedReservation.code,
                      "ownerResponse",
                      event.target.value,
                    )
                  }
                />
              </label>

              {decisionDialogMode === "proposed" ? (
                <>
                  {decisionLoading ? (
                    <p className="section-subtitle">
                      Caricamento disponibilita...
                    </p>
                  ) : null}

                  {!decisionLoading && decisionAvailability ? (
                    <div className="two-cols">
                      <label>
                        Data proposta
                        <select
                          value={
                            drafts[selectedReservation.code]?.proposedDate ?? ""
                          }
                          onChange={(event) => {
                            const nextDate = event.target.value;
                            const availableTimes = (
                              decisionAvailability.slotsByDate[nextDate] ?? []
                            )
                              .filter((slot) => slot.available)
                              .map((slot) => slot.time);

                            setDrafts((prev) => {
                              const current = prev[
                                selectedReservation.code
                              ] ?? {
                                ownerResponse: "",
                                proposedDate: "",
                                proposedTime: "",
                              };

                              return {
                                ...prev,
                                [selectedReservation.code]: {
                                  ...current,
                                  proposedDate: nextDate,
                                  proposedTime: availableTimes[0] ?? "",
                                },
                              };
                            });
                          }}
                        >
                          {decisionAvailability.days.filter(
                            (day) => day.hasAvailability,
                          ).length === 0 ? (
                            <option value="">Nessuna data disponibile</option>
                          ) : null}
                          {(decisionAvailability.days ?? [])
                            .filter((day) => day.hasAvailability)
                            .map((day) => (
                              <option key={day.date} value={day.date}>
                                {day.date}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label>
                        Orario proposto
                        <select
                          value={
                            drafts[selectedReservation.code]?.proposedTime ?? ""
                          }
                          onChange={(event) =>
                            onDraftChange(
                              selectedReservation.code,
                              "proposedTime",
                              event.target.value,
                            )
                          }
                        >
                          {(
                            decisionAvailability.slotsByDate[
                              drafts[selectedReservation.code]?.proposedDate ??
                                ""
                            ] ?? []
                          ).filter((slot) => slot.available).length === 0 ? (
                            <option value="">Nessun orario disponibile</option>
                          ) : null}
                          {(
                            decisionAvailability.slotsByDate[
                              drafts[selectedReservation.code]?.proposedDate ??
                                ""
                            ] ?? []
                          )
                            .filter((slot) => slot.available)
                            .map((slot) => (
                              <option key={slot.time} value={slot.time}>
                                {slot.time}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  {!decisionLoading &&
                  decisionAvailability &&
                  decisionAvailability.days.filter((day) => day.hasAvailability)
                    .length === 0 ? (
                    <p className="section-subtitle">
                      Non ci sono date disponibili da proporre con le
                      impostazioni correnti.
                    </p>
                  ) : null}
                </>
              ) : null}

              {decisionError ? (
                <p className="error-text">{decisionError}</p>
              ) : null}

              <div className="booking-step-actions two-buttons">
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  onClick={closeDecisionDialog}
                  disabled={pendingCode === selectedReservation.code}
                >
                  Annulla
                </button>

                <button
                  type="button"
                  className={
                    decisionDialogMode === "rejected"
                      ? "btn-secondary admin-modal-btn admin-decision-reject"
                      : "btn-secondary admin-modal-btn admin-decision-propose"
                  }
                  disabled={
                    pendingCode === selectedReservation.code ||
                    (decisionDialogMode === "proposed" &&
                      (!(
                        drafts[selectedReservation.code]?.proposedDate ?? ""
                      ) ||
                        !(
                          drafts[selectedReservation.code]?.proposedTime ?? ""
                        )))
                  }
                  onClick={() =>
                    void runDecision(selectedReservation, decisionDialogMode)
                  }
                >
                  {pendingCode === selectedReservation.code
                    ? "Attendi..."
                    : decisionDialogMode === "rejected"
                      ? "Conferma rifiuto"
                      : "Invia proposta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-settings-modal">
            <div className="admin-modal-head">
              <h3>Impostazioni prenotazioni</h3>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                onClick={requestCloseSettings}
              >
                Chiudi
              </button>
            </div>

            {settingsLoading ? (
              <p className="section-subtitle">Caricamento impostazioni...</p>
            ) : (
              <div className="booking-form">
                <div className="admin-settings-row">
                  <label>
                    Orario apertura
                    <input
                      type="time"
                      value={settings.openTime}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          openTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Orario chiusura
                    <input
                      type="time"
                      value={settings.closeTime}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          closeTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Intervallo slot
                    <select
                      value={settings.slotMinutes}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          slotMinutes:
                            Number(event.target.value) === 15 ? 15 : 30,
                        }))
                      }
                    >
                      <option value={15}>15 minuti</option>
                      <option value={30}>30 minuti</option>
                    </select>
                  </label>
                  <label>
                    Capacità totale
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={capacityDraft}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (!/^\d*$/.test(raw)) {
                          return;
                        }

                        setCapacityDraft(raw);

                        if (raw === "") {
                          return;
                        }

                        const parsed = Number(raw);
                        if (!Number.isFinite(parsed) || parsed < 1) {
                          return;
                        }

                        const normalized = Math.min(500, Math.round(parsed));
                        setSettings((prev) => ({
                          ...prev,
                          capacityPerSlot: normalized,
                        }));
                      }}
                      onBlur={finalizeCapacityDraft}
                    />
                  </label>
                </div>

                <div>
                  <p className="booking-step-title">Giorni lavorativi</p>
                  <div className="admin-inline-chips">
                    {weekdayOptions.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        className={
                          settings.workingDays.includes(day.key)
                            ? "booking-chip active"
                            : "booking-chip"
                        }
                        onClick={() => toggleWorkingDay(day.key)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="admin-chip-head">
                    <p className="booking-step-title">
                      Festività / chiusure straordinarie
                    </p>
                    <button
                      type="button"
                      className="admin-add-chip-btn"
                      onClick={() => openCalendarPicker("holiday")}
                      aria-label="Aggiungi chiusura straordinaria"
                    >
                      +
                    </button>
                  </div>

                  <div className="admin-inline-chips admin-chip-scroll">
                    {settings.holidays.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="booking-chip"
                        onClick={() => removeHoliday(value)}
                      >
                        {value} ×
                      </button>
                    ))}
                  </div>

                  <div
                    className="admin-chip-head"
                    style={{ marginTop: "0.65rem" }}
                  >
                    <p className="booking-step-title">Aperture straordinarie</p>
                    <button
                      type="button"
                      className="admin-add-chip-btn"
                      onClick={() => openCalendarPicker("opening")}
                      aria-label="Aggiungi apertura straordinaria"
                    >
                      +
                    </button>
                  </div>
                  <div className="admin-inline-chips admin-chip-scroll">
                    {settings.specialOpenings.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className="booking-chip"
                        onClick={() => removeSpecialOpening(value)}
                      >
                        {value} ×
                      </button>
                    ))}
                  </div>
                </div>

                <div className="booking-step-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={settingsSaving}
                    onClick={() => void saveSettings()}
                  >
                    {settingsSaving ? "Salvataggio..." : "Salva impostazioni"}
                  </button>
                </div>
              </div>
            )}

            {settingsFeedback ? (
              <p className="section-subtitle">{settingsFeedback}</p>
            ) : null}
            {settingsError ? (
              <p className="error-text">{settingsError}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedReservation &&
      pendingCode === selectedReservation.code &&
      activeDecisionAction === "confirmed" ? (
        <div className="app-loader-overlay" role="status" aria-live="polite">
          <div className="app-loader-card">
            <img
              src="/assets/loader.gif"
              alt="Caricamento"
              className="app-loader-gif"
            />
            <p>Conferma prenotazione in corso...</p>
          </div>
        </div>
      ) : null}

      {calendarPickerOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-calendar-modal">
            <div className="admin-modal-head">
              <h3>
                {calendarPickerMode === "holiday"
                  ? "Aggiungi festivita"
                  : "Aggiungi apertura straordinaria"}
              </h3>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                onClick={() => setCalendarPickerOpen(false)}
              >
                Chiudi
              </button>
            </div>

            <div className="admin-holiday-calendar">
              <div className="admin-holiday-calendar-head">
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  onClick={() =>
                    setHolidayMonth((prev) => shiftMonth(prev, -1))
                  }
                >
                  ←
                </button>
                <strong>{monthLabel(holidayMonth)}</strong>
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  onClick={() => setHolidayMonth((prev) => shiftMonth(prev, 1))}
                >
                  →
                </button>
              </div>

              <div className="admin-holiday-weekdays">
                <span>L</span>
                <span>M</span>
                <span>M</span>
                <span>G</span>
                <span>V</span>
                <span>S</span>
                <span>D</span>
              </div>

              <div className="admin-holiday-days">
                {holidayCalendarCells.map((cell, index) => {
                  if (cell.kind === "empty") {
                    return (
                      <span
                        key={`empty-${index}`}
                        className="admin-holiday-empty"
                      />
                    );
                  }

                  const isPast = cell.dateKey < todayKey();
                  const isActive = isCalendarDayActive(cell.dateKey);

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      className={
                        isActive
                          ? "admin-holiday-day active"
                          : "admin-holiday-day"
                      }
                      disabled={isPast}
                      onClick={() => addHolidayByDate(cell.dateKey)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {closeSettingsPromptOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-calendar-modal">
            <div className="admin-modal-head">
              <h3>Salvataggi in sospeso</h3>
            </div>

            <p className="section-subtitle">
              Hai modifiche non salvate nelle impostazioni prenotazioni.
            </p>
            <p className="section-subtitle">Vuoi salvare prima di chiudere?</p>

            <div className="booking-step-actions two-buttons">
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                onClick={() => setCloseSettingsPromptOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                disabled={settingsSaving}
                onClick={discardAndCloseSettings}
              >
                Chiudi senza salvare
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={settingsSaving}
                onClick={() => void saveSettings(true)}
              >
                {settingsSaving ? "Salvataggio..." : "Salva e chiudi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
