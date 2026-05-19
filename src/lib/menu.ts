import menuData from "../../public/assets/menu.json";
import type { MenuItem } from "@/types/menu";

export const getMenuItems = (): MenuItem[] => {
  if (!Array.isArray(menuData)) return [];

  return menuData
    .map((item) => ({
      Nome: String(
        (item as { Nome?: string; nome?: string }).Nome ??
          (item as { nome?: string }).nome ??
          "",
      ).trim(),
      Prezzo: String(
        (item as { Prezzo?: string; prezzo?: string }).Prezzo ??
          (item as { prezzo?: string }).prezzo ??
          "",
      ).trim(),
      Ingredienti: String(
        (item as { Ingredienti?: string; ingredienti?: string }).Ingredienti ??
          (item as { ingredienti?: string }).ingredienti ??
          "",
      ).trim(),
      Categoria: String(
        (item as { Categoria?: string; categoria?: string }).Categoria ??
          (item as { categoria?: string }).categoria ??
          "Pizze classiche",
      ).trim(),
      Immagine: String(
        (item as { Immagine?: string; immagine?: string }).Immagine ??
          (item as { immagine?: string }).immagine ??
          "assets/logo1.png",
      ).trim(),
    }))
    .filter((item) => item.Nome.length > 0);
};
