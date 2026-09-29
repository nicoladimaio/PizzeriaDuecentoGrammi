import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Area riservata e API non vanno indicizzate.
      disallow: ["/riservato/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
