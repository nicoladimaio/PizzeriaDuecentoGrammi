import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  deleteLegacyStatusCopy,
  findReservationByCode,
  writeLegacyStatusCopy,
} from "@/lib/reservation-store";

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

    const found = await findReservationByCode(db, code);
    const batch = db.batch();
    if (found) batch.delete(found.ref);
    deleteLegacyStatusCopy(db, batch, code);
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

    const updated = await db.runTransaction(async (transaction) => {
      const found = await findReservationByCode(db, code, transaction);
      if (!found) return false;

      const update = {
        arrived: parsed.data.arrived,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      };
      transaction.update(found.ref, update);
      writeLegacyStatusCopy(db, transaction, found.ref.id, {
        ...found.data,
        ...update,
      });
      return true;
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Prenotazione non trovata." },
        { status: 404 },
      );
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
