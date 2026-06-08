import Image from "next/image";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { SpiceLevelIndicator } from "@/components/spice-level-indicator";
import type { MenuProduct } from "@/types/menu-app";

type MenuProductCardProps = {
  product: MenuProduct;
  onOpen: (product: MenuProduct) => void;
};

const formatPrice = (price: number): string => `${price.toFixed(2)} €`;
const warmedImages = new Set<string>();

const warmImage = (src: string) => {
  if (!src || typeof window === "undefined") return;
  if (warmedImages.has(src)) return;
  const img = new window.Image();
  img.decoding = "async";
  img.src = src;
  warmedImages.add(src);
};

export function MenuProductCard({ product, onOpen }: MenuProductCardProps) {
  return (
    <article
      className="qr-product-card"
      onClick={() => {
        warmImage(product.image);
        onOpen(product);
      }}
      onMouseEnter={() => warmImage(product.image)}
      onTouchStart={() => warmImage(product.image)}
      onFocus={() => warmImage(product.image)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          warmImage(product.image);
          onOpen(product);
        }
      }}
    >
      <div className="qr-product-image-wrap">
        <Image
          src={product.imageThumb || product.image}
          alt={product.name}
          fill
          sizes="(max-width: 760px) 42vw, 240px"
          className="qr-product-image"
          quality={68}
        />
      </div>
      <div className="qr-product-body">
        <div className="qr-product-head">
          <h3>{product.name}</h3>
          {/* <div className="qr-product-badges">
            {product.badges.special ? <span>⭐ Specialita</span> : null}
          </div> */}
          <span className="qr-product-price">{formatPrice(product.price)}</span>
        </div>
        <p>{product.description}</p>
        <div className="qr-product-badges">
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
