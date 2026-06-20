"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { getMenuItems } from "@/lib/menu";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { MenuMobileTopbar } from "@/components/menu-mobile-topbar";
import { MenuCategoriesBar } from "@/components/menu-categories-bar";
import { MenuProductCard } from "@/components/menu-product-card";
import { MenuProductSheet } from "@/components/menu-product-sheet";
import type { MenuAllergen, MenuCategory, MenuProduct } from "@/types/menu-app";
import type { MenuImageFit } from "@/types/menu-app";

type RawMenuItemDoc = {
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
  piccantezza?: number | string;
  Piccantezza?: number | string;
  livelloPiccantezza?: number | string;
  piccante?: number | string | boolean;
  spiceLevel?: number | string;
  SpiceLevel?: number | string;
  spicyLevel?: number | string;
  SpicyLevel?: number | string;
  ordine?: number;
  order?: number;
};

type RawCategoryDoc = {
  name?: string;
  nome?: string;
  ordine?: number;
  order?: number;
  visible?: boolean;
  visibile?: boolean;
};

type RawIngredientDoc = {
  name?: string;
  nome?: string;
  allergeni?: unknown;
  allergens?: unknown;
};

type RawSettingsDoc = {
  restaurantName?: string;
  nomeRistorante?: string;
  logo?: string;
};

type RawExtraDoc = {
  name?: string;
  nome?: string;
};

type MenuLanguage = "it" | "en" | "fr" | "de" | "es";

const languageLabels: Record<MenuLanguage, string> = {
  it: "Italiano",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
};

const uiText: Record<
  MenuLanguage,
  {
    menu: string;
    loading: string;
    searchPlaceholder: string;
    searchAria: string;
    openSearch: string;
    openFilters: string;
    languageMenu: string;
    filtersTitle: string;
    reset: string;
    empty: string;
    categoriesAria: string;
    special: string;
    hot: string;
    recent: string;
    detailAria: string;
    closeAria: string;
    ingredients: string;
    allergensAria: string;
  }
> = {
  it: {
    menu: "Menu",
    loading: "Caricamento menu...",
    searchPlaceholder: "Cerca nel menu...",
    searchAria: "Cerca piatti",
    openSearch: "Apri ricerca",
    openFilters: "Apri pannello filtri",
    languageMenu: "Apri selettore lingua",
    filtersTitle: "Escludi allergeni",
    reset: "Reset",
    empty: "Nessun prodotto trovato con i filtri correnti.",
    categoriesAria: "Categorie menu",
    special: "Specialita del mese",
    hot: "Piu richiesta",
    recent: "Novita",
    detailAria: "Dettaglio prodotto",
    closeAria: "Chiudi dettaglio",
    ingredients: "Ingredienti",
    allergensAria: "Allergeni del piatto",
  },
  en: {
    menu: "Menu",
    loading: "Loading menu...",
    searchPlaceholder: "Search in menu...",
    searchAria: "Search dishes",
    openSearch: "Open search",
    openFilters: "Open filters panel",
    languageMenu: "Open language selector",
    filtersTitle: "Exclude allergens",
    reset: "Reset",
    empty: "No products found with current filters.",
    categoriesAria: "Menu categories",
    special: "Special of the month",
    hot: "Most requested",
    recent: "New",
    detailAria: "Product details",
    closeAria: "Close details",
    ingredients: "Ingredients",
    allergensAria: "Dish allergens",
  },
  fr: {
    menu: "Menu",
    loading: "Chargement du menu...",
    searchPlaceholder: "Rechercher dans le menu...",
    searchAria: "Rechercher des plats",
    openSearch: "Ouvrir la recherche",
    openFilters: "Ouvrir les filtres",
    languageMenu: "Ouvrir le choix de langue",
    filtersTitle: "Exclure les allergenes",
    reset: "Reset",
    empty: "Aucun produit trouve avec les filtres actuels.",
    categoriesAria: "Categories du menu",
    special: "Specialite du mois",
    hot: "Le plus demande",
    recent: "Nouveau",
    detailAria: "Details du produit",
    closeAria: "Fermer les details",
    ingredients: "Ingredients",
    allergensAria: "Allergenes du plat",
  },
  de: {
    menu: "Menü",
    loading: "Menü wird geladen...",
    searchPlaceholder: "Im Menü suchen...",
    searchAria: "Gerichte suchen",
    openSearch: "Suche öffnen",
    openFilters: "Filter öffnen",
    languageMenu: "Sprachauswahl öffnen",
    filtersTitle: "Allergene ausschließen",
    reset: "Reset",
    empty: "Keine Produkte mit den aktuellen Filtern gefunden.",
    categoriesAria: "Menükategorien",
    special: "Spezialitat des Monats",
    hot: "Am meisten gefragt",
    recent: "Neu",
    detailAria: "Produktdetails",
    closeAria: "Details schließen",
    ingredients: "Zutaten",
    allergensAria: "Allergene des Gerichts",
  },
  es: {
    menu: "Menu",
    loading: "Cargando menu...",
    searchPlaceholder: "Buscar en el menu...",
    searchAria: "Buscar platos",
    openSearch: "Abrir busqueda",
    openFilters: "Abrir filtros",
    languageMenu: "Abrir selector de idioma",
    filtersTitle: "Excluir alergenos",
    reset: "Reset",
    empty: "No se encontraron productos con los filtros actuales.",
    categoriesAria: "Categorias del menu",
    special: "Especialidad del mes",
    hot: "Mas pedido",
    recent: "Nuevo",
    detailAria: "Detalle del producto",
    closeAria: "Cerrar detalle",
    ingredients: "Ingredientes",
    allergensAria: "Alergenos del plato",
  },
};

const translateCategoryName = (
  name: string,
  language: MenuLanguage,
): string => {
  if (language === "it") return name;

  const key = name.trim().toLowerCase();
  const map: Record<MenuLanguage, Record<string, string>> = {
    it: {},
    en: {
      antipasti: "Starters",
      antipasto: "Starter",
      pizze: "Pizzas",
      pizza: "Pizza",
      fritture: "Fried",
      fritti: "Fried",
      bevande: "Drinks",
      bibite: "Drinks",
      dolci: "Desserts",
    },
    fr: {
      antipasti: "Entrees",
      antipasto: "Entree",
      pizze: "Pizzas",
      pizza: "Pizza",
      fritture: "Fritures",
      fritti: "Frits",
      bevande: "Boissons",
      bibite: "Boissons",
      dolci: "Desserts",
    },
    de: {
      antipasti: "Vorspeisen",
      antipasto: "Vorspeise",
      pizze: "Pizzen",
      pizza: "Pizza",
      fritture: "Frittiertes",
      fritti: "Frittiertes",
      bevande: "Getranke",
      bibite: "Getranke",
      dolci: "Desserts",
    },
    es: {
      antipasti: "Entrantes",
      antipasto: "Entrante",
      pizze: "Pizzas",
      pizza: "Pizza",
      fritture: "Fritos",
      fritti: "Fritos",
      bevande: "Bebidas",
      bibite: "Bebidas",
      dolci: "Postres",
    },
  };

  return map[language][key] ?? name;
};

const defaultRestaurantName = "Duecento Grammi";
const defaultLogo = "/assets/Centro.png";

const normalizeText = (value: unknown): string => String(value ?? "").trim();

const pickLocalizedText = (
  raw: Record<string, unknown>,
  keys: string[],
  language: MenuLanguage,
): string => {
  const tryKeys: string[] = [];

  keys.forEach((key) => {
    tryKeys.push(key);
    if (language !== "it") {
      tryKeys.push(`${key}_${language}`);
      tryKeys.push(`${key}_${language.toUpperCase()}`);
      tryKeys.push(`${key}${language}`);
      tryKeys.push(`${key}${language.toUpperCase()}`);
      tryKeys.push(`${key}_${languageLabels[language].toLowerCase()}`);
    }
  });

  for (const key of tryKeys) {
    const value = normalizeText(raw[key]);
    if (value) return value;
  }

  return "";
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 0);
};

const parsePrice = (value: unknown): number => {
  const normalized = String(value ?? "0")
    .replace(",", ".")
    .trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const parseSpiceLevel = (value: unknown): number => {
  if (typeof value === "boolean") return value ? 1 : 0;

  if (value && typeof value === "object") {
    const asObject = value as Record<string, unknown>;
    const nested =
      asObject.level ?? asObject.value ?? asObject.intensity ?? asObject.degree;
    if (nested !== undefined) return parseSpiceLevel(nested);
    return 0;
  }

  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return 0;

  if (
    raw === "si" ||
    raw === "sì" ||
    raw === "yes" ||
    raw === "true" ||
    raw === "on"
  ) {
    return 1;
  }

  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    const peppers = (raw.match(/🌶/g) || []).length;
    if (peppers > 0) return Math.min(3, peppers);

    if (
      raw.includes("poco") ||
      raw.includes("lieve") ||
      raw.includes("basso") ||
      raw.includes("low")
    ) {
      return 1;
    }
    if (
      raw.includes("medio") ||
      raw.includes("media") ||
      raw.includes("medium")
    ) {
      return 2;
    }
    if (
      raw.includes("molto") ||
      raw.includes("alto") ||
      raw.includes("forte") ||
      raw.includes("high")
    ) {
      return 3;
    }
    if (raw.includes("piccante") || raw.includes("spicy")) {
      return 2;
    }
    return 0;
  }
  if (parsed <= 0) return 0;
  if (parsed >= 3) return 3;
  return Math.round(parsed);
};

const extractSpiceLevelFromRaw = (raw: Record<string, unknown>): number => {
  const direct = parseSpiceLevel(
    raw.piccantezza ??
      raw.Piccantezza ??
      raw.livelloPiccantezza ??
      raw.piccante ??
      raw.spiceLevel ??
      raw.SpiceLevel ??
      raw.spicyLevel ??
      raw.SpicyLevel,
  );
  if (direct > 0) return direct;

  let best = 0;
  const seen = new WeakSet<object>();

  const visit = (value: unknown, depth: number) => {
    if (depth > 5 || best >= 3) return;

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }

    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return;
    seen.add(obj);

    Object.entries(obj).forEach(([key, entry]) => {
      if (/piccant|spic/i.test(key)) {
        best = Math.max(best, parseSpiceLevel(entry));
      }
      if (entry && typeof entry === "object") {
        visit(entry, depth + 1);
      }
    });
  };

  visit(raw, 0);
  return best;
};

const inferSpiceFromText = (value: string): number => {
  const raw = value.trim().toLowerCase();
  if (!raw) return 0;
  const normalized = raw.replace(/[’']/g, "");

  if (
    normalized.includes("nduja") ||
    normalized.includes("peperoncino") ||
    normalized.includes("chili") ||
    normalized.includes("chilli") ||
    normalized.includes("jalapeno")
  ) {
    return 2;
  }

  if (normalized.includes("piccante") || normalized.includes("spicy")) {
    return 1;
  }

  return 0;
};

const normalizeImage = (image: string): string => {
  if (!image) return "/assets/logo.jpg";
  if (image.startsWith("http")) return image;
  return `/${image.replace(/^\/+/, "")}`;
};

const normalizeImageFit = (value: unknown): MenuImageFit => {
  return value === "contain" ? "contain" : "cover";
};

const unique = (values: string[]): string[] => {
  const out: string[] = [];
  values.forEach((value) => {
    const exists = out.some(
      (entry) => entry.toLowerCase() === value.toLowerCase(),
    );
    if (!exists) out.push(value);
  });
  return out;
};

const ingredientDictionary: Record<MenuLanguage, Record<string, string>> = {
  it: {},
  en: {
    mozzarella: "mozzarella",
    pomodoro: "tomato",
    basilico: "basil",
    origano: "oregano",
    prosciutto: "ham",
    crudo: "cured ham",
    cotto: "cooked ham",
    salame: "salami",
    ventricina: "spicy salami",
    salsiccia: "sausage",
    friarielli: "broccoli rabe",
    melanzane: "eggplant",
    zucchine: "zucchini",
    funghi: "mushrooms",
    cipolla: "onion",
    olive: "olives",
    capperi: "capers",
    acciughe: "anchovies",
    tonno: "tuna",
    ricotta: "ricotta",
    scamorza: "smoked scamorza",
    provola: "provola",
    parmigiano: "parmesan",
    pecorino: "pecorino",
    gorgonzola: "gorgonzola",
    nduja: "nduja",
    rucola: "rocket",
    grana: "grana",
    patatine: "fries",
    olio: "olive oil",
    aglio: "garlic",
    pepe: "pepper",
  },
  fr: {
    mozzarella: "mozzarella",
    pomodoro: "tomate",
    basilico: "basilic",
    origano: "origan",
    prosciutto: "jambon",
    crudo: "jambon cru",
    cotto: "jambon cuit",
    salame: "salami",
    ventricina: "salami epicé",
    salsiccia: "saucisse",
    friarielli: "brocoli-rave",
    melanzane: "aubergine",
    zucchine: "courgette",
    funghi: "champignons",
    cipolla: "oignon",
    olive: "olives",
    capperi: "capres",
    acciughe: "anchois",
    tonno: "thon",
    ricotta: "ricotta",
    scamorza: "scamorza fumee",
    provola: "provola",
    parmigiano: "parmesan",
    pecorino: "pecorino",
    gorgonzola: "gorgonzola",
    nduja: "nduja",
    rucola: "roquette",
    grana: "grana",
    patatine: "frites",
    olio: "huile d olive",
    aglio: "ail",
    pepe: "poivre",
  },
  de: {
    mozzarella: "mozzarella",
    pomodoro: "tomate",
    basilico: "basilikum",
    origano: "oregano",
    prosciutto: "schinken",
    crudo: "rohschinken",
    cotto: "kochschinken",
    salame: "salami",
    ventricina: "scharfe salami",
    salsiccia: "wurst",
    friarielli: "stangenkohl",
    melanzane: "aubergine",
    zucchine: "zucchini",
    funghi: "pilze",
    cipolla: "zwiebel",
    olive: "oliven",
    capperi: "kapern",
    acciughe: "sardellen",
    tonno: "thunfisch",
    ricotta: "ricotta",
    scamorza: "geraeucherte scamorza",
    provola: "provola",
    parmigiano: "parmesan",
    pecorino: "pecorino",
    gorgonzola: "gorgonzola",
    nduja: "nduja",
    rucola: "rucola",
    grana: "grana",
    patatine: "pommes",
    olio: "olivenol",
    aglio: "knoblauch",
    pepe: "pfeffer",
  },
  es: {
    mozzarella: "mozzarella",
    pomodoro: "tomate",
    basilico: "albahaca",
    origano: "oregano",
    prosciutto: "jamon",
    crudo: "jamon curado",
    cotto: "jamon cocido",
    salame: "salami",
    ventricina: "salami picante",
    salsiccia: "salchicha",
    friarielli: "brocoli rabe",
    melanzane: "berenjena",
    zucchine: "calabacin",
    funghi: "champiñones",
    cipolla: "cebolla",
    olive: "aceitunas",
    capperi: "alcaparras",
    acciughe: "anchoas",
    tonno: "atun",
    ricotta: "ricotta",
    scamorza: "scamorza ahumada",
    provola: "provola",
    parmigiano: "parmesano",
    pecorino: "pecorino",
    gorgonzola: "gorgonzola",
    nduja: "nduja",
    rucola: "rucula",
    grana: "grana",
    patatine: "patatas fritas",
    olio: "aceite de oliva",
    aglio: "ajo",
    pepe: "pimienta",
  },
};

const allergenDictionary: Record<MenuLanguage, Record<string, string>> = {
  it: {},
  en: {
    glutine: "gluten",
    latte: "milk",
    uova: "eggs",
    pesce: "fish",
    crostacei: "crustaceans",
    arachidi: "peanuts",
    soia: "soy",
    sedano: "celery",
    senape: "mustard",
    sesamo: "sesame",
    solfiti: "sulphites",
    lupini: "lupins",
    molluschi: "molluscs",
    "frutta guscio": "tree nuts",
  },
  fr: {
    glutine: "gluten",
    latte: "lait",
    uova: "oeufs",
    pesce: "poisson",
    crostacei: "crustaces",
    arachidi: "arachides",
    soia: "soja",
    sedano: "celeri",
    senape: "moutarde",
    sesamo: "sesame",
    solfiti: "sulfites",
    lupini: "lupins",
    molluschi: "mollusques",
    "frutta guscio": "fruits a coque",
  },
  de: {
    glutine: "gluten",
    latte: "milch",
    uova: "eier",
    pesce: "fisch",
    crostacei: "krebstiere",
    arachidi: "erdnusse",
    soia: "soja",
    sedano: "sellerie",
    senape: "senf",
    sesamo: "sesam",
    solfiti: "sulfite",
    lupini: "lupinen",
    molluschi: "weichtiere",
    "frutta guscio": "schalenfruchte",
  },
  es: {
    glutine: "gluten",
    latte: "leche",
    uova: "huevos",
    pesce: "pescado",
    crostacei: "crustaceos",
    arachidi: "cacahuetes",
    soia: "soja",
    sedano: "apio",
    senape: "mostaza",
    sesamo: "sesamo",
    solfiti: "sulfitos",
    lupini: "altramuces",
    molluschi: "moluscos",
    "frutta guscio": "frutos secos",
  },
};

const translateAllergenLabel = (
  label: string,
  language: MenuLanguage,
): string => {
  if (language === "it") return label;
  const normalized = label.trim().toLowerCase();
  return allergenDictionary[language][normalized] ?? label;
};

const translateIngredientList = (
  ingredients: string[],
  language: MenuLanguage,
): string[] => {
  if (language === "it") return ingredients;
  const dict = ingredientDictionary[language];
  return ingredients.map((entry) => {
    const normalized = entry.trim().toLowerCase();
    return dict[normalized] ?? entry;
  });
};

const toEmojiCategory = (name: string): string =>
  `cat-${name.toLowerCase().replace(/\s+/g, "-")}`;

const normalizeCategoryKey = (name: string): string =>
  name.toLowerCase().trim();

const topOffsetForActiveCategory = 168;

const getFallbackProducts = (): MenuProduct[] =>
  getMenuItems().map((entry, index) => {
    const entryRecord = entry as Record<string, unknown>;
    const ingredientsText = normalizeText(entry.Ingredienti);
    const desc = normalizeText(entry.Descrizione);
    const explicitSpice = parseSpiceLevel(
      entry.piccantezza ??
        entry.Piccantezza ??
        entry.spiceLevel ??
        entry.spicyLevel,
    );
    return {
      id: `fallback-${index}`,
      name: normalizeText(entry.Nome),
      price: parsePrice(entry.Prezzo),
      category: normalizeText(entry.Categoria) || "Menu",
      spiceLevel:
        explicitSpice > 0
          ? explicitSpice
          : inferSpiceFromText(`${entry.Nome} ${entry.Ingredienti}`),
      image: normalizeImage(
        normalizeText(entry.Immagine) || "assets/logo.jpg",
      ),
      imageThumb: normalizeImage(
        normalizeText(
          entryRecord.ImmagineThumb ??
            entryRecord.immagineThumb ??
            entryRecord.imageThumb,
        ) ||
          normalizeText(entry.Immagine) ||
          "assets/logo.jpg",
      ),
      imageFit: normalizeImageFit(entryRecord.imageFit),
      description: desc || ingredientsText,
      ingredients: ingredientsText
        .split(",")
        .map((ingredient) => ingredient.trim())
        .filter((ingredient) => ingredient.length > 0),
      allergens: [],
      extras: [],
      notes: [],
      badges: {
        special: false,
        hot: false,
        recent: false,
      },
    };
  });

export function LiveMenu() {
  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [globalAllergens, setGlobalAllergens] = useState<MenuAllergen[]>([]);
  const [globalExtras, setGlobalExtras] = useState<string[]>([]);
  const [restaurantName, setRestaurantName] = useState(defaultRestaurantName);
  const [logoSrc, setLogoSrc] = useState(defaultLogo);
  const t = uiText.it;

  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExclusions, setSelectedExclusions] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let db;
    try {
      db = getClientDb();
    } catch {
      setProducts(getFallbackProducts());
      setLoading(false);
      return;
    }

    let hasResolvedItems = false;
    let hasResolvedCategories = false;
    let hasSettledLoading = false;

    const resolveLoadingIfReady = () => {
      if (hasSettledLoading) return;
      if (!hasResolvedItems || !hasResolvedCategories) return;
      hasSettledLoading = true;
      window.clearTimeout(loadingFallbackTimer);
      setLoading(false);
    };

    const loadingFallbackTimer = window.setTimeout(() => {
      if (hasResolvedItems && hasResolvedCategories) return;
      setProducts((current) =>
        current.length > 0 ? current : getFallbackProducts(),
      );
      hasSettledLoading = true;
      setLoading(false);
    }, 3500);

    const unsubscribeItems = onSnapshot(
      collection(db, "menu_items"),
      (snapshot) => {
        hasResolvedItems = true;
        const nextProducts = snapshot.docs
          .map((doc) => {
            const raw = doc.data() as RawMenuItemDoc;
            const name = normalizeText(raw.Nome ?? raw.nome);
            if (!name) return null;

            const description = normalizeText(
              raw.Descrizione ?? raw.descrizione,
            );
            const ingredientsText = normalizeText(
              raw.Ingredienti ?? raw.ingredienti,
            );
            const category =
              normalizeText(raw.Categoria ?? raw.categoria) || "Menu";
            const allergens = unique(
              parseStringArray(raw.allergeni ?? raw.allergens).map((entry) =>
                entry.toLowerCase(),
              ),
            );
            const extras = unique(parseStringArray(raw.extras ?? raw.extra));
            const notes = unique(parseStringArray(raw.note));
            const tags = parseStringArray(raw.tags).map((entry) =>
              entry.toLowerCase(),
            );

            const isVisible =
              typeof raw.visible === "boolean"
                ? raw.visible
                : typeof raw.visibile === "boolean"
                  ? raw.visibile
                  : true;
            if (!isVisible) return null;

            const parsedIngredients = ingredientsText
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0);
            const ingredients = parsedIngredients;

            const explicitSpice = extractSpiceLevelFromRaw(
              raw as Record<string, unknown>,
            );
            const inferredSpice = inferSpiceFromText(
              `${name} ${description} ${ingredientsText} ${ingredients.join(" ")}`,
            );

            return {
              id: doc.id,
              name,
              price: parsePrice(raw.Prezzo ?? raw.prezzo),
              category,
              spiceLevel: explicitSpice > 0 ? explicitSpice : inferredSpice,
              image: normalizeImage(
                normalizeText(raw.Immagine ?? raw.immagine) ||
                  "assets/logo.jpg",
              ),
              imageThumb: normalizeImage(
                normalizeText(
                  raw.ImmagineThumb ??
                    raw.immagineThumb ??
                    raw.imageThumb ??
                    raw.thumbnail,
                ) ||
                  normalizeText(raw.Immagine ?? raw.immagine) ||
                  "assets/logo.jpg",
              ),
              imageFit: normalizeImageFit(raw.imageFit),
              description:
                description || ingredientsText || ingredients.join(", "),
              ingredients,
              allergens,
              extras,
              notes,
              badges: {
                special: Boolean(
                  raw.specialita || raw.special || tags.includes("specialita"),
                ),
                hot: Boolean(
                  raw.hot || raw.richiesto || tags.includes("richiesta"),
                ),
                recent: Boolean(
                  raw.new || raw.novita || tags.includes("novita"),
                ),
              },
              sortOrder: Number.isFinite(Number(raw.ordine))
                ? Number(raw.ordine)
                : Number.isFinite(Number(raw.order))
                  ? Number(raw.order)
                  : 9999,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .sort((a, b) => {
            const categoryDiff = a.category.localeCompare(b.category, "it");
            if (categoryDiff !== 0) return categoryDiff;
            const orderDiff = a.sortOrder - b.sortOrder;
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, "it");
          })
          .map(({ sortOrder: _sortOrder, ...product }) => product);

        if (nextProducts.length > 0) {
          setProducts(nextProducts);
        } else {
          setProducts(getFallbackProducts());
        }

        resolveLoadingIfReady();
      },
      () => {
        hasResolvedItems = true;
        setProducts((current) =>
          current.length > 0 ? current : getFallbackProducts(),
        );
        resolveLoadingIfReady();
      },
    );

    const unsubscribeCategories = onSnapshot(
      collection(db, "menu_categories"),
      (snapshot) => {
        hasResolvedCategories = true;
        const orderedCategories = snapshot.docs
          .map((doc) => {
            const raw = doc.data() as RawCategoryDoc;
            const name = normalizeText(raw.name ?? raw.nome);
            if (!name) return null;
            const visible =
              typeof raw.visible === "boolean"
                ? raw.visible
                : typeof raw.visibile === "boolean"
                  ? raw.visibile
                  : true;
            return {
              id: doc.id || toEmojiCategory(name),
              name,
              order: Number.isFinite(Number(raw.ordine))
                ? Number(raw.ordine)
                : Number.isFinite(Number(raw.order))
                  ? Number(raw.order)
                  : 9999,
              visible,
            };
          })
          .filter((entry): entry is MenuCategory => Boolean(entry))
          .sort((a, b) => {
            const orderDiff = a.order - b.order;
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, "it");
          });

        setCategories(orderedCategories);
        resolveLoadingIfReady();
      },
      () => {
        hasResolvedCategories = true;
        setCategories([]);
        resolveLoadingIfReady();
      },
    );

    const unsubscribeIngredients = onSnapshot(
      collection(db, "menu_ingredients"),
      (snapshot) => {
        const fromIngredients = snapshot.docs.flatMap((doc) => {
          const raw = doc.data() as RawIngredientDoc;
          return parseStringArray(raw.allergeni ?? raw.allergens);
        });

        const normalized = unique(
          fromIngredients.map((entry) => entry.toLowerCase()),
        ).map((entry) => ({ key: entry, label: entry.replace(/_/g, " ") }));
        setGlobalAllergens((prev) => {
          const merged = unique([
            ...prev.map((entry) => entry.key),
            ...normalized.map((entry) => entry.key),
          ]).map((key) => {
            const found =
              normalized.find((entry) => entry.key === key) ??
              prev.find((entry) => entry.key === key);
            return {
              key,
              label: found?.label || key,
            };
          });
          return merged;
        });
      },
      () => {
        setGlobalAllergens([]);
      },
    );

    const unsubscribeExtras = onSnapshot(
      collection(db, "menu_extras"),
      (snapshot) => {
        const extras = unique(
          snapshot.docs
            .map((doc) => {
              const raw = doc.data() as RawExtraDoc;
              return normalizeText(raw.name ?? raw.nome);
            })
            .filter((entry) => entry.length > 0),
        );
        setGlobalExtras(extras);
      },
      () => {
        setGlobalExtras([]);
      },
    );

    const unsubscribeSettings = onSnapshot(
      collection(db, "menu_settings"),
      (snapshot) => {
        const first = snapshot.docs[0]?.data() as RawSettingsDoc | undefined;
        const nextName = normalizeText(
          first?.restaurantName ?? first?.nomeRistorante,
        );
        const nextLogo = normalizeText(first?.logo);
        if (nextName) setRestaurantName(nextName);
        if (nextLogo) setLogoSrc(normalizeImage(nextLogo));
      },
      () => {
        setRestaurantName(defaultRestaurantName);
        setLogoSrc(defaultLogo);
      },
    );

    return () => {
      window.clearTimeout(loadingFallbackTimer);
      unsubscribeItems();
      unsubscribeCategories();
      unsubscribeIngredients();
      unsubscribeExtras();
      unsubscribeSettings();
    };
  }, []);

  const categoriesFromProducts = useMemo(() => {
    const found = unique(products.map((product) => product.category));
    return found.map((name) => ({
      id: toEmojiCategory(name),
      name,
      order: 9999,
      visible: true,
    }));
  }, [products]);

  const dynamicCategories = useMemo(() => {
    const merged: MenuCategory[] = [];

    categories
      .filter((entry) => entry.visible)
      .forEach((entry) => {
        const exists = merged.some(
          (category) =>
            category.name.toLowerCase() === entry.name.toLowerCase(),
        );
        if (!exists) merged.push(entry);
      });

    categoriesFromProducts.forEach((entry) => {
      const exists = merged.some(
        (category) => category.name.toLowerCase() === entry.name.toLowerCase(),
      );
      if (!exists) merged.push(entry);
    });

    return merged;
  }, [categories, categoriesFromProducts]);

  useEffect(() => {
    if (dynamicCategories.length === 0) {
      setActiveCategory("");
      return;
    }
    const exists = dynamicCategories.some(
      (category) =>
        category.name.toLowerCase() === activeCategory.toLowerCase(),
    );
    if (!exists) setActiveCategory(dynamicCategories[0].name);
  }, [dynamicCategories, activeCategory]);

  const dynamicAllergens = useMemo(() => {
    const fromProducts = unique(
      products
        .flatMap((product) => product.allergens)
        .map((entry) => entry.toLowerCase()),
    ).map((key) => ({ key, label: key.replace(/_/g, " ") }));

    const mergedKeys = unique([
      ...globalAllergens.map((entry) => entry.key.toLowerCase()),
      ...fromProducts.map((entry) => entry.key.toLowerCase()),
    ]);

    return mergedKeys.map((key) => {
      const fromGlobal = globalAllergens.find(
        (entry) => entry.key.toLowerCase() === key,
      );
      const fromProduct = fromProducts.find(
        (entry) => entry.key.toLowerCase() === key,
      );
      const rawLabel = fromGlobal?.label || fromProduct?.label || key;
      const pretty = rawLabel
        .split(" ")
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(" ");
      return {
        key,
        label: pretty,
      };
    });
  }, [globalAllergens, products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products
      .filter((product) => {
        if (!query) return true;
        const searchText = [
          product.name,
          product.description,
          product.ingredients.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return searchText.includes(query);
      })
      .filter((product) => {
        if (selectedExclusions.length === 0) return true;
        return selectedExclusions.every(
          (allergen) =>
            !product.allergens.some(
              (entry) => entry.toLowerCase() === allergen.toLowerCase(),
            ),
        );
      });
  }, [products, searchQuery, selectedExclusions]);

  const categorySections = useMemo(
    () =>
      dynamicCategories
        .map((category) => ({
          category,
          products: filteredProducts.filter(
            (product) =>
              normalizeCategoryKey(product.category) ===
              normalizeCategoryKey(category.name),
          ),
        }))
        .filter((section) => section.products.length > 0),
    [dynamicCategories, filteredProducts],
  );

  useEffect(() => {
    if (categorySections.length === 0) {
      setActiveCategory("");
      return;
    }

    const exists = categorySections.some(
      (section) =>
        normalizeCategoryKey(section.category.name) ===
        normalizeCategoryKey(activeCategory),
    );
    if (!exists) setActiveCategory(categorySections[0].category.name);
  }, [categorySections, activeCategory]);

  useEffect(() => {
    if (categorySections.length === 0) return;
    let ticking = false;

    const updateActiveCategoryFromScroll = () => {
      ticking = false;

      let nextCategory = categorySections[0]?.category.name ?? "";
      let bestDistance = Number.POSITIVE_INFINITY;

      categorySections.forEach((section) => {
        const target =
          sectionRefs.current[normalizeCategoryKey(section.category.name)];
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const distance = Math.abs(rect.top - topOffsetForActiveCategory);
        const isEligible = rect.top - topOffsetForActiveCategory <= 1;

        if (isEligible && distance <= bestDistance) {
          bestDistance = distance;
          nextCategory = section.category.name;
        }
      });

      setActiveCategory((current) =>
        normalizeCategoryKey(current) === normalizeCategoryKey(nextCategory)
          ? current
          : nextCategory,
      );
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActiveCategoryFromScroll);
    };

    updateActiveCategoryFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [categorySections]);

  const scrollToCategorySection = (categoryName: string) => {
    setActiveCategory(categoryName);
    const target = sectionRefs.current[normalizeCategoryKey(categoryName)];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const currentExtras = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedProduct.extras.length > 0) return selectedProduct.extras;
    return globalExtras;
  }, [selectedProduct, globalExtras]);

  const menuShellStyle = useMemo(
    () =>
      ({
        "--qr-header-offset": showSearch ? "106px" : "56px",
      }) as CSSProperties,
    [showSearch],
  );

  if (loading) {
    return (
      <section className="menu-section">
        <div className="container">
          <p className="section-subtitle">{t.loading}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="qr-menu-shell" style={menuShellStyle}>
      <MenuMobileTopbar
        showSearch={showSearch}
        searchValue={searchQuery}
        activeFilterCount={selectedExclusions.length}
        titleLabel={t.menu}
        searchPlaceholder={t.searchPlaceholder}
        searchAriaLabel={t.searchAria}
        openSearchLabel={t.openSearch}
        openFiltersLabel={t.openFilters}
        onToggleSearch={() => {
          setShowSearch((prev) => !prev);
        }}
        onToggleFilters={() => {
          setShowFilters((prev) => !prev);
        }}
        onSearchChange={setSearchQuery}
      />

      <MenuCategoriesBar
        categories={categorySections.map((section) => section.category)}
        activeCategory={activeCategory}
        categoriesAriaLabel={t.categoriesAria}
        onSelectCategory={(category) => {
          scrollToCategorySection(category);
        }}
      />

      <div
        className={showFilters ? "qr-filters-panel open" : "qr-filters-panel"}
      >
        <div className="qr-filters-head">
          <h3>{t.filtersTitle}</h3>
          <button
            type="button"
            className="qr-reset-btn"
            onClick={() => setSelectedExclusions([])}
          >
            {t.reset}
          </button>
        </div>
        <div className="qr-filters-wrap">
          {dynamicAllergens.map((allergen) => {
            const active = selectedExclusions.includes(allergen.key);
            return (
              <AllergenBadge
                key={allergen.key}
                allergen={allergen.label}
                showLabel
                active={active}
                className="qr-filter-chip"
                onClick={() => {
                  setSelectedExclusions((prev) =>
                    prev.includes(allergen.key)
                      ? prev.filter((entry) => entry !== allergen.key)
                      : [...prev, allergen.key],
                  );
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="qr-products-list qr-products-list-sections">
        {categorySections.map((section) => (
          <section
            key={section.category.id}
            id={toEmojiCategory(section.category.name)}
            data-category-name={section.category.name}
            ref={(node) => {
              sectionRefs.current[normalizeCategoryKey(section.category.name)] =
                node;
            }}
            className="qr-category-section"
            aria-labelledby={`${toEmojiCategory(section.category.name)}-title`}
          >
            <h2
              id={`${toEmojiCategory(section.category.name)}-title`}
              className="qr-category-title"
            >
              {section.category.name}
            </h2>

            <div className="qr-category-products">
              {section.products.map((product, index) => (
                <div
                  className="qr-fade-item"
                  key={product.id}
                  style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
                >
                  <MenuProductCard
                    product={product}
                    labels={{
                      special: t.special,
                      hot: t.hot,
                      recent: t.recent,
                    }}
                    onOpen={setSelectedProduct}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="qr-empty-state">
          <p>{t.empty}</p>
        </div>
      ) : null}

      <MenuProductSheet
        labels={{
          detailAria: t.detailAria,
          closeAria: t.closeAria,
          ingredients: t.ingredients,
          allergensAria: t.allergensAria,
        }}
        product={
          selectedProduct
            ? {
                ...selectedProduct,
                extras: currentExtras,
              }
            : null
        }
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  );
}
