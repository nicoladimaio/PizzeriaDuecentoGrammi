// Confronta le collezioni `reservations` e `reservation_status` prima di
// unificarle: segnala copie mancanti, orfane o con dati diversi. Sola lettura.
// Non stampa dati personali (nomi, telefoni, email): solo codici e campi.
//
// Uso: node scripts/check-reservation-collections.mjs
import { getDb } from "./menu-i18n-lib.mjs";

const SHARED_FIELDS = [
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
];
const PERSONAL_FIELDS = new Set(["customerName", "phone", "email", "ownerResponse"]);

// "" / undefined / null valgono uguale; arrived assente = false.
const normalize = (field, value) => {
  if (field === "arrived") return value === true;
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : value;
};

const db = getDb();
const [reservationsSnap, statusSnap] = await Promise.all([
  db.collection("reservations").get(),
  db.collection("reservation_status").get(),
]);

console.log(`reservations: ${reservationsSnap.size} documenti`);
console.log(`reservation_status: ${statusSnap.size} documenti\n`);

const reservationsById = new Map();
const reservationsByCode = new Map();
const withoutCode = [];
const duplicateCodes = new Set();

for (const doc of reservationsSnap.docs) {
  const data = doc.data();
  reservationsById.set(doc.id, data);
  if (!data.code) {
    withoutCode.push(doc.id);
    continue;
  }
  if (reservationsByCode.has(data.code)) duplicateCodes.add(data.code);
  reservationsByCode.set(data.code, { id: doc.id, data });
}

const orphanStatus = [];
const wrongReservationId = [];
const differences = [];
const statusCodes = new Set();

for (const doc of statusSnap.docs) {
  const status = doc.data();
  const code = doc.id;
  statusCodes.add(code);

  const byCode = reservationsByCode.get(code);
  if (!byCode) {
    orphanStatus.push(`${code} (stato ${status.status ?? "?"}, ${status.date ?? "?"} ${status.time ?? ""})`);
    continue;
  }
  if (status.reservationId && status.reservationId !== byCode.id) {
    wrongReservationId.push(code);
  }

  const diffs = SHARED_FIELDS.filter(
    (field) => normalize(field, status[field]) !== normalize(field, byCode.data[field]),
  ).map((field) =>
    PERSONAL_FIELDS.has(field)
      ? `${field} diverso`
      : `${field}: prenotazione=${JSON.stringify(byCode.data[field] ?? null)} stato=${JSON.stringify(status[field] ?? null)}`,
  );
  if (diffs.length) differences.push(`${code} (${byCode.data.date ?? "?"}): ${diffs.join("; ")}`);
}

const missingStatus = [...reservationsByCode.keys()]
  .filter((code) => !statusCodes.has(code))
  .map((code) => {
    const { data } = reservationsByCode.get(code);
    return `${code} (stato ${data.status ?? "?"}, ${data.date ?? "?"}${data.createdManually ? ", manuale" : ""})`;
  });

const report = (title, list) => {
  console.log(`${title}: ${list.length}`);
  for (const entry of list) console.log(`  - ${entry}`);
};

report("Prenotazioni senza codice", withoutCode);
report("Codici duplicati in reservations", [...duplicateCodes]);
report("Prenotazioni senza copia in reservation_status", missingStatus);
report("Copie in reservation_status senza prenotazione", orphanStatus);
report("Copie con reservationId sbagliato", wrongReservationId);
report("Copie con dati diversi", differences);
process.exit(0);
