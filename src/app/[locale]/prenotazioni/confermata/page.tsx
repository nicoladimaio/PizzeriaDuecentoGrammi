import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  BOOKING_TERMS_PATH,
  PRIVACY_POLICY_PATH,
} from "@/lib/reservation-policies";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("confirmedTitle") };
}

export default async function BookingConfirmedPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("BookingConfirmed");

  return (
    <main className="page-main booking-confirm-page">
      <div className="container booking-confirm-wrap">
        <section className="card-block booking-confirm-card">
          <p className="booking-confirm-kicker">{t("kicker")}</p>
          <h1>{t("title")}</h1>
          <p className="section-subtitle">{t("text")}</p>
          <div className="booking-confirm-actions">
            <NextLink href="/" className="btn-secondary admin-modal-btn">
              {t("home")}
            </NextLink>
            <Link href="/prenotazioni" className="btn-primary">
              {t("newBooking")}
            </Link>
          </div>
          <p className="booking-confirm-legal">
            {t.rich("legal", {
              privacy: (chunks) => (
                <NextLink href={PRIVACY_POLICY_PATH}>{chunks}</NextLink>
              ),
              terms: (chunks) => (
                <NextLink href={BOOKING_TERMS_PATH}>{chunks}</NextLink>
              ),
            })}
          </p>
        </section>
      </div>
    </main>
  );
}
