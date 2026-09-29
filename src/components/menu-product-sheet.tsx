import { useEffect, useState } from "react";
import { AllergenBadge } from "@/components/allergens/allergen-badge";
import { SpiceLevelIndicator } from "@/components/spice-level-indicator";
import { useSpiceLabels } from "@/hooks/use-spice-labels";
import { getMenuImageSrc } from "@/lib/menu-image-cdn";
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
  const spiceLabels = useSpiceLabels();
  // Misure reali della foto, legate al suo indirizzo: aprendo un altro piatto
  // non si riusano per sbaglio quelle della foto precedente.
  const [measured, setMeasured] = useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);
  const probeSrc = product
    ? product.image || product.imageThumb || "/assets/logo.jpg"
    : null;
  const imageNaturalSize =
    measured && measured.src === probeSrc ? measured : null;
  // Formato scelto nel pannello, altrimenti dedotto dalle proporzioni.
  const imageMode: "contain" | "cover" =
    product?.imageFit === "contain" || product?.imageFit === "cover"
      ? product.imageFit
      : imageNaturalSize && imageNaturalSize.width / imageNaturalSize.height < 1.2
        ? "cover"
        : "contain";

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
    if (!probeSrc || !product?.image) return;

    const probe = new window.Image();
    probe.decoding = "async";
    probe.onload = () => {
      setMeasured({
        src: probeSrc,
        width: Math.max(1, probe.naturalWidth || 1),
        height: Math.max(1, probe.naturalHeight || 1),
      });
    };
    probe.src = probeSrc;
  }, [probeSrc, product?.image]);

  const preserveNaturalDetail =
    imageNaturalSize !== null &&
    Math.max(imageNaturalSize.width, imageNaturalSize.height) <= 520;
  const detailImageSrc = product
    ? getMenuImageSrc(
        product.image || product.imageThumb || "/assets/logo.jpg",
        "detail",
        product.imageFit,
      )
    : "/assets/logo.jpg";

  const sheetImageStyle = preserveNaturalDetail
    ? {
        width: `${imageNaturalSize.width}px`,
        height: `${imageNaturalSize.height}px`,
        maxWidth: "calc(100% - 28px)",
        maxHeight: "calc(100% - 28px)",
        margin: "auto",
      }
    : undefined;

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
                      src={detailImageSrc}
                      alt={product.name}
                      className={
                        imageMode === "cover"
                          ? "qr-sheet-image qr-sheet-image-cover"
                          : preserveNaturalDetail
                            ? "qr-sheet-image qr-sheet-image-preserve"
                            : "qr-sheet-image"
                      }
                      style={sheetImageStyle}
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
                      labels={spiceLabels}
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
