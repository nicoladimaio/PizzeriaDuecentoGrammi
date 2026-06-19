import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://pizzeriaduecentogrammi.it";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/Centro.png`;

type PageSeoInput = {
  description: string;
  path: string;
  title: string;
};

export const buildPageMetadata = ({
  description,
  path,
  title,
}: PageSeoInput): Metadata => {
  const canonicalUrl = `${SITE_URL}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
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
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
};
