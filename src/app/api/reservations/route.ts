import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  sendCustomerReservationRecapEmail,
  sendOwnerNewReservationEmail,
} from "@/lib/email";
import {
  BOOKING_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
} from "@/lib/reservation-policies";

const createReservationSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().email(),
  diningArea: z.enum(["inside", "outside"]),
  date: z.string().min(1),
  time: z.string().min(1),
  guests: z.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
  privacyAcknowledged: z.literal(true),
  bookingTermsAccepted: z.literal(true),
  privacyPolicyVersion: z.literal(PRIVACY_POLICY_VERSION),
  bookingTermsVersion: z.literal(BOOKING_TERMS_VERSION),
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
    const normalizedPhone = (parsed.data.phone ?? "").trim();

    const reservationDoc = {
      ...parsed.data,
      phone: normalizedPhone,
      legalAcceptedAt: nowIso,
      code,
      status: "pending",
      arrived: false,
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
      phone: normalizedPhone,
      email: parsed.data.email,
      diningArea: parsed.data.diningArea,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      status: "pending",
      arrived: false,
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      privacyAcknowledged: parsed.data.privacyAcknowledged,
      bookingTermsAccepted: parsed.data.bookingTermsAccepted,
      privacyPolicyVersion: parsed.data.privacyPolicyVersion,
      bookingTermsVersion: parsed.data.bookingTermsVersion,
      legalAcceptedAt: nowIso,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000";

    let ownerNotificationSent = false;
    let ownerNotificationError: string | undefined;
    let customerRecapSent = false;
    let customerRecapError: string | undefined;

    try {
      const logoUrl = `${siteUrl}/assets/Centro.png`;
      await sendCustomerReservationRecapEmail({
        toEmail: parsed.data.email,
        customerName: parsed.data.customerName,
        date: parsed.data.date,
        time: parsed.data.time,
        guests: parsed.data.guests,
        diningArea: parsed.data.diningArea,
        notes: parsed.data.notes,
        logoUrl,
      });
      customerRecapSent = true;
    } catch (error) {
      console.error("Errore invio email recap cliente", error);
      customerRecapError = "Richiesta salvata, ma recap cliente non inviato.";
    }

    try {
      const dashboardLink = `${siteUrl}/riservato/dashboard?tab=reservations`;
      const logoUrl = `${siteUrl}/assets/Centro.png`;
      await sendOwnerNewReservationEmail({
        customerName: parsed.data.customerName,
        phone: normalizedPhone,
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
      customerRecapSent,
      customerRecapError,
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
