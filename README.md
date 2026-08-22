# ZamexCards Price Checker v6 – Dashboard + mobiele scanner

Deze versie is bedoeld voor Vercel (GitHub gekoppeld).

## Nieuw
- Dashboard-opmaak zoals het ZamexCards voorbeeld: kaartdetails links, prijzen/grafiek in het midden en kaartenlijst rechts.
- Volledig responsive voor telefoon en tablet.
- Mobiele camera-knop `Scan kaart`.
- OCR draait in de browser via Tesseract.js; geen OpenAI API-key nodig.
- Scanner probeert automatisch kaartnaam en kaartnummer te herkennen, vult de zoekvelden en zoekt daarna de kaart op.
- Foto-upload/camera-capture fallback voor telefoons waar live camera niet kan openen.
- Kaartenlijst met +/-, prijs per stuk, totaal per kaart, totaal van de lijst en 80% van totaal.
- Uitvoering, taal, conditie, gradingbedrijf en grade blijven bewaard per toegevoegd item.
- Echte ZamexCards-logo URL wordt gebruikt: https://www.zamexcards.nl/wp-content/uploads/2022/09/cropped-zamexcards-logo.png

## Belangrijk over scannen
Browser-OCR is handig maar niet 100% foutloos. Glans, sleeves, holo-effecten, slechte belichting en afwijkende kaartlayouts kunnen herkenning bemoeilijken. De scanner vult daarom eerst de zoekgegevens in en zoekt daarna in de kaartdatabase. Bij meerdere resultaten kan de gebruiker de juiste kaart aantikken.

Camera werkt alleen op HTTPS (Vercel voldoet hieraan) en na toestemming van de gebruiker.

## Installeren via GitHub + Vercel
1. Pak de ZIP uit.
2. Upload de inhoud naar dezelfde GitHub repository als de vorige versie.
3. Vervang bestaande bestanden wanneer GitHub hierom vraagt.
4. Commit changes.
5. Vercel publiceert de nieuwe commit automatisch.

## Prijsdata
Kaartgegevens komen uit de bestaande kaartdatabronnen. Prijzen blijven demo-data totdat een officiële/gelicentieerde prijsbron wordt gekoppeld.
