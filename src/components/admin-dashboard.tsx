"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { isAllowedAdminEmail } from "@/lib/auth";
import { AdminMenuPanel } from "@/components/admin-menu-panel";

type AdminSection = "reservations" | "menu";

export function AdminDashboard() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("menu");

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user || !isAllowedAdminEmail(user.email)) {
        setBooting(false);
        router.replace("/riservato/accesso-200g");
        return;
      }

      setBooting(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  const onLogout = async () => {
    const auth = getClientAuth();
    await signOut(auth);
    router.replace("/");
  };

  if (booting) {
    return <p className="section-subtitle">Caricamento dashboard...</p>;
  }

  return (
    <section className="admin-shell">
      <div className="admin-head admin-head-compact">
        <h2>{activeSection === "menu" ? "Menu" : "Prenotazioni"}</h2>
      </div>

      {activeSection === "menu" ? <AdminMenuPanel /> : null}

      {activeSection === "reservations" ? (
        <article className="card-block">
          <h3>Prenotazioni</h3>
          <p className="section-subtitle">
            Sezione in standby. La riprendiamo dopo aver completato Menu e Home.
          </p>
        </article>
      ) : null}

      <div
        className="admin-bottom-nav"
        role="navigation"
        aria-label="Azioni dashboard"
      >
        <button
          type="button"
          className={
            activeSection === "reservations"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => setActiveSection("reservations")}
        >
          <span className="admin-bottom-symbol" aria-hidden>
            ◷
          </span>
          <span>Prenotazioni</span>
        </button>
        <button
          type="button"
          className={
            activeSection === "menu"
              ? "admin-bottom-btn active"
              : "admin-bottom-btn"
          }
          onClick={() => setActiveSection("menu")}
        >
          <span className="admin-bottom-symbol" aria-hidden>
            ☰
          </span>
          <span>Menu</span>
        </button>
        <button
          type="button"
          className="admin-bottom-btn danger"
          onClick={onLogout}
        >
          <span className="admin-bottom-symbol" aria-hidden>
            ⎋
          </span>
          <span>Logout</span>
        </button>
      </div>
    </section>
  );
}
