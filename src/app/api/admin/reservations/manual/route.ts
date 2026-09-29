import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildReservationCode } from "@/lib/reservation-code";
import {
  DATE_KEY_REGEX,
  TIME_REGEX,
  countReservedSeats,
  resolveReservationSettings,
} from "@/lib/reservation-availability";

const manualReservationSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  date: z.string().regex(DATE_KEY_REGEX),
  time: z.string().regex(TIME_REGEX),
  guests: z.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const payload = (await request.json()) as unknown;
    const parsed = manualReservationSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();
    const code = buildReservationCode();
    const reservationId = db.collection("reservations").doc().id;
    const normalizedEmail = (parsed.data.email ?? "").trim();
    const normalizedPhone = (parsed.data.phone ?? "").trim();

    // Dall'area riservata si può prenotare anche fuori orario o in un giorno
    // chiuso: si controlla solo la capienza.
    const { capacityPerSlot: totalCapacity } = await resolveReservationSettings(db);

    const occupancySnap = await db
      .collection("reservations")
      .where("date", "==", parsed.data.date)
      .where("time", "==", parsed.data.time)
      .get();

    const reservedSeats = countReservedSeats(occupancySnap.docs);

    if (reservedSeats + parsed.data.guests > totalCapacity) {
      return NextResponse.json(
        {
          error: "Capienza superata per questa fascia oraria.",
        },
        { status: 400 },
      );
    }

    const reservationDoc = {
      customerName: parsed.data.customerName,
      phone: normalizedPhone,
      email: normalizedEmail,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      notes: parsed.data.notes ?? "",
      code,
      status: "confirmed",
      arrived: false,
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      createdAt: nowIso,
      updatedAt: nowIso,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
      createdManually: true,
    };

    await db.collection("reservations").doc(reservationId).set(reservationDoc);

    await db.collection("reservation_status").doc(code).set({
      reservationId,
      code,
      customerName: parsed.data.customerName,
      phone: normalizedPhone,
      email: normalizedEmail,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      status: "confirmed",
      arrived: false,
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, code });
  } catch (error) {
    console.error("Errore POST /api/admin/reservations/manual", error);
    return NextResponse.json(
      { error: "Impossibile creare la prenotazione manuale." },
      { status: 500 },
    );
  }
}
