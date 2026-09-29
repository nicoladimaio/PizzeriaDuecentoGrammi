import type { getAdminDb } from "@/lib/firebase-admin";
import { addDaysToDateKey, getWeekdayOfDateKey } from "@/lib/rome-time";

// Regole di disponibilità condivise da /api/reservations/availability (cosa
// mostrare nel calendario) e da POST /api/reservations (cosa accettare davvero).

type AdminDb = ReturnType<typeof getAdminDb>;
type RomeNow = { dateKey: string; minutes: number };

/** Giorni prenotabili a partire da oggi (incluso). */
export const MAX_BOOKING_DAYS = 31;
export const ACTIVE_RESERVATION_STATUSES = new Set([
  "pending",
  "confirmed",
  "proposed",
]);

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const getServiceEndMinutes = (openTime: string, closeTime: string): number | null => {
  const open = parseMinutes(openTime);
  const close = parseMinutes(closeTime);

  if (open === close) {
    return null;
  }

  return close > open ? close : close + 24 * 60;
};

const parseSlotMinutes = (value: unknown): number | null => {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 5 &&
    value <= 180
    ? value
    : null;
};

const minutesToTime = (value: number): string => {
  const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const getEnvSlotSettings = () => {
  const openTime = process.env.RESERVATION_OPEN_TIME ?? "19:00";
  const closeTime = process.env.RESERVATION_CLOSE_TIME ?? "23:00";
  const slotMinutes = Number(process.env.RESERVATION_SLOT_MINUTES ?? 30);
  const capacityPerSlot = Number(
    process.env.RESERVATION_CAPACITY_PER_SLOT ?? 40,
  );

  const openMinutes = parseMinutes(openTime);
  const closeMinutes = getServiceEndMinutes(openTime, closeTime) ?? parseMinutes(closeTime);

  const safeSlot =
    Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30;
  const safeCapacity =
    Number.isFinite(capacityPerSlot) && capacityPerSlot > 0
      ? capacityPerSlot
      : 40;

  return {
    openTime,
    closeTime,
    slotMinutes: safeSlot,
    capacityPerSlot: safeCapacity,
    openMinutes,
    closeMinutes,
  };
};

const asDateKey = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  if (!DATE_KEY_REGEX.test(value)) return null;
  return value;
};

const uniqueWeekdays = (source: unknown): number[] => {
  if (!Array.isArray(source)) return [1, 2, 3, 4, 5, 6, 0];
  const values = source
    .filter((value): value is number => Number.isInteger(value))
    .filter((value) => value >= 0 && value <= 6);
  return [...new Set(values)];
};

const isValidTimeValue = (value: unknown): value is string =>
  typeof value === "string" && TIME_REGEX.test(value);

/** Impostazioni del servizio (area riservata), con i valori d'ambiente come riserva. */
export const resolveReservationSettings = async (db: AdminDb) => {
  const envSettings = getEnvSlotSettings();
  const defaultWorkingDays = [1, 2, 3, 4, 5, 6, 0];

  try {
    const settingsSnap = await db
      .collection("reservation_settings")
      .doc("default")
      .get();
    const data = settingsSnap.data() as
      | {
          openTime?: unknown;
          closeTime?: unknown;
          slotMinutes?: unknown;
          capacityPerSlot?: unknown;
          workingDays?: unknown;
          holidays?: unknown;
          specialOpenings?: unknown;
          weeklyDisabledSlots?: unknown;
        }
      | undefined;

    const openTime = isValidTimeValue(data?.openTime)
      ? data.openTime
      : envSettings.openTime;

    const closeTime = isValidTimeValue(data?.closeTime)
      ? data.closeTime
      : envSettings.closeTime;

    const slotMinutes =
      parseSlotMinutes(data?.slotMinutes) ??
      parseSlotMinutes(envSettings.slotMinutes) ??
      30;

    const capacityPerSlot =
      typeof data?.capacityPerSlot === "number" &&
      Number.isFinite(data.capacityPerSlot) &&
      data.capacityPerSlot > 0
        ? Math.round(data.capacityPerSlot)
        : envSettings.capacityPerSlot;

    const workingDays = uniqueWeekdays(data?.workingDays);
    const holidays = Array.isArray(data?.holidays)
      ? data.holidays
          .map(asDateKey)
          .filter((value): value is string => Boolean(value))
      : [];
    const specialOpenings = Array.isArray(data?.specialOpenings)
      ? data.specialOpenings
          .map(asDateKey)
          .filter((value): value is string => Boolean(value))
      : [];
    const weeklyDisabledSlots: Record<string, string[]> =
      data?.weeklyDisabledSlots &&
      typeof data.weeklyDisabledSlots === "object" &&
      !Array.isArray(data.weeklyDisabledSlots)
        ? Object.fromEntries(
            Object.entries(data.weeklyDisabledSlots).map(([weekday, values]) => [
              weekday,
              Array.isArray(values)
                ? values.filter(isValidTimeValue)
                : [],
            ]),
          )
        : {};

    return {
      ...envSettings,
      openTime,
      closeTime,
      slotMinutes,
      capacityPerSlot,
      openMinutes: parseMinutes(openTime),
      closeMinutes:
        getServiceEndMinutes(openTime, closeTime) ?? parseMinutes(closeTime),
      workingDays: workingDays.length > 0 ? workingDays : defaultWorkingDays,
      holidays: new Set(holidays),
      specialOpenings: new Set(specialOpenings),
      weeklyDisabledSlots,
    };
  } catch {
    const fallbackSlotMinutes = parseSlotMinutes(envSettings.slotMinutes) ?? 30;
    return {
      ...envSettings,
      slotMinutes: fallbackSlotMinutes,
      capacityPerSlot: envSettings.capacityPerSlot,
      workingDays: defaultWorkingDays,
      holidays: new Set<string>(),
      specialOpenings: new Set<string>(),
      weeklyDisabledSlots: {} as Record<string, string[]>,
    };
  }
};

export type ReservationSettings = Awaited<
  ReturnType<typeof resolveReservationSettings>
>;

/** Posti occupati dalle prenotazioni ancora attive tra quelle indicate. */
export const countReservedSeats = (
  docs: Array<{ data: () => { guests?: unknown; status?: unknown } }>,
): number =>
  docs.reduce((sum, doc) => {
    const { guests, status } = doc.data();
    if (typeof status !== "string" || !ACTIVE_RESERVATION_STATUSES.has(status)) {
      return sum;
    }
    return sum + (typeof guests === "number" ? guests : 0);
  }, 0);

/** Orari di inizio delle fasce del servizio (es. 19:00, 19:30, ...). */
export const getSlotTimes = (settings: ReservationSettings): string[] => {
  const slotTimes: string[] = [];
  for (
    let minute = settings.openMinutes;
    minute <= settings.closeMinutes;
    minute += settings.slotMinutes
  ) {
    slotTimes.push(minutesToTime(minute));
  }
  return slotTimes;
};

/** Il giorno di oggi non si prenota più online dopo l'apertura. */
export const isSameDayClosed = (
  settings: ReservationSettings,
  romeNow: RomeNow,
): boolean => romeNow.minutes >= settings.openMinutes;

/** Giorno chiuso: giorno di riposo, ferie o oggi dopo l'apertura. */
export const isDayClosed = (
  date: string,
  settings: ReservationSettings,
  romeNow: RomeNow,
): boolean => {
  const isClosedByRules =
    !settings.workingDays.includes(getWeekdayOfDateKey(date)) ||
    settings.holidays.has(date);
  const isClosedBySameDayCutoff =
    date === romeNow.dateKey && isSameDayClosed(settings, romeNow);

  return (
    (isClosedByRules && !settings.specialOpenings.has(date)) ||
    isClosedBySameDayCutoff
  );
};

/** Fascia disattivata dall'area riservata per quel giorno della settimana. */
export const isSlotDisabled = (
  date: string,
  time: string,
  settings: ReservationSettings,
): boolean =>
  (settings.weeklyDisabledSlots[String(getWeekdayOfDateKey(date))] ?? []).includes(
    time,
  );

/**
 * Controlla che data e ora siano prenotabili online (senza guardare i posti
 * liberi, che vanno contati a parte). `null` se va tutto bene.
 */
export const getSlotRejectionReason = (
  date: string,
  time: string,
  settings: ReservationSettings,
  romeNow: RomeNow,
): "out_of_range" | "closed" | "invalid_time" | null => {
  const lastBookableDate = addDaysToDateKey(romeNow.dateKey, MAX_BOOKING_DAYS - 1);
  if (date < romeNow.dateKey || date > lastBookableDate) return "out_of_range";
  if (isDayClosed(date, settings, romeNow)) return "closed";
  if (!getSlotTimes(settings).includes(time)) return "invalid_time";
  if (isSlotDisabled(date, time, settings)) return "closed";
  return null;
};
