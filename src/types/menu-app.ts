export type MenuBadgeFlags = {
  special: boolean;
  hot: boolean;
  recent: boolean;
};

export type MenuProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  spiceLevel: number;
  image: string;
  imageThumb?: string;
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
