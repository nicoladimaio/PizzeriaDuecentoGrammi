import crypto from "crypto";
import { NextResponse } from "next/server";

// Controllo comune delle API chiamate dalle funzioni pianificate di Netlify
// (netlify/functions/*.mts): devono mandare "Authorization: Bearer CRON_SECRET".
// Senza CRON_SECRET le API pianificate restano spente.

const isAuthorized = (request: Request, secret: string) => {
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    header.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  );
};

/** Risposta di errore se la richiesta non è autorizzata, altrimenti null. */
export const rejectUnauthorizedCron = (
  request: Request,
  disabledMessage: string,
): NextResponse | null => {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: disabledMessage }, { status: 503 });
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }
  return null;
};
