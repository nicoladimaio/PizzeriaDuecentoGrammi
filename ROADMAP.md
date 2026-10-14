# Lavori da fare - Duecento Grammi

Lista delle attività aperte sul sito. Si aggiorna man mano che si chiudono i punti.

## Regole di lavoro

- Il file `.env` locale punta a Firebase e Resend di **produzione**: niente prenotazioni di prova, salvataggi dal pannello o altre scritture da localhost senza chiedere.
- Ogni push su GitHub fa partire un deploy su Netlify (piano gratuito, crediti limitati): commit locali quanti servono, **un solo push alla fine** di tutto il lavoro, dopo averlo concordato.
- Prima di pubblicare un deploy nuovo, controllare il permalink (`https://<id-deploy>--duecentogrammi.netlify.app/api/reservations/availability?guests=2`) e solo dopo pubblicarlo.
- Aggiornare le librerie una alla volta. `firebase-admin` resta alla 13: la 14 manda in crash le funzioni di Netlify.

## Da fare subito

1. **Prove sul sito vero** (le fa l'utente). Già fatte: prenotazione in inglese con email di riepilogo, conferma/altro orario/rifiuto dal pannello con relative email, modifica di un piatto e menu pubblico, anteprima su WhatsApp. Restano:
   - link "Cancel booking" nell'email;
   - salvataggio delle impostazioni prenotazioni e controllo degli orari nel footer;
   - dopo il prossimo deploy: bottoni delle categorie nel menu su Android e iPhone (corretto lo scroll che si bloccava o tornava alla prima categoria).
2. **Regole Firestore**: la modifica è già in `firestore.rules` (non committata). `menu_items`, `menu_categories` e `menu_ingredients` leggibili solo dall'admin; il sito pubblico legge il menu dal server con firebase-admin, che ignora le regole. Pubblicare con `firebase deploy --only firestore:rules` (non passa da Netlify) dopo le prove, poi controllare menu pubblico e pannello.

## Manutenzione

3. ~~Dividere i pannelli admin e correggere i 13 errori di lint~~: fatto. Dopo il deploy l'utente prova bene il pannello (menu e prenotazioni).
4. **Unificare le collezioni `reservations` e `reservation_status`**:
   - Fase A, fatta (esce col deploy del 21): le API leggono solo `reservations` (ricerca per codice, `src/lib/reservation-store.ts`); `reservation_status` resta come copia di compatibilità, riscritta dalla prenotazione nella stessa transazione, così si può tornare alla versione precedente. Confronto prima del lavoro (`scripts/check-reservation-collections.mjs`): 35/35, nessuna differenza. Provata su emulatore Firestore in tutti i passaggi. Dopo il deploy: prenotazione di prova completa sul sito vero (proposta, accetta, annulla).
   - Fase B, a un deploy successivo, quando la A ha funzionato per qualche settimana: togliere la copia (`writeLegacyStatusCopy`/`deleteLegacyStatusCopy`), eliminare la collezione `reservation_status` con uno script (prima a secco) e la sua regola in `firestore.rules`.
5. ~~Foto inutilizzate~~: eliminate birre, bibite, birra_spina, crocchè e logo1.png. Frittatina e montanare restano (usate da piatti del menu).

## Migliorie future

Poco lavoro, molto utili (consigliate per prime: 6, 7, 10):

6. ~~Email di richiesta recensione su Google il giorno dopo la cena~~: fatta (funzione pianificata alle 12, prenotazioni confermate di ieri). Si attiva con il prossimo deploy.
7. Notifica Telegram al titolare per ogni nuova prenotazione: codice pronto. Manca: creare il bot con @BotFather, gruppo privato con bot e titolare, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` su Netlify e nel `.env`.
8. Interruttore "esaurito oggi" sui piatti nel pannello, per nasconderli al volo senza cancellarli.
9. Avviso in cima al sito per chiusure, ferie o eventi, gestito dal pannello.
10. Copia di sicurezza automatica del database (es. settimanale).

Lavoro medio:

11. Clienti che non si presentano: pulsante "non si è presentato" nel pannello e storico per cliente.
12. Statistiche nel pannello: coperti per giorno, fasce più piene, prenotazioni online e manuali.
13. Filtri nel menu per allergeni e piatti vegetariani.
14. Statistiche delle visite al sito senza banner dei cookie (es. Plausible).

Lavoro più grande:

15. Lista d'attesa quando una fascia è piena, con avviso se si libera un posto.
16. Ordini da asporto online con ritiro a orario scelto.

Per evitare incidenti:

17. Controllo automatico dopo ogni deploy che avvisa se le prenotazioni non rispondono.

## In sospeso per scelta

- Telefono obbligatorio nel modulo di prenotazione: per ora no.
- Barra fissa "Chiama/Prenota": scartata.
