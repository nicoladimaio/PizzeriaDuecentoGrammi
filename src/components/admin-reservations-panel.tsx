"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { getClientAuth } from "@/lib/firebase-auth";
import type { ReservationDoc, ReservationSettings } from "@/types/reservation";
import type {
  ActionType,
  ProposalDraft,
  DecisionDialogMode,
  DecisionAvailability,
  ManualReservationForm,
  ApiErrorPayload,
  SettingsLeaveGuard,
  SettingsTab,
} from "@/components/admin-reservations/types";
import {
  slotMinuteOptions,
  weekdayOptions,
  defaultSettings,
  parseMinutes,
  minutesToTime,
  halfHourTimeOptions,
  normalizeSettings,
  getSlotTimesForWeekday,
  getSlotMinutesForDateKey,
  buildSettingsSnapshot,
} from "@/components/admin-reservations/settings";
import {
  proposalDatesPageSize,
  TOTAL_SEATS_FALLBACK,
  HISTORY_RETENTION_DAYS,
  actionLoadingLabel,
  mapSnapshot,
  parseJsonResponse,
} from "@/components/admin-reservations/helpers";
import {
  todayKey,
  dateKeyDaysAgo,
  dateKeyDaysAhead,
  monthKey,
  parseDateKey,
  monthLabel,
  startOfMonthFromKey,
  endOfMonthFromKey,
  shiftMonth,
  formatDateShort,
  getOperationalDayLabel,
  buildMonthCells,
} from "@/components/admin-reservations/dates";

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
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] =
    useState<ReservationSettings>(defaultSettings);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [calendarPickerMode, setCalendarPickerMode] = useState<
    "holiday" | "opening"
  >("holiday");
  const [holidayMonth, setHolidayMonth] = useState(monthKey(new Date()));
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [selectedAvailabilityWeekday, setSelectedAvailabilityWeekday] = useState(
    new Date().getDay(),
  );
  const [availabilityActionsOpen, setAvailabilityActionsOpen] = useState(false);
  const [showCopyConfigModal, setShowCopyConfigModal] = useState(false);
  const [copySourceWeekday, setCopySourceWeekday] = useState(new Date().getDay());
  const [copyTargetWeekdays, setCopyTargetWeekdays] = useState<number[]>([]);
  const settingsTabsRef = useRef<HTMLDivElement | null>(null);
  const availabilityWeekdayStripRef = useRef<HTMLDivElement | null>(null);
  const confirmedDayStripRef = useRef<HTMLDivElement | null>(null);
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
      date: todayKey(),
      time: "20:00",
      guests: "2",
      notes: "",
    });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState("");
  const [confirmedCalendarOpen, setConfirmedCalendarOpen] = useState(false);
  const [confirmedCalendarMonth, setConfirmedCalendarMonth] = useState(
    monthKey(new Date()),
  );

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
        (row) =>
          row.date >= dateKeyDaysAgo(HISTORY_RETENTION_DAYS) &&
          row.status === "confirmed",
      ),
    [orderedRows],
  );

  const holidayCalendarCells = useMemo(
    () => buildMonthCells(holidayMonth),
    [holidayMonth],
  );

  const confirmedCalendarCells = useMemo(
    () => buildMonthCells(confirmedCalendarMonth),
    [confirmedCalendarMonth],
  );

  const confirmedCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    confirmedRows.forEach((row) => {
      counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
    });
    return counts;
  }, [confirmedRows]);

  const slotReservationCountsByWeekdayTime = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      if (
        row.date < todayKey() ||
        (row.status !== "pending" &&
          row.status !== "confirmed" &&
          row.status !== "proposed")
      ) {
        return;
      }

      const weekday = parseDateKey(row.date).getDay();
      const key = `${weekday}|${row.time}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [rows]);

  const selectedAvailabilitySlots = useMemo(
    () => getSlotTimesForWeekday(selectedAvailabilityWeekday, settings),
    [selectedAvailabilityWeekday, settings],
  );

  const confirmedNavigationDays = useMemo(() => {
    const baseDays = [
      dateKeyDaysAgo(1),
      todayKey(),
      dateKeyDaysAhead(1),
    ].map((date) => ({
      date,
      label: getOperationalDayLabel(date),
      reservationsCount: confirmedCountsByDate.get(date) ?? 0,
    }));

    if (
      calendarSelectedDate &&
      !baseDays.some((day) => day.date === calendarSelectedDate)
    ) {
      return [
        ...baseDays,
        {
          date: calendarSelectedDate,
          label: getOperationalDayLabel(calendarSelectedDate),
          reservationsCount: confirmedCountsByDate.get(calendarSelectedDate) ?? 0,
        },
      ];
    }

    return baseDays;
  }, [calendarSelectedDate, confirmedCountsByDate]);

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
      settings.capacityPerSlot,
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
      confirmedNavigationDays.findIndex(
        (day) => day.date === confirmedSelectedDate,
      ),
    [confirmedNavigationDays, confirmedSelectedDate],
  );

  const manualReservationMaxDate = useMemo(
    () => dateKeyDaysAhead(30),
    [],
  );
  const manualReservationMinHistoricDate = useMemo(
    () => dateKeyDaysAgo(HISTORY_RETENTION_DAYS),
    [],
  );
  const isConfirmedSelectedPastDay = Boolean(
    confirmedSelectedDate && confirmedSelectedDate < todayKey(),
  );
  const isConfirmedSelectedHistoricDay = Boolean(
    confirmedSelectedDate &&
    confirmedSelectedDate >= manualReservationMinHistoricDate &&
    confirmedSelectedDate < todayKey(),
  );
  const confirmedCalendarPrevMonthDisabled = useMemo(() => {
    const previousMonthEnd = endOfMonthFromKey(
      shiftMonth(confirmedCalendarMonth, -1),
    );
    return previousMonthEnd < parseDateKey(manualReservationMinHistoricDate);
  }, [confirmedCalendarMonth, manualReservationMinHistoricDate]);
  const confirmedCalendarNextMonthDisabled = useMemo(() => {
    const nextMonthStart = startOfMonthFromKey(
      shiftMonth(confirmedCalendarMonth, 1),
    );
    return nextMonthStart > parseDateKey(manualReservationMaxDate);
  }, [confirmedCalendarMonth, manualReservationMaxDate]);

  const highlightedCurrentTimeSlot = useMemo(() => {
    const selectedDate = confirmedSelectedDate || todayKey();
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
    confirmedRowsByTime,
    confirmedSelectedDate,
    currentTime,
    settings,
  ]);

  const currentSettingsSnapshot = useMemo(
    () => buildSettingsSnapshot(settings),
    [settings],
  );

  const savedSettingsSnapshot = useMemo(
    () => buildSettingsSnapshot(savedSettings),
    [savedSettings],
  );

  const hasUnsavedSettingsChanges = Boolean(
    settingsOnly &&
    !settingsLoading &&
    currentSettingsSnapshot !== savedSettingsSnapshot,
  );

  const manualTimeOptions = useMemo(() => {
    const open = parseMinutes(settings.openTime);
    const close = parseMinutes(settings.closeTime);
    const slotMinutes = settings.slotMinutes;

    if (!Number.isFinite(open) || !Number.isFinite(close) || close < open) {
      return ["20:00"];
    }

    const slots: string[] = [];
    for (let minute = open; minute <= close; minute += slotMinutes) {
      slots.push(minutesToTime(minute));
    }

    return slots.length > 0 ? slots : ["20:00"];
  }, [
    settings.closeTime,
    settings.openTime,
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
      const response = await fetch(
        `/api/reservations/availability?guests=${guests}`,
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

      // Se il proprietario non scrive nulla il cliente riceve solo il testo
      // standard dell'email, già tradotto nella sua lingua.
      const ownerResponse = draft.ownerResponse.trim();

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
    setSettingsSaving(true);

    try {
      const auth = getClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Sessione admin non valida.");
      }

      const payloadToSave = settings;

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
      setSettingsToast("Impostazioni prenotazioni salvate.");
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
    setSettingsError(null);
    setSettingsToast("Modifiche annullate.");
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

  const toggleWeeklySlotAvailability = (weekday: number, time: string) => {
    setSettings((prev) => {
      const key = String(weekday);
      const disabledSlots = prev.weeklyDisabledSlots[key] ?? [];
      const nextDisabledSlots = disabledSlots.includes(time)
        ? disabledSlots.filter((entry) => entry !== time)
        : [...disabledSlots, time].sort();

      return {
        ...prev,
        weeklyDisabledSlots: {
          ...prev.weeklyDisabledSlots,
          [key]: nextDisabledSlots,
        },
      };
    });
  };

  const toggleCopyTargetWeekday = (weekday: number) => {
    setCopyTargetWeekdays((prev) =>
      prev.includes(weekday)
        ? prev.filter((value) => value !== weekday)
        : [...prev, weekday].sort((a, b) => a - b),
    );
  };

  const applyWeeklySlotCopy = () => {
    if (copyTargetWeekdays.length === 0) return;

    const sourceSlots = [
      ...(settings.weeklyDisabledSlots[String(copySourceWeekday)] ?? []),
    ];

    setSettings((prev) => ({
      ...prev,
      weeklyDisabledSlots: {
        ...prev.weeklyDisabledSlots,
        ...Object.fromEntries(
          copyTargetWeekdays.map((weekday) => [String(weekday), [...sourceSlots]]),
        ),
      },
    }));
    setCopyTargetWeekdays([]);
    setShowCopyConfigModal(false);
    setSettingsToast("Configurazione slot duplicata.");
    setSettingsError(null);
  };

  const regenerateWeeklySlotAvailability = () => {
    const confirmed = window.confirm(
      "Questa operazione ricreera gli slot utilizzando le impostazioni generali. Le disponibilita personalizzate verranno sovrascritte. Le prenotazioni gia esistenti NON verranno modificate.",
    );

    if (!confirmed) return;

    setSettings((prev) => ({
      ...prev,
      weeklyDisabledSlots: {},
    }));
    setSettingsToast("Configurazione slot ripristinata.");
    setSettingsError(null);
    setAvailabilityActionsOpen(false);
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
      if (manualReservationForm.date < todayKey()) {
        throw new Error("Non puoi aggiungere prenotazioni in un giorno passato.");
      }

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
    if (!confirmedSelectedDate) {
      setConfirmedSelectedDate(todayKey());
      return;
    }

    const isBaseDay = [
      dateKeyDaysAgo(1),
      todayKey(),
      dateKeyDaysAhead(1),
    ].includes(confirmedSelectedDate);

    if (!isBaseDay && calendarSelectedDate !== confirmedSelectedDate) {
      setCalendarSelectedDate(confirmedSelectedDate);
    }
  }, [calendarSelectedDate, confirmedSelectedDate]);

  useEffect(() => {
    if (
      confirmedSelectedDate === dateKeyDaysAgo(1) ||
      confirmedSelectedDate === todayKey() ||
      confirmedSelectedDate === dateKeyDaysAhead(1)
    ) {
      setCalendarSelectedDate("");
    }
  }, [confirmedSelectedDate]);

  useEffect(() => {
    if (!settingsToast) return;

    const timer = window.setTimeout(() => {
      setSettingsToast(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [settingsToast]);

  useEffect(() => {
    const container = settingsTabsRef.current;
    if (!container) return;

    const activeTab = container.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!activeTab) return;

    const frame = window.requestAnimationFrame(() => {
      activeTab.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [settingsTab]);

  useEffect(() => {
    if (settingsTab !== "availability") return;

    const container = availabilityWeekdayStripRef.current;
    if (!container) return;

    const activeDay = container.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (!activeDay) return;

    let frame = 0;
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => {
        activeDay.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      });
    }, 40);

    return () => {
      window.clearTimeout(timer);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [selectedAvailabilityWeekday, settingsTab]);

  useEffect(() => {
    const container = confirmedDayStripRef.current;
    if (!container) return;

    const activeDay = container.querySelector<HTMLButtonElement>(
      ".admin-confirmed-day-pill.active",
    );
    if (!activeDay) return;

    const frame = window.requestAnimationFrame(() => {
      activeDay.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [confirmedSelectedDate]);

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
    if (row.status === "cancelled") return "Annullata dal cliente";
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

  useEffect(() => {
    setSettings((prev) => {
      const normalizedDisabledSlots = Object.fromEntries(
        Object.entries(prev.weeklyDisabledSlots).map(([weekday, values]) => {
          const validSlots = new Set(
            getSlotTimesForWeekday(Number(weekday), prev),
          );
          return [
            weekday,
            values.filter((value) => validSlots.has(value)),
          ];
        }),
      );

      const sameSnapshot =
        JSON.stringify(normalizedDisabledSlots) ===
        JSON.stringify(prev.weeklyDisabledSlots);

      if (sameSnapshot) {
        return prev;
      }

      return {
        ...prev,
        weeklyDisabledSlots: normalizedDisabledSlots,
      };
    });
  }, [settings.openTime, settings.closeTime, settings.slotMinutes]);

  const openConfirmedCalendarPicker = () => {
    const targetDate =
      confirmedSelectedDate ||
      calendarSelectedDate ||
      todayKey();
    setConfirmedCalendarMonth(monthKey(parseDateKey(targetDate)));
    setConfirmedCalendarOpen(true);
  };

  const selectConfirmedCalendarDate = (dateKey: string) => {
    setError(null);
    setCalendarSelectedDate(dateKey);
    setConfirmedSelectedDate(dateKey);
    setConfirmedCalendarOpen(false);
  };

  const handleOpenManualReservationModal = () => {
    if (reservationsView === "confirmed" && isConfirmedSelectedPastDay) {
      setError("Non puoi aggiungere prenotazioni in un giorno passato.");
      return;
    }

    setError(null);
    resetManualReservationForm();
    setShowManualReservationModal(true);
  };

  if (!settingsOnly && (loading || settingsLoading)) {
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
                        const previousDay = confirmedNavigationDays[idx - 1];
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
                        confirmedSelectedDate || todayKey(),
                      ).toLocaleDateString("it-IT", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </strong>
                    {isConfirmedSelectedHistoricDay ? (
                      <span className="admin-confirmed-day-meta-chip">
                        Storico
                      </span>
                    ) : null}
                    <small className="admin-confirmed-day-summary">
                      {`👥 ${confirmedSelectedSummary.guestsCount} coperti · 🍕 ${confirmedSelectedSummary.reservationsCount} ${
                        confirmedSelectedSummary.reservationsCount === 1
                          ? "prenotazione"
                          : "prenotazioni"
                      }`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="admin-confirmed-day-btn"
                    disabled={
                      confirmedSelectedIndex >=
                      confirmedNavigationDays.length - 1
                    }
                    onClick={() => {
                      const idx = confirmedSelectedIndex;
                      if (idx >= 0 && idx < confirmedNavigationDays.length - 1) {
                        const nextDay = confirmedNavigationDays[idx + 1];
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
                    ref={confirmedDayStripRef}
                    className="admin-confirmed-day-strip"
                    role="toolbar"
                    aria-label="Navigazione giorni prenotazioni confermate"
                  >
                    {confirmedNavigationDays.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        aria-pressed={confirmedSelectedDate === day.date}
                        className={
                          confirmedSelectedDate === day.date
                            ? "admin-confirmed-day-pill active"
                            : "admin-confirmed-day-pill"
                        }
                        onClick={() => {
                          setConfirmedSelectedDate(day.date);
                        }}
                      >
                        <span className="admin-confirmed-day-pill-label">
                          {day.label}
                        </span>
                        {day.reservationsCount > 0 ? (
                          <span className="admin-confirmed-day-pill-badge">
                            {day.reservationsCount}
                          </span>
                        ) : null}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="admin-confirmed-day-pill admin-confirmed-day-pill-calendar"
                      onClick={openConfirmedCalendarPicker}
                      aria-label="Apri calendario"
                      aria-pressed={confirmedCalendarOpen}
                    >
                      <span className="admin-confirmed-day-pill-icon" aria-hidden>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3.5" y="5" width="17" height="15" rx="3" />
                          <path d="M7.5 3.5v3" />
                          <path d="M16.5 3.5v3" />
                          <path d="M3.5 9.5h17" />
                        </svg>
                      </span>
                      <span className="admin-confirmed-day-pill-label">
                        Calendario
                      </span>
                    </button>
                  </div>
                </div>

                {confirmedRowsByTime.length === 0 ? (
                  <div className="admin-confirmed-empty-state">
                    <span className="admin-confirmed-empty-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="5" width="16" height="15" rx="3" />
                        <path d="M8 3.5v3" />
                        <path d="M16 3.5v3" />
                        <path d="M4 9.5h16" />
                        <path d="M8.5 13h7" />
                      </svg>
                    </span>
                    <strong>
                      {isConfirmedSelectedPastDay
                        ? "Nessuna prenotazione registrata in questo giorno."
                        : "Nessuna prenotazione per questo giorno"}
                    </strong>
                    <p>
                      {isConfirmedSelectedPastDay
                        ? "Questo giorno e disponibile solo per consultazione."
                        : "Puoi aggiungerne una manualmente con il pulsante +."}
                    </p>
                  </div>
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
                                  {row.guests} persone
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
            <div className="admin-settings-head-copy">
              <h3>Impostazioni Prenotazioni</h3>
              <p className="admin-settings-head-note">
                Apertura, chiusura e intervallo standard vengono usati per
                generare automaticamente gli slot orari disponibili.
              </p>
            </div>
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
              <div
                ref={settingsTabsRef}
                className="admin-settings-tabs"
                role="tablist"
                aria-label="Impostazioni prenotazioni"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === "general"}
                  className={
                    settingsTab === "general"
                      ? "admin-settings-tab active"
                      : "admin-settings-tab"
                  }
                  onClick={() => setSettingsTab("general")}
                >
                  Generale
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === "availability"}
                  className={
                    settingsTab === "availability"
                      ? "admin-settings-tab active"
                      : "admin-settings-tab"
                  }
                  onClick={() => setSettingsTab("availability")}
                >
                  Disponibilita orarie
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === "exceptions"}
                  className={
                    settingsTab === "exceptions"
                      ? "admin-settings-tab active"
                      : "admin-settings-tab"
                  }
                  onClick={() => setSettingsTab("exceptions")}
                >
                  Date speciali
                </button>
              </div>

              {settingsTab === "general" ? (
                <div className="admin-settings-tab-panel">
              <div className="admin-settings-row admin-settings-row-3">
                <div className="admin-settings-time-inline">
                  <label>
                    Orario apertura
                    <select
                      value={settings.openTime}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          openTime: event.target.value,
                        }))
                      }
                    >
                      {halfHourTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Orario chiusura
                    <select
                      value={settings.closeTime}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          closeTime: event.target.value,
                        }))
                      }
                    >
                      {halfHourTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                    <label className="admin-settings-interval-field">
                      Intervallo standard
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
                    {slotMinuteOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} minuti
                      </option>
                    ))}
                  </select>
                </label>
                    <div />
              </div>

              <div>
                <label>
                  Capienza per fascia oraria
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={settings.capacityPerSlot}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (!Number.isFinite(parsed) || parsed < 1) return;
                      const normalized = Math.min(500, Math.round(parsed));
                      setSettings((prev) => ({
                        ...prev,
                        capacityPerSlot: normalized,
                      }));
                    }}
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
                </div>
              ) : null}

              {settingsTab === "availability" ? (
                <div className="admin-settings-tab-panel">
                  <div className="admin-settings-info-card admin-settings-info-card-with-actions">
                    <div>
                      <strong>Disponibilita settimanale</strong>
                      <p>
                        <span className="admin-settings-copy-desktop">
                          Scegli gli orari disponibili per ciascun giorno della
                          settimana. Gli slot disattivati non saranno piu
                          prenotabili dai clienti. Le prenotazioni gia
                          esistenti resteranno valide.
                        </span>
                        <span className="admin-settings-copy-mobile">
                          Attiva o disattiva gli orari prenotabili.
                        </span>
                      </p>
                    </div>
                    <div className="admin-settings-actions-menu-wrap">
                      <button
                        type="button"
                        className="btn-secondary admin-modal-btn"
                        onClick={() =>
                          setAvailabilityActionsOpen((prev) => !prev)
                        }
                        aria-expanded={availabilityActionsOpen}
                      >
                        Azioni
                      </button>
                      {availabilityActionsOpen ? (
                        <div className="admin-settings-actions-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setAvailabilityActionsOpen(false);
                              setShowCopyConfigModal(true);
                            }}
                          >
                            Duplica configurazione
                          </button>
                          <button
                            type="button"
                            onClick={regenerateWeeklySlotAvailability}
                          >
                            Rigenera slot
                          </button>
                          <button
                            type="button"
                            onClick={regenerateWeeklySlotAvailability}
                          >
                            Ripristina configurazione standard
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    ref={availabilityWeekdayStripRef}
                    className="admin-settings-weekday-strip"
                    role="tablist"
                    aria-label="Giorni disponibilita orarie"
                  >
                    {weekdayOptions.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        role="tab"
                        aria-selected={selectedAvailabilityWeekday === day.key}
                        className={
                          selectedAvailabilityWeekday === day.key
                            ? "admin-settings-weekday-tab active"
                            : "admin-settings-weekday-tab"
                        }
                        onClick={() => setSelectedAvailabilityWeekday(day.key)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  <div className="admin-settings-slot-grid">
                    {selectedAvailabilitySlots.map((slotTime) => {
                      const isEnabled = !(
                        settings.weeklyDisabledSlots[String(selectedAvailabilityWeekday)] ?? []
                      ).includes(slotTime);
                      const hasExistingReservations =
                        (slotReservationCountsByWeekdayTime.get(
                          `${selectedAvailabilityWeekday}|${slotTime}`,
                        ) ?? 0) > 0;

                      return (
                        <button
                          key={slotTime}
                          type="button"
                          className={
                            isEnabled
                              ? "admin-settings-slot-chip active"
                              : "admin-settings-slot-chip"
                          }
                          onClick={() =>
                            toggleWeeklySlotAvailability(
                              selectedAvailabilityWeekday,
                              slotTime,
                            )
                          }
                        >
                          <span>{slotTime}</span>
                          {!isEnabled && hasExistingReservations ? (
                            <small>Gia prenotato</small>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <p className="admin-settings-note">
                    Le prenotazioni gia esistenti restano valide anche se
                    disattivi uno slot. La modifica blocca solo nuove
                    prenotazioni.
                  </p>
                </div>
              ) : null}

              {settingsTab === "exceptions" ? (
              <div className="admin-settings-tab-panel">
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

                {settings.holidays.length === 0 &&
                settings.specialOpenings.length === 0 ? (
                  <p className="admin-settings-empty-note">
                    Nessuna data speciale configurata.
                  </p>
                ) : null}
              </div>
              ) : null}

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

          {settingsError ? <p className="error-text">{settingsError}</p> : null}
        </section>
      )}

      {settingsToast ? (
        <div className="admin-settings-toast" role="status" aria-live="polite">
          {settingsToast}
        </div>
      ) : null}

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
                      ? "Se lasci vuoto verrà inviato un messaggio standard di proposta."
                      : selectedReservation.status === "confirmed"
                        ? "Se lasci vuoto verrà inviato un messaggio standard di annullamento."
                        : "Se lasci vuoto verrà inviato un messaggio standard di rifiuto."
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
                  , che arriva nella lingua del cliente. Il messaggio
                  personalizzato viene inviato così come lo scrivi.
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

      {showCopyConfigModal ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-settings-modal">
            <div className="admin-modal-head">
              <h3>Duplica configurazione</h3>
              <button
                type="button"
                className="btn-secondary admin-modal-btn"
                onClick={() => setShowCopyConfigModal(false)}
              >
                Annulla
              </button>
            </div>

            <div className="booking-form">
              <label>
                Giorno sorgente
                <select
                  value={copySourceWeekday}
                  onChange={(event) =>
                    setCopySourceWeekday(Number(event.target.value))
                  }
                >
                  {weekdayOptions.map((day) => (
                    <option key={day.key} value={day.key}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="booking-step-title">Giorni di destinazione</p>
                <div className="admin-inline-chips">
                  {weekdayOptions
                    .filter((day) => day.key !== copySourceWeekday)
                    .map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        className={
                          copyTargetWeekdays.includes(day.key)
                            ? "booking-chip active"
                            : "booking-chip"
                        }
                        onClick={() => toggleCopyTargetWeekday(day.key)}
                      >
                        {day.label}
                      </button>
                    ))}
                </div>
              </div>

              <div className="booking-step-actions two-buttons">
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  onClick={() => setShowCopyConfigModal(false)}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={applyWeeklySlotCopy}
                  disabled={copyTargetWeekdays.length === 0}
                >
                  Duplica
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!settingsOnly ? (
        <button
          type="button"
          className="admin-reservation-fab"
          onClick={handleOpenManualReservationModal}
          aria-label="Aggiungi prenotazione manuale"
          title="Aggiungi prenotazione"
        >
          +
        </button>
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

      {confirmedCalendarOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal admin-calendar-modal admin-confirmed-calendar-modal">
            <div className="admin-modal-head">
              <h3>Seleziona un giorno</h3>
              <button
                type="button"
                className="btn-secondary admin-modal-btn admin-confirmed-calendar-close"
                onClick={() => setConfirmedCalendarOpen(false)}
              >
                Chiudi
              </button>
            </div>

            <div className="admin-holiday-calendar admin-confirmed-calendar">
              <div className="admin-holiday-calendar-head">
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  disabled={confirmedCalendarPrevMonthDisabled}
                  onClick={() =>
                    setConfirmedCalendarMonth((prev) => shiftMonth(prev, -1))
                  }
                >
                  ←
                </button>
                <strong>{monthLabel(confirmedCalendarMonth)}</strong>
                <button
                  type="button"
                  className="btn-secondary admin-modal-btn"
                  disabled={confirmedCalendarNextMonthDisabled}
                  onClick={() =>
                    setConfirmedCalendarMonth((prev) => shiftMonth(prev, 1))
                  }
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
                {confirmedCalendarCells.map((cell, index) => {
                  if (cell.kind === "empty") {
                    return (
                      <span
                        key={`confirmed-empty-${index}`}
                        className="admin-holiday-empty"
                      />
                    );
                  }

                  const isDisabled =
                    cell.dateKey < manualReservationMinHistoricDate ||
                    cell.dateKey > manualReservationMaxDate;
                  const isActive = confirmedSelectedDate === cell.dateKey;
                  const isPast = cell.dateKey < todayKey();
                  const reservationsCount =
                    confirmedCountsByDate.get(cell.dateKey) ?? 0;

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      className={
                        isActive
                          ? "admin-holiday-day admin-confirmed-calendar-day active"
                          : isPast
                            ? "admin-holiday-day admin-confirmed-calendar-day past"
                            : "admin-holiday-day admin-confirmed-calendar-day"
                      }
                      disabled={isDisabled}
                      onClick={() => selectConfirmedCalendarDate(cell.dateKey)}
                    >
                      <span>{cell.day}</span>
                      <span className="admin-confirmed-calendar-day-meta">
                        {reservationsCount > 0 ? (
                          <small>{reservationsCount}</small>
                        ) : (
                          <small>&nbsp;</small>
                        )}
                        {reservationsCount > 0 ? (
                          <span
                            className="admin-confirmed-calendar-dot"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="admin-confirmed-calendar-legend">
                Gli ultimi 14 giorni sono disponibili come storico.
              </p>
            </div>
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
