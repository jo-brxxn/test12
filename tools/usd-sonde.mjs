// Sonde USD-Kurse (2026-11-17): Nutzer-Regel "immer wenn du Preise fuer Assets hinzufuegst die
// usd Kurse benutzen also solusd und xauusd ueberpruef das ueberall". Vergleicht je Nicht-FX-Asset
// die Live-Quelle (TradingView) mit der Historien-Quelle (Yahoo) und moeglichen USD-Spot-Alternativen.
// Schreibt NICHTS.
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const log = (...a) => console.log(...a);
async function j(url, opt = {}) { try { const r = await fetch(url, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(25000) }); const t = await r.text(); try { return { s: r.status, d: JSON.parse(t) }; } catch { return { s: r.status, t: t.slice(0, 160) }; } } catch (e) { return { s: 0, t: e.message }; } }
async function tv(tk) { const r = await j('https://scanner.tradingview.com/global/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.tradingview.com' }, body: JSON.stringify({ symbols: { tickers: [tk], query: { types: [] } }, columns: ['close', 'currency', 'description'] }) }); const d = r.d && r.d.data && r.d.data[0]; return d ? `${d.d[0]} ${d.d[1]} "${d.d[2]}"` : `- (${r.s})`; }
async function yh(y) { const r = await j(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=5d&interval=1d`); const x = r.d && r.d.chart && r.d.chart.result && r.d.chart.result[0]; if (!x) return `- (${r.s})`; const c = x.indicators.quote[0].close.filter(v => v != null); return `${c[c.length - 1] && c[c.length - 1].toFixed(4)} ${x.meta.currency} "${x.meta.shortName || x.meta.symbol}" seit ${new Date(x.meta.firstTradeDate * 1000).toISOString().slice(0, 10)}`; }
const PAARE = [
  ['GOLD', ['TVC:GOLD', 'OANDA:XAUUSD', 'FX_IDC:XAUUSD', 'COMEX:GC1!'], ['GC=F', 'XAUUSD=X']],
  ['SILVER', ['TVC:SILVER', 'OANDA:XAGUSD', 'FX_IDC:XAGUSD', 'COMEX:SI1!'], ['SI=F', 'XAGUSD=X']],
  ['COPPER', ['COMEX:HG1!', 'OANDA:XCUUSD', 'CAPITALCOM:COPPER'], ['HG=F']],
  ['OIL', ['NYMEX:CL1!', 'TVC:USOIL', 'OANDA:WTICOUSD'], ['CL=F']],
  ['NATGAS', ['NYMEX:NG1!', 'OANDA:NATGASUSD', 'CAPITALCOM:NATURALGAS'], ['NG=F']],
  ['BTC', ['COINBASE:BTCUSD', 'BITSTAMP:BTCUSD'], ['BTC-USD']],
  ['SOL', ['COINBASE:SOLUSD', 'BITSTAMP:SOLUSD'], ['SOL-USD']],
  ['ETH', ['COINBASE:ETHUSD'], ['ETH-USD']],
  ['SP500', ['SP:SPX'], ['^GSPC']],
  ['NAS', ['NASDAQ:NDX'], ['^NDX']],
  ['DAX', ['TVC:DEU40', 'XETR:DAX'], ['^GDAXI']],
];
for (const [id, tvs, yhs] of PAARE) {
  log(`== ${id}`);
  for (const t of tvs) log(`  TV    ${t.padEnd(22)} ${await tv(t)}`);
  for (const y of yhs) log(`  Yahoo ${y.padEnd(22)} ${await yh(y)}`);
}
// 2) Spot-Historie XAUUSD/XAGUSD (Yahoo fuehrt sie nicht): stooq CSV, und wie weit weicht der
// Future (GC=F/SI=F, bisher Historienquelle) ueber 3 Jahre vom Spot ab?
async function csv(u) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) }); return { s: r.status, t: await r.text() }; } catch (e) { return { s: 0, t: e.message }; } }
async function yhLang(y) { const r = await j(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=5y&interval=1d`); const x = r.d && r.d.chart && r.d.chart.result && r.d.chart.result[0]; if (!x) return new Map(); const m = new Map(); x.timestamp.forEach((t, i) => { const c = x.indicators.quote[0].close[i]; if (c != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), c); }); return m; }
for (const [s, y] of [['xauusd', 'GC=F'], ['xagusd', 'SI=F']]) {
  const r = await csv(`https://stooq.com/q/d/l/?s=${s}&i=d`);
  const z = r.t.trim().split('\n'); log(`== stooq ${s} ${r.s} Zeilen ${z.length} | ${z[0]} | ${z[1]} | ${z[z.length - 1]}`);
  if (z.length < 50) continue;
  const spot = new Map(z.slice(1).map(l => l.split(',')).map(a => [a[0], +a[4]]));
  const fut = await yhLang(y);
  const d = [...fut].filter(([k]) => spot.has(k) && k >= '2023-11-01').map(([k, v]) => [k, (v - spot.get(k)) / spot.get(k) * 100]);
  if (!d.length) { log('  kein gemeinsamer Tag'); continue; }
  const abs = d.map(x => Math.abs(x[1])).sort((a, b) => a - b);
  const max = d.reduce((a, b) => Math.abs(b[1]) > Math.abs(a[1]) ? b : a);
  log(`  ${y} vs Spot seit 2023-11: Tage ${d.length}, Median ${abs[abs.length >> 1].toFixed(2)} %, 95% ${abs[Math.floor(abs.length * .95)].toFixed(2)} %, max ${max[1].toFixed(2)} % am ${max[0]}`);
}
