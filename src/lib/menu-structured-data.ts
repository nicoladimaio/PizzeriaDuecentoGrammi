import { normalizeCategoryKey } from "@/lib/menu-parsing";
import type { PublicMenuData } from "@/lib/menu-mapping";

// Dati strutturati schema.org (Menu > MenuSection > MenuItem): permettono a
// Google di leggere piatti, descrizioni e prezzi direttamente dalla pagina.

export const buildMenuJsonLd = (
  menu: PublicMenuData,
  locale: string,
  url: string,
) => {
  const labelFor = (name: string) =>
    menu.categoryLabels[normalizeCategoryKey(name)] ?? name;

  const visibleCategories = menu.categories
    .filter((category) => category.visible)
    .map((category) => category.name);
  const sectionNames = [
    ...visibleCategories,
    ...menu.products
      .map((product) => product.category)
      .filter((name, index, all) => all.indexOf(name) === index)
      .filter(
        (name) =>
          !visibleCategories.some(
            (category) => category.toLowerCase() === name.toLowerCase(),
          ),
      ),
  ];

  const sections = sectionNames
    .map((sectionName) => ({
      "@type": "MenuSection",
      name: labelFor(sectionName),
      hasMenuItem: menu.products
        .filter(
          (product) =>
            product.category.toLowerCase() === sectionName.toLowerCase(),
        )
        .map((product) => ({
          "@type": "MenuItem",
          name: product.name,
          ...(product.description ? { description: product.description } : {}),
          ...(product.price > 0
            ? {
                offers: {
                  "@type": "Offer",
                  price: product.price.toFixed(2),
                  priceCurrency: "EUR",
                },
              }
            : {}),
        })),
    }))
    .filter((section) => section.hasMenuItem.length > 0);

  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Menu Duecento Grammi",
    url,
    inLanguage: locale,
    hasMenuSection: sections,
  };
};

/** JSON sicuro dentro un tag <script> (niente "</script>" nei testi). */
export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");
