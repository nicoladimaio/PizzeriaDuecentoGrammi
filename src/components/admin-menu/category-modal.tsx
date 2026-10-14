import type { Dispatch, FormEvent, SetStateAction } from "react";
import { VisibilityIcon } from "@/components/admin-menu/icons";
import type { MenuCategory } from "@/components/admin-menu/types";

type MenuCategoryModalProps = {
  addCategory: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  busy: boolean;
  categories: MenuCategory[];
  categoryDrafts: Record<string, string>;
  draggingModalCategoryId: string | null;
  moveCategoryByStep: (categoryId: string, step: 1 | -1) => Promise<void>;
  newCategoryName: string;
  removeCategory: (category: MenuCategory) => Promise<void>;
  renameCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (movingId: string, targetId: string) => Promise<void>;
  savingId: string | null;
  setCategoryDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setDraggingModalCategoryId: Dispatch<SetStateAction<string | null>>;
  setNewCategoryName: Dispatch<SetStateAction<string>>;
  setShowCategoryModal: Dispatch<SetStateAction<boolean>>;
  toggleCategoryVisibility: (category: MenuCategory) => Promise<void>;
};

/** Finestra di gestione delle categorie. */
export function MenuCategoryModal({
  addCategory,
  busy,
  categories,
  categoryDrafts,
  draggingModalCategoryId,
  moveCategoryByStep,
  newCategoryName,
  removeCategory,
  renameCategory,
  reorderCategories,
  savingId,
  setCategoryDrafts,
  setDraggingModalCategoryId,
  setNewCategoryName,
  setShowCategoryModal,
  toggleCategoryVisibility,
}: MenuCategoryModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Gestisci categorie"
      >
        <div className="admin-modal-head">
          <h3>Categorie</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowCategoryModal(false);
            }}
            aria-label="Chiudi popup categorie"
          >
            ×
          </button>
        </div>

        <form className="booking-form" onSubmit={addCategory}>
          <label>
            Nuova categoria
            <input
              value={newCategoryName}
              onChange={(event) => {
                setNewCategoryName(event.currentTarget.value);
              }}
              placeholder="Es. Pizze speciali"
              required
            />
          </label>
          <button className="btn-success" type="submit" disabled={busy}>
            Aggiungi
          </button>
        </form>

        <div className="category-list drag-sort-category-list">
          {categories.map((category, index) => (
            <div
              className="category-row draggable"
              key={category.id}
              draggable
              onDragStart={() => {
                setDraggingModalCategoryId(category.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                if (draggingModalCategoryId) {
                  void reorderCategories(
                    draggingModalCategoryId,
                    category.id,
                  );
                }
                setDraggingModalCategoryId(null);
              }}
              onDragEnd={() => {
                setDraggingModalCategoryId(null);
              }}
            >
              <span className="drag-grip" aria-hidden>
                ⠿
              </span>
              <input
                value={categoryDrafts[category.id] ?? category.name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setCategoryDrafts((prev) => ({
                    ...prev,
                    [category.id]: value,
                  }));
                }}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Visibilita categoria ${category.name}`}
                disabled={savingId === category.id}
                onClick={() => {
                  void toggleCategoryVisibility(category);
                }}
              >
                <VisibilityIcon visible={category.visible} />
              </button>
              <button
                type="button"
                className="reorder-shift-btn"
                aria-label={`Sposta su categoria ${category.name}`}
                disabled={busy || savingId === category.id || index === 0}
                onClick={() => {
                  void moveCategoryByStep(category.id, -1);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="reorder-shift-btn"
                aria-label={`Sposta giu categoria ${category.name}`}
                disabled={
                  busy ||
                  savingId === category.id ||
                  index === categories.length - 1
                }
                onClick={() => {
                  void moveCategoryByStep(category.id, 1);
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Modifica categoria ${category.name}`}
                disabled={savingId === category.id}
                onClick={() => {
                  void renameCategory(category.id);
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn danger"
                aria-label={`Elimina categoria ${category.name}`}
                disabled={savingId === category.id}
                onClick={() => {
                  void removeCategory(category);
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
