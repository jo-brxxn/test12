# Neues Asset hinzufuegen — Pflicht-Checkliste

**Nutzer-Regel 2026-11-16 (Dauerregel):** *„immer, wenn ich sage, du sollst etwas hinzufuegen, dass du immer automatisch gucken sollst fuer Seasonality-Daten und Retail und die ganzen anderen Sachen und das dann direkt automatisch anbindest. Und du sollst auch immer ein eigenes Symbol dafuer hinzufuegen. Wenn ich was vergessen habe, dann mach das selber. Also dass das dann in der Setups-Page ist … auch die Events dazu im Kalender.“*

Ohne Rueckfrage, ohne dass der Nutzer es aufzaehlt. Erst **Quellen auf dem Runner messen** (Sonde wie `tools/rohstoff-sonde.mjs`), dann anbinden, was es gibt — was es nicht gibt, offen sagen (nie schaetzen, Regel 4).

| Bereich | Wo | Vorbild |
|---|---|---|
| Asset + Texte (genBull/genBear, Klasseninfo) | `js/main.js` DEF, Info-Block (`SILVER:{extra:…}`) | SILVER, OIL |
| Kategorie / Seitenleiste | `SB_CATS`, `ASSET_CLASS`, `NONFX_IDS` | |
| Score-Regeln | `MACRO_DERIVE_RULES` bzw. `ROH_VORLAGE` (Zahnrad-Regeln der Vorlage), `SENT_MAP`, asset-eigene Zeilen `ASSET_EIGENE_IND` + `ASSET_EIGEN_HALB` | OIL Oil Inventories |
| `SCORE_MODEL_VERSION` + `JR_MODELL_NOTIZ` | `js/score.js`, `js/journal.js` | |
| Symbol klein (farbig + einfarbig) | `js/constants.js` AI_SYMBOLS / `js/marken-icons.js`, `AI_GLYPHS` in main.js | |
| Kopfbild | `ASSET_MOTIVE` + `MOTIV_JE_ASSET` (wenn das Klassen-Motiv nicht passt) | |
| Kurse live / 3J / 4h-Trend / (10J) | Workflow: TradingView-Ticker + MAP + SRC, Yahoo-MAPS (3 Stellen) | |
| Saisonalitaet | Workflow `PROXY` (Yahoo-Monatskurse) + Pflichtliste, `SEAS_ORDER` | |
| COT | Workflow `MARKETS` (Code + Name), `COT_SYMS`, `COT_NAME`, Matcher-Liste in main.js | |
| Retail | Myfxbook-Symbolliste (Sonde), `SENT_NONFX_PRICE_ID`, Workflow `NONFX` | |
| Put/Call | Workflow `PROXY` der Optionsketten (2 Stellen) | |
| Kalender / News | `js/event-matchers.js`, Workflow TV-ECONOMICS-RULES (+ `HIST_REGELN`), News-Aliasse, `js/calendar.js` Aliasse, `LOWER_IS_BETTER_RE` | |
| Set-ups / Watchlist / Trends | `PAIR_CODE_TO_ID` + 3× `codeToId`, `ALL_PAIRS`, `trendAssets()`, `TREND_COLORS` | |
| Eingabe-Aliasse | `js/quickcapture.js`, `js/trades.js` TJ_ALIAS | |
| Feed-Groesse | `check/feedgroesse.js` (bewusst anheben, begruenden) | |
| Waechter | betroffene `check/*` (z. B. mpcoel, scorenachrechnung) mitziehen | |
