# EscrowSnap

**De 1-minuut borgstelling voor freelancers.**

Veel zzp'ers beginnen aan een klus zonder aanbetaling, met het risico dat de klant niet betaalt.
Grote escrow-systemen zijn te zwaar voor kleine klussen. EscrowSnap lost dat op:

1. **Opdrachtgever** zet het bedrag binnen een minuut over naar een veilige tussenrekening (escrow).
2. **Zzp'er** levert het werk op met een bewijsstuk (foto of document).
3. **Opdrachtgever** geeft akkoord en het geld wordt direct vrijgegeven aan de zzp'er.

## Status van deze versie

Dit is een **werkende prototype-versie** (demo). Er wordt **geen echt geld verplaatst**.
De betaalstap is gesimuleerd. Voor productie moet de escrow-stap worden gekoppeld aan een
betaalprovider met echte gesegregeerde rekeningen (bijv. Mollie, Adyen of Stripe Connect).

Wat werkt:

- Klus aanmaken met omschrijving, partijen en bedrag (in euro's, intern in centen)
- Levenscyclus met vaste volgorde: concept → geld in escrow → werk opgeleverd → vrijgegeven
- Acties die buiten de volgorde vallen, worden geweigerd (bijv. geld vrijgeven zonder oplevering)
- Bewijsstuk uploaden (afbeelding of PDF, max. 2 MB)
- Opslag in de browser (localStorage), mobielvriendelijke interface, licht en donker thema

Wat nog ontbreekt: accounts en inloggen, echte betalingen, meldingen per e-mail, geschillenproces
(bijv. "niet akkoord" met bemiddeling) en een server-side opslag die je deelt tussen apparaten.

## Starten

Geen installatie nodig. Open `index.html` in de browser, of start een statische server:

```bash
python3 -m http.server 8000
# open daarna http://localhost:8000
```

## Tests

De escrow-regels zitten in `escrow.js` en hebben geen afhankelijkheden:

```bash
node --test escrow.test.js
```

## Bestanden

| Bestand | Doel |
| --- | --- |
| `escrow.js` | Pure logica voor de escrow-levenscyclus (testbaar zonder browser) |
| `escrow.test.js` | Unit-tests voor de statusregels en validatie |
| `app.js` | Interface: formulier, lijst, stappen, acties, opslag |
| `index.html` / `styles.css` | Pagina en opmaak |
