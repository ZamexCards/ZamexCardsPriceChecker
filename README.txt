ZamexCards Set/Setcode dropdown v2

VERVANG ALLEEN:
scanner-bridge.js

NIET AANRAKEN:
- scanner-v4.html
- cameracode
- api/scan.js
- lib/catalog-resolver.js
- index.html

Wat deze versie doet:
- Engelse sets worden uit een officiële/dynamische setcatalogus geladen.
- Nieuwste releasedatum staat bovenaan.
- Promo- en special sets blijven in de lijst.
- Setcode staat rechts.
- Speciale code-weergave o.a.:
  Scarlet & Violet 151 -> 151
  Black Bolt -> BLK
  White Flare -> WHT
  Brilliant Stars -> BRS (broncode)
  Fusion Strike -> FST (broncode)
- Japanse, Chinese en Koreaanse dropdown:
  nooit meer onleesbare tekens als hoofdnaam.
  Eerst wordt een Engelse naam geprobeerd.
  Is die niet betrouwbaar beschikbaar, dan komt er een leesbare fallback
  zoals 'Japanese set sv2a' in plaats van een naam in Japanse tekens.
- Regionale sets worden per set-detail geladen zodat de echte releaseDate
  gebruikt kan worden voor nieuwste-bovenaan.
- Catalogus wordt 24 uur lokaal gecachet.

De scanner en camera zijn niet aangepast.
