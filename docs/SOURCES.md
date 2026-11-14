# BTC Sentiment — Quellenprüfung (Phase 1, 2026-11-13)

**Geprüft auf dem GitHub-Runner** (dort läuft später auch der Feed), mit
`tools/btc-sonde.mjs` + `tools/btc-sonde2.mjs`, Workflow
`probe-btc-sentiment.yml`, Läufe 43512119197 und 43512357286. Die
Claude-Umgebung erreicht keinen der Hosts — alles hier ist Runner-Messung.

- **CORS** = Antwort-Header `Access-Control-Allow-Origin` bei Anfrage mit `Origin`.
  Für die App irrelevant, solange alles über den Feed läuft (Projektmuster).
- **Runner = US-Azure-IP.** Binance-API (451) und Bybit (403) sperren US-IPs.
- **ToS „n. verif.“** = Nutzungsbedingungen nicht maschinell lesbar abgerufen
  (404/JS-Seite). Vor dem Anbinden manuell lesen.
- **Historie** = tatsächlich zurückgelieferter erster/letzter Tag.

## Ergebnis-Tabelle

| # | Indikator | Quelle + Endpunkt | Erreichbar | Key / Kosten / Limit | Historie, Auflösung | CORS | ToS | Urteil |
|---|---|---|---|---|---|---|---|---|
| 1 | BTC-Preis | Coin Metrics Community `community-api.coinmetrics.io/v4/timeseries/asset-metrics?metrics=PriceUSD` | ja (200) | kein Key, frei, 6000 req/20 s | **2010-07-18** → gestern, täglich | `*` | n. verif. | **nutzbar** |
| 1 | BTC-Preis (Alternativen) | Coinbase `api.exchange.coinbase.com/products/BTC-USD/candles` · Binance `data-api.binance.vision/api/v3/klines` · Kraken OHLC | ja | kein Key | Coinbase 2015-07, Binance 2017-08, Kraken nur 720 Tage | `*` | n. verif. | nutzbar (Reserve) |
| 1 | BTC-Preis | CoinGecko `market_chart?days=max` | **nein (401)** | ohne Key nur 365 Tage | — | `*` | — | nicht nutzbar |
| 2 | ETF-Nettoflows | Farside `farside.co.uk/btc/` | **nein (403 Cloudflare)** | — | — | — | — | nicht nutzbar |
| 2 | ETF-Nettoflows | SoSoValue API | **nein (403)** | Key nötig (laut Anbieter frei mit Registrierung, n. verif.) | — | — | — | nicht nutzbar ohne Key |
| 2 | ETF-Nettoflows | CoinGlass API v4 | 401 „API key missing“ | **Key + Abo** | — | — | — | nicht nutzbar ohne Geld |
| 2 | ETF-Nettoflows | bitbo `bitbo.io/treasuries/etf-flows/` (HTML-Tabelle) | ja (200) | kein Key | **nur ~10 Handelstage** (Spalten: Date, IBIT, FBTC, GBTC, BTC, BITB, ARKB, HODL, MSBT, BRRR, EZBC, BTCO, BTCW, BITA, DEFI, Total), täglich | none | n. verif. (Terms 404) | **eingeschränkt** — Historie nur durch tägliches Mitschreiben ab Start |
| 3 | Funding | Binance-Archiv `data.binance.vision/.../monthly/fundingRate/BTCUSDT/` (ZIP/CSV) | ja (200) | kein Key | **2020-01** → Vormonat (8 h) | `*` | Binance-Datenarchiv, n. verif. | **nutzbar** |
| 3 | Funding | Deribit `public/get_funding_rate_history?instrument_name=BTC-PERPETUAL` | ja | kein Key | **2019-06**, stündlich | Origin gespiegelt | n. verif. | nutzbar |
| 3 | Funding | Hyperliquid `api.hyperliquid.xyz/info` (`fundingHistory`) | ja | kein Key | **2023-05**, stündlich | `*` | n. verif. | nutzbar |
| 3 | Funding | OKX `public/funding-rate-history` | ja | kein Key | **nur ~3 Monate** (ältere Abfrage leer) | Origin gespiegelt | n. verif. | eingeschränkt |
| 3 | Funding | Binance fapi · Bybit · CoinGlass | **nein** (451 / 403 Land / Key) | — | — | — | — | nicht nutzbar |
| 4 | Open Interest | Binance-Archiv `data.binance.vision/.../daily/metrics/BTCUSDT/` (ZIP/CSV, Spalten `sum_open_interest` = BTC, `sum_open_interest_value` = USD, dazu Long/Short-Ratios) | ja | kein Key | **2021-12-01**, 5 min (1 Datei/Tag, ~12 KB) | `*` | n. verif. | **eingeschränkt** — nur eine Börse mit Historie |
| 4 | Open Interest | OKX `rubik/stat/contracts/open-interest-history` | ja | kein Key | **nur ~100 Tage** | none | n. verif. | eingeschränkt |
| 4 | Open Interest | Deribit `get_book_summary_by_currency?kind=future` | ja | kein Key | **nur aktueller Stand** | Origin gespiegelt | n. verif. | eingeschränkt (Mitschreiben) |
| 4 | Open Interest | Binance fapi · Bybit · Coin Metrics Community | **nein** (451 / 403 / Metrik nicht frei) | — | — | — | — | nicht nutzbar |
| 5 | Stablecoin-Angebot | DefiLlama `stablecoins.llama.fi/stablecoincharts/all` | ja | kein Key, frei | **2017-11-29**, täglich (1,35 MB je Abruf) | `*` | n. verif. | **nutzbar** |
| 6 | MVRV | Coin Metrics Community `CapMVRVCur` | ja | kein Key | **2010-07-18**, täglich | `*` | n. verif. | **nutzbar** |
| 6 | STH-SOPR | BGeometrics `bitcoin-data.com/v1/sth-sopr` | ja | kein Key, **10 req/h, 15 req/Tag**, Werte ~7 Tage verzögert (`delayed`) | **2022-11-13** (älter: leer) | `*` | n. verif. | **eingeschränkt** |
| 6 | STH-Einstandskurs | BGeometrics `/v1/sth-realized-price` | ja | wie oben | **2022-11-13** | `*` | n. verif. | **eingeschränkt** |
| 6 | MVRV/SOPR/STH | Glassnode · CryptoQuant · Coin Metrics `SOPR`/`CapRealUSD` | **nein** (401/403) | Key + Abo | — | — | — | nicht nutzbar ohne Geld |
| 7 | Coinbase-Premium | Coinbase-Candles − Binance-Spot-Klines (beide oben) | ja | kein Key | **2017-08** (Binance-Start), täglich | `*` | n. verif. | **nutzbar** (nur Tagesschluss, kein Intraday) |
| 8 | Put/Call-Ratio | OKX `rubik/stat/option/open-interest-volume-ratio` | ja | kein Key | **nur 72 Tage** | none | n. verif. | eingeschränkt |
| 8 | Put/Call + 25-Δ-Skew | Deribit `get_book_summary_by_currency?kind=option` (978 Kontrakte, `open_interest`, `mark_iv`) + `public/ticker` (liefert Delta) | ja | kein Key | **nur aktueller Stand** | Origin gespiegelt | n. verif. | **eingeschränkt** — Historie nur durch Mitschreiben |
| 8 | (Bonus) DVOL | Deribit `get_volatility_index_data` | ja | kein Key | 2021 →, täglich (1000 je Seite) | Origin gespiegelt | n. verif. | nutzbar (nicht verlangt) |
| 9 | Börsen-Nettoflows | Coin Metrics Community `FlowInExNtv`, `FlowOutExNtv` (+ `SplyExNtv`) | ja | kein Key | **2011-04-24**, täglich; letzter Tag Status `flash` (vorläufig) | `*` | n. verif. | **nutzbar** |
| 9 | Börsen-Nettoflows | BGeometrics `exchange-netflow-btc` | 403 „Subscription required“ | Abo | — | — | — | nicht nutzbar |
| 10 | Liquidationen | OKX `public/liquidation-orders` | ja | kein Key | **nur letzte 100 Aufträge** | `*` | n. verif. | nicht nutzbar (keine Tageshistorie) |
| 10 | Liquidationen | Binance `allForceOrders` · Binance-Archiv `liquidationSnapshot` · CoinGlass | **nein** (451 / 404 / Key) | — | — | — | — | nicht nutzbar |

## Urteil je Indikator

| # | Indikator | Urteil | Backtest-Basis ab | Bemerkung |
|---|---|---|---|---|
| 1 | BTC-Preis | **nutzbar** | 2010-07 | Die App hat zusätzlich schon das 10-Jahres-Archiv (`price_hist.json`) |
| 2 | ETF-Flows | **eingeschränkt** | **Start des Mitschreibens** | Keine freie Quelle mit Historie seit Jan 2024 |
| 3 | Funding | **nutzbar** | 2020-01 | Aggregat: Binance + Deribit (+ Hyperliquid ab 2023-05), OI-gewichtet; Bybit/OKX fehlen in der Historie |
| 4 | Open Interest | **eingeschränkt** | 2021-12 (nur Binance) | Aggregat aller Börsen erst ab Mitschreiben |
| 5 | Stablecoins | **nutzbar** | 2017-11 | 30T-Veränderung selbst berechnet |
| 6 | MVRV | **nutzbar** | 2010-07 | |
| 6 | STH-SOPR / STH-Einstandskurs | **eingeschränkt** | 2022-11 | ~4 Jahre, 7 Tage Verzug, 15 Abrufe/Tag |
| 7 | Coinbase-Premium | **nutzbar** | 2017-08 | Tagesschluss-Differenz |
| 8 | Put/Call, 25-Δ-Skew | **eingeschränkt** | Start des Mitschreibens | Skew selbst aus Deribit-Delta/IV |
| 9 | Börsen-Nettoflows | **nutzbar** | 2011-04 | |
| 10 | Liquidationen | **nicht nutzbar** | — | Nur mit CoinGlass-Abo |

## Was Geld oder einen Key bräuchte

- **CoinGlass** (ETF-Flows, aggregiertes Funding/OI aller Börsen, Liquidationen) — Key + Abo.
- **Glassnode / CryptoQuant** (STH-Kennzahlen mit voller Historie, Exchange-Flows) — Key + Abo.
- **SoSoValue** (ETF-Flows mit Historie seit 2024-01) — Key, laut Anbieter kostenlos (nicht verifiziert).
- **BGeometrics** (STH-Historie vor 2022-11, ohne Verzug) — Abo.

## Umsetzung (Phase 2, 2026-11-14, VERSION-CHECK-723)

- **Feed**: `tools/btc-sentiment.mjs` im stuendlichen Workflow → `btc_sentiment.json` (~222 KB, nur beim Oeffnen geladen, eigener Deckel 900 KB, nicht in der Startsumme).
- **Inkrementell**: alte Datei wird ergaenzt; Quellen ohne Historie wachsen ab dem ersten Lauf. BGeometrics hoechstens 1 Abruf je Reihe und Tag (Limit 15/Tag). Jede Quelle 90 s Zeitfenster.
- **Gemessen im Pruefmodus** (Lauf 2026-11-14, Runner): alle 15 Schritte ohne Fehler; Binance-OI-Backfill 1809 Tage in 60 s; Funding Binance bis Vormonatsende (Monatsarchiv).
- **Keine Demo-Daten** (Regel 4). Statt Platzhaltern: echte Werte, bei fehlender Historie Badge *Collecting since*.
- **Offen**: Einheit der bitbo-Tabelle (Mio. USD angenommen, im Feed-Log `etf bitbo Einheit:` pruefen); Nutzungsbedingungen aller Quellen manuell lesen.
