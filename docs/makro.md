# Makro-Charts (seit 2026-10-20, Umbau 2026-10-21)

Referenziert von `CLAUDE.md`. Code: `js/makro.js`. Wächter: `check/makro.js`, `check/altgeraet.js`.

## Auftrag

> 2026-10-20: „einen Schalter haben zum wechseln also wenn ich Wechsel soll da drei
> großer Chart auftauchen in denen ich dann alle Indikatoren rein machen kann“

> 2026-10-21: „die Switch Funktion ist noch ziemlich blöd und hat viele Schwächen …
> mach sie perfekt“

**Nutzerwahl 2026-10-21 (Rückfrage):** Schalter je Karte | Charts = eine Karte mit
Reitern, Klick auf eine Karte öffnet deren Reiter | *keine Einstufung* („das ist nur
zum analysieren“) | Zahlen je Spur, **„abgetrennt und übersichtlich — das hat Priorität“**.

## Regeln

- **Schalter `Table | Charts` je Makro-Karte**, in der Zeile **direkt unter dem Kopf**
  (`.mk-kz`). *Gemessen:* im Kopf frei 15 px (1024) bzw. 29 px (390), der Schalter
  braucht ~110 px, Namen werden nie gekürzt.
- **Charts = EINE breite Karte mit Reitern** (`#mkTabKarte`) statt der drei Karten.
  Aktiv ist der Reiter der geklickten Karte. Kopf: Symbol des aktiven Reiters |
  Reiter (17 px, aktiv = Navy-Unterstrich) | Score der aktiven Karte | `Table | Charts` | ⓘ.
- **Jede Spur ein eigener Block**, getrennt durch eine Linie. Kopfzeile:
  Name | **Act | Fc | Prev | Next | Score** — Act/Fc/Prev aus `indZeilenWerte()`
  (dieselbe Rechnung wie die Tabellenzeile), Next = `indNextReleaseCell`,
  Score = `indScore`. Handy: drei Felder je Zeile, Trennstrich nie am Zeilenanfang.
- **Gestapelte Spuren**: gemeinsame Zeitachse (eine Achse ganz unten), echte Werte
  aus `indChartSeries` — nie eine zweite Quelle. Achsenwerte kompakt (200K), linker
  Rand nach der längsten Beschriftung (am Handy war „200,000“ abgeschnitten).
- **Bezugslinien**: Zielband Inflation (`MK_ZIELBAND`, Mitte = `INFL_ZIEL`), 10-Jahres-Median
  bei Arbeitslosigkeit/Löhnen, 50 bei PMI, 0 bei „vs Target/vs Normal/Trend/Yield Gap“.
- **Überraschungs-Balken** = Actual − Forecast (Farbe `actualColor`), Actual = Forecast → kein Balken.
- **Nächster Termin**: Kalenderdatum (gestrichelt) oder `~Next` (gepunktet) + Forecast-Raute.
- **Keine Einstufungen** mehr. Gespeicherte aus 614–619 (`researchAnalysis[ccy][karte].tags/.hist`)
  bleiben unangetastet im Speicher (Sanitizer + `neueFelderBehalten`).
- **Speicher** über `snap` → Undo + Sync: `mkAnsicht`, `mkTab`, `rub.mkInds`, `rub.mkRange`.
  Alle vier stehen in `neueFelderBehalten()` (eine noch offene alte App lässt sie weg).
- **Nur Anzeige** — nichts davon ändert den Score.
