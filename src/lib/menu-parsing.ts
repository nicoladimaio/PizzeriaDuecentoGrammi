// Normalizzazione dei documenti del menu: Firestore contiene campi con nomi
// storici diversi (Nome/nome, Prezzo/prezzo, piccantezza in vari formati...).
import type { MenuImageFit, MenuProduct } from "@/types/menu-app";

export const normalizeText = (value: unknown): string =>
  String(value ?? "").trim();

export const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 0);
};

export const splitIngredients = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const parsePrice = (value: unknown): number => {
  const normalized = String(value ?? "0")
    .replace(",", ".")
    .trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

export const parseOrder = (raw: { ordine?: unknown; order?: unknown }): number =>
  Number.isFinite(Number(raw.ordine))
    ? Number(raw.ordine)
    : Number.isFinite(Number(raw.order))
      ? Number(raw.order)
      : 9999;

export const parseVisible = (raw: {
  visible?: unknown;
  visibile?: unknown;
}): boolean =>
  typeof raw.visible === "boolean"
    ? raw.visible
    : typeof raw.visibile === "boolean"
      ? raw.visibile
      : true;

export const parseSpiceLevel = (value: unknown): number => {
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

export const extractSpiceLevelFromRaw = (
  raw: Record<string, unknown>,
): number => {
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
      // Le traduzioni contengono testo libero: non vanno interpretate.
      if (key === "i18n") return;
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

export const inferSpiceFromText = (value: string): number => {
  const raw = value.trim().toLowerCase();
  if (!raw) return 0;
  const normalized = raw.replace(/[’']/g, "");

  if (
    normalized.includes("nduja") ||
    normalized.includes("peperoncino") ||
    normalized.includes("chili") ||
    normalized.includes("chilli") ||
    normalized.includes("jalapeno")
  ) {
    return 2;
  }

  if (normalized.includes("piccante") || normalized.includes("spicy")) {
    return 1;
  }

  return 0;
};

export const normalizeImage = (image: string): string => {
  if (!image) return "/assets/logo.jpg";
  if (image.startsWith("http")) return image;
  return `/${image.replace(/^\/+/, "")}`;
};

export const normalizeImageFit = (value: unknown): MenuImageFit => {
  return value === "contain" ? "contain" : "cover";
};

/** Rimuove i duplicati ignorando maiuscole/minuscole, mantenendo l'ordine. */
export const unique = (values: string[]): string[] => {
  const out: string[] = [];
  values.forEach((value) => {
    const exists = out.some(
      (entry) => entry.toLowerCase() === value.toLowerCase(),
    );
    if (!exists) out.push(value);
  });
  return out;
};

export const normalizeCategoryKey = (name: string): string =>
  name.toLowerCase().trim();

export const categoryAnchorId = (name: string): string =>
  `cat-${name.toLowerCase().replace(/\s+/g, "-")}`;
