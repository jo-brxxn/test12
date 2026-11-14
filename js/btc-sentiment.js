// ── BTC SENTIMENT (Nutzer 2026-11-13) ─────────────────────────────────────
// Eigenes Vollbild-Fenster, geoeffnet ueber den Knopf "BTC Sentiment" in der
// Schnellzugriffszeile der BTC-Seite. Daten: btc_sentiment.json (Feed
// tools/btc-sentiment.mjs, erst beim Oeffnen geladen). Quellen + Urteile:
// docs/SOURCES.md.
//
// Entscheidungen (Nutzer 2026-11-14 "Mach alles so wie du es sagst"):
//  - KEINE Demo-Daten (Regel 4). Nutzbare Quellen echt angebunden; Quellen ohne
//    Historie zeigen echte Werte ab dem ersten Feed-Lauf ("Collecting since").
//  - Funding: Chart = Mittel ueber Binance/Deribit/Hyperliquid/OKX (je Tag die
//    vorhandenen); Backtest = NUR Binance (gleichbleibende Zusammensetzung seit 2020).
//  - Perzentil-Baender: 365 Tage rollierend, nur Daten VOR dem Tag (kein Look-ahead).
//  - Gesamt-Score: Perzentil-Mittel der Pflicht-Komponenten, die an einem Tag
//    Daten haben (mind. 2); Gewichte synchronisiert (bsGewichte, snap()).
//  - Eigene SVG-Charts (kein Chart-Paket, Stack bleibt).
//
// Andocken an das Score-System: btcSentimentScore() liefert den letzten Wert.
let H = null;
export function bsHelfer(h) { H = h; }

const TAG = 864e5;
const BTC_FARBE = '#E8A13A'; // dieselbe Farbe wie im Fear-&-Greed-Vollbild
const iso = t => new Date(t).toISOString().slice(0, 10);
const tOf = d => Date.parse(d + 'T00:00:00Z');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ROH = null, laden = null, D = null; // D = aufbereitete Reihen
const V = { von: 0, bis: 0, bereich: '1Y' };       // gemeinsames Zeitfenster aller Charts
const ANS = {};                                      // je Indikator: {btc, log, btOffen, bt:{...}}
let hoverT = null;

// ── Indikatoren ──────────────────────────────────────────────────────────
// hot: +1 = hoher Wert = heisses/euphorisches Sentiment (fuer den Score).
// ton: Farbe der Einordnung bei hohem/niedrigem Extrem (bull/bear).
const f2 = (v, n) => (v > 0 ? '+' : '') + v.toFixed(n);
const IND = [
  { k: 'etf', n: 'Spot ETF net flows', grp: 'core', einheit: 'USD m / day', art: 'bar', score: 1, quelle: 'bitbo (US spot ETFs)', stand: 'etf_bitbo', sammelt: 1,
    fmt: v => f2(v, 1) + 'm', hi: ['Strongest flows in 180 days', 'spot demand', 'bull'], lo: ['Weakest flows in 180 days', 'demand fading', 'bear'] },
  { k: 'funding', n: 'Funding rate', grp: 'core', einheit: '% per 8h', score: 1, quelle: 'Binance · Deribit · Hyperliquid · OKX (daily mean)', stand: 'funding_deribit', bt: 'fund_bn', btNote: 'Backtest uses Binance only (same venue since 2020)',
    fmt: v => v.toFixed(4) + '%', hi: ['Funding near a 180-day high', 'longs crowded', 'bear'], lo: ['Funding near a 180-day low', 'positioning washed out', 'bull'], ref: [0] },
  { k: 'oi_agg', n: 'Open interest · all venues', grp: 'core', einheit: 'USD bn', quelle: 'Binance · OKX · Deribit · Hyperliquid', stand: 'oi_deribit', sammelt: 1,
    fmt: v => '$' + v.toFixed(1) + 'bn', hi: ['Open interest near a 180-day high', 'liquidation risk', 'bear'], lo: ['Open interest near a 180-day low', 'leverage flushed', 'bull'] },
  { k: 'oi_bn', n: 'Open interest · Binance', grp: 'core', einheit: 'BTC', score: 1, quelle: 'Binance futures archive (USDT-M)', stand: 'oi_binance',
    fmt: v => Math.round(v).toLocaleString('en-US') + ' BTC', hi: ['Open interest near a 180-day high', 'liquidation risk', 'bear'], lo: ['Open interest near a 180-day low', 'leverage flushed', 'bull'] },
  { k: 'stable30', n: 'Stablecoin supply · 30-day change', grp: 'core', einheit: '%', score: 1, quelle: 'DefiLlama', stand: 'defillama',
    fmt: v => f2(v, 2) + '%', hi: ['Fastest supply growth in 180 days', 'fresh liquidity', 'bull'], lo: ['Slowest supply growth in 180 days', 'liquidity drying up', 'bear'], ref: [0] },
  { k: 'mvrv', n: 'MVRV', grp: 'core', einheit: 'ratio', score: 1, quelle: 'Coin Metrics Community', stand: 'coinmetrics',
    fmt: v => v.toFixed(2), hi: ['Holder profit near a 180-day high', 'overheated', 'bear'], lo: ['Holder profit near a 180-day low', 'value zone', 'bull'], ref: [1] },
  { k: 'sth_sopr', n: 'STH-SOPR', grp: 'core', einheit: 'ratio', score: 1, quelle: 'BGeometrics (free tier, ~7 days delayed)', stand: 'bgeo_sth_sopr',
    fmt: v => v.toFixed(3), hi: ['STH profit-taking near a 180-day high', 'local heat', 'bear'], lo: ['STH selling near a 180-day low', 'capitulation', 'bull'], ref: [1] },
  { k: 'sth_prem', n: 'Price vs short-term holder cost basis', grp: 'core', einheit: '%', score: 1, quelle: 'BGeometrics STH realized price', stand: 'bgeo_sth_rp',
    fmt: v => f2(v, 1) + '%', hi: ['Furthest above STH cost in 180 days', 'stretched', 'bear'], lo: ['Weakest vs. STH cost in 180 days', 'stress', 'bull'], ref: [0] },
  { k: 'cb_prem', n: 'Coinbase premium', grp: 'opt', einheit: '%', quelle: 'Coinbase BTC-USD vs Binance BTCUSDT (daily close)', stand: 'coinbase_premium',
    fmt: v => f2(v, 3) + '%', hi: ['Premium near a 180-day high', 'US demand', 'bull'], lo: ['Premium near a 180-day low', 'US selling', 'bear'], ref: [0] },
  { k: 'pc', n: 'Put/call ratio · open interest', grp: 'opt', einheit: 'ratio', quelle: 'Deribit (all expiries)', stand: 'optionen', sammelt: 1,
    fmt: v => v.toFixed(2), hi: ['Put share near a 180-day high', 'hedged, fearful', 'bull'], lo: ['Put share near a 180-day low', 'complacent', 'bear'] },
  { k: 'skew25', n: '25-delta skew · ~30 days', grp: 'opt', einheit: 'vol pts', quelle: 'Deribit (put IV − call IV)', stand: 'optionen', sammelt: 1,
    fmt: v => f2(v, 1), hi: ['Skew near a 180-day high', 'puts bid, fear', 'bull'], lo: ['Skew near a 180-day low', 'calls bid, greed', 'bear'], ref: [0] },
  { k: 'exnet7', n: 'Exchange net flow · 7-day sum', grp: 'opt', einheit: 'BTC', art: 'bar', quelle: 'Coin Metrics Community', stand: 'coinmetrics',
    fmt: v => f2(v / 1000, 1) + 'k BTC', hi: ['Most coins onto exchanges in 180 days', 'sell pressure', 'bear'], lo: ['Most coins leaving exchanges in 180 days', 'accumulation', 'bull'], ref: [0] },
  { k: 'liq', n: 'Liquidations · long / short', grp: 'opt', keine: 'No free source with daily history (CoinGlass needs a paid plan)' },
];
const SCORE_IND = IND.filter(i => i.score);

// ── Daten laden + aufbereiten ────────────────────────────────────────────
export function bsDaten() { return D; }
function holen() {
  if (ROH || laden) return laden;
  laden = fetch(H.DATA_BASE + 'btc_sentiment.json?t=' + Math.floor(Date.now() / 3e5), { signal: AbortSignal.timeout(H.FEED_TIMEOUT_MS), cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(j => { ROH = j; D = aufbereiten(j); })
    .catch(e => { ROH = { fehlerLaden: String(e.message || e) }; D = null; })
    .finally(() => { laden = null; if (offen()) zeichnen(); });
  return laden;
}
function reiheAus(r) { // {start,v} -> [[t,v],...]
  if (!r || !Array.isArray(r.v)) return [];
  const t0 = tOf(r.start), a = [];
  r.v.forEach((v, i) => { if (v != null && isFinite(v)) a.push([t0 + i * TAG, +v]); });
  return a;
}
export function aufbereiten(j) {
  const R = {}; Object.entries(j.reihen || {}).forEach(([k, r]) => { R[k] = reiheAus(r); });
  const mapOf = a => new Map(a.map(e => [e[0], e[1]]));
  const P = mapOf(R.price || []);
  const S = {};
  // Funding: Tagesmittel der vorhandenen Boersen
  const fm = new Map();
  ['fund_bn', 'fund_dr', 'fund_hl', 'fund_okx'].forEach(k => (R[k] || []).forEach(([t, v]) => { const x = fm.get(t) || [0, 0]; x[0] += v; x[1]++; fm.set(t, x); }));
  S.funding = [...fm.entries()].sort((a, b) => a[0] - b[0]).map(([t, x]) => [t, x[0] / x[1]]);
  S.fund_bn = R.fund_bn || [];
  // OI aller Boersen: nur Tage, an denen ALLE vier vorliegen (sonst Teilsumme)
  const om = ['oi_bn_usd', 'oi_okx_usd', 'oi_dr_usd', 'oi_hl_usd'].map(k => mapOf(R[k] || []));
  S.oi_agg = [...om[0].keys()].filter(t => om.every(m => m.has(t))).sort((a, b) => a - b).map(t => [t, om.reduce((s, m) => s + m.get(t), 0)]);
  S.oi_bn = R.oi_bn_btc || [];
  // Stablecoins: 30-Tage-Veraenderung in %
  const sm = mapOf(R.stable || []);
  S.stable30 = (R.stable || []).filter(([t]) => sm.has(t - 30 * TAG)).map(([t, v]) => [t, (v / sm.get(t - 30 * TAG) - 1) * 100]);
  S.mvrv = R.mvrv || [];
  S.sth_sopr = R.sth_sopr || [];
  S.sth_prem = (R.sth_rp || []).filter(([t, v]) => P.has(t) && v > 0).map(([t, v]) => [t, (P.get(t) / v - 1) * 100]);
  S.cb_prem = R.cb_prem || [];
  S.pc = R.pc_ratio || [];
  S.skew25 = R.skew25 || [];
  const ex = R.exnet || [], em = mapOf(ex);
  S.exnet7 = ex.filter(([t]) => [1, 2, 3, 4, 5, 6].every(i => em.has(t - i * TAG))).map(([t]) => [t, [0, 1, 2, 3, 4, 5, 6].reduce((s, i) => s + em.get(t - i * TAG), 0)]);
  // ETF: Summe je Tag (Spalte Total, sonst Summe der Fonds)
  S.etf = Object.entries(j.etf?.tage || {}).map(([d, z]) => [tOf(d), z.Total != null ? +z.Total : Object.values(z).reduce((s, v) => s + (+v || 0), 0)]).sort((a, b) => a[0] - b[0]);
  const extra = { stableTotal: R.stable || [], sthRp: R.sth_rp || [], oiAggBtc: S.oi_agg.filter(([t]) => P.has(t)).map(([t, v]) => [t, v * 1e9 / P.get(t)]) };
  const roll = {}; Object.keys(S).forEach(k => { roll[k] = rollPerz(S[k]); });
  return { S, R, P, price: R.price || [], roll, extra, stand: j.stand || {}, fehler: j.fehler || {}, updated: j.updated, etf: j.etf };
}

// Rollierendes Perzentil + 10/90-Band aus den 365 Tagen VOR dem Tag (kein Look-ahead).
export function rollPerz(a, fenster = 365, minN = 60) {
  const pct = new Array(a.length).fill(null), q10 = new Array(a.length).fill(null), q90 = new Array(a.length).fill(null);
  const s = []; let lo = 0;
  const ein = v => { let l = 0, r = s.length; while (l < r) { const m = (l + r) >> 1; if (s[m] < v) l = m + 1; else r = m; } s.splice(l, 0, v); };
  const aus = v => { let l = 0, r = s.length; while (l < r) { const m = (l + r) >> 1; if (s[m] < v) l = m + 1; else r = m; } if (s[l] === v) s.splice(l, 1); };
  for (let i = 0; i < a.length; i++) {
    while (lo < i && a[lo][0] < a[i][0] - fenster * TAG) { aus(a[lo][1]); lo++; }
    if (s.length >= minN) {
      const v = a[i][1]; let l = 0, r = s.length; while (l < r) { const m = (l + r) >> 1; if (s[m] < v) l = m + 1; else r = m; }
      let gl = l; while (gl < s.length && s[gl] === v) gl++;
      pct[i] = (l + (gl - l) / 2) / s.length * 100;
      q10[i] = s[Math.floor(0.1 * (s.length - 1))]; q90[i] = s[Math.ceil(0.9 * (s.length - 1))];
    }
    ein(a[i][1]);
  }
  return { pct, q10, q90 };
}
// Perzentil des letzten Werts gegen die 180 Tage davor (Kopfzeile).
function perz180(a) {
  if (a.length < 31) return null;
  const last = a[a.length - 1], vor = a.filter(e => e[0] < last[0] && e[0] >= last[0] - 180 * TAG).map(e => e[1]);
  if (vor.length < 30) return null;
  const u = vor.filter(v => v < last[1]).length, g = vor.filter(v => v === last[1]).length;
  return (u + g / 2) / vor.length * 100;
}

// ── Gesamt-Score ─────────────────────────────────────────────────────────
function gewichte() { const g = (H && H.gewichte && H.gewichte()) || {}; const o = {}; SCORE_IND.forEach(i => { o[i.k] = g[i.k] != null && isFinite(+g[i.k]) ? +g[i.k] : 1; }); return o; }
export function scoreReihe(DD = D, g = gewichte()) {
  if (!DD) return [];
  // Echte Daten 2026-11-14: STH-Werte kommen ~7 Tage verzoegert, Binance-Funding monatlich -
  // am letzten Tag lagen nur 2 von 7 Komponenten vor. Deshalb zaehlt je Komponente ihr
  // letztes Perzentil hoechstens 7 Tage weiter (kein Schaetzwert, der zuletzt gemeldete),
  // und ein Tag braucht mind. 3 Komponenten.
  const komp = SCORE_IND.filter(i => g[i.k] > 0).map(i => { const a = DD.S[i.k] || [], p = DD.roll[i.k].pct; return { w: g[i.k], a: a.map((e, j) => [e[0], p[j]]).filter(e => e[1] != null) }; }).filter(k => k.a.length);
  const tage = new Set(); komp.forEach(k => k.a.forEach(e => tage.add(e[0])));
  const out = [];
  [...tage].sort((x, y) => x - y).forEach(t => {
    let s = 0, w = 0, n = 0;
    komp.forEach(k => { const j = naechster(k.a, t); if (j >= 0 && t - k.a[j][0] <= 7 * TAG) { s += k.w * k.a[j][1]; w += k.w; n++; } });
    if (n >= 3) out.push([t, s / w, n]);
  });
  return out;
}
/** Fuer das bestehende Score-System: letzter Gesamtwert 0-100 (hoch = heiss/euphorisch). */
export function btcSentimentScore() {
  const s = scoreReihe(); if (!s.length) return null;
  const l = s[s.length - 1]; const g = gewichte();
  return { datum: iso(l[0]), wert: +l[1].toFixed(1), komponenten: l[2], gewichte: g };
}

// ── Backtest ─────────────────────────────────────────────────────────────
// Regel: Wert (oder rollierendes Perzentil, nur Daten VOR dem Tag) ueber/unter
// Schwelle. Nach einem Signal zaehlt fuer `abstand` Tage kein weiteres.
// Vergleich: alle Tage im selben Zeitraum (Basis).
const HOR = [7, 30, 90];
export function backtest(a, pct, P, cfg) {
  const preisBei = t => P.get(t);
  if (!a.length) return null;
  const von = a[0][0], bis = a[a.length - 1][0];
  const sig = []; let letzt = -Infinity;
  a.forEach(([t, v], i) => {
    const x = cfg.modus === 'pct' ? pct[i] : v; if (x == null) return;
    const an = cfg.seite === 'above' ? x > cfg.schwelle : x < cfg.schwelle;
    if (an && t - letzt >= cfg.abstand * TAG && preisBei(t)) { sig.push(t); letzt = t; }
  });
  const stat = ts => {
    const o = {};
    HOR.forEach(h => { const r = ts.map(t => { const p0 = preisBei(t), p1 = preisBei(t + h * TAG); return p0 && p1 ? (p1 / p0 - 1) * 100 : null; }).filter(x => x != null);
      o[h] = r.length ? { n: r.length, med: median(r), mit: r.reduce((s, x) => s + x, 0) / r.length, treffer: r.filter(x => x > 0).length / r.length * 100 } : null; });
    const dd = ts.map(t => { const p0 = preisBei(t); if (!p0 || !preisBei(t + 90 * TAG)) return null; let m = 0; for (let k = 1; k <= 90; k++) { const p = preisBei(t + k * TAG); if (p) m = Math.min(m, (p / p0 - 1) * 100); } return m; }).filter(x => x != null);
    o.dd = dd.length ? median(dd) : null;
    return o;
  };
  const alle = []; for (let t = von; t <= bis; t += TAG) if (preisBei(t)) alle.push(t);
  return { sig, von, bis, s: stat(sig), b: stat(alle), tage: alle.length };
}
function median(x) { const s = [...x].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

// ── Fenster ──────────────────────────────────────────────────────────────
function offen() { const m = document.querySelector('#mCardInfo .modal'); return !!(m && m.classList.contains('bs-voll') && document.querySelector('#mCardInfoBody .bs-wrap, #mCardInfoBody .bs-laedt')); }
export function bsAuf() {
  H.dashFensterGross(true);
  const m = document.querySelector('#mCardInfo .modal'); if (m) m.classList.add('bs-voll');
  const t = document.getElementById('mCardInfoTitle'); if (t) t.textContent = 'BTC Sentiment';
  const b = document.getElementById('mCardInfoBody'); if (b) b.innerHTML = '<div class="bs-laedt ab-nodata">Loading BTC sentiment data …</div>';
  H.openM('mCardInfo');
  if (D) zeichnen(); else holen();
}
function bereichSetzen(r) {
  V.bereich = r; const ende = datenEnde();
  const tage = { '30D': 30, '90D': 90, '1Y': 365, '3Y': 1095 }[r];
  V.bis = ende; V.von = tage ? ende - tage * TAG : datenAnfang();
}
function datenEnde() { let e = 0; Object.values(D.S).forEach(a => { if (a.length) e = Math.max(e, a[a.length - 1][0]); }); return e || tOf(iso(Date.now())); }
function datenAnfang() { return D.price.length ? D.price[0][0] : datenEnde() - 3650 * TAG; }

function zeichnen() {
  const b = document.getElementById('mCardInfoBody'); if (!b) return;
  if (!D) { b.innerHTML = `<div class="bs-wrap"><div class="ab-nodata bs-leer">No BTC sentiment data yet${ROH && ROH.fehlerLaden ? ' · <i>' + esc(ROH.fehlerLaden) + '</i>' : ''}. The hourly feed builds <b>btc_sentiment.json</b>.</div></div>`; return; }
  if (!V.bis) bereichSetzen(V.bereich);
  const leiste = `<div class="bs-leiste">
    <div class="ind-hist-range-bar">${['30D', '90D', '1Y', '3Y', 'Max'].map(r => `<button class="ind-hist-range-btn${V.bereich === r ? ' on' : ''}" data-bs="bereich" data-w="${r}">${r}</button>`).join('')}</div>
    <div class="bs-zoom"><button class="ind-hist-range-btn" data-bs="zoom" data-w="0.5" aria-label="Zoom in">+</button><button class="ind-hist-range-btn" data-bs="zoom" data-w="2" aria-label="Zoom out">−</button></div>
    <span class="bs-hinweis"><i>Drag to pan · pinch or Ctrl + wheel to zoom</i></span></div>`;
  const kern = IND.filter(i => i.grp === 'core').map(karteHtml).join('');
  const opt = IND.filter(i => i.grp === 'opt').map(karteHtml).join('');
  b.innerHTML = `<div class="bs-wrap">${leiste}
    <div class="bs-raster">${scoreKarteHtml()}</div>
    <div class="bs-gruppe">Core indicators</div><div class="bs-raster">${kern}</div>
    <div class="bs-gruppe">Optional indicators</div><div class="bs-raster">${opt}</div>
    <div class="bs-fuss"><span><b>Bands</b> 10th / 90th percentile of the prior 365 days</span><span><b>BTC</b> <span style="color:${BTC_FARBE}">■</span> same colour in every chart</span><span><i>Feed ${esc(fmtZeit(D.updated))}</i></span></div></div>`;
  const w = b.querySelector('.bs-wrap'); anbinden(w);
  chartsNeu();
}
function fmtZeit(s) { if (!s) return '–'; const d = new Date(s); return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function fmtTag(t) { return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }

function reiheVon(k) { return k === 'score' ? (D._score ||= scoreReihe()) : D.S[k] || []; }
function rollVon(k) { if (k === 'score') return (D._scoreRoll ||= rollPerz(reiheVon('score'))); return D.roll[k]; }
function ans(k) { return (ANS[k] ||= { btc: true, log: true, btOffen: false, bt: { seite: 'above', modus: 'pct', schwelle: 90, abstand: 14 } }); }

function kopfHtml(i, a) {
  if (!a.length) return `<div class="bs-kopf"><span class="bs-wert">–</span><span class="bs-ein"><i>no data yet</i></span></div>`;
  const l = a[a.length - 1], p = perz180(a);
  const ex = p == null ? null : p >= 90 ? i.hi : p <= 10 ? i.lo : null;
  const ein = ex ? `<b class="bs-${ex[2]}">${esc(ex[0])}</b> · <i>${esc(ex[1])}</i>` : p == null ? '<i>not enough history for a percentile</i>' : '<i>mid-range vs. last 180 days</i>';
  let zusatz = '';
  if (i.k === 'stable30' && D.extra.stableTotal.length) zusatz = ` · total <b>$${D.extra.stableTotal[D.extra.stableTotal.length - 1][1].toFixed(1)}bn</b>`;
  if (i.k === 'sth_prem' && D.extra.sthRp.length) zusatz = ` · STH cost <b>$${Math.round(D.extra.sthRp[D.extra.sthRp.length - 1][1]).toLocaleString('en-US')}</b>`;
  if (i.k === 'oi_agg' && D.extra.oiAggBtc.length) zusatz = ` · <b>${Math.round(D.extra.oiAggBtc[D.extra.oiAggBtc.length - 1][1]).toLocaleString('en-US')} BTC</b>`;
  const st = D.stand[i.stand];
  // bitbo: der neueste Tag ist oft unvollstaendig (Emittenten melden spaet; Feed 2026-11-14:
  // 11.11. fast nur Nullen). Der Feed ueberschreibt ihn in spaeteren Laeufen.
  const vorl = i.k === 'etf' && l[0] >= Date.now() - 4 * TAG ? ` · <b class="bs-bear">latest day preliminary</b> <i>issuers report late</i>` : '';
  return `<div class="bs-kopf"><span class="bs-wert">${esc(i.fmt(l[1]))}</span>${zusatz ? `<span class="bs-zus">${zusatz}</span>` : ''}
    <span class="bs-pz">180d percentile <b>${p == null ? '–' : Math.round(p)}</b></span></div>
    <div class="bs-ein">${ein}</div>
    <div class="bs-meta"><i>Data to ${esc(fmtTag(l[0]))} · updated ${esc(fmtZeit(st))} · ${esc(i.quelle)}</i>${vorl}${D.fehler[i.stand] ? ` · <b class="bs-bear">source issue</b> <i>${esc(D.fehler[i.stand])}</i>` : ''}</div>`;
}
function badges(i, a) {
  let s = '';
  if (i.sammelt && a.length && a[0][0] > Date.now() - 365 * TAG) s += `<span class="bs-badge">Collecting since ${esc(fmtTag(a[0][0]))} · ${a.length} day${a.length === 1 ? '' : 's'}</span>`;
  else if (i.sammelt && !a.length) s += `<span class="bs-badge">Collecting · first value within a day</span>`;
  return s;
}
function karteHtml(i) {
  if (i.keine) return `<div class="bs-karte bs-aus"><div class="bs-titel">${esc(i.n)}<span class="bs-badge bs-grau">No source</span></div><div class="bs-ein"><i>${esc(i.keine)}</i></div></div>`;
  const a = reiheVon(i.k), o = ans(i.k);
  return `<div class="bs-karte" data-k="${i.k}">
    <div class="bs-titel">${esc(i.n)} <span class="bs-einheit">${esc(i.einheit)}</span>${badges(i, a)}</div>
    ${kopfHtml(i, a)}
    ${chartLeiste(i.k, o)}
    <div class="bs-chart" data-k="${i.k}"></div>
    ${btHtml(i, o)}</div>`;
}
function chartLeiste(k, o) {
  return `<div class="bs-cl">
    <label class="mk-rsw"><span class="mk-rsw-l">vs BTC price</span><span class="tgl tgl-s"><input type="checkbox" data-bs="btc" data-k="${k}"${o.btc ? ' checked' : ''} aria-label="Overlay the BTC price"><span class="tgl-track"></span></span></label>
    <span class="ind-hist-range-bar${o.btc ? '' : ' bs-matt'}" title="Scale of the BTC price"><button class="ind-hist-range-btn${o.btc && !o.log ? ' on' : ''}" data-bs="log" data-k="${k}" data-w="0">Lin</button><button class="ind-hist-range-btn${o.btc && o.log ? ' on' : ''}" data-bs="log" data-k="${k}" data-w="1">Log</button></span>
    <button class="ind-hist-range-btn${o.btOffen ? ' on' : ''}" data-bs="btauf" data-k="${k}">Backtest</button>
    <span class="bs-read" data-k="${k}"></span></div>`;
}
function scoreKarteHtml() {
  const g = gewichte(), a = reiheVon('score'), o = ans('score');
  const l = a[a.length - 1], p = perz180(a);
  const zeilen = SCORE_IND.map(i => { const r = D.roll[i.k].pct, aa = D.S[i.k]; const pz = aa.length ? r[aa.length - 1] : null;
    return `<tr><td>${esc(i.n)}</td><td class="bs-num">${pz == null ? '–' : Math.round(pz)}</td><td><select data-bs="gewicht" data-k="${i.k}" aria-label="Weight for ${esc(i.n)}">${[0, 0.5, 1, 1.5, 2, 3].map(w => `<option value="${w}"${w === g[i.k] ? ' selected' : ''}>${w}×</option>`).join('')}</select></td></tr>`; }).join('');
  const sc = { k: 'score', n: 'Sentiment score', hi: ['Score near a 180-day high', 'euphoric', 'bear'], lo: ['Score near a 180-day low', 'fearful', 'bull'], fmt: v => v.toFixed(0), quelle: 'percentile average of the core indicators', stand: 'coinmetrics' };
  return `<div class="bs-karte bs-score" data-k="score">
    <div class="bs-titel">Sentiment score <span class="bs-einheit">0–100 · high = hot</span>${l ? `<span class="bs-badge">${l[2]} of ${SCORE_IND.length} components</span>` : ''}</div>
    ${kopfHtml(sc, a)}
    ${chartLeiste('score', o)}
    <div class="bs-chart" data-k="score"></div>
    ${btHtml({ k: 'score', n: 'Sentiment score' }, o)}
    <details class="bs-gew"${gewOffen ? ' open' : ''}><summary>Weights · current percentile per component</summary>
    <table class="bs-tab"><thead><tr><th>Component</th><th class="bs-num">Pct</th><th>Weight</th></tr></thead><tbody>${zeilen}</tbody></table>
    <div class="bs-ein"><i>Percentile vs. the prior 365 days · a component counts up to 7 days after its last value · at least 3 components per day</i></div></details></div>`;
}
function btHtml(i, o) {
  if (!o.btOffen) return '';
  const a = reiheVon(i.bt || i.k), p = i.bt ? rollPerz(a) : rollVon(i.k);
  const c = o.bt, r = backtest(a, p.pct, D.P, c);
  const zelle = x => x == null ? '<td>–</td><td>–</td><td>–</td>' : `<td class="bs-num ${x.med >= 0 ? 'bs-bull' : 'bs-bear'}">${f2(x.med, 1)}%</td><td class="bs-num">${f2(x.mit, 1)}%</td><td class="bs-num">${Math.round(x.treffer)}%</td>`;
  const tabelle = (titel, st) => `<table class="bs-tab"><thead><tr><th>${esc(titel)}</th><th class="bs-num">Median</th><th class="bs-num">Mean</th><th class="bs-num">Hit</th></tr></thead>
    <tbody>${HOR.map(h => `<tr><td>BTC +${h}d</td>${zelle(st[h])}</tr>`).join('')}<tr><td>Max DD 90d</td><td class="bs-num bs-bear">${st.dd == null ? '–' : st.dd.toFixed(1) + '%'}</td><td colspan="2"><i>median</i></td></tr></tbody></table>`;
  const form = `<div class="bs-btf">
    <select data-bs="bt" data-f="seite" data-k="${i.k}" aria-label="Rule side"><option value="above"${c.seite === 'above' ? ' selected' : ''}>above</option><option value="below"${c.seite === 'below' ? ' selected' : ''}>below</option></select>
    <input type="number" step="any" value="${c.schwelle}" data-bs="bt" data-f="schwelle" data-k="${i.k}" aria-label="Threshold">
    <select data-bs="bt" data-f="modus" data-k="${i.k}" aria-label="Threshold type"><option value="pct"${c.modus === 'pct' ? ' selected' : ''}>percentile</option><option value="value"${c.modus === 'value' ? ' selected' : ''}>value</option></select>
    <label>min gap <input type="number" min="1" step="1" value="${c.abstand}" data-bs="bt" data-f="abstand" data-k="${i.k}" aria-label="Minimum days between signals"> days</label></div>`;
  if (!r) return `<div class="bs-bt">${form}<div class="bs-ein"><i>No data to test.</i></div></div>`;
  const warn = r.sig.length < 20 ? `<div class="bs-warn"><b>${r.sig.length} signals</b> · fewer than 20, <i>not meaningful</i></div>` : '';
  return `<div class="bs-bt">${form}
    <div class="bs-meta"><i>Backtest window ${esc(fmtTag(r.von))} → ${esc(fmtTag(r.bis))} · ${r.tage.toLocaleString('en-US')} days with a BTC price${i.btNote ? ' · ' + esc(i.btNote) : ''}</i></div>
    ${warn}
    <div class="bs-btgrid">${tabelle('Signals (' + r.sig.length + ')', r.s)}${tabelle('All days', r.b)}</div>
    <div class="bs-ein"><i>Percentile = rank vs. the prior 365 days only (no look-ahead) · signals marked on the BTC line</i></div></div>`;
}

// ── Nur eine Karte neu (Nutzer 2026-11-14: "wenn ich einen Button druecke springt die
// Seite nach oben" / "wenn ich was aendere ist es auf einmal weg"). Gemessen vorher: jede
// Bedienung baute das ganze Fenster neu -> Backtest auf +217 px, Lin −502 px, 3Y auf 0,
// Gewichts-Liste klappte zu. Jetzt: nur die betroffene Karte, Scroll-Stand bleibt.
let gewOffen = false;
function karteNeu(k) {
  const alt = document.querySelector(`#mCardInfoBody .bs-karte[data-k="${k}"]`); if (!alt) return;
  const m = document.querySelector('#mCardInfo .modal'), st = m ? m.scrollTop : 0;
  const i = IND.find(x => x.k === k);
  const t = document.createElement('div'); t.innerHTML = k === 'score' ? scoreKarteHtml() : karteHtml(i);
  const neu = t.firstElementChild; alt.replaceWith(neu);
  const c = neu.querySelector('.bs-chart'); if (c) c.innerHTML = chartSvg(c.dataset.k, c);
  if (m) m.scrollTop = st;
  if (hoverT != null) fadenkreuz(hoverT);
}
function leisteAktiv() { document.querySelectorAll('#mCardInfoBody .bs-leiste [data-bs="bereich"]').forEach(b => b.classList.toggle('on', b.dataset.w === V.bereich)); }

// ── Charts ───────────────────────────────────────────────────────────────
function chartsNeu() {
  const m = document.querySelector('#mCardInfo .modal'), st = m ? m.scrollTop : 0;
  document.querySelectorAll('#mCardInfoBody .bs-chart').forEach(el => { el.innerHTML = chartSvg(el.dataset.k, el); });
  if (m) m.scrollTop = st;
  if (hoverT != null) fadenkreuz(hoverT);
}
let rafId = 0;
function chartsBald() { if (rafId) return; rafId = requestAnimationFrame(() => { rafId = 0; chartsNeu(); }); }
function signaleVon(k) {
  const o = ans(k); if (!o.btOffen) return [];
  const i = IND.find(x => x.k === k) || {}; const a = reiheVon(i.bt || k), p = i.bt ? rollPerz(a) : rollVon(k);
  const r = backtest(a, p.pct, D.P, o.bt); return r ? r.sig : [];
}
function chartSvg(k, el) {
  const i = IND.find(x => x.k === k) || { k, art: 'line', ref: [25, 75] };
  const a = reiheVon(k), rl = rollVon(k), o = ans(k);
  const W = Math.max(280, Math.round(el.clientWidth || 600)), Hh = window.innerWidth < 600 ? 170 : 200;
  const pl = 52, pr = o.btc ? 50 : 10, pt = 8, pb = 22, iw = W - pl - pr;
  const von = V.von, bis = Math.max(V.bis, V.von + TAG);
  const xOf = t => pl + (t - von) / (bis - von) * iw;
  const idx = []; a.forEach((e, j) => { if (e[0] >= von && e[0] <= bis) idx.push(j); });
  if (!idx.length) return `<div class="ab-nodata bs-leer">No data in this window${a.length ? ' · data from ' + esc(fmtTag(a[0][0])) : ''}.</div>`;
  let lo = Infinity, hi = -Infinity;
  idx.forEach(j => { const v = a[j][1]; lo = Math.min(lo, v); hi = Math.max(hi, v); if (rl.q10[j] != null) { lo = Math.min(lo, rl.q10[j]); hi = Math.max(hi, rl.q90[j]); } });
  if (i.art === 'bar' || (i.ref || []).includes(0)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (k === 'score') { lo = 0; hi = 100; }
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1; if (k !== 'score') { lo -= pad; hi += pad; }
  const yOf = v => pt + (1 - (v - lo) / (hi - lo)) * (Hh - pt - pb);
  let g = '';
  // Achse links
  achse(lo, hi, 4).forEach(v => { g += `<line x1="${pl}" x2="${W - pr}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}" stroke="var(--bd)" stroke-dasharray="2 4"/><text x="${pl - 5}" y="${(yOf(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--t3)">${esc(kurz(v))}</text>`; });
  (i.ref || []).forEach(v => { if (v > lo && v < hi) g += `<line x1="${pl}" x2="${W - pr}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}" stroke="var(--t3)" stroke-width="1"/>`; });
  // Perzentil-Band (10/90, rollierend)
  const bandIdx = idx.filter(j => rl.q10[j] != null);
  if (bandIdx.length > 1) {
    const ob = duenn(bandIdx, iw).map(j => `${xOf(a[j][0]).toFixed(1)} ${yOf(rl.q90[j]).toFixed(1)}`), ub = duenn(bandIdx, iw).reverse().map(j => `${xOf(a[j][0]).toFixed(1)} ${yOf(rl.q10[j]).toFixed(1)}`);
    g += `<path d="M${ob.join(' L')} L${ub.join(' L')} Z" fill="rgba(var(--blue-rgb),.08)" stroke="none"/>`;
    g += `<path d="M${ob.join(' L')}" fill="none" stroke="rgba(var(--blue-rgb),.45)" stroke-dasharray="3 3"/><path d="M${duenn(bandIdx, iw).map(j => `${xOf(a[j][0]).toFixed(1)} ${yOf(rl.q10[j]).toFixed(1)}`).join(' L')}" fill="none" stroke="rgba(var(--blue-rgb),.45)" stroke-dasharray="3 3"/>`;
  }
  // BTC-Preis (rechte Achse)
  let pm = null;
  if (o.btc) {
    const pr_ = D.price.filter(e => e[0] >= von && e[0] <= bis);
    if (pr_.length > 1) {
      let bl = Infinity, bh = -Infinity; pr_.forEach(e => { bl = Math.min(bl, e[1]); bh = Math.max(bh, e[1]); });
      const tb = v => o.log ? Math.log(v) : v; let ql = tb(bl), qh = tb(bh); const bp = (qh - ql) * 0.06 || 1; ql -= bp; qh += bp;
      const yB = v => pt + (1 - (tb(v) - ql) / (qh - ql)) * (Hh - pt - pb);
      const ticks = o.log ? [1, 10, 100, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5].filter(v => tb(v) >= ql && tb(v) <= qh) : achse(bl, bh, 4);
      (ticks.length > 5 ? ticks.filter((_, j) => j % 2 === 0) : ticks).forEach(v => { g += `<text x="${W - pr + 5}" y="${(yB(v) + 4).toFixed(1)}" font-size="11" fill="${BTC_FARBE}">${esc(kurz(v))}</text>`; });
      const pj = duenn(pr_.map((_, j) => j), iw);
      g += `<path d="M${pj.map(j => `${xOf(pr_[j][0]).toFixed(1)} ${yB(pr_[j][1]).toFixed(1)}`).join(' L')}" fill="none" stroke="${BTC_FARBE}" stroke-width="1.4" opacity=".85"/>`;
      pm = { yB };
      signaleVon(k).filter(t => t >= von && t <= bis && D.P.get(t)).forEach(t => { const x = xOf(t), y = yB(D.P.get(t)); g += `<path d="M${(x - 4).toFixed(1)} ${(y + 9).toFixed(1)} L${(x + 4).toFixed(1)} ${(y + 9).toFixed(1)} L${x.toFixed(1)} ${(y + 2).toFixed(1)} Z" fill="var(--t1)"/>`; });
    }
  }
  // Indikator
  if (i.art === 'bar') {
    const bw = Math.max(1, Math.min(8, iw / idx.length * 0.7)), y0 = yOf(0);
    duenn(idx, iw).forEach(j => { const v = a[j][1], x = xOf(a[j][0]), y = yOf(v); g += `<rect x="${(x - bw / 2).toFixed(1)}" y="${Math.min(y, y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(y0 - y)).toFixed(1)}" fill="${v >= 0 ? 'var(--green)' : 'var(--red)'}" opacity=".85"/>`; });
  } else {
    const dj = duenn(idx, iw); let d = '', last = null;
    dj.forEach(j => { const t = a[j][0]; d += (last != null && t - last > 5 * TAG ? 'M' : (d ? 'L' : 'M')) + xOf(t).toFixed(1) + ' ' + yOf(a[j][1]).toFixed(1) + ' '; last = t; });
    g += `<path d="${d}" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  // Zeitachse
  const n = W < 500 ? 3 : 5; for (let q = 0; q <= n; q++) { const t = von + (bis - von) * q / n; g += `<text x="${(pl + iw * q / n).toFixed(1)}" y="${Hh - 6}" text-anchor="${q === 0 ? 'start' : q === n ? 'end' : 'middle'}" font-size="11" fill="var(--t3)">${esc(fmtAchse(t, bis - von))}</text>`; }
  g += `<line class="bs-kreuz" x1="0" x2="0" y1="${pt}" y2="${Hh - pb}" stroke="var(--t2)" stroke-dasharray="3 3" style="display:none"/>`;
  el.__m = { a, xOf, von, bis, pl, iw, W, k, i, yOf, pm };
  return `<svg class="bs-svg" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="${esc((i.n || 'Sentiment score') + ' chart')}">${g}</svg><div class="bs-tip" style="display:none"></div>`;
}
// Hoechstens ~2 Punkte je Pixel (Min/Max je Spalte), damit 6000 Tage fluessig bleiben.
function duenn(idx, iw) {
  if (idx.length <= iw * 2) return idx;
  const s = idx.length / iw, o = []; for (let p = 0; p < iw; p++) { const a = Math.floor(p * s), b = Math.min(idx.length, Math.floor((p + 1) * s)); if (a < b) { o.push(idx[a]); if (b - 1 > a) o.push(idx[b - 1]); } }
  return o;
}
function achse(lo, hi, n) { const r = hi - lo; if (!(r > 0)) return [lo]; const st = Math.pow(10, Math.floor(Math.log10(r / n))); const m = [1, 2, 2.5, 5, 10].find(x => r / (st * x) <= n) * st; const o = []; for (let v = Math.ceil(lo / m) * m; v <= hi; v += m) o.push(+v.toFixed(10)); return o; }
function kurz(v) { const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k' : a >= 10 ? v.toFixed(0) : a >= 1 ? v.toFixed(1) : a === 0 ? '0' : v.toFixed(a >= 0.01 ? 2 : 4); }
function fmtAchse(t, span) { const d = new Date(t); return span > 400 * TAG ? d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); }

// ── Fadenkreuz (alle Charts gleichzeitig) + Tooltip ─────────────────────
function naechster(a, t) { let l = 0, r = a.length - 1, b = -1; while (l <= r) { const m = (l + r) >> 1; if (a[m][0] <= t) { b = m; l = m + 1; } else r = m - 1; } return b; }
function fadenkreuz(t, quelle) {
  document.querySelectorAll('#mCardInfoBody .bs-chart').forEach(el => {
    const m = el.__m, kr = el.querySelector('.bs-kreuz'), tip = el.querySelector('.bs-tip'), rd = document.querySelector(`#mCardInfoBody .bs-read[data-k="${el.dataset.k}"]`);
    if (!m || !kr) return;
    if (t == null) { kr.style.display = 'none'; if (tip) tip.style.display = 'none'; if (rd) rd.innerHTML = ''; return; }
    const j = naechster(m.a, t); const e = j >= 0 && t - m.a[j][0] < 7 * TAG ? m.a[j] : null;
    const x = m.xOf(t); kr.setAttribute('x1', x); kr.setAttribute('x2', x); kr.style.display = x >= m.pl && x <= m.pl + m.iw ? '' : 'none';
    const pj = naechster(D.price, t), p = pj >= 0 ? D.price[pj][1] : null;
    const txt = `<i>${esc(fmtTag(t))}</i> · <b>${e ? esc((m.i.fmt || (v => v.toFixed(0)))(e[1])) : '–'}</b>${p ? ` · <span style="color:${BTC_FARBE}">BTC <b>$${Math.round(p).toLocaleString('en-US')}</b></span>` : ''}`;
    if (rd) rd.innerHTML = txt;
    if (tip) { if (el === quelle) { tip.innerHTML = txt; tip.style.display = ''; const links = x / m.W * el.clientWidth; tip.style.left = Math.min(Math.max(4, links + 10), el.clientWidth - 190) + 'px'; } else tip.style.display = 'none'; }
  });
}

// ── Bedienung (Ereignis-Delegation; keine Inline-Handler) ───────────────
let zieh = null; const finger = new Map();
function anbinden(w) {
  w.addEventListener('click', ev => {
    const b = ev.target.closest('[data-bs]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
    const art = b.dataset.bs, k = b.dataset.k;
    if (art === 'bereich') { bereichSetzen(b.dataset.w); leisteAktiv(); chartsNeu(); }
    else if (art === 'zoom') zoom(+b.dataset.w, null);
    else if (art === 'log') { const o = ans(k); o.log = b.dataset.w === '1'; o.btc = true; karteNeu(k); }
    else if (art === 'btauf') { const o = ans(k); o.btOffen = !o.btOffen; if (o.btOffen) o.btc = true; karteNeu(k); }
  });
  w.addEventListener('change', ev => {
    const el = ev.target, art = el.dataset.bs, k = el.dataset.k; if (!art) return;
    if (art === 'btc') { ans(k).btc = el.checked; karteNeu(k); }
    else if (art === 'bt') { const c = ans(k).bt, f = el.dataset.f; c[f] = f === 'seite' || f === 'modus' ? el.value : (+el.value || 0); if (f === 'abstand') c.abstand = Math.max(1, Math.round(c.abstand)); karteNeu(k); }
    else if (art === 'gewicht') {
      const g = gewichte(); g[k] = +el.value;
      try { H.setGewichte(g); } catch (e) { H.meldung && H.meldung('Could not save the weights: ' + (e.message || e)); }
      D._score = null; D._scoreRoll = null; karteNeu('score');
    }
  });
  // <details> der Gewichte: offen/zu merken (toggle blubbert nicht -> capture)
  w.addEventListener('toggle', ev => { if (ev.target.classList && ev.target.classList.contains('bs-gew')) gewOffen = ev.target.open; }, true);
  w.addEventListener('pointermove', ev => {
    const el = ev.target.closest('.bs-chart'); if (finger.has(ev.pointerId)) finger.set(ev.pointerId, ev.clientX);
    if (finger.size === 2) { pinch(); return; }
    if (zieh && zieh.id === ev.pointerId) { const m = zieh.m, dx = ev.clientX - zieh.x; if (Math.abs(dx) > 4 || zieh.lauf) { zieh.lauf = true; const dt = -dx / (m.iw * zieh.sk) * zieh.span; verschieben(zieh.von + dt); } return; }
    if (!el || !el.__m) return;
    const m = el.__m, r = el.getBoundingClientRect(), x = (ev.clientX - r.left) * m.W / r.width;
    hoverT = m.von + (x - m.pl) / m.iw * (m.bis - m.von); fadenkreuz(hoverT, el);
  });
  w.addEventListener('pointerleave', () => { hoverT = null; fadenkreuz(null); });
  w.addEventListener('pointerdown', ev => {
    const el = ev.target.closest('.bs-chart'); if (!el || !el.__m) return;
    finger.set(ev.pointerId, ev.clientX);
    if (finger.size === 2) { const [a, b] = [...finger.values()]; zieh = null; pinchStart = { d: Math.abs(a - b), von: V.von, bis: V.bis, mitte: (a + b) / 2, el }; return; }
    const r = el.getBoundingClientRect();
    zieh = { id: ev.pointerId, x: ev.clientX, von: V.von, span: V.bis - V.von, m: el.__m, sk: r.width / el.__m.W, lauf: false };
  });
  const ende = ev => { finger.delete(ev.pointerId); if (finger.size < 2) pinchStart = null; if (zieh && zieh.id === ev.pointerId) zieh = null; };
  w.addEventListener('pointerup', ende); w.addEventListener('pointercancel', ende);
  w.addEventListener('wheel', ev => {
    if (!(ev.ctrlKey || ev.metaKey)) return; const el = ev.target.closest('.bs-chart'); if (!el || !el.__m) return;
    ev.preventDefault(); const m = el.__m, r = el.getBoundingClientRect(), x = (ev.clientX - r.left) * m.W / r.width;
    zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, m.von + (x - m.pl) / m.iw * (m.bis - m.von));
  }, { passive: false });
}
let pinchStart = null;
function pinch() {
  if (!pinchStart) return; const [a, b] = [...finger.values()]; const d = Math.abs(a - b); if (d < 10) return;
  const f = pinchStart.d / d, span = (pinchStart.bis - pinchStart.von) * f, m = pinchStart.el.__m, r = pinchStart.el.getBoundingClientRect();
  const tm = pinchStart.von + ((pinchStart.mitte - r.left) * m.W / r.width - m.pl) / m.iw * (pinchStart.bis - pinchStart.von);
  fenster(tm - (tm - pinchStart.von) * f, tm - (tm - pinchStart.von) * f + span);
}
function zoom(f, um) { const mitte = um != null ? um : (V.von + V.bis) / 2; fenster(mitte - (mitte - V.von) * f, mitte + (V.bis - mitte) * f); }
function verschieben(von) { const span = V.bis - V.von; fenster(von, von + span); }
function fenster(von, bis) {
  const min = datenAnfang(), max = datenEnde(); let span = Math.max(14 * TAG, Math.min(bis - von, max - min));
  von = Math.max(min, Math.min(von, max - span)); V.von = von; V.bis = von + span; V.bereich = '';
  document.querySelectorAll('#mCardInfoBody .bs-leiste [data-bs="bereich"]').forEach(b => b.classList.remove('on'));
  chartsBald();
}
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (offen() && D) chartsNeu(); }, 200); });
