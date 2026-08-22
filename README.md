# ZamexCards Price Checker v11.1

Fixes:
- `setcode + volledig collector number` is nu de eerste en sterkste scanroute.
- Voorbeeld: `BLK 012/086` wordt eerst exact binnen BLK gezocht voordat fuzzy name/number search begint.
- setcode, nummer en totaal hebben hogere matchscore.
- onderste OCR-zone gebruikt de volledige kaartbreedte zodat moderne setcodes links onder beter worden gelezen.
- speciale uitvoeringen (Poké Ball, Great Ball, Master Ball, stamps) worden pas NA bevestigde kaartidentiteit behandeld.
- uitvoering mag de kaartidentiteit nooit meer verstoren.
- keuze-resultaten zijn duidelijk groter gemaakt op mobiel:
  - grotere kaartafbeelding
  - groter lettertype
  - bredere kaarttegels

Bij meerdere kandidaten kiest de scanner nog steeds nooit willekeurig de eerste.
