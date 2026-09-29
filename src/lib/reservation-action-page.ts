import type { AppLocale } from "@/i18n/routing";
import {
  PIZZERIA_PHONE,
  getReservationTranslator,
  toAppLocale,
} from "@/lib/reservation-i18n";

// Pagine HTML minime aperte dai link nelle email (proposta di orario,
// annullamento). Il link (GET) mostra solo un pulsante: l'azione parte dal
// click (POST), così i programmi di posta e gli antivirus che aprono i link
// in automatico per controllarli non agiscono al posto del cliente.

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Lingua della pagina, dal parametro `lang` del link. */
export const getPageLocale = (request: Request): AppLocale =>
  toAppLocale(new URL(request.url).searchParams.get("lang"));

export const htmlPage = (
  locale: AppLocale,
  title: string,
  bodyHtml: string,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
) => {
  const accent = ok ? "#166534" : "#b42318";
  return new Response(
    `<!DOCTYPE html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escapeHtml(title)} - Duecento Grammi</title>
  </head>
  <body style="margin:0;font-family:Arial,sans-serif;background:#f5f7f9;color:#183240;">
    <main style="max-width:560px;margin:48px auto;padding:24px;background:#fff;border:1px solid #d9e5ea;border-radius:14px;">
      <h1 style="margin:0 0 12px;font-size:22px;color:${accent};">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </main>
  </body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
};

export const paragraph = (text: string) =>
  `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;

/** Pagina con solo un messaggio (esito o errore), più il telefono. */
export const messagePage = (
  locale: AppLocale,
  title: string,
  message: string,
  ok = true,
) => {
  const t = getReservationTranslator(locale);
  return htmlPage(
    locale,
    title,
    `${paragraph(message)}${paragraph(t("contact", { phone: PIZZERIA_PHONE }))}`,
    { ok, status: ok ? 200 : 400 },
  );
};

/** Pulsante che invia la conferma (POST allo stesso indirizzo). */
export const confirmForm = (
  fields: Record<string, string>,
  label: string,
  color: string,
) => `
  <form method="post" style="margin:20px 0 0;">
    ${Object.entries(fields)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
      )
      .join("")}
    <button type="submit" style="display:inline-block;padding:12px 18px;border:0;border-radius:8px;background:${color};color:#fff;font-size:15px;font-weight:700;cursor:pointer;">
      ${escapeHtml(label)}
    </button>
  </form>`;

export const invalidLinkPage = (locale: AppLocale) => {
  const t = getReservationTranslator(locale);
  return messagePage(
    locale,
    t("page.invalidLinkTitle"),
    t("page.invalidLinkText"),
    false,
  );
};

export const notFoundPage = (locale: AppLocale) => {
  const t = getReservationTranslator(locale);
  return messagePage(
    locale,
    t("page.notFoundTitle"),
    t("page.notFoundText"),
    false,
  );
};

export const errorPage = (locale: AppLocale) => {
  const t = getReservationTranslator(locale);
  return messagePage(locale, t("page.errorTitle"), t("page.errorText"), false);
};
