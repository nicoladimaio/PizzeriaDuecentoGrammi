import type { MetadataRoute } from "next";
import { LOCALIZED_PATHS, routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";

const localizedUrl = (path: string, locale: string) =>
  locale === routing.defaultLocale
    ? `${SITE_URL}${path}`
    : `${SITE_URL}/${locale}${path}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const localizedEntries: MetadataRoute.Sitemap = LOCALIZED_PATHS.flatMap(
    (path) =>
      routing.locales.map((locale) => ({
        url: localizedUrl(path, locale),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: locale === routing.defaultLocale ? 0.9 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((entry) => [entry, localizedUrl(path, entry)]),
          ),
        },
      })),
  );

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...localizedEntries,
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/termini-prenotazione`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
