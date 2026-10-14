import type { Dispatch, SetStateAction } from "react";
import { ALLERGENS } from "@/components/admin-menu/constants";
import { toggleInArray } from "@/components/admin-menu/helpers";
import { AllergenIcon } from "@/components/admin-menu/icons";

type MenuEditIngredientModalProps = {
  editingIngredientId: string | null;
  ingredientEditAllergens: string[];
  ingredientEditName: string;
  saveIngredientEdit: () => Promise<void>;
  savingId: string | null;
  setEditingIngredientId: Dispatch<SetStateAction<string | null>>;
  setIngredientEditAllergens: Dispatch<SetStateAction<string[]>>;
  setIngredientEditName: Dispatch<SetStateAction<string>>;
};

/** Finestra "modifica ingrediente". */
export function MenuEditIngredientModal({
  editingIngredientId,
  ingredientEditAllergens,
  ingredientEditName,
  saveIngredientEdit,
  savingId,
  setEditingIngredientId,
  setIngredientEditAllergens,
  setIngredientEditName,
}: MenuEditIngredientModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Modifica ingrediente"
      >
        <div className="admin-modal-head">
          <h3>Modifica ingrediente</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setEditingIngredientId(null);
              setIngredientEditName("");
              setIngredientEditAllergens([]);
            }}
            aria-label="Chiudi popup modifica ingrediente"
          >
            ×
          </button>
        </div>
        <form
          className="booking-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveIngredientEdit();
          }}
        >
          <label>
            Nome
            <input
              value={ingredientEditName}
              onChange={(event) => {
                setIngredientEditName(event.currentTarget.value);
              }}
            />
          </label>
          <label>
            Allergeni
            <div className="allergen-picker compact">
              {ALLERGENS.map((allergen) => {
                const active = ingredientEditAllergens.includes(
                  allergen.key,
                );
                return (
                  <button
                    type="button"
                    key={allergen.key}
                    className={
                      active ? "allergen-toggle active" : "allergen-toggle"
                    }
                    onClick={() => {
                      setIngredientEditAllergens((prev) =>
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
          </label>
          <div className="admin-menu-toolbar minimal-right">
            <button
              type="button"
              className="admin-mini-btn"
              onClick={() => {
                setEditingIngredientId(null);
                setIngredientEditName("");
                setIngredientEditAllergens([]);
              }}
            >
              Annulla
            </button>
            <button
              className="btn-success"
              type="submit"
              disabled={savingId === editingIngredientId}
            >
              {savingId === editingIngredientId
                ? "Salvataggio..."
                : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
