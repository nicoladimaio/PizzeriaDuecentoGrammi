import Link from "next/link";

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
            risposta appena possibile.
          </p>
          <div className="booking-confirm-actions">
            <Link href="/" className="btn-secondary admin-modal-btn">
              TORNA ALLA HOME
            </Link>
            <Link href="/prenotazioni" className="btn-primary">
              NUOVA PRENOTAZIONE
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
