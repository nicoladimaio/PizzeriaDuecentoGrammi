import Image from "next/image";
import type { MenuItem } from "@/types/menu";

type MenuSectionProps = {
  title: string;
  items: MenuItem[];
};

export function MenuSection({ title, items }: MenuSectionProps) {
  return (
    <section className="menu-section" aria-labelledby={`cat-${title}`}>
      <div className="container">
        <h2 id={`cat-${title}`} className="section-title">
          {title}
        </h2>
        <div className="menu-grid">
          {items.map((item) => {
            const normalizedPrice = String(item.Prezzo ?? "")
              .replace(",", ".")
              .trim();
            const priceNumber = Number(normalizedPrice);
            const displayPrice = Number.isFinite(priceNumber)
              ? `${priceNumber.toFixed(2)} €`
              : normalizedPrice.includes("€")
                ? normalizedPrice
                : `${normalizedPrice} €`;

            const imageSrc = item.Immagine?.startsWith("http")
              ? item.Immagine
              : item.Immagine
                ? `/${item.Immagine.replace(/^\/+/, "")}`
                : "/assets/logo1.png";

            return (
              <article
                className="dish-card"
                key={`${item.Categoria}-${item.Nome}`}
              >
                <div className="dish-media">
                  <Image
                    src={imageSrc}
                    alt={item.Nome}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="dish-body">
                  <h3>{item.Nome}</h3>
                  <p>{item.Ingredienti}</p>
                  <span className="dish-price">{displayPrice}</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
