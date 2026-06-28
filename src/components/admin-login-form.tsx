"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { isAllowedAdminEmail } from "@/lib/auth";

export function AdminLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && isAllowedAdminEmail(user.email)) {
        router.replace("/riservato/dashboard");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "").trim();

    try {
      const auth = getClientAuth();
      const credentials = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const currentEmail = credentials.user.email;

      if (!isAllowedAdminEmail(currentEmail)) {
        await auth.signOut();
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
      <button className="btn-primary admin-login-submit" type="submit" disabled={loading}>
        {loading ? "Accesso..." : "Accedi"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <div className="booking-loader-overlay" role="status" aria-live="polite">
          <div className="booking-loader-card admin-login-loader-card">
            <img
              src="/assets/loader.gif"
              alt="Caricamento"
              className="app-loader-gif"
            />
            <p>Verifica credenziali in corso...</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
