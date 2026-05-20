import Image from "next/image";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { SpiceLevelIndicator } from "@/components/spice-level-indicator";
import type { MenuProduct } from "@/types/menu-app";

type MenuProductCardProps = {
  product: MenuProduct;
  onOpen: (product: MenuProduct) => void;
};

const formatPrice = (price: number): string => `${price.toFixed(2)} €`;

export function MenuProductCard({ product, onOpen }: MenuProductCardProps) {
  return (
    <article
      className="qr-product-card"
      onClick={() => onOpen(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(product);
        }
      }}
    >
      <div className="qr-product-image-wrap">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 760px) 42vw, 240px"
          className="qr-product-image"
        />
      </div>
      <div className="qr-product-body">
        <div className="qr-product-head">
          <h3>{product.name}</h3>
          <span className="qr-product-price">{formatPrice(product.price)}</span>
        </div>
        <p>{product.description}</p>
        <div className="qr-product-badges">
          {product.badges.special ? <span>⭐ Specialita</span> : null}
          {product.badges.hot ? <span>🔥 Piu richiesta</span> : null}
          {product.badges.recent ? <span>🆕 Novita</span> : null}
        </div>
        {product.allergens.length > 0 || product.spiceLevel > 0 ? (
          <div
            className="qr-product-meta-row"
            aria-label="Piccantezza e allergeni del piatto"
          >
            <div className="qr-product-allergens">
              {product.allergens.map((allergen) => (
                <AllergenBadge
                  key={`${product.id}-${allergen}`}
                  allergen={allergen}
                />
              ))}
            </div>
            <div className="qr-product-spice-end">
              <SpiceLevelIndicator
                level={product.spiceLevel}
                className="qr-spice-row-inline"
                showLabel={false}
                hideWhenZero
              />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
