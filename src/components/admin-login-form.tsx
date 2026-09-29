"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-auth";
import { isAllowedAdminEmail } from "@/lib/auth";
import {
  isAdminSessionExpired,
  markAdminActivity,
  signOutAdmin,
} from "@/lib/admin-session";

export function AdminLoginForm() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    let active = true;

    const checkExistingSession = async () => {
      try {
        if (typeof auth.authStateReady === "function") {
          await auth.authStateReady();
        }

        if (!active) return;

        const user = auth.currentUser;
        if (user && isAllowedAdminEmail(user.email)) {
          if (isAdminSessionExpired()) {
            // Sessione rimasta nel browser ma inattiva da troppo: password.
            await signOutAdmin(auth);
          } else {
            router.replace("/riservato/dashboard");
            return;
          }
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    void checkExistingSession();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isAllowedAdminEmail(user.email) && !isAdminSessionExpired()) {
        router.replace("/riservato/dashboard");
        return;
      }

      if (active) {
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || checkingSession) return;

    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();

    try {
      const auth = getClientAuth();
      // Prima del login, così il listener qui sopra non vede la sessione come scaduta.
      markAdminActivity(true);
      const credentials = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const currentEmail = credentials.user.email;

      if (!isAllowedAdminEmail(currentEmail)) {
        await signOutAdmin(auth);
        setError("Accesso negato.");
        setLoading(false);
        return;
      }

      await credentials.user.getIdToken(true);
      window.location.replace("/riservato/dashboard");
    } catch {
      setError("Credenziali non valide.");
      setLoading(false);
    }
  };

  return (
    <form className="booking-form admin-login-form" onSubmit={onSubmit}>
      <div className="admin-login-fields">
        <label>
          Email amministratore
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <span className="admin-password-field">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="admin-password-toggle"
              aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </span>
        </label>
      </div>
      <button
        className="btn-primary admin-login-submit"
        type="submit"
        disabled={loading || checkingSession}
      >
        {loading ? "Accesso..." : "Accedi"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}

      {checkingSession || loading ? (
        <div className="booking-loader-overlay" role="status" aria-live="polite">
          <div className="booking-loader-card admin-login-loader-card">
            <img
              src="/assets/loader.gif"
              alt="Caricamento"
              className="app-loader-gif"
            />
            <p>
              {checkingSession
                ? "Verifica sessione in corso..."
                : "Verifica credenziali in corso..."}
            </p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
