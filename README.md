# ZamexCards Price Checker v9.1

Scanner-identiteit is strenger gemaakt.

Een kaart wordt alleen automatisch gekozen als minimaal twee sterke kenmerken overeenkomen:
- volledig kaartnummer / collector number
- setcode
- kaartnaam
- numerator van kaartnummer

Een los nummer is nooit genoeg.

Uitvoering:
- eerst gekeken welke uitvoeringen bij exact die kaart in de database bestaan;
- één mogelijke uitvoering -> automatisch gekozen;
- Basic / Normaal, Holo en Reverse Holo kunnen voorzichtig visueel worden herkend;
- Poké Ball, Master Ball en stamps worden alleen automatisch gekozen als de database dit voor exact die kaart ondersteunt;
- bij twijfel blijft Uitvoering op Automatisch.

Hierdoor wordt liever geen automatische keuze gemaakt dan een verkeerde kaart of verkeerde uitvoering.
