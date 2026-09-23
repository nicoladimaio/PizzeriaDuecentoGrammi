import type { DragEvent } from "react";

export const normalizePrice = (value: unknown): number | null => {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
};

export const formatPriceDraft = (value: string): string => {
  const sanitized = value.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [integerPartRaw = "", ...decimalsRaw] = sanitized.split(",");
  const integerPart = integerPartRaw.replace(/^0+(?=\d)/, "");
  const decimals = decimalsRaw.join("").slice(0, 2);

  if (sanitized.includes(",")) {
    return `${integerPart || "0"},${decimals}`;
  }

  return integerPart;
};

export const getSpiceLabel = (level: number): string => {
  if (level <= 0) return "";
  if (level === 1) return "Poco piccante";
  if (level === 2) return "Piccante";
  return "Molto piccante";
};

export const reorderIds = (
  ids: string[],
  movingId: string,
  targetId: string,
) => {
  if (movingId === targetId) return ids;
  const next = [...ids];
  const from = next.indexOf(movingId);
  const to = next.indexOf(targetId);
  if (from < 0 || to < 0) return ids;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

export const setReorderDragGhost = (
  event: DragEvent<HTMLElement>,
  title: string,
) => {
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

export const toggleInArray = (arr: string[], value: string): string[] => {
  const exists = arr.includes(value);
  if (exists) return arr.filter((entry) => entry !== value);
  return [...arr, value];
};
