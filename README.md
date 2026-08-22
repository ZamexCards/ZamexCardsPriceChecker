# ZamexCards Price Checker v8.7 – snellere/slimmere scanner

Scanner is opnieuw opgebouwd voor Pokémonkaarten:

- OCR leest niet meer standaard de volledige kaart als één groot tekstvlak.
- Bovenste deel wordt apart gelezen voor kaartnaam.
- Onderste deel wordt apart gelezen voor collector-/kaartnummer.
- Alleen bij twijfel volgt één full-card fallback.
- Beeld wordt voor OCR automatisch:
  - grijswaarden;
  - contrastversterkt;
  - lichte/donkere pixels opgeschoond.
- OCR-worker wordt één keer geladen en daarna hergebruikt.
  Hierdoor zijn volgende scans duidelijk sneller dan telkens Tesseract opnieuw laden.
- Automatische scanpogingen volgen sneller.
- Kaartnummer heeft extra gewicht omdat dit vaak betrouwbaarder herkenbaar is dan full-art tekst.

Dit helpt vooral bij:
- holo kaarten;
- full arts;
- sleeves;
- reflecties;
- donkere achtergronden;
- kleine tekst onderaan.

Upload alleen `index.html` naar GitHub Pages.
