# ZamexCards Price Checker v8.8 – multi-frame scanner

Belangrijkste fixes:

## Scanresultaat direct in Price Checker
Na herkenning wordt niet meer alleen losse OCR-tekst in de zoekvelden gezet.

De scanner:
1. leest naam/kaartnummer;
2. bevestigt deze combinatie tegen de wereldwijde kaartdatabase;
3. gebruikt bij een exacte match de echte databasegegevens;
4. vult automatisch in:
   - kaartnaam
   - set / officiële setcode
   - kaartnummer
5. toont de gevonden kaart direct in de Price Checker.

Hierdoor hoeft de normale zoekfunctie niet meer te gokken op onvolledige OCR-data.

## Lichte beweging / trilling
Automatische scan gebruikt meerdere frames.

- resultaten van recente frames worden bijgehouden;
- hetzelfde kaartnummer in 2 frames geldt als consensus;
- OCR-naam mag licht verschillen;
- kleine handbeweging is daardoor veel minder problematisch;
- de eerste scanpogingen volgen ongeveer iedere halve seconde;
- kaartnummer krijgt de hoogste prioriteit.

## Meerdere mogelijke kaarten
Als kaartnummer niet uniek is:
- OCR-naam wordt gebruikt om de beste match te bepalen;
- zijn er nog meerdere plausibele matches, dan worden de resultaten getoond zodat de gebruiker kan kiezen.

Upload alleen `index.html` naar GitHub Pages.
