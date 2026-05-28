"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReservedArea = pathname.startsWith("/riservato");
  const isHome = pathname === "/";
  const [showHeaderOnHome, setShowHeaderOnHome] = useState(false);
  const homeHeaderClassName = isHome
    ? `topbar-home-reveal${showHeaderOnHome ? " visible" : ""}`
    : undefined;

  useEffect(() => {
    if (!isHome) {
      setShowHeaderOnHome(true);
      return;
    }

    const updateVisibility = () => {
      setShowHeaderOnHome(window.scrollY > 40);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, [isHome]);

  return (
    <>
      {!isReservedArea ? <SiteHeader className={homeHeaderClassName} /> : null}
      {children}
    </>
  );
}
