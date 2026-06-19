import type { Metadata } from "next";
import { ReservationForm } from "@/components/reservation-form";
import Link from "next/link";
import {
  BOOKING_TERMS_PATH,
  PRIVACY_POLICY_PATH,
} from "@/lib/reservation-policies";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Prenota un Tavolo | Duecento Grammi Marcianise",
  description:
    "Prenota online il tuo tavolo da Duecento Grammi a Marcianise. Ricevi conferma della prenotazione direttamente via email.",
  path: "/prenotazioni",
});

export default function BookingPage() {
  return (
    <main className="page-main bookings-page-compact bookings-shell">
      <div className="container bookings-compact-grid-single bookings-center-wrap">
        <div className="bookings-page-stack">
          <ReservationForm />
          <div className="bookings-legal-links" aria-label="Informazioni legali">
            <Link href={PRIVACY_POLICY_PATH}>Privacy</Link>
            <Link href={BOOKING_TERMS_PATH}>Termini di prenotazione</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
