"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  const [activeItemId, setActiveItemId] = useState("");
  const stripRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

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

  const resolvedActiveItemId =
    activeItemId && items.some((item) => item.id === activeItemId)
      ? activeItemId
      : (items[0]?.id ?? "");

  useEffect(() => {
    const container = stripRef.current;
    if (!container || items.length === 0) return;

    const visibilityById = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.featuredId;
          if (!id) return;
          visibilityById.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let nextActive = "";
        let bestRatio = 0;
        items.forEach((item) => {
          const ratio = visibilityById.get(item.id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            nextActive = item.id;
          }
        });

        if (nextActive) {
          setActiveItemId((current) => (current === nextActive ? current : nextActive));
        }
      },
      {
        root: container,
        threshold: [0.5, 0.7, 0.9],
      },
    );

    items.forEach((item) => {
      const node = cardRefs.current[item.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [items]);

  const jumpToItem = (itemId: string) => {
    const target = cardRefs.current[itemId];
    if (!target) return;
    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  if (items.length === 0) {
    return (
      <div className="home-featured-empty">
        Nessun elemento in evidenza al momento.
      </div>
    );
  }

  return (
    <div className="home-featured-shell">
      <div className="home-featured-smart-menu" aria-label="Seleziona firma">
        {items.map((item) => {
          const active = item.id === resolvedActiveItemId;
          return (
            <button
              key={`jump-${item.id}`}
              type="button"
              className={
                active
                  ? "home-featured-smart-chip active"
                  : "home-featured-smart-chip"
              }
              onClick={() => jumpToItem(item.id)}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      <div
        ref={stripRef}
        className="home-featured-strip"
        role="list"
        aria-label="Le nostre firme"
      >
        {items.map((item) => (
          <article
            key={item.id}
            className="home-featured-card"
            role="listitem"
            ref={(node) => {
              cardRefs.current[item.id] = node;
            }}
            data-featured-id={item.id}
          >
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
