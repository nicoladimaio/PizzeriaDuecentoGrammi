import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LiveMenu } from "@/components/live-menu";
import { routing } from "@/i18n/routing";
import { buildPageMetadata } from "@/lib/seo";

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

  return (
    <main className="page-main menu-only-main">
      <LiveMenu />
    </main>
  );
}
