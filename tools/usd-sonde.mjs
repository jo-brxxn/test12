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
