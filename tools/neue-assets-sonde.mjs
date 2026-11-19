// Sonde Nikkei 225, Russell 2000, Platin, Eisenerz (2026-11-19): welche Quellen liefern was? Schreibt NICHTS.
// Nutzer 2026-11-18: "Füg Nikkei noch hinzu und Russel. Platin auch und Eisen." - Pflicht-Checkliste
// docs/neues-asset.md: erst auf dem Runner messen, dann anbinden; USD-Kurse (Nutzer-Regel 2026-11-17).
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const log = (...a) => console.log(...a);
async function j(url, opt = {}) { try { const r = await fetch(url, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(25000) }); const t = await r.text(); try { return { s: r.status, d: JSON.parse(t) }; } catch { return { s: r.status, t: t.slice(0, 200) }; } } catch (e) { return { s: 0, t: e.message }; } }
// 1 TradingView-Scanner (live)
const TV = ['TVC:NI225', 'OSE:NK2251!', 'CME:NKD1!', 'TVC:RUT', 'CME_MINI:RTY1!', 'TVC:PLATINUM', 'NYMEX:PL1!', 'OANDA:XPTUSD', 'SGX:FEF1!', 'COMEX:TIO1!'];
for (const tk of TV) {
  const r = await j('https://scanner.tradingview.com/global/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.tradingview.com' }, body: JSON.stringify({ symbols: { tickers: [tk], query: { types: [] } }, columns: ['close', 'open', 'high', 'low', 'currency', 'description'] }) });
  log('TV', tk, r.s, JSON.stringify(r.d && r.d.data || r.t).slice(0, 200));
}
// 2 Yahoo: Tageskurse 10 Jahre (Historie, Kerzen, Saisonalitaet) + 1h (4H-Trend)
for (const y of ['^N225', 'NKD=F', 'NIY=F', '^RUT', 'RTY=F', 'PL=F', 'TIO=F', 'EWJ', 'IWM', 'PPLT']) {
  const r = await j(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=10y&interval=1d`);
  const res = r.d && r.d.chart && r.d.chart.result && r.d.chart.result[0]; const ts = res && res.timestamp, q = res && res.indicators.quote[0];
  const hl = q ? q.high.filter((h, i) => h != null && q.low[i] != null && h > q.low[i]).length : 0;
  log('Yahoo 10y', y, r.s, ts ? `${new Date(ts[0] * 1000).toISOString().slice(0, 10)}..${new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10)} n=${ts.length} mit Docht ${hl} Waehrung ${res.meta.currency}` : JSON.stringify(r.d || r.t).slice(0, 120));
  const h = await j(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=60d&interval=60m`);
  const t2 = h.d && h.d.chart && h.d.chart.result && h.d.chart.result[0] && h.d.chart.result[0].timestamp;
  log('Yahoo 1h ', y, h.s, t2 ? 'n=' + t2.length : 'keine');
}
// 3 Yahoo Optionen (Put/Call)
try {
  const r0 = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' }); const ck = (r0.headers.getSetCookie ? r0.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  const cr = await (await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, Cookie: ck } })).text();
  for (const y of ['EWJ', 'DXJ', 'IWM', 'PPLT', 'PLTM', 'RIO', 'VALE']) {
    const r = await j(`https://query1.finance.yahoo.com/v7/finance/options/${y}?crumb=${encodeURIComponent(cr)}`, { headers: { Cookie: ck } });
    const o = r.d && r.d.optionChain && r.d.optionChain.result && r.d.optionChain.result[0]; const v = o && o.options && o.options[0];
    log('Optionen', y, r.s, v ? `Laufzeiten ${o.expirationDates.length}, Calls Vol ${v.calls.reduce((s, c) => s + (c.volume || 0), 0)}, Puts Vol ${v.puts.reduce((s, c) => s + (c.volume || 0), 0)}` : JSON.stringify(r.d || r.t).slice(0, 100));
  }
} catch (e) { log('Optionen ERR', e.message); }
// 4 CFTC COT: Kontraktnamen (Legacy + TFF fuer Indizes)
for (const [ds, q] of [['6dca-aqww', 'PLATINUM'], ['6dca-aqww', 'IRON ORE'], ['6dca-aqww', 'NIKKEI'], ['6dca-aqww', 'RUSSELL'], ['gpe5-46if', 'NIKKEI'], ['gpe5-46if', 'RUSSELL']]) {
  const r = await j(`https://publicreporting.cftc.gov/resource/${ds}.json?$select=market_and_exchange_names,cftc_contract_market_code,report_date_as_yyyy_mm_dd,open_interest_all&$where=market_and_exchange_names like '%25${encodeURIComponent(q)}%25' AND report_date_as_yyyy_mm_dd>'2026-10-20'&$order=open_interest_all DESC&$limit=6`);
  (Array.isArray(r.d) ? r.d : []).forEach(x => log('COT', ds, q, '|', x.market_and_exchange_names, '|', x.cftc_contract_market_code, '|', x.report_date_as_yyyy_mm_dd, '| OI', x.open_interest_all));
  if (!Array.isArray(r.d) || !r.d.length) log('COT', ds, q, r.s, JSON.stringify(r.d || r.t).slice(0, 120));
}
// 5 Myfxbook Community Outlook: Symbolnamen (keine Zugangsdaten im Log)
if (process.env.MYFXBOOK_EMAIL && process.env.MYFXBOOK_PASSWORD) {
  const l = await j(`https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(process.env.MYFXBOOK_EMAIL)}&password=${encodeURIComponent(process.env.MYFXBOOK_PASSWORD)}`);
  const s = l.d && !l.d.error && l.d.session;
  if (s) {
    const o = await j(`https://www.myfxbook.com/api/get-community-outlook.json?session=${encodeURIComponent(s)}`);
    const names = ((o.d && o.d.symbols) || []).map(x => x.name);
    log('Myfxbook', names.length, '| passend:', names.filter(n => /225|JP|NIK|2000|RUS|RUT|US2|XPT|PLAT|IRON|FE/i.test(n)).join(', ') || 'keine');
    await j(`https://www.myfxbook.com/api/logout.json?session=${encodeURIComponent(s)}`);
  } else log('Myfxbook Login fehlgeschlagen');
} else log('Myfxbook: keine Secrets');
// 6 TradingView-Kalender: passende Termine (14 Tage)
const v = new Date(), b = new Date(Date.now() + 14 * 864e5);
const k = await j(`https://economic-calendar.tradingview.com/events?from=${v.toISOString()}&to=${b.toISOString()}&countries=US,JP,CN,AU`, { headers: { Origin: 'https://www.tradingview.com' } });
const ev = (k.d && k.d.result) || [];
log('TV-Kalender', ev.length, '| Treffer:', ev.filter(e => /tankan|platinum|iron|steel|russell|small business|nikkei/i.test(e.title)).map(e => e.country + ' ' + e.title + ' ' + e.date.slice(0, 10)).join(' ; ') || 'keine');
