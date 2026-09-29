import { unstable_cache } from "next/cache";
import { tolerateBuildErrors } from "@/lib/build-safe";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  buildFeaturedDishes,
  buildPublicMenu,
  type FeaturedDish,
  type PublicMenuData,
  type RawMenuDocs,
} from "@/lib/menu-mapping";

// Menu pubblico letto sul server e tenuto in cache: le pagine arrivano al
// browser già complete (niente Firebase lato cliente, e Google vede i piatti).
//
// Quando cambia:
// - subito: il pannello admin chiama /api/admin/menu/revalidate dopo ogni
//   salvataggio (vedi components/admin-menu/menu-cache.ts);
// - comunque entro MENU_REVALIDATE_SECONDS, per le modifiche fatte fuori dal
//   pannello (es. npm run menu:i18n:import).

export const MENU_CACHE_TAG = "menu";
export const MENU_REVALIDATE_SECONDS = 600;

const readMenuDocs = async (): Promise<RawMenuDocs> => {
  const db = getAdminDb();
  const [items, categories, ingredients] = await Promise.all([
    db.collection("menu_items").get(),
    db.collection("menu_categories").get(),
    db.collection("menu_ingredients").get(),
  ]);
  const toRaw = (snapshot: typeof items) =>
    snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  return {
    items: toRaw(items),
    categories: toRaw(categories),
    ingredients: toRaw(ingredients),
  };
};

const cacheOptions = {
  tags: [MENU_CACHE_TAG],
  revalidate: MENU_REVALIDATE_SECONDS,
};

const getCachedPublicMenu = unstable_cache(
  async (locale: string): Promise<PublicMenuData> =>
    buildPublicMenu(await readMenuDocs(), locale),
  ["public-menu"],
  cacheOptions,
);

const getCachedFeaturedDishes = unstable_cache(
  async (): Promise<FeaturedDish[]> =>
    buildFeaturedDishes((await readMenuDocs()).items),
  ["home-featured-dishes"],
  cacheOptions,
);

export const getPublicMenu = (locale: string) =>
  tolerateBuildErrors(() => getCachedPublicMenu(locale), `menu ${locale}`);

export const getFeaturedDishes = () =>
  tolerateBuildErrors(getCachedFeaturedDishes, "piatti in evidenza");
