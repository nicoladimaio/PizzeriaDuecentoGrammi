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
          <h1>PRENOTAZIONE CONFERMATA</h1>
          <p className="section-subtitle">
            La tua richiesta e stata registrata correttamente.
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
