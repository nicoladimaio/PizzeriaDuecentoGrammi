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
  return (
    <div className="qr-categories-sticky">
      <div
        className="qr-categories-scroll"
        role="tablist"
        aria-label="Categorie menu"
      >
        {categories.map((category) => {
          const active =
            activeCategory.toLowerCase() === category.name.toLowerCase();
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
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
