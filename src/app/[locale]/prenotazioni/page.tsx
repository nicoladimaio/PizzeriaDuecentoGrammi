import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ReservationForm } from "@/components/reservation-form";
import { routing } from "@/i18n/routing";
import {
  BOOKING_TERMS_PATH,
  PRIVACY_POLICY_PATH,
} from "@/lib/reservation-policies";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    title: t("bookingTitle"),
    description: t("bookingDescription"),
    path: "/prenotazioni",
    locale,
    locales: routing.locales,
  });
}

export default async function BookingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");

  return (
    <main className="page-main bookings-page-compact bookings-shell">
      <div className="container bookings-compact-grid-single bookings-center-wrap">
        <div className="bookings-page-stack">
          <ReservationForm />
          <div className="bookings-legal-links" aria-label={t("legalLinksAria")}>
            <Link href={PRIVACY_POLICY_PATH}>{t("privacy")}</Link>
            <Link href={BOOKING_TERMS_PATH}>{t("terms")}</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
