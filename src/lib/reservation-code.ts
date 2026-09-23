import crypto from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Codice pratica leggibile, es. "DG-7KQ2MX" (niente 0/O e 1/I per evitare confusione). */
export const buildReservationCode = (): string => {
  let value = "DG-";
  for (let i = 0; i < 6; i += 1) {
    value += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return value;
};
