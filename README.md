# ZamexCards Price Checker v9.4 – camera start fix

Fix voor zwart camerascherm op Android/Samsung:

- OCR start niet meer tegelijk met de camera.
- Eerst wordt de camera volledig geopend en zichtbaar gemaakt.
- Daarna pas wordt OCR op de achtergrond voorbereid.
- Eerste camera-aanvraag gebruikt lichte 1280x720 constraints.
- Bij timeout volgt automatisch een eenvoudigere rear-camera aanvraag.
- Als dat nog niet werkt, volgt een `video:true` fallback.
- `video.srcObject` wordt bij sluiten volledig geleegd, zodat Android de camera niet geblokkeerd houdt.
- Autofocus/exposure krijgt ongeveer 1 seconde om te stabiliseren voordat automatisch scannen begint.

Upload alleen index.html naar GitHub Pages.
