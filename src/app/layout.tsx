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
  applicationName: "Duecento Grammi",
  manifest: "/site.webmanifest",
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
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/assets/logo1_tab_premium.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon-32x32.png"],
    apple: [{ url: "/apple-icon.png", sizes: "512x512", type: "image/png" }],
  },
  other: {
    "theme-color": "#1f3440",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Duecento Grammi",
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
