import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LiveMenu } from "@/components/live-menu";
import { routing } from "@/i18n/routing";
import {
  buildMenuJsonLd,
  serializeJsonLd,
} from "@/lib/menu-structured-data";
import { getPublicMenu } from "@/lib/public-menu";
import { SITE_URL, buildPageMetadata } from "@/lib/seo";

// Rete di sicurezza: la pagina si rigenera comunque ogni 10 minuti
// (MENU_REVALIDATE_SECONDS). Di norma si aggiorna subito, a ogni salvataggio
// dal pannello admin.
export const revalidate = 600;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    title: t("menuTitle"),
    description: t("menuDescription"),
    path: "/menu",
    locale,
    locales: routing.locales,
  });
}

export default async function MenuPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const menu = await getPublicMenu(locale);
  const pageUrl =
    locale === routing.defaultLocale
      ? `${SITE_URL}/menu`
      : `${SITE_URL}/${locale}/menu`;

  return (
    <main className="page-main menu-only-main">
      {menu && menu.products.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(buildMenuJsonLd(menu, locale, pageUrl)),
          }}
        />
      ) : null}
      <LiveMenu menu={menu} />
    </main>
  );
}
