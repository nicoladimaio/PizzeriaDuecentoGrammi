import type {
  MenuImageFit,
  MenuImageMeta,
  MenuImageQualityTier,
} from "@/types/menu-app";

export type AdminMenuItem = {
  id: string;
  nome: string;
  descrizione: string;
  ingredienti: string;
  prezzo: number;
  categoria: string;
  specialita: boolean;
  spiceLevel: number;
  immagine: string;
  immagineThumb: string;
  imageFit?: MenuImageFit;
  imageMeta?: MenuImageMeta;
  ordine: number;
  ingredientIds: string[];
  allergeni: string[];
  visible: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  ordine: number;
  visible: boolean;
};

export type MenuIngredient = {
  id: string;
  name: string;
  ordine: number;
  allergeni: string[];
};

export type AllergenDef = {
  key: string;
  label: string;
};

export type ItemToggleUndoToast = {
  action: "specialty" | "visibility";
  itemId: string;
  itemName: string;
  nextValue: boolean;
  message: string;
};

export type ImageUploadAnalysis = {
  originalWidth: number;
  originalHeight: number;
  originalFileSize: number;
  qualityTier: MenuImageQualityTier;
  warning: string | null;
  needsUpscaling: boolean;
};

export type OptimizedImageUpload = {
  file: File;
  meta: ImageUploadAnalysis & {
    optimizedFileSize: number;
  };
};
