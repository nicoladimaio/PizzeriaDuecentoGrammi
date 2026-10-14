import { AllergenIcon } from "@/components/admin-menu/icons";
import type {
  AllergenDef,
  MenuIngredient,
} from "@/components/admin-menu/types";

type MenuIngredientsViewProps = {
  allergenMap: Record<string, AllergenDef>;
  filteredIngredients: MenuIngredient[];
  openIngredientEdit: (ingredient: MenuIngredient) => void;
  removeIngredient: (ingredientId: string) => Promise<void>;
  savingId: string | null;
};

/** Elenco degli ingredienti con ricerca e filtri. */
export function MenuIngredientsView({
  allergenMap,
  filteredIngredients,
  openIngredientEdit,
  removeIngredient,
  savingId,
}: MenuIngredientsViewProps) {
  return (
    <>
      {filteredIngredients.length === 0 ? (
        <article className="admin-card empty-state-card">
          <p className="section-subtitle">Nessun ingrediente trovato</p>
        </article>
      ) : (
        <div className="admin-grid compact-cards ingredient-square-grid">
          {filteredIngredients.map((ingredient) => {
            return (
              <article
                className="ingredient-square-card reduced"
                key={ingredient.id}
              >
                <h4>{ingredient.name}</h4>

                <div className="chip-wrap">
                  {ingredient.allergeni.map((key) => (
                    <span className="allergen-chip" key={key}>
                      <span className="allergen-mini-icon" aria-hidden>
                        <AllergenIcon type={key} />
                      </span>
                      <span>{allergenMap[key]?.label ?? key}</span>
                    </span>
                  ))}
                </div>

                <div className="admin-dish-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Modifica ingrediente ${ingredient.name}`}
                    onClick={() => {
                      openIngredientEdit(ingredient);
                    }}
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Elimina ingrediente ${ingredient.name}`}
                    disabled={savingId === ingredient.id}
                    onClick={() => {
                      void removeIngredient(ingredient.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
