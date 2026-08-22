# ZamexCards Price Checker v9.3 – snelle scanner

Doel: normale herkenning binnen circa 2–5 seconden op moderne telefoons.

Nieuwe scanvolgorde:
1. Alleen onderste kaartgedeelte OCR -> collector number / setcode.
2. Bij volledig nummer zoals 051/084 of 130/094 -> direct databasecontrole.
3. Alleen als meerdere kaarten mogelijk zijn -> één korte OCR van de kaartnaam.
4. Geen volledige kaart-OCR meer bij iedere automatische poging.

Snelheidsverbeteringen:
- kleinere OCR-afbeeldingen;
- aparte tekenset voor kaartnummer;
- aparte tekenset voor kaartnaam;
- OCR-worker warmt al op terwijl de camera opent;
- volledig collector number mag direct zoeken;
- minder herhaalde scanpogingen.

Dit voorkomt dat drie zware OCR-rondes per frame nodig zijn.
