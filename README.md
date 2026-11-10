# EscrowSnap

**De 1-minuut borgstelling voor freelancers.**

Veel zzp'ers beginnen aan een klus zonder aanbetaling, met het risico dat de klant niet betaalt.
Grote escrow-systemen zijn te zwaar voor kleine klussen. EscrowSnap lost dat op:

1. **Opdrachtgever** zet het bedrag binnen een minuut over naar een veilige tussenrekening (escrow).
2. **Zzp'er** levert het werk op met een bewijsstuk (foto of document).
3. **Opdrachtgever** geeft akkoord en het geld wordt direct vrijgegeven aan de zzp'er.

## Status

> **Prototype.** Er wordt **geen echt geld verplaatst**. De betaalstap is gesimuleerd.
> Gebruik deze versie niet voor echte transacties.

Wat werkt:

- Klus aanmaken met omschrijving, partijen en bedrag (invoer als `250`, `250,50` of `250.50`; intern in centen)
- Vaste levenscyclus: `concept` → `gefinancierd` → `opgeleverd` → `vrijgegeven`
- Acties die buiten de volgorde vallen, worden geweigerd (bijv. vrijgeven zonder oplevering)
- Bewijsstuk uploaden: PNG, JPG, WebP, GIF of PDF, max. 2 MB
- Opgeslagen data die niet klopt, wordt overgeslagen i.p.v. de pagina te laten crashen
- Mobielvriendelijke interface, licht en donker thema, toetsenbordbediening

Nog niet aanwezig (nodig voor productie):

| Onderdeel | Waarom nodig |
| --- | --- |
| Echte betaalprovider met escrow-rekeningen (bijv. Mollie, Adyen, Stripe Connect) | Zonder dit is er geen echte borging |
| Accounts en inloggen | Nu is iedere browser een eigen wereld |
| Server-side opslag | Klussen staan nu in localStorage, per browser |
| Geschillenproces ("niet akkoord") | Nu kan een klus alleen doorlopen of blijven hangen |
| Meldingen per e-mail | Partijen horen nu niets van elkaar |

## Starten

Geen installatie nodig. Open `index.html` in de browser, of:

```bash
npm start          # statische server op http://localhost:8000
```

## Tests

```bash
npm test           # node --test escrow.test.js (geen dependencies)
```

De escrow-regels, bedragvalidatie en de controle van bewijsstukken zitten in `escrow.js` en zijn los van de
browser testbaar. CI draait de tests en een syntaxiscontrole op elke push en pull request
(`.github/workflows/ci.yml`).

## Architectuur

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `escrow.js` | Pure logica: statusovergangen, validatie, bedragparsing, bewijscontrole. Geen DOM, geen opslag. |
| `escrow.test.js` | Unit-tests voor alle statusregels en validatie |
| `app.js` | Interface: formulier, lijst, stappen, acties, localStorage (met validatie bij laden) |
| `index.html`, `styles.css` | Pagina en opmaak |

Bedragen worden altijd als gehele centen opgeslagen om afrondingsfouten met floats te voorkomen.

## Beveiliging

- Tekst wordt uitsluitend via `textContent` in de pagina gezet; er is geen `innerHTML` met gebruikersinvoer.
- Een bewijsstuk wordt alleen getoond of aangeboden als het type op de witte lijst staat en de data-URL
  overeenkomt met dat type (`isSafeProofDataUrl`). SVG en HTML worden dus nooit weergegeven.
- Opgeslagen klussen worden bij het laden gevalideerd (`sanitizeJob`); manipulatie van localStorage kan geen
  ongeldige statussen of bedragen introduceren.
- Dit is client-side validatie. Voor productie moeten dezelfde regels server-side worden afgedwongen, omdat de
  browser niet te vertrouwen is.

## Bijdragen

Wijzigingen in de escrow-regels horen altijd met een test erbij. Draai `npm test` voordat je pusht.
