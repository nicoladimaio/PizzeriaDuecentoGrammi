import { ReservationForm } from "@/components/reservation-form";
import { ReservationStatusChecker } from "@/components/reservation-status";

export const metadata = {
  title: "Prenotazioni | Duecento Grammi",
};

export default function BookingPage() {
  return (
    <main className="page-main">
      <section className="hero-mini bookings">
        <div className="container">
          <p className="hero-kicker">Prenotazioni Tavoli</p>
          <h1>Invia Richiesta E Controlla L'Esito</h1>
          <p className="hero-copy compact">
            La tua richiesta arriva al proprietario, che puo confermare o
            rifiutare.
          </p>
        </div>
      </section>

      <div className="container split-layout">
        <ReservationForm />
        <ReservationStatusChecker />
      </div>
    </main>
  );
}
