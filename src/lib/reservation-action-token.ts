import crypto from "crypto";

// Firma dei link nelle email al cliente: accetta/rifiuta una proposta di
// orario, annulla la prenotazione. Il token lega codice, azione e scadenza.

export type ReservationAction = "accept" | "reject" | "cancel";

type CreateTokenInput = {
  code: string;
  decision: ReservationAction;
  expiresAt: number;
};

type VerifyTokenInput = {
  code: string;
  decision: ReservationAction;
  token: string;
};

const getSecret = () => {
  // Solo una chiave dedicata: niente ripieghi su altre chiavi (es. quella di
  // Resend), che finirebbero a firmare link pubblici.
  const secret = process.env.RESERVATION_ACTION_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "Secret mancante per i token prenotazione. Configura RESERVATION_ACTION_SECRET.",
    );
  }

  return secret;
};

const signPayload = (payload: string): string => {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
};

export const createReservationActionToken = ({
  code,
  decision,
  expiresAt,
}: CreateTokenInput): string => {
  const payload = `${code}|${decision}|${expiresAt}`;
  const signature = signPayload(payload);
  return `${expiresAt}.${signature}`;
};

export const verifyReservationActionToken = ({
  code,
  decision,
  token,
}: VerifyTokenInput): boolean => {
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!expiresAtRaw || !signature || !Number.isFinite(expiresAt)) {
    return false;
  }

  if (Date.now() > expiresAt) {
    return false;
  }

  const payload = `${code}|${decision}|${expiresAt}`;
  const expected = signPayload(payload);
  if (signature.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};
