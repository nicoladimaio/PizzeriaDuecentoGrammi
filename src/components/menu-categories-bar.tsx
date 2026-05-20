import { useEffect, useRef } from "react";
import type { MenuCategory } from "@/types/menu-app";

type MenuCategoriesBarProps = {
  categories: MenuCategory[];
  activeCategory: string;
  onSelectCategory: (name: string) => void;
};

const iconForCategory = (name: string): string => {
  const normalized = name.toLowerCase();
  if (normalized.includes("pizza")) return "🍕";
  if (normalized.includes("fritt")) return "🍟";
  if (normalized.includes("bev")) return "🥤";
  if (normalized.includes("dolc")) return "🍰";
  return "";
};

export function MenuCategoriesBar({
  categories,
  activeCategory,
  onSelectCategory,
}: MenuCategoriesBarProps) {
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const key = activeCategory.toLowerCase().trim();
    if (!key) return;
    const target = chipRefs.current[key];
    if (!target) return;
    target.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeCategory]);

  return (
    <div className="qr-categories-sticky">
      <div className="qr-categories-scroll" aria-label="Categorie menu">
        {categories.map((category) => {
          const active =
            activeCategory.toLowerCase() === category.name.toLowerCase();
          return (
            <button
              key={category.id}
              type="button"
              ref={(node) => {
                chipRefs.current[category.name.toLowerCase().trim()] = node;
              }}
              aria-pressed={active}
              className={
                active ? "qr-category-chip active" : "qr-category-chip"
              }
              onClick={() => onSelectCategory(category.name)}
            >
              {iconForCategory(category.name) ? (
                <span aria-hidden>{iconForCategory(category.name)}</span>
              ) : null}
              <span>{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
