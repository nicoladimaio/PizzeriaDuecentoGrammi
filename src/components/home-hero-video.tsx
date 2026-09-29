"use client";

import { useEffect, useRef } from "react";

type HomeHeroVideoProps = {
  src: string;
  /** Primo fotogramma: si vede subito, mentre il video carica. */
  poster: string;
};

// Il file video contiene già solo il tratto da mostrare in loop: niente
// logica di taglio lato browser.
export function HomeHeroVideo({ src, poster }: HomeHeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    // Chi ha chiesto al sistema di ridurre le animazioni vede solo il poster.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => {
      if (reducedMotion.matches) {
        element.pause();
      } else {
        void element.play().catch(() => {});
      }
    };

    applyPreference();
    reducedMotion.addEventListener("change", applyPreference);
    return () => reducedMotion.removeEventListener("change", applyPreference);
  }, []);

  return (
    <div className="home-video-wrap" aria-hidden>
      <video
        ref={videoRef}
        className="home-video-bg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={poster}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="home-video-dim" />
      <div className="home-video-vignette" />
    </div>
  );
}
