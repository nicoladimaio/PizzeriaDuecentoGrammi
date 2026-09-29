// Funzione pianificata di Netlify: ogni mattina chiede al sito di inviare i
// promemoria delle prenotazioni confermate del giorno
// (src/app/api/cron/reservation-reminders/route.ts).
// Orario in UTC: 8:00 UTC = 10:00 in Italia con l'ora legale, 9:00 con l'ora solare.
// Se CRON_SECRET non è impostata su Netlify non fa nulla.

const sendReservationReminders = async () => {
  const secret = process.env.CRON_SECRET;
  const siteUrl = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (!secret || !siteUrl) {
    console.log("Promemoria prenotazioni disattivati: manca CRON_SECRET o URL.");
    return;
  }

  const response = await fetch(`${siteUrl}/api/cron/reservation-reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  console.log(
    `Promemoria prenotazioni: ${response.status} ${await response.text()}`,
  );
};

export default sendReservationReminders;

export const config = {
  schedule: "0 8 * * *",
};
