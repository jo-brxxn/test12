// Sonde BTC-Sentiment, Runde 2 (2026-11-13): Detailfragen aus Runde 1. Schreibt NICHTS.
const H = { 'User-Agent': 'FXAnalystPro research tool', Origin: 'https://example.org' };
const d = t => t == null ? '-' : new Date(typeof t === 'number' && t < 1e11 ? t * 1000 : t).toISOString().slice(0, 10);
async function get(u, opt = {}) { const r = await fetch(u, { ...opt, headers: { ...H, ...(opt.headers || {}) }, signal: AbortSignal.timeout(25000) }); return { r, t: await r.text() }; }
const log = (...a) => console.log(...a);
const hdr = r => [...r.headers].filter(([k]) => /rate|limit|retry|cache-control|access-control/i.test(k)).map(([k, v]) => k + '=' + v).join(' | ');
// A) bitbo ETF-Seite: gibt es eine Tabelle mit Fonds und Datumszeilen?
try { const { r, t } = await get('https://bitbo.io/treasuries/etf-flows/');
  const heads = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 20);
  const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].length;
  const dates = [...t.matchAll(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? 20\d\d/g)].map(m => m[0]);
  log('A bitbo', r.status, 'rows', rows, 'heads', JSON.stringify(heads), 'dates', dates.length, dates.slice(0, 2), dates.slice(-2));
  const j = t.match(/<script[^>]*>[^<]*(IBIT|FBTC)[^<]{0,300}/); log('A bitbo script?', j ? j[0].slice(0, 300) : 'none');
} catch (e) { log('A bitbo ERR', e.message); }
for (const u of ['https://bitbo.io/robots.txt', 'https://bitbo.io/terms/', 'https://bitcoin-data.com/robots.txt']) { try { const { r, t } = await get(u); log('ToS', u, r.status, t.replace(/\s+/g, ' ').slice(0, 400)); } catch (e) { log('ToS ERR', u, e.message); } }
// B) bgeometrics: Tiefe, Paging, Limits
for (const u of ['https://bitcoin-data.com/v1/sth-sopr?startday=2011-01-01&endday=2015-01-01', 'https://bitcoin-data.com/v1/mvrv?startday=2011-01-01&endday=2015-01-01', 'https://bitcoin-data.com/v1/sth-realized-price?startday=2011-01-01&endday=2013-01-01', 'https://bitcoin-data.com/v1/sth-sopr/last', 'https://bitcoin-data.com/api/v1/sth-sopr?page=0&size=10']) {
  try { const { r, t } = await get(u); let info = ''; try { const j = JSON.parse(t); const a = Array.isArray(j) ? j : (j.content || [j]); info = `${a[0]?.d || a[0]?.theDay}..${a.at(-1)?.d || a.at(-1)?.theDay} n=${a.length} keys=${Object.keys(a[0] || {})}`; } catch { info = t.slice(0, 150); }
    log('B', u, r.status, info, '||', hdr(r)); } catch (e) { log('B ERR', u, e.message); } }
// C) Coin Metrics Community einzeln
for (const m of ['CapMVRVCur', 'FlowInExNtv,FlowOutExNtv', 'SplyExNtv', 'CapMrktCurUSD']) {
  try { const { r, t } = await get(`https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=${m}&frequency=1d&page_size=10000&start_time=2009-01-01`);
    const j = JSON.parse(t); log('C', m, r.status, j.data ? `${j.data[0]?.time}..${j.data.at(-1)?.time} n=${j.data.length} next=${!!j.next_page_token} bsp=${JSON.stringify(j.data.at(-1))}` : t.slice(0, 160)); } catch (e) { log('C ERR', m, e.message); } }
try { const { r, t } = await get('https://coinmetrics.io/terms-of-use/'); log('C ToS', r.status, (t.match(/community[^.]{0,300}\./i) || [''])[0].replace(/<[^>]+>/g, '')); } catch (e) { log('C ToS ERR', e.message); }
// D) Binance-Archiv: Beginn der Reihen, Liquidationen
for (const u of ['https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-2019-09.zip', 'https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-2026-10.zip', 'https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2021-12-01.zip', 'https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2026-11-12.zip', 'https://data.binance.vision/data/futures/um/daily/liquidationSnapshot/BTCUSDT/BTCUSDT-liquidationSnapshot-2021-03-01.zip', 'https://data.binance.vision/data/futures/um/daily/liquidationSnapshot/BTCUSDT/BTCUSDT-liquidationSnapshot-2024-03-01.zip', 'https://data.binance.vision/data/futures/cm/daily/metrics/BTCUSD_PERP/BTCUSD_PERP-metrics-2026-11-12.zip']) {
  try { const r = await fetch(u, { method: 'HEAD', headers: H }); log('D', u.split('/').pop(), r.status, r.headers.get('content-length'), r.headers.get('last-modified')); } catch (e) { log('D ERR', e.message); } }
// Inhalt einer metrics-Datei (Spalten)
try { const r = await fetch('https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2026-11-12.zip'); const b = Buffer.from(await r.arrayBuffer()); require_unzip(b); } catch (e) { log('D unzip', e.message); }
function require_unzip(b) { const zlib = process.getBuiltinModule('zlib'); const n = b.readUInt16LE(26), x = b.readUInt16LE(28); const csv = zlib.inflateRawSync(b.subarray(30 + n + x)).toString(); const l = csv.split('\n'); log('D metrics csv', l.length, l[0], '|', l[1], '|', l.at(-2)); }
// E) OKX: Tiefe Funding (Paging), OI-Historie 5m/1H, Liquidationen
for (const u of ['https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=100&after=1700000000000', 'https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=BTC-USDT-SWAP&period=1D&limit=100', 'https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=BTC-USDT-SWAP&period=1D&limit=100&end=1650000000000']) {
  try { const { r, t } = await get(u); const j = JSON.parse(t); const a = j.data || []; const ts = x => +(x.fundingTime || x.ts || x[0]); log('E', u.split('?')[0].split('/').slice(-2).join('/'), u.split('?')[1].slice(-30), r.status, a.length ? `${d(ts(a.at(-1)))}..${d(ts(a[0]))} n=${a.length}` : t.slice(0, 160)); } catch (e) { log('E ERR', e.message); } }
// F) Deribit: Funding aktuell, Optionen-Felder (Greeks?), Ticker eines Kontrakts
try { const { t } = await get('https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option'); const j = JSON.parse(t); log('F option fields', Object.keys(j.result[0]).join(','), JSON.stringify(j.result[0]).slice(0, 300));
  const nm = j.result.find(x => x.open_interest > 100)?.instrument_name; const { t: t2 } = await get('https://www.deribit.com/api/v2/public/ticker?instrument_name=' + nm); log('F ticker greeks', nm, JSON.stringify(JSON.parse(t2).result.greeks), 'iv', JSON.parse(t2).result.mark_iv); } catch (e) { log('F ERR', e.message); }
// G) Hyperliquid/Deribit Funding aktuell (letzte Werte)
try { const { t } = await get('https://www.deribit.com/api/v2/public/get_funding_rate_history?instrument_name=BTC-PERPETUAL&start_timestamp=' + (Date.now() - 864e5) + '&end_timestamp=' + Date.now()); const a = JSON.parse(t).result; log('G deribit funding', a.length, d(a.at(-1).timestamp), JSON.stringify(a.at(-1))); } catch (e) { log('G ERR', e.message); }
// H) Alternativen fuer ETF-Flows
for (const u of ['https://api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart', 'https://sosovalue.com/assets/etf/us-btc-spot', 'https://www.coinglass.com/etf/bitcoin', 'https://heyapollo.com/api/etf/flows', 'https://www.blockchaincenter.net/en/bitcoin-etf/']) {
  try { const { r, t } = await get(u); log('H', u, r.status, t.length, /IBIT/.test(t) ? 'IBIT im Text' : 'kein IBIT', t.replace(/\s+/g, ' ').slice(0, 100)); } catch (e) { log('H ERR', u, e.message); } }
