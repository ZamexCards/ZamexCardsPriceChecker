# ZamexCards Price Checker v11.0 – multi-signal scanner

Deze versie is bedoeld als afronding van de scannerflow.

Kaartidentiteit:
- OCR leest kaartnaam bovenaan;
- OCR leest kaartnummer + totaal onderaan;
- OCR leest setcode als die zichtbaar is;
- kaartdatabase vergelijkt alle signalen;
- minimaal twee sterke signalen zijn genoeg;
- unieke naam + exact kaartnummer is voldoende;
- exact nummer + totaal is voldoende;
- exact setcode + nummer is voldoende;
- geen zekere match -> shortlist, nooit willekeurig eerste resultaat.

Oud / nieuw / special:
- werkt op basis van dezelfde naam/nummer/set matching;
- oudere kaarten met setsymbool hoeven het symbool niet letterlijk door OCR te laten lezen;
- nummer+totaal en naam kunnen de set in de database afleiden;
- nieuwe/promokaarten worden gevonden zodra de databron ze kent.

Uitvoering:
- databasevarianten worden gecontroleerd;
- Basic/Normaal, Holo en Reverse Holo worden conservatief visueel geschat;
- Poké Ball, Master Ball en stamps worden alleen automatisch gekozen bij voldoende databasezekerheid;
- bij twijfel blijft uitvoering op Automatisch.

Belangrijk:
een browser-only OCR scanner kan technisch niet 100% foutloos zijn bij elke hoek/lichtsituatie,
maar deze versie blokkeert niet meer op één OCR-fout en kiest ook niet meer zomaar een verkeerde kaart.
