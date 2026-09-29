import { createTranslator } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import de from "../../messages/de.json";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import it from "../../messages/it.json";

// Testi delle email e delle pagine di risposta per il cliente, nella lingua in
// cui ha prenotato (campo `locale` della prenotazione, "it" se manca).

const MESSAGES: Record<AppLocale, typeof it> = { it, en, es, de };

export const PIZZERIA_PHONE = "0823 833221";

export const toAppLocale = (value: unknown): AppLocale =>
  typeof value === "string" &&
  (routing.locales as readonly string[]).includes(value)
    ? (value as AppLocale)
    : routing.defaultLocale;

export const getReservationTranslator = (locale: AppLocale) =>
  createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "Reservation",
  });

const INTL_LOCALES: Record<AppLocale, string> = {
  it: "it-IT",
  en: "en-GB",
  es: "es-ES",
  de: "de-DE",
};

/** "2026-10-03" → "sabato 3 ottobre 2026" (nella lingua indicata). */
export const formatDateKey = (dateKey: string, locale: AppLocale): string => {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

/** "sabato 3 ottobre 2026 alle 20:30" */
export const formatWhen = (
  dateKey: string,
  time: string,
  locale: AppLocale,
): string =>
  getReservationTranslator(locale)("dateAtTime", {
    date: formatDateKey(dateKey, locale),
    time,
  });
