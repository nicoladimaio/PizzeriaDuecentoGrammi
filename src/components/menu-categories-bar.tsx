import { useEffect, useRef } from "react";
import type { MouseEvent, WheelEvent } from "react";
import type { MenuCategory } from "@/types/menu-app";

type MenuCategoriesBarProps = {
  categories: MenuCategory[];
  activeCategory: string;
  categoriesAriaLabel?: string;
  getCategoryLabel?: (name: string) => string;
  onSelectCategory: (name: string) => void;
};

const iconForCategory = (name: string): string => {
  const normalized = name.toLowerCase();
  if (normalized.includes("pizza")) return "🍕";
  if (normalized.includes("fritt")) return "🍟";
  if (normalized.includes("bev")) return "🥤";
  return "";
};

export function MenuCategoriesBar({
  categories,
  activeCategory,
  categoriesAriaLabel,
  getCategoryLabel,
  onSelectCategory,
}: MenuCategoriesBarProps) {
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);

  const onScrollWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    if (container.scrollWidth <= container.clientWidth) return;
    event.preventDefault();
    container.scrollBy({ left: event.deltaY, behavior: "auto" });
  };

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

  const onMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container) return;
    if (event.button !== 0) return;
    if (container.scrollWidth <= container.clientWidth) return;

    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
    container.classList.add("dragging");
  };

  const onMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    if (!container || !dragStateRef.current.active) return;

    const deltaX = event.clientX - dragStateRef.current.startX;
    if (Math.abs(deltaX) > 5) {
      dragStateRef.current.moved = true;
      suppressClickRef.current = true;
    }
    container.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
  };

  const endMouseDrag = () => {
    const container = scrollRef.current;
    if (container) container.classList.remove("dragging");
    dragStateRef.current.active = false;
    dragStateRef.current.startX = 0;
    dragStateRef.current.startScrollLeft = 0;
    window.setTimeout(() => {
      suppressClickRef.current = false;
      dragStateRef.current.moved = false;
    }, 0);
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="qr-categories-sticky">
      <div
        ref={scrollRef}
        className="qr-categories-scroll"
        aria-label={categoriesAriaLabel ?? "Categorie menu"}
        onWheel={onScrollWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endMouseDrag}
        onMouseLeave={endMouseDrag}
        onClickCapture={onClickCapture}
      >
        {categories.map((category) => {
          const active =
            activeCategory.toLowerCase() === category.name.toLowerCase();
          const label = getCategoryLabel
            ? getCategoryLabel(category.name)
            : category.name;
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
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
