"use client";

import { FormEvent, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";

type StatusDoc = {
  code: string;
  customerName: string;
  date: string;
  time: string;
  guests: number;
  status: "pending" | "confirmed" | "rejected";
  ownerResponse: string;
};

const statusMap: Record<StatusDoc["status"], string> = {
  pending: "In attesa di risposta",
  confirmed: "Confermata",
  rejected: "Non confermata",
};

export function ReservationStatusChecker() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StatusDoc | null>(null);

  const onCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "")
      .trim()
      .toUpperCase();

    if (!code) {
      setLoading(false);
      setError("Inserisci un codice prenotazione.");
      return;
    }

    try {
      const db = getClientDb();
      const snapshot = await getDoc(doc(db, "reservation_status", code));
      if (!snapshot.exists()) {
        setError("Nessuna prenotazione trovata con questo codice.");
      } else {
        setResult(snapshot.data() as StatusDoc);
      }
    } catch {
      setError("Impossibile recuperare lo stato in questo momento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card-block" aria-labelledby="stato-title">
      <h2 id="stato-title" className="section-title">
        Controlla Lo Stato
      </h2>
      <p className="section-subtitle">
        Inserisci il codice ricevuto al momento della richiesta.
      </p>

      <form className="status-form" onSubmit={onCheck}>
        <input name="code" placeholder="Es. DG-A2K9QW" maxLength={9} required />
        <button className="btn-secondary" type="submit" disabled={loading}>
          {loading ? "Verifica..." : "Verifica stato"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      {result ? (
        <div className="status-result">
          <p>
            <strong>Intestatario:</strong> {result.customerName}
          </p>
          <p>
            <strong>Quando:</strong> {result.date} alle {result.time}
          </p>
          <p>
            <strong>Persone:</strong> {result.guests}
          </p>
          <p>
            <strong>Esito:</strong>{" "}
            <span className={`badge ${result.status}`}>
              {statusMap[result.status]}
            </span>
          </p>
          <p>
            <strong>Messaggio del proprietario:</strong>{" "}
            {result.ownerResponse || "Nessun messaggio al momento."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
