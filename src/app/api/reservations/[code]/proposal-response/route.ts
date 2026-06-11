import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendOwnerProposalOutcomeEmail } from "@/lib/email";
import { verifyProposalActionToken } from "@/lib/reservation-proposal-token";

const htmlResponse = (title: string, message: string, ok = true) => {
  const accent = ok ? "#166534" : "#b42318";
  return new Response(
    `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;font-family:Arial,sans-serif;background:#f5f7f9;color:#183240;">
    <main style="max-width:560px;margin:48px auto;padding:24px;background:#fff;border:1px solid #d9e5ea;border-radius:14px;">
      <h1 style="margin:0 0 12px;font-size:22px;color:${accent};">${title}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;">${message}</p>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
};

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;
    const { searchParams } = new URL(request.url);
    const decisionRaw = searchParams.get("decision");
    const token = searchParams.get("token") ?? "";

    const decision =
      decisionRaw === "accept" || decisionRaw === "reject" ? decisionRaw : null;

    if (!decision || !token) {
      return htmlResponse(
        "Link non valido",
        "Il link usato non e valido.",
        false,
      );
    }

    const validToken = verifyProposalActionToken({
      code,
      decision,
      token,
    });

    if (!validToken) {
      return htmlResponse(
        "Link scaduto o non valido",
        "Il link usato non e valido o e scaduto. Contatta la pizzeria.",
        false,
      );
    }

    const db = getAdminDb();
    const statusRef = db.collection("reservation_status").doc(code);
    const statusSnapshot = await statusRef.get();

    if (!statusSnapshot.exists) {
      return htmlResponse(
        "Prenotazione non trovata",
        "Non abbiamo trovato la prenotazione associata a questo link.",
        false,
      );
    }

    const statusDoc = statusSnapshot.data() as {
      reservationId?: string;
      customerName?: string;
      phone?: string;
      email?: string;
      date: string;
      time: string;
      proposedDate?: string;
      proposedTime?: string;
      status: string;
    };

    if (statusDoc.status !== "proposed") {
      return htmlResponse(
        "Risposta gia registrata",
        "Abbiamo gia registrato una risposta a questa proposta.",
      );
    }

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
      return htmlResponse(
        "Errore prenotazione",
        "Non e stato possibile completare l'operazione. Contatta la pizzeria.",
        false,
      );
    }

    const nowIso = new Date().toISOString();
    const nextStatus = decision === "accept" ? "confirmed" : "rejected";
    const nextDate =
      decision === "accept"
        ? statusDoc.proposedDate || statusDoc.date
        : statusDoc.date;
    const nextTime =
      decision === "accept"
        ? statusDoc.proposedTime || statusDoc.time
        : statusDoc.time;

    const update = {
      status: nextStatus,
      date: nextDate,
      time: nextTime,
      updatedAt: nowIso,
      updatedAtServer: FieldValue.serverTimestamp(),
    };

    await statusRef.update(update);
    await db.collection("reservations").doc(reservationId).update(update);

    try {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.SITE_URL ??
        "http://localhost:3000";
      const dashboardLink = `${siteUrl}/riservato/dashboard?tab=reservations`;
      const logoUrl = `${siteUrl}/assets/Centro.png`;

      await sendOwnerProposalOutcomeEmail({
        code,
        customerName: statusDoc.customerName || "Cliente",
        phone: statusDoc.phone,
        email: statusDoc.email,
        decision,
        date: statusDoc.date,
        time: statusDoc.time,
        proposedDate: statusDoc.proposedDate,
        proposedTime: statusDoc.proposedTime,
        dashboardLink,
        logoUrl,
      });
    } catch (error) {
      console.error("Errore invio email proprietario esito proposta", error);
    }

    if (decision === "accept") {
      return htmlResponse(
        "Proposta confermata",
        `Grazie, abbiamo confermato la prenotazione per ${nextDate} alle ${nextTime}.`,
      );
    }

    return htmlResponse(
      "Proposta rifiutata",
      "Hai rifiutato la proposta oraria. La prenotazione risulta non confermata.",
    );
  } catch (error) {
    console.error(
      "Errore GET /api/reservations/[code]/proposal-response",
      error,
    );
    return htmlResponse(
      "Errore",
      "Non e stato possibile completare la richiesta. Riprova o contatta la pizzeria.",
      false,
    );
  }
}
