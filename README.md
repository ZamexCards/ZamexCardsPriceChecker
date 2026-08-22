# ZamexCards Price Checker v9.0 – exacte scanneridentiteit

Probleem opgelost:
Een scan van een kaart met collector number `130/094` mocht niet meer automatisch
een willekeurige andere kaart met nummer `130` kiezen.

Nieuwe scannerlogica:
- bewaart nu zowel teller als noemer van het kaartnummer;
  - voorbeeld: `130/094`
- probeert setcode onderaan de kaart mee te lezen;
  - voorbeeld: `PFL`
- naam + setcode + teller + noemer worden samen gebruikt voor matching
- nummer alleen is niet meer voldoende voor automatische selectie
- als er meerdere mogelijke kaarten zijn:
  - géén eerste resultaat automatisch selecteren
  - gebruiker moet eerst de juiste kaart kiezen
- als `130/094` is gelezen maar geen exacte match kan worden bevestigd:
  - scanner toont liever geen kaart dan een verkeerde kaart
  - hij valt dan niet terug op een onveilige `130`-only search

Dit voorkomt specifiek situaties zoals:
`Mega Charizard X ex PFL 130/094` -> ten onrechte `Water Energy Base Set 2 #130`.

Upload alleen `index.html` naar GitHub Pages.
