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
4. Installa dipendenze:

```bash
npm install
```

5. Avvia:

```bash
npm run dev
```

6. Apri `http://localhost:3000`.

## Deploy

- Frontend: Vercel.
- Backend/data: Firebase (Auth + Firestore).

## Note sicurezza

- Aggiorna la whitelist admin in [firestore.rules](firestore.rules) sostituendo `admin@example.com`.
- Verifica e pubblica le regole Firestore con Firebase CLI.
- Non indicizzare le route admin (gia configurato via metadata robots).
