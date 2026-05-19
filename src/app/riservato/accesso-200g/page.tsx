import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin-login-form";

export const metadata: Metadata = {
  title: "Area riservata",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HiddenLoginPage() {
  return (
    <main className="page-main">
      <section className="hero-mini admin-hero">
        <div className="container">
          <p className="hero-kicker">Area riservata</p>
          <h1>Accesso Amministratore</h1>
        </div>
      </section>

      <div className="container narrow">
        <div className="card-block">
          <p className="section-subtitle">
            Accesso solo per account autorizzati.
          </p>
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
