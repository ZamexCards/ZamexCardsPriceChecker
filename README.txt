ZamexCards Locked Scanner + conditieprijs

VERVANG:
- scanner-v4.html
- scanner-bridge.js

CAMERA IS NIET GEWIJZIGD.
SHA camera voor: 9687c4ab68bc088fc03fad94776cea5fa8a6b69e23245123c363e1efe019f862
SHA camera na:   9687c4ab68bc088fc03fad94776cea5fa8a6b69e23245123c363e1efe019f862

NIEUW:
1. De knop 'Scan kaart' op de Price Checker opent de vaste werkende scanner:
   https://zamex-cards-price-checker.vercel.app/scanner-v4.html

2. In de scanner kun je na de uitvoering de conditie kiezen:
   Mint
   Near Mint
   Excellent
   Good
   Light Played
   Played
   Poor

3. Conditie beïnvloedt de prijs én wordt meegenomen naar de kaartenlijst.

Conditie-indicatie wanneer de marktfeed geen losse conditieprijs levert:
Mint 110%
Near Mint 100%
Excellent 85%
Good 70%
Light Played 60%
Played 45%
Poor 30%

Dit wordt zichtbaar in de prijsbron zodat het duidelijk een conditie-indicatie is.

4. scanner-bridge.js bevat ook de huidige set/setcode dropdown:
   nieuwste release bovenaan, setcode rechts, promo/specials meegenomen,
   regionale sets zo leesbaar mogelijk in normale/Engelse letters.

NIET AANRAKEN:
api/scan.js
lib/catalog-resolver.js
index.html
package.json
vercel.json
