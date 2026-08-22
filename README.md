# ZamexCards Price Checker v11.3 – geen verkeerde scanresultaten

Belangrijkste verandering:
de scanner toont NOOIT meer fuzzy/losse resultaten die niet minstens twee harde kenmerken delen met de scan.

Een kaart mag alleen in scanresultaten verschijnen bij minimaal een van deze combinaties:
- naam + kaartnummer
- setcode + kaartnummer
- kaartnummer + totaal uit de set
- naam + setcode, alleen als kaartnummer helemaal niet gelezen kon worden

Verwijderd:
- number-only fallback
- name-only fallback
- brede fuzzy shortlist

Daardoor kan een verkeerde OCR zoals 133 niet meer zomaar Café Master tonen als de scan Victini BLK 012/086 is.

Bij onvoldoende zekerheid:
- geen kaartresultaten
- melding dat er geen veilige match is
- opnieuw scannen of foto kiezen

Resultaattegels zijn bovendien opnieuw groter gemaakt voor mobiel.

Dit is de veiligste browser-only strategie:
liever nul resultaten dan één verkeerde kaart.
