// ── BTC SENTIMENT FEED (btc_sentiment.json) ─────────────────────────────
// Nutzer 2026-11-13: neues Modul "BTC Sentiment". Quellen geprueft und
// bewertet in docs/SOURCES.md (Laeufe 43512119197 / 43512357286). Hier NUR
// Quellen mit Urteil "nutzbar" oder "eingeschraenkt"; keine Keys, kein Geld.
//
// Ausgabe (kompakt, nur beim Oeffnen des Fensters geladen):
//   { updated, reihen:{ key:{ start:'YYYY-MM-DD', v:[Tageswerte, null = Luecke] } },
//     etf:{ fonds:[...], tage:{ 'YYYY-MM-DD':{ IBIT:..., ..., Total:... } } },
//     stand:{ key:'letzter Abruf (ISO)' }, fehler:{ key:'Meldung' } }
//
// INKREMENTELL: die alte Datei wird gelesen und nur ergaenzt. Reihen, deren
// Quelle keine Historie hat (ETF-Flows, Optionen, OI ausserhalb Binance),
// wachsen so ab dem ersten Lauf Tag fuer Tag ("collecting since").
// Scheitert eine Quelle, bleibt ihr alter Stand + Eintrag in "fehler".
//
// --pruefen : alles abrufen, Zusammenfassung ausgeben, NICHTS schreiben.
import fs from 'node:fs';
import zlib from 'node:zlib';

const DATEI = 'btc_sentiment.json';
const PRUEFEN = process.argv.includes('--pruefen');
const UA = { 'User-Agent': 'FXAnalystPro research tool', Accept: 'application/json,text/html,*/*' };
const TAG = 864e5;
const iso = t => new Date(t).toISOString().slice(0, 10);
const heute = iso(Date.now());
const STOPP = Date.now() + 8 * 60e3; // Gesamtbudget, Rest im naechsten Lauf
const log = (...a) => console.log('[btc]', ...a);

const alt = (() => { try { return JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch { return {}; } })();
const reihen = {};   // key -> Map(datum -> wert)
for (const [k, r] of Object.entries(alt.reihen || {})) {
  const m = new Map(); const t0 = Date.parse(r.start + 'T00:00:00Z');
  (r.v || []).forEach((v, i) => { if (v != null) m.set(iso(t0 + i * TAG), v); });
  reihen[k] = m;
}
const etf = { fonds: alt.etf?.fonds || [], tage: alt.etf?.tage || {} };
const stand = { ...(alt.stand || {}) };
const fehler = {};
const reihe = k => (reihen[k] ||= new Map());
const setze = (k, d, v, st = 4) => { if (v == null || !isFinite(v)) return; reihe(k).set(d, +(+v).toFixed(st)); };

async function holen(url, opt = {}, art = 'json') {
  const r = await fetch(url, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(opt.frist || 30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.split('?')[0]);
  return art === 'json' ? r.json() : art === 'buf' ? Buffer.from(await r.arrayBuffer()) : r.text();
}
// Erste Datei eines ZIP (Binance-Archiv: genau eine CSV je ZIP).
function zipCsv(b) {
  const n = b.readUInt16LE(26), x = b.readUInt16LE(28), meth = b.readUInt16LE(8);
  const roh = b.subarray(30 + n + x);
  return (meth === 0 ? roh.subarray(0, b.readUInt32LE(18)) : zlib.inflateRawSync(roh)).toString();
}
async function schritt(name, fn) {
  if (Date.now() > STOPP) { fehler[name] = 'time budget used up, next run'; log(name, 'uebersprungen (Zeit)'); return; }
  try { await fn(); stand[name] = new Date().toISOString(); }
  catch (e) { fehler[name] = String(e.message || e).slice(0, 160); log(name, 'FEHLER', fehler[name]); }
}
async function parallel(liste, n, fn) {
  let i = 0; const arb = async () => { while (i < liste.length && Date.now() < STOPP) { const x = liste[i++]; await fn(x); } };
  await Promise.all(Array.from({ length: n }, arb));
}
const letzter = k => { const m = reihen[k]; if (!m || !m.size) return null; let b = null; for (const d of m.keys()) if (!b || d > b) b = d; return b; };

// 1 / 6 / 9 — Coin Metrics Community: Preis, MVRV, Boersenfluesse (frei, ohne Key)
await schritt('coinmetrics', async () => {
  const u = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&frequency=1d&page_size=10000&start_time=2010-01-01&metrics=';
  for (const [metr, f] of [['PriceUSD', z => setze('price', z.d, +z.PriceUSD, +z.PriceUSD >= 100 ? 0 : 2)],
    ['CapMVRVCur', z => setze('mvrv', z.d, +z.CapMVRVCur, 3)],
    ['FlowInExNtv,FlowOutExNtv', z => setze('exnet', z.d, +z.FlowInExNtv - +z.FlowOutExNtv, 0)]]) {
    let url = u + metr, n = 0;
    while (url) { const j = await holen(url); (j.data || []).forEach(z => { z.d = z.time.slice(0, 10); f(z); n++; }); url = j.next_page_url || null; }
    log('coinmetrics', metr, n);
  }
});

// 5 — DefiLlama: Stablecoin-Angebot gesamt (USD, in Mrd.)
await schritt('defillama', async () => {
  const j = await holen('https://stablecoins.llama.fi/stablecoincharts/all');
  j.forEach(z => setze('stable', iso(+z.date * 1000), (z.totalCirculatingUSD?.peggedUSD || 0) / 1e9, 2));
  log('defillama', j.length);
});

// 3 — Funding (in % je 8 h, Tagesmittel). Binance-Archiv (Monats-ZIPs), Deribit, Hyperliquid, OKX.
await schritt('funding_binance', async () => {
  const bis = letzter('fund_bn');
  const monate = [];
  for (let d = new Date(Date.UTC(2020, 0, 1)); d < Date.now(); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const m = d.toISOString().slice(0, 7);
    if (bis && m < bis.slice(0, 7)) continue; // vollstaendige Monate nicht erneut
    monate.push(m);
  }
  const tag = {};
  await parallel(monate, 6, async m => {
    let csv; try { csv = zipCsv(await holen(`https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-${m}.zip`, {}, 'buf')); } catch { return; }
    const z = csv.trim().split('\n'); const kopf = z[0].split(',');
    const it = kopf.findIndex(k => /time/i.test(k)), ir = kopf.findIndex(k => /funding_rate/i.test(k));
    z.slice(1).forEach(l => { const s = l.split(','); const d = iso(+s[it]); (tag[d] ||= []).push(+s[ir]); });
  });
  Object.entries(tag).forEach(([d, a]) => setze('fund_bn', d, a.reduce((x, y) => x + y, 0) / a.length * 100, 4));
  log('funding binance Monate', monate.length, 'Tage', Object.keys(tag).length);
});
await schritt('funding_deribit', async () => {
  let ab = Date.parse((letzter('fund_dr') || '2019-05-01') + 'T00:00:00Z') - 2 * TAG;
  const tag = {};
  while (ab < Date.now() && Date.now() < STOPP) {
    const bis = Math.min(ab + 20 * TAG, Date.now());
    const j = await holen(`https://www.deribit.com/api/v2/public/get_funding_rate_history?instrument_name=BTC-PERPETUAL&start_timestamp=${ab}&end_timestamp=${bis}`);
    (j.result || []).forEach(z => { (tag[iso(z.timestamp)] ||= []).push(z.interest_8h); });
    ab = bis;
  }
  Object.entries(tag).forEach(([d, a]) => setze('fund_dr', d, a.reduce((x, y) => x + y, 0) / a.length * 100, 4));
  log('funding deribit Tage', Object.keys(tag).length);
});
await schritt('funding_hyperliquid', async () => {
  let ab = Date.parse((letzter('fund_hl') || '2023-05-01') + 'T00:00:00Z') - 2 * TAG;
  const tag = {};
  while (ab < Date.now() && Date.now() < STOPP) {
    const j = await holen('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'fundingHistory', coin: 'BTC', startTime: ab }) });
    if (!j.length) break;
    j.forEach(z => { (tag[iso(z.time)] ||= []).push(+z.fundingRate * 8); }); // stuendlich -> je 8 h
    const neu = j[j.length - 1].time + 1; if (neu <= ab) break; ab = neu;
    if (j.length < 500) break;
  }
  Object.entries(tag).forEach(([d, a]) => setze('fund_hl', d, a.reduce((x, y) => x + y, 0) / a.length * 100, 4));
  log('funding hyperliquid Tage', Object.keys(tag).length);
});
await schritt('funding_okx', async () => {
  const tag = {}; let nach = '';
  for (let i = 0; i < 4; i++) {
    const j = await holen('https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=100' + nach);
    const a = j.data || []; if (!a.length) break;
    a.forEach(z => { (tag[iso(+z.fundingTime)] ||= []).push(+z.realizedRate || +z.fundingRate); });
    nach = '&after=' + a[a.length - 1].fundingTime;
  }
  Object.entries(tag).forEach(([d, a]) => setze('fund_okx', d, a.reduce((x, y) => x + y, 0) / a.length * 100, 4));
  log('funding okx Tage', Object.keys(tag).length);
});

// 4 — Open Interest. Binance-Archiv (Tagesdateien seit 2021-12-01, letzter 5-min-Wert des Tages),
// OKX (100 Tage), Deribit + Hyperliquid (nur Momentaufnahme -> je Tag mitgeschrieben).
await schritt('oi_binance', async () => {
  const bis = letzter('oi_bn_usd');
  const tage = [];
  for (let t = Date.parse((bis ? iso(Date.parse(bis) + TAG) : '2021-12-01') + 'T00:00:00Z'); t < Date.now() - TAG / 2; t += TAG) tage.push(iso(t));
  let n = 0;
  await parallel(tage, 12, async d => {
    let csv; try { csv = zipCsv(await holen(`https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-${d}.zip`, { frist: 20000 }, 'buf')); } catch { return; }
    const z = csv.trim().split('\n'); const kopf = z[0].split(',');
    const l = z[z.length - 1].split(',');
    setze('oi_bn_btc', d, +l[kopf.indexOf('sum_open_interest')], 0);
    setze('oi_bn_usd', d, +l[kopf.indexOf('sum_open_interest_value')] / 1e9, 3);
    n++;
  });
  log('oi binance Tage offen', tage.length, 'geholt', n);
});
await schritt('oi_okx', async () => {
  const tag = {};
  for (const inst of ['BTC-USDT-SWAP', 'BTC-USD-SWAP']) {
    const j = await holen(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${inst}&period=1D&limit=100`);
    (j.data || []).forEach(z => { const d = iso(+z[0]); tag[d] = (tag[d] || 0) + +z[3]; });
  }
  Object.entries(tag).forEach(([d, v]) => setze('oi_okx_usd', d, v / 1e9, 3));
  log('oi okx Tage', Object.keys(tag).length);
});
await schritt('oi_deribit', async () => {
  const j = await holen('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=future');
  const usd = (j.result || []).reduce((s, z) => s + (+z.open_interest || 0), 0); // inverse Kontrakte: OI in USD
  setze('oi_dr_usd', heute, usd / 1e9, 3);
  log('oi deribit Mrd USD', (usd / 1e9).toFixed(2));
});
await schritt('oi_hyperliquid', async () => {
  const [meta, ctx] = await holen('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"type":"metaAndAssetCtxs"}' });
  const i = meta.universe.findIndex(u => u.name === 'BTC'); const c = ctx[i];
  setze('oi_hl_usd', heute, +c.openInterest * +c.markPx / 1e9, 3);
  log('oi hyperliquid Mrd USD', (+c.openInterest * +c.markPx / 1e9).toFixed(2));
});

// 6 — BGeometrics (frei: 10 Abrufe/h, 15/Tag) -> hoechstens EIN Abruf je Reihe und Tag.
for (const [key, pfad] of [['sth_sopr', 'sth-sopr'], ['sth_rp', 'sth-realized-price']]) {
  if ((stand['bgeo_' + key] || '').slice(0, 10) === heute) continue;
  await schritt('bgeo_' + key, async () => {
    const j = await holen('https://bitcoin-data.com/v1/' + pfad);
    if (!Array.isArray(j)) throw new Error('kein Array: ' + JSON.stringify(j).slice(0, 80));
    j.forEach(z => { const f = Object.keys(z).find(k => !['d', 'unixTs', 'delayed', 'message'].includes(k) && isFinite(+z[k])); if (f) setze(key, z.d, +z[f], key === 'sth_rp' ? 0 : 4); });
    log('bgeometrics', key, j.length, 'letzter', j[j.length - 1]?.d);
  });
}

// 7 — Coinbase-Premium = (Coinbase BTC-USD − Binance BTCUSDT) / Binance, Tagesschluss, in %.
await schritt('coinbase_premium', async () => {
  const ab = Date.parse((letzter('cb_prem') ? iso(Date.parse(letzter('cb_prem')) - 30 * TAG) : '2017-08-17') + 'T00:00:00Z');
  const bn = {}, cb = {};
  for (let t = ab; t < Date.now(); t += 1000 * TAG) {
    const j = await holen(`https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=1000&startTime=${t}`);
    j.forEach(k => { bn[iso(k[0])] = +k[4]; });
  }
  for (let t = ab; t < Date.now(); t += 300 * TAG) {
    const e = Math.min(t + 299 * TAG, Date.now());
    const j = await holen(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start=${new Date(t).toISOString()}&end=${new Date(e).toISOString()}`);
    j.forEach(k => { cb[iso(k[0] * 1000)] = +k[4]; });
    await new Promise(r => setTimeout(r, 350)); // Coinbase: oeffentlich ~3 Abrufe/s
  }
  let n = 0;
  Object.keys(cb).forEach(d => { if (bn[d] && d < heute) { setze('cb_prem', d, (cb[d] - bn[d]) / bn[d] * 100, 3); n++; } });
  log('coinbase premium Tage', n);
});

// 8 — Optionen (Deribit, nur Momentaufnahme -> je Tag mitgeschrieben):
// Put/Call = Open Interest Puts / Calls (alle Laufzeiten).
// 25-Delta-Skew = IV(25-Delta-Put) − IV(25-Delta-Call) der Laufzeit, die 30 Tagen am naechsten liegt
// (Delta aus Black-Scholes mit Deribits mark_iv, Basis = Terminkurs der Laufzeit, r = 0).
const N = x => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
await schritt('optionen', async () => {
  const j = await holen('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option');
  const a = (j.result || []).map(z => { const [, ex, k, cp] = z.instrument_name.split('-'); return { ...z, ex, k: +k, cp }; });
  const oiP = a.filter(z => z.cp === 'P').reduce((s, z) => s + z.open_interest, 0), oiC = a.filter(z => z.cp === 'C').reduce((s, z) => s + z.open_interest, 0);
  if (oiC > 0) setze('pc_ratio', heute, oiP / oiC, 3);
  const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const ablauf = s => { const m = s.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/); return m ? Date.UTC(2000 + +m[3], MON[m[2]], +m[1], 8) : NaN; };
  const exs = [...new Set(a.map(z => z.ex))].map(ex => ({ ex, t: (ablauf(ex) - Date.now()) / (365 * TAG) })).filter(e => e.t > 7 / 365);
  exs.sort((x, y) => Math.abs(x.t - 30 / 365) - Math.abs(y.t - 30 / 365));
  const e = exs[0]; if (!e) throw new Error('keine Laufzeit');
  const pts = a.filter(z => z.ex === e.ex && z.mark_iv > 0 && z.underlying_price > 0).map(z => {
    const s = z.mark_iv / 100, F = z.underlying_price, d1 = (Math.log(F / z.k) + s * s * e.t / 2) / (s * Math.sqrt(e.t));
    return { cp: z.cp, delta: z.cp === 'C' ? N(d1) : N(d1) - 1, iv: z.mark_iv };
  });
  const ivBei = (cp, ziel) => { const l = pts.filter(p => p.cp === cp).sort((x, y) => x.delta - y.delta);
    for (let i = 1; i < l.length; i++) if ((l[i - 1].delta - ziel) * (l[i].delta - ziel) <= 0) { const w = (ziel - l[i - 1].delta) / (l[i].delta - l[i - 1].delta || 1); return l[i - 1].iv + w * (l[i].iv - l[i - 1].iv); }
    return null; };
  const p25 = ivBei('P', -0.25), c25 = ivBei('C', 0.25);
  if (p25 != null && c25 != null) setze('skew25', heute, p25 - c25, 2);
  log('optionen P/C', (oiP / oiC).toFixed(3), 'Laufzeit', e.ex, 'Skew', p25 != null && c25 != null ? (p25 - c25).toFixed(2) : '-');
});

// 2 — ETF-Nettoflows: bitbo-Tabelle (nur ~10 Handelstage) -> je Tag mitgeschrieben, Mio. USD.
await schritt('etf_bitbo', async () => {
  const html = await holen('https://bitbo.io/treasuries/etf-flows/', {}, 'text');
  const txt = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').trim();
  const tab = (html.match(/<table[\s\S]*?<\/table>/g) || []).find(t => /IBIT/.test(t));
  if (!tab) throw new Error('keine ETF-Tabelle');
  const kopf = [...tab.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => txt(m[1]));
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const zahl = s => { s = s.replace(/[$,\s]/g, ''); if (!s || s === '-' || s === '—') return null; const neg = /^\(.*\)$/.test(s) || s.startsWith('-'); const v = parseFloat(s.replace(/[()\-]/g, '')); return isFinite(v) ? (neg ? -v : v) : null; };
  let n = 0, probe = null;
  for (const m of tab.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const z = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x => txt(x[1]));
    const dm = (z[0] || '').match(/^([A-Z][a-z]{2})[a-z]* (\d{1,2}),? (20\d\d)$/); if (!dm) continue;
    const d = iso(Date.UTC(+dm[3], MON[dm[1]], +dm[2]));
    const zeile = {};
    kopf.slice(1).forEach((k, i) => { if (/^(Total|Totals)$/.test(k) || /^[A-Z]{2,5}$/.test(k)) { const v = zahl(z[i + 1] || ''); if (v != null) zeile[k === 'Totals' ? 'Total' : k] = v; } });
    if (Object.keys(zeile).length) { etf.tage[d] = zeile; n++; probe ||= [d, z.join(' | ')]; }
  }
  etf.fonds = kopf.slice(1).filter(k => /^[A-Z]{2,5}$/.test(k));
  log('etf bitbo Zeilen', n, 'Kopf', kopf.join(','), 'Beispiel', JSON.stringify(probe));
});

// ── Ausgabe ────────────────────────────────────────────────────────────
const aus = {};
for (const [k, m] of Object.entries(reihen)) {
  if (!m.size) continue;
  const ds = [...m.keys()].sort(); const t0 = Date.parse(ds[0] + 'T00:00:00Z'), t1 = Date.parse(ds[ds.length - 1] + 'T00:00:00Z');
  const v = []; for (let t = t0; t <= t1; t += TAG) { const x = m.get(iso(t)); v.push(x == null ? null : x); }
  aus[k] = { start: ds[0], v };
  log('reihe', k.padEnd(10), ds[0], '..', ds[ds.length - 1], 'n', m.size, 'luecken', v.filter(x => x == null).length);
}
const ergebnis = { updated: new Date().toISOString(), reihen: aus, etf, stand, fehler };
const text = JSON.stringify(ergebnis);
log('Groesse', (text.length / 1024).toFixed(1), 'KB', 'Fehler', JSON.stringify(fehler));
if (PRUEFEN) log('Pruefmodus: nichts geschrieben');
else fs.writeFileSync(DATEI, text);
