# ZamexCards Price Checker v9.6

Scanner gebruikt nu drie onafhankelijke herkenningssignalen:

1. Kaartnaam bovenaan.
2. Volledig kaartnummer + totaal, bijvoorbeeld 053/084.
3. Setcode, wanneer die leesbaar op de kaart staat.

Een kaart wordt alleen automatisch gekozen wanneer minimaal 2 van de 3 signalen overeenkomen.

Voor oudere kaarten met alleen een grafisch setsymbool:
- het symbool hoeft niet letterlijk door OCR gelezen te worden;
- naam + kaartnummer + totaal aantal kaarten worden gebruikt om de set uit de kaartdatabase af te leiden.

Ruwe OCR-onzin wordt niet meer rechtstreeks in de Price Checker gezet.
De velden worden pas ingevuld na een bevestigde database-match.

Uitvoering:
- databasevarianten worden eerst gecontroleerd;
- Basic/Normaal, Holo en Reverse Holo worden conservatief visueel geschat;
- Poké Ball / Master Ball / stamps worden alleen automatisch gekozen als de database geen twijfel laat;
- bij twijfel blijft Uitvoering op Automatisch.

Camera:
- + en - zoomknoppen;
- echte hardwarezoom indien ondersteund;
- continuous autofocus indien ondersteund;
- normale telefoon-autofocus is fallback.

Upload alleen index.html naar GitHub Pages.
