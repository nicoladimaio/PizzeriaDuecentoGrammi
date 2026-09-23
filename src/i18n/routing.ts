import { defineRouting } from "next-intl/routing";

// L'italiano resta sugli URL di sempre (/menu, /prenotazioni), le altre lingue
// hanno il prefisso (/en/menu). Niente rilevamento automatico dalla lingua del
// browser: si cambia solo col selettore, cosi i link e i QR restano prevedibili.
export const routing = defineRouting({
  locales: ["it", "en", "es", "de"],
  defaultLocale: "it",
  localePrefix: "as-needed",
  localeDetection: false,
  // Con la lingua sempre nell'URL il cookie non serve (e non va dichiarato).
  localeCookie: false,
});

export type AppLocale = (typeof routing.locales)[number];

/** Pagine tradotte: solo queste passano dal proxy di next-intl. */
export const LOCALIZED_PATHS = ["/menu", "/prenotazioni"] as const;
