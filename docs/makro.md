# Makro-Charts (seit 2026-10-20, Umbau 2026-10-21)

Referenziert von `CLAUDE.md`. Code: `js/makro.js`. Wächter: `check/makro.js` (I: Balken, Werte, Farbe, Forecast-Linie, kompakt), `check/altgeraet.js`.

## Auftrag

> 2026-10-20: „einen Schalter haben zum wechseln also wenn ich Wechsel soll da drei
> großer Chart auftauchen in denen ich dann alle Indikatoren rein machen kann“

> 2026-10-21: „die Switch Funktion ist noch ziemlich blöd und hat viele Schwächen …
> mach sie perfekt“

**Nutzerwahl 2026-10-21 (Rückfrage):** Schalter je Karte | Charts = eine Karte mit
Reitern, Klick auf eine Karte öffnet deren Reiter | *keine Einstufung* („das ist nur
zum analysieren“) | Zahlen je Spur, **„abgetrennt und übersichtlich — das hat Priorität“**.

## Regeln

- **EIN Kippschalter „Charts“ rechts in der MACRO-Zeile** (seit 2026-10-25, Nutzer:
  *„Verschieb bitte den umschalter table charts in die zeile wo macro steht ganz rechts
  ganz schmal einfach ein schalter“*): `makroReihenSchalterHtml` → `.mk-rsw` mit `.tgl.tgl-s`
  (28×16 px), schaltet alle drei Karten; öffnet den zuletzt gewählten Reiter (`mkTab`).
  ~~Schalter je Karte unter dem Kopf (`.mk-kz`) und im Kopf der Reiter-Karte~~ entfernt.
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
- **Balken wie in den Mini-Charts und auf Data** (Nutzer 2026-10-25: *„Ich will in dem Analyse
  Tool Balken … die Werte in der Farbe ob es ein Beat Miss oder neutral ist direkt über den Balken
  und halt die forecast Linie“*; Rückfrage: Balken *„so wie normal auch in den Mini Diagrammen und
  bei data“*): Release-Reihen als Säulen ab 0 (`--blue` .8, 56 % des Spaltenplatzes), Level-Reihen
  (eigene Einheit, > 24 Punkte) als Linie — dieselbe Weiche wie `indHistChart`.
- **Werte über jedem Balken, immer alle** (Nutzerwahl *„Immer alle, kleiner“*): Farbe = Beat |
  Miss | Neutral (`mkTon` = `actualColor`, Tokens `--bias-bull/-bear/-neu`), über Balken UND
  Forecast-Punkt. Schrift schrumpft auf den Spaltenplatz (bewusst unter 11 px); unter 7 px waagerecht
  steht der Wert senkrecht (bis 10 px). *Gemessen:* 3Y Laptop 11 px waagerecht, 10Y 8–10 px senkrecht,
  Handy 3Y 5 px. Hover/Titel zeigt jeden Wert mit Datum und Forecast.
- **Forecast = Linie + Punkte** in `--t1` (wie Mini-Chart), Lücke ohne Forecast.
- **Inflationsziel = waagerechte blaue gestrichelte Linie** (Nutzer 2026-10-21); bei Zielbändern
  (`MK_ZIELBAND`) auf der Mitte = `INFL_ZIEL`, das Band ganz blass blau dahinter. Beschriftung
  seit 2026-10-25 **im Spurkopf** (`.mk-ref`, blau) — im Chart stieß sie mit den Werten zusammen.
- **Andere Bezugslinien grau gestrichelt** (keine Ziele): 10-Jahres-Median bei Arbeitslosigkeit/Löhnen,
  50 bei PMI, 0 bei „vs Target/vs Normal/Trend/Yield Gap“; Beschriftung grau im Spurkopf.
- **Keine Surprise-Zeile, keine Hike/Cut-Striche** (beide 2026-10-25 entfernt).
- **Nächster Termin**: Kalenderdatum (gestrichelt) oder `~Next` (gepunktet) + Forecast-Raute;
  das Datum steht im Spurkopf (*Next*), nicht im Chart.
- **Kompakt** (Nutzer: *„mach das ganze kompakter das man mehr Charts sehen kann untereinander“*,
  Wahl ~115 px je Spur): Werteflaeche 46 px (Handy 40), Kopfraum nur für die Werte, bei senkrechten
  Werten gibt die Werteflaeche nach (min 34/30 px). *Gemessen 1440 px:* Spur 107–115 px (vorher
  194–203), Reiter-Karte 698 statt 1035 px; Handy 142–147 px (vorher 245–254), Statistik dort
  einzeilig zum Wischen.
- **Keine Einstufungen** mehr. Gespeicherte aus 614–619 (`researchAnalysis[ccy][karte].tags/.hist`)
  bleiben unangetastet im Speicher (Sanitizer + `neueFelderBehalten`).
- **Speicher** über `snap` → Undo + Sync: `mkAnsicht`, `mkTab`, `rub.mkInds`, `rub.mkRange`.
  Alle vier stehen in `neueFelderBehalten()` (eine noch offene alte App lässt sie weg).
- **Analyse-Werkzeuge (seit 622, Nutzer 2026-10-24: „richtiges Analyse Tool“)**, Zeile *Compare | Show* unter den Chips:
  - **Compare**: bis zu 3 Währungen; gleicher Indikator (gleiche Karte, gleicher Name) als farbige Linie (`--tf1..6`), Kopfzeile je Währung *Wert | Gap* (eigener − fremder, letzte Werte). Kein Gegenstück → Hinweis, nie ein Ersatzwert.
  - **Statistik je Spur**: 3M/6M/1Y-Veränderung (Vergleichspunkt höchstens 62 Tage vor dem Stichtag), 10y-Perzentil, z-Wert, 10y-Spanne, *beat · miss · in line* der letzten 12 Releases mit Forecast, Serie ab 2.
  - ~~Zinsentscheide~~ als Striche durch alle Spuren: **entfernt 2026-10-25** (Nutzer: *„entfern die Striche für Hikes und Cuts“*).
  - **Price**: Kurs (`preisReiheAnzeige`, Währung = Korb) als eigene Spur, *Last | Shown | 1Y*.
  - Speicher: `mkOpt` {cmp, preis} über `snap` + `neueFelderBehalten`.
- **Nur Anzeige** — nichts davon ändert den Score.
