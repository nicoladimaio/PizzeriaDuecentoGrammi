import { unstable_cache } from "next/cache";
import { tolerateBuildErrors } from "@/lib/build-safe";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  CLOSING_AFTER_LAST_BOOKING_MINUTES,
  formatMinutes,
  type OpeningHours,
} from "@/lib/opening-hours";
import { resolveReservationSettings } from "@/lib/reservation-availability";
import { addDaysToDateKey, getRomeNow } from "@/lib/rome-time";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";

// Orari del locale (dalle impostazioni prenotazioni del pannello) e dati del
// ristorante per Google. In cache come il menu: si aggiornano subito quando
// si salvano le impostazioni dal pannello, e comunque ogni 10 minuti.

export const SETTINGS_CACHE_TAG = "reservation-settings";

const getCachedOpeningHours = unstable_cache(
  async (): Promise<OpeningHours> => {
    const settings = await resolveReservationSettings(getAdminDb());
    const lastBookableMinutes =
      settings.openMinutes +
      Math.floor(
        (settings.closeMinutes - settings.openMinutes) / settings.slotMinutes,
      ) *
        settings.slotMinutes;

    return {
      workingDays: [...settings.workingDays],
      openMinutes: settings.openMinutes,
      closeMinutes: lastBookableMinutes + CLOSING_AFTER_LAST_BOOKING_MINUTES,
      holidays: [...settings.holidays].sort(),
      specialOpenings: [...settings.specialOpenings].sort(),
    };
  },
  ["opening-hours"],
  { tags: [SETTINGS_CACHE_TAG], revalidate: 600 },
);

export const getOpeningHours = () =>
  tolerateBuildErrors(getCachedOpeningHours, "orari");

const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Dati strutturati schema.org del ristorante (per Google Search e Maps). */
export const buildRestaurantJsonLd = (hours: OpeningHours | null) => {
  const todayKey = getRomeNow().dateKey;
  const horizon = addDaysToDateKey(todayKey, 60);
  const opens = hours ? formatMinutes(hours.openMinutes) : null;
  const closes = hours ? formatMinutes(hours.closeMinutes) : null;

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "Duecento Grammi",
    url: SITE_URL,
    image: DEFAULT_OG_IMAGE,
    logo: `${SITE_URL}/assets/Centro.png`,
    telephone: "+39 0823 833221",
    email: "info@pizzeriaduecentogrammi.it",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Viale Europa 30",
      postalCode: "81025",
      addressLocality: "Marcianise",
      addressRegion: "CE",
      addressCountry: "IT",
    },
    hasMap: "https://maps.google.com/?q=Viale+Europa+30+Marcianise",
    servesCuisine: ["Pizza", "Cucina italiana", "Pizzeria gourmet"],
    priceRange: "EUR 20-40",
    hasMenu: `${SITE_URL}/menu`,
    acceptsReservations: `${SITE_URL}/prenotazioni`,
    sameAs: [
      "https://www.instagram.com/duecento_grammi/",
      "https://www.facebook.com/duecentogrammipizzeria/",
    ],
    ...(hours && opens && closes
      ? {
          openingHoursSpecification: [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: hours.workingDays.map(
                (day) => `https://schema.org/${SCHEMA_DAYS[day]}`,
              ),
              opens,
              closes,
            },
          ],
          // Ferie e aperture straordinarie dei prossimi due mesi.
          specialOpeningHoursSpecification: [
            ...hours.holidays
              .filter((date) => date >= todayKey && date <= horizon)
              .map((date) => ({
                "@type": "OpeningHoursSpecification",
                validFrom: date,
                validThrough: date,
                opens: "00:00",
                closes: "00:00",
              })),
            ...hours.specialOpenings
              .filter((date) => date >= todayKey && date <= horizon)
              .map((date) => ({
                "@type": "OpeningHoursSpecification",
                validFrom: date,
                validThrough: date,
                opens,
                closes,
              })),
          ],
        }
      : {}),
  };
};
