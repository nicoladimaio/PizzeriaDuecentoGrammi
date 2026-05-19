import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard prenotazioni",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminDashboardPage() {
  return (
    <main className="page-main admin-page-main">
      <section className="hero-mini admin-hero">
        <div className="container">
          <p className="hero-kicker">Gestione interna</p>
          <h1>Pannello Amministrazione</h1>
        </div>
      </section>

      <div className="container">
        <AdminDashboard />
      </div>
    </main>
  );
}
