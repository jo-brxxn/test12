// Sonde Copper + Natural Gas (2026-11-16): welche Quellen liefern was? Schreibt NICHTS.
// Nutzer-Regel 2026-11-16: beim Hinzufuegen eines Assets ALLES automatisch pruefen und
// anbinden (Kurse, Saisonalitaet, COT, Retail, Put/Call, Kalender ...).
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' };
const log = (...a) => console.log(...a);
async function j(url, opt = {}) { const r = await fetch(url, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(25000) }); const t = await r.text(); try { return { s: r.status, d: JSON.parse(t) }; } catch { return { s: r.status, t: t.slice(0, 200) }; } }
// 1 TradingView-Scanner
for (const tk of ['COMEX:HG1!', 'TVC:COPPER', 'CAPITALCOM:COPPER', 'NYMEX:NG1!', 'TVC:NATGAS', 'CAPITALCOM:NATURALGAS']) {
  const r = await j('https://scanner.tradingview.com/global/scan', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.tradingview.com' }, body: JSON.stringify({ symbols: { tickers: [tk], query: { types: [] } }, columns: ['close', 'change', 'description'] }) });
  log('TV', tk, r.s, JSON.stringify(r.d && r.d.data || r.t).slice(0, 160));
}
// 2 Yahoo: Tageskurse lang + Monatskurse (Saisonalitaet)
for (const y of ['HG=F', 'NG=F', 'CPER', 'UNG', 'COPX']) {
  const r = await j(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?range=10y&interval=1d`);
  const ts = r.d && r.d.chart && r.d.chart.result && r.d.chart.result[0] && r.d.chart.result[0].timestamp;
  log('Yahoo 10y', y, r.s, ts ? `${new Date(ts[0] * 1000).toISOString().slice(0, 10)}..${new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10)} n=${ts.length}` : JSON.stringify(r.d || r.t).slice(0, 120));
}
// 3 Yahoo Optionen (Put/Call) - Crumb wie im Workflow
try {
  const r0 = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' }); const ck = (r0.headers.getSetCookie ? r0.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  const cr = await (await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, Cookie: ck } })).text();
  for (const y of ['CPER', 'UNG', 'COPX', 'BOIL']) {
    const r = await j(`https://query1.finance.yahoo.com/v7/finance/options/${y}?crumb=${encodeURIComponent(cr)}`, { headers: { Cookie: ck } });
    const o = r.d && r.d.optionChain && r.d.optionChain.result && r.d.optionChain.result[0];
    const v = o && o.options && o.options[0] ? o.options[0] : null;
    log('Optionen', y, r.s, o ? `Laufzeiten ${o.expirationDates.length}, Calls ${v.calls.length} (Vol ${v.calls.reduce((s, c) => s + (c.volume || 0), 0)}), Puts ${v.puts.length} (Vol ${v.puts.reduce((s, c) => s + (c.volume || 0), 0)})` : JSON.stringify(r.d || r.t).slice(0, 100));
  }
} catch (e) { log('Optionen ERR', e.message); }
// 4 CFTC COT: Kontraktnamen
for (const q of ['COPPER', 'NATURAL GAS', 'NAT GAS']) {
  const r = await j(`https://publicreporting.cftc.gov/resource/6dca-aqww.json?$select=market_and_exchange_names,cftc_contract_market_code,report_date_as_yyyy_mm_dd,open_interest_all&$where=market_and_exchange_names like '%25${encodeURIComponent(q)}%25' AND report_date_as_yyyy_mm_dd>'2026-10-20'&$order=open_interest_all DESC&$limit=8`);
  (Array.isArray(r.d) ? r.d : []).forEach(x => log('COT', q, '|', x.market_and_exchange_names, '|', x.cftc_contract_market_code, '|', x.report_date_as_yyyy_mm_dd, '| OI', x.open_interest_all));
  if (!Array.isArray(r.d)) log('COT', q, r.s, JSON.stringify(r.d || r.t).slice(0, 120));
}
// 5 Myfxbook Community Outlook: welche Symbole gibt es? (nur Namen, keine Zugangsdaten)
if (process.env.MYFXBOOK_EMAIL && process.env.MYFXBOOK_PASSWORD) {
  const l = await j(`https://www.myfxbook.com/api/login.json?email=${encodeURIComponent(process.env.MYFXBOOK_EMAIL)}&password=${encodeURIComponent(process.env.MYFXBOOK_PASSWORD)}`);
  const s = l.d && !l.d.error && l.d.session;
  if (s) {
    const o = await j(`https://www.myfxbook.com/api/get-community-outlook.json?session=${encodeURIComponent(s)}`);
    const names = ((o.d && o.d.symbols) || []).map(x => x.name);
    log('Myfxbook Symbole', names.length, '| passend:', names.filter(n => /XCU|COPPER|HG|XNG|NG|GAS/i.test(n)).join(', ') || 'keine', '| alle Nicht-FX:', names.filter(n => !/^[A-Z]{6}$/.test(n) || /^X/.test(n)).join(', '));
    await j(`https://www.myfxbook.com/api/logout.json?session=${encodeURIComponent(s)}`);
  } else log('Myfxbook Login', JSON.stringify(l.d || l.t).slice(0, 80).replace(/session[^,]*/, 'session…'));
} else log('Myfxbook: keine Secrets');
// 6 TradingView-Kalender: EIA-Erdgas-Termine
const v = new Date(), b = new Date(Date.now() + 14 * 864e5);
const k = await j(`https://economic-calendar.tradingview.com/events?from=${v.toISOString()}&to=${b.toISOString()}&countries=US`, { headers: { Origin: 'https://www.tradingview.com' } });
const ev = (k.d && k.d.result) || [];
log('TV-Kalender US', ev.length, '| Gas/Kupfer:', ev.filter(e => /gas|copper/i.test(e.title)).map(e => e.title + ' ' + e.date.slice(0, 10) + ' imp' + e.importance).join(' ; ') || 'keine');
