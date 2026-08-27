ZamexCards Scanner - werkende camera geïntegreerd

VERVANG ALLEEN:
scanner-v4.html

Deze versie gebruikt de camerastart die aantoonbaar werkte in camera-test.html.

Behoudt:
- Foto maken
- Uit galerij
- groene laadcirkel
- kaart herkenning
- prijs
- toevoegen-knop
- knop naar Price Checker

Alleen live camera is vervangen.

Camera-volgorde:
1. environment (ideal)
2. environment
3. video:true
4. wachten op echte videoWidth/videoHeight
5. continuous autofocus als ondersteund
6. geen zoom forceren bij opstart

NIET VERVANGEN:
index.html
scanner-bridge.js
api/scan.js
lib/catalog-resolver.js
package.json
vercel.json
