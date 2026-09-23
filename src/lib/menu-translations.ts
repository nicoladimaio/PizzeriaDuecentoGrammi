// Traduzioni dei contenuti del menu (piatti e categorie) salvate su Firestore.
//
// Ogni documento di `menu_items` / `menu_categories` puo avere un campo:
//   i18n: { <lingua>: { nome, descrizione?, ingredienti?, status, sourceHash, updatedAt } }
//
// - status "auto": tradotto automaticamente, da rivedere;
//   status "reviewed": controllato da una persona dal pannello admin.
// - sourceHash: impronta del testo italiano da cui e nata la traduzione. Se
//   l'italiano cambia (es. nuovi ingredienti) la traduzione e "superata": il
//   menu pubblico mostra l'italiano finche non viene ritradotta, per non
//   rischiare ingredienti sbagliati nella traduzione.

export const CONTENT_LOCALES = ["en", "es", "de"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

export type TranslationStatus = "auto" | "reviewed";

export type MenuItemSource = {
  nome: string;
  descrizione: string;
  ingredienti: string;
};

export type MenuItemTranslation = MenuItemSource & {
  status: TranslationStatus;
  sourceHash: string;
  updatedAt?: string;
};

export type CategorySource = { nome: string };

export type CategoryTranslation = CategorySource & {
  status: TranslationStatus;
  sourceHash: string;
  updatedAt?: string;
};

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

// FNV-1a 32 bit: basta a capire se il testo e cambiato, gira uguale
// nel browser e sul server.
const fnv1a = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const hashMenuItemSource = (source: MenuItemSource): string =>
  fnv1a([source.nome, source.descrizione, source.ingredienti].join("\u0000"));

export const hashCategorySource = (source: CategorySource): string =>
  fnv1a(source.nome);

/** Legge i campi italiani da un documento `menu_items` (nomi campo storici inclusi). */
export const readMenuItemSource = (raw: Record<string, unknown>): MenuItemSource => ({
  nome: asText(raw.nome ?? raw.Nome),
  descrizione: asText(raw.descrizione ?? raw.Descrizione),
  ingredienti: asText(raw.ingredienti ?? raw.Ingredienti),
});

export const readCategorySource = (raw: Record<string, unknown>): CategorySource => ({
  nome: asText(raw.nome ?? raw.name),
});

const readI18nEntry = (
  raw: Record<string, unknown>,
  locale: string,
): Record<string, unknown> | null => {
  const i18n = raw.i18n;
  if (!i18n || typeof i18n !== "object") return null;
  const entry = (i18n as Record<string, unknown>)[locale];
  return entry && typeof entry === "object"
    ? (entry as Record<string, unknown>)
    : null;
};

const readStatus = (value: unknown): TranslationStatus =>
  value === "reviewed" ? "reviewed" : "auto";

export const readMenuItemTranslation = (
  raw: Record<string, unknown>,
  locale: string,
): MenuItemTranslation | null => {
  const entry = readI18nEntry(raw, locale);
  if (!entry) return null;
  const nome = asText(entry.nome);
  if (!nome) return null;
  return {
    nome,
    descrizione: asText(entry.descrizione),
    ingredienti: asText(entry.ingredienti),
    status: readStatus(entry.status),
    sourceHash: asText(entry.sourceHash),
    updatedAt: asText(entry.updatedAt) || undefined,
  };
};

export const readCategoryTranslation = (
  raw: Record<string, unknown>,
  locale: string,
): CategoryTranslation | null => {
  const entry = readI18nEntry(raw, locale);
  if (!entry) return null;
  const nome = asText(entry.nome);
  if (!nome) return null;
  return {
    nome,
    status: readStatus(entry.status),
    sourceHash: asText(entry.sourceHash),
    updatedAt: asText(entry.updatedAt) || undefined,
  };
};

/** Traduzione valida per il testo italiano attuale, oppure null. */
export const getFreshMenuItemTranslation = (
  raw: Record<string, unknown>,
  locale: string,
): MenuItemTranslation | null => {
  const translation = readMenuItemTranslation(raw, locale);
  if (!translation) return null;
  return translation.sourceHash === hashMenuItemSource(readMenuItemSource(raw))
    ? translation
    : null;
};

export const getFreshCategoryTranslation = (
  raw: Record<string, unknown>,
  locale: string,
): CategoryTranslation | null => {
  const translation = readCategoryTranslation(raw, locale);
  if (!translation) return null;
  return translation.sourceHash === hashCategorySource(readCategorySource(raw))
    ? translation
    : null;
};
