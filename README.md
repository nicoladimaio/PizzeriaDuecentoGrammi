# Duecento Grammi

Sito della pizzeria Duecento Grammi (Marcianise) con menu digitale, prenotazioni online e area riservata per gestire menu e prenotazioni.

Stack: Next.js 16 (App Router), React 19, TypeScript, Firebase (Auth, Firestore, Storage), Resend per le email, next-intl per le traduzioni. Deploy su Netlify (`netlify.toml`).

## Funzionalità

- **Home** con video e piatti in evidenza.
- **Menu** (`/menu`; `/en/menu`, `/es/menu`, `/de/menu`): preparato sul server da Firestore e tenuto in cache ([src/lib/public-menu.ts](src/lib/public-menu.ts)), con ricerca, filtro allergeni e piccantezza e dati strutturati schema.org per Google. Si aggiorna subito a ogni salvataggio dal pannello admin e comunque ogni 10 minuti; lo stesso vale per i piatti in evidenza della home.
- **Prenotazioni** (`/prenotazioni` e le versioni `/en`, `/es`, `/de`): wizard in 3 passaggi con disponibilità reale per giorno e orario, protezione anti-spam (Cloudflare Turnstile + campo trappola). Il cliente riceve le email nella lingua in cui ha prenotato: riepilogo, esito (conferma, rifiuto o proposta di un altro orario, accettabile via link firmato) e, se attivo, un promemoria la mattina del giorno prenotato. Dalle email può annullare la prenotazione (link firmato, con pagina di conferma): in area riservata risulta "Annullata dal cliente" e il posto torna libero.
- **Area riservata** (`/riservato/accesso-200g` → `/riservato/dashboard`): gestione prenotazioni, impostazioni del servizio (orari, capienza, giorni di chiusura), gestione menu (piatti, categorie, ingredienti, foto) e traduzioni del menu.

## Avvio locale

```bash
cp .env.example .env.local   # poi compila le variabili (vedi sotto)
npm install
npm run dev                  # http://localhost:3000
```

> Attenzione: se `.env.local` punta al progetto Firebase e al Resend di produzione, le prenotazioni di prova finiscono nel database vero e partono email vere.

## Variabili d'ambiente

Tutte elencate con commenti in [.env.example](.env.example). In sintesi:

| Gruppo | Variabili | Note |
|---|---|---|
| Firebase client | `NEXT_PUBLIC_FIREBASE_*` | Pubbliche per natura. |
| Firebase Admin | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Service account, usato dalle API. |
| Admin | `NEXT_PUBLIC_ADMIN_EMAILS` | Deve coincidere con la lista in `firestore.rules` e `storage.rules`. |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OWNER_EMAIL` | |
| Link email | `RESERVATION_ACTION_SECRET` | Firma HMAC dei link nelle email (accetta/rifiuta proposta, annulla prenotazione). Obbligatoria in produzione. |
| Promemoria | `CRON_SECRET` | Attiva l'email di promemoria del giorno, inviata ogni mattina da [netlify/functions/reservation-reminders.mts](netlify/functions/reservation-reminders.mts). Se vuota i promemoria sono spenti. |
| Anti-spam | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Da [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) (gratuito). Se vuote la protezione è disattivata. |
| Traduzioni | `ANTHROPIC_API_KEY` | Serve solo al pulsante "Traduci automaticamente" in area riservata. |

## Traduzioni (next-intl)

- Lingue in [src/i18n/routing.ts](src/i18n/routing.ts): italiano senza prefisso (URL di sempre), inglese, spagnolo e tedesco con prefisso (`/en`, `/es`, `/de`). La lingua si cambia dal globo nella barra del menu o dalle sigle in cima al modulo di prenotazione ([language-switcher.tsx](src/components/language-switcher.tsx)); niente rilevamento automatico dal browser.
- Sono tradotte solo le pagine elencate in `LOCALIZED_PATHS` (menu e prenotazioni), che stanno sotto `src/app/[locale]/`. Home, privacy e area riservata restano solo in italiano.
- **Testi dell'interfaccia**: `messages/<lingua>.json` (stesse chiavi in tutti i file).
- **Contenuti del menu** (nomi, descrizioni, ingredienti, categorie): campo `i18n.<lingua>` sui documenti Firestore. Se l'italiano di un piatto cambia, la versione tradotta mostra l'italiano finché non viene ritradotto (per non mostrare ingredienti sbagliati). Dettagli in [src/lib/menu-translations.ts](src/lib/menu-translations.ts).
- **Tradurre piatti nuovi o modificati** (senza servizi a pagamento):
  ```bash
  npm run menu:i18n:export            # scrive menu-i18n-todo.json con ciò che manca, per lingua
  # tradurre il file (un JSON per lingua: { "items": { id: {nome, descrizione, ingredienti} }, "cats": { id: nome } })
  npm run menu:i18n:import -- es traduzioni-es.json --dry   # controlla senza scrivere
  npm run menu:i18n:import -- es traduzioni-es.json         # scrive su Firestore (produzione)
  # il sito mostra le nuove traduzioni entro 10 minuti (cache del menu pubblico)
  ```
  L'import rifiuta il file se un campo vuoto in italiano non lo è nella traduzione (o viceversa) o se il numero di ingredienti non coincide.
- In alternativa, area riservata → Menu → Traduzioni: modifica manuale voce per voce, e il pulsante "Traduci automaticamente" (richiede `ANTHROPIC_API_KEY`, servizio a pagamento).
- Per aggiungere una lingua: aggiungila a `routing.locales`, crea `messages/<lingua>.json`, aggiungila a `CONTENT_LOCALES`, al matcher in [src/proxy.ts](src/proxy.ts), all'enum `locale` in `api/reservations/route.ts`, a `LANGUAGES` in `language-switcher.tsx` e alle etichette in `site-header.tsx`.

## Struttura

```
src/
  app/
    [locale]/menu, [locale]/prenotazioni   pagine tradotte
    api/reservations/...                   API pubbliche (disponibilità, nuova prenotazione, risposta a proposta)
    api/admin/...                          API admin (token Firebase + whitelist, vedi lib/admin-auth.ts)
    riservato/...                          area riservata
  components/
    admin-menu/, admin-reservations/       tipi e funzioni di supporto dei pannelli admin
  hooks/                                   hook client (menu live, etichette tradotte)
  i18n/                                    configurazione next-intl
  lib/                                     logica condivisa (Firebase, email, date in ora italiana, traduzioni)
messages/                                  testi dell'interfaccia per lingua
```

Note:
- Tutte le date di calendario lato server usano l'ora italiana ([src/lib/rome-time.ts](src/lib/rome-time.ts)): il server di hosting gira in UTC.
- Le foto del menu possono essere servite solo da Firebase Storage e Cloudinary (`images.remotePatterns` in `next.config.ts`).

## Regole Firebase

Le regole di sicurezza sono in [firestore.rules](firestore.rules) e [storage.rules](storage.rules). Dopo ogni modifica vanno pubblicate:

```bash
firebase deploy --only firestore:rules,storage
```

## Deploy (Netlify)

Imposta le stesse variabili di `.env.example` nelle impostazioni del sito Netlify. Build: `npm run build`.
