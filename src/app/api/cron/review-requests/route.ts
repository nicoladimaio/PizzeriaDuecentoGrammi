import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendCustomerReviewRequestEmail } from "@/lib/email";
import { toAppLocale } from "@/lib/reservation-i18n";
import { addDaysToDateKey, getRomeNow } from "@/lib/rome-time";

// Richiesta di recensione su Google: email alle prenotazioni confermate di
// ieri, una sola volta per prenotazione. La chiama ogni giorno la funzione
// pianificata di Netlify (netlify/functions/review-requests.mts) con
// CRON_SECRET. Senza CRON_SECRET le richieste sono spente.

type ReservationForReview = {
  code?: string;
  customerName?: string;
  email?: string;
  time?: string;
  status?: string;
  locale?: string;
  reviewRequestSentAt?: string;
};

export async function POST(request: Request) {
  const rejected = rejectUnauthorizedCron(
    request,
    "Richieste di recensione disattivate (CRON_SECRET mancante).",
  );
  if (rejected) return rejected;

  try {
    const db = getAdminDb();
    const yesterday = addDaysToDateKey(getRomeNow().dateKey, -1);
    const snapshot = await db
      .collection("reservations")
      .where("date", "==", yesterday)
      .get();

    let sent = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as ReservationForReview;
      const email = data.email?.trim();
      if (
        data.status !== "confirmed" ||
        data.reviewRequestSentAt ||
        !email ||
        !data.time
      ) {
        continue;
      }

      try {
        await sendCustomerReviewRequestEmail({
          toEmail: email,
          customerName: data.customerName || "",
          date: yesterday,
          time: data.time,
          locale: toAppLocale(data.locale),
        });
        // Segnato solo dopo l'invio: se l'email fallisce, un nuovo avvio
        // della funzione nello stesso giorno ci riprova.
        await doc.ref.update({
          reviewRequestSentAt: new Date().toISOString(),
          updatedAtServer: FieldValue.serverTimestamp(),
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Errore richiesta recensione ${data.code}`, error);
      }
    }

    return NextResponse.json({ ok: true, date: yesterday, sent, failed });
  } catch (error) {
    console.error("Errore POST /api/cron/review-requests", error);
    return NextResponse.json(
      { error: "Invio richieste di recensione non riuscito." },
      { status: 500 },
    );
  }
}
