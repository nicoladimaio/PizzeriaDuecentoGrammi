// Esporta i piatti e le categorie da tradurre (traduzione mancante o superata
// perche l'italiano e cambiato), per ogni lingua dei contenuti.
//
// Uso: npm run menu:i18n:export [-- <file.json>] [--all]
//   --all  esporta tutto, anche cio che e gia tradotto
import fs from "node:fs";
import {
  CONTENT_LOCALES,
  getFreshCategoryTranslation,
  getFreshMenuItemTranslation,
  readCategorySource,
  readMenuItemSource,
} from "../src/lib/menu-translations.ts";
import { getDb } from "./menu-i18n-lib.mjs";

const args = process.argv.slice(2);
const exportAll = args.includes("--all");
const outFile = args.find((arg) => !arg.startsWith("--")) ?? "menu-i18n-todo.json";

const db = getDb();
const [itemsSnap, categoriesSnap] = await Promise.all([
  db.collection("menu_items").get(),
  db.collection("menu_categories").get(),
]);

const result = {};
for (const locale of CONTENT_LOCALES) {
  const items = {};
  for (const doc of itemsSnap.docs) {
    const raw = doc.data();
    const source = readMenuItemSource(raw);
    if (!source.nome) continue;
    if (exportAll || !getFreshMenuItemTranslation(raw, locale)) {
      items[doc.id] = { categoria: String(raw.categoria ?? raw.Categoria ?? ""), ...source };
    }
  }
  const cats = {};
  for (const doc of categoriesSnap.docs) {
    const raw = doc.data();
    const source = readCategorySource(raw);
    if (!source.nome) continue;
    if (exportAll || !getFreshCategoryTranslation(raw, locale)) {
      cats[doc.id] = source.nome;
    }
  }
  result[locale] = { items, cats };
  console.log(
    `${locale}: ${Object.keys(items).length} piatti, ${Object.keys(cats).length} categorie da tradurre`,
  );
}

fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`Scritto ${outFile}`);
process.exit(0);
