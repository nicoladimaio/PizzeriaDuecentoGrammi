"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";
import { getMenuItems } from "@/lib/menu";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { MenuMobileTopbar } from "@/components/menu-mobile-topbar";
import { MenuCategoriesBar } from "@/components/menu-categories-bar";
import { MenuProductCard } from "@/components/menu-product-card";
import { MenuProductSheet } from "@/components/menu-product-sheet";
import type { MenuAllergen, MenuCategory, MenuProduct } from "@/types/menu-app";

type RawMenuItemDoc = {
  Nome?: string;
  nome?: string;
  Prezzo?: number | string;
  prezzo?: number | string;
  Ingredienti?: string;
  ingredienti?: string;
  Categoria?: string;
  categoria?: string;
  Immagine?: string;
  immagine?: string;
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

const defaultRestaurantName = "Duecento Grammi";
const defaultLogo = "/assets/Centro.png";

const normalizeText = (value: unknown): string => String(value ?? "").trim();

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

const normalizeImage = (image: string): string => {
  if (!image) return "/assets/logo1.png";
  if (image.startsWith("http")) return image;
  return `/${image.replace(/^\/+/, "")}`;
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

const toEmojiCategory = (name: string): string =>
  `cat-${name.toLowerCase().replace(/\s+/g, "-")}`;

const getFallbackProducts = (): MenuProduct[] =>
  getMenuItems().map((entry, index) => {
    const desc = normalizeText(entry.Ingredienti);
    return {
      id: `fallback-${index}`,
      name: normalizeText(entry.Nome),
      price: parsePrice(entry.Prezzo),
      category: normalizeText(entry.Categoria) || "Menu",
      image: normalizeImage(
        normalizeText(entry.Immagine) || "assets/logo1.png",
      ),
      description: desc,
      ingredients: desc
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

  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExclusions, setSelectedExclusions] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

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

    const loadingFallbackTimer = window.setTimeout(() => {
      if (hasResolvedItems) return;
      setProducts((current) =>
        current.length > 0 ? current : getFallbackProducts(),
      );
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

            const ingredients = description
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0);

            return {
              id: doc.id,
              name,
              price: parsePrice(raw.Prezzo ?? raw.prezzo),
              category,
              image: normalizeImage(
                normalizeText(raw.Immagine ?? raw.immagine) ||
                  "assets/logo1.png",
              ),
              description: description || ingredients.join(", "),
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

        setLoading(false);
      },
      () => {
        hasResolvedItems = true;
        setProducts((current) =>
          current.length > 0 ? current : getFallbackProducts(),
        );
        setLoading(false);
      },
    );

    const unsubscribeCategories = onSnapshot(
      collection(db, "menu_categories"),
      (snapshot) => {
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
      },
      () => {
        setCategories([]);
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
        if (!activeCategory) return true;
        return product.category.toLowerCase() === activeCategory.toLowerCase();
      })
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
  }, [products, activeCategory, searchQuery, selectedExclusions]);

  const currentExtras = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedProduct.extras.length > 0) return selectedProduct.extras;
    return globalExtras;
  }, [selectedProduct, globalExtras]);

  if (loading) {
    return (
      <section className="menu-section">
        <div className="container">
          <p className="section-subtitle">Caricamento menu...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="qr-menu-shell">
      <MenuMobileTopbar
        showSearch={showSearch}
        searchValue={searchQuery}
        activeFilterCount={selectedExclusions.length}
        onToggleSearch={() => {
          setShowSearch((prev) => !prev);
        }}
        onToggleFilters={() => {
          setShowFilters((prev) => !prev);
        }}
        onSearchChange={setSearchQuery}
      />

      <MenuCategoriesBar
        categories={dynamicCategories}
        activeCategory={activeCategory}
        onSelectCategory={(category) => {
          setActiveCategory(category);
        }}
      />

      <div
        className={showFilters ? "qr-filters-panel open" : "qr-filters-panel"}
      >
        <div className="qr-filters-head">
          <h3>Escludi allergeni</h3>
          <button
            type="button"
            className="qr-reset-btn"
            onClick={() => setSelectedExclusions([])}
          >
            Reset
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

      <div className="qr-products-list">
        {filteredProducts.map((product, index) => (
          <div
            className="qr-fade-item"
            key={product.id}
            style={{ animationDelay: `${Math.min(index * 40, 280)}ms` }}
          >
            <MenuProductCard product={product} onOpen={setSelectedProduct} />
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="qr-empty-state">
          <p>Nessun prodotto trovato con i filtri correnti.</p>
        </div>
      ) : null}

      <MenuProductSheet
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
