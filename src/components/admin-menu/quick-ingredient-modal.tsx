import type { Dispatch, SetStateAction } from "react";
import { ALLERGENS } from "@/components/admin-menu/constants";
import { toggleInArray } from "@/components/admin-menu/helpers";
import { AllergenIcon } from "@/components/admin-menu/icons";

type MenuQuickIngredientModalProps = {
  busy: boolean;
  quickIngredientAllergens: string[];
  quickIngredientName: string;
  saveQuickIngredient: () => Promise<void>;
  setQuickIngredientAllergens: Dispatch<SetStateAction<string[]>>;
  setQuickIngredientName: Dispatch<SetStateAction<string>>;
  setShowQuickIngredientCreate: Dispatch<SetStateAction<boolean>>;
};

/** Creazione veloce di un ingrediente dalle finestre piatto. */
export function MenuQuickIngredientModal({
  busy,
  quickIngredientAllergens,
  quickIngredientName,
  saveQuickIngredient,
  setQuickIngredientAllergens,
  setQuickIngredientName,
  setShowQuickIngredientCreate,
}: MenuQuickIngredientModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal ingredient-quick-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Crea ingrediente veloce"
      >
        <div className="admin-modal-head">
          <h3>Crea ingrediente</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowQuickIngredientCreate(false);
            }}
            aria-label="Chiudi creazione ingrediente veloce"
          >
            ×
          </button>
        </div>

        <div className="booking-form">
          <label>
            Nome
            <input
              value={quickIngredientName}
              onChange={(event) => {
                setQuickIngredientName(event.currentTarget.value);
              }}
              placeholder="Es. Pistacchio"
            />
          </label>

          <label>
            Allergeni
            <div className="allergen-picker compact">
              {ALLERGENS.map((allergen) => {
                const active = quickIngredientAllergens.includes(
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
                      setQuickIngredientAllergens((prev) =>
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
                setShowQuickIngredientCreate(false);
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn-success"
              disabled={busy}
              onClick={() => {
                void saveQuickIngredient();
              }}
            >
              {busy ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
