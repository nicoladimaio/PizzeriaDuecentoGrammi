// Funzione pianificata di Netlify: ogni giorno chiede al sito di inviare la
// richiesta di recensione su Google alle prenotazioni confermate di ieri
// (src/app/api/cron/review-requests/route.ts).
// Orario in UTC: 10:00 UTC = 12:00 in Italia con l'ora legale, 11:00 con l'ora solare.
// Se CRON_SECRET non è impostata su Netlify non fa nulla.

const sendReviewRequests = async () => {
  const secret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (!secret || !siteUrl) {
    console.log("Richieste di recensione disattivate: manca CRON_SECRET o URL.");
    return;
  }

  const response = await fetch(`${siteUrl}/api/cron/review-requests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log(
    `Richieste di recensione: ${response.status} ${await response.text()}`,
  );
};

export default sendReviewRequests;

export const config = {
  schedule: "0 10 * * *",
};
