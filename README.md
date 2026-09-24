# CASA IN DUE

Applicazione separata estratta dal “Piccolo manuale affettivo”.

Contiene solo:
- **Compiti**: assegnazione a Ivan, Samantha o “Insieme”, area, frequenza, scadenza, stato e note.
- **Spese**: descrizione, categoria, totale, chi ha pagato, quote individuali, scadenza, stato e note.
- **Mediatore IA**: prepara un tema difficile, propone un’apertura più ascoltabile e conserva i confronti.

In più questa versione mostra subito:
- compiti attivi;
- compiti assegnati a ciascuno;
- totale spese del mese;
- totale spese non regolate;
- saldo netto da regolare tra i due.

## IMPORTANTE
Usa lo **stesso Supabase** del Piccolo manuale, quindi gli stessi due account e le stesse tabelle.
Non duplica i dati.

## PRIMA COSA DA FARE
Nel SQL Editor di Supabase esegui una volta:

`supabase/ATTIVA_CASA_IN_DUE.sql`

Serve a rendere Compiti, Spese e Mediatore utilizzabili subito, senza attendere la fine del percorso del Manuale.

## VARIABILI VERCEL
Nel nuovo progetto Vercel copia le stesse variabili del Manuale:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- OPENAI_API_KEY
- OPENAI_MODEL
- OPENAI_MEDIATION_MODEL

## PUBBLICAZIONE
Conviene creare un repository GitHub NUOVO, per esempio `casa-in-due`.
Nella root del nuovo repository devono esserci direttamente:
`app`, `components`, `lib`, `supabase`, `package.json`, ecc.

Non mettere questo progetto dentro il repository del Manuale: restano due siti separati.
