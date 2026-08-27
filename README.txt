ZamexCards LIJST FIX - CAMERA OP SLOT

VERVANG ALLEEN:
1. scanner-v4.html
2. scanner-bridge.js

CAMERA:
NIET GEWIJZIGD.
SHA256 camerablok vóór: 9687c4ab68bc088fc03fad94776cea5fa8a6b69e23245123c363e1efe019f862
SHA256 camerablok ná:    9687c4ab68bc088fc03fad94776cea5fa8a6b69e23245123c363e1efe019f862
Deze hashes zijn identiek.

NIEUWE LIJSTWERKING:
1. Scan een kaart.
2. Kies uitvoering.
3. Klik 'Toevoegen aan kaartenlijst'.
4. De knop wordt direct groen:
   ✅ Toegevoegd aan kaartenlijst
5. Klik onderaan 'Bekijk mijn kaartenlijst in de Price Checker'.
6. De scanner neemt de toegevoegde kaarten mee naar GitHub Pages.
7. scanner-bridge.js importeert ze in de echte localStorage key:
   zc_favs
8. Daardoor verschijnen ze in 'Jouw kaartenlijst' in de Price Checker.

WAAROM:
De oude verborgen iframe-oplossing kon op mobiele browsers een aparte,
gepartitioneerde localStorage krijgen. Daardoor kreeg de scanner wel een
'toegevoegd'-melding, maar zag de echte Price Checker de kaart niet.

NIET AANRAKEN:
- api/scan.js
- lib/catalog-resolver.js
- index.html
- package.json
- vercel.json
- cameracode
