# ZamexCards Price Checker v7.3 – prijsvalidatie

Nieuwe bescherming tegen verkeerde prijzen:

- prijs wordt alleen gekoppeld bij exacte match op:
  - kaartnaam
  - set
  - kaartnummer
  - gekozen uitvoering
- TCGdex zoekresultaten worden niet meer op alleen kaartnummer gekoppeld;
- een willekeurige eerste zoekhit wordt niet meer als prijsbron gebruikt;
- uitbijtercontrole:
  - als een 30-dagenprijs meer dan 2,25× afwijkt van andere beschikbare marktprijzen,
    wordt die prijs verworpen;
- als de prijs niet betrouwbaar kan worden bevestigd:
  - `Geen betrouwbare 30-dagenprijs beschikbaar`
  - dus géén fout bedrag tonen.

Dit is bewust strenger: liever geen prijs dan een verkeerde prijs.

Upload alleen `index.html` naar GitHub Pages.
Daarna Commit changes, 1-2 minuten wachten en Ctrl+F5.
