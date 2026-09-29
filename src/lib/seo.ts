import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://pizzeriaduecentogrammi.it";

export const LOGO_URL = `${SITE_URL}/assets/Centro.png`;
/** Anteprima per WhatsApp, Facebook, Google: 1200×630 (foto di una pizza + logo). */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/og-image.jpg`;
/** Link alle prenotazioni nell'area riservata (email al proprietario). */
export const ADMIN_RESERVATIONS_URL = `${SITE_URL}/riservato/dashboard?tab=reservations`;

type PageSeoInput = {
  description: string;
  path: string;
  title: string;
  /**
   * Per le pagine tradotte: lingua corrente. Aggiunge gli hreflang verso
   * tutte le versioni (italiano senza prefisso, le altre con /<lingua>).
   */
  locale?: string;
  locales?: readonly string[];
};

const OG_LOCALES: Record<string, string> = {
  it: "it_IT",
  en: "en_GB",
  es: "es_ES",
  de: "de_DE",
};

const localizedUrl = (path: string, locale: string) =>
  locale === "it" ? `${SITE_URL}${path}` : `${SITE_URL}/${locale}${path}`;

export const buildPageMetadata = ({
  description,
  path,
  title,
  locale = "it",
  locales,
}: PageSeoInput): Metadata => {
  const canonicalUrl = localizedUrl(path, locale);
  const languages = locales
    ? {
        ...Object.fromEntries(
          locales.map((entry) => [entry, localizedUrl(path, entry)]),
        ),
        "x-default": localizedUrl(path, "it"),
      }
    : undefined;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: canonicalUrl,
      languages,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "Duecento Grammi",
      locale: OG_LOCALES[locale] ?? "it_IT",
      type: "website",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: "Duecento Grammi - Pizzeria Gourmet a Marcianise",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
};
