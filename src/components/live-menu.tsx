"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { MenuMobileTopbar } from "@/components/menu-mobile-topbar";
import { MenuCategoriesBar } from "@/components/menu-categories-bar";
import { MenuProductCard } from "@/components/menu-product-card";
import { MenuProductSheet } from "@/components/menu-product-sheet";
import { useLiveMenuData } from "@/hooks/use-live-menu-data";
import {
  categoryAnchorId,
  normalizeCategoryKey,
  unique,
} from "@/lib/menu-parsing";
import type { MenuCategory, MenuProduct } from "@/types/menu-app";

const topOffsetForActiveCategory = 168;

export function LiveMenu() {
  const locale = useLocale();
  const t = useTranslations("Menu");
  const { products, categories, categoryLabels, globalAllergens, loading } =
    useLiveMenuData(locale);

  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExclusions, setSelectedExclusions] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(
    null,
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const getCategoryLabel = (name: string) =>
    categoryLabels[normalizeCategoryKey(name)] ?? name;

  const dynamicCategories = useMemo(() => {
    const merged: MenuCategory[] = [];
    const addIfMissing = (entry: MenuCategory) => {
      const exists = merged.some(
        (category) => category.name.toLowerCase() === entry.name.toLowerCase(),
      );
      if (!exists) merged.push(entry);
    };

    categories.filter((entry) => entry.visible).forEach(addIfMissing);

    // Categorie usate dai prodotti ma non presenti in menu_categories.
    unique(products.map((product) => product.category)).forEach((name) =>
      addIfMissing({
        id: categoryAnchorId(name),
        name,
        order: 9999,
        visible: true,
      }),
    );

    return merged;
  }, [categories, products]);

  const dynamicAllergens = useMemo(() => {
    const keys = unique([
      ...globalAllergens.map((entry) => entry.key.toLowerCase()),
      ...products.flatMap((product) => product.allergens),
    ]);
    return keys.map((key) => {
      const rawLabel =
        globalAllergens.find((entry) => entry.key.toLowerCase() === key)
          ?.label || key.replace(/_/g, " ");
      return {
        key,
        label: rawLabel
          .split(" ")
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
          .join(" "),
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

  // Categoria attiva "derivata": se quella salvata non e piu visibile
  // (filtri, ricerca) si usa la prima disponibile.
  const currentCategory = categorySections.some(
    (section) =>
      normalizeCategoryKey(section.category.name) ===
      normalizeCategoryKey(activeCategory),
  )
    ? activeCategory
    : (categorySections[0]?.category.name ?? "");

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
          <p className="section-subtitle">{t("loading")}</p>
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
        titleLabel={t("menu")}
        sectionAriaLabel={t("sectionAria")}
        searchPlaceholder={t("searchPlaceholder")}
        searchAriaLabel={t("searchAria")}
        openSearchLabel={t("openSearch")}
        openFiltersLabel={t("openFilters")}
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
        activeCategory={currentCategory}
        categoriesAriaLabel={t("categoriesAria")}
        getCategoryLabel={getCategoryLabel}
        onSelectCategory={(category) => {
          scrollToCategorySection(category);
        }}
      />

      <div
        className={showFilters ? "qr-filters-panel open" : "qr-filters-panel"}
      >
        <div className="qr-filters-head">
          <h3>{t("filtersTitle")}</h3>
          <button
            type="button"
            className="qr-reset-btn"
            onClick={() => setSelectedExclusions([])}
          >
            {t("reset")}
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
            id={categoryAnchorId(section.category.name)}
            data-category-name={section.category.name}
            ref={(node) => {
              sectionRefs.current[normalizeCategoryKey(section.category.name)] =
                node;
            }}
            className="qr-category-section"
            aria-labelledby={`${categoryAnchorId(section.category.name)}-title`}
          >
            <h2
              id={`${categoryAnchorId(section.category.name)}-title`}
              className="qr-category-title"
            >
              {getCategoryLabel(section.category.name)}
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
                      special: t("special"),
                      hot: t("hot"),
                      recent: t("recent"),
                      infoAria: t("cardInfoAria"),
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
          <p>{t("empty")}</p>
        </div>
      ) : null}

      <MenuProductSheet
        labels={{
          detailAria: t("detailAria"),
          closeAria: t("closeAria"),
          ingredients: t("ingredients"),
          allergensAria: t("allergensAria"),
        }}
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </section>
  );
}
