import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ALLERGENS } from "@/components/admin-menu/constants";
import { toggleInArray } from "@/components/admin-menu/helpers";
import { AllergenIcon } from "@/components/admin-menu/icons";

type MenuNewIngredientModalProps = {
  busy: boolean;
  newIngredientAllergens: string[];
  newIngredientName: string;
  saveNewIngredient: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setNewIngredientAllergens: Dispatch<SetStateAction<string[]>>;
  setNewIngredientName: Dispatch<SetStateAction<string>>;
  setShowIngredientModal: Dispatch<SetStateAction<boolean>>;
};

/** Finestra "nuovo ingrediente". */
export function MenuNewIngredientModal({
  busy,
  newIngredientAllergens,
  newIngredientName,
  saveNewIngredient,
  setNewIngredientAllergens,
  setNewIngredientName,
  setShowIngredientModal,
}: MenuNewIngredientModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Aggiungi ingrediente"
      >
        <div className="admin-modal-head">
          <h3>Nuovo ingrediente</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowIngredientModal(false);
            }}
            aria-label="Chiudi popup ingrediente"
          >
            ×
          </button>
        </div>
        <form className="booking-form" onSubmit={saveNewIngredient}>
          <label>
            Nome ingrediente
            <input
              value={newIngredientName}
              onChange={(event) => {
                setNewIngredientName(event.currentTarget.value);
              }}
              required
            />
          </label>
          <label>
            Allergeni
            <div className="allergen-picker compact">
              {ALLERGENS.map((allergen) => {
                const active = newIngredientAllergens.includes(
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
                      setNewIngredientAllergens((prev) =>
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
          <button className="btn-success" type="submit" disabled={busy}>
            Salva ingrediente
          </button>
        </form>
      </div>
    </div>
  );
}
