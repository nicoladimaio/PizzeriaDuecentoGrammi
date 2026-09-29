import crypto from "crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendCustomerReminderEmail } from "@/lib/email";
import { toAppLocale } from "@/lib/reservation-i18n";
import { buildCancelUrl } from "@/lib/reservation-links";
import { getRomeNow } from "@/lib/rome-time";

// Promemoria del giorno: email alle prenotazioni confermate di oggi.
// La chiama ogni mattina la funzione pianificata di Netlify
// (netlify/functions/reservation-reminders.mts) con CRON_SECRET.
// Senza CRON_SECRET i promemoria sono spenti.

const isAuthorized = (request: Request, secret: string) => {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    header.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  );
};

type ReservationForReminder = {
  code?: string;
  customerName?: string;
  email?: string;
  date?: string;
  time?: string;
  guests?: number;
  status?: string;
  locale?: string;
  reminderSentAt?: string;
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Promemoria disattivati (CRON_SECRET mancante)." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const today = getRomeNow().dateKey;
    const snapshot = await db
      .collection("reservations")
      .where("date", "==", today)
      .get();

    let sent = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as ReservationForReminder;
      const email = data.email?.trim();
      if (
        data.status !== "confirmed" ||
        data.reminderSentAt ||
        !email ||
        !data.code ||
        !data.time
      ) {
        continue;
      }

      const locale = toAppLocale(data.locale);
      try {
        await sendCustomerReminderEmail({
          toEmail: email,
          customerName: data.customerName || "",
          date: today,
          time: data.time,
          guests: typeof data.guests === "number" ? data.guests : 1,
          locale,
          cancelUrl: buildCancelUrl(data.code, today, locale),
        });
        // Segnato solo dopo l'invio: se l'email fallisce, un nuovo avvio
        // della funzione nello stesso giorno ci riprova.
        await doc.ref.update({
          reminderSentAt: new Date().toISOString(),
          updatedAtServer: FieldValue.serverTimestamp(),
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Errore promemoria prenotazione ${data.code}`, error);
      }
    }

    return NextResponse.json({ ok: true, date: today, sent, failed });
  } catch (error) {
    console.error("Errore POST /api/cron/reservation-reminders", error);
    return NextResponse.json(
      { error: "Invio promemoria non riuscito." },
      { status: 500 },
    );
  }
}
