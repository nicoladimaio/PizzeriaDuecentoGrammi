import { Resend } from "resend";
import fs from "node:fs";
import path from "node:path";

type NewReservationOwnerEmailParams = {
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
  dashboardLink: string;
  logoUrl?: string;
};

type CustomerDecisionEmailParams = {
  toEmail: string;
  customerName: string;
  action: "confirmed" | "rejected" | "proposed";
  date: string;
  time: string;
  proposedDate?: string;
  proposedTime?: string;
  ownerResponse?: string;
  proposalAcceptUrl?: string;
  proposalRejectUrl?: string;
  logoUrl?: string;
};

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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const wrapEmailLayout = (
  title: string,
  body: string,
  logoSrc?: string,
): string => `
  <div style="margin:0;padding:20px;background:#f2f6f8;font-family:Arial,sans-serif;color:#20323c;">
    <table style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #d9e5ea;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;background:linear-gradient(140deg,#2f4f60,#203947);color:#eef7fa;text-align:center;">
          ${
            logoSrc
              ? `<img src="${escapeHtml(logoSrc)}" alt="Logo pizzeria" style="display:block;width:110px;max-width:100%;height:auto;margin:0 auto 10px;" />`
              : ""
          }
          <h1 style="margin:0;font-size:20px;line-height:1.2;">${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;">${body}</td>
      </tr>
    </table>
  </div>
`;

const buildLogoAsset = (
  logoUrl?: string,
): {
  logoSrc?: string;
} => {
  const localCandidates = [
    path.join(process.cwd(), "public", "assets", "Centro.png"),
    path.join(process.cwd(), "public", "assets", "logo1_hq.png"),
  ];

  const localPath = localCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );

  if (localPath) {
    const extension = path.extname(localPath).toLowerCase();
    const mimeType = extension === ".png" ? "image/png" : "image/jpeg";
    const encoded = fs.readFileSync(localPath).toString("base64");

    return {
      logoSrc: `data:${mimeType};base64,${encoded}`,
    };
  }

  if (logoUrl) {
    return {
      logoSrc: logoUrl,
    };
  }

  return {};
};

const buildOwnerReservationHtml = (
  params: NewReservationOwnerEmailParams,
): string => `
  <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
    Hai ricevuto una nuova richiesta di prenotazione.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:8px 0;font-weight:700;width:38%;">Nome cliente</td><td style="padding:8px 0;">${escapeHtml(params.customerName)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Telefono</td><td style="padding:8px 0;">${escapeHtml(params.phone)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Data</td><td style="padding:8px 0;">${escapeHtml(params.date)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Ora</td><td style="padding:8px 0;">${escapeHtml(params.time)}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;">Numero persone</td><td style="padding:8px 0;">${params.guests}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;vertical-align:top;">Note</td><td style="padding:8px 0;">${escapeHtml(params.notes || "-")}</td></tr>
  </table>
  <p style="margin:16px 0 0;">
    <a href="${escapeHtml(params.dashboardLink)}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#234452;color:#f1f9fb;text-decoration:none;font-weight:700;">
      Apri dashboard prenotazioni
    </a>
  </p>
`;

const buildCustomerDecisionHtml = (
  params: CustomerDecisionEmailParams,
): string => {
  const actionLabel =
    params.action === "confirmed"
      ? "Prenotazione confermata"
      : params.action === "rejected"
        ? "Prenotazione non confermata"
        : "Proposta alternativa";

  const outcomeTone =
    params.action === "confirmed"
      ? {
          chip: "display:inline-block;padding:6px 10px;border-radius:999px;background:#dff5e7;color:#256842;font-weight:700;font-size:12px;",
          box: "border:1px solid #bfe8cd;background:#eefaf2;color:#1e5c3a;",
          text: "Esito positivo: la tua prenotazione e stata confermata.",
        }
      : params.action === "rejected"
        ? {
            chip:
              "display:inline-block;padding:6px 10px;border-radius:999px;background:#fbe4e1;color:#9a2f28;font-weight:700;font-size:12px;",
            box: "border:1px solid #f2c7c2;background:#fff2f0;color:#7d2520;",
            text: "Esito negativo: non siamo riusciti a confermare la prenotazione richiesta.",
          }
        : {
            chip:
              "display:inline-block;padding:6px 10px;border-radius:999px;background:#fff4d9;color:#9a6a08;font-weight:700;font-size:12px;",
            box: "border:1px solid #f2deab;background:#fff9ea;color:#7e5707;",
            text: "Abbiamo una proposta alternativa disponibile per te.",
          };

  const ownerMessage =
    params.ownerResponse?.trim() ||
    (params.action === "proposed"
      ? "Ti proponiamo un orario alternativo disponibile."
      : params.action === "rejected"
        ? "Non riusciamo a garantirti il posto prenotato per l'orario richiesto."
        : "La tua prenotazione e stata confermata.");

  const whenText =
    params.action === "proposed"
      ? `${escapeHtml(params.proposedDate || "-")} alle ${escapeHtml(params.proposedTime || "-")}`
      : `${escapeHtml(params.date)} alle ${escapeHtml(params.time)}`;

  return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
      Ciao ${escapeHtml(params.customerName)},<br />
      abbiamo aggiornato lo stato della tua richiesta.
    </p>
    <p style="margin:0 0 12px;">
      <span style="${outcomeTone.chip}">${actionLabel}</span>
    </p>
    <div style="margin:0 0 14px;padding:10px 12px;border-radius:10px;${outcomeTone.box}">
      <strong style="display:block;margin-bottom:4px;">Esito prenotazione</strong>
      <span style="font-size:14px;line-height:1.45;">${outcomeTone.text}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;font-weight:700;width:38%;">Data e ora</td><td style="padding:8px 0;">${whenText}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;vertical-align:top;">Messaggio</td><td style="padding:8px 0;">${escapeHtml(ownerMessage)}</td></tr>
    </table>
    ${
      params.action === "proposed" &&
      params.proposalAcceptUrl &&
      params.proposalRejectUrl
        ? `<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
      <a href="${escapeHtml(params.proposalAcceptUrl)}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#166534;color:#f3fbf5;text-decoration:none;font-weight:700;">Conferma proposta</a>
      <a href="${escapeHtml(params.proposalRejectUrl)}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#b42318;color:#fff6f5;text-decoration:none;font-weight:700;">Rifiuta proposta</a>
    </div>`
        : ""
    }
  `;
};

const buildOwnerReservationText = (
  params: NewReservationOwnerEmailParams,
): string =>
  [
    "Nuova prenotazione - Duecento Grammi",
    `Nome cliente: ${params.customerName}`,
    `Telefono: ${params.phone}`,
    `Data: ${params.date}`,
    `Ora: ${params.time}`,
    `Numero persone: ${params.guests}`,
    `Note: ${params.notes || "-"}`,
    `Dashboard: ${params.dashboardLink}`,
  ].join("\n");

const buildCustomerDecisionText = (
  params: CustomerDecisionEmailParams,
): string => {
  const actionLabel =
    params.action === "confirmed"
      ? "Prenotazione confermata"
      : params.action === "rejected"
        ? "Prenotazione non confermata"
        : "Nuova proposta orario";

  const whenText =
    params.action === "proposed"
      ? `${params.proposedDate || "-"} alle ${params.proposedTime || "-"}`
      : `${params.date} alle ${params.time}`;

  return [
    `Ciao ${params.customerName},`,
    "abbiamo aggiornato lo stato della tua richiesta.",
    actionLabel,
    `Data e ora: ${whenText}`,
    `Messaggio: ${params.ownerResponse || "-"}`,
    ...(params.action === "proposed" &&
    params.proposalAcceptUrl &&
    params.proposalRejectUrl
      ? [
          `Conferma proposta: ${params.proposalAcceptUrl}`,
          `Rifiuta proposta: ${params.proposalRejectUrl}`,
        ]
      : []),
  ].join("\n");
};

const buildDecisionSubject = (
  action: CustomerDecisionEmailParams["action"],
): string => {
  if (action === "confirmed")
    return "Prenotazione confermata - Duecento Grammi";
  if (action === "rejected") {
    return "Aggiornamento prenotazione - Duecento Grammi";
  }
  return "Nuova proposta prenotazione - Duecento Grammi";
};

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
  const to =
    process.env.OWNER_EMAIL || "prenotazioni@pizzeriaduecentogrammi.it";
  const logoAsset = buildLogoAsset(params.logoUrl);

  await sendWithResend({
    to,
    subject: "Nuova prenotazione - Duecento Grammi",
    text: buildOwnerReservationText(params),
    html: wrapEmailLayout(
      "Nuova prenotazione",
      buildOwnerReservationHtml(params),
      logoAsset.logoSrc,
    ),
  });
};

export const sendCustomerDecisionEmail = async (
  params: CustomerDecisionEmailParams,
): Promise<void> => {
  const logoAsset = buildLogoAsset(params.logoUrl);

  await sendWithResend({
    to: params.toEmail,
    subject: buildDecisionSubject(params.action),
    text: buildCustomerDecisionText(params),
    html: wrapEmailLayout(
      "Aggiornamento prenotazione",
      buildCustomerDecisionHtml(params),
      logoAsset.logoSrc,
    ),
  });
};
