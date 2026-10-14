import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendCustomerDecisionEmail } from "@/lib/email";
import { toAppLocale } from "@/lib/reservation-i18n";
import {
  buildCancelUrl,
  buildProposalResponseUrls,
} from "@/lib/reservation-links";
import {
  findReservationByCode,
  writeLegacyStatusCopy,
} from "@/lib/reservation-store";

type ReservationData = {
  customerName?: string;
  email?: string;
  locale?: string;
  date: string;
  time: string;
  guests?: number;
  status?: string;
};

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

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

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
    const nowIso = new Date().toISOString();

    // Prenotazione e copia di compatibilità aggiornate nella stessa
    // transazione. Restituisce i dati di prima dell'aggiornamento.
    const reservation = await db.runTransaction(async (transaction) => {
      const found = await findReservationByCode(db, code, transaction);
      if (!found) return null;

      const update = {
        status: parsed.data.action,
        ownerResponse: parsed.data.ownerResponse ?? "",
        proposedDate: parsed.data.proposedDate ?? "",
        proposedTime: parsed.data.proposedTime ?? "",
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      };

      transaction.update(found.ref, update);
      writeLegacyStatusCopy(db, transaction, found.ref.id, {
        ...found.data,
        ...update,
      });

      return found.data as ReservationData;
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Prenotazione non trovata." },
        { status: 404 },
      );
    }

    let customerNotificationSent = false;
    let customerNotificationError: string | undefined;

    try {
      const locale = toAppLocale(reservation.locale);
      const customerEmail =
        typeof reservation.email === "string" ? reservation.email.trim() : "";

      if (customerEmail) {
        const customerEmailAction =
          parsed.data.action === "rejected" && reservation.status === "confirmed"
            ? "cancelled"
            : parsed.data.action;

        const proposalUrls =
          parsed.data.action === "proposed"
            ? buildProposalResponseUrls(code, locale)
            : undefined;

        await sendCustomerDecisionEmail({
          toEmail: customerEmail,
          customerName: reservation.customerName || "Cliente",
          action: customerEmailAction,
          date: reservation.date,
          time: reservation.time,
          guests: reservation.guests,
          proposedDate: parsed.data.proposedDate,
          proposedTime: parsed.data.proposedTime,
          ownerResponse: parsed.data.ownerResponse,
          proposalAcceptUrl: proposalUrls?.acceptUrl,
          proposalRejectUrl: proposalUrls?.rejectUrl,
          cancelUrl:
            customerEmailAction === "confirmed"
              ? buildCancelUrl(code, reservation.date, locale)
              : undefined,
          locale,
        });
        customerNotificationSent = true;
      } else {
        customerNotificationError =
          "Stato aggiornato, ma email cliente mancante: notifica non inviata.";
      }
    } catch (error) {
      // The reservation status remains updated even if the email fails.
      console.error("Errore invio email cliente", error);
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "errore sconosciuto";
      customerNotificationError = `Stato aggiornato, ma email cliente non inviata (${detail}).`;
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
