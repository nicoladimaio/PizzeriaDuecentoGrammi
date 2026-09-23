"use client";

import { useEffect } from "react";

/**
 * Il layout radice e condiviso con le pagine solo in italiano e scrive
 * sempre <html lang="it">: sulle pagine tradotte aggiorniamo l'attributo
 * per screen reader e traduttori del browser.
 */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale]);

  return null;
}
