"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, DragEvent, SetStateAction, WheelEvent } from "react";
import {
  CeleryIcon,
  CrustaceansIcon,
  EggsIcon,
  FishIcon,
  GlutenIcon,
  LupinsIcon,
  MilkIcon,
  MolluscsIcon,
  MustardIcon,
  PeanutsIcon,
  SesameIcon,
  SoyIcon,
  SulphitesIcon,
  TreeNutsIcon,
} from "@/components/allergens/allergen-icons";
import { SpiceLevelIndicator } from "@/components/spice-level-indicator";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getClientDb, getClientStorage } from "@/lib/firebase";
import type {
  MenuImageFit,
  MenuImageMeta,
  MenuImageQualityTier,
} from "@/types/menu-app";

type AdminMenuItem = {
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

type MenuCategory = {
  id: string;
  name: string;
  ordine: number;
  visible: boolean;
};

type MenuIngredient = {
  id: string;
  name: string;
  ordine: number;
  allergeni: string[];
};

type AllergenDef = {
  key: string;
  label: string;
};

type ItemToggleUndoToast = {
  action: "specialty" | "visibility";
  itemId: string;
  itemName: string;
  nextValue: boolean;
  message: string;
};

type ImageUploadAnalysis = {
  originalWidth: number;
  originalHeight: number;
  originalFileSize: number;
  qualityTier: MenuImageQualityTier;
  warning: string | null;
  needsUpscaling: boolean;
};

type OptimizedImageUpload = {
  file: File;
  meta: ImageUploadAnalysis & {
    optimizedFileSize: number;
  };
};

const ALLERGENS: AllergenDef[] = [
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

const MENU_DESCRIPTION_MAX_LENGTH = 1200;
const DEFAULT_MENU_IMAGE_FIT: MenuImageFit = "cover";
const DEFAULT_MENU_IMAGE = "assets/logo.jpg";
const MENU_IMAGE_HD_MIN = 1200;
const MENU_IMAGE_GOOD_MIN = 800;
const MENU_IMAGE_MAX_SIDE = 1600;
const MENU_IMAGE_WEBP_QUALITY = 0.82;
const LOW_QUALITY_IMAGE_WARNING =
  "Questa immagine potrebbe apparire sgranata quando i clienti la visualizzano o la ingrandiscono. Per un risultato migliore consigliamo una foto di almeno 1200×1200 pixel.";

const normalizeMenuImagePath = (image: string | null | undefined) =>
  image?.trim().replace(/^\/+/, "").toLowerCase() ?? "";

const hasCustomMenuImage = (image: string | null | undefined) => {
  const normalized = normalizeMenuImagePath(image);
  return Boolean(normalized) && normalized !== DEFAULT_MENU_IMAGE.toLowerCase();
};

const getMenuImageQualityTier = (longestSide: number): MenuImageQualityTier => {
  if (longestSide >= MENU_IMAGE_HD_MIN) return "hd";
  if (longestSide >= MENU_IMAGE_GOOD_MIN) return "good";
  return "low";
};

const getMenuImageQualityLabel = (tier: MenuImageQualityTier): string => {
  if (tier === "hd") return "HD";
  if (tier === "good") return "Buona";
  return "Bassa qualita";
};

const getMenuImageMetaFromRaw = (data: Record<string, unknown>): MenuImageMeta => {
  const originalWidth = Number(
    data.imageOriginalWidth ?? data.originalWidth ?? data.immagineLarghezza,
  );
  const originalHeight = Number(
    data.imageOriginalHeight ?? data.originalHeight ?? data.immagineAltezza,
  );
  const originalFileSize = Number(
    data.imageOriginalFileSize ??
      data.originalFileSize ??
      data.immagineDimensioneOriginale,
  );
  const optimizedFileSize = Number(
    data.imageOptimizedFileSize ??
      data.optimizedFileSize ??
      data.immagineDimensioneOttimizzata,
  );
  const qualityTier =
    data.imageQualityTier === "hd" ||
    data.imageQualityTier === "good" ||
    data.imageQualityTier === "low"
      ? data.imageQualityTier
      : undefined;

  return {
    originalWidth: Number.isFinite(originalWidth) && originalWidth > 0
      ? originalWidth
      : undefined,
    originalHeight: Number.isFinite(originalHeight) && originalHeight > 0
      ? originalHeight
      : undefined,
    originalFileSize: Number.isFinite(originalFileSize) && originalFileSize > 0
      ? originalFileSize
      : undefined,
    optimizedFileSize:
      Number.isFinite(optimizedFileSize) && optimizedFileSize > 0
        ? optimizedFileSize
        : undefined,
    qualityTier,
  };
};

const formatBytes = (bytes: number | undefined): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

function AllergenIcon({ type }: { type: string }) {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "glutine":
      return <GlutenIcon aria-hidden {...iconProps} />;
    case "latte":
      return <MilkIcon aria-hidden {...iconProps} />;
    case "arachidi":
      return <PeanutsIcon aria-hidden {...iconProps} />;
    case "sedano":
      return <CeleryIcon aria-hidden {...iconProps} />;
    case "senape":
      return <MustardIcon aria-hidden {...iconProps} />;
    case "sesamo":
      return <SesameIcon aria-hidden {...iconProps} />;
    case "uova":
      return <EggsIcon aria-hidden {...iconProps} />;
    case "frutta_guscio":
      return <TreeNutsIcon aria-hidden {...iconProps} />;
    case "soia":
      return <SoyIcon aria-hidden {...iconProps} />;
    case "pesce":
      return <FishIcon aria-hidden {...iconProps} />;
    case "crostacei":
      return <CrustaceansIcon aria-hidden {...iconProps} />;
    case "molluschi":
      return <MolluscsIcon aria-hidden {...iconProps} />;
    case "lupini":
      return <LupinsIcon aria-hidden {...iconProps} />;
    case "solfiti":
      return <SulphitesIcon aria-hidden {...iconProps} />;
    default:
      return <SesameIcon aria-hidden {...iconProps} />;
  }
}

function VisibilityIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M2.2 12s3.6-5.7 9.8-5.7 9.8 5.7 9.8 5.7-3.6 5.7-9.8 5.7S2.2 12 2.2 12z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2.2 12s3.6-5.7 9.8-5.7 9.8 5.7 9.8 5.7-3.6 5.7-9.8 5.7S2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="2.8" />
      <path d="M4 20L20 4" />
    </svg>
  );
}

const toString = (value: unknown): string => String(value ?? "").trim();

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => toString(entry))
    .filter((entry) => entry.length > 0);
};

const uniqueInsensitive = (values: string[]): string[] => {
  const out: string[] = [];
  values.forEach((value) => {
    if (!out.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
      out.push(value);
    }
  });
  return out;
};

const normalizePrice = (value: unknown): number | null => {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
};

const formatPriceDraft = (value: string): string => {
  const sanitized = value.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [integerPartRaw = "", ...decimalsRaw] = sanitized.split(",");
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "");
  const decimals = decimalsRaw.join("").slice(0, 2);

  if (sanitized.includes(",")) {
    return `${integerPart || "0"},${decimals}`;
  }

  return integerPart;
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

const getSpiceLabel = (level: number): string => {
  if (level <= 0) return "";
  if (level === 1) return "Poco piccante";
  if (level === 2) return "Piccante";
  return "Molto piccante";
};

const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

const loadImageFromUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossibile leggere l'immagine."));
    image.src = url;
  });

const analyzeImageFile = async (file: File): Promise<ImageUploadAnalysis> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Il file selezionato non e un'immagine valida.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(objectUrl);
    const originalWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const originalHeight = Math.max(1, image.naturalHeight || image.height || 1);
    const longestSide = Math.max(originalWidth, originalHeight);
    const qualityTier = getMenuImageQualityTier(longestSide);
    const needsUpscaling = longestSide < MENU_IMAGE_GOOD_MIN;

    return {
      originalWidth,
      originalHeight,
      originalFileSize: file.size,
      qualityTier,
      warning: needsUpscaling ? LOW_QUALITY_IMAGE_WARNING : null,
      needsUpscaling,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const maybeApplyFutureUpscaling = async (
  file: File,
  analysis: ImageUploadAnalysis,
): Promise<File> => {
  // Hook pronto per un futuro passaggio automatico di upscaling AI.
  void analysis;
  return file;
};

const optimizeImageForUpload = async (
  file: File,
  analysis: ImageUploadAnalysis,
): Promise<OptimizedImageUpload> => {
  const source = await maybeApplyFutureUpscaling(file, analysis);
  const objectUrl = URL.createObjectURL(source);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1);
    const scale = Math.min(
      1,
      MENU_IMAGE_MAX_SIDE / Math.max(sourceWidth, sourceHeight),
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return {
        file: source,
        meta: {
          ...analysis,
          optimizedFileSize: source.size,
        },
      };
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", MENU_IMAGE_WEBP_QUALITY);
    });
    if (!blob) {
      return {
        file: source,
        meta: {
          ...analysis,
          optimizedFileSize: source.size,
        },
      };
    }

    const baseName = sanitizeFileName(source.name).replace(/\.[^.]+$/, "");
    const finalName = `${baseName || `menu-${Date.now()}`}.webp`;
    const optimizedFile = new File([blob], finalName, {
      type: "image/webp",
      lastModified: Date.now(),
    });
    return {
      file: optimizedFile,
      meta: {
        ...analysis,
        optimizedFileSize: optimizedFile.size,
      },
    };
  } catch {
    return {
      file: source,
      meta: {
        ...analysis,
        optimizedFileSize: source.size,
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const reorderIds = (ids: string[], movingId: string, targetId: string) => {
  if (movingId === targetId) return ids;
  const next = [...ids];
  const from = next.indexOf(movingId);
  const to = next.indexOf(targetId);
  if (from < 0 || to < 0) return ids;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const setReorderDragGhost = (event: DragEvent<HTMLElement>, title: string) => {
  if (!event.dataTransfer) return;

  const ghost = document.createElement("div");
  ghost.className = "reorder-drag-ghost";
  ghost.textContent = title;
  document.body.appendChild(ghost);

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", title);
  event.dataTransfer.setDragImage(ghost, 14, 12);

  window.setTimeout(() => {
    ghost.remove();
  }, 0);
};

const toggleInArray = (arr: string[], value: string): string[] => {
  const exists = arr.includes(value);
  if (exists) return arr.filter((entry) => entry !== value);
  return [...arr, value];
};

export function AdminMenuPanel() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [ingredients, setIngredients] = useState<MenuIngredient[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [itemToggleUndoToast, setItemToggleUndoToast] =
    useState<ItemToggleUndoToast | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");

  const [menuSubview, setMenuSubview] = useState<"dishes" | "ingredients">(
    "dishes",
  );
  const [activeCategory, setActiveCategory] = useState<string>("");
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);

  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(
    null,
  );
  const [draggingModalCategoryId, setDraggingModalCategoryId] = useState<
    string | null
  >(null);
  const [draggingReorderItemId, setDraggingReorderItemId] = useState<
    string | null
  >(null);
  const [reorderDropTargetId, setReorderDropTargetId] = useState<string | null>(
    null,
  );
  const itemToggleUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showReorderMode, setShowReorderMode] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(
    null,
  );

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>(
    {},
  );

  const [showAllergenFilters, setShowAllergenFilters] = useState(false);
  const [selectedAllergenFilters, setSelectedAllergenFilters] = useState<
    string[]
  >([]);

  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientAllergens, setNewIngredientAllergens] = useState<
    string[]
  >([]);
  const [ingredientEditName, setIngredientEditName] = useState("");
  const [ingredientEditAllergens, setIngredientEditAllergens] = useState<
    string[]
  >([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemSpecial, setNewItemSpecial] = useState(false);
  const [newItemImageFit, setNewItemImageFit] =
    useState<MenuImageFit>(DEFAULT_MENU_IMAGE_FIT);
  const [newItemSpiceLevel, setNewItemSpiceLevel] = useState(0);
  const [newItemIngredientIds, setNewItemIngredientIds] = useState<string[]>(
    [],
  );
  const [newItemAllergens, setNewItemAllergens] = useState<string[]>([]);
  const [showNewIngredientResults, setShowNewIngredientResults] =
    useState(false);
  const [newIngredientSearch, setNewIngredientSearch] = useState("");
  const [draggingNewIngredientId, setDraggingNewIngredientId] = useState<
    string | null
  >(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageAnalysis, setNewImageAnalysis] =
    useState<ImageUploadAnalysis | null>(null);
  const [newImageDragActive, setNewImageDragActive] = useState(false);
  const [dishCreatedToast, setDishCreatedToast] = useState<string | null>(null);
  const [newDishActiveTab, setNewDishActiveTab] = useState<
    "identity" | "ingredients" | "image"
  >("identity");
  const [newDishIdentityOpen, setNewDishIdentityOpen] = useState(true);
  const [newDishIngredientsOpen, setNewDishIngredientsOpen] = useState(false);
  const [newDishImageOpen, setNewDishImageOpen] = useState(false);
  const [showNewExtraAllergensPanel, setShowNewExtraAllergensPanel] =
    useState(false);
  const [showMobilePhotoPicker, setShowMobilePhotoPicker] = useState(false);

  const [editItemName, setEditItemName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemSpecial, setEditItemSpecial] = useState(false);
  const [editItemImageFit, setEditItemImageFit] =
    useState<MenuImageFit>(DEFAULT_MENU_IMAGE_FIT);
  const [editItemSpiceLevel, setEditItemSpiceLevel] = useState(0);
  const [editItemIngredientIds, setEditItemIngredientIds] = useState<string[]>(
    [],
  );
  const [editItemAllergens, setEditItemAllergens] = useState<string[]>([]);
  const [showEditIngredientResults, setShowEditIngredientResults] =
    useState(false);
  const [editIngredientSearch, setEditIngredientSearch] = useState("");
  const [draggingEditIngredientId, setDraggingEditIngredientId] = useState<
    string | null
  >(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImageAnalysis, setEditImageAnalysis] =
    useState<ImageUploadAnalysis | null>(null);

  const [showQuickIngredientCreate, setShowQuickIngredientCreate] =
    useState(false);
  const [quickIngredientName, setQuickIngredientName] = useState("");
  const [quickIngredientAllergens, setQuickIngredientAllergens] = useState<
    string[]
  >([]);
  const [quickIngredientTarget, setQuickIngredientTarget] = useState<
    "new" | "edit"
  >("new");
  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  const newImageCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showReorderMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowReorderMode(false);
      setReorderDropTargetId(null);
      setDraggingReorderItemId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showReorderMode]);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(collection(db, "menu_items"), (snapshot) => {
      const next = snapshot.docs
        .map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            nome: toString(data.nome ?? data.Nome),
            descrizione: toString(data.descrizione ?? data.Descrizione),
            ingredienti: toString(data.ingredienti ?? data.Ingredienti),
            prezzo: normalizePrice(data.prezzo ?? data.Prezzo) ?? 0,
            categoria: toString(
              (data.categoria ?? data.Categoria) || "Pizze classiche",
            ),
            specialita: Boolean(data.specialita ?? data.special),
            spiceLevel: extractSpiceLevelFromRaw(
              data as Record<string, unknown>,
            ),
            immagine: toString(
              (data.immagine ?? data.Immagine) || DEFAULT_MENU_IMAGE,
            ),
            immagineThumb: toString(
              (data.immagineThumb ?? data.ImmagineThumb ?? data.imageThumb) ||
                (data.immagine ?? data.Immagine) ||
                DEFAULT_MENU_IMAGE,
            ),
            imageFit:
              data.imageFit === "contain" || data.imageFit === "cover"
                ? data.imageFit
                : DEFAULT_MENU_IMAGE_FIT,
            imageMeta: getMenuImageMetaFromRaw(data as Record<string, unknown>),
            ordine: Number.isFinite(Number(data.ordine))
              ? Number(data.ordine)
              : Number.isFinite(Number(data.order))
                ? Number(data.order)
                : 9999,
            ingredientIds: uniqueInsensitive(
              parseStringArray(data.ingredientIds ?? data.ingredientiIds),
            ),
            allergeni: uniqueInsensitive(
              parseStringArray(data.allergeni ?? data.allergens),
            ),
            visible:
              typeof data.visible === "boolean"
                ? data.visible
                : typeof data.visibile === "boolean"
                  ? data.visibile
                  : true,
          };
        })
        .filter((item) => item.nome.length > 0)
        .sort((a, b) => {
          const categoryDiff = a.categoria.localeCompare(b.categoria, "it");
          if (categoryDiff !== 0) return categoryDiff;
          const orderDiff = a.ordine - b.ordine;
          if (orderDiff !== 0) return orderDiff;
          return a.nome.localeCompare(b.nome, "it");
        });

      setItems(next);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_categories"),
      (snapshot) => {
        const next = snapshot.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: toString(data.name ?? data.nome),
              ordine: Number.isFinite(Number(data.ordine))
                ? Number(data.ordine)
                : Number.isFinite(Number(data.order))
                  ? Number(data.order)
                  : 9999,
              visible:
                typeof data.visible === "boolean"
                  ? data.visible
                  : typeof data.visibile === "boolean"
                    ? data.visibile
                    : true,
            };
          })
          .filter((item) => item.name.length > 0)
          .sort((a, b) => {
            const orderDiff = a.ordine - b.ordine;
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, "it");
          });

        setCategories(next);
        setCategoryDrafts((prev) => {
          const updated: Record<string, string> = {};
          next.forEach((item) => {
            updated[item.id] = prev[item.id] ?? item.name;
          });
          return updated;
        });
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_ingredients"),
      (snapshot) => {
        const next = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              name: toString(data.name ?? data.nome),
              ordine: Number.isFinite(Number(data.ordine))
                ? Number(data.ordine)
                : Number.isFinite(Number(data.order))
                  ? Number(data.order)
                  : 9999,
              allergeni: uniqueInsensitive(
                parseStringArray(data.allergeni ?? data.allergens),
              ),
            };
          })
          .filter((entry) => entry.name.length > 0)
          .sort((a, b) => a.name.localeCompare(b.name, "it"));

        setIngredients(next);
      },
    );

    return () => unsubscribe();
  }, []);

  const categoryNames = useMemo(
    () => categories.map((category) => category.name),
    [categories],
  );

  const categoryVisibilityByName = useMemo(() => {
    const map: Record<string, boolean> = {};
    categories.forEach((category) => {
      map[category.name.toLowerCase()] = category.visible;
    });
    return map;
  }, [categories]);

  const ingredientMap = useMemo(() => {
    const map: Record<string, MenuIngredient> = {};
    ingredients.forEach((entry) => {
      map[entry.id] = entry;
    });
    return map;
  }, [ingredients]);

  const allergenMap = useMemo(() => {
    const map: Record<string, AllergenDef> = {};
    ALLERGENS.forEach((entry) => {
      map[entry.key] = entry;
    });
    return map;
  }, []);

  const visibleCategories = useMemo(() => {
    const fromItems = items
      .map((item) => item.categoria)
      .filter((name) => name.length > 0)
      .filter(
        (name, index, arr) =>
          arr.findIndex(
            (entry) => entry.toLowerCase() === name.toLowerCase(),
          ) === index,
      );

    const merged = [...categoryNames];
    fromItems.forEach((entry) => {
      const exists = merged.some(
        (category) => category.toLowerCase() === entry.toLowerCase(),
      );
      if (!exists) merged.push(entry);
    });

    return merged;
  }, [categoryNames, items]);

  useEffect(() => {
    if (visibleCategories.length === 0) {
      setActiveCategory("");
      return;
    }

    const exists = visibleCategories.some(
      (entry) => entry.toLowerCase() === activeCategory.toLowerCase(),
    );
    if (!exists) setActiveCategory(visibleCategories[0]);
  }, [visibleCategories, activeCategory]);

  useEffect(() => {
    if (!showItemModal) return;
    if (newItemCategory) return;

    if (activeCategory) {
      setNewItemCategory(activeCategory);
      return;
    }

    const firstVisibleCategory = categories.find(
      (category) => category.visible,
    )?.name;
    if (firstVisibleCategory) {
      setNewItemCategory(firstVisibleCategory);
      return;
    }

    setNewItemCategory(categoryNames[0] ?? "");
  }, [
    showItemModal,
    newItemCategory,
    categories,
    activeCategory,
    categoryNames,
  ]);

  useEffect(() => {
    if (showItemModal) return;
    setShowNewIngredientResults(false);
    setNewIngredientSearch("");
    setDraggingNewIngredientId(null);
  }, [showItemModal]);

  useEffect(() => {
    if (editingItemId) return;
    setShowEditIngredientResults(false);
    setEditIngredientSearch("");
    setDraggingEditIngredientId(null);
  }, [editingItemId]);

  const itemsByCategory = useMemo(() => {
    return items.reduce<Record<string, AdminMenuItem[]>>((acc, item) => {
      const key = item.categoria || "Altro";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const visibleItems = useMemo(() => {
    const list = itemsByCategory[activeCategory] ?? [];
    return [...list].sort((a, b) => {
      const orderDiff = a.ordine - b.ordine;
      if (orderDiff !== 0) return orderDiff;
      return a.nome.localeCompare(b.nome, "it");
    });
  }, [itemsByCategory, activeCategory]);

  const filteredIngredients = useMemo(() => {
    let result = ingredients;

    if (selectedAllergenFilters.length > 0) {
      result = result.filter((ingredient) =>
        ingredient.allergeni.some((key) =>
          selectedAllergenFilters.includes(key),
        ),
      );
    }

    const query = ingredientSearch.trim().toLowerCase();

    if (query) {
      result = result.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(query),
      );
    }

    return result;
  }, [ingredients, selectedAllergenFilters, ingredientSearch]);

  const selectableCategories = useMemo(
    () => categories.filter((category) => category.visible),
    [categories],
  );

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) ?? null,
    [items, editingItemId],
  );

  const filteredNewIngredientOptions = useMemo(() => {
    const query = newIngredientSearch.trim().toLowerCase();
    if (!query) return ingredients;
    return ingredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query),
    );
  }, [ingredients, newIngredientSearch]);

  const newIngredientExactMatch = useMemo(() => {
    const query = newIngredientSearch.trim().toLowerCase();
    if (!query) return null;
    return (
      ingredients.find(
        (ingredient) => ingredient.name.toLowerCase() === query,
      ) ?? null
    );
  }, [ingredients, newIngredientSearch]);

  const filteredEditIngredientOptions = useMemo(() => {
    const query = editIngredientSearch.trim().toLowerCase();
    if (!query) return ingredients;
    return ingredients.filter((ingredient) =>
      ingredient.name.toLowerCase().includes(query),
    );
  }, [ingredients, editIngredientSearch]);

  const editIngredientExactMatch = useMemo(() => {
    const query = editIngredientSearch.trim().toLowerCase();
    if (!query) return null;
    return (
      ingredients.find(
        (ingredient) => ingredient.name.toLowerCase() === query,
      ) ?? null
    );
  }, [ingredients, editIngredientSearch]);

  const newDetectedAllergenKeys = useMemo(
    () => inferAllergensFromIngredientIds(newItemIngredientIds),
    [newItemIngredientIds, ingredientMap],
  );

  const newSelectableExtraAllergens = useMemo(
    () =>
      ALLERGENS.filter(
        (allergen) => !newDetectedAllergenKeys.includes(allergen.key),
      ),
    [newDetectedAllergenKeys],
  );

  const editDetectedAllergenKeys = useMemo(
    () => inferAllergensFromIngredientIds(editItemIngredientIds),
    [editItemIngredientIds, ingredientMap],
  );

  const editSelectableExtraAllergens = useMemo(
    () =>
      ALLERGENS.filter(
        (allergen) => !editDetectedAllergenKeys.includes(allergen.key),
      ),
    [editDetectedAllergenKeys],
  );

  const newImagePreview = useMemo(() => {
    if (!newImageFile) return "";
    return URL.createObjectURL(newImageFile);
  }, [newImageFile]);
  const hasNewImage = Boolean(newImagePreview);

  const editImagePreview = useMemo(() => {
    if (!editImageFile) return "";
    return URL.createObjectURL(editImageFile);
  }, [editImageFile]);
  const editItemHasSavedImage = editingItem
    ? hasCustomMenuImage(editingItem.immagine)
    : false;
  const hasEditImage = Boolean(editImagePreview) || editItemHasSavedImage;
  const editingItemMeta = editingItem?.imageMeta;

  const onNewImageChange = async (file: File | null) => {
    setNewImageFile(file);
    setNewImageDragActive(false);
    setShowMobilePhotoPicker(false);
    if (!file) {
      setNewImageAnalysis(null);
      return;
    }
    try {
      setError(null);
      setNewImageAnalysis(await analyzeImageFile(file));
    } catch {
      setNewImageAnalysis(null);
      setError("Impossibile leggere i dettagli dell'immagine selezionata.");
    }
  };

  const onEditImageChange = async (file: File | null) => {
    setEditImageFile(file);
    if (!file) {
      setEditImageAnalysis(null);
      return;
    }
    try {
      setError(null);
      setEditImageAnalysis(await analyzeImageFile(file));
    } catch {
      setEditImageAnalysis(null);
      setError("Impossibile leggere i dettagli dell'immagine selezionata.");
    }
  };

  const clearItemToggleUndoTimer = () => {
    if (itemToggleUndoTimerRef.current) {
      clearTimeout(itemToggleUndoTimerRef.current);
      itemToggleUndoTimerRef.current = null;
    }
  };

  const dismissItemToggleUndoToast = () => {
    clearItemToggleUndoTimer();
    setItemToggleUndoToast(null);
  };

  const showItemToggleUndoToast = (toast: ItemToggleUndoToast) => {
    clearItemToggleUndoTimer();
    setItemToggleUndoToast(toast);
    itemToggleUndoTimerRef.current = setTimeout(() => {
      setItemToggleUndoToast(null);
      itemToggleUndoTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    };
  }, [newImagePreview]);

  useEffect(() => {
    return () => {
      if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    };
  }, [editImagePreview]);

  useEffect(() => {
    return () => {
      clearItemToggleUndoTimer();
    };
  }, []);

  useEffect(() => {
    if (!dishCreatedToast) return;

    const timer = window.setTimeout(() => {
      setDishCreatedToast(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [dishCreatedToast]);

  useEffect(() => {
    setNewDishIdentityOpen(newDishActiveTab === "identity");
    setNewDishIngredientsOpen(newDishActiveTab === "ingredients");
    setNewDishImageOpen(newDishActiveTab === "image");
  }, [newDishActiveTab]);

  const uploadImage = async (
    file: File,
  ): Promise<{ imageUrl: string; thumbUrl: string; meta: MenuImageMeta }> => {
    const analysis = await analyzeImageFile(file);
    const optimized = await optimizeImageForUpload(file, analysis);
    const storage = getClientStorage();
    const ts = Date.now();
    const fullPath = `menu-items/${ts}-${sanitizeFileName(optimized.file.name)}`;
    const imageRef = ref(storage, fullPath);
    await uploadBytes(imageRef, optimized.file, {
      contentType: optimized.file.type || "image/webp",
      cacheControl: "public,max-age=31536000,immutable",
    });
    const imageUrl = await getDownloadURL(imageRef);
    return {
      imageUrl,
      thumbUrl: imageUrl,
      meta: {
        originalWidth: optimized.meta.originalWidth,
        originalHeight: optimized.meta.originalHeight,
        originalFileSize: optimized.meta.originalFileSize,
        optimizedFileSize: optimized.meta.optimizedFileSize,
        qualityTier: optimized.meta.qualityTier,
      },
    };
  };

  const ensureCategoryExists = async (name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    const exists = categoryNames.some(
      (entry) => entry.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return;

    const db = getClientDb();
    await addDoc(collection(db, "menu_categories"), {
      name: normalized,
      ordine: categories.length,
      visible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const getIngredientNames = (ids: string[]): string[] =>
    ids
      .map((id) => ingredientMap[id]?.name ?? "")
      .filter((name) => name.length > 0);

  const buildIngredientText = (ids: string[]): string => {
    const fromSelection = getIngredientNames(ids);
    return fromSelection.join(", ");
  };

  function inferAllergensFromIngredientIds(ids: string[]): string[] {
    const inferred = ids.flatMap((id) => ingredientMap[id]?.allergeni ?? []);
    return uniqueInsensitive(inferred);
  }

  const addIngredientFromQuery = (
    query: string,
    selectedIds: string[],
    setSelectedIds: Dispatch<SetStateAction<string[]>>,
    target: "new" | "edit",
  ): "added" | "create" | "noop" => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return "noop";

    const exact = ingredients.find(
      (ingredient) => ingredient.name.toLowerCase() === normalized,
    );
    if (!exact) {
      openQuickCreateIngredient(query, target);
      return "create";
    }

    if (selectedIds.includes(exact.id)) return "noop";

    setSelectedIds((prev) => [...prev, exact.id]);
    return "added";
  };

  const addAllergenFromQuery = (
    query: string,
    selectedKeys: string[],
    setSelectedKeys: Dispatch<SetStateAction<string[]>>,
  ) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    const exact = ALLERGENS.find(
      (allergen) => allergen.label.toLowerCase() === normalized,
    );
    const firstMatch =
      exact ??
      ALLERGENS.find((allergen) =>
        allergen.label.toLowerCase().includes(normalized),
      );
    if (!firstMatch) return;
    if (selectedKeys.includes(firstMatch.key)) return;

    setSelectedKeys((prev) => [...prev, firstMatch.key]);
  };

  const saveNewIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    if (newIngredientName.trim().length < 2) {
      setBusy(false);
      setError("L'ingrediente deve contenere almeno 2 caratteri.");
      return;
    }

    try {
      const db = getClientDb();
      const already = ingredients.find(
        (entry) =>
          entry.name.toLowerCase() === newIngredientName.trim().toLowerCase(),
      );
      if (already) {
        setError("Ingrediente gia presente.");
        setBusy(false);
        return;
      }

      await addDoc(collection(db, "menu_ingredients"), {
        name: newIngredientName.trim(),
        ordine: ingredients.length,
        allergeni: uniqueInsensitive(newIngredientAllergens),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setShowIngredientModal(false);
      setNewIngredientName("");
      setNewIngredientAllergens([]);
      setFeedback("Ingrediente aggiunto.");
    } catch {
      setError("Errore durante aggiunta ingrediente.");
    } finally {
      setBusy(false);
    }
  };

  const openIngredientEdit = (ingredient: MenuIngredient) => {
    setEditingIngredientId(ingredient.id);
    setIngredientEditName(ingredient.name);
    setIngredientEditAllergens(ingredient.allergeni);
    setError(null);
    setFeedback(null);
  };

  const saveIngredientEdit = async () => {
    if (!editingIngredientId) return;
    if (ingredientEditName.trim().length < 2) {
      setError("L'ingrediente deve contenere almeno 2 caratteri.");
      return;
    }

    setSavingId(editingIngredientId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_ingredients", editingIngredientId), {
        name: ingredientEditName.trim(),
        allergeni: uniqueInsensitive(ingredientEditAllergens),
        updatedAt: new Date().toISOString(),
      });
      setEditingIngredientId(null);
      setIngredientEditName("");
      setIngredientEditAllergens([]);
      setFeedback("Ingrediente aggiornato.");
    } catch {
      setError("Errore durante modifica ingrediente.");
    } finally {
      setSavingId(null);
    }
  };

  const removeIngredient = async (ingredientId: string) => {
    const inUse = items.some((item) =>
      item.ingredientIds.includes(ingredientId),
    );
    if (inUse) {
      setError("Ingrediente in uso nei piatti. Rimuovilo prima dai piatti.");
      return;
    }

    setSavingId(ingredientId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await deleteDoc(doc(db, "menu_ingredients", ingredientId));
      setFeedback("Ingrediente eliminato.");
    } catch {
      setError("Errore durante eliminazione ingrediente.");
    } finally {
      setSavingId(null);
    }
  };

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    if (newCategoryName.trim().length < 2) {
      setBusy(false);
      setError("La categoria deve contenere almeno 2 caratteri.");
      return;
    }

    try {
      const normalized = newCategoryName.trim();
      await ensureCategoryExists(normalized);
      setActiveCategory(normalized);
      setNewCategoryName("");
      setShowCategoryModal(false);
      setFeedback("Categoria salvata.");
    } catch {
      setError("Errore durante il salvataggio categoria.");
    } finally {
      setBusy(false);
    }
  };

  const renameCategory = async (categoryId: string) => {
    const name = toString(categoryDrafts[categoryId]);
    if (name.length < 2) {
      setError("La categoria deve contenere almeno 2 caratteri.");
      return;
    }

    setSavingId(categoryId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_categories", categoryId), {
        name,
        updatedAt: new Date().toISOString(),
      });
      setFeedback("Categoria aggiornata.");
    } catch {
      setError("Errore durante modifica categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleCategoryVisibility = async (category: MenuCategory) => {
    setSavingId(category.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "menu_categories", category.id), {
        visible: !category.visible,
        updatedAt: new Date().toISOString(),
      });
      setFeedback("Visibilita categoria aggiornata.");
    } catch {
      setError("Errore durante aggiornamento visibilita categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const removeCategory = async (category: MenuCategory) => {
    const used = items.some(
      (item) => item.categoria.toLowerCase() === category.name.toLowerCase(),
    );
    if (used) {
      setError("Categoria in uso nel menu. Modifica prima i piatti associati.");
      return;
    }

    setSavingId(category.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await deleteDoc(doc(db, "menu_categories", category.id));
      setFeedback("Categoria eliminata.");
    } catch {
      setError("Errore durante eliminazione categoria.");
    } finally {
      setSavingId(null);
    }
  };

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);

    const prezzo = normalizePrice(newItemPrice);
    const categoria = newItemCategory.trim();

    if (newItemName.trim().length < 2) {
      setBusy(false);
      setError("Il nome deve contenere almeno 2 caratteri.");
      return;
    }

    if (!categoria) {
      setBusy(false);
      setError("La categoria e obbligatoria.");
      return;
    }

    if (prezzo === null) {
      setBusy(false);
      setError("Prezzo non valido. Usa solo numeri, es. 8,50.");
      return;
    }

    const ingredientIds = uniqueInsensitive(newItemIngredientIds);

    try {
      const db = getClientDb();
      await ensureCategoryExists(categoria);
      const uploaded = newImageFile ? await uploadImage(newImageFile) : null;
      const uploadedImage = uploaded?.imageUrl ?? DEFAULT_MENU_IMAGE;
      const uploadedThumb = uploaded?.thumbUrl ?? uploadedImage;

      const currentCategoryItems = items.filter(
        (item) => item.categoria.toLowerCase() === categoria.toLowerCase(),
      );

      const inferredAllergens = inferAllergensFromIngredientIds(ingredientIds);
      const allergeni = uniqueInsensitive([
        ...inferredAllergens,
        ...newItemAllergens,
      ]);
      const ingredientiText = buildIngredientText(ingredientIds);

      await addDoc(collection(db, "menu_items"), {
        nome: newItemName.trim(),
        descrizione: newItemDescription.trim(),
        ingredienti: ingredientiText,
        prezzo,
        categoria,
        specialita: newItemSpecial,
        special: newItemSpecial,
        piccantezza: newItemSpiceLevel,
        spiceLevel: newItemSpiceLevel,
        immagine: uploadedImage,
        immagineThumb: uploadedThumb,
        imageFit: newItemImageFit,
        imageOriginalWidth: uploaded?.meta.originalWidth ?? null,
        imageOriginalHeight: uploaded?.meta.originalHeight ?? null,
        imageOriginalFileSize: uploaded?.meta.originalFileSize ?? null,
        imageOptimizedFileSize: uploaded?.meta.optimizedFileSize ?? null,
        imageQualityTier: uploaded?.meta.qualityTier ?? null,
        ordine: currentCategoryItems.length,
        ingredientIds,
        allergeni,
        visible: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setNewItemName("");
      setNewItemDescription("");
      setNewItemPrice("");
      setNewItemCategory(categoria);
      setNewItemSpecial(false);
      setNewItemImageFit(DEFAULT_MENU_IMAGE_FIT);
      setNewItemSpiceLevel(0);
      setNewItemIngredientIds([]);
      setNewItemAllergens([]);
      setNewImageFile(null);
      setNewImageAnalysis(null);
      setNewImageDragActive(false);
      setShowItemModal(false);
      setFeedback("Piatto aggiunto.");
      setDishCreatedToast("Piatto aggiunto");
    } catch {
      setError("Errore durante il salvataggio del piatto.");
    } finally {
      setBusy(false);
    }
  };

  const openEditItem = (item: AdminMenuItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.nome);
    setEditItemDescription(item.descrizione ?? "");
    setEditItemPrice(String(item.prezzo));
    setEditItemCategory(item.categoria);
    setEditItemSpecial(item.specialita ?? false);
    setEditItemImageFit(item.imageFit ?? DEFAULT_MENU_IMAGE_FIT);
    setEditItemSpiceLevel(item.spiceLevel ?? 0);
    setEditItemIngredientIds(item.ingredientIds);
    const detected = inferAllergensFromIngredientIds(item.ingredientIds);
    setEditItemAllergens(
      item.allergeni.filter((key) => !detected.includes(key)),
    );
    setShowEditIngredientResults(false);
    setEditIngredientSearch("");
    setDraggingEditIngredientId(null);
    setEditImageFile(null);
    setEditImageAnalysis(null);
    setError(null);
    setFeedback(null);
  };

  const saveEditedItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingItemId || !editingItem) return;

    const prezzo = normalizePrice(editItemPrice);

    if (editItemName.trim().length < 2) {
      setError("Il nome deve contenere almeno 2 caratteri.");
      return;
    }

    if (!editItemCategory.trim()) {
      setError("La categoria e obbligatoria.");
      return;
    }

    if (prezzo === null) {
      setError("Prezzo non valido. Usa solo numeri, es. 8.50.");
      return;
    }

    const ingredientIds = uniqueInsensitive(editItemIngredientIds);

    setSavingId(editingItemId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      const uploaded = editImageFile ? await uploadImage(editImageFile) : null;
      const uploadedImage =
        uploaded?.imageUrl || editingItem.immagine || DEFAULT_MENU_IMAGE;
      const uploadedThumb =
        uploaded?.thumbUrl ??
        editingItem.immagineThumb ??
        editingItem.immagine ??
        DEFAULT_MENU_IMAGE;

      const inferredAllergens = inferAllergensFromIngredientIds(ingredientIds);
      const allergeni = uniqueInsensitive([
        ...inferredAllergens,
        ...editItemAllergens,
      ]);
      const ingredientiText = buildIngredientText(ingredientIds);

      await updateDoc(doc(db, "menu_items", editingItemId), {
        nome: editItemName.trim(),
        descrizione: editItemDescription.trim(),
        ingredienti: ingredientiText,
        prezzo,
        categoria: editItemCategory.trim(),
        specialita: editItemSpecial,
        special: editItemSpecial,
        piccantezza: editItemSpiceLevel,
        spiceLevel: editItemSpiceLevel,
        immagine: uploadedImage,
        immagineThumb: uploadedThumb,
        imageFit: editItemImageFit,
        imageOriginalWidth:
          uploaded?.meta.originalWidth ??
          editingItem.imageMeta?.originalWidth ??
          null,
        imageOriginalHeight:
          uploaded?.meta.originalHeight ??
          editingItem.imageMeta?.originalHeight ??
          null,
        imageOriginalFileSize:
          uploaded?.meta.originalFileSize ??
          editingItem.imageMeta?.originalFileSize ??
          null,
        imageOptimizedFileSize:
          uploaded?.meta.optimizedFileSize ??
          editingItem.imageMeta?.optimizedFileSize ??
          null,
        imageQualityTier:
          uploaded?.meta.qualityTier ??
          editingItem.imageMeta?.qualityTier ??
          null,
        ingredientIds,
        allergeni,
        updatedAt: new Date().toISOString(),
      });

      setEditingItemId(null);
      setEditImageFile(null);
      setEditImageAnalysis(null);
      setEditItemSpecial(false);
      setEditItemImageFit(DEFAULT_MENU_IMAGE_FIT);
      setEditItemSpiceLevel(0);
      setEditItemIngredientIds([]);
      setEditItemAllergens([]);
      setFeedback("Piatto aggiornato.");
    } catch {
      setError("Errore durante il salvataggio della modifica.");
    } finally {
      setSavingId(null);
    }
  };

  const openQuickCreateIngredient = (name: string, target: "new" | "edit") => {
    setQuickIngredientName(name.trim());
    setQuickIngredientAllergens([]);
    setQuickIngredientTarget(target);
    setShowQuickIngredientCreate(true);
  };

  const saveQuickIngredient = async () => {
    const normalized = quickIngredientName.trim();
    if (normalized.length < 2) {
      setError("L'ingrediente deve contenere almeno 2 caratteri.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const existing = ingredients.find(
        (entry) => entry.name.toLowerCase() === normalized.toLowerCase(),
      );

      if (existing) {
        if (quickIngredientTarget === "new") {
          setNewItemIngredientIds((prev) => toggleInArray(prev, existing.id));
          setShowNewIngredientResults(false);
          setNewIngredientSearch("");
        } else {
          setEditItemIngredientIds((prev) => toggleInArray(prev, existing.id));
          setShowEditIngredientResults(false);
          setEditIngredientSearch("");
        }
        setShowQuickIngredientCreate(false);
        return;
      }

      const db = getClientDb();
      const created = await addDoc(collection(db, "menu_ingredients"), {
        name: normalized,
        ordine: ingredients.length,
        allergeni: uniqueInsensitive(quickIngredientAllergens),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (quickIngredientTarget === "new") {
        setNewItemIngredientIds((prev) => toggleInArray(prev, created.id));
        setShowNewIngredientResults(false);
        setNewIngredientSearch("");
      } else {
        setEditItemIngredientIds((prev) => toggleInArray(prev, created.id));
        setShowEditIngredientResults(false);
        setEditIngredientSearch("");
      }

      setShowQuickIngredientCreate(false);
      setQuickIngredientName("");
      setQuickIngredientAllergens([]);
      setFeedback("Ingrediente creato e selezionato.");
    } catch {
      setError("Errore durante creazione ingrediente.");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setSavingId(itemId);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      await deleteDoc(doc(db, "menu_items", itemId));
      setFeedback("Piatto eliminato.");
    } catch {
      setError("Errore durante la rimozione del piatto.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleItemVisibility = async (item: AdminMenuItem) => {
    setSavingId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      const nextVisible = !item.visible;
      await updateDoc(doc(db, "menu_items", item.id), {
        visible: nextVisible,
        updatedAt: new Date().toISOString(),
      });
      showItemToggleUndoToast({
        action: "visibility",
        itemId: item.id,
        itemName: item.nome,
        nextValue: nextVisible,
        message: nextVisible
          ? `${item.nome} e visibile nel menu.`
          : `${item.nome} e nascosto nel menu.`,
      });
    } catch {
      setError("Errore durante aggiornamento visibilita.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleItemSpecialty = async (item: AdminMenuItem) => {
    setSavingId(item.id);
    setError(null);
    setFeedback(null);
    try {
      const db = getClientDb();
      const nextSpecial = !item.specialita;
      await updateDoc(doc(db, "menu_items", item.id), {
        specialita: nextSpecial,
        special: nextSpecial,
        updatedAt: new Date().toISOString(),
      });
      showItemToggleUndoToast({
        action: "specialty",
        itemId: item.id,
        itemName: item.nome,
        nextValue: nextSpecial,
        message: nextSpecial
          ? `${item.nome} e in evidenza in homepage.`
          : `${item.nome} non e piu in evidenza.`,
      });
    } catch {
      setError("Errore durante aggiornamento stella.");
    } finally {
      setSavingId(null);
    }
  };

  const undoItemToggle = async () => {
    if (!itemToggleUndoToast) return;

    const toast = itemToggleUndoToast;
    dismissItemToggleUndoToast();
    setSavingId(toast.itemId);
    setError(null);
    setFeedback(null);

    try {
      const db = getClientDb();
      if (toast.action === "visibility") {
        await updateDoc(doc(db, "menu_items", toast.itemId), {
          visible: !toast.nextValue,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(doc(db, "menu_items", toast.itemId), {
          specialita: !toast.nextValue,
          special: !toast.nextValue,
          updatedAt: new Date().toISOString(),
        });
      }
      setFeedback(`Modifica annullata per ${toast.itemName}.`);
    } catch {
      setError("Errore durante annullamento modifica.");
    } finally {
      setSavingId(null);
    }
  };

  const reorderCategories = async (movingId: string, targetId: string) => {
    const orderedIds = categories.map((entry) => entry.id);
    const nextIds = reorderIds(orderedIds, movingId, targetId);
    if (nextIds.join("|") === orderedIds.join("|")) return;

    setBusy(true);
    setError(null);
    try {
      const db = getClientDb();
      await Promise.all(
        nextIds.map((categoryId, index) =>
          updateDoc(doc(db, "menu_categories", categoryId), {
            ordine: index,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
      setFeedback("Ordine categorie aggiornato.");
    } catch {
      setError("Errore durante riordino categorie.");
    } finally {
      setBusy(false);
    }
  };

  const reorderCategoryItems = async (movingId: string, targetId: string) => {
    const currentIds = visibleItems.map((item) => item.id);
    const nextIds = reorderIds(currentIds, movingId, targetId);
    if (nextIds.join("|") === currentIds.join("|")) return;

    setBusy(true);
    setError(null);
    try {
      const db = getClientDb();
      await Promise.all(
        nextIds.map((itemId, index) =>
          updateDoc(doc(db, "menu_items", itemId), {
            ordine: index,
            categoria: activeCategory,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );
      setFeedback("Ordine piatti aggiornato.");
    } catch {
      setError("Errore durante riordino piatti.");
    } finally {
      setBusy(false);
    }
  };

  const moveItemByStep = async (itemId: string, step: -1 | 1) => {
    const currentIds = visibleItems.map((entry) => entry.id);
    const currentIndex = currentIds.indexOf(itemId);
    if (currentIndex < 0) return;
    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    const targetId = currentIds[targetIndex];
    await reorderCategoryItems(itemId, targetId);
  };

  const moveCategoryByStep = async (categoryId: string, step: -1 | 1) => {
    const currentIds = categories.map((entry) => entry.id);
    const currentIndex = currentIds.indexOf(categoryId);
    if (currentIndex < 0) return;
    const targetIndex = currentIndex + step;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    const targetId = currentIds[targetIndex];
    await reorderCategories(categoryId, targetId);
  };

  const onCategoryScrollWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = categoryScrollRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (container.scrollWidth <= container.clientWidth) return;

    event.preventDefault();
    container.scrollBy({ left: event.deltaY, behavior: "auto" });
  };

  const openCategoryManager = () => {
    setShowCategoryModal(true);
  };

  const openNewDishModal = () => {
    if (activeCategory) {
      setNewItemCategory(activeCategory);
    }
    setNewDishActiveTab("identity");
    setShowNewExtraAllergensPanel(false);
    setShowMobilePhotoPicker(false);
    setShowItemModal(true);
  };

  const openReorderModal = () => {
    setShowReorderMode(true);
  };

  return (
    <section
      className={
        menuSubview === "dishes"
          ? "admin-shell admin-shell-menu-dishes"
          : "admin-shell"
      }
    >
      {feedback ? <p className="success-text">{feedback}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <p className="section-subtitle">Caricamento menu remoto...</p>
      ) : null}

      {itemToggleUndoToast ? (
        <div className="admin-action-toast" role="status" aria-live="polite">
          <p>{itemToggleUndoToast.message}</p>
          <div className="admin-action-toast-actions">
            <button type="button" onClick={() => void undoItemToggle()}>
              Annulla
            </button>
            <button
              type="button"
              className="ghost"
              onClick={dismissItemToggleUndoToast}
              aria-label="Chiudi notifica"
            >
              Chiudi
            </button>
          </div>
        </div>
      ) : null}

      {dishCreatedToast ? (
        <div
          className="admin-action-toast admin-action-toast-success"
          role="status"
          aria-live="polite"
        >
          <p>{dishCreatedToast}</p>
        </div>
      ) : null}

      <div className="admin-menu-sticky-header">
        <div className="admin-menu-sticky-header">
          <div className="menu-top-tabs-row">
            <div className="admin-tabs menu-top-tabs">
              <button
                type="button"
                className={
                  menuSubview === "dishes" ? "admin-tab active" : "admin-tab"
                }
                onClick={() => {
                  setMenuSubview("dishes");
                  setFabOpen(false);
                }}
              >
                Piatti
              </button>

              <button
                type="button"
                className={
                  menuSubview === "ingredients"
                    ? "admin-tab active"
                    : "admin-tab"
                }
                onClick={() => {
                  setMenuSubview("ingredients");
                  setFabOpen(false);
                }}
              >
                Ingredienti
              </button>
            </div>

            <div className="category-actions">
              <button
                type="button"
                className={`category-actions-btn ${fabOpen ? "open" : ""}`}
                onClick={() => setFabOpen((v) => !v)}
                aria-label="Azioni"
              >
                <span />
                <span />
                <span />
              </button>

              {fabOpen ? (
                <div className="category-actions-menu">
                  {menuSubview === "dishes" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          openNewDishModal();
                          setFabOpen(false);
                        }}
                      >
                        Nuovo piatto
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          openCategoryManager();
                          setFabOpen(false);
                        }}
                      >
                        Categorie
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          openReorderModal();
                          setFabOpen(false);
                        }}
                        disabled={!activeCategory || visibleItems.length <= 1}
                      >
                        Riordina
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowIngredientModal(true);
                          setFabOpen(false);
                        }}
                      >
                        Nuovo ingrediente
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAllergenFilters(true);
                          setFabOpen(false);
                        }}
                      >
                        Filtra allergeni
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {menuSubview === "dishes" ? (
            <div
              className="category-scroll"
              ref={categoryScrollRef}
              role="tablist"
              aria-label="Categorie menu"
              onWheel={onCategoryScrollWheel}
            >
              {visibleCategories.map((categoryName) => {
                const categoryDoc = categories.find(
                  (entry) =>
                    entry.name.toLowerCase() === categoryName.toLowerCase(),
                );
                const categoryId = categoryDoc?.id ?? null;
                const isVisible =
                  categoryVisibilityByName[categoryName.toLowerCase()] ?? true;

                return (
                  <button
                    key={categoryName}
                    type="button"
                    role="tab"
                    draggable={Boolean(categoryId)}
                    onDragStart={() => {
                      if (categoryId) setDraggingCategoryId(categoryId);
                    }}
                    onDragOver={(event) => {
                      if (categoryId) event.preventDefault();
                    }}
                    onDrop={() => {
                      if (draggingCategoryId && categoryId) {
                        void reorderCategories(draggingCategoryId, categoryId);
                      }
                      setDraggingCategoryId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingCategoryId(null);
                    }}
                    className={
                      activeCategory === categoryName
                        ? "category-pill active"
                        : isVisible
                          ? "category-pill"
                          : "category-pill category-pill-muted"
                    }
                    onClick={() => {
                      setActiveCategory(categoryName);
                    }}
                  >
                    {categoryName}
                    {!isVisible ? (
                      <span className="pill-state"> (nascosta)</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="ingredient-search-row">
              <input
                type="search"
                placeholder="Cerca ingrediente..."
                value={ingredientSearch}
                onChange={(event) => {
                  setIngredientSearch(event.currentTarget.value);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {menuSubview === "dishes" ? (
        <>
          {/* <div className="admin-menu-toolbar minimal-right admin-menu-toolbar-desktop">
            <button
              type="button"
              className="admin-mini-btn"
              onClick={openCategoryManager}
            >
              + Categoria
            </button>
            <button
              type="button"
              className="admin-mini-btn"
              onClick={openNewDishModal}
            >
              + Nuovo piatto
            </button>
            <button
              type="button"
              className="admin-mini-btn"
              onClick={openReorderModal}
              disabled={!activeCategory || visibleItems.length <= 1}
            >
              Riordina
            </button>
          </div> */}

          {visibleItems.length === 0 ? (
            <article className="admin-card empty-state-card">
              <p className="section-subtitle">Nessun piatto disponibile</p>
            </article>
          ) : (
            <div className="admin-grid modern-grid compact-cards dish-square-grid">
              {visibleItems.map((item) => (
                <article
                  className={
                    item.visible
                      ? "admin-dish-card admin-dish-card-compact"
                      : "admin-dish-card admin-dish-card-compact admin-dish-card-hidden"
                  }
                  key={item.id}
                >
                  <div className="admin-dish-media-wrap compact">
                    {item.imageMeta?.qualityTier ? (
                      <span
                        className={`admin-image-quality-badge ${item.imageMeta.qualityTier}`}
                      >
                        {getMenuImageQualityLabel(item.imageMeta.qualityTier)}
                      </span>
                    ) : null}
                    {hasCustomMenuImage(item.immagine) ? (
                      <img
                        src={item.immagine || DEFAULT_MENU_IMAGE}
                        alt={item.nome}
                        className="admin-dish-media"
                      />
                    ) : (
                      <div className="admin-dish-media-placeholder">
                        Nessuna immagine caricata
                      </div>
                    )}
                  </div>
                  <div className="admin-dish-body compact">
                    <div className="admin-dish-head">
                      <h3>
                        {item.nome}
                        {item.specialita ? " ★" : ""}
                      </h3>
                      <span className="dish-price compact">
                        {item.prezzo.toFixed(2)} EUR
                      </span>
                    </div>
                    <p className="admin-dish-desc compact">
                      {item.descrizione ||
                        item.ingredienti ||
                        "Nessuna descrizione"}
                    </p>
                    <SpiceLevelIndicator
                      level={item.spiceLevel}
                      className="admin-spice-indicator"
                      hideWhenZero
                    />
                    {item.allergeni.length > 0 ? (
                      <div className="chip-wrap">
                        {item.allergeni.map((key) => (
                          <span
                            className="allergen-mini-icon"
                            key={`${item.id}-${key}`}
                            title={allergenMap[key]?.label ?? key}
                          >
                            <AllergenIcon type={key} />
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="admin-dish-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Modifica ${item.nome}`}
                        onClick={() => {
                          openEditItem(item);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className={
                          item.specialita ? "icon-btn star-active" : "icon-btn"
                        }
                        aria-label={`Stella homepage ${item.nome}`}
                        disabled={savingId === item.id}
                        onClick={() => {
                          void toggleItemSpecialty(item);
                        }}
                      >
                        {item.specialita ? "★" : "☆"}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Visibilita ${item.nome}`}
                        disabled={savingId === item.id}
                        onClick={() => {
                          void toggleItemVisibility(item);
                        }}
                      >
                        <VisibilityIcon visible={item.visible} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Elimina ${item.nome}`}
                        disabled={savingId === item.id}
                        onClick={() => {
                          void removeItem(item.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {menuSubview === "ingredients" ? (
        <>
          {filteredIngredients.length === 0 ? (
            <article className="admin-card empty-state-card">
              <p className="section-subtitle">Nessun ingrediente trovato</p>
            </article>
          ) : (
            <div className="admin-grid compact-cards ingredient-square-grid">
              {filteredIngredients.map((ingredient) => {
                return (
                  <article
                    className="ingredient-square-card reduced"
                    key={ingredient.id}
                  >
                    <h4>{ingredient.name}</h4>

                    <div className="chip-wrap">
                      {ingredient.allergeni.map((key) => (
                        <span className="allergen-chip" key={key}>
                          <span className="allergen-mini-icon" aria-hidden>
                            <AllergenIcon type={key} />
                          </span>
                          <span>{allergenMap[key]?.label ?? key}</span>
                        </span>
                      ))}
                    </div>

                    <div className="admin-dish-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Modifica ingrediente ${ingredient.name}`}
                        onClick={() => {
                          openIngredientEdit(ingredient);
                        }}
                      >
                        ✎
                      </button>

                      <button
                        type="button"
                        className="icon-btn danger"
                        aria-label={`Elimina ingrediente ${ingredient.name}`}
                        disabled={savingId === ingredient.id}
                        onClick={() => {
                          void removeIngredient(ingredient.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {showCategoryModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Gestisci categorie"
          >
            <div className="admin-modal-head">
              <h3>Categorie</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowCategoryModal(false);
                }}
                aria-label="Chiudi popup categorie"
              >
                ×
              </button>
            </div>

            <form className="booking-form" onSubmit={addCategory}>
              <label>
                Nuova categoria
                <input
                  value={newCategoryName}
                  onChange={(event) => {
                    setNewCategoryName(event.currentTarget.value);
                  }}
                  placeholder="Es. Pizze speciali"
                  required
                />
              </label>
              <button className="btn-success" type="submit" disabled={busy}>
                Aggiungi
              </button>
            </form>

            <div className="category-list drag-sort-category-list">
              {categories.map((category, index) => (
                <div
                  className="category-row draggable"
                  key={category.id}
                  draggable
                  onDragStart={() => {
                    setDraggingModalCategoryId(category.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={() => {
                    if (draggingModalCategoryId) {
                      void reorderCategories(
                        draggingModalCategoryId,
                        category.id,
                      );
                    }
                    setDraggingModalCategoryId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingModalCategoryId(null);
                  }}
                >
                  <span className="drag-grip" aria-hidden>
                    ⠿
                  </span>
                  <input
                    value={categoryDrafts[category.id] ?? category.name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setCategoryDrafts((prev) => ({
                        ...prev,
                        [category.id]: value,
                      }));
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Visibilita categoria ${category.name}`}
                    disabled={savingId === category.id}
                    onClick={() => {
                      void toggleCategoryVisibility(category);
                    }}
                  >
                    <VisibilityIcon visible={category.visible} />
                  </button>
                  <button
                    type="button"
                    className="reorder-shift-btn"
                    aria-label={`Sposta su categoria ${category.name}`}
                    disabled={busy || savingId === category.id || index === 0}
                    onClick={() => {
                      void moveCategoryByStep(category.id, -1);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="reorder-shift-btn"
                    aria-label={`Sposta giu categoria ${category.name}`}
                    disabled={
                      busy ||
                      savingId === category.id ||
                      index === categories.length - 1
                    }
                    onClick={() => {
                      void moveCategoryByStep(category.id, 1);
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Modifica categoria ${category.name}`}
                    disabled={savingId === category.id}
                    onClick={() => {
                      void renameCategory(category.id);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Elimina categoria ${category.name}`}
                    disabled={savingId === category.id}
                    onClick={() => {
                      void removeCategory(category);
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showAllergenFilters ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Filtra ingredienti per allergeni"
          >
            <div className="admin-modal-head">
              <h3>Filtra per allergeni</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowAllergenFilters(false);
                }}
                aria-label="Chiudi popup filtri allergeni"
              >
                ×
              </button>
            </div>

            <div className="allergen-grid modern-allergen-grid">
              {ALLERGENS.map((allergen) => {
                const active = selectedAllergenFilters.includes(allergen.key);
                return (
                  <button
                    key={allergen.key}
                    type="button"
                    className={
                      active
                        ? "allergen-card filter active"
                        : "allergen-card filter"
                    }
                    onClick={() => {
                      setSelectedAllergenFilters((prev) =>
                        toggleInArray(prev, allergen.key),
                      );
                    }}
                  >
                    <span className="allergen-icon modern" aria-hidden>
                      <AllergenIcon type={allergen.key} />
                    </span>
                    <span>{allergen.label}</span>
                  </button>
                );
              })}
            </div>

            <div
              className="admin-menu-toolbar minimal-right"
              style={{ marginTop: "0.9rem" }}
            >
              <button
                type="button"
                className="admin-mini-btn"
                onClick={() => {
                  setSelectedAllergenFilters([]);
                }}
              >
                Reset filtri
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setShowAllergenFilters(false);
                }}
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showIngredientModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Aggiungi ingrediente"
          >
            <div className="admin-modal-head">
              <h3>Nuovo ingrediente</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowIngredientModal(false);
                }}
                aria-label="Chiudi popup ingrediente"
              >
                ×
              </button>
            </div>
            <form className="booking-form" onSubmit={saveNewIngredient}>
              <label>
                Nome ingrediente
                <input
                  value={newIngredientName}
                  onChange={(event) => {
                    setNewIngredientName(event.currentTarget.value);
                  }}
                  required
                />
              </label>
              <label>
                Allergeni
                <div className="allergen-picker compact">
                  {ALLERGENS.map((allergen) => {
                    const active = newIngredientAllergens.includes(
                      allergen.key,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.key}
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setNewIngredientAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>
              <button className="btn-success" type="submit" disabled={busy}>
                Salva ingrediente
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editingIngredientId ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Modifica ingrediente"
          >
            <div className="admin-modal-head">
              <h3>Modifica ingrediente</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setEditingIngredientId(null);
                  setIngredientEditName("");
                  setIngredientEditAllergens([]);
                }}
                aria-label="Chiudi popup modifica ingrediente"
              >
                ×
              </button>
            </div>
            <form
              className="booking-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveIngredientEdit();
              }}
            >
              <label>
                Nome
                <input
                  value={ingredientEditName}
                  onChange={(event) => {
                    setIngredientEditName(event.currentTarget.value);
                  }}
                />
              </label>
              <label>
                Allergeni
                <div className="allergen-picker compact">
                  {ALLERGENS.map((allergen) => {
                    const active = ingredientEditAllergens.includes(
                      allergen.key,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.key}
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setIngredientEditAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>
              <div className="admin-menu-toolbar minimal-right">
                <button
                  type="button"
                  className="admin-mini-btn"
                  onClick={() => {
                    setEditingIngredientId(null);
                    setIngredientEditName("");
                    setIngredientEditAllergens([]);
                  }}
                >
                  Annulla
                </button>
                <button
                  className="btn-success"
                  type="submit"
                  disabled={savingId === editingIngredientId}
                >
                  {savingId === editingIngredientId
                    ? "Salvataggio..."
                    : "Salva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {menuSubview === "dishes" ? (
        <div className="admin-menu-mobile-dock" aria-label="Azioni menu">
          <button
            type="button"
            className="admin-mini-btn"
            onClick={openCategoryManager}
          >
            Categoria
          </button>
          <button
            type="button"
            className="admin-mini-btn"
            onClick={openNewDishModal}
          >
            Nuovo piatto
          </button>
          <button
            type="button"
            className="admin-mini-btn"
            onClick={openReorderModal}
            disabled={!activeCategory || visibleItems.length <= 1}
          >
            Riordina
          </button>
        </div>
      ) : null}

      {showItemModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal menu-item-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Aggiungi piatto"
          >
            <div className="admin-modal-head">
              <h3>Nuovo piatto</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowMobilePhotoPicker(false);
                  setShowItemModal(false);
                }}
                aria-label="Chiudi popup piatti"
              >
                ×
              </button>
            </div>

            <form className="booking-form menu-item-form" onSubmit={createItem}>
              <div className="menu-item-tabs" role="tablist" aria-label="Nuovo piatto">
                <button
                  type="button"
                  role="tab"
                  aria-selected={newDishActiveTab === "identity"}
                  className={
                    newDishActiveTab === "identity"
                      ? "menu-item-tab active"
                      : "menu-item-tab"
                  }
                  onClick={() => setNewDishActiveTab("identity")}
                >
                  Identita del piatto
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={newDishActiveTab === "ingredients"}
                  className={
                    newDishActiveTab === "ingredients"
                      ? "menu-item-tab active"
                      : "menu-item-tab"
                  }
                  onClick={() => setNewDishActiveTab("ingredients")}
                >
                  Ingredienti e allergeni
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={newDishActiveTab === "image"}
                  className={
                    newDishActiveTab === "image"
                      ? "menu-item-tab active"
                      : "menu-item-tab"
                  }
                  onClick={() => setNewDishActiveTab("image")}
                >
                  Immagine
                </button>
              </div>
              <button
                type="button"
                className="menu-item-section-break menu-item-section-toggle"
                onClick={() => setNewDishIdentityOpen((prev) => !prev)}
                aria-expanded={newDishIdentityOpen}
              >
                <div>
                  <h4>Identita del piatto</h4>
                </div>
                <span className="menu-item-section-chevron" aria-hidden>
                  ↓
                </span>
              </button>
              {newDishIdentityOpen ? (
                <div className="menu-item-tab-panel" role="tabpanel">
              <label>
                Nome
                <input
                  value={newItemName}
                  onChange={(event) => {
                    setNewItemName(event.currentTarget.value);
                  }}
                  required
                />
              </label>

              <label>
                Descrizione (opzionale)
                <textarea
                  rows={3}
                  maxLength={MENU_DESCRIPTION_MAX_LENGTH}
                  value={newItemDescription}
                  onChange={(event) => {
                    setNewItemDescription(event.currentTarget.value);
                  }}
                  placeholder="Es. Impasto leggero, cottura croccante e gusto deciso."
                />
              </label>

              <div className="two-cols">
                <label className="menu-item-price-field">
                  <span className="menu-item-price-label">Prezzo</span>
                  <span className="menu-item-price-input-wrap">
                    <span className="menu-item-price-currency">€</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="12,00"
                      value={newItemPrice}
                      onChange={(event) => {
                        setNewItemPrice(
                          formatPriceDraft(event.currentTarget.value),
                        );
                      }}
                      required
                    />
                  </span>
                </label>
                <label>
                  Categoria
                  <select
                    value={newItemCategory}
                    onChange={(event) => {
                      setNewItemCategory(event.currentTarget.value);
                    }}
                    required
                  >
                    {selectableCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Piccantezza (opzionale)
                  <div
                    className="menu-item-spice-picker"
                    role="group"
                    aria-label="Piccantezza"
                  >
                    {[
                      { value: 0, label: "No", icon: "○" },
                      { value: 1, label: "Poco", icon: "🌶" },
                      { value: 2, label: "Media", icon: "🌶🌶" },
                      { value: 3, label: "Alta", icon: "🌶🌶🌶" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={
                          newItemSpiceLevel === option.value
                            ? "menu-item-spice-btn active"
                            : "menu-item-spice-btn"
                        }
                        onClick={() => setNewItemSpiceLevel(option.value)}
                        aria-pressed={newItemSpiceLevel === option.value}
                      >
                        <span aria-hidden>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <select
                    className="menu-item-spice-select-hidden"
                    value={String(newItemSpiceLevel)}
                    onChange={(event) => {
                      setNewItemSpiceLevel(
                        parseSpiceLevel(event.currentTarget.value),
                      );
                    }}
                  >
                    <option value="0">Non specificata</option>
                    <option value="1">🌶 Poco piccante</option>
                    <option value="2">🌶🌶 Piccante</option>
                    <option value="3">🌶🌶🌶 Molto piccante</option>
                  </select>
                </label>
              </div>
                </div>
              ) : null}

              <button
                type="button"
                className="menu-item-section-break menu-item-section-toggle"
                onClick={() => setNewDishIngredientsOpen((prev) => !prev)}
                aria-expanded={newDishIngredientsOpen}
              >
                <div>
                  <h4>Ingredienti e allergeni</h4>
                </div>
                <span className="menu-item-section-chevron" aria-hidden>
                  ↓
                </span>
              </button>
              {newDishIngredientsOpen ? (
              <div className="menu-item-tab-panel" role="tabpanel">
              <label className="menu-item-field-ingredients">
                Ingredienti
                <div className="ingredient-picker-wrap">
                  <input
                    className="chip-dropdown-input ingredient-search-input"
                    value={newIngredientSearch}
                    onFocus={() => {
                      setShowNewIngredientResults(
                        newIngredientSearch.trim().length >= 3,
                      );
                    }}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setNewIngredientSearch(value);
                      setShowNewIngredientResults(value.trim().length >= 3);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const result = addIngredientFromQuery(
                        newIngredientSearch,
                        newItemIngredientIds,
                        setNewItemIngredientIds,
                        "new",
                      );
                      if (result === "added" || result === "create") {
                        setNewIngredientSearch("");
                        setShowNewIngredientResults(false);
                      }
                    }}
                    placeholder="Cerca o aggiungi ingrediente..."
                  />
                  {showNewIngredientResults &&
                  newIngredientSearch.trim().length >= 3 ? (
                    <div className="ingredient-search-dropdown">
                      {filteredNewIngredientOptions.length > 0
                        ? filteredNewIngredientOptions
                            .slice(0, 10)
                            .map((ingredient) => {
                              const active = newItemIngredientIds.includes(
                                ingredient.id,
                              );
                              return (
                                <button
                                  type="button"
                                  key={ingredient.id}
                                  className={
                                    active
                                      ? "ingredient-search-item active"
                                      : "ingredient-search-item"
                                  }
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    setNewItemIngredientIds((prev) =>
                                      toggleInArray(prev, ingredient.id),
                                    );
                                    setShowNewIngredientResults(false);
                                    setNewIngredientSearch("");
                                  }}
                                >
                                  <div>
                                    <strong>{ingredient.name}</strong>
                                    {ingredient.allergeni.length > 0 ? (
                                      <div className="chip-wrap">
                                        {ingredient.allergeni.map((key) => (
                                          <span
                                            className="allergen-chip"
                                            key={`${ingredient.id}-${key}`}
                                          >
                                            <span
                                              className="allergen-mini-icon"
                                              aria-hidden
                                            >
                                              <AllergenIcon type={key} />
                                            </span>
                                            <span>
                                              {allergenMap[key]?.label ?? key}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })
                        : null}
                      {!newIngredientExactMatch &&
                      newIngredientSearch.trim().length >= 2 ? (
                        <button
                          type="button"
                          className="ingredient-search-item create-item"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            openQuickCreateIngredient(
                              newIngredientSearch,
                              "new",
                            );
                            setShowNewIngredientResults(false);
                            setNewIngredientSearch("");
                          }}
                        >
                          + Crea "{newIngredientSearch.trim()}"
                        </button>
                      ) : null}
                      {filteredNewIngredientOptions.length === 0 &&
                      !(
                        !newIngredientExactMatch &&
                        newIngredientSearch.trim().length >= 2
                      ) ? (
                        <div className="ingredient-empty-state">
                          <p>Nessun ingrediente trovato</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="ingredient-selected-head">
                  <strong>
                    Ingredienti selezionati ({newItemIngredientIds.length})
                  </strong>
                </div>
                <div className="chip-wrap selected-chip-preview">
                  {newItemIngredientIds.map((ingredientId) => {
                    const ingredient = ingredientMap[ingredientId];
                    if (!ingredient) return null;
                    return (
                      <button
                        type="button"
                        key={ingredientId}
                        className="ingredient-chip ordered-chip"
                        draggable
                        onDragStart={() => {
                          setDraggingNewIngredientId(ingredientId);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (!draggingNewIngredientId) return;
                          setNewItemIngredientIds((prev) =>
                            reorderIds(
                              prev,
                              draggingNewIngredientId,
                              ingredientId,
                            ),
                          );
                          setDraggingNewIngredientId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingNewIngredientId(null);
                        }}
                        onClick={() => {
                          setNewItemIngredientIds((prev) =>
                            prev.filter((id) => id !== ingredientId),
                          );
                        }}
                        title="Trascina per riordinare, clicca per rimuovere"
                      >
                        <span aria-hidden>✓</span>
                        <span>{ingredient.name}</span>
                        <span aria-hidden>✕</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni rilevati</strong>
                </div>
                <div className="chip-wrap">
                  {newDetectedAllergenKeys.length > 0 ? (
                    newDetectedAllergenKeys.map((key) => (
                      <span
                        className="allergen-chip"
                        key={`new-detected-${key}`}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={key} />
                        </span>
                        <span>{allergenMap[key]?.label ?? key}</span>
                      </span>
                    ))
                  ) : (
                    <span className="section-subtitle">
                      Nessun allergene rilevato
                    </span>
                  )}
                </div>
                <div className="menu-item-allergen-panel">
                  <button
                    type="button"
                    className="menu-item-allergen-trigger"
                    onClick={() =>
                      setShowNewExtraAllergensPanel((prev) => !prev)
                    }
                    aria-expanded={showNewExtraAllergensPanel}
                  >
                    <span>Allergeni extra</span>
                    <strong>
                      {newItemAllergens.length > 0
                        ? `${newItemAllergens.length} selezionati`
                        : "Nessuno"}
                    </strong>
                  </button>
                  {newItemAllergens.length > 0 ? (
                    <div className="chip-wrap menu-item-allergen-summary">
                      {newItemAllergens.map((key) => (
                        <span className="allergen-chip" key={`new-extra-${key}`}>
                          <span className="allergen-mini-icon" aria-hidden>
                            <AllergenIcon type={key} />
                          </span>
                          <span>{allergenMap[key]?.label ?? key}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {showNewExtraAllergensPanel ? (
                    <div className="allergen-picker compact menu-item-allergen-drawer">
                      {newSelectableExtraAllergens.map((allergen) => {
                        const active = newItemAllergens.includes(allergen.key);
                        return (
                          <button
                            key={allergen.key}
                            type="button"
                            className={
                              active
                                ? "allergen-toggle active"
                                : "allergen-toggle"
                            }
                            onClick={() => {
                              setNewItemAllergens((prev) =>
                                toggleInArray(prev, allergen.key),
                              );
                            }}
                          >
                            <span className="allergen-mini-icon" aria-hidden>
                              <AllergenIcon type={allergen.key} />
                            </span>
                            <span>{allergen.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </label>
              </div>
              ) : null}

              <button
                type="button"
                className="menu-item-section-break menu-item-section-toggle"
                onClick={() => setNewDishImageOpen((prev) => !prev)}
                aria-expanded={newDishImageOpen}
              >
                <div>
                  <h4>Immagine e resa visiva</h4>
                </div>
                <span className="menu-item-section-chevron" aria-hidden>
                  ↓
                </span>
              </button>
              {newDishImageOpen ? (
                <div className="menu-item-tab-panel" role="tabpanel">
              <label className="menu-item-field-image">
                <span className="menu-item-image-head">
                  <span>Immagine</span>
                  <span className="menu-item-image-fit-group">
                    <button
                      type="button"
                      className={
                        newItemImageFit === "cover"
                          ? "menu-item-image-fit-btn active"
                          : "menu-item-image-fit-btn"
                      }
                      aria-pressed={newItemImageFit === "cover"}
                      disabled={!hasNewImage}
                      onClick={() => setNewItemImageFit("cover")}
                    >
                      Zoomata
                    </button>
                    <button
                      type="button"
                      className={
                        newItemImageFit === "contain"
                          ? "menu-item-image-fit-btn active"
                          : "menu-item-image-fit-btn"
                      }
                      aria-pressed={newItemImageFit === "contain"}
                      disabled={!hasNewImage}
                      onClick={() => setNewItemImageFit("contain")}
                    >
                      Intera
                    </button>
                  </span>
                </span>
                <input
                  ref={newImageInputRef}
                  className="menu-item-hidden-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onNewImageChange(file);
                  }}
                />
                <input
                  ref={newImageCameraInputRef}
                  className="menu-item-hidden-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onNewImageChange(file);
                  }}
                />
                <div
                  className={
                    newImageDragActive
                      ? "menu-item-upload-dropzone active"
                      : "menu-item-upload-dropzone"
                  }
                  onDragOver={(event) => {
                    event.preventDefault();
                    setNewImageDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setNewImageDragActive(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0] ?? null;
                    void onNewImageChange(file);
                  }}
                >
                  <div className="menu-item-upload-copy">
                    <strong>
                      {hasNewImage
                        ? "Immagine pronta"
                        : "Trascina qui la foto del piatto"}
                    </strong>
                    <span>
                      Desktop: drag and drop. Mobile: scatta o scegli dalla
                      galleria.
                    </span>
                  </div>
                  <div className="menu-item-upload-actions">
                    <button
                      type="button"
                      className="admin-mini-btn menu-item-desktop-upload-btn"
                      onClick={() => newImageInputRef.current?.click()}
                    >
                      Scegli foto
                    </button>
                    <button
                      type="button"
                      className="admin-mini-btn menu-item-mobile-upload-btn"
                      onClick={() => setShowMobilePhotoPicker(true)}
                    >
                      Aggiungi foto
                    </button>
                  </div>
                  {showMobilePhotoPicker ? (
                    <div className="menu-item-mobile-picker">
                      <button
                        type="button"
                        className="menu-item-mobile-picker-option"
                        onClick={() => newImageInputRef.current?.click()}
                      >
                        Scegli da galleria
                      </button>
                      <button
                        type="button"
                        className="menu-item-mobile-picker-option"
                        onClick={() => newImageCameraInputRef.current?.click()}
                      >
                        Scatta foto
                      </button>
                      <button
                        type="button"
                        className="menu-item-mobile-picker-cancel"
                        onClick={() => setShowMobilePhotoPicker(false)}
                      >
                        Annulla
                      </button>
                    </div>
                  ) : null}
                </div>
              </label>

              {newImageAnalysis ? (
                <div className="menu-image-meta-panel">
                  <span
                    className={`admin-image-quality-badge inline ${newImageAnalysis.qualityTier}`}
                  >
                    {getMenuImageQualityLabel(newImageAnalysis.qualityTier)}
                  </span>
                  <p className="menu-image-meta-text">
                    Originale {newImageAnalysis.originalWidth}×
                    {newImageAnalysis.originalHeight} ·{" "}
                    {formatBytes(newImageAnalysis.originalFileSize)}
                  </p>
                  {newImageAnalysis.warning ? (
                    <p className="menu-image-warning">
                      {newImageAnalysis.warning}
                    </p>
                  ) : null}
                </div>
              ) : null}
                </div>
              ) : null}

              <button
                className="btn-success menu-item-submit"
                type="submit"
                disabled={busy}
              >
                {busy ? "Salvataggio..." : "Salva"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal menu-item-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Modifica piatto"
          >
            <div className="admin-modal-head">
              <h3>Modifica piatto</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setEditingItemId(null);
                }}
                aria-label="Chiudi modifica piatto"
              >
                ×
              </button>
            </div>

            <form
              className="booking-form menu-item-form"
              onSubmit={saveEditedItem}
            >
              <label>
                Nome
                <input
                  value={editItemName}
                  onChange={(event) => {
                    setEditItemName(event.currentTarget.value);
                  }}
                  required
                />
              </label>

              <label>
                Descrizione (opzionale)
                <textarea
                  rows={3}
                  maxLength={MENU_DESCRIPTION_MAX_LENGTH}
                  value={editItemDescription}
                  onChange={(event) => {
                    setEditItemDescription(event.currentTarget.value);
                  }}
                  placeholder="Es. Impasto leggero, cottura croccante e gusto deciso."
                />
              </label>

              <div className="two-cols">
                <label>
                  Prezzo
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={editItemPrice}
                    onChange={(event) => {
                      setEditItemPrice(event.currentTarget.value);
                    }}
                    required
                  />
                </label>
                <label>
                  Categoria
                  <select
                    value={editItemCategory}
                    onChange={(event) => {
                      setEditItemCategory(event.currentTarget.value);
                    }}
                    required
                  >
                    <option value="" disabled>
                      Seleziona categoria
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Mostra in Le nostre firme
                <select
                  value={editItemSpecial ? "1" : "0"}
                  onChange={(event) => {
                    setEditItemSpecial(event.currentTarget.value === "1");
                  }}
                >
                  <option value="0">No</option>
                  <option value="1">Si, metti la stella</option>
                </select>
              </label>

              <label>
                Piccantezza (opzionale)
                <select
                  value={String(editItemSpiceLevel)}
                  onChange={(event) => {
                    setEditItemSpiceLevel(
                      parseSpiceLevel(event.currentTarget.value),
                    );
                  }}
                >
                  <option value="0">Non specificata</option>
                  <option value="1">🌶 Poco piccante</option>
                  <option value="2">🌶🌶 Piccante</option>
                  <option value="3">🌶🌶🌶 Molto piccante</option>
                </select>
              </label>

              <label className="menu-item-field-ingredients">
                Ingredienti
                <div className="ingredient-picker-wrap">
                  <input
                    className="chip-dropdown-input ingredient-search-input"
                    value={editIngredientSearch}
                    onFocus={() => {
                      setShowEditIngredientResults(
                        editIngredientSearch.trim().length >= 3,
                      );
                    }}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setEditIngredientSearch(value);
                      setShowEditIngredientResults(value.trim().length >= 3);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const result = addIngredientFromQuery(
                        editIngredientSearch,
                        editItemIngredientIds,
                        setEditItemIngredientIds,
                        "edit",
                      );
                      if (result === "added" || result === "create") {
                        setEditIngredientSearch("");
                        setShowEditIngredientResults(false);
                      }
                    }}
                    placeholder="Cerca o aggiungi ingrediente..."
                  />
                  {showEditIngredientResults &&
                  editIngredientSearch.trim().length >= 3 ? (
                    <div className="ingredient-search-dropdown">
                      {filteredEditIngredientOptions.length > 0
                        ? filteredEditIngredientOptions
                            .slice(0, 10)
                            .map((ingredient) => {
                              const active = editItemIngredientIds.includes(
                                ingredient.id,
                              );
                              return (
                                <button
                                  type="button"
                                  key={ingredient.id}
                                  className={
                                    active
                                      ? "ingredient-search-item active"
                                      : "ingredient-search-item"
                                  }
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    setEditItemIngredientIds((prev) =>
                                      toggleInArray(prev, ingredient.id),
                                    );
                                    setShowEditIngredientResults(false);
                                    setEditIngredientSearch("");
                                  }}
                                >
                                  <div>
                                    <strong>{ingredient.name}</strong>
                                    {ingredient.allergeni.length > 0 ? (
                                      <div className="chip-wrap">
                                        {ingredient.allergeni.map((key) => (
                                          <span
                                            className="allergen-chip"
                                            key={`${ingredient.id}-${key}`}
                                          >
                                            <span
                                              className="allergen-mini-icon"
                                              aria-hidden
                                            >
                                              <AllergenIcon type={key} />
                                            </span>
                                            <span>
                                              {allergenMap[key]?.label ?? key}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })
                        : null}
                      {!editIngredientExactMatch &&
                      editIngredientSearch.trim().length >= 2 ? (
                        <button
                          type="button"
                          className="ingredient-search-item create-item"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            openQuickCreateIngredient(
                              editIngredientSearch,
                              "edit",
                            );
                            setShowEditIngredientResults(false);
                            setEditIngredientSearch("");
                          }}
                        >
                          + Crea "{editIngredientSearch.trim()}"
                        </button>
                      ) : null}
                      {filteredEditIngredientOptions.length === 0 &&
                      !(
                        !editIngredientExactMatch &&
                        editIngredientSearch.trim().length >= 2
                      ) ? (
                        <div className="ingredient-empty-state">
                          <p>Nessun ingrediente trovato</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="ingredient-selected-head">
                  <strong>
                    Ingredienti selezionati ({editItemIngredientIds.length})
                  </strong>
                </div>
                <div className="chip-wrap selected-chip-preview">
                  {editItemIngredientIds.map((ingredientId) => {
                    const ingredient = ingredientMap[ingredientId];
                    if (!ingredient) return null;
                    return (
                      <button
                        type="button"
                        className="ingredient-chip ordered-chip"
                        key={ingredientId}
                        draggable
                        onDragStart={() => {
                          setDraggingEditIngredientId(ingredientId);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (!draggingEditIngredientId) return;
                          setEditItemIngredientIds((prev) =>
                            reorderIds(
                              prev,
                              draggingEditIngredientId,
                              ingredientId,
                            ),
                          );
                          setDraggingEditIngredientId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingEditIngredientId(null);
                        }}
                        onClick={() => {
                          setEditItemIngredientIds((prev) =>
                            prev.filter((id) => id !== ingredientId),
                          );
                        }}
                        title="Trascina per riordinare, clicca per rimuovere"
                      >
                        <span aria-hidden>✓</span>
                        <span>{ingredient.name}</span>
                        <span aria-hidden>✕</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni rilevati</strong>
                </div>
                <div className="chip-wrap">
                  {editDetectedAllergenKeys.length > 0 ? (
                    editDetectedAllergenKeys.map((key) => (
                      <span
                        className="allergen-chip"
                        key={`edit-detected-${key}`}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={key} />
                        </span>
                        <span>{allergenMap[key]?.label ?? key}</span>
                      </span>
                    ))
                  ) : (
                    <span className="section-subtitle">
                      Nessun allergene rilevato
                    </span>
                  )}
                </div>
                <div className="ingredient-selected-head">
                  <strong>Allergeni extra</strong>
                </div>
                <div className="allergen-picker compact">
                  {editSelectableExtraAllergens.map((allergen) => {
                    const active = editItemAllergens.includes(allergen.key);
                    return (
                      <button
                        key={allergen.key}
                        type="button"
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setEditItemAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="menu-item-field-image">
                <div className="menu-item-image-head">
                  <span>Immagine</span>
                  <span className="menu-item-image-fit-group">
                    <button
                      type="button"
                      className={
                        editItemImageFit === "cover"
                          ? "menu-item-image-fit-btn active"
                          : "menu-item-image-fit-btn"
                      }
                      aria-pressed={editItemImageFit === "cover"}
                      disabled={!hasEditImage}
                      onClick={() => setEditItemImageFit("cover")}
                    >
                      Zoomata
                    </button>
                    <button
                      type="button"
                      className={
                        editItemImageFit === "contain"
                          ? "menu-item-image-fit-btn active"
                          : "menu-item-image-fit-btn"
                      }
                      aria-pressed={editItemImageFit === "contain"}
                      disabled={!hasEditImage}
                      onClick={() => setEditItemImageFit("contain")}
                    >
                      Intera
                    </button>
                  </span>
                </div>
                <input
                  id="edit-item-image-input"
                  type="file"
                  accept="image/*"
                  className="input-hidden-file"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onEditImageChange(file);
                  }}
                />
                <label
                  htmlFor="edit-item-image-input"
                  className="admin-file-btn"
                >
                  Cambia immagine
                </label>
                {editImageFile ? (
                  <p className="section-subtitle">{editImageFile.name}</p>
                ) : null}
              </div>

              {editImageAnalysis ? (
                <div className="menu-image-meta-panel">
                  <span
                    className={`admin-image-quality-badge inline ${editImageAnalysis.qualityTier}`}
                  >
                    {getMenuImageQualityLabel(editImageAnalysis.qualityTier)}
                  </span>
                  <p className="menu-image-meta-text">
                    Originale {editImageAnalysis.originalWidth}×
                    {editImageAnalysis.originalHeight} ·{" "}
                    {formatBytes(editImageAnalysis.originalFileSize)}
                  </p>
                  {editImageAnalysis.warning ? (
                    <p className="menu-image-warning">
                      {editImageAnalysis.warning}
                    </p>
                  ) : null}
                </div>
              ) : editingItemMeta?.qualityTier ? (
                <div className="menu-image-meta-panel">
                  <span
                    className={`admin-image-quality-badge inline ${editingItemMeta.qualityTier}`}
                  >
                    {getMenuImageQualityLabel(editingItemMeta.qualityTier)}
                  </span>
                  <p className="menu-image-meta-text">
                    Originale {editingItemMeta.originalWidth ?? "?"}×
                    {editingItemMeta.originalHeight ?? "?"}
                    {editingItemMeta.originalFileSize
                      ? ` · ${formatBytes(editingItemMeta.originalFileSize)}`
                      : ""}
                    {editingItemMeta.optimizedFileSize
                      ? ` · WebP ${formatBytes(editingItemMeta.optimizedFileSize)}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <div className="admin-preview-box">
                {hasEditImage ? (
                  <img
                    src={
                      editImagePreview ||
                      editingItem.immagine ||
                      DEFAULT_MENU_IMAGE
                    }
                    alt="Anteprima modifica piatto"
                    className="admin-preview-image"
                  />
                ) : (
                  <div className="admin-preview-placeholder">
                    Nessuna immagine caricata
                  </div>
                )}
              </div>

              <button
                className="btn-success menu-item-submit"
                type="submit"
                disabled={savingId === editingItem.id}
              >
                {savingId === editingItem.id
                  ? "Salvataggio..."
                  : "Salva modifiche"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showQuickIngredientCreate ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className="admin-modal ingredient-quick-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Crea ingrediente veloce"
          >
            <div className="admin-modal-head">
              <h3>Crea ingrediente</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setShowQuickIngredientCreate(false);
                }}
                aria-label="Chiudi creazione ingrediente veloce"
              >
                ×
              </button>
            </div>

            <div className="booking-form">
              <label>
                Nome
                <input
                  value={quickIngredientName}
                  onChange={(event) => {
                    setQuickIngredientName(event.currentTarget.value);
                  }}
                  placeholder="Es. Pistacchio"
                />
              </label>

              <label>
                Allergeni
                <div className="allergen-picker compact">
                  {ALLERGENS.map((allergen) => {
                    const active = quickIngredientAllergens.includes(
                      allergen.key,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.key}
                        className={
                          active ? "allergen-toggle active" : "allergen-toggle"
                        }
                        onClick={() => {
                          setQuickIngredientAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="admin-menu-toolbar minimal-right">
                <button
                  type="button"
                  className="admin-mini-btn"
                  onClick={() => {
                    setShowQuickIngredientCreate(false);
                  }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn-success"
                  disabled={busy}
                  onClick={() => {
                    void saveQuickIngredient();
                  }}
                >
                  {busy ? "Salvataggio..." : "Salva"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showReorderMode ? (
        <div
          className="admin-modal-backdrop reorder-backdrop"
          role="presentation"
        >
          <div
            className="admin-modal reorder-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Riordina piatti"
          >
            <div className="reorder-header-wrap">
              <div className="admin-modal-head reorder-head">
                <h3>Riordina piatti</h3>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setShowReorderMode(false);
                    setReorderDropTargetId(null);
                    setDraggingReorderItemId(null);
                  }}
                  aria-label="Chiudi modalita riordino"
                >
                  ×
                </button>
              </div>

              <p className="section-subtitle reorder-subtitle">
                Categoria: {activeCategory || "Nessuna"}
              </p>
            </div>

            <div
              className="reorder-list"
              role="list"
              aria-label="Ordine piatti"
            >
              {visibleItems.map((item, index) => {
                const isDragging = draggingReorderItemId === item.id;
                const isDropTarget =
                  reorderDropTargetId === item.id && !isDragging;
                const isFirst = index === 0;
                const isLast = index === visibleItems.length - 1;

                return (
                  <article
                    key={`reorder-${item.id}`}
                    className={
                      isDragging
                        ? "reorder-row is-dragging"
                        : isDropTarget
                          ? "reorder-row is-drop-target"
                          : "reorder-row"
                    }
                    role="listitem"
                    onDragEnter={() => {
                      setReorderDropTargetId(item.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setReorderDropTargetId(item.id);
                    }}
                    onDrop={() => {
                      if (!draggingReorderItemId) return;
                      void reorderCategoryItems(draggingReorderItemId, item.id);
                      setDraggingReorderItemId(null);
                      setReorderDropTargetId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingReorderItemId(null);
                      setReorderDropTargetId(null);
                    }}
                  >
                    <div className="reorder-name-box">
                      <span className="reorder-title">{item.nome}</span>
                    </div>
                    <div
                      className="reorder-actions"
                      aria-label="Azioni riordino"
                    >
                      <button
                        type="button"
                        className="reorder-shift-btn"
                        disabled={isFirst || busy}
                        onClick={() => {
                          void moveItemByStep(item.id, -1);
                        }}
                        aria-label={`Sposta su ${item.nome}`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="reorder-shift-btn"
                        disabled={isLast || busy}
                        onClick={() => {
                          void moveItemByStep(item.id, 1);
                        }}
                        aria-label={`Sposta giu ${item.nome}`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="reorder-drag-handle"
                        draggable
                        onDragStart={(event) => {
                          setReorderDragGhost(event, item.nome);
                          setDraggingReorderItemId(item.id);
                          setReorderDropTargetId(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggingReorderItemId(null);
                          setReorderDropTargetId(null);
                        }}
                        aria-label={`Trascina ${item.nome}`}
                        title="Trascina da qui per riordinare"
                      >
                        ⋮⋮
                      </button>
                    </div>
                    {isDropTarget ? (
                      <span className="reorder-slot-placeholder" aria-hidden />
                    ) : null}
                  </article>
                );
              })}
            </div>

            <div className="admin-menu-toolbar minimal-right reorder-footer-bar">
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  setShowReorderMode(false);
                  setReorderDropTargetId(null);
                  setDraggingReorderItemId(null);
                }}
              >
                Fine
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
