import { DEFAULT_MENU_IMAGE } from "@/components/admin-menu/constants";
import { AllergenIcon, VisibilityIcon } from "@/components/admin-menu/icons";
import {
  getMenuImageQualityLabel,
  hasCustomMenuImage,
} from "@/components/admin-menu/images";
import type { AdminMenuItem, AllergenDef } from "@/components/admin-menu/types";
import { SpiceLevelIndicator } from "@/components/spice-level-indicator";

type MenuDishesViewProps = {
  allergenMap: Record<string, AllergenDef>;
  openEditItem: (item: AdminMenuItem) => void;
  removeItem: (itemId: string) => Promise<void>;
  savingId: string | null;
  toggleItemSpecialty: (item: AdminMenuItem) => Promise<void>;
  toggleItemVisibility: (item: AdminMenuItem) => Promise<void>;
  visibleItems: AdminMenuItem[];
};

/** Elenco dei piatti della categoria aperta. */
export function MenuDishesView({
  allergenMap,
  openEditItem,
  removeItem,
  savingId,
  toggleItemSpecialty,
  toggleItemVisibility,
  visibleItems,
}: MenuDishesViewProps) {
  return (
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
  );
}
