// Il server (Netlify/Vercel) gira in UTC: tutte le date "di calendario" della
// pizzeria vanno calcolate sull'ora italiana, altrimenti tra mezzanotte e le
// 2 di notte "oggi" risulta ancora ieri e gli orari del giorno sono sfasati.
const TIME_ZONE = "Europe/Rome";

const romeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data (YYYY-MM-DD) e minuti dalla mezzanotte, secondo l'ora italiana. */
export const getRomeNow = (now: Date = new Date()) => {
  const parts = Object.fromEntries(
    romeFormatter.formatToParts(now).map((part) => [part.type, part.value]),
  );

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const dateKeyToUtcNoon = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

/** Somma giorni a una data YYYY-MM-DD senza dipendere dal fuso del server. */
export const addDaysToDateKey = (dateKey: string, amount: number): string => {
  const date = dateKeyToUtcNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

/** Giorno della settimana (0 = domenica) di una data YYYY-MM-DD. */
export const getWeekdayOfDateKey = (dateKey: string): number =>
  dateKeyToUtcNoon(dateKey).getUTCDay();
