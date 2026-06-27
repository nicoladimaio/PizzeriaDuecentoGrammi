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

type ActionType = "confirmed" | "rejected" | "proposed" | "delete";

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

type ManualReservationForm = {
  customerName: string;
  phone: string;
  email: string;
  diningArea: "inside" | "outside";
  date: string;
  time: string;
  guests: string;
  notes: string;
};

type ApiErrorPayload = {
  error?: string;
};

export type SettingsLeaveGuard = {
  hasUnsavedChanges: () => boolean;
  saveChanges: () => Promise<boolean>;
  discardChanges: () => void;
};

const slotMinuteOptions: Array<15 | 30 | 60> = [15, 30, 60];

const weekdayOptions = [
  { key: 1, label: "Lun" },
  { key: 2, label: "Mar" },
  { key: 3, label: "Mer" },
  { key: 4, label: "Gio" },
  { key: 5, label: "Ven" },
  { key: 6, label: "Sab" },
  { key: 0, label: "Dom" },
];

const defaultRejectMessage =
  "Non riusciamo a garantirti il posto prenotato per l'orario richiesto. Ti invitiamo a riprovare con una nuova richiesta.";
const defaultCancelConfirmedMessage =
  "La tua prenotazione confermata e stata annullata. Se vuoi, contattaci per concordare una nuova disponibilita.";
const defaultProposalMessage =
  "Ti proponiamo un orario alternativo disponibile: se per te va bene, confermalo dal pulsante in email.";
const proposalDatesPageSize = 8;

const defaultSettings: ReservationSettings = {
  openTime: "19:00",
  closeTime: "23:00",
  slotMinutes: 30,
  saturdaySlotMinutes: 30,
  capacityPerSlot: 40,
  insideActive: true,
  outsideActive: true,
  insideCapacityPerSlot: 40,
  outsideCapacityPerSlot: 24,
  workingDays: [1, 2, 3, 4, 5, 6, 0],
  holidays: [],
  specialOpenings: [],
};

const TOTAL_SEATS_FALLBACK = 80;

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateKeyDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateKeyDaysAhead = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (value: number) => {
  const hours = String(Math.floor(value / 60)).padStart(2, "0");
  const minutes = String(value % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const monthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
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

const actionLoadingLabel = (action: ActionType | null) => {
  switch (action) {
    case "confirmed":
      return "Conferma prenotazione in corso...";
    case "rejected":
      return "Rifiuto prenotazione in corso...";
    case "proposed":
      return "Invio proposta in corso...";
    case "delete":
      return "Eliminazione prenotazione in corso...";
    default:
      return "Operazione in corso...";
  }
};

const formatDateShort = (value: string) => {
  const parsed = parseDateKey(value);
  return parsed.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
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
    diningArea: data.diningArea === "outside" ? "outside" : "inside",
    arrived: data.arrived === true,
    id: snap.id,
  };
};

const normalizeSettings = (
  settings: ReservationSettings,
): ReservationSettings => ({
  ...settings,
  slotMinutes:
    settings.slotMinutes === 15 ||
    settings.slotMinutes === 30 ||
    settings.slotMinutes === 60
      ? settings.slotMinutes
      : 30,
  saturdaySlotMinutes:
    settings.saturdaySlotMinutes === 15 ||
    settings.saturdaySlotMinutes === 30 ||
    settings.saturdaySlotMinutes === 60
      ? settings.saturdaySlotMinutes
      : settings.slotMinutes === 15 ||
          settings.slotMinutes === 30 ||
          settings.slotMinutes === 60
        ? settings.slotMinutes
        : 30,
  capacityPerSlot:
    typeof settings.capacityPerSlot === "number" &&
    Number.isFinite(settings.capacityPerSlot) &&
    settings.capacityPerSlot > 0
      ? Math.round(settings.capacityPerSlot)
      : 40,
  insideActive: settings.insideActive !== false,
  outsideActive: settings.outsideActive !== false,
  insideCapacityPerSlot:
    typeof settings.insideCapacityPerSlot === "number" &&
    Number.isFinite(settings.insideCapacityPerSlot) &&
    settings.insideCapacityPerSlot > 0
      ? Math.round(settings.insideCapacityPerSlot)
      : 40,
  outsideCapacityPerSlot:
    typeof settings.outsideCapacityPerSlot === "number" &&
    Number.isFinite(settings.outsideCapacityPerSlot) &&
    settings.outsideCapacityPerSlot > 0
      ? Math.round(settings.outsideCapacityPerSlot)
      : 24,
  workingDays: [...new Set(settings.workingDays)].sort((a, b) => a - b),
  holidays: [...new Set(settings.holidays)].sort(),
  specialOpenings: [...new Set(settings.specialOpenings)].sort(),
});

const deriveTotalCapacity = (settings: ReservationSettings): number => {
  const total =
    (settings.insideActive ? settings.insideCapacityPerSlot : 0) +
    (settings.outsideActive ? settings.outsideCapacityPerSlot : 0);
  return total > 0 ? total : settings.capacityPerSlot;
};

const getDefaultDiningArea = (
  settings: ReservationSettings,
): "inside" | "outside" =>
  settings.insideActive || !settings.outsideActive ? "inside" : "outside";

const getSlotMinutesForDateKey = (
  dateKey: string,
  settings: ReservationSettings,
): 15 | 30 | 60 => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.getDay() === 6
    ? settings.saturdaySlotMinutes
    : settings.slotMinutes;
};

const isBookingOpenOnDateKey = (
  dateKey: string,
  settings: ReservationSettings,
): boolean => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const weekday = date.getDay();
  const isSpecialOpening = settings.specialOpenings.includes(dateKey);
  const isHoliday = settings.holidays.includes(dateKey);
  const isWorkingDay = settings.workingDays.includes(weekday);

  if (isSpecialOpening) {
    return true;
  }

  return isWorkingDay && !isHoliday;
};

const parseJsonResponse = async <T,>(response: Response): Promise<T> => {
  const rawText = await response.text();

  if (!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      `Il server ha restituito una risposta non valida${
        response.status ? ` (HTTP ${response.status})` : ""
      }.`,
    );
  }
};

const buildSettingsSnapshot = (
  settings: ReservationSettings,
  insideCapacityDraft: string,
  outsideCapacityDraft: string,
) =>
  JSON.stringify({
    settings: normalizeSettings(settings),
    insideCapacityDraft,
    outsideCapacityDraft,
  });

export function AdminReservationsPanel({
  highlightedCode,
  settingsOnly,
  onLogout,
  onSettingsLeaveGuardChange,
}: {
  highlightedCode?: string;
  settingsOnly?: boolean;
  onLogout?: () => void | Promise<void>;
  onSettingsLeaveGuardChange?: (guard: SettingsLeaveGuard | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<ReservationDoc & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [arrivedPendingCode, setArrivedPendingCode] = useState<string | null>(
    null,
  );
  const [drafts, setDrafts] = useState<Record<string, ProposalDraft>>({});
  const [selectedCode, setSelectedCode] = useState<string | null>(
    highlightedCode ?? null,
  );

  const [settings, setSettings] =
    useState<ReservationSettings>(defaultSettings);
  const [insideCapacityDraft, setInsideCapacityDraft] = useState(
    String(defaultSettings.insideCapacityPerSlot),
  );
  const [outsideCapacityDraft, setOutsideCapacityDraft] = useState(
    String(defaultSettings.outsideCapacityPerSlot),
  );
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] =
    useState<ReservationSettings>(defaultSettings);
  const [savedInsideCapacityDraft, setSavedInsideCapacityDraft] = useState(
    String(defaultSettings.insideCapacityPerSlot),
  );
  const [savedOutsideCapacityDraft, setSavedOutsideCapacityDraft] = useState(
    String(defaultSettings.outsideCapacityPerSlot),
  );
  const [cleanupPending, setCleanupPending] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarPickerMode, setCalendarPickerMode] = useState<
    "holiday" | "opening"
  >("holiday");
  const [holidayMonth, setHolidayMonth] = useState(monthKey(new Date()));
  const [reservationsView, setReservationsView] = useState<
    "open" | "confirmed"
  >("confirmed");
  const [confirmedSelectedDate, setConfirmedSelectedDate] = useState("");
  const [decisionDialogMode, setDecisionDialogMode] =
    useState<DecisionDialogMode | null>(null);
  const [decisionAvailability, setDecisionAvailability] =
    useState<DecisionAvailability | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [activeDecisionAction, setActiveDecisionAction] =
    useState<ActionType | null>(null);
  const [showManualReservationModal, setShowManualReservationModal] =
    useState(false);
  const [manualReservationSaving, setManualReservationSaving] = useState(false);
  const [manualReservationError, setManualReservationError] = useState<
    string | null
  >(null);
  const [manualReservationForm, setManualReservationForm] =
    useState<ManualReservationForm>({
      customerName: "",
      phone: "",
      email: "",
      diningArea: getDefaultDiningArea(defaultSettings),
      date: todayKey(),
      time: "20:00",
      guests: "2",
      notes: "",
    });
  const [currentTime, setCurrentTime] = useState(() => new Date());

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
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
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
        const data = await parseJsonResponse<{
          settings?: ReservationSettings;
          error?: string;
        }>(response);

        if (!response.ok) {
          throw new Error(data.error ?? "Impossibile caricare impostazioni.");
        }

        if (!ignore && data.settings) {
          const normalized = normalizeSettings(data.settings);
          setSettings(normalized);
          setSavedSettings(normalized);
          setInsideCapacityDraft(String(normalized.insideCapacityPerSlot));
          setOutsideCapacityDraft(String(normalized.outsideCapacityPerSlot));
          setSavedInsideCapacityDraft(String(normalized.insideCapacityPerSlot));
          setSavedOutsideCapacityDraft(
            String(normalized.outsideCapacityPerSlot),
          );
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

  useEffect(() => {
    setManualReservationForm((prev) => {
      const selectedRoomVisible =
        prev.diningArea === "inside"
          ? settings.insideActive
          : settings.outsideActive;

      if (selectedRoomVisible) {
        return prev;
      }

      return {
        ...prev,
        diningArea: getDefaultDiningArea(settings),
      };
    });
  }, [settings]);

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
        (row) => row.date >= todayKey() && row.status === "pending",
      ),
    [orderedRows],
  );

  const proposedRows = useMemo(
    () =>
      orderedRows.filter(
        (row) => row.date >= todayKey() && row.status === "proposed",
      ),
    [orderedRows],
  );

  const openRows = useMemo(
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
        (row) => row.date >= dateKeyDaysAgo(2) && row.status === "confirmed",
      ),
    [orderedRows],
  );

  const holidayCalendarCells = useMemo(
    () => buildMonthCells(holidayMonth),
    [holidayMonth],
  );

  const confirmedDayKeys = useMemo(() => {
    return [...new Set(confirmedRows.map((row) => row.date))].sort();
  }, [confirmedRows]);

  const bookingWindowDayKeys = useMemo(() => {
    return Array.from({ length: 31 }, (_, index) => dateKeyDaysAhead(index));
  }, []);

  const confirmedDateSummaries = useMemo(() => {
    return bookingWindowDayKeys
      .map((dateValue) => {
        const rowsForDay = confirmedRows.filter(
          (row) => row.date === dateValue,
        );
        return {
          date: dateValue,
          reservationsCount: rowsForDay.length,
          isSelectable: rowsForDay.length > 0,
        };
      })
      .filter((day) => isBookingOpenOnDateKey(day.date, settings));
  }, [bookingWindowDayKeys, confirmedRows, settings]);

  const confirmedRowsForSelectedDate = useMemo(() => {
    if (!confirmedSelectedDate)
      return [] as Array<ReservationDoc & { id: string }>;
    return confirmedRows.filter((row) => row.date === confirmedSelectedDate);
  }, [confirmedRows, confirmedSelectedDate]);

  const confirmedRowsByTime = useMemo(() => {
    const groups = new Map<string, Array<ReservationDoc & { id: string }>>();
    confirmedRowsForSelectedDate.forEach((row) => {
      const key = row.time || "--:--";
      const existing = groups.get(key) ?? [];
      existing.push(row);
      groups.set(key, existing);
    });

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, rows]) => ({
        time,
        rows: [...rows].sort((a, b) =>
          a.customerName.localeCompare(b.customerName, "it"),
        ),
      }));
  }, [confirmedRowsForSelectedDate]);

  const confirmedSelectedSummary = useMemo(() => {
    const reservationsCount = confirmedRowsForSelectedDate.length;
    const guestsCount = confirmedRowsForSelectedDate.reduce(
      (sum, row) => sum + (Number.isFinite(row.guests) ? row.guests : 0),
      0,
    );
    const totalSeats = Math.max(
      deriveTotalCapacity(settings),
      TOTAL_SEATS_FALLBACK,
    );
    const availableSeats = Math.max(totalSeats - guestsCount, 0);

    return {
      reservationsCount,
      guestsCount,
      totalSeats,
      availableSeats,
    };
  }, [confirmedRowsForSelectedDate, settings]);

  const confirmedSelectedIndex = useMemo(
    () =>
      confirmedDateSummaries.findIndex(
        (day) => day.date === confirmedSelectedDate,
      ),
    [confirmedDateSummaries, confirmedSelectedDate],
  );

  const manualReservationMaxDate = useMemo(
    () => dateKeyDaysAhead(30),
    [],
  );

  const highlightedCurrentTimeSlot = useMemo(() => {
    const selectedDate = confirmedSelectedDate || bookingWindowDayKeys[0];
    if (!selectedDate || selectedDate !== todayKey()) return "";

    const nowMinutes =
      currentTime.getHours() * 60 + currentTime.getMinutes();
    const slotMinutes = getSlotMinutesForDateKey(selectedDate, settings);
    const threshold = Math.max(15, Math.round(slotMinutes / 2));

    const matchingGroup = confirmedRowsByTime.find((group) => {
      const slotTime = parseMinutes(group.time);
      return Number.isFinite(slotTime) && Math.abs(slotTime - nowMinutes) <= threshold;
    });

    return matchingGroup?.time ?? "";
  }, [
    bookingWindowDayKeys,
    confirmedRowsByTime,
    confirmedSelectedDate,
    currentTime,
    settings,
  ]);

  const currentSettingsSnapshot = useMemo(
    () =>
      buildSettingsSnapshot(
        settings,
        insideCapacityDraft,
        outsideCapacityDraft,
      ),
    [insideCapacityDraft, outsideCapacityDraft, settings],
  );

  const savedSettingsSnapshot = useMemo(
    () =>
      buildSettingsSnapshot(
        savedSettings,
        savedInsideCapacityDraft,
        savedOutsideCapacityDraft,
      ),
    [savedInsideCapacityDraft, savedOutsideCapacityDraft, savedSettings],
  );

  const hasUnsavedSettingsChanges = Boolean(
    settingsOnly &&
    !settingsLoading &&
    currentSettingsSnapshot !== savedSettingsSnapshot,
  );

  const manualTimeOptions = useMemo(() => {
    const open = parseMinutes(settings.openTime);
    const close = parseMinutes(settings.closeTime);
    const slotMinutes = getSlotMinutesForDateKey(
      manualReservationForm.date,
      settings,
    );

    if (!Number.isFinite(open) || !Number.isFinite(close) || close < open) {
      return ["20:00"];
    }

    const slots: string[] = [];
    for (let minute = open; minute <= close; minute += slotMinutes) {
      slots.push(minutesToTime(minute));
    }

    return slots.length > 0 ? slots : ["20:00"];
  }, [
    manualReservationForm.date,
    settings.closeTime,
    settings.openTime,
    settings.saturdaySlotMinutes,
    settings.slotMinutes,
  ]);

  useEffect(() => {
    setManualReservationForm((prev) => {
      if (manualTimeOptions.includes(prev.time)) {
        return prev;
      }

      return {
        ...prev,
        time: manualTimeOptions[0] ?? "20:00",
      };
    });
  }, [manualTimeOptions]);

  const availableProposalDays = useMemo(() => {
    if (!decisionAvailability) return [] as string[];
    return decisionAvailability.days
      .filter((day) => day.hasAvailability)
      .map((day) => day.date);
  }, [decisionAvailability]);

  const currentProposalDate = useMemo(() => {
    if (!selectedReservation || availableProposalDays.length === 0) return "";
    const selected = drafts[selectedReservation.code]?.proposedDate;
    return selected && availableProposalDays.includes(selected)
      ? selected
      : availableProposalDays[0];
  }, [availableProposalDays, drafts, selectedReservation]);

  const currentProposalDateIndex = useMemo(() => {
    if (!currentProposalDate) return 0;
    const idx = availableProposalDays.indexOf(currentProposalDate);
    return idx < 0 ? 0 : idx;
  }, [availableProposalDays, currentProposalDate]);

  const currentProposalPageStart = useMemo(
    () =>
      Math.floor(currentProposalDateIndex / proposalDatesPageSize) *
      proposalDatesPageSize,
    [currentProposalDateIndex],
  );

  const pagedProposalDays = useMemo(
    () =>
      availableProposalDays.slice(
        currentProposalPageStart,
        currentProposalPageStart + proposalDatesPageSize,
      ),
    [availableProposalDays, currentProposalPageStart],
  );

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
    setInsideCapacityDraft(String(settings.insideCapacityPerSlot));
  }, [settings.insideCapacityPerSlot]);

  useEffect(() => {
    setOutsideCapacityDraft(String(settings.outsideCapacityPerSlot));
  }, [settings.outsideCapacityPerSlot]);

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

  const loadDecisionAvailability = async (
    guests: number,
    code: string,
    requestedDate: string,
    requestedTime: string,
  ) => {
    setDecisionLoading(true);
    setDecisionError(null);

    try {
      const selectedRow = rows.find((row) => row.code === code);
      const room = selectedRow?.diningArea === "outside" ? "outside" : "inside";
      const response = await fetch(
        `/api/reservations/availability?guests=${guests}&room=${room}`,
      );
      const data = await parseJsonResponse<DecisionAvailability>(response);

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
          if (validDates.has(requestedDate)) {
            nextDate = requestedDate;
          } else {
            nextDate = firstAvailableDate;
          }

          const requestedSlots = nextDate
            ? (data.slotsByDate[nextDate] ?? []).filter(
                (slot) => slot.available,
              )
            : [];
          const hasRequestedTime = requestedSlots.some(
            (slot) => slot.time === requestedTime,
          );
          nextTime = hasRequestedTime
            ? requestedTime
            : (requestedSlots[0]?.time ?? firstAvailableTime);
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
      void loadDecisionAvailability(row.guests, row.code, row.date, row.time);
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

      const ownerResponseRaw = draft.ownerResponse.trim();
      const ownerResponse =
        ownerResponseRaw ||
        (action === "rejected"
          ? row.status === "confirmed"
            ? defaultCancelConfirmedMessage
            : defaultRejectMessage
          : action === "proposed"
            ? defaultProposalMessage
            : "");

      const response = await fetch(`/api/reservations/${row.code}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ownerResponse,
          proposedDate: draft.proposedDate,
          proposedTime: draft.proposedTime,
        }),
      });

      const data = await parseJsonResponse<{
        error?: string;
        customerNotificationSent?: boolean;
        customerNotificationError?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Aggiornamento non riuscito.");
      }

      if (
        data.customerNotificationSent === false &&
        data.customerNotificationError
      ) {
        setError(data.customerNotificationError);
      }

      setSelectedCode(null);

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

      const payloadToSave = {
        ...settings,
        capacityPerSlot: deriveTotalCapacity(settings),
      };

      const response = await fetch("/api/admin/reservations/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payloadToSave),
      });

      const data = await parseJsonResponse<{
        ok?: boolean;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Salvataggio non riuscito.");
      }

      const normalized = normalizeSettings(payloadToSave);
      setSettings(normalized);
      setSavedSettings(normalized);
      setInsideCapacityDraft(String(normalized.insideCapacityPerSlot));
      setOutsideCapacityDraft(String(normalized.outsideCapacityPerSlot));
      setSavedInsideCapacityDraft(String(normalized.insideCapacityPerSlot));
      setSavedOutsideCapacityDraft(String(normalized.outsideCapacityPerSlot));
      setSettingsFeedback("Impostazioni prenotazioni salvate.");
      if (closeAfterSave) {
        setCalendarPickerOpen(false);
      }
      return true;
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Errore inatteso.");
      return false;
    } finally {
      setSettingsSaving(false);
    }
  };

  const discardUnsavedSettingsChanges = () => {
    setSettings(savedSettings);
    setInsideCapacityDraft(savedInsideCapacityDraft);
    setOutsideCapacityDraft(savedOutsideCapacityDraft);
    setSettingsError(null);
    setSettingsFeedback("Modifiche annullate.");
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

  const finalizeAreaCapacityDraft = (area: "inside" | "outside") => {
    const currentDraft =
      area === "inside" ? insideCapacityDraft : outsideCapacityDraft;
    const fallback =
      area === "inside"
        ? settings.insideCapacityPerSlot
        : settings.outsideCapacityPerSlot;

    if (currentDraft.trim() === "") {
      if (area === "inside") setInsideCapacityDraft(String(fallback));
      if (area === "outside") setOutsideCapacityDraft(String(fallback));
      return;
    }

    const parsed = Number(currentDraft);
    if (!Number.isFinite(parsed) || parsed < 1) {
      if (area === "inside") setInsideCapacityDraft(String(fallback));
      if (area === "outside") setOutsideCapacityDraft(String(fallback));
      return;
    }

    const normalized = Math.min(500, Math.round(parsed));
    if (area === "inside") {
      setInsideCapacityDraft(String(normalized));
      if (normalized !== settings.insideCapacityPerSlot) {
        setSettings((prev) => ({ ...prev, insideCapacityPerSlot: normalized }));
      }
      return;
    }

    setOutsideCapacityDraft(String(normalized));
    if (normalized !== settings.outsideCapacityPerSlot) {
      setSettings((prev) => ({ ...prev, outsideCapacityPerSlot: normalized }));
    }
  };

  const cleanupOldReservations = async (silent = false) => {
    setError(null);
    setCleanupPending(true);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        if (silent) return;
        throw new Error("Sessione admin non valida.");
      }

      const response = await fetch("/api/admin/reservations/cleanup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseJsonResponse<{
        deletedCount?: number;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? "Pulizia non riuscita.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore inatteso.");
    } finally {
      setCleanupPending(false);
    }
  };

  const deleteReservation = async (code: string) => {
    setError(null);
    setPendingCode(code);
    setActiveDecisionAction("delete");

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const response = await fetch(`/api/admin/reservations/${code}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseJsonResponse<ApiErrorPayload>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Eliminazione non riuscita.");
      }

      setSelectedCode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore inatteso.");
    } finally {
      setPendingCode(null);
      setActiveDecisionAction(null);
    }
  };

  const toggleReservationArrived = async (
    row: ReservationDoc & { id: string },
  ) => {
    setError(null);
    setArrivedPendingCode(row.code);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const response = await fetch(`/api/admin/reservations/${row.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          arrived: row.arrived !== true,
        }),
      });

      const data = await parseJsonResponse<ApiErrorPayload>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Aggiornamento arrivo non riuscito.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore inatteso.");
    } finally {
      setArrivedPendingCode(null);
    }
  };

  useEffect(() => {
    void cleanupOldReservations(true);
  }, []);

  const resetManualReservationForm = () => {
    setManualReservationForm({
      customerName: "",
      phone: "",
      email: "",
      diningArea: getDefaultDiningArea(settings),
      date: todayKey(),
      time: manualTimeOptions[0] ?? "20:00",
      guests: "2",
      notes: "",
    });
    setManualReservationError(null);
  };

  const submitManualReservation = async () => {
    setManualReservationError(null);
    setManualReservationSaving(true);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const response = await fetch("/api/admin/reservations/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerName: manualReservationForm.customerName,
          phone: manualReservationForm.phone,
          email: manualReservationForm.email,
          diningArea: manualReservationForm.diningArea,
          date: manualReservationForm.date,
          time: manualReservationForm.time,
          guests: Number(manualReservationForm.guests),
          notes: manualReservationForm.notes,
        }),
      });

      const data = await parseJsonResponse<ApiErrorPayload>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Inserimento prenotazione non riuscito.");
      }

      setReservationsView("confirmed");
      setConfirmedSelectedDate(manualReservationForm.date);
      setShowManualReservationModal(false);
      resetManualReservationForm();
    } catch (err) {
      setManualReservationError(
        err instanceof Error ? err.message : "Errore inatteso.",
      );
    } finally {
      setManualReservationSaving(false);
    }
  };

  useEffect(() => {
    const selectableDayKeys = confirmedDateSummaries
      .filter((day) => day.isSelectable)
      .map((day) => day.date);

    if (selectableDayKeys.length === 0) {
      setConfirmedSelectedDate("");
      return;
    }

    const stillExists = selectableDayKeys.includes(confirmedSelectedDate);

    if (!stillExists) {
      const today = todayKey();
      const nextDate =
        selectableDayKeys.find((dateValue) => dateValue >= today) ??
        selectableDayKeys[0];
      setConfirmedSelectedDate(nextDate);
    }
  }, [confirmedDateSummaries, confirmedSelectedDate]);

  useEffect(() => {
    if (hasUnsavedSettingsChanges && settingsFeedback) {
      setSettingsFeedback(null);
    }
  }, [hasUnsavedSettingsChanges, settingsFeedback]);

  useEffect(() => {
    if (!hasUnsavedSettingsChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedSettingsChanges]);

  useEffect(() => {
    if (!onSettingsLeaveGuardChange || !settingsOnly) {
      return;
    }

    onSettingsLeaveGuardChange({
      hasUnsavedChanges: () => hasUnsavedSettingsChanges,
      saveChanges: () => saveSettings(),
      discardChanges: discardUnsavedSettingsChanges,
    });

    return () => {
      onSettingsLeaveGuardChange(null);
    };
  }, [
    hasUnsavedSettingsChanges,
    onSettingsLeaveGuardChange,
    settingsOnly,
    currentSettingsSnapshot,
    savedSettingsSnapshot,
  ]);

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
    if (row.status === "proposed") return "In attesa";
    if (row.status === "confirmed") return "Confermata";
    return "Rifiutata";
  };

  const setProposalDate = (code: string, dateValue: string) => {
    if (!decisionAvailability) return;

    const availableTimes = (decisionAvailability.slotsByDate[dateValue] ?? [])
      .filter((slot) => slot.available)
      .map((slot) => slot.time);

    setDrafts((prev) => {
      const current = prev[code] ?? {
        ownerResponse: "",
        proposedDate: "",
        proposedTime: "",
      };

      const proposedTime = availableTimes.includes(current.proposedTime)
        ? current.proposedTime
        : (availableTimes[0] ?? "");

      return {
        ...prev,
        [code]: {
          ...current,
          proposedDate: dateValue,
          proposedTime,
        },
      };
    });
  };

  if (loading) {
    return <p className="section-subtitle">Caricamento prenotazioni...</p>;
  }

  return (
    <article className="admin-reservations-layout">
      {!settingsOnly ? (
        <section className="card-block admin-reservations-card">
          {error ? <p className="error-text">{error}</p> : null}

          <div className="admin-reservation-tabs">
            <button
              type="button"
              className={
                reservationsView === "open"
                  ? "admin-reservation-tab active"
                  : "admin-reservation-tab"
              }
              onClick={() => setReservationsView("open")}
            >
              DA GESTIRE
              {openRows.length > 0 ? (
                <span className="admin-reservation-tab-badge">
                  {openRows.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={
                reservationsView === "confirmed"
                  ? "admin-reservation-tab active"
                  : "admin-reservation-tab"
              }
              onClick={() => setReservationsView("confirmed")}
            >
              CONFERMATE
            </button>
            <button
              type="button"
              className="admin-reservation-tab admin-reservation-tab-plus"
              onClick={() => {
                resetManualReservationForm();
                setShowManualReservationModal(true);
              }}
              aria-label="Aggiungi prenotazione manuale"
            >
              +
            </button>
          </div>

          {reservationsView === "open" ? (
            <div className="admin-reservation-group">
              <h4>Da gestire</h4>
              {openRows.length === 0 ? (
                <p className="section-subtitle">
                  Nessuna prenotazione da gestire.
                </p>
              ) : (
                <div className="admin-reservation-list">
                  {openRows.map((row) => (
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
                      <span className="admin-reservation-main">
                        <strong>{row.customerName}</strong>
                        <small>
                          {row.date} · {row.time} · {row.guests} persone
                        </small>
                      </span>
                      <span className={`badge ${row.status}`}>
                        {statusLabel(row)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {reservationsView === "confirmed" ? (
            <div className="admin-reservation-group admin-confirmed-group">
              <>
                <div className="admin-confirmed-day-hero">
                  <button
                    type="button"
                    className="admin-confirmed-day-btn"
                    disabled={confirmedSelectedIndex <= 0}
                    onClick={() => {
                      const idx = confirmedSelectedIndex;
                      if (idx > 0) {
                        const previousDay = confirmedDateSummaries
                          .slice(0, idx)
                          .reverse()
                          .find((day) => day.isSelectable);
                        if (previousDay) {
                          setConfirmedSelectedDate(previousDay.date);
                        }
                      }
                    }}
                  >
                    ←
                  </button>
                  <div className="admin-confirmed-day-label">
                    <strong>
                      {parseDateKey(
                        confirmedSelectedDate || bookingWindowDayKeys[0],
                      ).toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </strong>
                    <small className="admin-confirmed-day-summary">
                      {`👥 ${confirmedSelectedSummary.guestsCount} coperti · 🍕 ${confirmedSelectedSummary.reservationsCount} ${
                        confirmedSelectedSummary.reservationsCount === 1
                          ? "prenotazione"
                          : "prenotazioni"
                      } · 🪑 ${confirmedSelectedSummary.availableSeats} posti liberi`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="admin-confirmed-day-btn"
                    disabled={
                      confirmedSelectedIndex >=
                      confirmedDateSummaries.length - 1
                    }
                    onClick={() => {
                      const idx = confirmedSelectedIndex;
                      if (idx >= 0 && idx < confirmedDateSummaries.length - 1) {
                        const nextDay = confirmedDateSummaries
                          .slice(idx + 1)
                          .find((day) => day.isSelectable);
                        if (nextDay) {
                          setConfirmedSelectedDate(nextDay.date);
                        }
                      }
                    }}
                  >
                    →
                  </button>
                </div>

                <div className="admin-confirmed-day-strip-wrap">
                  <div
                    className="admin-confirmed-day-strip"
                    role="tablist"
                    aria-label="Date prenotazioni confermate"
                  >
                    {confirmedDateSummaries.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        role="tab"
                        aria-selected={confirmedSelectedDate === day.date}
                        disabled={!day.isSelectable}
                        className={
                          confirmedSelectedDate === day.date
                            ? "admin-confirmed-day-pill active"
                            : "admin-confirmed-day-pill"
                        }
                        onClick={() => {
                          if (!day.isSelectable) return;
                          setConfirmedSelectedDate(day.date);
                        }}
                      >
                        <span className="admin-confirmed-day-pill-weekday">
                          {parseDateKey(day.date).toLocaleDateString("it-IT", {
                            weekday: "short",
                          })}
                        </span>
                        <small>
                          {`${parseDateKey(day.date).getDate()} ${parseDateKey(
                            day.date,
                          )
                            .toLocaleDateString("it-IT", {
                              month: "short",
                            })
                            .replace(".", "")}`}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>

                {confirmedRowsByTime.length === 0 ? (
                  <p className="section-subtitle">
                    Nessuna prenotazione confermata nel giorno selezionato.
                  </p>
                ) : (
                  <div className="admin-confirmed-time-groups">
                    {confirmedRowsByTime.map((group) => (
                      <div
                        key={group.time}
                        className={
                          highlightedCurrentTimeSlot === group.time
                            ? "admin-time-slot-block current"
                            : "admin-time-slot-block"
                        }
                      >
                        <h5>{group.time}</h5>
                        <div className="admin-reservation-list admin-reservation-list-compact-grid">
                          {group.rows.map((row) => (
                            <div
                              key={row.id}
                              role="button"
                              tabIndex={0}
                              className={
                                row.arrived
                                  ? "admin-reservation-item admin-reservation-item-compact admin-reservation-item-arrived"
                                  : "admin-reservation-item admin-reservation-item-compact"
                              }
                              onClick={() => setSelectedCode(row.code)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  setSelectedCode(row.code);
                                }
                              }}
                            >
                              <span className="admin-reservation-main">
                                <strong>{row.customerName}</strong>
                                <small>
                                  {row.guests} persone ·{" "}
                                  {row.diningArea === "outside"
                                    ? "Sala esterna"
                                    : "Sala interna"}
                                </small>
                                {row.arrived ? (
                                  <span className="admin-arrived-badge">
                                    Arrivato
                                  </span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                className={
                                  row.arrived
                                    ? "admin-presence-toggle active"
                                    : "admin-presence-toggle"
                                }
                                disabled={arrivedPendingCode === row.code}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void toggleReservationArrived(row);
                                }}
                                title={
                                  row.arrived
                                    ? "Segna cliente non presente"
                                    : "Segna cliente presente"
                                }
                                aria-label={
                                  row.arrived
                                    ? "Segna cliente non presente"
                                    : "Segna cliente presente"
                                }
                              >
                                {row.arrived ? "✓" : "✕"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="card-block admin-settings-landing">
          <div className="admin-reservations-head">
            <h3>Impostazioni Prenotazioni</h3>
            <div className="admin-reservations-head-actions">
              {onLogout ? (
                <button
                  type="button"
                  className="admin-mini-btn admin-settings-logout"
                  onClick={() => void onLogout()}
                >
                  Logout
                </button>
              ) : null}
            </div>
          </div>

          {settingsLoading ? (
            <p className="section-subtitle">Caricamento impostazioni...</p>
          ) : (
            <div className="booking-form">
              <div className="admin-settings-row admin-settings-row-3">
                <div className="admin-settings-time-inline">
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
                </div>
                <label>
                  Intervallo standard
                  <select
                    value={settings.slotMinutes}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        slotMinutes:
                          Number(event.target.value) === 15
                            ? 15
                            : Number(event.target.value) === 60
                              ? 60
                              : 30,
                      }))
                    }
                  >
                    {slotMinuteOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} minuti
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Intervallo sabato
                  <select
                    value={settings.saturdaySlotMinutes}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        saturdaySlotMinutes:
                          Number(event.target.value) === 15
                            ? 15
                            : Number(event.target.value) === 60
                              ? 60
                              : 30,
                      }))
                    }
                  >
                    {slotMinuteOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} minuti
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-room-cards-grid">
                <div className="admin-room-card">
                  <div className="admin-room-card-head">
                    <strong>SALA INTERNA</strong>
                    <button
                      type="button"
                      className="admin-room-visibility-btn"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          insideActive: !prev.insideActive,
                        }))
                      }
                      aria-label={
                        settings.insideActive
                          ? "Nascondi sala interna"
                          : "Mostra sala interna"
                      }
                    >
                      {settings.insideActive ? "👁" : "🚫"}
                    </button>
                  </div>
                  <label>
                    Capienza sala interna
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={insideCapacityDraft}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (!/^\d*$/.test(raw)) return;
                        setInsideCapacityDraft(raw);

                        if (raw === "") return;
                        const parsed = Number(raw);
                        if (!Number.isFinite(parsed) || parsed < 1) return;

                        const normalized = Math.min(500, Math.round(parsed));
                        setSettings((prev) => ({
                          ...prev,
                          insideCapacityPerSlot: normalized,
                        }));
                      }}
                      onBlur={() => finalizeAreaCapacityDraft("inside")}
                      disabled={!settings.insideActive}
                    />
                  </label>
                </div>

                <div className="admin-room-card">
                  <div className="admin-room-card-head">
                    <strong>SALA ESTERNA</strong>
                    <button
                      type="button"
                      className="admin-room-visibility-btn"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          outsideActive: !prev.outsideActive,
                        }))
                      }
                      aria-label={
                        settings.outsideActive
                          ? "Nascondi sala esterna"
                          : "Mostra sala esterna"
                      }
                    >
                      {settings.outsideActive ? "👁" : "🚫"}
                    </button>
                  </div>
                  <label>
                    Capienza sala esterna
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={outsideCapacityDraft}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (!/^\d*$/.test(raw)) return;
                        setOutsideCapacityDraft(raw);

                        if (raw === "") return;
                        const parsed = Number(raw);
                        if (!Number.isFinite(parsed) || parsed < 1) return;

                        const normalized = Math.min(500, Math.round(parsed));
                        setSettings((prev) => ({
                          ...prev,
                          outsideCapacityPerSlot: normalized,
                        }));
                      }}
                      onBlur={() => finalizeAreaCapacityDraft("outside")}
                      disabled={!settings.outsideActive}
                    />
                  </label>
                </div>
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
          {settingsError ? <p className="error-text">{settingsError}</p> : null}
        </section>
      )}

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
              <strong>Cliente:</strong> {selectedReservation.customerName}
            </p>
            <p>
              <strong>Telefono:</strong> {selectedReservation.phone || "-"}
            </p>
            <p>
              <strong>Data/Ora richieste:</strong> {selectedReservation.date}{" "}
              alle {selectedReservation.time}
            </p>
            <p>
              <strong>Persone:</strong> {selectedReservation.guests}
            </p>
            <p>
              <strong>Sala:</strong>{" "}
              {selectedReservation.diningArea === "outside"
                ? "Esterno"
                : "Interno"}
            </p>
            <p>
              <strong>Stato:</strong> {statusLabel(selectedReservation)}
            </p>
            <p>
              <strong>Arrivo cliente:</strong>{" "}
              {selectedReservation.arrived ? "Presente" : "Non presente"}
            </p>
            {selectedReservation.status === "proposed" &&
            selectedReservation.proposedDate &&
            selectedReservation.proposedTime ? (
              <p>
                <strong>Proposta attuale:</strong>{" "}
                {selectedReservation.proposedDate} alle{" "}
                {selectedReservation.proposedTime}
              </p>
            ) : null}
            <p>
              <strong>Note:</strong> {selectedReservation.notes || "-"}
            </p>

            {(() => {
              const isBusy = pendingCode === selectedReservation.code;
              const isConfirmedReservation =
                selectedReservation.status === "confirmed";

              return (
                <div className="booking-form" style={{ marginTop: "0.7rem" }}>
                  {!isConfirmedReservation ? (
                    <div className="two-cols admin-decision-actions">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={isBusy}
                        onClick={() =>
                          void runDecision(selectedReservation, "confirmed")
                        }
                      >
                        Conferma
                      </button>
                      <button
                        type="button"
                        className="btn-secondary admin-modal-btn admin-decision-reject"
                        disabled={isBusy}
                        onClick={() =>
                          openDecisionDialog("rejected", selectedReservation)
                        }
                      >
                        Rifiuta
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary admin-modal-btn admin-decision-reject"
                      disabled={isBusy}
                      onClick={() =>
                        openDecisionDialog("rejected", selectedReservation)
                      }
                    >
                      Annulla prenotazione
                    </button>
                  )}

                  {!isConfirmedReservation ? (
                    <button
                      type="button"
                      className="btn-secondary admin-modal-btn admin-decision-propose"
                      disabled={isBusy}
                      onClick={() =>
                        openDecisionDialog("proposed", selectedReservation)
                      }
                    >
                      Proponi nuovo orario
                    </button>
                  ) : null}

                  {!isConfirmedReservation ? (
                    <button
                      type="button"
                      className="btn-secondary admin-modal-btn admin-decision-reject"
                      disabled={isBusy}
                      onClick={() =>
                        void deleteReservation(selectedReservation.code)
                      }
                    >
                      Elimina prenotazione
                    </button>
                  ) : null}
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
                  ? selectedReservation.status === "confirmed"
                    ? "Annulla prenotazione"
                    : "Rifiuta prenotazione"
                  : "Proponi nuovo orario"}
              </h3>
            </div>

            <div className="booking-form">
              <label>
                Messaggio al cliente
                <textarea
                  value={drafts[selectedReservation.code]?.ownerResponse ?? ""}
                  rows={2}
                  maxLength={300}
                  placeholder={
                    decisionDialogMode === "proposed"
                      ? "Se lasci vuoto verra inviato un messaggio standard di proposta."
                      : selectedReservation.status === "confirmed"
                        ? "Se lasci vuoto verra inviato un messaggio standard di annullamento."
                        : "Se lasci vuoto verra inviato un messaggio standard di rifiuto."
                  }
                  onChange={(event) =>
                    onDraftChange(
                      selectedReservation.code,
                      "ownerResponse",
                      event.target.value,
                    )
                  }
                />
                <small className="admin-decision-hint">
                  Scrivi un messaggio personalizzato, oppure lascia vuoto per
                  usare automaticamente il messaggio standard
                  {selectedReservation.status === "confirmed" &&
                  decisionDialogMode === "rejected"
                    ? " di annullamento"
                    : ""}
                  .
                </small>
              </label>

              {decisionDialogMode === "proposed" ? (
                <>
                  {decisionLoading ? (
                    <p className="section-subtitle">
                      Caricamento disponibilita...
                    </p>
                  ) : null}

                  {!decisionLoading && decisionAvailability ? (
                    <>
                      <p className="booking-step-title">Data proposta</p>
                      {availableProposalDays.length > 0 ? (
                        <>
                          <div className="admin-proposal-date-nav">
                            <button
                              type="button"
                              className="admin-confirmed-day-btn"
                              disabled={currentProposalPageStart === 0}
                              onClick={() => {
                                const previousPageStart =
                                  currentProposalPageStart -
                                  proposalDatesPageSize;
                                if (previousPageStart >= 0) {
                                  setProposalDate(
                                    selectedReservation.code,
                                    availableProposalDays[previousPageStart],
                                  );
                                }
                              }}
                            >
                              ←
                            </button>
                            <strong className="admin-proposal-date-label">
                              {`${Math.min(currentProposalPageStart + 1, availableProposalDays.length)}-${Math.min(
                                currentProposalPageStart +
                                  proposalDatesPageSize,
                                availableProposalDays.length,
                              )} di ${availableProposalDays.length}`}
                            </strong>
                            <button
                              type="button"
                              className="admin-confirmed-day-btn"
                              disabled={
                                currentProposalPageStart +
                                  proposalDatesPageSize >=
                                availableProposalDays.length
                              }
                              onClick={() => {
                                const nextPageStart =
                                  currentProposalPageStart +
                                  proposalDatesPageSize;
                                if (
                                  nextPageStart < availableProposalDays.length
                                ) {
                                  setProposalDate(
                                    selectedReservation.code,
                                    availableProposalDays[nextPageStart],
                                  );
                                }
                              }}
                            >
                              →
                            </button>
                          </div>

                          <div
                            className="admin-proposal-time-grid"
                            role="group"
                          >
                            {pagedProposalDays.map((dateValue) => (
                              <button
                                key={dateValue}
                                type="button"
                                className={
                                  currentProposalDate === dateValue
                                    ? "admin-proposal-time-card active"
                                    : "admin-proposal-time-card"
                                }
                                onClick={() =>
                                  setProposalDate(
                                    selectedReservation.code,
                                    dateValue,
                                  )
                                }
                              >
                                {formatDateShort(dateValue)}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}

                      <p
                        className="booking-step-title"
                        style={{ marginTop: "0.5rem" }}
                      >
                        Orario proposto
                      </p>
                      <div className="admin-proposal-time-grid" role="group">
                        {(
                          decisionAvailability.slotsByDate[
                            currentProposalDate
                          ] ?? []
                        )
                          .filter((slot) => slot.available)
                          .map((slot) => (
                            <button
                              key={slot.time}
                              type="button"
                              className={
                                drafts[selectedReservation.code]
                                  ?.proposedTime === slot.time
                                  ? "admin-proposal-time-card active"
                                  : "admin-proposal-time-card"
                              }
                              onClick={() =>
                                onDraftChange(
                                  selectedReservation.code,
                                  "proposedTime",
                                  slot.time,
                                )
                              }
                            >
                              {slot.time}
                            </button>
                          ))}
                      </div>
                    </>
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
                  {decisionDialogMode === "rejected"
                    ? selectedReservation.status === "confirmed"
                      ? "Conferma annullamento"
                      : "Conferma rifiuto"
                    : "Invia proposta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showManualReservationModal ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-manual-reservation-modal">
            <div className="admin-modal-head">
              <h3>Aggiungi prenotazione</h3>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                onClick={() => setShowManualReservationModal(false)}
                disabled={manualReservationSaving}
              >
                Chiudi
              </button>
            </div>

            <div className="booking-form">
              <label>
                Nome e cognome
                <input
                  value={manualReservationForm.customerName}
                  onChange={(event) =>
                    setManualReservationForm((prev) => ({
                      ...prev,
                      customerName: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="two-cols">
                <label>
                  Telefono (opzionale)
                  <input
                    value={manualReservationForm.phone}
                    onChange={(event) =>
                      setManualReservationForm((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Email (opzionale)
                  <input
                    type="email"
                    value={manualReservationForm.email}
                    onChange={(event) =>
                      setManualReservationForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="two-cols">
                <label>
                  Data
                  <input
                    type="date"
                    value={manualReservationForm.date}
                    min={todayKey()}
                    max={manualReservationMaxDate}
                    onChange={(event) =>
                      setManualReservationForm((prev) => ({
                        ...prev,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Orario
                  <select
                    value={manualReservationForm.time}
                    onChange={(event) =>
                      setManualReservationForm((prev) => ({
                        ...prev,
                        time: event.target.value,
                      }))
                    }
                  >
                    {manualTimeOptions.map((timeOption) => (
                      <option key={timeOption} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="two-cols">
                <label>
                  Persone
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={manualReservationForm.guests}
                    onChange={(event) =>
                      setManualReservationForm((prev) => ({
                        ...prev,
                        guests: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Sala
                  <select
                    value={manualReservationForm.diningArea}
                    onChange={(event) =>
                      setManualReservationForm((prev) => ({
                        ...prev,
                        diningArea:
                          event.target.value === "outside"
                            ? "outside"
                            : "inside",
                      }))
                    }
                  >
                    <option value="inside" disabled={!settings.insideActive}>
                      Sala interna
                    </option>
                    <option value="outside" disabled={!settings.outsideActive}>
                      Sala esterna
                    </option>
                  </select>
                </label>
              </div>

              <label>
                Note
                <textarea
                  rows={3}
                  maxLength={300}
                  value={manualReservationForm.notes}
                  onChange={(event) =>
                    setManualReservationForm((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>

              {manualReservationError ? (
                <p className="error-text">{manualReservationError}</p>
              ) : null}

              <div className="booking-step-actions two-buttons">
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  onClick={() => setShowManualReservationModal(false)}
                  disabled={manualReservationSaving}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void submitManualReservation()}
                  disabled={manualReservationSaving}
                >
                  {manualReservationSaving ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedReservation &&
      pendingCode === selectedReservation.code &&
      activeDecisionAction ? (
        <div className="app-loader-overlay" role="status" aria-live="polite">
          <div className="app-loader-card">
            <img
              src="/assets/loader.gif"
              alt="Caricamento"
              className="app-loader-gif"
            />
            <p>{actionLoadingLabel(activeDecisionAction)}</p>
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
    </article>
  );
}
