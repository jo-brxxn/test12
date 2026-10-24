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
- **Inflationsziel = waagerechte blaue gestrichelte Linie** (Nutzer 2026-10-21), Beschriftung blau;
  bei Zielbändern (`MK_ZIELBAND`) auf der Mitte = `INFL_ZIEL`, das Band ganz blass blau dahinter.
- **Andere Bezugslinien grau gestrichelt** (keine Ziele): 10-Jahres-Median bei Arbeitslosigkeit/Löhnen,
  50 bei PMI, 0 bei „vs Target/vs Normal/Trend/Yield Gap“.
- **Überraschungs-Balken** = Actual − Forecast (Farbe `actualColor`), Actual = Forecast → kein Balken.
- **Nächster Termin**: Kalenderdatum (gestrichelt) oder `~Next` (gepunktet) + Forecast-Raute.
- **Keine Einstufungen** mehr. Gespeicherte aus 614–619 (`researchAnalysis[ccy][karte].tags/.hist`)
  bleiben unangetastet im Speicher (Sanitizer + `neueFelderBehalten`).
- **Speicher** über `snap` → Undo + Sync: `mkAnsicht`, `mkTab`, `rub.mkInds`, `rub.mkRange`.
  Alle vier stehen in `neueFelderBehalten()` (eine noch offene alte App lässt sie weg).
- **Analyse-Werkzeuge (seit 622, Nutzer 2026-10-24: „richtiges Analyse Tool“)**, Zeile *Compare | Show* unter den Chips:
  - **Compare**: bis zu 3 Währungen; gleicher Indikator (gleiche Karte, gleicher Name) als farbige Linie (`--tf1..6`), Kopfzeile je Währung *Wert | Gap* (eigener − fremder, letzte Werte). Kein Gegenstück → Hinweis, nie ein Ersatzwert.
  - **Statistik je Spur**: 3M/6M/1Y-Veränderung (Vergleichspunkt höchstens 62 Tage vor dem Stichtag), 10y-Perzentil, z-Wert, 10y-Spanne, *beat · miss · in line* der letzten 12 Releases mit Forecast, Serie ab 2.
  - **Zinsentscheide**: jede Leitzinsänderung ≥ 5 bp (`nivReihe(nivEintrag(ccy,'Central Bank Rate'))`) als gestrichelte Linie durch alle Spuren, Erhöhung Bull-Farbe, Senkung Bear-Farbe, bp unter der Zeitachse.
  - **Price**: Kurs (`preisReiheAnzeige`, Währung = Korb) als eigene Spur, *Last | Shown | 1Y*.
  - Speicher: `mkOpt` {cmp, preis} über `snap` + `neueFelderBehalten`.
- **Nur Anzeige** — nichts davon ändert den Score.
