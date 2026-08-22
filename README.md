# ZamexCards Price Checker v12.1 – artwork-first scanner

Waarom v12.0 duidelijke kaarten kon afwijzen:
- visuele vergelijking keek te veel naar de hele kaart;
- Reverse Holo / Poké Ball / Master Ball / goud veranderde het uiterlijk sterk;
- Chinese/Japanse/Koreaanse kaartnamen kunnen niet betrouwbaar met Engelse OCR gelezen worden.

v12.1:
- visuele matching vergelijkt vooral het ARTWORK-vak;
- holo/ball/stamp patronen buiten het artwork beïnvloeden de identiteit veel minder;
- volledige kaart blijft slechts een secundair visueel signaal;
- setcode + kaartnummer werkt als hoofdroute voor Aziatische kaarten;
- kaartnummer + totaal kan de set bevestigen als setcode OCR mist;
- sterke artwork-match kan een kaart bevestigen zonder leesbare Engelse naam;
- uitvoering wordt nog steeds pas na de basiskaart bepaald.

Melding bij geen match:
"Geen match gevonden. probeer opnieuw of kies een foto."

Upload alleen index.html.
