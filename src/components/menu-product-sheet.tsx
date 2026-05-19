import Image from "next/image";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import type { MenuProduct } from "@/types/menu-app";

type MenuProductSheetProps = {
  product: MenuProduct | null;
  onClose: () => void;
};

const formatPrice = (price: number): string => `${price.toFixed(2)} €`;

export function MenuProductSheet({ product, onClose }: MenuProductSheetProps) {
  return (
    <div
      className={product ? "qr-sheet-backdrop open" : "qr-sheet-backdrop"}
      onClick={onClose}
      aria-hidden={!product}
    >
      <aside
        className={product ? "qr-sheet open" : "qr-sheet"}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Dettaglio prodotto"
      >
        {product ? (
          <>
            <button
              type="button"
              className="qr-sheet-close"
              onClick={onClose}
              aria-label="Chiudi dettaglio"
            >
              ✕
            </button>
            <div className="qr-sheet-image-wrap">
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes="100vw"
                className="qr-sheet-image"
              />
            </div>
            <div className="qr-sheet-content">
              <div className="qr-sheet-title-row">
                <h3>{product.name}</h3>
                <span className="qr-product-price">
                  {formatPrice(product.price)}
                </span>
              </div>
              <p className="qr-sheet-desc">{product.description}</p>
              {product.allergens.length > 0 ? (
                <div
                  className="qr-sheet-allergens"
                  aria-label="Allergeni del piatto"
                >
                  {product.allergens.map((allergen) => (
                    <AllergenBadge
                      key={`${product.id}-${allergen}`}
                      allergen={allergen}
                    />
                  ))}
                </div>
              ) : (
                <p>Nessuno indicato</p>
              )}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
