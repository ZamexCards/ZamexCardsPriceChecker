# ZamexCards Price Checker v7.2

Verbeteringen:
- extra afbeeldingsfallback via de officiële Pokémon TCG image CDN;
- ontbrekende TCGdex-afbeeldingen worden aangevuld via Pokémon TCG API;
- eerst gemiddelde 30-dagenprijs waar beschikbaar;
- ontbreekt die, dan wordt TCGplayer actuele marktprijs als fallback getoond;
- fallbackprijzen in TCGplayer worden als USD getoond om geen onbetrouwbare EUR-conversie te verzinnen;
- de kaartenlijst toont dezelfde fallbackprijs per kaart;
- totaaltelling in EUR gebruikt alleen echte EUR 30-dagenprijzen, zodat valuta niet door elkaar worden opgeteld.

Special Delivery Charizard SWSH075 krijgt hierdoor een echte kaartafbeelding via images.pokemontcg.io en, waar de API marktdata levert, een actuele TCGplayer marktprijs als fallback.
