# ZamexCards Price Checker v10.1 – kaartuitsnede scanner

Probleem uit v10.0:
OCR las boven- en onderzones relatief aan het volledige camerabeeld.
Als de kaart niet exact schermvullend stond, kon de naam of collector number buiten de OCR-zone vallen.

v10.1:
- berekent eerst een centrale Pokémonkaart-uitsnede met de juiste kaartverhouding;
- OCR-zones voor naam en nummer zijn relatief aan die kaartuitsnede;
- iets extra marge houdt rekening met lichte scheefstand;
- collector-number zone wordt groter opgeschaald;
- bij gemist kaartnummer volgt één extra sparse-text OCR-pass;
- minder agressieve beeldbewerking voor holo/reverse kaarten.

Het doel is dat een duidelijke scan zoals Vullaby 049/084 niet meer wordt afgekeurd alleen omdat
de kaart niet exact van rand tot rand in het camerabeeld staat.
