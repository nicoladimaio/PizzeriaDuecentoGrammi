import type { Metadata } from "next";
import Link from "next/link";
import {
  BOOKING_TERMS_VERSION,
  PRIVACY_POLICY_PATH,
} from "@/lib/reservation-policies";

export const metadata: Metadata = {
  title: "Termini di prenotazione | Duecento Grammi",
  description: "Condizioni applicate alle prenotazioni di Duecento Grammi.",
};

export default function BookingTermsPage() {
  return (
    <main className="page-main legal-page">
      <div className="container legal-wrap">
        <section className="card-block legal-card">
          <p className="legal-kicker">Condizioni di prenotazione</p>
          <h1>Termini di prenotazione</h1>
          <p className="section-subtitle">
            Ultimo aggiornamento: {BOOKING_TERMS_VERSION}
          </p>

          <div className="legal-content">
            <section>
              <h2>Invio della richiesta</h2>
              <p>
                L&apos;invio del form costituisce una richiesta di prenotazione e
                non una conferma automatica del tavolo.
              </p>
            </section>

            <section>
              <h2>Conferma del tavolo</h2>
              <p>
                La prenotazione si considera confermata solo dopo la nostra
                comunicazione di conferma via email o altro contatto diretto.
              </p>
            </section>

            <section>
              <h2>Modifiche di disponibilita</h2>
              <p>
                Se necessario possiamo proporti un orario o una soluzione
                alternativa in base alla disponibilita reale del servizio.
              </p>
            </section>

            <section>
              <h2>Puntualita</h2>
              <p>
                In caso di ritardo ti chiediamo di avvisarci tempestivamente.
                Senza comunicazioni, il tavolo potrebbe non essere piu
                garantito in funzione dell&apos;operativita del locale.
              </p>
            </section>

            <section>
              <h2>Dati inseriti dall&apos;utente</h2>
              <p>
                Sei responsabile della correttezza dei dati forniti. Contatti
                errati o incompleti possono impedire la gestione corretta della
                prenotazione.
              </p>
            </section>

            <section>
              <h2>Cancellazioni</h2>
              <p>
                Se non puoi piu venire, ti chiediamo di avvisarci il prima
                possibile per liberare il tavolo.
              </p>
            </section>
          </div>

          <div className="legal-actions">
            <Link href="/prenotazioni" className="btn-primary">
              Torna alle prenotazioni
            </Link>
            <Link href={PRIVACY_POLICY_PATH} className="btn-secondary legal-secondary">
              Informativa privacy
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
