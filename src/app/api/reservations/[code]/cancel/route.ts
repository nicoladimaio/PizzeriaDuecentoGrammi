import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sendOwnerCustomerCancelledEmail } from "@/lib/email";
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
} from "@/lib/reservation-action-page";
import { formatWhen, getReservationTranslator } from "@/lib/reservation-i18n";
import { getRomeNow } from "@/lib/rome-time";
import type { AppLocale } from "@/i18n/routing";

// Annullamento da parte del cliente, dal link "Annulla prenotazione" nelle
// email: il link (GET) mostra la pagina di conferma, il click (POST) annulla.

type StatusDoc = {
  reservationId?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  date: string;
  time: string;
  guests?: number;
  status: string;
};

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed", "proposed"]);

const isCancellable = (statusDoc: StatusDoc) =>
  CANCELLABLE_STATUSES.has(statusDoc.status) &&
  statusDoc.date >= getRomeNow().dateKey;

const notPossiblePage = (locale: AppLocale) => {
  const t = getReservationTranslator(locale);
  return messagePage(
    locale,
    t("page.cancel.notPossibleTitle"),
    t("page.cancel.notPossibleText"),
    false,
  );
};

const readToken = (value: unknown) => (typeof value === "string" ? value : "");

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const locale = getPageLocale(request);
  try {
    const { code } = await context.params;
    const token = readToken(new URL(request.url).searchParams.get("token"));

    if (!token || !verifyReservationActionToken({ code, decision: "cancel", token })) {
      return invalidLinkPage(locale);
    }

    const statusSnapshot = await getAdminDb()
      .collection("reservation_status")
      .doc(code)
      .get();
    if (!statusSnapshot.exists) return notFoundPage(locale);

    const statusDoc = statusSnapshot.data() as StatusDoc;
    if (!isCancellable(statusDoc)) return notPossiblePage(locale);

    const t = getReservationTranslator(locale);
    return htmlPage(
      locale,
      t("page.cancel.question"),
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${escapeHtml(
        t("page.cancel.details", { guests: statusDoc.guests ?? 1 }),
      )} <strong>${escapeHtml(formatWhen(statusDoc.date, statusDoc.time, locale))}</strong></p>
      ${confirmForm({ token }, t("page.cancel.button"), "#b42318")}`,
    );
  } catch (error) {
    console.error("Errore GET /api/reservations/[code]/cancel", error);
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
    const token = readToken((await request.formData()).get("token"));

    if (!token || !verifyReservationActionToken({ code, decision: "cancel", token })) {
      return invalidLinkPage(locale);
    }

    const db = getAdminDb();
    const statusRef = db.collection("reservation_status").doc(code);

    const outcome = await db.runTransaction(async (transaction) => {
      const statusSnapshot = await transaction.get(statusRef);
      if (!statusSnapshot.exists) return { kind: "not_found" as const };

      const statusDoc = statusSnapshot.data() as StatusDoc;
      if (!isCancellable(statusDoc)) return { kind: "not_possible" as const };

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

      const nowIso = new Date().toISOString();
      const update = {
        status: "cancelled",
        cancelledAt: nowIso,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      };

      transaction.update(statusRef, { ...update, reservationId });
      transaction.update(db.collection("reservations").doc(reservationId), update);

      return { kind: "cancelled" as const, statusDoc };
    });

    if (outcome.kind === "not_found") return notFoundPage(locale);
    if (outcome.kind === "not_possible") return notPossiblePage(locale);

    const { statusDoc } = outcome;
    try {
      await sendOwnerCustomerCancelledEmail({
        code,
        customerName: statusDoc.customerName || "Cliente",
        phone: statusDoc.phone,
        email: statusDoc.email,
        date: statusDoc.date,
        time: statusDoc.time,
        guests: statusDoc.guests ?? 0,
      });
    } catch (error) {
      console.error("Errore invio email proprietario annullamento", error);
    }

    const t = getReservationTranslator(locale);
    return messagePage(
      locale,
      t("page.cancel.doneTitle"),
      t("page.cancel.doneText"),
    );
  } catch (error) {
    console.error("Errore POST /api/reservations/[code]/cancel", error);
    return errorPage(locale);
  }
}
