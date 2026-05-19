"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDoc, collection, doc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { getClientDb } from "@/lib/firebase";

const reservationSchema = z.object({
  customerName: z.string().min(2, "Inserisci nome e cognome."),
  phone: z.string().min(8, "Inserisci un numero valido."),
  email: z.string().email("Email non valida."),
  date: z.string().min(1, "Seleziona una data."),
  time: z.string().min(1, "Seleziona un orario."),
  guests: z.coerce.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
});

const buildCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "DG-";
  for (let i = 0; i < 6; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
};

export function ReservationForm() {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reservationCode, setReservationCode] = useState<string | null>(null);

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFeedback(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      customerName: String(formData.get("customerName") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      date: String(formData.get("date") ?? "").trim(),
      time: String(formData.get("time") ?? "").trim(),
      guests: Number(formData.get("guests") ?? 0),
      notes: String(formData.get("notes") ?? "").trim(),
    };

    const parsed = reservationSchema.safeParse(payload);
    if (!parsed.success) {
      setPending(false);
      setError(
        parsed.error.issues[0]?.message ?? "Controlla i campi e riprova.",
      );
      return;
    }

    try {
      const db = getClientDb();
      const code = buildCode();
      const now = new Date().toISOString();
      const reservationDoc = {
        ...parsed.data,
        code,
        status: "pending" as const,
        ownerResponse: "",
        createdAt: now,
        updatedAt: now,
      };

      await addDoc(collection(db, "reservations"), reservationDoc);
      await setDoc(doc(db, "reservation_status", code), {
        code,
        customerName: parsed.data.customerName,
        date: parsed.data.date,
        time: parsed.data.time,
        guests: parsed.data.guests,
        status: "pending",
        ownerResponse: "",
        updatedAt: now,
      });

      event.currentTarget.reset();
      setReservationCode(code);
      setFeedback(
        "Richiesta inviata correttamente. Ti risponderemo appena possibile.",
      );
    } catch {
      setError("Errore durante l'invio. Riprova tra poco.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="card-block" aria-labelledby="prenota-title">
      <h2 id="prenota-title" className="section-title">
        Prenota Un Tavolo
      </h2>
      <p className="section-subtitle">
        Invia una richiesta. Il proprietario la approvera o rifiutera dalla
        dashboard.
      </p>

      <form className="booking-form" onSubmit={onSubmit}>
        <label>
          Nome e cognome
          <input name="customerName" type="text" required />
        </label>

        <label>
          Telefono
          <input name="phone" type="tel" required />
        </label>

        <label>
          Email
          <input name="email" type="email" required />
        </label>

        <div className="two-cols">
          <label>
            Data
            <input name="date" type="date" min={minDate} required />
          </label>

          <label>
            Orario
            <input name="time" type="time" required />
          </label>
        </div>

        <label>
          Numero persone
          <input
            name="guests"
            type="number"
            min={1}
            max={20}
            defaultValue={2}
            required
          />
        </label>

        <label>
          Note (opzionale)
          <textarea name="notes" rows={4} maxLength={300} />
        </label>

        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Invio in corso..." : "Invia richiesta"}
        </button>
      </form>

      {feedback ? <p className="success-text">{feedback}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {reservationCode ? (
        <p className="booking-code">
          Codice prenotazione: <strong>{reservationCode}</strong>
        </p>
      ) : null}
    </section>
  );
}
