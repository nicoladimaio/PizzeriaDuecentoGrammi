"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";

type FeaturedItem = {
  id: string;
  name: string;
  ingredients: string;
  image: string;
  order: number;
};

type FeaturedSlide = {
  key: string;
  item: FeaturedItem;
  originIndex: number;
};

type RawMenuItem = {
  nome?: unknown;
  Nome?: unknown;
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
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const recenterTimeoutRef = useRef<number | null>(null);
  const pendingJumpRef = useRef<number | null>(null);
  const initDoneRef = useRef(false);

  const canLoop = items.length > 1;
  const loopCycles = canLoop ? (items.length <= 3 ? 21 : 13) : 1;
  const middleCycle = Math.floor(loopCycles / 2);

  const slides = useMemo<FeaturedSlide[]>(() => {
    if (items.length === 0) return [];

    if (!canLoop) {
      return items.map((item, index) => ({
        key: item.id,
        item,
        originIndex: index,
      }));
    }

    return Array.from({ length: items.length * loopCycles }, (_, index) => {
      const originIndex = index % items.length;
      const cycle = Math.floor(index / items.length);
      const item = items[originIndex];
      return {
        key: `${item.id}-${cycle}-${index}`,
        item,
        originIndex,
      };
    });
  }, [items, canLoop, loopCycles]);

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

            return {
              id: doc.id,
              name,
              ingredients: asText(data.ingredienti ?? data.Ingredienti),
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

  useEffect(() => {
    initDoneRef.current = false;
    slideRefs.current = [];
    pendingJumpRef.current = null;
    if (recenterTimeoutRef.current !== null) {
      window.clearTimeout(recenterTimeoutRef.current);
      recenterTimeoutRef.current = null;
    }
  }, [slides.length]);

  const centerSlideAt = (index: number, smooth: boolean) => {
    const container = stripRef.current;
    const target = slideRefs.current[index];
    if (!container || !target) return;

    const nextLeft =
      target.offsetLeft - (container.clientWidth - target.clientWidth) / 2;

    container.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: smooth ? "smooth" : "auto",
    });
  };

  useEffect(() => {
    if (slides.length === 0 || initDoneRef.current) return;

    const initialIndex = canLoop ? middleCycle * items.length : 0;
    requestAnimationFrame(() => {
      centerSlideAt(initialIndex, false);
      setActiveSlideIndex(initialIndex);
      initDoneRef.current = true;
    });
  }, [slides.length, canLoop, middleCycle, items.length]);

  useEffect(() => {
    const container = stripRef.current;
    if (!container || slides.length === 0) return;

    const scheduleRecenter = () => {
      if (recenterTimeoutRef.current !== null) {
        window.clearTimeout(recenterTimeoutRef.current);
      }

      recenterTimeoutRef.current = window.setTimeout(() => {
        const jumpTo = pendingJumpRef.current;
        if (jumpTo === null) return;
        centerSlideAt(jumpTo, false);
        setActiveSlideIndex(jumpTo);
        pendingJumpRef.current = null;
        recenterTimeoutRef.current = null;
      }, 120);
    };

    const onScroll = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const center = container.scrollLeft + container.clientWidth / 2;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        slides.forEach((_, index) => {
          const node = slideRefs.current[index];
          if (!node) return;
          const nodeCenter = node.offsetLeft + node.clientWidth / 2;
          const distance = Math.abs(nodeCenter - center);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });

        if (canLoop) {
          const leadingBoundary = items.length;
          const trailingBoundary = items.length * (loopCycles - 1);

          if (
            closestIndex < leadingBoundary ||
            closestIndex >= trailingBoundary
          ) {
            const origin = slides[closestIndex]?.originIndex ?? 0;
            const jumped = middleCycle * items.length + origin;
            pendingJumpRef.current = jumped;
            scheduleRecenter();
            return;
          }

          pendingJumpRef.current = null;
        }

        setActiveSlideIndex(closestIndex);
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (recenterTimeoutRef.current !== null) {
        window.clearTimeout(recenterTimeoutRef.current);
        recenterTimeoutRef.current = null;
      }
    };
  }, [slides, canLoop, items.length, loopCycles, middleCycle]);

  const moveBy = (direction: "prev" | "next") => {
    if (slides.length === 0) return;
    const delta = direction === "next" ? 1 : -1;
    let nextIndex = activeSlideIndex + delta;

    if (canLoop) {
      const leadingBoundary = items.length;
      const trailingBoundary = items.length * (loopCycles - 1);
      if (nextIndex < leadingBoundary) {
        nextIndex += items.length;
      } else if (nextIndex >= trailingBoundary) {
        nextIndex -= items.length;
      }
    } else {
      nextIndex = Math.max(0, Math.min(slides.length - 1, nextIndex));
    }

    centerSlideAt(nextIndex, true);
    setActiveSlideIndex(nextIndex);
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
      <button
        type="button"
        className="home-featured-desktop-nav home-featured-desktop-nav-left"
        onClick={() => moveBy("prev")}
        aria-label="Elemento precedente"
      >
        <span aria-hidden>‹</span>
      </button>
      <div
        ref={stripRef}
        className="home-featured-strip"
        role="list"
        aria-label="Le nostre firme"
      >
        {slides.map((slide, index) => (
          <article
            key={slide.key}
            className={
              index === activeSlideIndex
                ? "home-featured-card active"
                : "home-featured-card"
            }
            role="listitem"
            aria-current={index === activeSlideIndex ? "true" : undefined}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
          >
            <div className="home-featured-media">
              <Image
                src={slide.item.image}
                alt={slide.item.name}
                fill
                sizes="(max-width: 760px) 84vw, 320px"
                className="home-featured-media-image"
                quality={74}
              />
            </div>
            <div className="home-featured-body">
              <h3>{slide.item.name}</h3>
              {slide.item.ingredients ? <p>{slide.item.ingredients}</p> : null}
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        className="home-featured-desktop-nav home-featured-desktop-nav-right"
        onClick={() => moveBy("next")}
        aria-label="Elemento successivo"
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}
