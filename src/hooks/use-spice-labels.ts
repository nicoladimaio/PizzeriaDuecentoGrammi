"use client";

import { useTranslations } from "next-intl";
import type { SpiceLabels } from "@/components/spice-level-indicator";

/** Etichette piccantezza nella lingua corrente (solo pagine con next-intl). */
export function useSpiceLabels(): SpiceLabels {
  const t = useTranslations("Spice");
  return {
    levels: [t("none"), t("mild"), t("medium"), t("hot")],
    aria: (label) => t("aria", { label }),
  };
}
