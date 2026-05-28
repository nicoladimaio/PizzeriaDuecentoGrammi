import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Manrope,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

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
  title: "Duecento Grammi",
  description:
    "Pizzeria Duecento Grammi - prenotazioni, menu e atmosfera napoletana.",
  icons: {
    icon: "/assets/logo1_tab.png",
    shortcut: "/assets/logo1_tab.png",
    apple: "/assets/logo1_tab.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body
        className={`${headingFont.variable} ${displayFont.variable} ${bodyFont.variable}`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
