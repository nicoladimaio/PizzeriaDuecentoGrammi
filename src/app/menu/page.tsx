import type { Metadata } from "next";
import { LiveMenu } from "@/components/live-menu";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Menu | Duecento Grammi Pizzeria Gourmet Marcianise (Caserta)",
  description:
    "Scopri il menu completo di Duecento Grammi a Marcianise. Pizze classiche, gourmet, fritti artigianali, dolci e bevande.",
  path: "/menu",
});

export default function MenuPage() {
  return (
    <main className="page-main menu-only-main">
      <LiveMenu />
    </main>
  );
}
