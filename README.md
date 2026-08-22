# ZamexCards Price Checker v6.6 – Multilanguage + toekomstige sets

## Talen
De geselecteerde kaarttaal bepaalt nu ook waar gezocht wordt.

Zoekvolgorde:
- Engels -> en
- Japans -> ja, daarna en
- Koreaans -> ko, daarna ja, daarna en
- Chinees -> zh-cn, daarna zh-tw, daarna ja, daarna en
- Duits/Frans/Italiaans/Spaans -> eigen taal, daarna en
- Nederlands -> nl, daarna en

Niet iedere databron heeft iedere taal even compleet. De fallbacks voorkomen dat een
kaart direct onvindbaar wordt als één taalcollectie achterloopt.

## Sets
- bekende internationale setcodes blijven direct werken;
- Japanse/Chinese/Koreaanse set-ID's zoals `sv2a`, `s12a` kunnen rechtstreeks worden geprobeerd;
- onbekende setcodes worden dynamisch gezocht in de actuele setlijsten;
- Engelse/internationale PTCGO-codes worden aanvullend via Pokémon TCG API opgelost;
- nieuwe/aankomende sets worden zichtbaar zodra één van de gekoppelde databronnen ze publiceert.

## Afbeeldingen
De echte kaartafbeelding wordt gebruikt zodra de bron die heeft gepubliceerd.
Als een aangekondigde kaart nog geen openbare scan heeft, toont de pagina een
ZamexCards-placeholder zodat er nooit een kapot/leeg afbeeldingsvlak staat.

## Upload
Voor GitHub Pages hoef je alleen `index.html` te vervangen.
Commit changes, wacht 1-2 minuten en gebruik Ctrl+F5.
