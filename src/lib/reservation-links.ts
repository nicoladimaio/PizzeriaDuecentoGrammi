import type { AppLocale } from "@/i18n/routing";
import {
  createReservationActionToken,
  type ReservationAction,
} from "@/lib/reservation-action-token";
import { SITE_URL } from "@/lib/seo";

// Link firmati inseriti nelle email al cliente. `lang` serve solo a mostrare
// la pagina di risposta nella lingua giusta: non fa parte della firma.

const PROPOSAL_LINK_TTL_MS = 48 * 60 * 60 * 1000;

const buildActionUrl = (
  code: string,
  path: "proposal-response" | "cancel",
  decision: ReservationAction,
  expiresAt: number,
  locale: AppLocale,
) => {
  const params = new URLSearchParams({
    token: createReservationActionToken({ code, decision, expiresAt }),
    lang: locale,
  });
  if (path === "proposal-response") params.set("decision", decision);
  return `${SITE_URL}/api/reservations/${encodeURIComponent(code)}/${path}?${params}`;
};

/** Link "accetta" e "rifiuta" per una proposta di orario (validi 48 ore). */
export const buildProposalResponseUrls = (code: string, locale: AppLocale) => {
  const expiresAt = Date.now() + PROPOSAL_LINK_TTL_MS;
  return {
    acceptUrl: buildActionUrl(code, "proposal-response", "accept", expiresAt, locale),
    rejectUrl: buildActionUrl(code, "proposal-response", "reject", expiresAt, locale),
  };
};

/** Link "annulla prenotazione", valido fino al giorno dopo la prenotazione. */
export const buildCancelUrl = (
  code: string,
  dateKey: string,
  locale: AppLocale,
) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const expiresAt = Date.UTC(year, month - 1, day + 1, 23, 59);
  return buildActionUrl(code, "cancel", "cancel", expiresAt, locale);
};
