import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import { normalizePhoneE164 } from "@/lib/phone";
import { WhatsAppSendError, sendWhatsAppMessage } from "@/lib/whatsapp";

const createReservationSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(8),
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

const buildOwnerMessage = (params: {
  code: string;
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
  dashboardLink: string;
}) => {
  const lines = [
    "Nuova richiesta prenotazione",
    `Codice: ${params.code}`,
    `Nome: ${params.customerName}`,
    `Telefono: ${params.phone}`,
    `Quando: ${params.date} alle ${params.time}`,
    `Persone: ${params.guests}`,
    `Note: ${params.notes || "-"}`,
    "",
    `Apri dashboard: ${params.dashboardLink}`,
  ];

  return lines.join("\n");
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
    const notificationPhone = normalizePhoneE164(parsed.data.phone);

    const reservationDoc = {
      ...parsed.data,
      code,
      status: "pending",
      ownerResponse: "",
      proposedDate: "",
      proposedTime: "",
      notificationPhone: notificationPhone ?? "",
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

    const ownerNumber = process.env.WHATSAPP_OWNER_TO;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000";

    let ownerNotificationSent = false;
    let ownerNotificationError: string | undefined;

    if (ownerNumber) {
      const dashboardLink = `${siteUrl}/riservato/dashboard?tab=reservations&code=${code}`;
      const message = buildOwnerMessage({
        code,
        customerName: parsed.data.customerName,
        phone: parsed.data.phone,
        date: parsed.data.date,
        time: parsed.data.time,
        guests: parsed.data.guests,
        notes: parsed.data.notes,
        dashboardLink,
      });

      try {
        await sendWhatsAppMessage(ownerNumber, message);
        ownerNotificationSent = true;
      } catch (error) {
        console.error("Errore notifica WhatsApp proprietario", error);
        if (error instanceof WhatsAppSendError) {
          if (error.code === 63038) {
            ownerNotificationError =
              "Limite giornaliero Twilio raggiunto: richiesta salvata, ma notifica WhatsApp proprietario non inviata.";
          } else {
            ownerNotificationError =
              "Richiesta salvata, ma notifica WhatsApp proprietario non inviata.";
          }
        } else {
          ownerNotificationError =
            "Richiesta salvata, ma notifica WhatsApp proprietario non inviata.";
        }
      }
    }

    return NextResponse.json({
      ok: true,
      code,
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
