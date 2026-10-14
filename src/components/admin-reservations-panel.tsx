"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { getClientAuth } from "@/lib/firebase-auth";
import type { ReservationDoc, ReservationSettings } from "@/types/reservation";
import type {
  ActionType,
  AdminReservationRow,
  ProposalDraft,
  DecisionDialogMode,
  DecisionAvailability,
  ManualReservationForm,
  ApiErrorPayload,
  SettingsLeaveGuard,
  SettingsTab,
} from "@/components/admin-reservations/types";
import {
  defaultSettings,
  parseMinutes,
  minutesToTime,
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
  startOfMonthFromKey,
  endOfMonthFromKey,
  shiftMonth,
  getOperationalDayLabel,
  buildMonthCells,
} from "@/components/admin-reservations/dates";
import { OpenReservationsGroup } from "@/components/admin-reservations/open-reservations-group";
import { ConfirmedReservationsGroup } from "@/components/admin-reservations/confirmed-reservations-group";
import { SettingsGeneralTab } from "@/components/admin-reservations/settings-general-tab";
import { SettingsAvailabilityTab } from "@/components/admin-reservations/settings-availability-tab";
import { SettingsExceptionsTab } from "@/components/admin-reservations/settings-exceptions-tab";
import { ReservationDetailModal } from "@/components/admin-reservations/reservation-detail-modal";
import { ReservationDecisionDialog } from "@/components/admin-reservations/reservation-decision-dialog";
import { ManualReservationModal } from "@/components/admin-reservations/manual-reservation-modal";
import { CopySettingsModal } from "@/components/admin-reservations/copy-settings-modal";
import { ConfirmedCalendarModal } from "@/components/admin-reservations/confirmed-calendar-modal";
import { SettingsCalendarPickerModal } from "@/components/admin-reservations/settings-calendar-picker-modal";

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
  const [rows, setRows] = useState<AdminReservationRow[]>([]);
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

  // Gli stati che dipendono da altri si sistemano durante il render (quando
  // la dipendenza cambia) invece che in un effetto: niente render doppio.

  // Prenotazione arrivata dal link dell'email: aperta subito.
  if (!selectedCode && highlightedCode) {
    setSelectedCode(highlightedCode);
  }

  const selectedReservation = useMemo(() => {
    if (!selectedCode) return null;
    return rows.find((row) => row.code === selectedCode) ?? null;
  }, [rows, selectedCode]);

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
      return [] as AdminReservationRow[];
    return confirmedRows.filter((row) => row.date === confirmedSelectedDate);
  }, [confirmedRows, confirmedSelectedDate]);

  const confirmedRowsByTime = useMemo(() => {
    const groups = new Map<string, AdminReservationRow[]>();
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

  // Orario della prenotazione manuale sempre tra quelli disponibili.
  const [prevManualTimeOptions, setPrevManualTimeOptions] = useState<
    string[] | null
  >(null);
  if (prevManualTimeOptions !== manualTimeOptions) {
    setPrevManualTimeOptions(manualTimeOptions);
    if (!manualTimeOptions.includes(manualReservationForm.time)) {
      setManualReservationForm((prev) => ({
        ...prev,
        time: manualTimeOptions[0] ?? "20:00",
      }));
    }
  }

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

  // Ferie e aperture straordinarie passate tolte dalle impostazioni.
  const [prevSpecialDates, setPrevSpecialDates] = useState<{
    holidays: string[];
    specialOpenings: string[];
  } | null>(null);
  if (
    prevSpecialDates?.holidays !== settings.holidays ||
    prevSpecialDates?.specialOpenings !== settings.specialOpenings
  ) {
    setPrevSpecialDates({
      holidays: settings.holidays,
      specialOpenings: settings.specialOpenings,
    });
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
  }

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
    row: AdminReservationRow,
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

  // All'apertura del pannello elimina le prenotazioni vecchie (silenziosa:
  // mostra solo eventuali errori del server).
  useEffect(() => {
    let ignore = false;

    const cleanupOldReservations = async () => {
      try {
        const token = await getClientAuth().currentUser?.getIdToken();
        if (!token) return;

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
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Errore inatteso.");
        }
      }
    };

    void cleanupOldReservations();
    return () => {
      ignore = true;
    };
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

  // Giorno scelto nelle confermate: ieri/oggi/domani hanno il loro pulsante,
  // gli altri giorni compaiono come data scelta nel calendario.
  const [prevConfirmedDates, setPrevConfirmedDates] = useState<{
    confirmed: string;
    calendar: string;
  } | null>(null);
  if (
    prevConfirmedDates?.confirmed !== confirmedSelectedDate ||
    prevConfirmedDates?.calendar !== calendarSelectedDate
  ) {
    const confirmedChanged =
      prevConfirmedDates?.confirmed !== confirmedSelectedDate;
    setPrevConfirmedDates({
      confirmed: confirmedSelectedDate,
      calendar: calendarSelectedDate,
    });

    const isBaseDay = [
      dateKeyDaysAgo(1),
      todayKey(),
      dateKeyDaysAhead(1),
    ].includes(confirmedSelectedDate);

    if (!confirmedSelectedDate) {
      setConfirmedSelectedDate(todayKey());
    } else if (!isBaseDay && calendarSelectedDate !== confirmedSelectedDate) {
      setCalendarSelectedDate(confirmedSelectedDate);
    }
    if (confirmedChanged && isBaseDay) {
      setCalendarSelectedDate("");
    }
  }

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

  // Fasce disattivate sempre valide per orari e intervallo impostati.
  const [prevSlotSettings, setPrevSlotSettings] = useState<string | null>(
    null,
  );
  const slotSettingsKey = `${settings.openTime}|${settings.closeTime}|${settings.slotMinutes}`;
  if (prevSlotSettings !== slotSettingsKey) {
    setPrevSlotSettings(slotSettingsKey);
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
  }

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
            <OpenReservationsGroup
              highlightedCode={highlightedCode}
              openRows={openRows}
              setSelectedCode={setSelectedCode}
              statusLabel={statusLabel}
            />
          ) : null}

          {reservationsView === "confirmed" ? (
            <ConfirmedReservationsGroup
              arrivedPendingCode={arrivedPendingCode}
              confirmedCalendarOpen={confirmedCalendarOpen}
              confirmedDayStripRef={confirmedDayStripRef}
              confirmedNavigationDays={confirmedNavigationDays}
              confirmedRowsByTime={confirmedRowsByTime}
              confirmedSelectedDate={confirmedSelectedDate}
              confirmedSelectedIndex={confirmedSelectedIndex}
              confirmedSelectedSummary={confirmedSelectedSummary}
              highlightedCurrentTimeSlot={highlightedCurrentTimeSlot}
              isConfirmedSelectedHistoricDay={isConfirmedSelectedHistoricDay}
              isConfirmedSelectedPastDay={isConfirmedSelectedPastDay}
              openConfirmedCalendarPicker={openConfirmedCalendarPicker}
              setConfirmedSelectedDate={setConfirmedSelectedDate}
              setSelectedCode={setSelectedCode}
              toggleReservationArrived={toggleReservationArrived}
            />
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
                <SettingsGeneralTab
                  setSettings={setSettings}
                  settings={settings}
                  toggleWorkingDay={toggleWorkingDay}
                />
              ) : null}

              {settingsTab === "availability" ? (
                <SettingsAvailabilityTab
                  availabilityActionsOpen={availabilityActionsOpen}
                  availabilityWeekdayStripRef={availabilityWeekdayStripRef}
                  regenerateWeeklySlotAvailability={regenerateWeeklySlotAvailability}
                  selectedAvailabilitySlots={selectedAvailabilitySlots}
                  selectedAvailabilityWeekday={selectedAvailabilityWeekday}
                  setAvailabilityActionsOpen={setAvailabilityActionsOpen}
                  setSelectedAvailabilityWeekday={setSelectedAvailabilityWeekday}
                  setShowCopyConfigModal={setShowCopyConfigModal}
                  settings={settings}
                  slotReservationCountsByWeekdayTime={slotReservationCountsByWeekdayTime}
                  toggleWeeklySlotAvailability={toggleWeeklySlotAvailability}
                />
              ) : null}

              {settingsTab === "exceptions" ? (
              <SettingsExceptionsTab
                openCalendarPicker={openCalendarPicker}
                removeHoliday={removeHoliday}
                removeSpecialOpening={removeSpecialOpening}
                settings={settings}
              />
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
        <ReservationDetailModal
          deleteReservation={deleteReservation}
          openDecisionDialog={openDecisionDialog}
          pendingCode={pendingCode}
          runDecision={runDecision}
          selectedReservation={selectedReservation}
          setSelectedCode={setSelectedCode}
          statusLabel={statusLabel}
        />
      ) : null}

      {selectedReservation && decisionDialogMode ? (
        <ReservationDecisionDialog
          availableProposalDays={availableProposalDays}
          closeDecisionDialog={closeDecisionDialog}
          currentProposalDate={currentProposalDate}
          currentProposalPageStart={currentProposalPageStart}
          decisionAvailability={decisionAvailability}
          decisionDialogMode={decisionDialogMode}
          decisionError={decisionError}
          decisionLoading={decisionLoading}
          drafts={drafts}
          onDraftChange={onDraftChange}
          pagedProposalDays={pagedProposalDays}
          pendingCode={pendingCode}
          runDecision={runDecision}
          selectedReservation={selectedReservation}
          setProposalDate={setProposalDate}
        />
      ) : null}

      {showManualReservationModal ? (
        <ManualReservationModal
          manualReservationError={manualReservationError}
          manualReservationForm={manualReservationForm}
          manualReservationMaxDate={manualReservationMaxDate}
          manualReservationSaving={manualReservationSaving}
          manualTimeOptions={manualTimeOptions}
          setManualReservationForm={setManualReservationForm}
          setShowManualReservationModal={setShowManualReservationModal}
          submitManualReservation={submitManualReservation}
        />
      ) : null}

      {showCopyConfigModal ? (
        <CopySettingsModal
          applyWeeklySlotCopy={applyWeeklySlotCopy}
          copySourceWeekday={copySourceWeekday}
          copyTargetWeekdays={copyTargetWeekdays}
          setCopySourceWeekday={setCopySourceWeekday}
          setShowCopyConfigModal={setShowCopyConfigModal}
          toggleCopyTargetWeekday={toggleCopyTargetWeekday}
        />
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
        <ConfirmedCalendarModal
          confirmedCalendarCells={confirmedCalendarCells}
          confirmedCalendarMonth={confirmedCalendarMonth}
          confirmedCalendarNextMonthDisabled={confirmedCalendarNextMonthDisabled}
          confirmedCalendarPrevMonthDisabled={confirmedCalendarPrevMonthDisabled}
          confirmedCountsByDate={confirmedCountsByDate}
          confirmedSelectedDate={confirmedSelectedDate}
          manualReservationMaxDate={manualReservationMaxDate}
          manualReservationMinHistoricDate={manualReservationMinHistoricDate}
          selectConfirmedCalendarDate={selectConfirmedCalendarDate}
          setConfirmedCalendarMonth={setConfirmedCalendarMonth}
          setConfirmedCalendarOpen={setConfirmedCalendarOpen}
        />
      ) : null}

      {calendarPickerOpen ? (
        <SettingsCalendarPickerModal
          addHolidayByDate={addHolidayByDate}
          calendarPickerMode={calendarPickerMode}
          holidayCalendarCells={holidayCalendarCells}
          holidayMonth={holidayMonth}
          isCalendarDayActive={isCalendarDayActive}
          setCalendarPickerOpen={setCalendarPickerOpen}
          setHolidayMonth={setHolidayMonth}
        />
      ) : null}
    </article>
  );
}
