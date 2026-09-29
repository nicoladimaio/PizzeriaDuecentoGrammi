import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebase-admin";
import { buildReservationCode } from "@/lib/reservation-code";
import {
  sendCustomerReservationRecapEmail,
  sendOwnerNewReservationEmail,
} from "@/lib/email";
import {
  BOOKING_TERMS_VERSION,
  PRIVACY_POLICY_VERSION,
} from "@/lib/reservation-policies";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
  DATE_KEY_REGEX,
  TIME_REGEX,
  countReservedSeats,
  getSlotRejectionReason,
  resolveReservationSettings,
} from "@/lib/reservation-availability";
import { getRomeNow } from "@/lib/rome-time";
import { toAppLocale } from "@/lib/reservation-i18n";
import { buildCancelUrl } from "@/lib/reservation-links";

class SlotUnavailableError extends Error {}

const slotUnavailableResponse = () =>
  NextResponse.json(
    {
      error:
        "L'orario scelto non è più disponibile. Scegli un altro orario.",
      code: "slot_unavailable",
    },
    { status: 409 },
  );

const createReservationSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().max(254).email(),
  date: z.string().regex(DATE_KEY_REGEX),
  time: z.string().regex(TIME_REGEX),
  guests: z.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
  privacyAcknowledged: z.literal(true),
  bookingTermsAccepted: z.literal(true),
  privacyPolicyVersion: z.literal(PRIVACY_POLICY_VERSION),
  bookingTermsVersion: z.literal(BOOKING_TERMS_VERSION),
  // Lingua del sito al momento della prenotazione (per future email tradotte).
  locale: z.enum(["it", "en", "es", "de"]).optional(),
  turnstileToken: z.string().max(2048).optional(),
  // Campo trappola: invisibile per le persone, i bot lo compilano.
  website: z.string().optional(),
});

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

    const { turnstileToken, website, ...reservationData } = parsed.data;

    if (website) {
      // Risposta finta: il bot crede di aver prenotato, noi non salviamo nulla.
      return NextResponse.json({ ok: true });
    }

    const humanVerified = await verifyTurnstileToken(
      turnstileToken,
      request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (!humanVerified) {
      return NextResponse.json(
        { error: "Verifica anti-spam non superata. Riprova.", code: "captcha_failed" },
        { status: 400 },
      );
    }

    const db = getAdminDb();

    // Il calendario mostra solo gli orari liberi, ma il server non si fida:
    // ricontrolla giorno, orario e posti prima di salvare.
    const settings = await resolveReservationSettings(db);
    if (
      getSlotRejectionReason(
        reservationData.date,
        reservationData.time,
        settings,
        getRomeNow(),
      )
    ) {
      return slotUnavailableResponse();
    }
    const totalCapacity = settings.capacityPerSlot;

    const nowIso = new Date().toISOString();
    const code = buildReservationCode();
    const reservationId = db.collection("reservations").doc().id;
    const normalizedPhone = (reservationData.phone ?? "").trim();

    const reservationDoc = {
      ...reservationData,
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

    const statusDoc = {
      reservationId,
      code,
      customerName: parsed.data.customerName,
      phone: normalizedPhone,
      email: parsed.data.email,
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
    };

    // Conteggio posti e scrittura nella stessa transazione: se due clienti
    // prenotano l'ultimo tavolo nello stesso istante, uno dei due viene
    // rifiutato invece di sforare la capienza.
    const slotQuery = db
      .collection("reservations")
      .where("date", "==", reservationData.date)
      .where("time", "==", reservationData.time);

    try {
      await db.runTransaction(async (transaction) => {
        const slotSnapshot = await transaction.get(slotQuery);
        const reservedSeats = countReservedSeats(slotSnapshot.docs);

        if (reservedSeats + reservationData.guests > totalCapacity) {
          throw new SlotUnavailableError();
        }

        transaction.set(
          db.collection("reservations").doc(reservationId),
          reservationDoc,
        );
        transaction.set(db.collection("reservation_status").doc(code), statusDoc);
      });
    } catch (error) {
      if (error instanceof SlotUnavailableError) {
        return slotUnavailableResponse();
      }
      throw error;
    }

    let ownerNotificationSent = false;
    let ownerNotificationError: string | undefined;
    let customerRecapSent = false;
    let customerRecapError: string | undefined;

    try {
      await sendCustomerReservationRecapEmail({
        toEmail: parsed.data.email,
        customerName: parsed.data.customerName,
        date: parsed.data.date,
        time: parsed.data.time,
        guests: parsed.data.guests,
        notes: parsed.data.notes,
        locale: toAppLocale(parsed.data.locale),
        cancelUrl: buildCancelUrl(
          code,
          parsed.data.date,
          toAppLocale(parsed.data.locale),
        ),
      });
      customerRecapSent = true;
    } catch (error) {
      console.error("Errore invio email recap cliente", error);
      customerRecapError = "Richiesta salvata, ma recap cliente non inviato.";
    }

    try {
      await sendOwnerNewReservationEmail({
        customerName: parsed.data.customerName,
        phone: normalizedPhone,
        date: parsed.data.date,
        time: parsed.data.time,
        guests: parsed.data.guests,
        notes: parsed.data.notes,
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
