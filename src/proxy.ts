import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Solo le pagine tradotte (vedi LOCALIZED_PATHS), con o senza prefisso lingua.
  // Home, privacy, area riservata e API non passano di qui.
  matcher: [
    "/menu",
    "/prenotazioni",
    "/prenotazioni/:path*",
    "/(it|en|es|de)",
    "/(it|en|es|de)/menu",
    "/(it|en|es|de)/prenotazioni",
    "/(it|en|es|de)/prenotazioni/:path*",
  ],
};
