# ZamexCards Price Checker v8.0 – wereldwijde automatische kaartcatalogus

## Wat is veranderd
De Price Checker gebruikt niet langer een handmatige lijst met actuele Pokémon TCG sets.

Bij het openen van de pagina wordt automatisch een wereldwijde setcatalogus opgebouwd uit:
- TCGdex Engels
- TCGdex Japans
- TCGdex Traditional Chinese
- TCGdex Simplified Chinese wanneer beschikbaar
- TCGdex Koreaans wanneer beschikbaar
- Duits, Frans, Italiaans, Spaans, Portugees en Nederlands als extra regio-/taalfallback
- Pokémon TCG API voor officiële internationale setcodes en extra Engelse releases

De catalogus wordt 12 uur lokaal gecachet. Daarna wordt hij automatisch vernieuwd.
Als een ingevoerde setcode niet in de cache staat, doet de pagina ook een live refresh en
probeert hij directe set-ID's in alle gekoppelde talen.

## Zoeken
Ondersteunt onder andere:
- naam
- naam + set
- naam + nummer
- set + nummer
- naam + set + nummer
- promo's
- Black Star Promos
- Trainer Gallery / TG
- Galarian Gallery / GG
- Japanse set-ID's zoals sv2a en s12a
- Chinese/Koreaanse sets zodra de gekoppelde bron ze publiceert
- volledige setnamen
- nieuwe/aankomende sets zodra minimaal één databron ze heeft gepubliceerd

## Afbeeldingen
Meerdere kaartafbeeldingsbronnen/fallbacks blijven actief.
Als nog nergens een echte scan gepubliceerd is, verschijnt de ZamexCards-placeholder
in plaats van een kapotte afbeelding.

## Prijzen
De bestaande strenge 30-dagenprijsvalidatie uit v7.3 blijft actief.
Een prijs wordt liever geweigerd dan aan de verkeerde kaart gekoppeld.

## GitHub Pages
Vervang alleen `index.html`.
Commit changes, wacht 1-2 minuten en gebruik daarna Ctrl+F5.

Belangrijk: geen enkele website kan een kaart tonen voordat minimaal één openbare databron
de set/kaart heeft gepubliceerd. v8.0 zorgt er wel voor dat je daarna niet opnieuw de HTML
hoeft aan te passen voor iedere nieuwe setcode.
