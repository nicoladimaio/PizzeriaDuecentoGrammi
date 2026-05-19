"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { isAllowedAdminEmail } from "@/lib/auth";

export function AdminLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        return;
      }

      router.push("/riservato/dashboard");
    } catch {
      setError("Credenziali non valide.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="booking-form" onSubmit={onSubmit}>
      <label>
        Email amministratore
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Accesso..." : "Accedi"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </form>
  );
}
