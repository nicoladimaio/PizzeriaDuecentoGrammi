import type { MenuImageFit } from "@/types/menu-app";
import type { AllergenDef } from "@/components/admin-menu/types";

export const ALLERGENS: AllergenDef[] = [
  { key: "glutine", label: "Glutine" },
  { key: "arachidi", label: "Arachidi" },
  { key: "sedano", label: "Sedano" },
  { key: "senape", label: "Senape" },
  { key: "sesamo", label: "Sesamo" },
  { key: "latte", label: "Latte" },
  { key: "uova", label: "Uova" },
  { key: "frutta_guscio", label: "Frutta a guscio" },
  { key: "soia", label: "Soia" },
  { key: "pesce", label: "Pesce" },
  { key: "crostacei", label: "Crostacei" },
  { key: "molluschi", label: "Molluschi" },
  { key: "lupini", label: "Lupini" },
  { key: "solfiti", label: "Solfiti" },
];

export const MENU_DESCRIPTION_MAX_LENGTH = 1200;

export const DEFAULT_MENU_IMAGE_FIT: MenuImageFit = "cover";

export const DEFAULT_MENU_IMAGE = "assets/logo.jpg";

export const MENU_IMAGE_HD_MIN = 1200;

export const MENU_IMAGE_GOOD_MIN = 800;

export const MENU_IMAGE_MAX_SIDE = 1600;

export const MENU_IMAGE_WEBP_QUALITY = 0.82;

export const LOW_QUALITY_IMAGE_WARNING =
  "Questa immagine potrebbe apparire sgranata quando i clienti la visualizzano o la ingrandiscono. Per un risultato migliore consigliamo una foto di almeno 1200×1200 pixel.";
