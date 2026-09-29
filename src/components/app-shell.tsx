"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

// Nella home l'header compare solo dopo aver scorso un po' (sopra c'è il video).
const subscribeToScroll = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};
const isScrolledPastTop = () => window.scrollY > 40;
const isScrolledOnServer = () => false;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReservedArea = pathname.startsWith("/riservato");
  const isHome = pathname === "/";
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    isScrolledPastTop,
    isScrolledOnServer,
  );
  const homeHeaderClassName = isHome
    ? `topbar-home-reveal${scrolled ? " visible" : ""}`
    : undefined;

  return (
    <>
      {!isReservedArea ? <SiteHeader className={homeHeaderClassName} /> : null}
      {children}
    </>
  );
}
