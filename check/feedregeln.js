// ── INDIKATOR-FEED: JEDE REIHE NUR AUS IHREM EIGENEN RELEASE ────────────
// Gefunden 2026-10-07 bei der Klassensuche zu "Muster trifft einen anderen
// Release" (Nutzer: "guck dir die Historie an" - die Release-Tage der
// Historie waren dabei selbst verunreinigt):
//   - USD-NFP: die jaehrliche Benchmark-Revision ("Non Farm Payrolls Annual
//     Revision Prel") stand dreimal als NFP-Wert in ind_data.json
//     (2024-08-21 -818K, 2025-09-09 -911K, 2026-08-28 -79K).
//   - USD-ISM-PMI: S&P Globals Flash-PMI (eine andere Umfrage) stand 16-mal
//     in den ISM-Reihen; vom ~23. bis zum ISM-Termin trieb jeweils die
//     S&P-Zahl den USD-PMI (2026-09-23: 57 gegen Prognose 53,6).
// Der Indikator-Feed laeuft nur auf dem Runner (TradingView ist aus der
// Sandbox gesperrt). Dieser Waechter liest deshalb die RULES und die
// Bereinigung keinRelease() DIREKT aus update-ff-calendar.yml und prueft sie
// an echten TradingView-Titeln und an echten Punkten der Historie:
//   A) die Regeln treffen den eigenen Release und nicht den fremden;
//   B) die Bereinigung entfernt genau die eingeschleppten Punkte und keinen
//      regulaeren (auch nicht bei anderen Waehrungen);
//   C) Info (kein Fehler): wie viele Punkte der aktuellen ind_data.json der
//      naechste Lauf entfernt - die Daten im Repo bereinigt erst der Workflow.
// Erweitert 2026-10-27 (Nutzer: "BIP Q1 ist auf 0.9 % revidiert, die App
// fuehrt noch 0.8 %"; "Konsumklima steht doppelt im Feed, 15. und 16.09."):
//   A2) keine Reihe bekommt am SELBEN Tag zwei verschiedene Titel (an allen
//       Releases in cal_hist) - sonst entscheidet die Sortierung, welcher gilt
//       (USD Retail Control Group 0,1 % statt Headline 0,8 % am 15.10.);
//   D) der ECHTE Aggregationsblock des Workflows laeuft hier mit kuenstlichen
//      TradingView-/Trading-Economics-Daten: Vorwert = TVs revidierter Vorwert
//      (nicht der Erstdruck), revisedFrom nur gegen denselben Release-Titel,
//      Punkte, die TV nicht mehr fuehrt, fallen aus der Historie, TE-Reihen
//      behalten ihr Datum und ihre Historie, S&P-PMI nie in der Ivey-Reihe.
//   node check/feedregeln.js [--gegenprobe]   (alte Regeln und alte
//   Aggregation -> A und D muessen rot werden)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);

const y = fs.readFileSync(path.join(ROOT, '.github/workflows/update-ff-calendar.yml'), 'utf8');
function block(start, ende) {
  const i = y.indexOf(start);
  if (i < 0) return null;
  const j = y.indexOf(ende, i);
  return j < 0 ? null : y.slice(i, j + ende.length);
}
let excore = block('const EXCORE=', ';\n');
let rules = block('const RULES=[', '\n            ];');
let kein = block('function keinRelease(', '// ENDE keinRelease');
if (!excore || !rules) fail('RULES', 'const EXCORE / const RULES nicht in update-ff-calendar.yml gefunden');
if (!kein) fail('BEREINIGUNG', 'function keinRelease(...) // ENDE keinRelease nicht in update-ff-calendar.yml gefunden');
if (GEGENPROBE && rules) {
  rules = rules.replace('!/private|revision|benchmark/.test(t)', '!/private/.test(t)').split('&&(c!=="USD"||/\\bism\\b/.test(t))').join('')
    .replace('|control/.test(t)', '/.test(t)')
    .replace('(t==="interest rate"||/interest rate decision|rate decision/.test(t))&&!/qe |gilts/.test(t)', '/interest rate decision|rate decision/.test(t)');
}

if (rules && excore) {
  let RULES = null;
  try { RULES = new Function(excore + '\n' + rules + '\nreturn RULES;')(); } catch (e) { fail('RULES', 'nicht auswertbar: ' + e.message); }
  if (RULES) {
    // wie im Workflow: norm() = klein, Leerraum zusammengezogen
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const trifft = (titel, ccy, ind) => RULES.some(r => r.ind === ind && r.test(norm(titel), ccy));
    // [Titel (TradingView), Waehrung, Indikator, soll treffen?]
    const FALL = [
      ['Non Farm Payrolls', 'USD', 'NFP / Employment Change', true],
      ['Non Farm Payrolls Annual Revision Prel', 'USD', 'NFP / Employment Change', false],
      ['Nonfarm Payrolls Private', 'USD', 'NFP / Employment Change', false],
      ['ISM Manufacturing PMI', 'USD', 'Manufacturing PMI', true],
      ['S&P Global Manufacturing PMI Flash', 'USD', 'Manufacturing PMI', false],
      ['S&P Global Manufacturing PMI Final', 'USD', 'Manufacturing PMI', false],
      ['ISM Services PMI', 'USD', 'Services PMI', true],
      ['S&P Global Services PMI Flash', 'USD', 'Services PMI', false],
      ['S&P Global Services PMI Final', 'USD', 'Services PMI', false],
      ['CB Consumer Confidence', 'USD', 'Consumer Confidence', true],
      ['Michigan Consumer Sentiment Prel', 'USD', 'Consumer Confidence', false],
      // die anderen Waehrungen behalten ihre (S&P-/HCOB-)PMI
      ['HCOB Manufacturing PMI', 'EUR', 'Manufacturing PMI', true],
      ['S&P Global Manufacturing PMI Final', 'JPY', 'Manufacturing PMI', true],
      ['S&P Global Services PMI Flash', 'GBP', 'Services PMI', true],
      ['Employment Change', 'CAD', 'NFP / Employment Change', true],
      // 2026-10-27: Fremdreihen am selben Tag bzw. im selben Muster
      ['Retail Sales MoM', 'USD', 'Retail Sales', true],
      ['Retail Sales Control Group MoM', 'USD', 'Retail Sales', false],
      ['Retail Sales MoM Final', 'CAD', 'Retail Sales', true],
      ['Retail Sales MoM Prel', 'CAD', 'Retail Sales', false],
      ['PPI YoY', 'JPY', 'PPI', true],
      ['Services Producer Price Index YoY', 'JPY', 'PPI', false],
      ['Employment Change QoQ Final', 'EUR', 'NFP / Employment Change', true],
      ['Employment Change YoY Final', 'EUR', 'NFP / Employment Change', false],
      ['Unemployment Change', 'EUR', 'NFP / Employment Change', false],
      // NZD: bis 2026-10-27 ohne Live-Pfad (Startbefuellung vom Mai)
      ['Labour Costs Index YoY', 'NZD', 'Avg Hourly Earnings', true],
      ['PPI Output QoQ', 'NZD', 'PPI', true],
      ['PPI Input QoQ', 'NZD', 'PPI', false],
      // NZD-Treiber 2026-10-27 (Nutzer-Entscheid): ANZ-RM statt Westpac, neue Reihen
      ['ANZ Roy Morgan Consumer Confidence', 'NZD', 'Consumer Confidence', true],
      ['Westpac Consumer Confidence', 'NZD', 'Consumer Confidence', false],
      ['Westpac Consumer Confidence Index', 'AUD', 'Consumer Confidence', true],
      ['ANZ Business Confidence', 'NZD', 'Business Confidence', true],
      ['ANZ Business Confidence Prel', 'NZD', 'Business Confidence', false],
      ['Global Dairy Trade Price Index', 'NZD', 'GDT Price Index', true],
      ['Terms of Trade QoQ', 'NZD', 'Terms of Trade', true],
      ['Building Permits MoM', 'NZD', 'Building Permits', true],
      ['Building Permits MoM Prel', 'USD', 'Building Permits', false],
      ['Business Inflation Expectations', 'NZD', 'Inflation Expectations', true],
      ['Michigan Inflation Expectations Prel', 'USD', 'Inflation Expectations', true],
      ['Business Inflation Expectations', 'USD', 'Inflation Expectations', false],
      // 2026-11-07: Fassungen derselben Veroeffentlichung am selben Tag (A2)
      ['Inflation Rate MoM', 'USD', 'CPI', true],
      ['Inflation Rate MoM NSA', 'USD', 'CPI', false],
      ['Inflation Rate YoY', 'CAD', 'CPI (Headline)', true],
      ['Inflation Rate YoY s.a', 'CAD', 'CPI (Headline)', false],
      ['Inflation Rate MoM s.a', 'CAD', 'CPI', false],
      ['Unemployment Rate', 'CHF', 'Unemployment Rate', true],
      ['Unemployment Rate s.a', 'CHF', 'Unemployment Rate', false],
      ['Consumer Confidence', 'CHF', 'Consumer Confidence', true],
      ['Consumer Confidence s.a', 'CHF', 'Consumer Confidence', false],
      ['GfK Consumer Confidence', 'GBP', 'Consumer Confidence', true],
      // 2026-11-10 (Sonde probe-tv-titel.yml): TradingView hat Reihen UMBENANNT -
      // der alte Titel verschwand samt Vergangenheit, neun Reihen fielen am
      // 03.11. aus dem Feed. Der neue Titel muss treffen, der fremde nicht.
      ['Consumer Confidence Index', 'GBP', 'Consumer Confidence', true],
      ['LSEG/Ipsos Primary Consumer Sentiment Index', 'GBP', 'Consumer Confidence', false],
      ['LSEG/Ipsos Primary Consumer Sentiment Index', 'JPY', 'Consumer Confidence', false],
      ['Interest Rate', 'USD', 'Central Bank Rate', true],
      ['Interest Rate', 'GBP', 'Central Bank Rate', true],
      ['Fed Interest Rate Decision', 'USD', 'Central Bank Rate', true],
      ['RBA Interest Rate Decision', 'AUD', 'Central Bank Rate', true],
      ['Interest Rate on Reserve Balances', 'USD', 'Central Bank Rate', false],
      ['Interest Rate Projection - 1st Yr', 'USD', 'Central Bank Rate', false],
      ['Deposit Facility Rate', 'EUR', 'Central Bank Rate', false],
      ['United Kingdom-BoE Bank rate decision-GB BOE QE Gilts*', 'GBP', 'Central Bank Rate', false],
      ['Wage Growth YoY', 'AUD', 'Avg Hourly Earnings', true],
      ['Wage Price Index YoY', 'AUD', 'Avg Hourly Earnings', true],
      ['M3 Money Supply Annual Growth', 'EUR', 'Money Supply', true],
      ['M3 Money Supply YoY', 'EUR', 'Money Supply', false],
      ['LSEG/Ipsos Primary Consumer Sentiment Index', 'GBP', 'Consumer Confidence', false],
      ['Westpac Consumer Confidence Index', 'AUD', 'Consumer Confidence', true],
      ['Ivey PMI s.a', 'CAD', 'Services PMI', true],
      ['Ivey PMI', 'CAD', 'Services PMI', false],
    ];
    FALL.forEach(([t, c, ind, soll]) => {
      const ist = trifft(t, c, ind);
      if (ist !== soll) fail(soll ? 'EIGENER RELEASE FEHLT' : 'FREMDER RELEASE', `${c} "${t}" ${ist ? 'trifft' : 'trifft nicht'} ${ind}`);
    });
  }
}

// ── A2) kein Tag mit zwei verschiedenen Titeln in derselben Reihe ──────────
{
  const normB = block('const norm=s=>', ';\n'), perB = block('const period=t=>{', '\n            };');
  let R = null, norm = null, period = null;
  try { ({ RULES: R, norm, period } = new Function(normB + '\n' + perB + '\n' + excore + '\n' + rules + '\nreturn {RULES,norm,period};')()); } catch (e) { fail('SELBER TAG', 'Regeln nicht auswertbar: ' + e.message); }
  if (R) {
    const PRE = { 'German ': 'DE', 'French ': 'FR', 'Italian ': 'IT', 'Spanish ': 'ES' };
    const tag = {};
    const dir = path.join(ROOT, 'cal_hist');
    for (const f of fs.readdirSync(dir).filter(f => /^\d{4}\.json$/.test(f))) {
      for (const e of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).ev) {
        let [zeit, ccy, titel, , act] = e; if (!act) continue;
        let origin = ccy === 'EUR' ? 'EU' : ccy;
        for (const [p, c] of Object.entries(PRE)) if (titel.startsWith(p)) { origin = c; titel = titel.slice(p.length); }
        if (origin !== ccy && origin !== 'EU') continue;   // DE nur Ersatz, wenn EU fehlt
        const t = norm(titel), per = period(titel);
        R.forEach(r => {
          if (!r.test(t, ccy) || (r.period && per !== r.period)) return;
          const k = ccy + '|' + r.ind + '|' + zeit.slice(0, 10);
          (tag[k] = tag[k] || new Map()).set(titel, String(act).trim());
        });
      }
    }
    // Konflikt = zwei Titel mit VERSCHIEDENEN Werten (2026-11-07): nur dann
    // entscheidet die Sortierung, welche Zahl gilt. Derselbe Release doppelt
    // geliefert (CAD "Retail Sales MoM" + "... Final", beide 1,2 % am 23.10.)
    // aendert keine Zahl - und den alten Titel auszuschliessen, wuerde die
    // Historie 2016-2024 (100 Tage) aus der Reihe werfen.
    const konf = Object.entries(tag).filter(([, m]) => new Set(m.values()).size > 1).map(([k, m]) => [k, new Set(m.keys())]);
    if (konf.length) fail('SELBER TAG', `${konf.length} Release-Tage mit 2+ Titeln in einer Reihe, z.B. ${(process.env.ALLE?konf:konf.slice(-3)).map(([k, s]) => k + ' ' + JSON.stringify([...s])).join('; ')}`);
  }
}

// ── D) der echte Aggregationsblock mit kuenstlichen Daten ─────────────────
{
  const i = y.indexOf('const RULES=[');
  const a = y.lastIndexOf("node -e '\n", i), b = y.indexOf("\n          '\n", i);
  let code = (a < 0 || b < 0) ? null : y.slice(a + 9, b);
  if (!code) fail('AGGREGATION', 'node-Block mit const RULES=[ nicht gefunden');
  if (code && GEGENPROBE) {
    code = code.replace('if((tvPrev==null||tvPrev==="")&&uniq[1])v.previous=uniq[1].actual;', 'if(uniq[1])v.previous=uniq[1].actual;')
      .replace('!nichtBeiTv(h)', 'true');
  }
  if (code) {
    const os = require('os'), cp = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedregeln-'));
    const tag = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const zeit = n => tag(n) + 'T12:00:00.000Z';
    const ev = (country, title, n, actual, forecast, previous, extra) => Object.assign({ country, title, date: zeit(n), actual, forecast, previous, unit: '%' }, extra || {});
    const wide = [
      // NZD BIP: Q1 0,8 % erstgemeldet, TV fuehrt beim Q2-Release 0,9 % als Vorwert
      ev('NZ', 'GDP Growth Rate QoQ', 41, '0.2', '0.1', '0.9'),
      // NZD Konsumklima: TV fuehrt den Release heute am Tag 42 (frueher: Tag 41)
      // (2026-09 war es die Westpac-Reihe; seit 2026-10-27 ist NZDs Reihe ANZ-RM)
      ev('NZ', 'ANZ Roy Morgan Consumer Confidence', 42, '89.5', null, '80.4', { unit: '' }),
      // EUR CPI: Flash und Final DESSELBEN Monats, Vorwert = Vormonat
      ev('EU', 'Inflation Rate YoY Flash', 25, '3.8', '3.7', '3.2'),
      ev('EU', 'Inflation Rate YoY Final', 11, '3.8', '3.8', '3.2'),
      // USD Retail: Headline und Control Group am selben Tag
      ev('US', 'Retail Sales Control Group MoM', 12, '0.1', '0.3', '1.2'),
      ev('US', 'Retail Sales MoM', 12, '0.8', '0.3', '1.3'),
      // USD NFP: TV hat den revidierten Vorwert schon wieder auf den Erstdruck gestellt
      ev('US', 'Non Farm Payrolls', 20, '29', '50', '162', { unit: '', scale: 'K' }),
      ev('US', 'Non Farm Payrolls', 48, '162', '60', '20', { unit: '', scale: 'K' }),
      // EUR Beschaeftigung: q/q und y/y am selben Tag, gespeichert war y/y
      ev('EU', 'Employment Change QoQ Final', 10, '0.1', '0.1', '0.1'),
      ev('EU', 'Employment Change YoY Final', 10, '0.5', '0.5', '0.5'),
      ev('EU', 'Employment Change QoQ Final', 101, '0.1', '0.1', '0.2'),
      // CAD Ivey (Services PMI der RULES)
      ev('CA', 'Ivey PMI s.a', 21, '58.2', '65.2', '64.3', { unit: '' }),
    ];
    const hist0 = [ev('NZ', 'GDP Growth Rate QoQ', 132, '0.8', '0.9', '0.5'), ev('NZ', 'ANZ Roy Morgan Consumer Confidence', 133, '80.4', null, '94.7', { unit: '' })];
    const prev = {
      NZD: { 'Consumer Confidence': { actual: '89.5', previous: '80.4', revisedFrom: '89.5', date: tag(41), event: 'ANZ Roy Morgan Consumer Confidence', source: 'tv', historyFull: [[tag(133), '80.4', null], [tag(95), '106', null], [tag(42), '89.5', null], [tag(41), '89.5', null]] } },
      USD: { 'NFP / Employment Change': { actual: '29K', previous: '133K', revisedFrom: '162K', date: tag(20), event: 'Non Farm Payrolls', source: 'tv', historyFull: [] } },
      CHF: { 'Core CPI': { actual: '0.50%', previous: null, date: tag(25), event: 'Core CPI (Trading Economics)', source: 'tepage', ref: 'september 2026', historyFull: [[tag(55), '0.40%', null], [tag(25), '0.50%', null]] } },
      EUR: {
        'Manufacturing PMI': { actual: '52.90', date: tag(26), event: 'Manufacturing PMI (Trading Economics)', source: 'tepage', ref: 'september 2026', historyFull: [[tag(26), '52.90', null]] },
        'NFP / Employment Change': { actual: '0.5%', previous: '0.5%', revisedFrom: '0.10%', date: tag(10), event: 'Employment Change YoY Final', source: 'tv', historyFull: [] },
      },
      AUD: { 'Core CPI': { actual: '3.60%', date: tag(27), event: 'Core CPI (Trading Economics)', source: 'tepage', ref: 'august 2026', historyFull: [[tag(27), '3.60%', null]] } },
      JPY: { 'JOLTS Job Openings': { actual: '787K', date: tag(58), event: 'Job Vacancies (Trading Economics)', source: 'tepage', ref: null, historyFull: [[tag(58), '787K', null]] } },
      _histChunksFetched: 84,
    };
    const tep = [
      { source: 'tepage', country: 'CHF', key: 'corecpi', ind: 'Core CPI', label: null, actual: '0.50%', previous: null, forecast: null, date: null, ref: 'september 2026' },
      { source: 'tepage', country: 'AUD', key: 'corecpi', ind: 'Core CPI', label: null, actual: '3.70%', previous: '3.60%', forecast: null, date: null, ref: 'september 2026' },
      { source: 'tepage', country: 'EUR', key: 'mfg', ind: 'Manufacturing PMI', label: null, actual: '52.40', previous: '52.90', forecast: null, date: tag(4), ref: 'october 2026' },
      { source: 'tepage', country: 'CAD', key: 'svc', ind: 'Services PMI', label: null, actual: '48.30', previous: '46.80', forecast: null, date: tag(1), ref: 'september 2026' },
    ];
    const w = (f, x) => fs.writeFileSync(path.join(dir, f), JSON.stringify(x));
    w('tv_wide.json', wide); w('tv_recent.json', wide.filter(e => Date.now() - Date.parse(e.date) < 45 * 864e5)); w('tv_hist_0.json', hist0);
    for (let k = 1; k < 5; k++) w(`tv_hist_${k}.json`, [ev('JP', 'Unemployment Rate', 100 + 60 * k, '2.5', '2.5', '2.5')]);
    w('ind_data.json', prev); w('te_pages.json', tep);
    fs.writeFileSync(path.join(dir, 'agg.js'), code);
    const r = cp.spawnSync(process.execPath, ['agg.js'], { cwd: dir, env: Object.assign({}, process.env, { CHUNKS_DONE: '84', TARGET_CHUNKS: '84' }), encoding: 'utf8' });
    let out = null;
    try { out = JSON.parse(fs.readFileSync(path.join(dir, 'ind_data.json'), 'utf8')); } catch (e) { fail('AGGREGATION', 'Block lief nicht durch: ' + String(r.stderr || e.message).slice(0, 300)); }
    fs.rmSync(dir, { recursive: true, force: true });
    if (out) {
      const g = (c, k) => (out[c] || {})[k] || {};
      const soll = (name, ist, erwartet) => { if (JSON.stringify(ist) !== JSON.stringify(erwartet)) fail(name, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(erwartet)}`); };
      soll('VORWERT REVIDIERT (NZD BIP)', [g('NZD', 'GDP Growth QoQ').previous, g('NZD', 'GDP Growth QoQ').revisedFrom], ['0.9%', '0.8%']);
      // tag(95) = Grenze zwischen tv_wide (0-95) und tv_hist_0 (95-155): beide
      // geladen, TV fuehrt dort nichts -> muss weg (Fremdpunkt der alten Reihe)
      soll('UMDATIERTER RELEASE (NZD Konsumklima)', [(g('NZD', 'Consumer Confidence').historyFull || []).map(h => h[0]), g('NZD', 'Consumer Confidence').revisedFrom || null], [[tag(133), tag(42)], null]);
      soll('STUFEN-RELEASE (EUR CPI Final)', [g('EUR', 'CPI (Headline)').previous, g('EUR', 'CPI (Headline)').revisedFrom || null], ['3.2%', null]);
      soll('FREMDREIHE AM SELBEN TAG (USD Retail)', g('USD', 'Retail Sales').actual, '0.8%');
      soll('REVISION BLEIBT IM RELEASE (USD NFP)', [g('USD', 'NFP / Employment Change').previous, g('USD', 'NFP / Employment Change').revisedFrom], ['133K', '162K']);
      soll('TE-DATUM GESPEICHERT (CHF Core CPI)', [g('CHF', 'Core CPI').date, (g('CHF', 'Core CPI').historyFull || []).length], [tag(25), 2]);
      soll('TE-DATUM ERSTMALS GESEHEN (AUD Core CPI)', [g('AUD', 'Core CPI').date, (g('AUD', 'Core CPI').historyFull || []).length], [new Date().toISOString().slice(0, 10), 2]);
      soll('TE-HISTORIE WAECHST (EUR PMI)', (g('EUR', 'Manufacturing PMI').historyFull || []).map(h => h[1]), ['52.90', '52.40']);
      soll('FREMDE REVISION NICHT WEITERGETRAGEN (EUR Beschaeftigung)', [g('EUR', 'NFP / Employment Change').actual, g('EUR', 'NFP / Employment Change').previous, g('EUR', 'NFP / Employment Change').revisedFrom || null], ['0.1%', '0.1%', null]);
      soll('S&P NICHT IN IVEY (CAD)', g('CAD', 'Services PMI').actual, '58.2');
      soll('TE-REIHE OHNE ABRUF BLEIBT (JPY offene Stellen)', g('JPY', 'JOLTS Job Openings').actual || null, '787K');
    }
  }
}

// ── E) NZD Core CPI = Non-tradables aus der Stats-NZ-CSV (2026-10-27) ─────
{
  const i = y.indexOf('c[0]==="CPIQ.SE9NS6500"');
  const a = y.lastIndexOf("node -e '\n", i), b = y.indexOf("\n          '\n", i);
  let code = (i < 0 || a < 0 || b < 0) ? null : y.slice(a + 9, b);
  if (!code) fail('NON-TRADABLES', 'Schritt mit Reihe CPIQ.SE9NS6500 nicht gefunden');
  if (code && GEGENPROBE) code = code.split('CPIQ.SE9NS6500').join('CPIQ.SE9A');
  if (code) {
    const os = require('os'), cp = require('child_process');
    const lauf = (mitCsv) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedregeln-nt-'));
      const IDX = { '2024.09': 1350, '2024.12': 1360, '2025.03': 1380, '2025.06': 1390, '2025.09': 1406, '2025.12': 1410, '2026.03': 1430, '2026.06': 1438, '2026.09': 1453 };
      const kopf = '"Series_reference","Period","Data_value","STATUS","UNITS","Subject","Group","Series_title_1","Series_title_2"';
      const z = (ref, q, v, t) => `"${ref}","${q}",${v},"FINAL","Index","CPI","x","${t}",NA`;
      const csv = [kopf, ...Object.entries(IDX).map(([q, v]) => z('CPIQ.SE9A', q, v - 100, 'All groups')), ...Object.entries(IDX).map(([q, v]) => z('CPIQ.SE9NS6500', q, v, 'Non-Tradable All Groups'))].join('\n');
      if (mitCsv) fs.writeFileSync(path.join(dir, 'nt_2026.09.csv'), csv);
      const cpi = ['2025-10-16', '2026-01-22', '2026-04-20', '2026-07-20', '2026-10-21'].map(d => [d, '3%', null]);
      fs.writeFileSync(path.join(dir, 'ind_data.json'), JSON.stringify({ NZD: { 'CPI (Headline)': { actual: '3.7%', historyFull: cpi } } }));
      fs.writeFileSync(path.join(dir, 'nt_prev.json'), JSON.stringify({ NZD: { 'Core CPI': { actual: '3.4%', date: '2026-07-20', source: 'statsnz', historyFull: [] } } }));
      fs.writeFileSync(path.join(dir, 'nt.js'), code);
      cp.spawnSync(process.execPath, ['nt.js'], { cwd: dir, encoding: 'utf8' });
      let o = null; try { o = JSON.parse(fs.readFileSync(path.join(dir, 'ind_data.json'), 'utf8')); } catch (e) {}
      fs.rmSync(dir, { recursive: true, force: true });
      return ((o || {}).NZD || {})['Core CPI'] || {};
    };
    const e = lauf(true);
    const ist = [e.actual, e.previous, e.date, e.ref, (e.historyFull || []).length];
    if (JSON.stringify(ist) !== JSON.stringify(['3.3%', '3.5%', '2026-10-21', '2026.09', 5])) fail('NON-TRADABLES', `ist ${JSON.stringify(ist)}, soll ["3.3%","3.5%","2026-10-21","2026.09",5] (1453/1406, 1438/1390, Termin = NZD-CPI-Release)`);
    const leer = lauf(false);
    if (leer.actual !== '3.4%') fail('NON-TRADABLES', `ohne Datei muss der letzte Stand bleiben (3.4%), ist ${leer.actual}`);
  }
}

let keinRelease = null;
if (kein) { try { keinRelease = new Function(kein + '\nreturn keinRelease;')(); } catch (e) { fail('BEREINIGUNG', 'nicht auswertbar: ' + e.message); } }
if (keinRelease) {
  const d = arr => arr.map(h => h[0]).join(',');
  // echte Punkte aus ind_data.json (Stand 2026-10-07)
  const nfp = [['2026-07-02', '57K', '110K'], ['2026-08-07', '-23K', '80K'], ['2026-08-28', '-79K', null], ['2026-09-04', '162K', '56K'], ['2026-10-02', '29K', null]];
  const nfpIst = keinRelease('USD|NFP / Employment Change', nfp);
  if (d(nfpIst) !== '2026-07-02,2026-08-07,2026-09-04,2026-10-02') fail('NFP-BEREINIGUNG', `${d(nfpIst)} - erwartet ohne 2026-08-28 (Benchmark-Revision), aber MIT 2026-10-02 (regulaer, nur Prognose fehlt)`);
  const pmi = [['2026-08-21', '53.2', '53.9'], ['2026-09-01', '54.6', '55.2'], ['2026-09-23', '57', '53.6'], ['2026-10-01', '54.5', '55']];
  const pmiIst = keinRelease('USD|Manufacturing PMI', pmi);
  if (d(pmiIst) !== '2026-09-01,2026-10-01') fail('ISM-BEREINIGUNG', `${d(pmiIst)} - erwartet nur die ISM-Termine 2026-09-01, 2026-10-01`);
  const svc = keinRelease('USD|Services PMI', [['2026-09-03', '55.4', '54.3'], ['2026-09-23', '58.7', '56'], ['2026-10-05', '54.9', '55']]);
  if (d(svc) !== '2026-09-03,2026-10-05') fail('ISM-BEREINIGUNG', `Services ${d(svc)}`);
  const eur = keinRelease('EUR|Manufacturing PMI', pmi);
  if (eur.length !== pmi.length) fail('FREMDE REIHE BEREINIGT', `EUR Manufacturing PMI verlor ${pmi.length - eur.length} Punkt(e) - die Regel gilt nur fuer die US-ISM-Reihen`);
  // C) Info: was der naechste Lauf an der aktuellen Datei bereinigt
  try {
    const ind = JSON.parse(fs.readFileSync(path.join(ROOT, 'ind_data.json'), 'utf8'));
    const info = [];
    ['NFP / Employment Change', 'Manufacturing PMI', 'Services PMI'].forEach(k => {
      const h = ((ind.USD || {})[k] || {}).historyFull || [];
      const weg = h.length - keinRelease('USD|' + k, h).length;
      if (weg) info.push(`USD ${k}: ${weg}`);
    });
    if (info.length) console.log('  (Info: der naechste Workflow-Lauf entfernt aus ind_data.json ' + info.join(', ') + ' Punkt(e))');
  } catch (e) {}
}

// ── A3) App-Muster = Feed-Regeln (2026-11-07) ────────────────────────────
// Die App ordnet Kalenderzeilen mit js/event-matchers.js eigenen Indikatoren
// zu (Faerbung, Next-Termin). Dieselben Zweitfassungen, die der Feed seit
// 2026-11-07 ausschliesst, muss auch die App ausschliessen - sonst zeigt sie
// am selben Tag die andere Zahl als der Score.
(async () => {
  try {
    const M = (await import(require('url').pathToFileURL(path.join(ROOT, 'js', 'event-matchers.js')).href)).IND_EVENT_MATCHERS;
    const APP = [
      ['CPI (Headline)', 'Inflation Rate MoM', 'USD', true], ['CPI (Headline)', 'Inflation Rate MoM NSA', 'USD', false],
      ['CPI (Headline)', 'Inflation Rate YoY s.a', 'CAD', false], ['Unemployment Rate', 'Unemployment Rate', 'CHF', true],
      ['Unemployment Rate', 'Unemployment Rate s.a', 'CHF', false], ['Services PMI', 'Ivey PMI s.a', 'CAD', true],
      ['Services PMI', 'Ivey PMI', 'CAD', false], ['Consumer Confidence', 'GfK Consumer Confidence', 'GBP', true],
      ['Consumer Confidence', 'Consumer Confidence Index', 'GBP', true], ['Consumer Confidence', 'LSEG/Ipsos Primary Consumer Sentiment Index', 'GBP', false],
      ['Central Bank Rate', 'Interest Rate', 'USD', true], ['Central Bank Rate', 'Interest Rate on Reserve Balances', 'USD', false], ['Avg Hourly Earnings', 'Wage Growth YoY', 'AUD', true],
      ['Money Supply', 'M3 Money Supply Annual Growth', 'EUR', true], ['Money Supply', 'M3 Money Supply YoY', 'EUR', false], ['Consumer Confidence', 'Consumer Confidence', 'CHF', true],
      ['Consumer Confidence', 'Consumer Confidence s.a', 'CHF', false], ['Consumer Confidence', 'Westpac Consumer Confidence Index', 'AUD', true],
    ];
    APP.forEach(([ind, t, c, soll]) => { const ist = !!(M[ind] && M[ind](t, c)); if (ist !== soll) fail('APP-MUSTER', `js/event-matchers.js: ${c} "${t}" ${ist ? 'trifft' : 'trifft nicht'} ${ind} - anders als der Indikator-Feed`); });
  } catch (e) { fail('APP-MUSTER', 'js/event-matchers.js nicht ladbar: ' + e.message); }
if (GEGENPROBE) {
    const ok = F.some(x => x.startsWith('FREMDER RELEASE')) && F.some(x => x.startsWith('SELBER TAG')) &&
      F.some(x => x.startsWith('VORWERT REVIDIERT')) && F.some(x => x.startsWith('UMDATIERTER RELEASE')) && F.some(x => x.startsWith('NON-TRADABLES')) &&
      F.some(x => x.startsWith("EIGENER RELEASE FEHLT") && /Interest Rate/.test(x));
    console.log(ok ? 'feedregeln --gegenprobe: ok (alte Regeln: Benchmark-Revision, S&P-Flash, Control Group; alte Aggregation: Erstdruck als Vorwert, Doppelpunkt bleibt - alles gemeldet)' : 'feedregeln --gegenprobe: FEHLER - nicht gemeldet\n  ' + F.join('\n  '));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`feedregeln: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log('feedregeln: ok (Indikator-Feed: NFP ohne Benchmark-Revision, US-PMI nur ISM, kein Tag mit zwei Titeln je Reihe, revidierter Vorwert, keine umdatierten/fremden Historienpunkte, TE-Datum und -Historie stabil; Bereinigung entfernt genau die eingeschleppten Punkte)');
})();
