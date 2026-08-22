# ZamexCards Price Checker v12.0 – hybride scanner

De scanner gebruikt nu twee verschillende herkenningslagen:

1. OCR / kaartgegevens
   - naam
   - kaartnummer
   - totaal
   - setcode

2. Visuele artwork-verificatie
   - de gescande kaartuitsnede wordt visueel vergeleken met kaartafbeeldingen
     van de kandidaten uit de kaartdatabase;
   - totaal ander artwork wordt verworpen;
   - OCR-fouten kunnen daardoor niet zomaar een Café Master, Oddish, Unown
     of andere verkeerde kaart laten verschijnen.

Candidate pool:
- setcode + nummer
- naam + nummer
- naam
- nummer
Daarna volgt ALTIJD visuele controle wanneer de kaartafbeelding via CORS beschikbaar is.

Basiskaart eerst:
- uitvoering (Normal / Reverse / Poké Ball / Master Ball / stamp) bepaalt nooit de identiteit;
- eerst wordt de juiste basiskaart vastgesteld;
- daarna worden uitvoeringen van diezelfde kaart getoond/geprioriteerd.

Beperkingen:
- als een externe kaartafbeeldingsserver browser-CORS blokkeert, valt de scanner terug op
  de strenge multi-signal tekstcontrole;
- dit is de slimste client-side/browser-aanpak zonder externe AI/API-backend.

Upload alleen index.html naar GitHub Pages.
