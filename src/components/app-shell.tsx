"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReservedArea = pathname.startsWith("/riservato");
  const isHome = pathname === "/";
  const [showHomeMicroTopbar, setShowHomeMicroTopbar] = useState(false);

  useEffect(() => {
    if (!isHome) {
      setShowHomeMicroTopbar(false);
      return;
    }

    const onScroll = () => {
      setShowHomeMicroTopbar(window.scrollY > 18);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  return (
    <>
      {!isReservedArea && !isHome ? <SiteHeader /> : null}
      {!isReservedArea && isHome ? (
        <header
          className={
            showHomeMicroTopbar
              ? "topbar micro-topbar visible"
              : "topbar micro-topbar"
          }
          aria-hidden={!showHomeMicroTopbar}
        >
          <div className="topbar-inner micro-topbar-inner">
            <Link href="/" className="brand-link micro-brand-link">
              Duecento Grammi
            </Link>
            <nav
              className="main-nav micro-main-nav"
              aria-label="Navigazione rapida homepage"
            >
              <Link href="/menu" className="nav-link micro-nav-link">
                Menu
              </Link>
              <Link href="/prenotazioni" className="nav-link micro-nav-link">
                Prenota
              </Link>
            </nav>
          </div>
        </header>
      ) : null}
      {children}
    </>
  );
}
