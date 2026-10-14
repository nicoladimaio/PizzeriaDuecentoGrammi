import {
  Transaction,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from "firebase-admin/firestore";

// Le prenotazioni vivono in `reservations` (una per documento, con `code`).
//
// `reservation_status` (documento = codice) è una copia rimasta dalla
// versione precedente del sito: non si legge più, ma per ora si continua a
// scriverla, ricostruita dalla prenotazione, così un eventuale ritorno alla
// versione precedente trova i dati giusti. Si eliminerà con un deploy
// successivo (ROADMAP.md, punto 4, fase B).

export const RESERVATIONS = "reservations";
const LEGACY_STATUS = "reservation_status";

export type StoredReservation = {
  ref: DocumentReference;
  data: DocumentData;
};

const byCodeQuery = (db: Firestore, code: string) =>
  db.collection(RESERVATIONS).where("code", "==", code).limit(1);

/** Prenotazione con questo codice, o null. Dentro una transazione se passata. */
export const findReservationByCode = async (
  db: Firestore,
  code: string,
  transaction?: Transaction,
): Promise<StoredReservation | null> => {
  const query = byCodeQuery(db, code);
  const snapshot = transaction
    ? await transaction.get(query)
    : await query.get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { ref: doc.ref, data: doc.data() };
};

// Campi che la vecchia versione leggeva da `reservation_status`.
const LEGACY_STATUS_FIELDS = [
  "code",
  "customerName",
  "phone",
  "email",
  "date",
  "time",
  "guests",
  "status",
  "arrived",
  "ownerResponse",
  "proposedDate",
  "proposedTime",
  "privacyAcknowledged",
  "bookingTermsAccepted",
  "privacyPolicyVersion",
  "bookingTermsVersion",
  "legalAcceptedAt",
  "cancelledAt",
  "updatedAt",
  "updatedAtServer",
];

const buildLegacyStatusDoc = (reservationId: string, data: DocumentData) => {
  const doc: DocumentData = { reservationId };
  for (const field of LEGACY_STATUS_FIELDS) {
    if (data[field] !== undefined) doc[field] = data[field];
  }
  return doc;
};

/**
 * Riscrive la copia di compatibilità a partire dalla prenotazione completa
 * (dati già aggiornati). Va chiamata insieme alla scrittura della prenotazione,
 * nella stessa transazione o batch.
 */
export const writeLegacyStatusCopy = (
  db: Firestore,
  writer: Transaction | WriteBatch,
  reservationId: string,
  data: DocumentData,
) => {
  if (typeof data.code !== "string" || !data.code) return;
  const ref = db.collection(LEGACY_STATUS).doc(data.code);
  const doc = buildLegacyStatusDoc(reservationId, data);
  // Stessa chiamata, ma TypeScript non unisce le firme di set() dei due tipi.
  if (writer instanceof Transaction) writer.set(ref, doc);
  else writer.set(ref, doc);
};

/** Elimina la copia di compatibilità (insieme alla prenotazione). */
export const deleteLegacyStatusCopy = (
  db: Firestore,
  writer: Transaction | WriteBatch,
  code: unknown,
) => {
  if (typeof code !== "string" || !code) return;
  writer.delete(db.collection(LEGACY_STATUS).doc(code));
};
