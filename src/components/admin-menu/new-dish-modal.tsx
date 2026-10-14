import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { MENU_DESCRIPTION_MAX_LENGTH } from "@/components/admin-menu/constants";
import {
  formatPriceDraft,
  reorderIds,
  toggleInArray,
} from "@/components/admin-menu/helpers";
import { AllergenIcon } from "@/components/admin-menu/icons";
import {
  formatBytes,
  getMenuImageQualityLabel,
} from "@/components/admin-menu/images";
import type {
  AllergenDef,
  ImageUploadAnalysis,
  MenuCategory,
  MenuIngredient,
} from "@/components/admin-menu/types";
import { parseSpiceLevel } from "@/lib/menu-parsing";
import type { MenuImageFit } from "@/types/menu-app";

type MenuNewDishModalProps = {
  addIngredientFromQuery: (query: string, selectedIds: string[], setSelectedIds: Dispatch<SetStateAction<string[]>>, target: "new" | "edit") => "added" | "create" | "noop";
  allergenMap: Record<string, AllergenDef>;
  busy: boolean;
  createItem: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  draggingNewIngredientId: string | null;
  filteredNewIngredientOptions: MenuIngredient[];
  hasNewImage: boolean;
  ingredientMap: Record<string, MenuIngredient>;
  newDetectedAllergenKeys: string[];
  newDishActiveTab: "identity" | "ingredients" | "image";
  newDishIdentityOpen: boolean;
  newDishImageOpen: boolean;
  newDishIngredientsOpen: boolean;
  newImageAnalysis: ImageUploadAnalysis | null;
  newImageCameraInputRef: RefObject<HTMLInputElement | null>;
  newImageDragActive: boolean;
  newImageInputRef: RefObject<HTMLInputElement | null>;
  newIngredientExactMatch: MenuIngredient | null;
  newIngredientSearch: string;
  newItemAllergens: string[];
  newItemCategory: string;
  newItemDescription: string;
  newItemImageFit: MenuImageFit;
  newItemIngredientIds: string[];
  newItemName: string;
  newItemPrice: string;
  newItemSpiceLevel: number;
  newSelectableExtraAllergens: AllergenDef[];
  onNewImageChange: (file: File | null) => Promise<void>;
  openQuickCreateIngredient: (name: string, target: "new" | "edit") => void;
  selectableCategories: MenuCategory[];
  setDraggingNewIngredientId: Dispatch<SetStateAction<string | null>>;
  setNewDishActiveTab: Dispatch<SetStateAction<"identity" | "ingredients" | "image">>;
  setNewDishIdentityOpen: Dispatch<SetStateAction<boolean>>;
  setNewDishImageOpen: Dispatch<SetStateAction<boolean>>;
  setNewDishIngredientsOpen: Dispatch<SetStateAction<boolean>>;
  setNewImageDragActive: Dispatch<SetStateAction<boolean>>;
  setNewIngredientSearch: Dispatch<SetStateAction<string>>;
  setNewItemAllergens: Dispatch<SetStateAction<string[]>>;
  setNewItemCategory: Dispatch<SetStateAction<string>>;
  setNewItemDescription: Dispatch<SetStateAction<string>>;
  setNewItemImageFit: Dispatch<SetStateAction<MenuImageFit>>;
  setNewItemIngredientIds: Dispatch<SetStateAction<string[]>>;
  setNewItemName: Dispatch<SetStateAction<string>>;
  setNewItemPrice: Dispatch<SetStateAction<string>>;
  setNewItemSpiceLevel: Dispatch<SetStateAction<number>>;
  setShowItemModal: Dispatch<SetStateAction<boolean>>;
  setShowMobilePhotoPicker: Dispatch<SetStateAction<boolean>>;
  setShowNewExtraAllergensPanel: Dispatch<SetStateAction<boolean>>;
  setShowNewIngredientResults: Dispatch<SetStateAction<boolean>>;
  showMobilePhotoPicker: boolean;
  showNewExtraAllergensPanel: boolean;
  showNewIngredientResults: boolean;
};

/** Finestra "nuovo piatto". */
export function MenuNewDishModal({
  addIngredientFromQuery,
  allergenMap,
  busy,
  createItem,
  draggingNewIngredientId,
  filteredNewIngredientOptions,
  hasNewImage,
  ingredientMap,
  newDetectedAllergenKeys,
  newDishActiveTab,
  newDishIdentityOpen,
  newDishImageOpen,
  newDishIngredientsOpen,
  newImageAnalysis,
  newImageCameraInputRef,
  newImageDragActive,
  newImageInputRef,
  newIngredientExactMatch,
  newIngredientSearch,
  newItemAllergens,
  newItemCategory,
  newItemDescription,
  newItemImageFit,
  newItemIngredientIds,
  newItemName,
  newItemPrice,
  newItemSpiceLevel,
  newSelectableExtraAllergens,
  onNewImageChange,
  openQuickCreateIngredient,
  selectableCategories,
  setDraggingNewIngredientId,
  setNewDishActiveTab,
  setNewDishIdentityOpen,
  setNewDishImageOpen,
  setNewDishIngredientsOpen,
  setNewImageDragActive,
  setNewIngredientSearch,
  setNewItemAllergens,
  setNewItemCategory,
  setNewItemDescription,
  setNewItemImageFit,
  setNewItemIngredientIds,
  setNewItemName,
  setNewItemPrice,
  setNewItemSpiceLevel,
  setShowItemModal,
  setShowMobilePhotoPicker,
  setShowNewExtraAllergensPanel,
  setShowNewIngredientResults,
  showMobilePhotoPicker,
  showNewExtraAllergensPanel,
  showNewIngredientResults,
}: MenuNewDishModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal menu-item-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Aggiungi piatto"
      >
        <div className="admin-modal-head">
          <h3>Nuovo piatto</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowMobilePhotoPicker(false);
              setShowItemModal(false);
            }}
            aria-label="Chiudi popup piatti"
          >
            ×
          </button>
        </div>

        <form className="booking-form menu-item-form" onSubmit={createItem}>
          <div className="menu-item-tabs" role="tablist" aria-label="Nuovo piatto">
            <button
              type="button"
              role="tab"
              aria-selected={newDishActiveTab === "identity"}
              className={
                newDishActiveTab === "identity"
                  ? "menu-item-tab active"
                  : "menu-item-tab"
              }
              onClick={() => setNewDishActiveTab("identity")}
            >
              Identità del piatto
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={newDishActiveTab === "ingredients"}
              className={
                newDishActiveTab === "ingredients"
                  ? "menu-item-tab active"
                  : "menu-item-tab"
              }
              onClick={() => setNewDishActiveTab("ingredients")}
            >
              Ingredienti e allergeni
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={newDishActiveTab === "image"}
              className={
                newDishActiveTab === "image"
                  ? "menu-item-tab active"
                  : "menu-item-tab"
              }
              onClick={() => setNewDishActiveTab("image")}
            >
              Immagine
            </button>
          </div>
          <button
            type="button"
            className="menu-item-section-break menu-item-section-toggle"
            onClick={() => setNewDishIdentityOpen((prev) => !prev)}
            aria-expanded={newDishIdentityOpen}
          >
            <div>
              <h4>Identità del piatto</h4>
            </div>
            <span className="menu-item-section-chevron" aria-hidden>
              ↓
            </span>
          </button>
          {newDishIdentityOpen ? (
            <div className="menu-item-tab-panel" role="tabpanel">
          <label>
            Nome
            <input
              value={newItemName}
              onChange={(event) => {
                setNewItemName(event.currentTarget.value);
              }}
              required
            />
          </label>

          <label>
            Descrizione (opzionale)
            <textarea
              rows={3}
              maxLength={MENU_DESCRIPTION_MAX_LENGTH}
              value={newItemDescription}
              onChange={(event) => {
                setNewItemDescription(event.currentTarget.value);
              }}
              placeholder="Es. Impasto leggero, cottura croccante e gusto deciso."
            />
          </label>

          <div className="two-cols">
            <label className="menu-item-price-field">
              <span className="menu-item-price-label">Prezzo</span>
              <span className="menu-item-price-input-wrap">
                <span className="menu-item-price-currency">€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="12,00"
                  value={newItemPrice}
                  onChange={(event) => {
                    setNewItemPrice(
                      formatPriceDraft(event.currentTarget.value),
                    );
                  }}
                  required
                />
              </span>
            </label>
            <label>
              Categoria
              <select
                value={newItemCategory}
                onChange={(event) => {
                  setNewItemCategory(event.currentTarget.value);
                }}
                required
              >
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Piccantezza (opzionale)
              <div
                className="menu-item-spice-picker"
                role="group"
                aria-label="Piccantezza"
              >
                {[
                  { value: 0, label: "No", icon: "○" },
                  { value: 1, label: "Poco", icon: "🌶" },
                  { value: 2, label: "Media", icon: "🌶🌶" },
                  { value: 3, label: "Alta", icon: "🌶🌶🌶" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={
                      newItemSpiceLevel === option.value
                        ? "menu-item-spice-btn active"
                        : "menu-item-spice-btn"
                    }
                    onClick={() => setNewItemSpiceLevel(option.value)}
                    aria-pressed={newItemSpiceLevel === option.value}
                  >
                    <span aria-hidden>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              <select
                className="menu-item-spice-select-hidden"
                value={String(newItemSpiceLevel)}
                onChange={(event) => {
                  setNewItemSpiceLevel(
                    parseSpiceLevel(event.currentTarget.value),
                  );
                }}
              >
                <option value="0">Non specificata</option>
                <option value="1">🌶 Poco piccante</option>
                <option value="2">🌶🌶 Piccante</option>
                <option value="3">🌶🌶🌶 Molto piccante</option>
              </select>
            </label>
          </div>
            </div>
          ) : null}

          <button
            type="button"
            className="menu-item-section-break menu-item-section-toggle"
            onClick={() => setNewDishIngredientsOpen((prev) => !prev)}
            aria-expanded={newDishIngredientsOpen}
          >
            <div>
              <h4>Ingredienti e allergeni</h4>
            </div>
            <span className="menu-item-section-chevron" aria-hidden>
              ↓
            </span>
          </button>
          {newDishIngredientsOpen ? (
          <div className="menu-item-tab-panel" role="tabpanel">
          <label className="menu-item-field-ingredients">
            Ingredienti
            <div className="ingredient-picker-wrap">
              <input
                className="chip-dropdown-input ingredient-search-input"
                value={newIngredientSearch}
                onFocus={() => {
                  setShowNewIngredientResults(
                    newIngredientSearch.trim().length >= 3,
                  );
                }}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setNewIngredientSearch(value);
                  setShowNewIngredientResults(value.trim().length >= 3);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const result = addIngredientFromQuery(
                    newIngredientSearch,
                    newItemIngredientIds,
                    setNewItemIngredientIds,
                    "new",
                  );
                  if (result === "added" || result === "create") {
                    setNewIngredientSearch("");
                    setShowNewIngredientResults(false);
                  }
                }}
                placeholder="Cerca o aggiungi ingrediente..."
              />
              {showNewIngredientResults &&
              newIngredientSearch.trim().length >= 3 ? (
                <div className="ingredient-search-dropdown">
                  {filteredNewIngredientOptions.length > 0
                    ? filteredNewIngredientOptions
                        .slice(0, 10)
                        .map((ingredient) => {
                          const active = newItemIngredientIds.includes(
                            ingredient.id,
                          );
                          return (
                            <button
                              type="button"
                              key={ingredient.id}
                              className={
                                active
                                  ? "ingredient-search-item active"
                                  : "ingredient-search-item"
                              }
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setNewItemIngredientIds((prev) =>
                                  toggleInArray(prev, ingredient.id),
                                );
                                setShowNewIngredientResults(false);
                                setNewIngredientSearch("");
                              }}
                            >
                              <div>
                                <strong>{ingredient.name}</strong>
                                {ingredient.allergeni.length > 0 ? (
                                  <div className="chip-wrap">
                                    {ingredient.allergeni.map((key) => (
                                      <span
                                        className="allergen-chip"
                                        key={`${ingredient.id}-${key}`}
                                      >
                                        <span
                                          className="allergen-mini-icon"
                                          aria-hidden
                                        >
                                          <AllergenIcon type={key} />
                                        </span>
                                        <span>
                                          {allergenMap[key]?.label ?? key}
                                        </span>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                    : null}
                  {!newIngredientExactMatch &&
                  newIngredientSearch.trim().length >= 2 ? (
                    <button
                      type="button"
                      className="ingredient-search-item create-item"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        openQuickCreateIngredient(
                          newIngredientSearch,
                          "new",
                        );
                        setShowNewIngredientResults(false);
                        setNewIngredientSearch("");
                      }}
                    >
                      + Crea &ldquo;{newIngredientSearch.trim()}&rdquo;
                    </button>
                  ) : null}
                  {filteredNewIngredientOptions.length === 0 &&
                  !(
                    !newIngredientExactMatch &&
                    newIngredientSearch.trim().length >= 2
                  ) ? (
                    <div className="ingredient-empty-state">
                      <p>Nessun ingrediente trovato</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="ingredient-selected-head">
              <strong>
                Ingredienti selezionati ({newItemIngredientIds.length})
              </strong>
            </div>
            <div className="chip-wrap selected-chip-preview">
              {newItemIngredientIds.map((ingredientId) => {
                const ingredient = ingredientMap[ingredientId];
                if (!ingredient) return null;
                return (
                  <button
                    type="button"
                    key={ingredientId}
                    className="ingredient-chip ordered-chip"
                    draggable
                    onDragStart={() => {
                      setDraggingNewIngredientId(ingredientId);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={() => {
                      if (!draggingNewIngredientId) return;
                      setNewItemIngredientIds((prev) =>
                        reorderIds(
                          prev,
                          draggingNewIngredientId,
                          ingredientId,
                        ),
                      );
                      setDraggingNewIngredientId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingNewIngredientId(null);
                    }}
                    onClick={() => {
                      setNewItemIngredientIds((prev) =>
                        prev.filter((id) => id !== ingredientId),
                      );
                    }}
                    title="Trascina per riordinare, clicca per rimuovere"
                  >
                    <span aria-hidden>✓</span>
                    <span>{ingredient.name}</span>
                    <span aria-hidden>✕</span>
                  </button>
                );
              })}
            </div>
            <div className="ingredient-selected-head">
              <strong>Allergeni rilevati</strong>
            </div>
            <div className="chip-wrap">
              {newDetectedAllergenKeys.length > 0 ? (
                newDetectedAllergenKeys.map((key) => (
                  <span
                    className="allergen-chip"
                    key={`new-detected-${key}`}
                  >
                    <span className="allergen-mini-icon" aria-hidden>
                      <AllergenIcon type={key} />
                    </span>
                    <span>{allergenMap[key]?.label ?? key}</span>
                  </span>
                ))
              ) : (
                <span className="section-subtitle">
                  Nessun allergene rilevato
                </span>
              )}
            </div>
            <div className="menu-item-allergen-panel">
              <button
                type="button"
                className="menu-item-allergen-trigger"
                onClick={() =>
                  setShowNewExtraAllergensPanel((prev) => !prev)
                }
                aria-expanded={showNewExtraAllergensPanel}
              >
                <span>Allergeni extra</span>
                <strong>
                  {newItemAllergens.length > 0
                    ? `${newItemAllergens.length} selezionati`
                    : "Nessuno"}
                </strong>
              </button>
              {newItemAllergens.length > 0 ? (
                <div className="chip-wrap menu-item-allergen-summary">
                  {newItemAllergens.map((key) => (
                    <span className="allergen-chip" key={`new-extra-${key}`}>
                      <span className="allergen-mini-icon" aria-hidden>
                        <AllergenIcon type={key} />
                      </span>
                      <span>{allergenMap[key]?.label ?? key}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {showNewExtraAllergensPanel ? (
                <div className="allergen-picker compact menu-item-allergen-drawer">
                  {newSelectableExtraAllergens.map((allergen) => {
                    const active = newItemAllergens.includes(allergen.key);
                    return (
                      <button
                        key={allergen.key}
                        type="button"
                        className={
                          active
                            ? "allergen-toggle active"
                            : "allergen-toggle"
                        }
                        onClick={() => {
                          setNewItemAllergens((prev) =>
                            toggleInArray(prev, allergen.key),
                          );
                        }}
                      >
                        <span className="allergen-mini-icon" aria-hidden>
                          <AllergenIcon type={allergen.key} />
                        </span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </label>
          </div>
          ) : null}

          <button
            type="button"
            className="menu-item-section-break menu-item-section-toggle"
            onClick={() => setNewDishImageOpen((prev) => !prev)}
            aria-expanded={newDishImageOpen}
          >
            <div>
              <h4>Immagine e resa visiva</h4>
            </div>
            <span className="menu-item-section-chevron" aria-hidden>
              ↓
            </span>
          </button>
          {newDishImageOpen ? (
            <div className="menu-item-tab-panel" role="tabpanel">
          <label className="menu-item-field-image">
            <span className="menu-item-image-head">
              <span>Immagine</span>
              <span className="menu-item-image-fit-group">
                <button
                  type="button"
                  className={
                    newItemImageFit === "cover"
                      ? "menu-item-image-fit-btn active"
                      : "menu-item-image-fit-btn"
                  }
                  aria-pressed={newItemImageFit === "cover"}
                  disabled={!hasNewImage}
                  onClick={() => setNewItemImageFit("cover")}
                >
                  Zoomata
                </button>
                <button
                  type="button"
                  className={
                    newItemImageFit === "contain"
                      ? "menu-item-image-fit-btn active"
                      : "menu-item-image-fit-btn"
                  }
                  aria-pressed={newItemImageFit === "contain"}
                  disabled={!hasNewImage}
                  onClick={() => setNewItemImageFit("contain")}
                >
                  Intera
                </button>
              </span>
            </span>
            <input
              ref={newImageInputRef}
              className="menu-item-hidden-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                void onNewImageChange(file);
              }}
            />
            <input
              ref={newImageCameraInputRef}
              className="menu-item-hidden-file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                void onNewImageChange(file);
              }}
            />
            <div
              className={
                newImageDragActive
                  ? "menu-item-upload-dropzone active"
                  : "menu-item-upload-dropzone"
              }
              onDragOver={(event) => {
                event.preventDefault();
                setNewImageDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setNewImageDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0] ?? null;
                void onNewImageChange(file);
              }}
            >
              <div className="menu-item-upload-copy">
                <strong>
                  {hasNewImage
                    ? "Immagine pronta"
                    : "Trascina qui la foto del piatto"}
                </strong>
                <span>
                  Desktop: drag and drop. Mobile: scatta o scegli dalla
                  galleria.
                </span>
              </div>
              <div className="menu-item-upload-actions">
                <button
                  type="button"
                  className="admin-mini-btn menu-item-desktop-upload-btn"
                  onClick={() => newImageInputRef.current?.click()}
                >
                  Scegli foto
                </button>
                <button
                  type="button"
                  className="admin-mini-btn menu-item-mobile-upload-btn"
                  onClick={() => setShowMobilePhotoPicker(true)}
                >
                  Aggiungi foto
                </button>
              </div>
              {showMobilePhotoPicker ? (
                <div className="menu-item-mobile-picker">
                  <button
                    type="button"
                    className="menu-item-mobile-picker-option"
                    onClick={() => newImageInputRef.current?.click()}
                  >
                    Scegli da galleria
                  </button>
                  <button
                    type="button"
                    className="menu-item-mobile-picker-option"
                    onClick={() => newImageCameraInputRef.current?.click()}
                  >
                    Scatta foto
                  </button>
                  <button
                    type="button"
                    className="menu-item-mobile-picker-cancel"
                    onClick={() => setShowMobilePhotoPicker(false)}
                  >
                    Annulla
                  </button>
                </div>
              ) : null}
            </div>
          </label>

          {newImageAnalysis ? (
            <div className="menu-image-meta-panel">
              <span
                className={`admin-image-quality-badge inline ${newImageAnalysis.qualityTier}`}
              >
                {getMenuImageQualityLabel(newImageAnalysis.qualityTier)}
              </span>
              <p className="menu-image-meta-text">
                Originale {newImageAnalysis.originalWidth}×
                {newImageAnalysis.originalHeight} ·{" "}
                {formatBytes(newImageAnalysis.originalFileSize)}
              </p>
              {newImageAnalysis.warning ? (
                <p className="menu-image-warning">
                  {newImageAnalysis.warning}
                </p>
              ) : null}
            </div>
          ) : null}
            </div>
          ) : null}

          <button
            className="btn-success menu-item-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? "Salvataggio..." : "Salva"}
          </button>
        </form>
      </div>
    </div>
  );
}
