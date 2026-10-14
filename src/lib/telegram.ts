import { formatWhen } from "@/lib/reservation-i18n";
import { ADMIN_RESERVATIONS_URL } from "@/lib/seo";

// Notifica Telegram al titolare per ogni nuova prenotazione dal sito, oltre
// all'email. Usa un bot creato con @BotFather che scrive nel gruppo privato
// del locale. Senza TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID non fa nulla.

type NewReservationTelegramParams = {
  customerName: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  notes?: string;
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** true se il messaggio è partito, false se Telegram non è configurato. */
export const sendOwnerNewReservationTelegram = async (
  params: NewReservationTelegramParams,
): Promise<boolean> => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  const lines = [
    "🍕 <b>Nuova prenotazione</b>",
    "",
    `👤 ${escapeHtml(params.customerName)}`,
    `📅 ${escapeHtml(formatWhen(params.date, params.time, "it"))}`,
    `👥 ${params.guests} ${params.guests === 1 ? "persona" : "persone"}`,
    `📞 ${escapeHtml(params.phone || "-")}`,
    ...(params.notes?.trim() ? [`📝 ${escapeHtml(params.notes.trim())}`] : []),
    "",
    `<a href="${escapeHtml(ADMIN_RESERVATIONS_URL)}">Apri le prenotazioni</a>`,
  ];

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      // La risposta al cliente non deve aspettare Telegram oltre questo tempo.
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!response.ok) {
    // Il testo dell'errore non contiene il token (è solo nell'URL).
    throw new Error(
      `Telegram ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  return true;
};
