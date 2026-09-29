import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendOwnerProposalOutcomeEmail } from "@/lib/email";
import { verifyReservationActionToken } from "@/lib/reservation-action-token";
import {
  confirmForm,
  errorPage,
  escapeHtml,
  getPageLocale,
  htmlPage,
  invalidLinkPage,
  messagePage,
  notFoundPage,
  paragraph,
} from "@/lib/reservation-action-page";
import { formatWhen, getReservationTranslator } from "@/lib/reservation-i18n";
import type { AppLocale } from "@/i18n/routing";

// Risposta del cliente a una proposta di orario: il link nell'email (GET)
// mostra la pagina con il pulsante, il click (POST) registra la risposta.

type Decision = "accept" | "reject";

type StatusDoc = {
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

const parseDecision = (value: unknown): Decision | null =>
  value === "accept" || value === "reject" ? value : null;

const alreadyAnsweredPage = (locale: AppLocale) => {
  const t = getReservationTranslator(locale);
  return messagePage(
    locale,
    t("page.proposal.alreadyAnsweredTitle"),
    t("page.proposal.alreadyAnsweredText"),
  );
};

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const locale = getPageLocale(request);
  try {
    const { code } = await context.params;
    const { searchParams } = new URL(request.url);
    const decision = parseDecision(searchParams.get("decision"));
    const token = searchParams.get("token") ?? "";

    if (
      !decision ||
      !token ||
      !verifyReservationActionToken({ code, decision, token })
    ) {
      return invalidLinkPage(locale);
    }

    const statusSnapshot = await getAdminDb()
      .collection("reservation_status")
      .doc(code)
      .get();

    if (!statusSnapshot.exists) {
      return notFoundPage(locale);
    }

    const statusDoc = statusSnapshot.data() as StatusDoc;
    if (statusDoc.status !== "proposed") {
      return alreadyAnsweredPage(locale);
    }

    const t = getReservationTranslator(locale);
    const accept = decision === "accept";
    const proposedWhen = formatWhen(
      statusDoc.proposedDate || statusDoc.date,
      statusDoc.proposedTime || statusDoc.time,
      locale,
    );

    return htmlPage(
      locale,
      accept
        ? t("page.proposal.acceptQuestion")
        : t("page.proposal.rejectQuestion"),
      `${paragraph(
        t("page.proposal.requested", {
          when: formatWhen(statusDoc.date, statusDoc.time, locale),
        }),
      )}
      <p style="margin:8px 0 0;font-size:15px;line-height:1.6;">${escapeHtml(t("page.proposal.proposed"))} <strong>${escapeHtml(proposedWhen)}</strong></p>
      ${confirmForm(
        { decision, token },
        accept
          ? t("page.proposal.acceptButton")
          : t("page.proposal.rejectButton"),
        accept ? "#166534" : "#b42318",
      )}`,
    );
  } catch (error) {
    console.error(
      "Errore GET /api/reservations/[code]/proposal-response",
      error,
    );
    return errorPage(locale);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const locale = getPageLocale(request);
  try {
    const { code } = await context.params;
    const form = await request.formData();
    const decision = parseDecision(form.get("decision"));
    const tokenValue = form.get("token");
    const token = typeof tokenValue === "string" ? tokenValue : "";

    if (
      !decision ||
      !token ||
      !verifyReservationActionToken({ code, decision, token })
    ) {
      return invalidLinkPage(locale);
    }

    const db = getAdminDb();
    const statusRef = db.collection("reservation_status").doc(code);

    // Lettura e scrittura nella stessa transazione: due click ravvicinati (o
    // "accetta" e "rifiuta" insieme) non possono registrare due risposte.
    const outcome = await db.runTransaction(async (transaction) => {
      const statusSnapshot = await transaction.get(statusRef);
      if (!statusSnapshot.exists) return { kind: "not_found" as const };

      const statusDoc = statusSnapshot.data() as StatusDoc;
      if (statusDoc.status !== "proposed") {
        return { kind: "already_answered" as const };
      }

      let reservationId = statusDoc.reservationId;
      if (!reservationId) {
        const fallbackQuery = await transaction.get(
          db.collection("reservations").where("code", "==", code).limit(1),
        );
        reservationId = fallbackQuery.empty
          ? undefined
          : fallbackQuery.docs[0].id;
      }
      if (!reservationId) return { kind: "not_found" as const };

      const accepted = decision === "accept";
      const update = {
        status: accepted ? "confirmed" : "rejected",
        date: accepted ? statusDoc.proposedDate || statusDoc.date : statusDoc.date,
        time: accepted ? statusDoc.proposedTime || statusDoc.time : statusDoc.time,
        updatedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      };

      transaction.update(statusRef, { ...update, reservationId });
      transaction.update(db.collection("reservations").doc(reservationId), update);

      return { kind: "updated" as const, statusDoc, update };
    });

    if (outcome.kind === "not_found") return notFoundPage(locale);
    if (outcome.kind === "already_answered") return alreadyAnsweredPage(locale);

    const { statusDoc, update } = outcome;

    try {
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
      });
    } catch (error) {
      console.error("Errore invio email proprietario esito proposta", error);
    }

    const t = getReservationTranslator(locale);
    if (decision === "accept") {
      return messagePage(
        locale,
        t("page.proposal.acceptedTitle"),
        t("page.proposal.acceptedText", {
          when: formatWhen(update.date, update.time, locale),
        }),
      );
    }

    return messagePage(
      locale,
      t("page.proposal.rejectedTitle"),
      t("page.proposal.rejectedText"),
    );
  } catch (error) {
    console.error(
      "Errore POST /api/reservations/[code]/proposal-response",
      error,
    );
    return errorPage(locale);
  }
}
