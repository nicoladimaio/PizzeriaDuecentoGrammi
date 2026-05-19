import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="home-immersive">
      <section className="hero hero-home-minimal">
        <div className="hero-overlay" />
        <div className="container hero-content hero-content-home">
          <Image
            src="/assets/Centro.png"
            alt="Duecento Grammi"
            width={460}
            height={138}
            sizes="(max-width: 760px) 82vw, 460px"
            priority
            className="home-brand-logo-reveal"
          />
          <p className="home-tagline">
            Identita contemporanea, gusto autentico.
          </p>
          <div className="hero-actions home-cta-row">
            <Link href="/menu" className="btn-primary home-cta">
              Menu
            </Link>
            <Link href="/prenotazioni" className="btn-secondary home-cta">
              Prenota
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer-tall">
        <div className="container home-footer-grid">
          <article className="home-footer-card">
            <h3>
              <span className="home-footer-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img" aria-hidden>
                  <path d="M4 11.5L12 5l8 6.5" />
                  <path d="M6.5 10.5V19h11v-8.5" />
                  <path d="M10 19v-4h4v4" />
                </svg>
              </span>
              DOVE
            </h3>
            <p>Viale Europa 30, Marcianise (CE)</p>
            <a
              href="https://maps.google.com/?q=Viale+Europa+30+Marcianise"
              target="_blank"
              rel="noreferrer"
            >
              Apri su Maps
            </a>
          </article>

          <article className="home-footer-card">
            <h3>
              <span className="home-footer-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img" aria-hidden>
                  <path d="M5 4.5h3l1.5 3.5-2 1.7a14.5 14.5 0 0 0 6.8 6.8l1.7-2 3.5 1.5v3c0 1-0.8 1.8-1.8 1.8C10.6 21 3 13.4 3 6.3 3 5.3 3.8 4.5 5 4.5z" />
                </svg>
              </span>
              CONTATTI
            </h3>
            <p>
              <a href="tel:+390823833221">0823 833221</a>
            </p>
            <p>
              <a href="mailto:info@duecentogrammi.it">info@duecentogrammi.it</a>
            </p>
          </article>

          <article className="home-footer-card">
            <h3>
              <span className="home-footer-icon" aria-hidden>
                <svg viewBox="0 0 24 24" role="img" aria-hidden>
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l2.8 2.4" />
                </svg>
              </span>
              ORARI
            </h3>
            <p>Lun - Dom: 19:00 - 00:00</p>
            <p>Asporto e sala</p>
          </article>
        </div>

        <div className="container home-footer-social">
          <span>Seguici</span>
          <a href="https://instagram.com" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" role="img" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="5" />
              <circle cx="12" cy="12" r="3.6" />
              <circle
                cx="16.8"
                cy="7.2"
                r="1"
                fill="currentColor"
                stroke="none"
              />
            </svg>
            <span>Instagram</span>
          </a>
          <a href="https://facebook.com" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" role="img" aria-hidden>
              <path d="M13.5 20v-6h2.2l0.3-2.5h-2.5V10c0-0.8 0.2-1.3 1.3-1.3H16V6.4c-0.2 0-0.9-0.1-1.8-0.1-1.8 0-3.1 1.1-3.1 3.1v2.1H9v2.5h2.1v6h2.4z" />
            </svg>
            <span>Facebook</span>
          </a>
          <a href="https://wa.me/390823833221" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" role="img" aria-hidden>
              <path d="M12 4a8 8 0 0 0-6.9 12.1L4 20l3.9-1A8 8 0 1 0 12 4z" />
              <path d="M9.2 9.1c0.2-0.4 0.4-0.4 0.6-0.4h0.5c0.2 0 0.4 0.1 0.5 0.4l0.4 1c0.1 0.2 0.1 0.4 0 0.6l-0.3 0.5c-0.1 0.2 0 0.3 0.1 0.4 0.4 0.7 1 1.3 1.7 1.7 0.2 0.1 0.3 0.1 0.4 0l0.5-0.3c0.2-0.1 0.4-0.1 0.6 0l1 0.4c0.3 0.1 0.4 0.3 0.4 0.5v0.5c0 0.2 0 0.4-0.4 0.6-0.3 0.2-0.9 0.4-1.4 0.2-1.8-0.5-3.9-2.5-4.4-4.4-0.2-0.5 0-1.1 0.2-1.4z" />
            </svg>
            <span>WhatsApp</span>
          </a>
        </div>
      </footer>
    </main>
  );
}
