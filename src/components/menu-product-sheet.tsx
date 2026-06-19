import { useEffect, useState } from "react";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { SpiceLevelIndicator } from "@/components/spice-level-indicator";
import type { MenuProduct } from "@/types/menu-app";

type MenuProductSheetProps = {
  product: MenuProduct | null;
  labels?: {
    detailAria: string;
    closeAria: string;
    ingredients: string;
    allergensAria: string;
  };
  onClose: () => void;
};

const formatPrice = (price: number): string => `${price.toFixed(2)} €`;

const normalizeComparableText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const toReadableAllergen = (value: string): string => {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((chunk) =>
      chunk.length > 0 ? chunk[0].toUpperCase() + chunk.slice(1) : chunk,
    )
    .join(" ");
};

export function MenuProductSheet({
  product,
  labels,
  onClose,
}: MenuProductSheetProps) {
  const [readyImageProductId, setReadyImageProductId] = useState<string | null>(
    null,
  );
  const [imageMode, setImageMode] = useState<"contain" | "cover">("contain");

  useEffect(() => {
    if (!product) return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [product]);

  useEffect(() => {
    if (!product) return;
    setImageMode("contain");

    const thumb = product.imageThumb || product.image;
    if (!product.image || product.image === thumb) return;

    const currentProductId = product.id;
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => {
      const ratio =
        img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      setImageMode(ratio < 1.2 ? "cover" : "contain");
      setReadyImageProductId(currentProductId);
    };
    img.onerror = () => setReadyImageProductId(currentProductId);
    img.src = product.image;
  }, [product]);

  useEffect(() => {
    if (!product?.imageThumb && !product?.image) return;

    const probe = new window.Image();
    probe.decoding = "async";
    probe.onload = () => {
      const ratio =
        probe.naturalHeight > 0
          ? probe.naturalWidth / probe.naturalHeight
          : 1;
      setImageMode(ratio < 1.2 ? "cover" : "contain");
    };
    probe.src = product.imageThumb || product.image;
  }, [product]);

  const activeProduct = product;
  const fullImageReady =
    activeProduct === null
      ? false
      : (activeProduct.imageThumb || activeProduct.image) ===
          activeProduct.image || readyImageProductId === activeProduct.id;

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
        aria-label={labels?.detailAria ?? "Dettaglio prodotto"}
      >
        {product ? (
          <>
            {(() => {
              const ingredientsText = product.ingredients.join(", ");
              const showIngredientsRow =
                product.ingredients.length > 0 &&
                normalizeComparableText(product.description) !==
                  normalizeComparableText(ingredientsText);

              return (
                <>
                  <button
                    type="button"
                    className="qr-sheet-close"
                    onClick={onClose}
                    aria-label={labels?.closeAria ?? "Chiudi dettaglio"}
                  >
                    ✕
                  </button>
                  <div className="qr-sheet-image-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        fullImageReady
                          ? product.image
                          : product.imageThumb || product.image
                      }
                      alt={product.name}
                      className={
                        imageMode === "cover"
                          ? "qr-sheet-image qr-sheet-image-cover"
                          : "qr-sheet-image"
                      }
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
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
                    {showIngredientsRow ? (
                      <div className="qr-sheet-ingredients">
                        <strong>{labels?.ingredients ?? "Ingredienti"}:</strong>{" "}
                        {product.ingredients.join(", ")}
                      </div>
                    ) : null}
                    <SpiceLevelIndicator
                      level={product.spiceLevel}
                      className="qr-spice-row qr-spice-row-detail"
                      showLabel
                      hideWhenZero
                    />
                    {product.allergens.length > 0 ? (
                      <div
                        className="qr-sheet-allergens"
                        aria-label={
                          labels?.allergensAria ?? "Allergeni del piatto"
                        }
                      >
                        {product.allergens.map((allergen) => (
                          <AllergenBadge
                            key={`${product.id}-${allergen}`}
                            allergen={toReadableAllergen(allergen)}
                            showLabel
                            showTooltip={false}
                            className="qr-sheet-allergen-chip"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </>
        ) : null}
      </aside>
    </div>
  );
}
