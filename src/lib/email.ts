import { Resend } from "resend";

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

type NewReservationCustomerRecapEmailParams = {
  toEmail: string;
  customerName: string;
  date: string;
  time: string;
  guests: number;
  diningArea: "inside" | "outside";
  notes?: string;
  logoUrl?: string;
};

type CustomerDecisionEmailParams = {
  toEmail: string;
  customerName: string;
  action: "confirmed" | "rejected" | "proposed" | "cancelled";
  date: string;
  time: string;
  proposedDate?: string;
  proposedTime?: string;
  ownerResponse?: string;
  proposalAcceptUrl?: string;
  proposalRejectUrl?: string;
  logoUrl?: string;
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
  dashboardLink: string;
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
  if (logoUrl) {
    return {
      logoSrc: logoUrl,
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "https://pizzeriaduecentogrammi.it";

  return {
    logoSrc: `${siteUrl.replace(/\/+$/, "")}/assets/Centro.png`,
  };
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

const buildCustomerReservationRecapHtml = (
  params: NewReservationCustomerRecapEmailParams,
): string => {
  const areaLabel = params.diningArea === "outside" ? "Esterno" : "Interno";
  return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
      Ciao ${escapeHtml(params.customerName)}, abbiamo ricevuto la tua richiesta.
      Ti aggiorneremo appena la prenotazione sara gestita dal nostro staff.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;font-weight:700;width:38%;">Data e ora richieste</td><td style="padding:8px 0;">${escapeHtml(params.date)} alle ${escapeHtml(params.time)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;">Numero persone</td><td style="padding:8px 0;">${params.guests}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;">Sala</td><td style="padding:8px 0;">${areaLabel}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;vertical-align:top;">Note</td><td style="padding:8px 0;">${escapeHtml(params.notes || "-")}</td></tr>
    </table>
  `;
};

const buildCustomerDecisionHtml = (
  params: CustomerDecisionEmailParams,
): string => {
  const actionLabel =
    params.action === "confirmed"
      ? "Prenotazione confermata"
      : params.action === "cancelled"
        ? "Prenotazione annullata"
        : params.action === "rejected"
          ? "Prenotazione non confermata"
          : "Proposta alternativa";

  const outcomeTone =
    params.action === "confirmed"
      ? {
          chip: "display:inline-block;padding:6px 10px;border-radius:999px;background:#dff5e7;color:#256842;font-weight:700;font-size:12px;",
          box: "border:1px solid #bfe8cd;background:#eefaf2;color:#1e5c3a;",
          text: "Ti aspettiamo volentieri. La tua prenotazione e confermata.",
        }
      : params.action === "cancelled"
        ? {
            chip: "display:inline-block;padding:6px 10px;border-radius:999px;background:#fbe4e1;color:#9a2f28;font-weight:700;font-size:12px;",
            box: "border:1px solid #f2c7c2;background:#fff2f0;color:#7d2520;",
            text: "La prenotazione confermata e stata annullata.",
          }
        : params.action === "rejected"
          ? {
              chip: "display:inline-block;padding:6px 10px;border-radius:999px;background:#fbe4e1;color:#9a2f28;font-weight:700;font-size:12px;",
              box: "border:1px solid #f2c7c2;background:#fff2f0;color:#7d2520;",
              text: "Al momento non riusciamo a confermare la richiesta indicata.",
            }
          : {
              chip: "display:inline-block;padding:6px 10px;border-radius:999px;background:#fff4d9;color:#9a6a08;font-weight:700;font-size:12px;",
              box: "border:1px solid #f2deab;background:#fff9ea;color:#7e5707;",
              text: "Abbiamo una proposta alternativa disponibile per te.",
            };

  const welcomeText =
    params.action === "confirmed"
      ? "grazie per aver scelto la nostra pizzeria."
      : params.action === "cancelled"
        ? "ci dispiace per il cambio di programma."
        : params.action === "rejected"
          ? "grazie per la tua richiesta."
          : "grazie per la tua richiesta. Se il nuovo orario va bene, puoi confermarlo qui sotto.";

  const ownerMessage =
    params.ownerResponse?.trim() ||
    (params.action === "proposed"
      ? "Ti proponiamo un orario alternativo disponibile."
      : params.action === "rejected" || params.action === "cancelled"
        ? "Non riusciamo a garantirti il posto prenotato per l'orario richiesto."
        : "La tua prenotazione e stata confermata.");

  const defaultMessageByAction =
    params.action === "proposed"
      ? "Ti proponiamo un orario alternativo disponibile."
      : params.action === "rejected" || params.action === "cancelled"
        ? "Non riusciamo a garantirti il posto prenotato per l'orario richiesto."
        : "La tua prenotazione e stata confermata.";

  const showOwnerMessage =
    Boolean(params.ownerResponse?.trim()) &&
    ownerMessage.trim() !== defaultMessageByAction;

  const whenText =
    params.action === "proposed"
      ? `${escapeHtml(params.proposedDate || "-")} alle ${escapeHtml(params.proposedTime || "-")}`
      : `${escapeHtml(params.date)} alle ${escapeHtml(params.time)}`;

  const whenLabel =
    params.action === "proposed" ? "Orario proposto" : "Data e ora";

  return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
      Ciao ${escapeHtml(params.customerName)},<br />
      ${welcomeText}
    </p>
    <p style="margin:0 0 12px;">
      <span style="${outcomeTone.chip}">${actionLabel}</span>
    </p>
    
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;font-weight:700;width:38%;">${whenLabel}</td><td style="padding:8px 0;">${whenText}</td></tr>
      ${
        showOwnerMessage
          ? `<tr><td style="padding:8px 0;font-weight:700;vertical-align:top;">Nota</td><td style="padding:8px 0;">${escapeHtml(ownerMessage)}</td></tr>`
          : ""
      }
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

const buildCustomerReservationRecapText = (
  params: NewReservationCustomerRecapEmailParams,
): string =>
  [
    `Ciao ${params.customerName},`,
    "abbiamo ricevuto la tua richiesta di prenotazione.",
    "Ti aggiorneremo appena la prenotazione sara stata gestita.",
    `Data e ora richieste: ${params.date} alle ${params.time}`,
    `Numero persone: ${params.guests}`,
    `Sala: ${params.diningArea === "outside" ? "Esterno" : "Interno"}`,
    `Note: ${params.notes || "-"}`,
  ].join("\n");

const buildCustomerDecisionText = (
  params: CustomerDecisionEmailParams,
): string => {
  const actionLabel =
    params.action === "confirmed"
      ? "Prenotazione confermata"
      : params.action === "cancelled"
        ? "Prenotazione annullata"
        : params.action === "rejected"
          ? "Prenotazione non confermata"
          : "Proposta alternativa";

  const whenText =
    params.action === "proposed"
      ? `${params.proposedDate || "-"} alle ${params.proposedTime || "-"}`
      : `${params.date} alle ${params.time}`;

  const defaultMessageByAction =
    params.action === "proposed"
      ? "Ti proponiamo un orario alternativo disponibile."
      : params.action === "cancelled"
        ? "La prenotazione confermata e stata annullata."
        : params.action === "rejected"
          ? "Non riusciamo a confermare la richiesta indicata."
          : "La tua prenotazione e confermata.";

  const ownerMessage = params.ownerResponse?.trim() || defaultMessageByAction;
  const includeNote =
    Boolean(params.ownerResponse?.trim()) &&
    ownerMessage !== defaultMessageByAction;

  return [
    `Ciao ${params.customerName},`,
    actionLabel,
    `Data e ora: ${whenText}`,
    ...(includeNote ? [`Nota: ${ownerMessage}`] : []),
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

const buildOwnerProposalOutcomeHtml = (
  params: OwnerProposalOutcomeEmailParams,
): string => {
  const accepted = params.decision === "accept";
  const outcomeLabel = accepted ? "Proposta accettata" : "Proposta rifiutata";
  const finalDate = accepted ? params.proposedDate || params.date : params.date;
  const finalTime = accepted ? params.proposedTime || params.time : params.time;

  return `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">
      Il cliente ha risposto alla proposta inviata.
    </p>
    <p style="margin:0 0 12px;">
      <span style="display:inline-block;padding:6px 10px;border-radius:999px;background:${accepted ? "#dff5e7" : "#fbe4e1"};color:${accepted ? "#256842" : "#9a2f28"};font-weight:700;font-size:12px;">${outcomeLabel}</span>
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;font-weight:700;width:38%;">Codice</td><td style="padding:8px 0;">${escapeHtml(params.code)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;">Cliente</td><td style="padding:8px 0;">${escapeHtml(params.customerName)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;">Telefono</td><td style="padding:8px 0;">${escapeHtml(params.phone || "-")}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;">Email</td><td style="padding:8px 0;">${escapeHtml(params.email || "-")}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;">Orario finale</td><td style="padding:8px 0;">${escapeHtml(finalDate)} alle ${escapeHtml(finalTime)}</td></tr>
    </table>
    <p style="margin:16px 0 0;">
      <a href="${escapeHtml(params.dashboardLink)}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#234452;color:#f1f9fb;text-decoration:none;font-weight:700;">
        Apri dashboard prenotazioni
      </a>
    </p>
  `;
};

const buildOwnerProposalOutcomeText = (
  params: OwnerProposalOutcomeEmailParams,
): string => {
  const accepted = params.decision === "accept";
  const finalDate = accepted ? params.proposedDate || params.date : params.date;
  const finalTime = accepted ? params.proposedTime || params.time : params.time;

  return [
    `Esito proposta: ${accepted ? "accettata" : "rifiutata"}`,
    `Codice: ${params.code}`,
    `Cliente: ${params.customerName}`,
    `Telefono: ${params.phone || "-"}`,
    `Email: ${params.email || "-"}`,
    `Orario finale: ${finalDate} alle ${finalTime}`,
    `Dashboard: ${params.dashboardLink}`,
  ].join("\n");
};

const decisionTitle = (
  action: CustomerDecisionEmailParams["action"],
): string => {
  if (action === "confirmed") return "Prenotazione confermata";
  if (action === "rejected") return "Prenotazione non confermata";
  if (action === "cancelled") return "Prenotazione annullata";
  return "Nuova proposta orario";
};

const buildDecisionSubject = (
  action: CustomerDecisionEmailParams["action"],
): string => {
  if (action === "confirmed")
    return "Prenotazione confermata - Duecento Grammi";
  if (action === "rejected")
    return "Prenotazione non confermata - Duecento Grammi";
  if (action === "cancelled") return "Prenotazione annullata - Duecento Grammi";
  return "Nuova proposta orario - Duecento Grammi";
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

export const sendCustomerReservationRecapEmail = async (
  params: NewReservationCustomerRecapEmailParams,
): Promise<void> => {
  const logoAsset = buildLogoAsset(params.logoUrl);

  await sendWithResend({
    to: params.toEmail,
    subject: "Richiesta prenotazione ricevuta - Duecento Grammi",
    text: buildCustomerReservationRecapText(params),
    html: wrapEmailLayout(
      "Richiesta ricevuta",
      buildCustomerReservationRecapHtml(params),
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
      decisionTitle(params.action),
      buildCustomerDecisionHtml(params),
      logoAsset.logoSrc,
    ),
  });
};

export const sendOwnerProposalOutcomeEmail = async (
  params: OwnerProposalOutcomeEmailParams,
): Promise<void> => {
  const to =
    process.env.OWNER_EMAIL || "prenotazioni@pizzeriaduecentogrammi.it";
  const logoAsset = buildLogoAsset(params.logoUrl);

  await sendWithResend({
    to,
    subject: `Esito proposta ${params.decision === "accept" ? "accettata" : "rifiutata"} - ${params.code}`,
    text: buildOwnerProposalOutcomeText(params),
    html: wrapEmailLayout(
      "Esito proposta cliente",
      buildOwnerProposalOutcomeHtml(params),
      logoAsset.logoSrc,
    ),
  });
};
