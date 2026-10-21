export const PRIVACY_POLICY_VERSION = "2026-10-14";
export const BOOKING_TERMS_VERSION = "2026-10-21";

// Versioni precedenti ancora accettate dal server: chi aveva il modulo di
// prenotazione aperto durante un deploy non viene rifiutato.
export const ACCEPTED_PRIVACY_POLICY_VERSIONS = [
  PRIVACY_POLICY_VERSION,
  "2026-06-13",
] as const;

export const ACCEPTED_BOOKING_TERMS_VERSIONS = [
  BOOKING_TERMS_VERSION,
  "2026-06-13",
] as const;

export const PRIVACY_POLICY_PATH = "/privacy";
export const BOOKING_TERMS_PATH = "/termini-prenotazione";
