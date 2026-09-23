import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { addDaysToDateKey, getRomeNow } from "@/lib/rome-time";

const HISTORY_RETENTION_DAYS = 14;
// Firestore accetta al massimo 500 operazioni per batch e ogni prenotazione
// ne richiede 2 (prenotazione + stato): 200 per batch lascia margine.
const RESERVATIONS_PER_BATCH = 200;

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const db = getAdminDb();
    const retentionCutoffKey = addDaysToDateKey(
      getRomeNow().dateKey,
      -(HISTORY_RETENTION_DAYS + 1),
    );

    const oldReservations = await db
      .collection("reservations")
      .where("date", "<=", retentionCutoffKey)
      .get();

    if (oldReservations.empty) {
      return NextResponse.json({ ok: true, deletedCount: 0 });
    }

    const docs = oldReservations.docs;
    let deletedCount = 0;

    for (let start = 0; start < docs.length; start += RESERVATIONS_PER_BATCH) {
      const batch = db.batch();
      const chunk = docs.slice(start, start + RESERVATIONS_PER_BATCH);

      for (const doc of chunk) {
        const data = doc.data() as { code?: string };
        batch.delete(doc.ref);

        if (data.code) {
          batch.delete(db.collection("reservation_status").doc(data.code));
        }
      }

      await batch.commit();
      deletedCount += chunk.length;
    }

    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    console.error("Errore POST /api/admin/reservations/cleanup", error);
    return NextResponse.json(
      { error: "Impossibile eliminare le prenotazioni vecchie." },
      { status: 500 },
    );
  }
}
