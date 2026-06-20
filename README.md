# Duecento Grammi - Next.js Edition

Migrazione completa del sito su stack moderno con Next.js, TypeScript e Firebase.

## Funzionalita implementate

- Landing page professionale e responsive.
- Menu dinamico basato su [public/assets/menu.json](public/assets/menu.json).
- Login amministratore su route nascosta: `/riservato/accesso-200g`.
- Dashboard prenotazioni su `/riservato/dashboard` con conferma/rifiuto.
- Prenotazione tavoli pubblica con codice pratica.
- Verifica stato prenotazione lato cliente tramite codice.
- Regole Firestore di base in [firestore.rules](firestore.rules).

## Avvio locale

1. Copia il file `.env.example` in `.env.local`.
2. Inserisci le variabili Firebase reali.
3. Inserisci gli admin in `NEXT_PUBLIC_ADMIN_EMAILS` (email separate da virgola).
4. Configura SMTP Aruba per notifiche prenotazioni.
5. Installa dipendenze:

```bash
npm install
```

5. Avvia:

```bash
npm run dev
```

6. Apri `http://localhost:3000`.

## Configurazione email prenotazioni (SMTP Aruba)

Nel file `.env.local` inserisci esattamente:

```bash
SMTP_HOST=smtps.aruba.it
SMTP_PORT=465
SMTP_USER=prenotazioni@pizzeriaduecentogrammi.it
SMTP_PASSWORD=LA_PASSWORD_REALE_DELLA_CASELLA_PRENOTAZIONI
OWNER_EMAIL=prenotazioni@pizzeriaduecentogrammi.it
```

Le prenotazioni vengono salvate anche se l'email fallisce; l'errore viene scritto nei log server.

## Configurazione variabili ambiente Firebase (produzione)

Se distribuisci su Firebase Functions, imposta i secret SMTP con CLI:

```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASSWORD
firebase functions:secrets:set OWNER_EMAIL
```

Valori da inserire:

- `SMTP_HOST`: `smtps.aruba.it`
- `SMTP_PORT`: `465`
- `SMTP_USER`: `prenotazioni@pizzeriaduecentogrammi.it`
- `SMTP_PASSWORD`: password reale della casella `prenotazioni@pizzeriaduecentogrammi.it`
- `OWNER_EMAIL`: `prenotazioni@pizzeriaduecentogrammi.it`

## Deploy

- Frontend: Vercel.
- Backend/data: Firebase (Auth + Firestore).

## Note sicurezza

- Aggiorna la whitelist admin in [firestore.rules](firestore.rules) sostituendo `admin@example.com`.
- Verifica e pubblica le regole Firestore con Firebase CLI.
- Imposta `RESERVATION_ACTION_SECRET` in produzione per firmare i link di conferma/rifiuto proposta.
- Non indicizzare le route admin (gia configurato via metadata robots).

## Ottimizzazione immagini menu

- Nuovi upload da admin: conversione automatica in WebP + thumbnail.
- CDN immagini opzionale: imposta `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` in `.env.local` per servire card, dettaglio menu e piatti in evidenza tramite Cloudinary fetch CDN.
- Migrazione immagini gia presenti:

```bash
npm run images:migrate:webp:dry
npm run images:migrate:webp
```

- Opzioni utili:
  - `--limit=20` per processare solo i primi 20 documenti.
  - `--force` per riconvertire anche record gia in webp.
