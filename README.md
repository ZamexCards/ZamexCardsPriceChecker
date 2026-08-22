# ZamexCards Price Checker

Eerste werkende demo-versie voor Vercel/Netlify.

## Wat zit erin?
- Zoekfunctie voor Pokémon TCG kaarten via Pokémon TCG API
- Afbeelding, set, serie, kaartnummer en rarity
- Demo-prijzen: vanaf prijs, trendprijs, gemiddelde prijs, PSA 10 indicatie
- Demo goedkoopste Nederlandse verkoper
- Laatste prijsontwikkeling
- Prijsgrafiek
- Favorieten via localStorage
- Prijsalarm via localStorage
- Backend endpoint: `/api/search`

## Belangrijk
De prijzen zijn demo-data. Voor echte Cardmarket prijzen is officiële toegang/toestemming of een legale databron nodig.

## Vercel upload
1. Maak een account op vercel.com
2. Klik op Add New Project
3. Upload deze map of koppel GitHub
4. Deploy
5. Gebruik daarna de URL in JouwWeb met iframe:

```html
<iframe src="https://jouw-project.vercel.app" style="width:100%;height:950px;border:0;border-radius:16px;"></iframe>
```

## Lokaal testen
```bash
npm install
npm start
```
Open daarna http://localhost:3000 als je een lokale server gebruikt.
