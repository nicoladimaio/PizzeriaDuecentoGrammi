import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import {
  DEFAULT_MENU_IMAGE,
  MENU_DESCRIPTION_MAX_LENGTH,
} from "@/components/admin-menu/constants";
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
  AdminMenuItem,
  AllergenDef,
  ImageUploadAnalysis,
  MenuCategory,
  MenuIngredient,
} from "@/components/admin-menu/types";
import { parseSpiceLevel } from "@/lib/menu-parsing";
import type { MenuImageFit, MenuImageMeta } from "@/types/menu-app";

type MenuEditDishModalProps = {
  addIngredientFromQuery: (query: string, selectedIds: string[], setSelectedIds: Dispatch<SetStateAction<string[]>>, target: "new" | "edit") => "added" | "create" | "noop";
  allergenMap: Record<string, AllergenDef>;
  draggingEditIngredientId: string | null;
  editDetectedAllergenKeys: string[];
  editDishActiveTab: "identity" | "ingredients" | "image";
  editDishIdentityOpen: boolean;
  editDishImageOpen: boolean;
  editDishIngredientsOpen: boolean;
  editImageAnalysis: ImageUploadAnalysis | null;
  editImageCameraInputRef: RefObject<HTMLInputElement | null>;
  editImageDragActive: boolean;
  editImageInputRef: RefObject<HTMLInputElement | null>;
  editImagePreview: string;
  editingItem: AdminMenuItem;
  editingItemMeta: MenuImageMeta | undefined;
  editIngredientExactMatch: MenuIngredient | null;
  editIngredientSearch: string;
  editItemAllergens: string[];
  editItemCategory: string;
  editItemDescription: string;
  editItemImageFit: MenuImageFit;
  editItemIngredientIds: string[];
  editItemName: string;
  editItemPrice: string;
  editItemSpecial: boolean;
  editItemSpiceLevel: number;
  editSelectableExtraAllergens: AllergenDef[];
  filteredEditIngredientOptions: MenuIngredient[];
  hasEditImage: boolean;
  ingredientMap: Record<string, MenuIngredient>;
  onEditImageChange: (file: File | null) => Promise<void>;
  openQuickCreateIngredient: (name: string, target: "new" | "edit") => void;
  saveEditedItem: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  savingId: string | null;
  selectableCategories: MenuCategory[];
  setDraggingEditIngredientId: Dispatch<SetStateAction<string | null>>;
  setEditDishActiveTab: Dispatch<SetStateAction<"identity" | "ingredients" | "image">>;
  setEditDishIdentityOpen: Dispatch<SetStateAction<boolean>>;
  setEditDishImageOpen: Dispatch<SetStateAction<boolean>>;
  setEditDishIngredientsOpen: Dispatch<SetStateAction<boolean>>;
  setEditImageDragActive: Dispatch<SetStateAction<boolean>>;
  setEditingItemId: Dispatch<SetStateAction<string | null>>;
  setEditIngredientSearch: Dispatch<SetStateAction<string>>;
  setEditItemAllergens: Dispatch<SetStateAction<string[]>>;
  setEditItemCategory: Dispatch<SetStateAction<string>>;
  setEditItemDescription: Dispatch<SetStateAction<string>>;
  setEditItemImageFit: Dispatch<SetStateAction<MenuImageFit>>;
  setEditItemIngredientIds: Dispatch<SetStateAction<string[]>>;
  setEditItemName: Dispatch<SetStateAction<string>>;
  setEditItemPrice: Dispatch<SetStateAction<string>>;
  setEditItemSpecial: Dispatch<SetStateAction<boolean>>;
  setEditItemSpiceLevel: Dispatch<SetStateAction<number>>;
  setShowEditExtraAllergensPanel: Dispatch<SetStateAction<boolean>>;
  setShowEditIngredientResults: Dispatch<SetStateAction<boolean>>;
  setShowEditMobilePhotoPicker: Dispatch<SetStateAction<boolean>>;
  showEditExtraAllergensPanel: boolean;
  showEditIngredientResults: boolean;
  showEditMobilePhotoPicker: boolean;
};

/** Finestra "modifica piatto". */
export function MenuEditDishModal({
  addIngredientFromQuery,
  allergenMap,
  draggingEditIngredientId,
  editDetectedAllergenKeys,
  editDishActiveTab,
  editDishIdentityOpen,
  editDishImageOpen,
  editDishIngredientsOpen,
  editImageAnalysis,
  editImageCameraInputRef,
  editImageDragActive,
  editImageInputRef,
  editImagePreview,
  editingItem,
  editingItemMeta,
  editIngredientExactMatch,
  editIngredientSearch,
  editItemAllergens,
  editItemCategory,
  editItemDescription,
  editItemImageFit,
  editItemIngredientIds,
  editItemName,
  editItemPrice,
  editItemSpecial,
  editItemSpiceLevel,
  editSelectableExtraAllergens,
  filteredEditIngredientOptions,
  hasEditImage,
  ingredientMap,
  onEditImageChange,
  openQuickCreateIngredient,
  saveEditedItem,
  savingId,
  selectableCategories,
  setDraggingEditIngredientId,
  setEditDishActiveTab,
  setEditDishIdentityOpen,
  setEditDishImageOpen,
  setEditDishIngredientsOpen,
  setEditImageDragActive,
  setEditingItemId,
  setEditIngredientSearch,
  setEditItemAllergens,
  setEditItemCategory,
  setEditItemDescription,
  setEditItemImageFit,
  setEditItemIngredientIds,
  setEditItemName,
  setEditItemPrice,
  setEditItemSpecial,
  setEditItemSpiceLevel,
  setShowEditExtraAllergensPanel,
  setShowEditIngredientResults,
  setShowEditMobilePhotoPicker,
  showEditExtraAllergensPanel,
  showEditIngredientResults,
  showEditMobilePhotoPicker,
}: MenuEditDishModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal menu-item-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Modifica piatto"
      >
        <div className="admin-modal-head">
          <h3>Modifica piatto</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowEditMobilePhotoPicker(false);
              setEditImageDragActive(false);
              setEditingItemId(null);
            }}
            aria-label="Chiudi modifica piatto"
          >
            ×
          </button>
        </div>

        <form
          className="booking-form menu-item-form"
          onSubmit={saveEditedItem}
        >
          <div className="menu-item-tabs" role="tablist" aria-label="Modifica piatto">
            <button
              type="button"
              role="tab"
              aria-selected={editDishActiveTab === "identity"}
              className={
                editDishActiveTab === "identity"
                  ? "menu-item-tab active"
                  : "menu-item-tab"
              }
              onClick={() => setEditDishActiveTab("identity")}
            >
              Identità del piatto
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editDishActiveTab === "ingredients"}
              className={
                editDishActiveTab === "ingredients"
                  ? "menu-item-tab active"
                  : "menu-item-tab"
              }
              onClick={() => setEditDishActiveTab("ingredients")}
            >
              Ingredienti e allergeni
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editDishActiveTab === "image"}
              className={
                editDishActiveTab === "image"
                  ? "menu-item-tab active"
                  : "menu-item-tab"
              }
              onClick={() => setEditDishActiveTab("image")}
            >
              Immagine
            </button>
          </div>

          <button
            type="button"
            className="menu-item-section-break menu-item-section-toggle"
            onClick={() => setEditDishIdentityOpen((prev) => !prev)}
            aria-expanded={editDishIdentityOpen}
          >
            <div>
              <h4>Identità del piatto</h4>
            </div>
            <span className="menu-item-section-chevron" aria-hidden>
              ↓
            </span>
          </button>
          {editDishIdentityOpen ? (
            <div className="menu-item-tab-panel" role="tabpanel">
              <label>
                Nome
                <input
                  value={editItemName}
                  onChange={(event) => {
                    setEditItemName(event.currentTarget.value);
                  }}
                  required
                />
              </label>

              <label>
                Descrizione (opzionale)
                <textarea
                  rows={3}
                  maxLength={MENU_DESCRIPTION_MAX_LENGTH}
                  value={editItemDescription}
                  onChange={(event) => {
                    setEditItemDescription(event.currentTarget.value);
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
                      value={editItemPrice}
                      onChange={(event) => {
                        setEditItemPrice(
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
                    value={editItemCategory}
                    onChange={(event) => {
                      setEditItemCategory(event.currentTarget.value);
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
                          editItemSpiceLevel === option.value
                            ? "menu-item-spice-btn active"
                            : "menu-item-spice-btn"
                        }
                        onClick={() => setEditItemSpiceLevel(option.value)}
                        aria-pressed={editItemSpiceLevel === option.value}
                      >
                        <span aria-hidden>{option.icon}</span>
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <select
                    className="menu-item-spice-select-hidden"
                    value={String(editItemSpiceLevel)}
                    onChange={(event) => {
                      setEditItemSpiceLevel(
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

              <label>
                Mostra in Le nostre firme
                <select
                  value={editItemSpecial ? "1" : "0"}
                  onChange={(event) => {
                    setEditItemSpecial(event.currentTarget.value === "1");
                  }}
                >
                  <option value="0">No</option>
                  <option value="1">Si, metti la stella</option>
                </select>
              </label>
            </div>
          ) : null}

          <button
            type="button"
            className="menu-item-section-break menu-item-section-toggle"
            onClick={() => setEditDishIngredientsOpen((prev) => !prev)}
            aria-expanded={editDishIngredientsOpen}
          >
            <div>
              <h4>Ingredienti e allergeni</h4>
            </div>
            <span className="menu-item-section-chevron" aria-hidden>
              ↓
            </span>
          </button>
          {editDishIngredientsOpen ? (
            <div className="menu-item-tab-panel" role="tabpanel">
              <label className="menu-item-field-ingredients">
                Ingredienti
                <div className="ingredient-picker-wrap">
                  <input
                    className="chip-dropdown-input ingredient-search-input"
                    value={editIngredientSearch}
                    onFocus={() => {
                      setShowEditIngredientResults(
                        editIngredientSearch.trim().length >= 3,
                      );
                    }}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setEditIngredientSearch(value);
                      setShowEditIngredientResults(value.trim().length >= 3);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const result = addIngredientFromQuery(
                        editIngredientSearch,
                        editItemIngredientIds,
                        setEditItemIngredientIds,
                        "edit",
                      );
                      if (result === "added" || result === "create") {
                        setEditIngredientSearch("");
                        setShowEditIngredientResults(false);
                      }
                    }}
                    placeholder="Cerca o aggiungi ingrediente..."
                  />
                  {showEditIngredientResults &&
                  editIngredientSearch.trim().length >= 3 ? (
                    <div className="ingredient-search-dropdown">
                      {filteredEditIngredientOptions.length > 0
                        ? filteredEditIngredientOptions
                            .slice(0, 10)
                            .map((ingredient) => {
                              const active = editItemIngredientIds.includes(
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
                                    setEditItemIngredientIds((prev) =>
                                      toggleInArray(prev, ingredient.id),
                                    );
                                    setShowEditIngredientResults(false);
                                    setEditIngredientSearch("");
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
                      {!editIngredientExactMatch &&
                      editIngredientSearch.trim().length >= 2 ? (
                        <button
                          type="button"
                          className="ingredient-search-item create-item"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            openQuickCreateIngredient(
                              editIngredientSearch,
                              "edit",
                            );
                            setShowEditIngredientResults(false);
                            setEditIngredientSearch("");
                          }}
                        >
                          + Crea &ldquo;{editIngredientSearch.trim()}&rdquo;
                        </button>
                      ) : null}
                      {filteredEditIngredientOptions.length === 0 &&
                      !(
                        !editIngredientExactMatch &&
                        editIngredientSearch.trim().length >= 2
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
                    Ingredienti selezionati ({editItemIngredientIds.length})
                  </strong>
                </div>
                <div className="chip-wrap selected-chip-preview">
                  {editItemIngredientIds.map((ingredientId) => {
                    const ingredient = ingredientMap[ingredientId];
                    if (!ingredient) return null;
                    return (
                      <button
                        type="button"
                        className="ingredient-chip ordered-chip"
                        key={ingredientId}
                        draggable
                        onDragStart={() => {
                          setDraggingEditIngredientId(ingredientId);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (!draggingEditIngredientId) return;
                          setEditItemIngredientIds((prev) =>
                            reorderIds(
                              prev,
                              draggingEditIngredientId,
                              ingredientId,
                            ),
                          );
                          setDraggingEditIngredientId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingEditIngredientId(null);
                        }}
                        onClick={() => {
                          setEditItemIngredientIds((prev) =>
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
                  {editDetectedAllergenKeys.length > 0 ? (
                    editDetectedAllergenKeys.map((key) => (
                      <span
                        className="allergen-chip"
                        key={`edit-detected-${key}`}
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
                      setShowEditExtraAllergensPanel((prev) => !prev)
                    }
                    aria-expanded={showEditExtraAllergensPanel}
                  >
                    <span>Allergeni extra</span>
                    <strong>
                      {editItemAllergens.length > 0
                        ? `${editItemAllergens.length} selezionati`
                        : "Nessuno"}
                    </strong>
                  </button>
                  {editItemAllergens.length > 0 ? (
                    <div className="chip-wrap menu-item-allergen-summary">
                      {editItemAllergens.map((key) => (
                        <span className="allergen-chip" key={`edit-extra-${key}`}>
                          <span className="allergen-mini-icon" aria-hidden>
                            <AllergenIcon type={key} />
                          </span>
                          <span>{allergenMap[key]?.label ?? key}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {showEditExtraAllergensPanel ? (
                    <div className="allergen-picker compact menu-item-allergen-drawer">
                      {editSelectableExtraAllergens.map((allergen) => {
                        const active = editItemAllergens.includes(allergen.key);
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
                              setEditItemAllergens((prev) =>
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
            onClick={() => setEditDishImageOpen((prev) => !prev)}
            aria-expanded={editDishImageOpen}
          >
            <div>
              <h4>Immagine e resa visiva</h4>
            </div>
            <span className="menu-item-section-chevron" aria-hidden>
              ↓
            </span>
          </button>
          {editDishImageOpen ? (
            <div className="menu-item-tab-panel" role="tabpanel">
              <label className="menu-item-field-image">
                <span className="menu-item-image-head">
                  <span>Immagine</span>
                  <span className="menu-item-image-fit-group">
                    <button
                      type="button"
                      className={
                        editItemImageFit === "cover"
                          ? "menu-item-image-fit-btn active"
                          : "menu-item-image-fit-btn"
                      }
                      aria-pressed={editItemImageFit === "cover"}
                      disabled={!hasEditImage}
                      onClick={() => setEditItemImageFit("cover")}
                    >
                      Zoomata
                    </button>
                    <button
                      type="button"
                      className={
                        editItemImageFit === "contain"
                          ? "menu-item-image-fit-btn active"
                          : "menu-item-image-fit-btn"
                      }
                      aria-pressed={editItemImageFit === "contain"}
                      disabled={!hasEditImage}
                      onClick={() => setEditItemImageFit("contain")}
                    >
                      Intera
                    </button>
                  </span>
                </span>
                <input
                  ref={editImageInputRef}
                  className="menu-item-hidden-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onEditImageChange(file);
                  }}
                />
                <input
                  ref={editImageCameraInputRef}
                  className="menu-item-hidden-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null;
                    void onEditImageChange(file);
                  }}
                />
                <div
                  className={
                    editImageDragActive
                      ? "menu-item-upload-dropzone active"
                      : "menu-item-upload-dropzone"
                  }
                  onDragOver={(event) => {
                    event.preventDefault();
                    setEditImageDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setEditImageDragActive(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0] ?? null;
                    void onEditImageChange(file);
                  }}
                >
                  <div className="menu-item-upload-copy">
                    <strong>
                      {hasEditImage
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
                      onClick={() => editImageInputRef.current?.click()}
                    >
                      Scegli foto
                    </button>
                    <button
                      type="button"
                      className="admin-mini-btn menu-item-mobile-upload-btn"
                      onClick={() => setShowEditMobilePhotoPicker(true)}
                    >
                      Aggiungi foto
                    </button>
                  </div>
                  {showEditMobilePhotoPicker ? (
                    <div className="menu-item-mobile-picker">
                      <button
                        type="button"
                        className="menu-item-mobile-picker-option"
                        onClick={() => editImageInputRef.current?.click()}
                      >
                        Scegli da galleria
                      </button>
                      <button
                        type="button"
                        className="menu-item-mobile-picker-option"
                        onClick={() => editImageCameraInputRef.current?.click()}
                      >
                        Scatta foto
                      </button>
                      <button
                        type="button"
                        className="menu-item-mobile-picker-cancel"
                        onClick={() => setShowEditMobilePhotoPicker(false)}
                      >
                        Annulla
                      </button>
                    </div>
                  ) : null}
                </div>
              </label>

              {editImageAnalysis ? (
                <div className="menu-image-meta-panel">
                  <span
                    className={`admin-image-quality-badge inline ${editImageAnalysis.qualityTier}`}
                  >
                    {getMenuImageQualityLabel(editImageAnalysis.qualityTier)}
                  </span>
                  <p className="menu-image-meta-text">
                    Originale {editImageAnalysis.originalWidth}×
                    {editImageAnalysis.originalHeight} ·{" "}
                    {formatBytes(editImageAnalysis.originalFileSize)}
                  </p>
                  {editImageAnalysis.warning ? (
                    <p className="menu-image-warning">
                      {editImageAnalysis.warning}
                    </p>
                  ) : null}
                </div>
              ) : editingItemMeta?.qualityTier ? (
                <div className="menu-image-meta-panel">
                  <span
                    className={`admin-image-quality-badge inline ${editingItemMeta.qualityTier}`}
                  >
                    {getMenuImageQualityLabel(editingItemMeta.qualityTier)}
                  </span>
                  <p className="menu-image-meta-text">
                    Originale {editingItemMeta.originalWidth ?? "?"}×
                    {editingItemMeta.originalHeight ?? "?"}
                    {editingItemMeta.originalFileSize
                      ? ` · ${formatBytes(editingItemMeta.originalFileSize)}`
                      : ""}
                    {editingItemMeta.optimizedFileSize
                      ? ` · WebP ${formatBytes(editingItemMeta.optimizedFileSize)}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <div className="admin-preview-box">
                {hasEditImage ? (
                  <img
                    src={
                      editImagePreview ||
                      editingItem.immagine ||
                      DEFAULT_MENU_IMAGE
                    }
                    alt="Anteprima modifica piatto"
                    className="admin-preview-image"
                  />
                ) : (
                  <div className="admin-preview-placeholder">
                    Nessuna immagine caricata
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <button
            className="btn-success menu-item-submit"
            type="submit"
            disabled={savingId === editingItem.id}
          >
            {savingId === editingItem.id
              ? "Salvataggio..."
              : "Salva"}
          </button>
        </form>
      </div>
    </div>
  );
}
