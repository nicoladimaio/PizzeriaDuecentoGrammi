"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { routing, type AppLocale } from "@/i18n/routing";

// L'header vive nel layout radice, fuori dal provider di next-intl (che copre
// solo le pagine tradotte): per poche etichette basta un dizionario locale.
const navLabels: Record<AppLocale, { home: string; menu: string; book: string; nav: string }> = {
  it: {
    home: "Home",
    menu: "Menu",
    book: "Prenota un tavolo",
    nav: "Navigazione principale",
  },
  en: {
    home: "Home",
    menu: "Menu",
    book: "Book a table",
    nav: "Main navigation",
  },
  es: {
    home: "Inicio",
    menu: "Carta",
    book: "Reservar mesa",
    nav: "Navegación principal",
  },
  de: {
    home: "Start",
    menu: "Speisekarte",
    book: "Tisch reservieren",
    nav: "Hauptnavigation",
  },
};


/** Separa "/en/menu" in { locale: "en", path: "/menu" }. */
const splitLocale = (pathname: string): { locale: AppLocale; path: string } => {
  const [, first, ...rest] = pathname.split("/");
  const prefixed = routing.locales.find(
    (locale) => locale !== routing.defaultLocale && locale === first,
  );
  if (prefixed) {
    return { locale: prefixed, path: `/${rest.join("/")}` };
  }
  return { locale: routing.defaultLocale, path: pathname };
};

const withLocale = (path: string, locale: AppLocale) =>
  locale === routing.defaultLocale ? path : `/${locale}${path}`;


type SiteHeaderProps = {
  className?: string;
};

export function SiteHeader({ className }: SiteHeaderProps) {
  const pathname = usePathname();
  const { locale, path } = splitLocale(pathname);
  const labels = navLabels[locale];

  const links = [
    { href: "/", label: labels.home },
    { href: withLocale("/menu", locale), label: labels.menu },
    { href: withLocale("/prenotazioni", locale), label: labels.book },
  ];

  return (
    <header
      className={clsx("topbar", pathname === "/" && "topbar-fixed", className)}
    >
      <div className="topbar-inner">
        <Link
          href="/"
          className="brand-link"
          aria-label="Duecento Grammi - home"
        >
          <Image
            src="/assets/logo1_hq.png"
            alt="Duecento Grammi"
            width={28}
            height={44}
            quality={100}
            priority
            className="brand-logo"
          />
        </Link>

        <nav className="main-nav" aria-label={labels.nav}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx("nav-link", pathname === link.href && "active")}
              onClick={(event) => {
                if (
                  path === "/prenotazioni" &&
                  link.href === withLocale("/prenotazioni", locale)
                ) {
                  event.preventDefault();
                  window.dispatchEvent(
                    new window.CustomEvent("booking:reset-to-step-1"),
                  );
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

      </div>
    </header>
  );
}
