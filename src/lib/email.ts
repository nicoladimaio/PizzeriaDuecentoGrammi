import { Resend } from "resend";
import type { AppLocale } from "@/i18n/routing";
import {
  PIZZERIA_PHONE,
  formatWhen,
  getReservationTranslator,
} from "@/lib/reservation-i18n";
import { ADMIN_RESERVATIONS_URL, LOGO_URL } from "@/lib/seo";

// Email al cliente: nella lingua in cui ha prenotato (messages/*.json,
// namespace "Reservation"). Email al proprietario: sempre in italiano.

type NewReservationOwnerEmailParams = {
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
};

type NewReservationCustomerRecapEmailParams = {
  toEmail: string;
  customerName: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
  locale: AppLocale;
  cancelUrl: string;
};

type CustomerDecisionEmailParams = {
  toEmail: string;
  customerName: string;
  action: "confirmed" | "rejected" | "proposed" | "cancelled";
  date: string;
  time: string;
  guests?: number;
  proposedDate?: string;
  proposedTime?: string;
  ownerResponse?: string;
  proposalAcceptUrl?: string;
  proposalRejectUrl?: string;
  /** Solo per le prenotazioni confermate. */
  cancelUrl?: string;
  locale: AppLocale;
};

type CustomerReminderEmailParams = {
  toEmail: string;
  customerName: string;
  date: string;
  time: string;
  guests: number;
  locale: AppLocale;
  cancelUrl: string;
};

type OwnerProposalOutcomeEmailParams = {
  code: string;
  customerName: string;
  phone?: string;
  email?: string;
  decision: "accept" | "reject";
  date: string;
  time: string;
  proposedDate?: string;
  proposedTime?: string;
};

type OwnerCustomerCancelledEmailParams = {
  code: string;
  customerName: string;
  phone?: string;
  email?: string;
  date: string;
  time: string;
  guests: number;
};

// Messaggi che il pannello inseriva in automatico quando il proprietario non
// scriveva nulla: non sono una nota vera, quindi non si mostrano al cliente
// (che riceve già il testo standard, tradotto nella sua lingua).
const LEGACY_DEFAULT_NOTES = new Set([
  "Non riusciamo a garantirti il posto prenotato per l'orario richiesto. Ti invitiamo a riprovare con una nuova richiesta.",
  "La tua prenotazione confermata e stata annullata. Se vuoi, contattaci per concordare una nuova disponibilita.",
  "Ti proponiamo un orario alternativo disponibile: se per te va bene, confermalo dal pulsante in email.",
]);

let cachedResend: Resend | null = null;

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile ambiente mancante: ${name}`);
  }
  return value;
};

const getResendClient = (): Resend => {
  if (cachedResend) return cachedResend;

  cachedResend = new Resend(requireEnv("RESEND_API_KEY"));
  return cachedResend;
};

const getOwnerEmail = () =>
  process.env.OWNER_EMAIL || "prenotazioni@pizzeriaduecentogrammi.it";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

// --- Mattoni HTML comuni -----------------------------------------------------

const wrapEmailLayout = (
  title: string,
  body: string,
  lang: AppLocale = "it",
): string => `
  <div lang="${lang}" style="margin:0;padding:20px;background:#f2f6f8;font-family:Arial,sans-serif;color:#20323c;">
    <table style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #d9e5ea;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;background:linear-gradient(140deg,#2f4f60,#203947);color:#eef7fa;text-align:center;">
          <img src="${escapeHtml(LOGO_URL)}" alt="Duecento Grammi" style="display:block;width:110px;max-width:100%;height:auto;margin:0 auto 10px;" />
          <h1 style="margin:0;font-size:20px;line-height:1.2;">${escapeHtml(title)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">${body}</td>
      </tr>
    </table>
  </div>
`;

const paragraphHtml = (text: string) =>
  `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;">${text}</p>`;

/** Tabella etichetta/valore. I valori vanno passati già escapati. */
const detailsTableHtml = (rows: Array<[string, string]>) => `
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${rows
      .map(
        ([label, value], index) =>
          `<tr><td style="padding:8px 0;font-weight:700;vertical-align:top;${index === 0 ? "width:38%;" : ""}">${escapeHtml(label)}</td><td style="padding:8px 0;">${value}</td></tr>`,
      )
      .join("")}
  </table>
`;

const buttonHtml = (href: string, label: string, background: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 14px;border-radius:8px;background:${background};color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(label)}</a>`;

const dashboardButtonHtml = () => `
  <p style="margin:16px 0 0;">
    ${buttonHtml(ADMIN_RESERVATIONS_URL, "Apri dashboard prenotazioni", "#234452")}
  </p>
`;

// --- Email al cliente ---------------------------------------------------------

type CustomerEmailContent = {
  locale: AppLocale;
  customerName: string;
  title: string;
  intro: string;
  rows: Array<[string, string]>;
  /** Pulsanti principali (es. accetta/rifiuta proposta). */
  buttons?: Array<{ href: string; label: string; color: string }>;
  cancelUrl?: string;
};

const buildCustomerEmail = ({
  locale,
  customerName,
  title,
  intro,
  rows,
  buttons = [],
  cancelUrl,
}: CustomerEmailContent) => {
  const t = getReservationTranslator(locale);
  const greeting = t("email.greeting", { name: customerName });
  const contact = t("contact", { phone: PIZZERIA_PHONE });

  const html = wrapEmailLayout(
    title,
    `
    ${paragraphHtml(`${escapeHtml(greeting)}<br />${escapeHtml(intro)}`)}
    ${detailsTableHtml(rows.map(([label, value]) => [label, escapeHtml(value)]))}
    ${
      buttons.length > 0
        ? `<p style="margin:16px 0 0;">${buttons
            .map((button) => buttonHtml(button.href, button.label, button.color))
            .join("")}</p>`
        : ""
    }
    ${
      cancelUrl
        ? `<p style="margin:20px 0 8px;font-size:13px;line-height:1.55;color:#4a5d68;">${escapeHtml(t("email.cancelIntro"))}</p>
    <p style="margin:0;">${buttonHtml(cancelUrl, t("email.cancelButton"), "#6b7c85")}</p>`
        : ""
    }
    <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#4a5d68;">${escapeHtml(contact)}</p>
  `,
    locale,
  );

  const text = [
    greeting,
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...(buttons.length > 0
      ? ["", ...buttons.map((button) => `${button.label}: ${button.href}`)]
      : []),
    ...(cancelUrl
      ? ["", t("email.cancelIntro"), `${t("email.cancelButton")}: ${cancelUrl}`]
      : []),
    "",
    contact,
  ].join("\n");

  return { html, text };
};

const guestsAndNotesRows = (
  locale: AppLocale,
  guests: number | undefined,
  notes: string | undefined,
): Array<[string, string]> => {
  const t = getReservationTranslator(locale);
  return [
    ...(typeof guests === "number"
      ? [[t("email.guestsLabel"), String(guests)] as [string, string]]
      : []),
    ...(notes?.trim()
      ? [[t("email.notesLabel"), notes.trim()] as [string, string]]
      : []),
  ];
};

// --- Email al proprietario ------------------------------------------------------

const buildOwnerEmail = (
  title: string,
  intro: string,
  rows: Array<[string, string]>,
) => ({
  html: wrapEmailLayout(
    title,
    `
    ${paragraphHtml(escapeHtml(intro))}
    ${detailsTableHtml(rows.map(([label, value]) => [label, escapeHtml(value)]))}
    ${dashboardButtonHtml()}
  `,
  ),
  text: [
    title,
    intro,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    `Dashboard: ${ADMIN_RESERVATIONS_URL}`,
  ].join("\n"),
});

// --- Invio ------------------------------------------------------------------------

const sendWithResend = async ({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> => {
  const resend = getResendClient();
  const from = requireEnv("RESEND_FROM_EMAIL");

  const result = await resend.emails.send({
    from,
    to: [to],
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message || "Invio email Resend non riuscito.");
  }
};

export const sendOwnerNewReservationEmail = async (
  params: NewReservationOwnerEmailParams,
): Promise<void> => {
  const { html, text } = buildOwnerEmail(
    "Nuova prenotazione",
    "Hai ricevuto una nuova richiesta di prenotazione.",
    [
      ["Nome cliente", params.customerName],
      ["Telefono", params.phone || "-"],
      ["Data e ora", formatWhen(params.date, params.time, "it")],
      ["Numero persone", String(params.guests)],
      ["Note", params.notes || "-"],
    ],
  );

  await sendWithResend({
    to: getOwnerEmail(),
    subject: "Nuova prenotazione - Duecento Grammi",
    text,
    html,
  });
};

export const sendCustomerReservationRecapEmail = async (
  params: NewReservationCustomerRecapEmailParams,
): Promise<void> => {
  const t = getReservationTranslator(params.locale);
  const { html, text } = buildCustomerEmail({
    locale: params.locale,
    customerName: params.customerName,
    title: t("email.recap.title"),
    intro: t("email.recap.intro"),
    rows: [
      [
        t("email.requestedLabel"),
        formatWhen(params.date, params.time, params.locale),
      ],
      ...guestsAndNotesRows(params.locale, params.guests, params.notes),
    ],
    cancelUrl: params.cancelUrl,
  });

  await sendWithResend({
    to: params.toEmail,
    subject: t("email.recap.subject"),
    text,
    html,
  });
};

export const sendCustomerDecisionEmail = async (
  params: CustomerDecisionEmailParams,
): Promise<void> => {
  const t = getReservationTranslator(params.locale);
  const key = params.action;
  const isProposal = params.action === "proposed";

  const ownerNote = params.ownerResponse?.trim() ?? "";
  const showOwnerNote = ownerNote !== "" && !LEGACY_DEFAULT_NOTES.has(ownerNote);

  const rows: Array<[string, string]> = isProposal
    ? [
        [
          t("email.proposedLabel"),
          formatWhen(
            params.proposedDate || params.date,
            params.proposedTime || params.time,
            params.locale,
          ),
        ],
        [
          t("email.requestedLabel"),
          formatWhen(params.date, params.time, params.locale),
        ],
      ]
    : [[t("email.whenLabel"), formatWhen(params.date, params.time, params.locale)]];

  if (params.action === "confirmed") {
    rows.push(...guestsAndNotesRows(params.locale, params.guests, undefined));
  }
  if (showOwnerNote) {
    rows.push([t("email.ownerNoteLabel"), ownerNote]);
  }

  const buttons =
    isProposal && params.proposalAcceptUrl && params.proposalRejectUrl
      ? [
          {
            href: params.proposalAcceptUrl,
            label: t("email.proposed.acceptButton"),
            color: "#166534",
          },
          {
            href: params.proposalRejectUrl,
            label: t("email.proposed.rejectButton"),
            color: "#b42318",
          },
        ]
      : [];

  const { html, text } = buildCustomerEmail({
    locale: params.locale,
    customerName: params.customerName,
    title: t(`email.${key}.title`),
    intro: t(`email.${key}.intro`),
    rows,
    buttons,
    cancelUrl: params.action === "confirmed" ? params.cancelUrl : undefined,
  });

  await sendWithResend({
    to: params.toEmail,
    subject: t(`email.${key}.subject`),
    text,
    html,
  });
};

export const sendCustomerReminderEmail = async (
  params: CustomerReminderEmailParams,
): Promise<void> => {
  const t = getReservationTranslator(params.locale);
  const { html, text } = buildCustomerEmail({
    locale: params.locale,
    customerName: params.customerName,
    title: t("email.reminder.title"),
    intro: t("email.reminder.intro"),
    rows: [
      [
        t("email.whenLabel"),
        formatWhen(params.date, params.time, params.locale),
      ],
      ...guestsAndNotesRows(params.locale, params.guests, undefined),
    ],
    cancelUrl: params.cancelUrl,
  });

  await sendWithResend({
    to: params.toEmail,
    subject: t("email.reminder.subject"),
    text,
    html,
  });
};

export const sendOwnerProposalOutcomeEmail = async (
  params: OwnerProposalOutcomeEmailParams,
): Promise<void> => {
  const accepted = params.decision === "accept";
  const finalDate = accepted ? params.proposedDate || params.date : params.date;
  const finalTime = accepted ? params.proposedTime || params.time : params.time;

  const { html, text } = buildOwnerEmail(
    accepted ? "Proposta accettata" : "Proposta rifiutata",
    accepted
      ? "Il cliente ha accettato il nuovo orario proposto: la prenotazione è confermata."
      : "Il cliente ha rifiutato il nuovo orario proposto: la prenotazione non è confermata.",
    [
      ["Codice", params.code],
      ["Cliente", params.customerName],
      ["Telefono", params.phone || "-"],
      ["Email", params.email || "-"],
      [
        accepted ? "Data e ora" : "Data e ora richieste",
        formatWhen(finalDate, finalTime, "it"),
      ],
    ],
  );

  await sendWithResend({
    to: getOwnerEmail(),
    subject: `Esito proposta ${accepted ? "accettata" : "rifiutata"} - ${params.code}`,
    text,
    html,
  });
};

export const sendOwnerCustomerCancelledEmail = async (
  params: OwnerCustomerCancelledEmailParams,
): Promise<void> => {
  const { html, text } = buildOwnerEmail(
    "Prenotazione annullata dal cliente",
    "Il cliente ha annullato la prenotazione dal link nell'email: il tavolo è di nuovo libero.",
    [
      ["Codice", params.code],
      ["Cliente", params.customerName],
      ["Telefono", params.phone || "-"],
      ["Email", params.email || "-"],
      ["Data e ora", formatWhen(params.date, params.time, "it")],
      ["Numero persone", String(params.guests)],
    ],
  );

  await sendWithResend({
    to: getOwnerEmail(),
    subject: `Prenotazione annullata dal cliente - ${params.code}`,
    text,
    html,
  });
};
