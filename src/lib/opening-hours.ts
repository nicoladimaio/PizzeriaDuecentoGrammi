import { addDaysToDateKey, getWeekdayOfDateKey } from "@/lib/rome-time";

// Orari del locale ricavati dalle impostazioni prenotazioni del pannello, così
// footer della home e dati per Google seguono giorni di chiusura e ferie.
// Funzioni pure: le usa il server (home) e il browser (stato "aperti ora").

export type OpeningHours = {
  /** Giorni della settimana aperti (0 = domenica). */
  workingDays: number[];
  /** Minuti dalla mezzanotte. */
  openMinutes: number;
  /** Può superare 24*60 se si chiude dopo mezzanotte. */
  closeMinutes: number;
  holidays: string[];
  specialOpenings: string[];
};

/** Il locale chiude un'ora dopo l'ultimo orario prenotabile. */
export const CLOSING_AFTER_LAST_BOOKING_MINUTES = 60;

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const DAY_LONG = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
/** Da lunedì a domenica, l'ordine in cui si leggono gli orari. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const formatMinutes = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  return `${hours}:${String(normalized % 60).padStart(2, "0")}`;
};

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** [2,3,4,5,6,0] → "Mar - Dom"; giorni non consecutivi → "Lun, Mer - Dom". */
export const describeWorkingDays = (workingDays: number[]): string => {
  const open = WEEK_ORDER.filter((day) => workingDays.includes(day));
  if (open.length === 0) return "";

  const ranges: number[][] = [];
  for (const day of open) {
    const last = ranges.at(-1);
    const previous = last?.at(-1);
    if (
      last &&
      previous !== undefined &&
      WEEK_ORDER.indexOf(day) === WEEK_ORDER.indexOf(previous) + 1
    ) {
      last.push(day);
    } else {
      ranges.push([day]);
    }
  }

  return ranges
    .map((range) =>
      range.length === 1
        ? DAY_SHORT[range[0]]
        : `${DAY_SHORT[range[0]]} - ${DAY_SHORT[range.at(-1) as number]}`,
    )
    .join(", ");
};

/** [1] → "Lunedì chiuso"; [1,2] → "Lunedì e martedì chiusi". */
export const describeClosedDays = (workingDays: number[]): string => {
  const closed = WEEK_ORDER.filter((day) => !workingDays.includes(day)).map(
    (day) => DAY_LONG[day],
  );
  if (closed.length === 0) return "";
  if (closed.length === 1) return `${capitalize(closed[0])} chiuso`;
  const list = `${closed.slice(0, -1).join(", ")} e ${closed.at(-1)}`;
  return `${capitalize(list)} chiusi`;
};

const dayAndMonth = (dateKey: string) => {
  const [, month, day] = dateKey.split("-").map(Number);
  return { day, month: MONTHS[month - 1] };
};

/** Davanti a 1, 8 e 11 si elide: "l'8", "dall'11" (ma "il 3", "dal 3"). */
const elides = (day: number) => day === 1 || day === 8 || day === 11;
const theDay = (day: number) => (elides(day) ? `l'${day}` : `il ${day}`);
const fromDay = (day: number) =>
  elides(day) ? `dall'${day}` : `dal ${day}`;

/** Raggruppa date consecutive: ["2026-08-11", "2026-08-12"] → [[inizio, fine]]. */
const toRanges = (dateKeys: string[]): Array<[string, string]> => {
  const sorted = [...new Set(dateKeys)].sort();
  const ranges: Array<[string, string]> = [];
  for (const date of sorted) {
    const last = ranges.at(-1);
    if (last && addDaysToDateKey(last[1], 1) === date) {
      last[1] = date;
    } else {
      ranges.push([date, date]);
    }
  }
  return ranges;
};

const describeRange = ([start, end]: [string, string]) => {
  const from = dayAndMonth(start);
  const to = dayAndMonth(end);
  if (start === end) return `${theDay(from.day)} ${from.month}`;
  if (from.month === to.month) {
    return `${fromDay(from.day)} al ${to.day} ${to.month}`;
  }
  return `${fromDay(from.day)} ${from.month} al ${to.day} ${to.month}`;
};

/**
 * Avvisi per le prossime settimane: ferie/chiusure e aperture straordinarie
 * che iniziano entro `withinDays` giorni (o sono già in corso).
 */
export const describeUpcomingExceptions = (
  hours: OpeningHours,
  todayKey: string,
  withinDays = 14,
): string[] => {
  const horizon = addDaysToDateKey(todayKey, withinDays);
  const relevant = ([start, end]: [string, string]) =>
    end >= todayKey && start <= horizon;

  const closures = toRanges(hours.holidays)
    .filter(relevant)
    .map((range) => `Chiusi ${describeRange(range)}`);
  const openings = toRanges(
    hours.specialOpenings.filter(
      (date) => !hours.workingDays.includes(getWeekdayOfDateKey(date)),
    ),
  )
    .filter(relevant)
    .map((range) => `Aperti straordinariamente ${describeRange(range)}`);

  return [...closures, ...openings];
};

/** Il locale apre in questa data? (giorno lavorativo non in ferie, o apertura straordinaria) */
export const isOpenOn = (hours: OpeningHours, dateKey: string): boolean =>
  hours.specialOpenings.includes(dateKey) ||
  (hours.workingDays.includes(getWeekdayOfDateKey(dateKey)) &&
    !hours.holidays.includes(dateKey));

/** Stato del momento, per la riga sopra gli orari (ora italiana). */
export const getOpeningStatus = (
  hours: OpeningHours,
  now: { dateKey: string; minutes: number },
): { kind: "open" | "opens-later" | "closed-today"; text: string } | null => {
  // Dopo mezzanotte si è ancora nel servizio della sera prima.
  const yesterday = addDaysToDateKey(now.dateKey, -1);
  if (
    hours.closeMinutes > 1440 &&
    now.minutes < hours.closeMinutes - 1440 &&
    isOpenOn(hours, yesterday)
  ) {
    return { kind: "open", text: "Aperti ora" };
  }

  if (!isOpenOn(hours, now.dateKey)) {
    return { kind: "closed-today", text: "Oggi siamo chiusi" };
  }
  if (now.minutes < hours.openMinutes) {
    return {
      kind: "opens-later",
      text: `Aperti stasera dalle ${formatMinutes(hours.openMinutes)}`,
    };
  }
  if (now.minutes < hours.closeMinutes) {
    return { kind: "open", text: "Aperti ora" };
  }
  return null;
};
