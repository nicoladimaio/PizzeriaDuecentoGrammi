"use client";

import { FormEvent, useState } from "react";

type StatusDoc = {
  customerName: string;
  date: string;
  time: string;
  guests: number;
  status: "pending" | "confirmed" | "rejected" | "proposed";
  ownerResponse: string;
  proposedDate?: string;
  proposedTime?: string;
  updatedAt?: string;
};

const statusMap: Record<StatusDoc["status"], string> = {
  pending: "In attesa di risposta",
  confirmed: "Confermata",
  rejected: "Non confermata",
  proposed: "Nuovo orario proposto",
};

export function ReservationStatusChecker({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StatusDoc | null>(null);

  const onCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      setLoading(false);
      setError("Inserisci una email valida.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLoading(false);
      setError("Inserisci una email valida.");
      return;
    }

    try {
      const response = await fetch(
        `/api/reservations/status?email=${encodeURIComponent(email)}`,
      );
      const data = (await response.json()) as {
        result?: StatusDoc;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Impossibile recuperare lo stato in questo momento.");
      } else if (data.result) {
        setResult(data.result);
      } else {
        setError("Nessuna prenotazione trovata con questa email.");
      }
    } catch {
      setError("Impossibile recuperare lo stato in questo momento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={compact ? "status-popup-body" : "card-block"}
      aria-labelledby="stato-title"
    >
      {!compact ? (
        <>
          <h2 id="stato-title" className="section-title">
            Stato prenotazione
          </h2>
          <p className="section-subtitle">
            Inserisci l'email usata per la richiesta.
          </p>
        </>
      ) : (
        <p className="section-subtitle">
          Inserisci l'email usata per la richiesta.
        </p>
      )}

      <form className="status-form" onSubmit={onCheck}>
        <input
          name="email"
          type="email"
          placeholder="Es. nome@email.com"
          required
        />
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
          {result.status === "proposed" &&
          result.proposedDate &&
          result.proposedTime ? (
            <p>
              <strong>Nuova proposta:</strong> {result.proposedDate} alle{" "}
              {result.proposedTime}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
