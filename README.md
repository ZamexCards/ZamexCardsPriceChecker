# ZamexCards Price Checker v9.7

Belangrijkste scannerfixes:

- OCR bovenkant en onderkant worden NIET meer tegelijk op dezelfde Tesseract-worker uitgevoerd.
  Dit veroorzaakte mobiele herkenningsproblemen.
- Naam + exact kaartnummer kan nu direct een veilige match zijn als die combinatie uniek is.
- Nummer + totaal (bijv. 047/094) is een tweede sterke route.
- Setcode + nummer is een derde sterke route.
- Ontbreekt set-total metadata in een kort database-record, dan wordt voor maximaal 12 kandidaten
  de volledige kaartdata opgehaald.
- Candidate search probeert in volgorde:
  1. setcode + naam + nummer
  2. naam + nummer
  3. nummer
  4. naam
- OCR-zones zijn iets ruimer gemaakt voor schuin gehouden kaarten.
- Nooit automatisch de eerste kaart met hetzelfde losse nummer kiezen.

Dit betekent dat een kaart zoals Vullaby met duidelijke naam bovenaan en collector number onderaan
ook gevonden kan worden wanneer de setcode niet goed door OCR wordt gelezen.

Een browser-only scanner kan niet letterlijk 100% van alle mogelijke kaarten onder alle lichtomstandigheden
garanderen, maar deze versie gebruikt nu de betrouwbare combinaties in plaats van één fragiel OCR-resultaat.
