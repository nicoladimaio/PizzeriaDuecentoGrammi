"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

type TurnstileWidgetProps = {
  onToken: (token: string | null) => void;
  language?: string;
};

/**
 * Casella "Non sono un robot" di Cloudflare Turnstile.
 * Se NEXT_PUBLIC_TURNSTILE_SITE_KEY non e configurata non mostra nulla.
 */
export function TurnstileWidget({ onToken, language }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const container = containerRef.current;
    if (!TURNSTILE_SITE_KEY || !scriptReady || !container || !window.turnstile) {
      return;
    }

    const widgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      language: language ?? "auto",
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => onTokenRef.current(null),
    });

    return () => {
      window.turnstile?.remove(widgetId);
    };
  }, [scriptReady, language]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="booking-turnstile" />
    </>
  );
}
