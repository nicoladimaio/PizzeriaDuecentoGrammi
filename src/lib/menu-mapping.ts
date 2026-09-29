// Conversione dei documenti Firestore del menu nei dati mostrati al pubblico.
// Funzioni pure (niente Firebase qui): le usa il server in lib/public-menu.ts.
import {
  categoryAnchorId,
  extractSpiceLevelFromRaw,
  inferSpiceFromText,
  normalizeCategoryKey,
  normalizeImage,
  normalizeImageFit,
  normalizeText,
  parseOrder,
  parsePrice,
  parseStringArray,
  parseVisible,
  splitIngredients,
  unique,
} from "@/lib/menu-parsing";
import {
  getFreshCategoryTranslation,
  getFreshMenuItemTranslation,
} from "@/lib/menu-translations";
import type { MenuAllergen, MenuCategory, MenuProduct } from "@/types/menu-app";

type RawMenuItemDoc = Record<string, unknown> & {
  Nome?: string;
  nome?: string;
  Prezzo?: number | string;
  prezzo?: number | string;
  Ingredienti?: string;
  ingredienti?: string;
  Descrizione?: string;
  descrizione?: string;
  Categoria?: string;
  categoria?: string;
  Immagine?: string;
  immagine?: string;
  immagineThumb?: string;
  ImmagineThumb?: string;
  imageThumb?: string;
  thumbnail?: string;
  imageFit?: unknown;
  allergeni?: unknown;
  allergens?: unknown;
  extras?: unknown;
  extra?: unknown;
  note?: unknown;
  tags?: unknown;
  specialita?: boolean;
  special?: boolean;
  hot?: boolean;
  richiesto?: boolean;
  new?: boolean;
  novita?: boolean;
  visible?: boolean;
  visibile?: boolean;
  ordine?: number;
  order?: number;
};

type RawCategoryDoc = Record<string, unknown> & {
  name?: string;
  nome?: string;
  ordine?: number;
  order?: number;
  visible?: boolean;
  visibile?: boolean;
};

type RawIngredientDoc = {
  allergeni?: unknown;
  allergens?: unknown;
};

export type RawDoc = { id: string; data: Record<string, unknown> };

export type RawMenuDocs = {
  items: RawDoc[];
  categories: RawDoc[];
  ingredients: RawDoc[];
};

export type PublicMenuData = {
  products: MenuProduct[];
  categories: MenuCategory[];
  /** Nome categoria italiano (normalizzato) -> etichetta nella lingua corrente. */
  categoryLabels: Record<string, string>;
  globalAllergens: MenuAllergen[];
};

export type FeaturedDish = {
  id: string;
  name: string;
  ingredients: string;
  image: string;
};

const mapMenuItem = (
  id: string,
  raw: RawMenuItemDoc,
  locale: string,
): (MenuProduct & { sortOrder: number }) | null => {
  const italianName = normalizeText(raw.Nome ?? raw.nome);
  if (!italianName || !parseVisible(raw)) return null;

  const italianDescription = normalizeText(raw.Descrizione ?? raw.descrizione);
  const italianIngredients = normalizeText(raw.Ingredienti ?? raw.ingredienti);

  // Traduzione solo se aggiornata rispetto all'italiano attuale.
  const translation =
    locale === "it" ? null : getFreshMenuItemTranslation(raw, locale);
  const name = translation?.nome || italianName;
  const description = translation
    ? translation.descrizione
    : italianDescription;
  const ingredientsText = translation
    ? translation.ingredienti
    : italianIngredients;
  const ingredients = splitIngredients(ingredientsText);

  const tags = parseStringArray(raw.tags).map((entry) => entry.toLowerCase());
  const explicitSpice = extractSpiceLevelFromRaw(raw);
  // La piccantezza si deduce sempre dal testo italiano (parole chiave italiane).
  const inferredSpice = inferSpiceFromText(
    `${italianName} ${italianDescription} ${italianIngredients}`,
  );

  return {
    id,
    name,
    price: parsePrice(raw.Prezzo ?? raw.prezzo),
    category: normalizeText(raw.Categoria ?? raw.categoria) || "Menu",
    spiceLevel: explicitSpice > 0 ? explicitSpice : inferredSpice,
    image: normalizeImage(
      normalizeText(raw.Immagine ?? raw.immagine) || "assets/logo.jpg",
    ),
    imageThumb: normalizeImage(
      normalizeText(
        raw.ImmagineThumb ?? raw.immagineThumb ?? raw.imageThumb ?? raw.thumbnail,
      ) ||
        normalizeText(raw.Immagine ?? raw.immagine) ||
        "assets/logo.jpg",
    ),
    imageFit: normalizeImageFit(raw.imageFit),
    description: description || ingredientsText,
    ingredients,
    allergens: unique(
      parseStringArray(raw.allergeni ?? raw.allergens).map((entry) =>
        entry.toLowerCase(),
      ),
    ),
    extras: unique(parseStringArray(raw.extras ?? raw.extra)),
    notes: unique(parseStringArray(raw.note)),
    badges: {
      special: Boolean(
        raw.specialita || raw.special || tags.includes("specialita"),
      ),
      hot: Boolean(raw.hot || raw.richiesto || tags.includes("richiesta")),
      recent: Boolean(raw.new || raw.novita || tags.includes("novita")),
    },
    sortOrder: parseOrder(raw),
  };
};

/** Menu pubblico nella lingua richiesta: solo piatti e categorie visibili. */
export const buildPublicMenu = (
  docs: RawMenuDocs,
  locale: string,
): PublicMenuData => {
  const products = docs.items
    .map((doc) => mapMenuItem(doc.id, doc.data as RawMenuItemDoc, locale))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => {
      const categoryDiff = a.category.localeCompare(b.category, "it");
      if (categoryDiff !== 0) return categoryDiff;
      const orderDiff = a.sortOrder - b.sortOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, locale);
    })
    .map(({ sortOrder: _sortOrder, ...product }) => product);

  const categoryLabels: Record<string, string> = {};
  const categories = docs.categories
    .map((doc) => {
      const raw = doc.data as RawCategoryDoc;
      const name = normalizeText(raw.name ?? raw.nome);
      if (!name) return null;
      if (locale !== "it") {
        const translation = getFreshCategoryTranslation(raw, locale);
        if (translation) {
          categoryLabels[normalizeCategoryKey(name)] = translation.nome;
        }
      }
      return {
        id: doc.id || categoryAnchorId(name),
        name,
        order: parseOrder(raw),
        visible: parseVisible(raw),
      };
    })
    .filter((entry): entry is MenuCategory => Boolean(entry))
    .sort((a, b) => {
      const orderDiff = a.order - b.order;
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, "it");
    });

  const allergenKeys = unique(
    docs.ingredients
      .flatMap((doc) => {
        const raw = doc.data as RawIngredientDoc;
        return parseStringArray(raw.allergeni ?? raw.allergens);
      })
      .map((entry) => entry.toLowerCase()),
  );

  return {
    products,
    categories,
    categoryLabels,
    globalAllergens: allergenKeys.map((key) => ({
      key,
      label: key.replace(/_/g, " "),
    })),
  };
};

/** Piatti "firma" (specialità visibili) per la home, in italiano. */
export const buildFeaturedDishes = (items: RawDoc[]): FeaturedDish[] =>
  items
    .map((doc) => {
      const raw = doc.data as RawMenuItemDoc;
      const name = normalizeText(raw.nome ?? raw.Nome);
      if (!name || !parseVisible(raw)) return null;
      if (!(raw.specialita ?? raw.special)) return null;
      return {
        id: doc.id,
        name,
        ingredients: normalizeText(raw.ingredienti ?? raw.Ingredienti),
        image: normalizeImage(normalizeText(raw.immagine ?? raw.Immagine)),
        order: parseOrder(raw),
      };
    })
    .filter((entry): entry is FeaturedDish & { order: number } => Boolean(entry))
    .sort((a, b) => {
      const orderDiff = a.order - b.order;
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, "it");
    })
    .map(({ order: _order, ...dish }) => dish);
