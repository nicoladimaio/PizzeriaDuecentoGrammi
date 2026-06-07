import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { normalizePhoneE164 } from "@/lib/phone";
import { WhatsAppSendError, sendWhatsAppMessage } from "@/lib/whatsapp";

const decisionSchema = z
  .object({
    action: z.enum(["confirmed", "rejected", "proposed"]),
    ownerResponse: z.string().max(300).optional(),
    proposedDate: z.string().optional(),
    proposedTime: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "proposed") {
      if (!value.proposedDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["proposedDate"],
          message: "Data proposta obbligatoria.",
        });
      }
      if (!value.proposedTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["proposedTime"],
          message: "Orario proposto obbligatorio.",
        });
      }
    }
  });

const getBearerToken = (request: Request): string | null => {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
};

const isAllowedAdminEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  const whitelist = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return whitelist.includes(email.toLowerCase());
};

const customerMessage = (params: {
  customerName: string;
  action: "confirmed" | "rejected" | "proposed";
  date: string;
  time: string;
  proposedDate?: string;
  proposedTime?: string;
  ownerResponse?: string;
}) => {
  if (params.action === "confirmed") {
    return [
      `Ciao ${params.customerName}, la tua prenotazione e stata confermata.`,
      `Data: ${params.date}`,
      `Orario: ${params.time}`,
      params.ownerResponse ? `Messaggio: ${params.ownerResponse}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (params.action === "rejected") {
    return [
      `Ciao ${params.customerName}, la tua prenotazione non puo essere confermata.`,
      params.ownerResponse ? `Messaggio: ${params.ownerResponse}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Ciao ${params.customerName}, proponiamo un nuovo orario:`,
    `Data: ${params.proposedDate}`,
    `Orario: ${params.proposedTime}`,
    params.ownerResponse ? `Messaggio: ${params.ownerResponse}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    if (!isAllowedAdminEmail(decoded.email)) {
      return NextResponse.json({ error: "Accesso negato." }, { status: 403 });
    }

    const { code } = await context.params;
    const payload = (await request.json()) as unknown;
    const parsed = decisionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const statusRef = db.collection("reservation_status").doc(code);
    const statusSnapshot = await statusRef.get();

    if (!statusSnapshot.exists) {
      return NextResponse.json(
        { error: "Prenotazione non trovata." },
        { status: 404 },
      );
    }

    const statusDoc = statusSnapshot.data() as {
      reservationId?: string;
      customerName: string;
      phone?: string;
      date: string;
      time: string;
      guests: number;
    };

    const nowIso = new Date().toISOString();
    let reservationId = statusDoc.reservationId;

    if (!reservationId) {
      const fallbackQuery = await db
        .collection("reservations")
        .where("code", "==", code)
        .limit(1)
        .get();

      if (!fallbackQuery.empty) {
        reservationId = fallbackQuery.docs[0].id;
        await statusRef.update({ reservationId });
      }
    }

    if (!reservationId) {
      return NextResponse.json(
        { error: "ID prenotazione mancante." },
        { status: 500 },
      );
    }

    const statusUpdate = {
      status: parsed.data.action,
      ownerResponse: parsed.data.ownerResponse ?? "",
      proposedDate: parsed.data.proposedDate ?? "",
      proposedTime: parsed.data.proposedTime ?? "",
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await statusRef.update(statusUpdate);

    await db
      .collection("reservations")
      .doc(reservationId)
      .update({
        ...statusUpdate,
      });

    const reservationSnapshot = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    const reservationDoc = reservationSnapshot.data() as
      | {
          customerName: string;
          notificationPhone?: string;
        }
      | undefined;

    const phone =
      normalizePhoneE164(reservationDoc?.notificationPhone ?? "") ??
      normalizePhoneE164(statusDoc.phone ?? "");

    let customerNotificationSent = false;
    let customerNotificationError: string | undefined;
    if (phone) {
      try {
        await sendWhatsAppMessage(
          phone,
          customerMessage({
            customerName:
              reservationDoc?.customerName ?? statusDoc.customerName,
            action: parsed.data.action,
            date: statusDoc.date,
            time: statusDoc.time,
            proposedDate: parsed.data.proposedDate,
            proposedTime: parsed.data.proposedTime,
            ownerResponse: parsed.data.ownerResponse,
          }),
        );
        customerNotificationSent = true;
      } catch (error) {
        console.error("Errore notifica WhatsApp cliente", error);
        if (error instanceof WhatsAppSendError) {
          if (error.code === 63038) {
            customerNotificationError =
              "Stato aggiornato, ma Twilio ha raggiunto il limite giornaliero: notifica cliente non inviata.";
          } else {
            customerNotificationError =
              "Stato aggiornato, ma notifica WhatsApp cliente non inviata.";
          }
        } else {
          customerNotificationError =
            "Stato aggiornato, ma notifica WhatsApp cliente non inviata.";
        }
      }
    } else {
      customerNotificationError =
        "Stato aggiornato, ma numero cliente non valido per WhatsApp.";
    }

    return NextResponse.json({
      ok: true,
      customerNotificationSent,
      customerNotificationError,
    });
  } catch (error) {
    console.error("Errore POST /api/reservations/[code]/decision", error);
    return NextResponse.json(
      { error: "Errore durante l'aggiornamento della prenotazione." },
      { status: 500 },
    );
  }
}
