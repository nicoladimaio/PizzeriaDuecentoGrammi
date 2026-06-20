export type MenuBadgeFlags = {
  special: boolean;
  hot: boolean;
  recent: boolean;
};

export type MenuImageFit = "cover" | "contain";
export type MenuImageQualityTier = "hd" | "good" | "low";

export type MenuImageMeta = {
  originalWidth?: number;
  originalHeight?: number;
  originalFileSize?: number;
  optimizedFileSize?: number;
  qualityTier?: MenuImageQualityTier;
};

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  spiceLevel: number;
  image: string;
  imageThumb?: string;
  imageFit?: MenuImageFit;
  description: string;
  ingredients: string[];
  allergens: string[];
  extras: string[];
  notes: string[];
  badges: MenuBadgeFlags;
};

export type MenuCategory = {
  id: string;
  name: string;
  order: number;
  visible: boolean;
};

export type MenuAllergen = {
  key: string;
  label: string;
};
