import Link from "next/link";
import Image from "next/image";
import { HomeHeroVideo } from "@/components/home-hero-video";

export default function HomePage() {
  return (
    <main className="home-immersive">
      <section className="hero hero-home-minimal">
        <HomeHeroVideo
          src="/assets/video_homepage.mp4"
          loopDurationSeconds={10}
        />
        <div className="hero-overlay" />
        <div className="container hero-content hero-content-home">
          <Image
            src="/assets/Centro.png"
            alt="Duecento Grammi"
            width={380}
            height={380}
            sizes="(max-width: 760px) 76vw, 380px"
            quality={100}
            priority
            className="home-brand-logo-reveal"
          />
          <p className="home-tagline">
            Identita contemporanea, gusto autentico.
          </p>
          <div className="hero-actions home-cta-row">
            <Link href="/menu" className="btn-primary home-cta home-cta-menu">
              Menu
            </Link>
            <Link
              href="/prenotazioni"
              className="btn-secondary home-cta home-cta-booking"
            >
              Prenota un tavolo
            </Link>
          </div>
        </div>
      </section>

      <section className="home-signature-section">
        <div className="container">
          <div className="home-section-head">
            <h2>I nostri sapori</h2>
            <p className="home-curation-subtitle">
              Una selezione che parte dalla tradizione e arriva a una cucina
              nitida, contemporanea e riconoscibile.
            </p>
          </div>

          <div className="home-signature-grid">
            <article className="home-signature-card">
              <div className="home-signature-media">
                <Image
                  src="/assets/frittatina.jpg"
                  alt="Fritti artigianali"
                  fill
                  sizes="(max-width: 760px) 92vw, 33vw"
                />
              </div>
              <div className="home-signature-body">
                <h3>I fritti</h3>
                <p>
                  Frittatine, crocchè e montanare preparati al momento,
                  croccanti fuori e pieni di gusto.
                </p>
              </div>
            </article>

            <article className="home-signature-card">
              <div className="home-signature-media">
                <Image
                  src="/assets/pizze_speciali.jpg"
                  alt="Pizze speciali"
                  fill
                  sizes="(max-width: 760px) 92vw, 33vw"
                />
              </div>
              <div className="home-signature-body">
                <h3>Pizze speciali</h3>
                <p>
                  Impasti leggeri e topping ricercati per un equilibrio preciso
                  tra tradizione e identita.
                </p>
              </div>
            </article>

            <article className="home-signature-card">
              <div className="home-signature-media">
                <Image
                  src="/assets/pizze_classiche.jpg"
                  alt="Ingredienti selezionati"
                  fill
                  sizes="(max-width: 760px) 92vw, 33vw"
                />
              </div>
              <div className="home-signature-body">
                <h3>Ingredienti selezionati</h3>
                <p>
                  Materie prime scelte con attenzione: filiera affidabile,
                  sapori netti, qualita costante.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="home-craft-band">
        <div className="container home-craft-grid">
          <article className="home-craft-copy">
            <p className="home-craft-kicker">La nostra cucina</p>
            <h3>Precisione nei dettagli, identita nel gusto</h3>
            <p>
              Ogni proposta nasce da un equilibrio semplice: tecnica pulita,
              ingredienti riconoscibili e una linea di sapore coerente.
            </p>
            <ul className="home-craft-list">
              <li>Impasti maturati per leggerezza e struttura</li>
              <li>Fritture espresse con croccantezza asciutta</li>
              <li>Ingredienti selezionati in base a qualita e stagionalita</li>
            </ul>
          </article>

          <figure className="home-craft-photo">
            <Image
              src="/assets/pizze_classiche.jpg"
              alt="Ingredienti e pizza appena preparata"
              fill
              sizes="(max-width: 760px) 92vw, 40vw"
            />
            <figcaption>
              Farine selezionate, pomodoro e latticini scelti con cura ogni
              giorno.
            </figcaption>
          </figure>
        </div>
      </section>

      <footer className="home-footer-minimal">
        <div className="container home-footer-minimal-grid">
          <article className="home-footer-minimal-block home-footer-minimal-block-contacts">
            <p className="home-footer-minimal-label">Indirizzo e contatti</p>
            <p className="home-footer-line">
              <span className="home-footer-line-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
                  <circle cx="12" cy="11" r="2.3" />
                </svg>
              </span>
              <a
                className="home-address-link"
                href="https://maps.google.com/?q=Viale+Europa+30+Marcianise"
                target="_blank"
                rel="noreferrer"
              >
                Viale Europa 30, Marcianise (CE)
              </a>
            </p>
            <p className="home-footer-line">
              <span className="home-footer-line-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M6.7 4.8c.3-.7 1-.9 1.6-.7l2.2.7c.6.2.9.8.8 1.4l-.4 2c-.1.4 0 .8.3 1.1l2.8 2.8c.3.3.7.4 1.1.3l2-.4c.6-.1 1.2.2 1.4.8l.7 2.2c.2.6 0 1.3-.7 1.6l-1.5.8c-.8.4-1.8.5-2.7.2-2.3-.7-4.4-2.2-6.2-4S5 9.1 4.3 6.8c-.3-.9-.2-1.9.2-2.7l.8-1.5z" />
                </svg>
              </span>
              <a href="tel:+390823833221">0823 833221</a>
            </p>
            <p className="home-footer-line">
              <span className="home-footer-line-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img">
                  <rect x="3.5" y="6" width="17" height="12" rx="2" />
                  <path d="M4.5 7l7.5 6 7.5-6" />
                </svg>
              </span>
              <a href="mailto:info@duecentogrammi.it">info@duecentogrammi.it</a>
            </p>
          </article>

          <article className="home-footer-minimal-block home-footer-minimal-block-hours">
            <p className="home-footer-minimal-label">Orari</p>
            <p className="home-footer-line">
              <span className="home-footer-line-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 7v5l3.2 2" />
                </svg>
              </span>
              Lun - Dom 19:00 - 00:00
            </p>
            <p className="home-footer-line">
              <span className="home-footer-line-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M4 11h16" />
                </svg>
              </span>
              Asporto e sala
            </p>
          </article>

          <article className="home-footer-minimal-block home-footer-minimal-block-social">
            <div className="home-footer-social-icons" aria-label="Social">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="social-icon instagram"
              >
                <svg viewBox="0 0 24 24" role="img" aria-hidden>
                  <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.6" />
                  <circle cx="12" cy="12" r="3.5" />
                  <circle cx="16.9" cy="7.2" r="1" />
                </svg>
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="social-icon facebook"
              >
                <svg viewBox="0 0 24 24" role="img" aria-hidden>
                  <path d="M13.5 20v-6h2.2l0.3-2.5h-2.5V10c0-0.8 0.2-1.3 1.3-1.3H16V6.4c-0.2 0-0.9-0.1-1.8-0.1-1.8 0-3.1 1.1-3.1 3.1v2.1H9v2.5h2.1v6h2.4z" />
                </svg>
              </a>
              <a
                href="https://wa.me/390823833221"
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="social-icon whatsapp"
              >
                <svg viewBox="0 0 24 24" role="img" aria-hidden>
                  <path d="M12 4a8 8 0 0 0-6.9 12.1L4 20l3.9-1A8 8 0 1 0 12 4z" />
                  <path d="M9.2 9.1c0.2-0.4 0.4-0.4 0.6-0.4h0.5c0.2 0 0.4 0.1 0.5 0.4l0.4 1c0.1 0.2 0.1 0.4 0 0.6l-0.3 0.5c-0.1 0.2 0 0.3 0.1 0.4 0.4 0.7 1 1.3 1.7 1.7 0.2 0.1 0.3 0.1 0.4 0l0.5-0.3c0.2-0.1 0.4-0.1 0.6 0l1 0.4c0.3 0.1 0.4 0.3 0.4 0.5v0.5c0 0.2 0 0.4-0.4 0.6-0.3 0.2-0.9 0.4-1.4 0.2-1.8-0.5-3.9-2.5-4.4-4.4-0.2-0.5 0-1.1 0.2-1.4z" />
                </svg>
              </a>
            </div>
          </article>

          <div className="home-footer-minimal-block home-footer-minimal-block-actions">
            <Link
              href="/prenotazioni"
              className="btn-primary home-footer-minimal-cta"
            >
              Prenota ora
            </Link>
          </div>
        </div>

        <div className="container home-footer-signature">
          <span className="home-footer-signature-left">Duecento Grammi</span>
          <Image
            src="/assets/logo1_hq.png"
            alt="Duecento Grammi"
            width={20}
            height={30}
            className="home-footer-signature-logo-center"
          />
          <span className="home-footer-signature-right">Marcianise</span>
        </div>
      </footer>
    </main>
  );
}
