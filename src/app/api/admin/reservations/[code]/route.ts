import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";

const updateReservationSchema = z.object({
  arrived: z.boolean(),
});

export async function DELETE(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { code } = await context.params;
    const db = getAdminDb();

    const reservationQuery = await db
      .collection("reservations")
      .where("code", "==", code)
      .limit(1)
      .get();

    const statusRef = db.collection("reservation_status").doc(code);
    const batch = db.batch();

    if (!reservationQuery.empty) {
      batch.delete(reservationQuery.docs[0].ref);
    }

    const statusSnapshot = await statusRef.get();
    if (statusSnapshot.exists) {
      batch.delete(statusRef);
    }

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Errore DELETE /api/admin/reservations/[code]", error);
    return NextResponse.json(
      { error: "Impossibile eliminare la prenotazione." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const payload = (await request.json()) as unknown;
    const parsed = updateReservationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
        { status: 400 },
      );
    }

    const { code } = await context.params;
    const db = getAdminDb();
    const nowIso = new Date().toISOString();

    const reservationQuery = await db
      .collection("reservations")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (reservationQuery.empty) {
      return NextResponse.json(
        { error: "Prenotazione non trovata." },
        { status: 404 },
      );
    }

    await reservationQuery.docs[0].ref.update({
      arrived: parsed.data.arrived,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    const statusRef = db.collection("reservation_status").doc(code);
    const statusSnapshot = await statusRef.get();
    if (statusSnapshot.exists) {
      await statusRef.update({
        arrived: parsed.data.arrived,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true, arrived: parsed.data.arrived });
  } catch (error) {
    console.error("Errore PATCH /api/admin/reservations/[code]", error);
    return NextResponse.json(
      { error: "Impossibile aggiornare la prenotazione." },
      { status: 500 },
    );
  }
}
