import type { MenuImageMeta, MenuImageQualityTier } from "@/types/menu-app";
import type {
  ImageUploadAnalysis,
  OptimizedImageUpload,
} from "@/components/admin-menu/types";
import {
  DEFAULT_MENU_IMAGE,
  MENU_IMAGE_HD_MIN,
  MENU_IMAGE_GOOD_MIN,
  MENU_IMAGE_MAX_SIDE,
  MENU_IMAGE_WEBP_QUALITY,
  LOW_QUALITY_IMAGE_WARNING,
} from "@/components/admin-menu/constants";

export const normalizeMenuImagePath = (image: string | null | undefined) =>
  image?.trim().replace(/^\/+/, "").toLowerCase() ?? "";

export const hasCustomMenuImage = (image: string | null | undefined) => {
  const normalized = normalizeMenuImagePath(image);
  return Boolean(normalized) && normalized !== DEFAULT_MENU_IMAGE.toLowerCase();
};

export const getMenuImageQualityTier = (
  longestSide: number,
): MenuImageQualityTier => {
  if (longestSide >= MENU_IMAGE_HD_MIN) return "hd";
  if (longestSide >= MENU_IMAGE_GOOD_MIN) return "good";
  return "low";
};

export const getMenuImageQualityLabel = (
  tier: MenuImageQualityTier,
): string => {
  if (tier === "hd") return "HD";
  if (tier === "good") return "Buona";
  return "Bassa qualita";
};

export const getMenuImageMetaFromRaw = (
  data: Record<string, unknown>,
): MenuImageMeta => {
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
    originalWidth:
      Number.isFinite(originalWidth) && originalWidth > 0
        ? originalWidth
        : undefined,
    originalHeight:
      Number.isFinite(originalHeight) && originalHeight > 0
        ? originalHeight
        : undefined,
    originalFileSize:
      Number.isFinite(originalFileSize) && originalFileSize > 0
        ? originalFileSize
        : undefined,
    optimizedFileSize:
      Number.isFinite(optimizedFileSize) && optimizedFileSize > 0
        ? optimizedFileSize
        : undefined,
    qualityTier,
  };
};

export const formatBytes = (bytes: number | undefined): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export const sanitizeFileName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

export const loadImageFromUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossibile leggere l'immagine."));
    image.src = url;
  });

export const analyzeImageFile = async (
  file: File,
): Promise<ImageUploadAnalysis> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Il file selezionato non e un'immagine valida.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(objectUrl);
    const originalWidth = Math.max(1, image.naturalWidth || image.width || 1);
    const originalHeight = Math.max(
      1,
      image.naturalHeight || image.height || 1,
    );
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

export const maybeApplyFutureUpscaling = async (
  file: File,
  analysis: ImageUploadAnalysis,
): Promise<File> => {
  // Hook pronto per un futuro passaggio automatico di upscaling AI.
  void analysis;
  return file;
};

export const optimizeImageForUpload = async (
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
