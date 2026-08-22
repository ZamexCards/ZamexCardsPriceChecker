# ZamexCards Price Checker v7.1

Wijzigingen:
- `+ Voeg toe aan lijst` werkt weer en bewaart de kaart direct in localStorage.
- Als dezelfde kaart/uitvoering opnieuw wordt toegevoegd, gaat het aantal met 1 omhoog.
- + / - aantallen worden direct opgeslagen.
- De knop `Prijsalarm` is verwijderd.
- Promo-setcodes toegevoegd:
  - SVP = Scarlet & Violet Black Star Promos
  - SWSH / SWSHP = Sword & Shield Black Star Promos
  - SMP / SM = Sun & Moon Black Star Promos
  - XYP / XY = XY Black Star Promos
  - BWP / BW = Black & White Promos
  - DPP / DP = Diamond & Pearl Promos
  - NP = Nintendo Promos
- Bij oudere promo-series wordt een puur nummer automatisch ook geprobeerd met het tijdperk-prefix.
  Voorbeeld: `SWSH 036` probeert ook `SWSH036`.

Test:
- Set: SVP
- Kaartnummer: 036

Voor GitHub Pages:
vervang alleen `index.html`, Commit changes, wacht 1-2 minuten en gebruik Ctrl + F5.
