// Scrive su Firestore le traduzioni di una lingua (campo i18n.<lingua>).
//
// Uso: npm run menu:i18n:import -- <lingua> <file.json> [--dry]
// Formato file:
//   { "items": { "<id>": { "nome", "descrizione", "ingredienti" } },
//     "cats":  { "<id>": "<nome categoria>" } }
//
// Controlli prima di scrivere: campi vuoti in italiano restano vuoti,
// stesso numero di ingredienti. Con errori non scrive nulla.
import fs from "node:fs";
import {
  CONTENT_LOCALES,
  hashCategorySource,
  hashMenuItemSource,
  readCategorySource,
  readMenuItemSource,
} from "../src/lib/menu-translations.ts";
import { getDb } from "./menu-i18n-lib.mjs";

const [locale, file] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const dryRun = process.argv.includes("--dry");
if (!CONTENT_LOCALES.includes(locale) || !file) {
  console.error(`Uso: menu:i18n:import -- <${CONTENT_LOCALES.join("|")}> <file.json> [--dry]`);
  process.exit(1);
}

const translations = JSON.parse(fs.readFileSync(file, "utf8"));
const countIngredients = (value) =>
  value ? value.split(",").map((entry) => entry.trim()).filter(Boolean).length : 0;

const db = getDb();
const now = new Date().toISOString();
const problems = [];
const writes = [];

for (const doc of (await db.collection("menu_items").get()).docs) {
  const translation = translations.items?.[doc.id];
  if (!translation) continue;
  const source = readMenuItemSource(doc.data());
  const label = source.nome || doc.id;
  if (!translation.nome?.trim()) problems.push(`${label}: nome vuoto`);
  for (const field of ["descrizione", "ingredienti"]) {
    if (Boolean(source[field]) !== Boolean(translation[field]?.trim())) {
      problems.push(`${label}: campo ${field} vuoto/pieno diverso dall'italiano`);
    }
  }
  if (countIngredients(source.ingredienti) !== countIngredients(translation.ingredienti)) {
    problems.push(
      `${label}: ${countIngredients(source.ingredienti)} ingredienti in italiano, ${countIngredients(translation.ingredienti)} tradotti`,
    );
  }
  writes.push({
    ref: doc.ref,
    data: {
      [`i18n.${locale}`]: {
        nome: translation.nome.trim(),
        descrizione: (translation.descrizione ?? "").trim(),
        ingredienti: (translation.ingredienti ?? "").trim(),
        status: "auto",
        sourceHash: hashMenuItemSource(source),
        updatedAt: now,
      },
    },
  });
}

for (const doc of (await db.collection("menu_categories").get()).docs) {
  const translation = translations.cats?.[doc.id];
  if (!translation) continue;
  writes.push({
    ref: doc.ref,
    data: {
      [`i18n.${locale}`]: {
        nome: translation.trim(),
        status: "auto",
        sourceHash: hashCategorySource(readCategorySource(doc.data())),
        updatedAt: now,
      },
    },
  });
}

const unknownIds = [
  ...Object.keys(translations.items ?? {}),
  ...Object.keys(translations.cats ?? {}),
].filter((id) => !writes.some((write) => write.ref.id === id));
for (const id of unknownIds) problems.push(`id non trovato su Firestore: ${id}`);

console.log(`${locale}: ${writes.length} voci da scrivere, ${problems.length} problemi`);
for (const problem of problems) console.log(` - ${problem}`);
if (problems.length > 0) process.exit(1);
if (dryRun) process.exit(0);

for (let start = 0; start < writes.length; start += 200) {
  const batch = db.batch();
  for (const write of writes.slice(start, start + 200)) batch.update(write.ref, write.data);
  await batch.commit();
}
console.log("Scritto.");
process.exit(0);
