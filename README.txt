ZamexCards - Asian / English recognition fix

VERVANG ALLEEN:
lib/catalog-resolver.js

NIET AANRAKEN:
- scanner-v4.html
- camera
- scanner-bridge.js
- index.html
- api/scan.js

Waarom dit nodig was:
1. De huidige resolver ondersteunt in LANG_MAP alleen:
   English, Japanese en Traditional Chinese.
   Simplified Chinese en Korean ontbreken volledig.

2. Voor Japanese werd het Engelse card_name gebruikt om in een Japanse
   database te zoeken. Bijvoorbeeld 'Copperajah' werd gezocht terwijl de
   Japanse catalogus de Japanse gedrukte naam bevat.

3. Engelse kaarten konden mislukken wanneer de AI-naam nét anders gespeld
   was dan de database (bijv. EX/ex, streepjes of leestekens).

Nieuwe aanpak:
- English -> en
- Japanese -> ja
- Simplified Chinese -> zh-cn
- Traditional Chinese -> zh-tw
- Korean -> ko

Zoekvolgorde:
- Bij Aziatische kaarten eerst printed_name in de lokale catalogus.
- Daarna canonical card_name.
- Daarna collector number/localId als sterke fallback.
- Complete collector fraction X/Y is de harde identiteit.
- Bij meerdere kaarten met dezelfde X/Y wordt artwork visueel vergeleken.
- Zonder betrouwbare collector fraction wordt alleen bij zeer hoge
  visuele zekerheid automatisch bevestigd; anders blijven kandidaten zichtbaar.

Camera/scanner is NIET gewijzigd.
