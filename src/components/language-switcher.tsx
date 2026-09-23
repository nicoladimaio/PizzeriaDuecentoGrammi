"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import clsx from "clsx";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

// Nome di ogni lingua scritto nella lingua stessa, come d'uso nei selettori.
const LANGUAGES: Record<AppLocale, { name: string; flag: string }> = {
  it: { name: "Italiano", flag: "/assets/flags/it.svg" },
  en: { name: "English", flag: "/assets/flags/gb.svg" },
  es: { name: "Español", flag: "/assets/flags/es.svg" },
  de: { name: "Deutsch", flag: "/assets/flags/de.svg" },
};

type LanguageSwitcherProps = {
  /** "menu": icona a globo con tendina (barra del menu); "inline": sigle IT · EN · ES · DE. */
  variant: "menu" | "inline";
};

/**
 * Cambia lingua restando sulla stessa pagina. La lingua vive nell'URL,
 * quindi vale anche per le pagine successive (menu -> prenotazioni).
 */
export function LanguageSwitcher({ variant }: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("LanguageSwitcher");

  if (variant === "inline") {
    return (
      <nav className="language-inline" aria-label={t("label")}>
        {routing.locales.map((entry) => (
          <Link
            key={entry}
            href={pathname}
            locale={entry}
            hrefLang={entry}
            lang={entry}
            title={LANGUAGES[entry].name}
            aria-current={entry === locale ? "true" : undefined}
            className={clsx("language-inline-option", entry === locale && "active")}
          >
            {entry.toUpperCase()}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    // <details>: tendina accessibile che funziona anche senza JavaScript.
    <details className="language-menu" key={pathname + locale}>
      <summary
        className="qr-icon-btn language-menu-trigger"
        aria-label={t("label")}
        title={t("label")}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z" />
        </svg>
        <span aria-hidden>{locale.toUpperCase()}</span>
      </summary>
      <div className="language-menu-list">
        {routing.locales.map((entry) => (
          <Link
            key={entry}
            href={pathname}
            locale={entry}
            hrefLang={entry}
            lang={entry}
            aria-current={entry === locale ? "true" : undefined}
            className={clsx("language-menu-option", entry === locale && "active")}
          >
            <Image src={LANGUAGES[entry].flag} alt="" width={20} height={14} />
            <span>{LANGUAGES[entry].name}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
