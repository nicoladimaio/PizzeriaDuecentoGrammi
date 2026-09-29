"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMenuImageSrc } from "@/lib/menu-image-cdn";
import type { FeaturedDish } from "@/lib/menu-mapping";

type FeaturedSlide = {
  key: string;
  item: FeaturedDish;
  originIndex: number;
};

/** Piatti "firma" della home: arrivano già pronti dal server (lib/public-menu.ts). */
export function HomeFeaturedStrip({ items }: { items: FeaturedDish[] }) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const recenterTimeoutRef = useRef<number | null>(null);
  const pendingJumpRef = useRef<number | null>(null);
  const initDoneRef = useRef(false);

  const canLoop = items.length > 1;
  // Giro infinito: copie dei piatti ai lati di quella centrale; arrivati alla
  // prima o all'ultima copia si salta, senza che si veda, a quella centrale.
  // Bastano 5 copie (e almeno ~24 schede) per coprire anche uno scorrimento veloce.
  const loopCycles = canLoop
    ? Math.max(5, Math.ceil(24 / items.length))
    : 1;
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
                            src={getMenuImageSrc(slide.item.image, "featured")}
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
