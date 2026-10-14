import type { AdminMenuItem } from "@/components/admin-menu/types";

type MenuMobileDockProps = {
  activeCategory: string;
  openCategoryManager: () => void;
  openNewDishModal: () => void;
  openReorderModal: () => void;
  visibleItems: AdminMenuItem[];
};

/** Barra azioni in basso su telefono. */
export function MenuMobileDock({
  activeCategory,
  openCategoryManager,
  openNewDishModal,
  openReorderModal,
  visibleItems,
}: MenuMobileDockProps) {
  return (
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
  );
}
