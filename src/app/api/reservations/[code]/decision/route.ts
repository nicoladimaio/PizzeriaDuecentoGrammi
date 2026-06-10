import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { sendCustomerDecisionEmail } from "@/lib/email";
import { createProposalActionToken } from "@/lib/reservation-proposal-token";

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
      email?: string;
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

    let customerNotificationSent = false;
    let customerNotificationError: string | undefined;

    try {
      const reservationSnapshot = await db
        .collection("reservations")
        .doc(reservationId)
        .get();

      const reservationDoc = reservationSnapshot.data() as
        | {
            customerName?: string;
            email?: string;
          }
        | undefined;

      const customerEmail =
        typeof reservationDoc?.email === "string"
          ? reservationDoc.email.trim()
          : typeof statusDoc.email === "string"
            ? statusDoc.email.trim()
            : "";

      if (customerEmail) {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ??
          process.env.SITE_URL ??
          "http://localhost:3000";

        const expiresAt = Date.now() + 1000 * 60 * 60 * 48;
        const acceptToken = createProposalActionToken({
          code,
          decision: "accept",
          expiresAt,
        });
        const rejectToken = createProposalActionToken({
          code,
          decision: "reject",
          expiresAt,
        });

        const proposalAcceptUrl = `${siteUrl}/api/reservations/${encodeURIComponent(code)}/proposal-response?decision=accept&token=${encodeURIComponent(acceptToken)}`;
        const proposalRejectUrl = `${siteUrl}/api/reservations/${encodeURIComponent(code)}/proposal-response?decision=reject&token=${encodeURIComponent(rejectToken)}`;
        const logoUrl = `${siteUrl}/assets/Centro.png`;

        await sendCustomerDecisionEmail({
          toEmail: customerEmail,
          customerName:
            reservationDoc?.customerName || statusDoc.customerName || "Cliente",
          action: parsed.data.action,
          date: statusDoc.date,
          time: statusDoc.time,
          proposedDate: parsed.data.proposedDate,
          proposedTime: parsed.data.proposedTime,
          ownerResponse: parsed.data.ownerResponse,
          logoUrl,
          proposalAcceptUrl:
            parsed.data.action === "proposed" ? proposalAcceptUrl : undefined,
          proposalRejectUrl:
            parsed.data.action === "proposed" ? proposalRejectUrl : undefined,
        });
        customerNotificationSent = true;
      } else {
        customerNotificationError =
          "Stato aggiornato, ma email cliente mancante: notifica non inviata.";
      }
    } catch (error) {
      // The reservation status remains updated even if the email fails.
      console.error("Errore invio email cliente", error);
      customerNotificationError =
        "Stato aggiornato, ma email cliente non inviata.";
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
