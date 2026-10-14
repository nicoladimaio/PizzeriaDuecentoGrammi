import type { Dispatch, SetStateAction } from "react";
import { ALLERGENS } from "@/components/admin-menu/constants";
import { toggleInArray } from "@/components/admin-menu/helpers";
import { AllergenIcon } from "@/components/admin-menu/icons";

type MenuAllergenFiltersModalProps = {
  selectedAllergenFilters: string[];
  setSelectedAllergenFilters: Dispatch<SetStateAction<string[]>>;
  setShowAllergenFilters: Dispatch<SetStateAction<boolean>>;
};

/** Filtri per allergene nell'elenco ingredienti. */
export function MenuAllergenFiltersModal({
  selectedAllergenFilters,
  setSelectedAllergenFilters,
  setShowAllergenFilters,
}: MenuAllergenFiltersModalProps) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Filtra ingredienti per allergeni"
      >
        <div className="admin-modal-head">
          <h3>Filtra per allergeni</h3>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowAllergenFilters(false);
            }}
            aria-label="Chiudi popup filtri allergeni"
          >
            ×
          </button>
        </div>

        <div className="allergen-grid modern-allergen-grid">
          {ALLERGENS.map((allergen) => {
            const active = selectedAllergenFilters.includes(allergen.key);
            return (
              <button
                key={allergen.key}
                type="button"
                className={
                  active
                    ? "allergen-card filter active"
                    : "allergen-card filter"
                }
                onClick={() => {
                  setSelectedAllergenFilters((prev) =>
                    toggleInArray(prev, allergen.key),
                  );
                }}
              >
                <span className="allergen-icon modern" aria-hidden>
                  <AllergenIcon type={allergen.key} />
                </span>
                <span>{allergen.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className="admin-menu-toolbar minimal-right"
          style={{ marginTop: "0.9rem" }}
        >
          <button
            type="button"
            className="admin-mini-btn"
            onClick={() => {
              setSelectedAllergenFilters([]);
            }}
          >
            Reset filtri
          </button>
          <button
            type="button"
            className="btn-success"
            onClick={() => {
              setShowAllergenFilters(false);
            }}
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  );
}
