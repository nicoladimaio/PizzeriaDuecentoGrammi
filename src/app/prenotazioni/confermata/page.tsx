import Link from "next/link";
import {
  BOOKING_TERMS_PATH,
  PRIVACY_POLICY_PATH,
} from "@/lib/reservation-policies";

export const metadata = {
  title: "Prenotazione confermata | Duecento Grammi",
};

export default function BookingConfirmedPage() {
  return (
    <main className="page-main booking-confirm-page">
      <div className="container booking-confirm-wrap">
        <section className="card-block booking-confirm-card">
          <p className="booking-confirm-kicker">Grazie</p>
          <h1>Richiesta di prenotazione inviata!</h1>
          <p className="section-subtitle">
            Abbiamo registrato la tua richiesta. Riceverai subito una email con
            i dettagli della prenotazione e una successiva comunicazione di
            risposta appena possibile. Controlla anche nello spam!
          </p>
          <div className="booking-confirm-actions">
            <Link href="/" className="btn-secondary admin-modal-btn">
              TORNA ALLA HOME
            </Link>
            <Link href="/prenotazioni" className="btn-primary">
              NUOVA PRENOTAZIONE
            </Link>
          </div>
          <p className="booking-confirm-legal">
            Informazioni legali: <Link href={PRIVACY_POLICY_PATH}>Privacy</Link>{" "}
            e{" "}
            <Link href={BOOKING_TERMS_PATH}>Termini di prenotazione</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
