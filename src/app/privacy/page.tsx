import type { Metadata } from "next";
import Link from "next/link";
import {
  BOOKING_TERMS_PATH,
  PRIVACY_POLICY_VERSION,
} from "@/lib/reservation-policies";

export const metadata: Metadata = {
  title: "Privacy | Duecento Grammi",
  description: "Informativa privacy per le prenotazioni di Duecento Grammi.",
};

export default function PrivacyPage() {
  return (
    <main className="page-main legal-page">
      <div className="container legal-wrap">
        <section className="card-block legal-card">
          <p className="legal-kicker">Informativa privacy</p>
          <h1>Privacy prenotazioni</h1>
          <p className="section-subtitle">
            Ultimo aggiornamento: {PRIVACY_POLICY_VERSION}
          </p>

          <div className="legal-content">
            <section>
              <h2>Titolare del trattamento</h2>
              <p>
                Duecento Grammi, attivita di ristorazione con sede operativa a
                Marcianise (CE).
              </p>
              <p>
                Contatti: <a href="mailto:info@duecentogrammi.it">info@duecentogrammi.it</a>{" "}
                - <a href="tel:+390823833221">0823 833221</a>
              </p>
            </section>

            <section>
              <h2>Quali dati raccogliamo</h2>
              <p>
                Quando prenoti raccogliamo nome e cognome, telefono, email,
                data, orario, numero di persone, preferenza sala ed eventuali
                note inserite da te.
              </p>
            </section>

            <section>
              <h2>Perche trattiamo i dati</h2>
              <p>
                Usiamo questi dati per ricevere, gestire, confermare o rifiutare
                la prenotazione, contattarti in caso di variazioni e inviarti il
                riepilogo della richiesta.
              </p>
            </section>

            <section>
              <h2>Base giuridica</h2>
              <p>
                Il trattamento e necessario per gestire la tua richiesta di
                prenotazione e le misure precontrattuali connesse.
              </p>
            </section>

            <section>
              <h2>Modalita del trattamento</h2>
              <p>
                I dati sono trattati con strumenti elettronici e organizzativi
                adeguati per finalita connesse alla prenotazione.
              </p>
            </section>

            <section>
              <h2>Con chi condividiamo i dati</h2>
              <p>
                I dati possono essere trattati da fornitori tecnici coinvolti
                nel funzionamento del sito, dell&apos;email e dell&apos;hosting,
                nominati ove necessario come responsabili del trattamento.
              </p>
            </section>

            <section>
              <h2>Conservazione</h2>
              <p>
                Conserviamo i dati per il tempo necessario alla gestione della
                prenotazione e per gli adempimenti amministrativi o difensivi
                collegati.
              </p>
            </section>

            <section>
              <h2>I tuoi diritti</h2>
              <p>
                Puoi chiedere accesso, rettifica, cancellazione, limitazione del
                trattamento o opporti nei casi previsti dalla legge scrivendo a{" "}
                <a href="mailto:info@duecentogrammi.it">info@duecentogrammi.it</a>.
              </p>
            </section>

            <section>
              <h2>Note importanti</h2>
              <p>
                Ti chiediamo di non inserire nelle note dati sanitari o altre
                informazioni particolari non necessarie. Se devi comunicarci
                esigenze specifiche, usa solo quanto strettamente utile alla
                gestione del tavolo.
              </p>
            </section>
          </div>

          <div className="legal-actions">
            <Link href="/prenotazioni" className="btn-primary">
              Torna alle prenotazioni
            </Link>
            <Link href={BOOKING_TERMS_PATH} className="btn-secondary legal-secondary">
              Termini di prenotazione
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
