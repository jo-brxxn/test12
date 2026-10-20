# Makro-Charts + Analyse-Einstufungen (seit 2026-10-20)

Referenziert von `CLAUDE.md`. Code: `js/makro.js`. Wächter: `check/makro.js`.

## Auftrag (Nutzer 2026-10-20)

> „Das Ziel ist es damit Makro Sentiment zu tracken und es übersichtlich
> darzustellen … nicht nur im Score actual vs forecast sondern auch ist
> Inflation über Target und den Trend … ich will das auch sehen können …
> einen Schalter … drei großer Chart … in denen ich dann alle Indikatoren
> rein machen kann … Beschreibungen … über Target / im Target / unterm Target“

**Nutzerwahl (Rückfrage):** gestapelte Spuren | App schlägt vor, du entscheidest |
Ziel-/Normal-Linien + Überraschungs-Balken + Einstufungs-Verlauf + nächster
Termin | alle Makro-Karten.

## Regeln

- **EIN Schalter** `Table | Charts` in der Reihen-Überschrift **Macro** der
  Asset-Seite, nicht je Karte. Im Charts-Modus nimmt jede Makro-Karte die
  **volle Zeile** (`.mk-col`). *Gemessen:* nebeneinander 344 px bei 1180 px.
- **Gestapelte Spuren**: gemeinsame Zeitachse, je Indikator eigene Spur und
  Achse, **echte Werte** aus `indChartSeries` (dieselbe Reihe wie der
  aufgeklappte Indikator) — nie eine zweite Quelle.
- **Bezugslinien**: Zielband Inflation (CPI/Core/PCE y/y, `MK_ZIELBAND`, Mitte =
  `INFL_ZIEL` des Scores), 10-Jahres-Median bei Arbeitslosigkeit/Löhnen, 50 bei
  PMI, 0 bei „vs Target/vs Normal/Trend/Yield Gap“.
- **Überraschungs-Balken** = Actual − Forecast, Farbe über `actualColor`
  (gleiche Richtung wie Tabelle/Kalender). Actual = Forecast → kein Balken.
- **Nächster Termin**: Kalenderdatum (gestrichelt) oder Erwartung `~Next`
  (gepunktet) + Forecast-Raute, falls bekannt.
- **Einstufungen** je Karte (`MK_DIMS`): Vorschlag nur aus echten Daten
  (`nivAlle`, Schwellen = kleinste Score-Stufe), sonst *no data*. Nutzerwahl
  Navy, Vorschlag gestrichelt umrandet, Abweichung „≠ data“.
- **Speicher**: Einstufung bei der **Währung** (`researchAnalysis[ccy][karte].tags`
  + `.hist`), Gold/Nasdaq teilen USD. Ansicht `mkAnsicht` im `snap`. Spuren
  `rub.mkInds`, Zeitraum `rub.mkRange`. Alles läuft über `snap` → Sync.
- **Nur Anzeige** — nichts davon ändert den Score.
