"use client";

import { useEffect, useRef } from "react";

type HomeHeroVideoProps = {
  src: string;
  loopDurationSeconds?: number;
  startAtSeconds?: number;
};

export function HomeHeroVideo({
  src,
  loopDurationSeconds = 12,
  startAtSeconds = 0,
}: HomeHeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    const safeStart = Number.isFinite(startAtSeconds)
      ? Math.max(0, startAtSeconds)
      : 0;
    const safeLoopDuration = Number.isFinite(loopDurationSeconds)
      ? Math.max(2, loopDurationSeconds)
      : 12;
    const loopEnd = safeStart + safeLoopDuration;

    const onLoadedMetadata = () => {
      if (element.duration > safeStart) {
        element.currentTime = safeStart;
      }
    };

    const onTimeUpdate = () => {
      if (element.currentTime >= loopEnd) {
        element.currentTime = safeStart;
        void element.play();
      }
    };

    element.addEventListener("loadedmetadata", onLoadedMetadata);
    element.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      element.removeEventListener("loadedmetadata", onLoadedMetadata);
      element.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [loopDurationSeconds, startAtSeconds]);

  return (
    <div className="home-video-wrap" aria-hidden>
      <video
        ref={videoRef}
        className="home-video-bg"
        autoPlay
        muted
        playsInline
        preload="auto"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="home-video-dim" />
      <div className="home-video-vignette" />
    </div>
  );
}
