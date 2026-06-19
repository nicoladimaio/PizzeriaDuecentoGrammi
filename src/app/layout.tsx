import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Manrope,
  Playfair_Display,
} from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";

const headingFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Duecento Grammi",
  description:
    "Pizzeria Duecento Grammi - prenotazioni, menu e atmosfera napoletana.",
  openGraph: {
    title: "Duecento Grammi",
    description:
      "Pizzeria Duecento Grammi - prenotazioni, menu e atmosfera napoletana.",
    url: SITE_URL,
    siteName: "Duecento Grammi",
    locale: "it_IT",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Duecento Grammi - Pizzeria Gourmet a Marcianise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Duecento Grammi",
    description:
      "Pizzeria Duecento Grammi - prenotazioni, menu e atmosfera napoletana.",
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: "/assets/logo1_tab_circle.png",
    shortcut: "/assets/logo1_tab_circle.png",
    apple: "/assets/logo1_tab_circle.png",
  },
};

const restaurantJsonLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "Duecento Grammi",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Viale Europa 30",
    postalCode: "81025",
    addressLocality: "Marcianise",
    addressRegion: "CE",
    addressCountry: "IT",
  },
  telephone: "0823 833221",
  url: SITE_URL,
  servesCuisine: ["Pizza", "Cucina italiana", "Pizzeria gourmet"],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "https://schema.org/Monday",
        "https://schema.org/Tuesday",
        "https://schema.org/Wednesday",
        "https://schema.org/Thursday",
        "https://schema.org/Friday",
        "https://schema.org/Saturday",
        "https://schema.org/Sunday",
      ],
      opens: "19:00",
      closes: "00:00",
    },
  ],
  priceRange: "EUR 20-40",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        <Script
          id="restaurant-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(restaurantJsonLd),
          }}
        />
      </head>
      <body
        className={`${headingFont.variable} ${displayFont.variable} ${bodyFont.variable}`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
