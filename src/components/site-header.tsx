"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/prenotazioni", label: "Prenota un tavolo" },
];

type SiteHeaderProps = {
  className?: string;
};

export function SiteHeader({ className }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <header
      className={clsx("topbar", pathname === "/" && "topbar-fixed", className)}
    >
      <div className="topbar-inner">
        <Link
          href="/"
          className="brand-link"
          aria-label="Duecento Grammi - home"
        >
          <Image
            src="/assets/logo1_hq.png"
            alt="Duecento Grammi"
            width={28}
            height={44}
            quality={100}
            priority
            className="brand-logo"
          />
        </Link>

        <nav className="main-nav" aria-label="Navigazione principale">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx("nav-link", pathname === link.href && "active")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
