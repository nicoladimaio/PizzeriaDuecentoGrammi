import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard prenotazioni",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const tabRaw = resolved.tab;
  const codeRaw = resolved.code;

  const initialTab =
    typeof tabRaw === "string" &&
    (tabRaw === "reservations" || tabRaw === "settings")
      ? tabRaw
      : "menu";
  const highlightedCode = typeof codeRaw === "string" ? codeRaw : undefined;

  return (
    <main className="page-main admin-page-main">
      <section className="hero-mini admin-hero">
        <div className="container">
          <p className="hero-kicker">Gestione interna</p>
          <h1>Pannello Amministrazione</h1>
        </div>
      </section>

      <div className="container">
        <AdminDashboard
          initialSection={initialTab}
          highlightedCode={highlightedCode}
        />
      </div>
    </main>
  );
}
