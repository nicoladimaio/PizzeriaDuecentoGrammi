"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";

type FeaturedItem = {
  id: string;
  name: string;
  ingredients: string;
  image: string;
  order: number;
};

type RawMenuItem = {
  nome?: unknown;
  Nome?: unknown;
  descrizione?: unknown;
  Descrizione?: unknown;
  ingredienti?: unknown;
  Ingredienti?: unknown;
  immagine?: unknown;
  Immagine?: unknown;
  ordine?: unknown;
  order?: unknown;
  specialita?: unknown;
  special?: unknown;
  visible?: unknown;
  visibile?: unknown;
};

const asText = (value: unknown): string => String(value ?? "").trim();

const imagePath = (value: string): string => {
  if (!value) return "/assets/logo1.png";
  if (value.startsWith("http")) return value;
  return `/${value.replace(/^\/+/, "")}`;
};

export function HomeFeaturedStrip() {
  const [items, setItems] = useState<FeaturedItem[]>([]);

  useEffect(() => {
    const db = getClientDb();
    const unsubscribe = onSnapshot(
      collection(db, "menu_items"),
      (snapshot) => {
        const next = snapshot.docs
          .map((doc) => {
            const data = doc.data() as RawMenuItem;
            const name = asText(data.nome ?? data.Nome);
            if (!name) return null;

            const isVisible =
              typeof data.visible === "boolean"
                ? data.visible
                : typeof data.visibile === "boolean"
                  ? data.visibile
                  : true;
            if (!isVisible) return null;

            const isStarred = Boolean(data.specialita ?? data.special);
            if (!isStarred) return null;

            const ingredients = asText(data.ingredienti ?? data.Ingredienti);

            return {
              id: doc.id,
              name,
              ingredients,
              image: imagePath(asText(data.immagine ?? data.Immagine)),
              order: Number.isFinite(Number(data.ordine))
                ? Number(data.ordine)
                : Number.isFinite(Number(data.order))
                  ? Number(data.order)
                  : 9999,
            } as FeaturedItem;
          })
          .filter((entry): entry is FeaturedItem => Boolean(entry))
          .sort((a, b) => {
            const orderDiff = a.order - b.order;
            if (orderDiff !== 0) return orderDiff;
            return a.name.localeCompare(b.name, "it");
          });

        setItems(next);
      },
      () => {
        setItems([]);
      },
    );

    return () => unsubscribe();
  }, []);

  if (items.length === 0) {
    return (
      <div className="home-featured-empty">
        Nessun elemento in evidenza al momento.
      </div>
    );
  }

  return (
    <div className="home-featured-shell">

      <div className="home-featured-strip" role="list" aria-label="Le nostre firme">
        {items.map((item) => (
          <article key={item.id} className="home-featured-card" role="listitem">
            <div className="home-featured-media">
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 760px) 84vw, 270px"
                className="home-featured-media-image"
                quality={74}
              />
            </div>
            <div className="home-featured-body">
              <h3>{item.name}</h3>
              {item.ingredients ? <p>{item.ingredients}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
