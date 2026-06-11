import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendOwnerNewReservationEmail } from "@/lib/email";

const createReservationSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email(),
  diningArea: z.enum(["inside", "outside"]),
  date: z.string().min(1),
  time: z.string().min(1),
  guests: z.number().int().min(1).max(20),
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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const parsed = createReservationSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati prenotazione non validi." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const nowIso = new Date().toISOString();
    const code = buildCode();
    const reservationId = db.collection("reservations").doc().id;

    const reservationDoc = {
      ...parsed.data,
      code,
      status: "pending",
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      createdAt: nowIso,
      updatedAt: nowIso,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await db.collection("reservations").doc(reservationId).set(reservationDoc);

    await db.collection("reservation_status").doc(code).set({
      reservationId,
      code,
      customerName: parsed.data.customerName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      diningArea: parsed.data.diningArea,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      status: "pending",
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000";

    let ownerNotificationSent = false;
    let ownerNotificationError: string | undefined;

    try {
      const dashboardLink = `${siteUrl}/riservato/accesso-200g`;
      const logoUrl = `${siteUrl}/assets/Centro.png`;
      await sendOwnerNewReservationEmail({
        customerName: parsed.data.customerName,
        phone: parsed.data.phone,
        date: parsed.data.date,
        time: parsed.data.time,
        guests: parsed.data.guests,
        notes: parsed.data.notes,
        dashboardLink,
        logoUrl,
      });
      ownerNotificationSent = true;
    } catch (error) {
      // The reservation remains saved even if email delivery fails.
      console.error("Errore invio email proprietario", error);
      ownerNotificationError =
        "Richiesta salvata, ma email proprietario non inviata.";
    }

    return NextResponse.json({
      ok: true,
      ownerNotificationSent,
      ownerNotificationError,
    });
  } catch (error) {
    console.error("Errore POST /api/reservations", error);
    return NextResponse.json(
      { error: "Errore durante l'invio della prenotazione." },
      { status: 500 },
    );
  }
}
