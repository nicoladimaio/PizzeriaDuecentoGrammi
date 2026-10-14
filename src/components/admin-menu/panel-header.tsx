import type { Dispatch, RefObject, SetStateAction, WheelEvent } from "react";
import type {
  AdminMenuItem,
  MenuCategory,
} from "@/components/admin-menu/types";

type MenuPanelHeaderProps = {
  activeCategory: string;
  categories: MenuCategory[];
  categoryScrollRef: RefObject<HTMLDivElement | null>;
  categoryVisibilityByName: Record<string, boolean>;
  draggingCategoryId: string | null;
  fabOpen: boolean;
  ingredientSearch: string;
  menuSubview: "ingredients" | "dishes" | "translations";
  onCategoryScrollWheel: (event: WheelEvent<HTMLDivElement>) => void;
  openCategoryManager: () => void;
  openNewDishModal: () => void;
  openReorderModal: () => void;
  reorderCategories: (movingId: string, targetId: string) => Promise<void>;
  setActiveCategory: Dispatch<SetStateAction<string>>;
  setDraggingCategoryId: Dispatch<SetStateAction<string | null>>;
  setFabOpen: Dispatch<SetStateAction<boolean>>;
  setIngredientSearch: Dispatch<SetStateAction<string>>;
  setMenuSubview: Dispatch<SetStateAction<"ingredients" | "dishes" | "translations">>;
  setShowAllergenFilters: Dispatch<SetStateAction<boolean>>;
  setShowIngredientModal: Dispatch<SetStateAction<boolean>>;
  visibleCategories: string[];
  visibleItems: AdminMenuItem[];
};

/** Intestazione fissa del pannello menu: schede, categorie e azioni. */
export function MenuPanelHeader({
  activeCategory,
  categories,
  categoryScrollRef,
  categoryVisibilityByName,
  draggingCategoryId,
  fabOpen,
  ingredientSearch,
  menuSubview,
  onCategoryScrollWheel,
  openCategoryManager,
  openNewDishModal,
  openReorderModal,
  reorderCategories,
  setActiveCategory,
  setDraggingCategoryId,
  setFabOpen,
  setIngredientSearch,
  setMenuSubview,
  setShowAllergenFilters,
  setShowIngredientModal,
  visibleCategories,
  visibleItems,
}: MenuPanelHeaderProps) {
  return (
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

            <button
              type="button"
              className={
                menuSubview === "translations"
                  ? "admin-tab active"
                  : "admin-tab"
              }
              onClick={() => {
                setMenuSubview("translations");
                setFabOpen(false);
              }}
            >
              Traduzioni
            </button>
          </div>

          {menuSubview !== "translations" ? (
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
          ) : null}
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
        ) : menuSubview === "ingredients" ? (
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
        ) : null}
      </div>
    </div>
  );
}
