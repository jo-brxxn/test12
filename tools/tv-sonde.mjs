// ══ SONDE: WAS FUEHRT TRADINGVIEWS KALENDER GERADE, UND TREFFEN ES DIE FEED-REGELN? ══
// Anlass 2026-11-10: seit dem Lauf vom 03.11. 16:22 fehlen neun Reihen in
// ind_data.json (Central Bank Rate USD/GBP/JPY/CAD, Avg Hourly Earnings
// EUR/AUD, Consumer Confidence GBP/NZD, Retail Sales JPY), EUR Money Supply
// fuehrt "17717267%". cal_hist zeigt neue Titel am selben Tag ("Interest
// Rate" neben "Fed Interest Rate Decision", "Consumer Confidence Index" neben
// "GfK Consumer Confidence", "M3 Money Supply Annual Growth" neben "... YoY")
// - cal_hist ist aber ein ARCHIV und behaelt Zeilen, die TradingView laengst
// nicht mehr fuehrt. Was TradingView JETZT liefert, sieht nur der Runner
// (aus der Claude-Umgebung gesperrt).
// Schreibt NICHTS in die Daten.   node tools/tv-sonde.mjs
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const LAENDER = 'US,EU,DE,GB,JP,CA,AU,NZ,CH';
const TV2CCY = { US: 'USD', EU: 'EUR', DE: 'EUR', GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF' };
const TAG = 864e5, jetzt = Date.now();
const iso = t => new Date(t).toISOString();
async function hole(vonTage, bisTage) {
  const url = `https://economic-calendar.tradingview.com/events?from=${iso(jetzt - vonTage * TAG)}&to=${iso(jetzt - bisTage * TAG)}&countries=${LAENDER}`;
  for (let v = 0; v < 3; v++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Origin: 'https://www.tradingview.com' } });
      const j = await r.json();
      const a = Array.isArray(j) ? j : (j && Array.isArray(j.result) ? j.result : null);
      if (a) return a;
    } catch (e) { }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}
const y = fs.readFileSync('.github/workflows/update-ff-calendar.yml', 'utf8');
const block = (s, e) => { const i = y.indexOf(s); if (i < 0) return ''; const j = y.indexOf(e, i); return y.slice(i, j + e.length); };
const { RULES, norm, period } = new Function(block('const norm=s=>', ';\n') + '\n' + block('const period=t=>{', '\n            };') + '\n' + block('const EXCORE=', ';\n') + '\n' + block('const RULES=[', '\n            ];') + '\nreturn {RULES,norm,period};')();

const spanne = a => { if (!a || !a.length) return 'leer'; const d = a.map(e => e.date).sort(); return `${a.length} Termine ${d[0].slice(0, 10)}..${d[d.length - 1].slice(0, 10)}`; };
// A) dieselben Fenster wie der Workflow + kurze Scheiben (schneidet die grosse Abfrage etwas ab?)
const wide = await hole(95, -2), recent = await hole(45, -2);
console.log('A) FENSTER  wide(95d):', spanne(wide), '| recent(45d):', spanne(recent));
const scheiben = [];
for (let k = 0; k < 10; k++) { const s = await hole(10 * (k + 1), 10 * k); scheiben.push(s || []); }
const sum = scheiben.reduce((n, s) => n + s.length, 0);
console.log('   10 Scheiben zu je 10 Tagen (0..100d): zusammen', sum, 'Termine | je Scheibe:', scheiben.map(s => s.length).join('/'));
const key = e => e.id || (e.country + '|' + e.title + '|' + e.date);
const alle = new Map();
[wide || [], recent || [], ...scheiben].forEach(a => a.forEach(e => alle.set(key(e), e)));
const U = [...alle.values()];
const inWide = new Set((wide || []).map(key)), inRecent = new Set((recent || []).map(key));
const fehltGross = U.filter(e => { const alt = (jetzt - Date.parse(e.date)) / TAG; return alt >= 0 && alt <= 95 && !inWide.has(key(e)) && !(alt <= 45 && inRecent.has(key(e))); });
console.log('   nur in den Scheiben, in wide/recent NICHT (0..95d):', fehltGross.length, fehltGross.slice(0, 6).map(e => e.date.slice(0, 10) + ' ' + e.country + ' ' + e.title).join(' ; '));

// B) Treffer der Regeln je Reihe (veroeffentlichte Werte, Vereinigung aller Fenster)
const wert = e => e.actual == null || e.actual === '' ? null : String(e.actual) + (e.unit === '%' ? '%' : (e.scale || ''));
const treffer = {};
U.forEach(e => {
  const ccy = TV2CCY[e.country]; if (!ccy || wert(e) == null) return;
  const t = norm(e.title || e.indicator || ''), per = period(e.title || e.indicator || '');
  RULES.forEach(r => { if (!r.test(t, ccy)) return; if (r.period && per && r.period !== per) return; if (r.period && !per) return; (treffer[ccy + '|' + r.ind] = treffer[ccy + '|' + r.ind] || []).push(e); });
});
const SOLL = JSON.parse(fs.readFileSync('ind_data.json', 'utf8'));
const VERLOREN = ['USD|Central Bank Rate', 'GBP|Central Bank Rate', 'JPY|Central Bank Rate', 'CAD|Central Bank Rate', 'EUR|Avg Hourly Earnings', 'AUD|Avg Hourly Earnings', 'GBP|Consumer Confidence', 'NZD|Consumer Confidence', 'JPY|Retail Sales'];
console.log('\nB) REGEL-TREFFER (0..100d) je Reihe: Anzahl, letzter Termin, Titel, Wert');
const reihen = new Set([...Object.keys(treffer), ...VERLOREN]);
Object.keys(SOLL).forEach(c => { if (!c.startsWith('_')) Object.keys(SOLL[c]).forEach(k => { if (SOLL[c][k] && SOLL[c][k].source !== 'tepage' && SOLL[c][k].source !== 'te') reihen.add(c + '|' + k); }); });
[...reihen].sort().forEach(k => {
  const L = (treffer[k] || []).sort((a, b) => a.date < b.date ? 1 : -1);
  const tit = [...new Set(L.map(e => e.title))];
  console.log('   ' + (L.length ? '  ' : '!!') + ' ' + k.padEnd(30) + String(L.length).padStart(3) + '  ' + (L.length ? L[0].date.slice(0, 10) + ' ' + wert(L[0]) + ' | ' + tit.slice(0, 4).join(' ; ') : 'KEIN TREFFER'));
});

// C) Was TradingView zu den Themen der verlorenen Reihen fuehrt (alle Titel, mit und ohne Wert)
const THEMEN = [
  ['Zins', /interest rate|rate decision|bank rate|cash rate|policy rate|funds rate|overnight rate|deposit/i, /mortgage|on reserve|loan prime|lending|repo|saving|credit card|auction|bill|bond|note/i, ['USD', 'GBP', 'JPY', 'CAD', 'EUR', 'AUD', 'NZD', 'CHF']],
  ['Loehne', /wage|earnings|labou?r cost|compensation|pay /i, null, ['EUR', 'AUD', 'CHF']],
  ['Konsumklima', /consumer confidence|consumer sentiment|gfk|roy morgan|westpac/i, null, ['GBP', 'NZD']],
  ['Einzelhandel', /retail/i, null, ['JPY']],
  ['Geldmenge', /\bm[234]\b|money supply|money stock/i, null, ['EUR', 'GBP', 'USD']],
];
console.log('\nC) TITEL ZU DEN THEMEN (0..100d): Waehrung(Land) Titel | n | erster..letzter | letzter Wert/Prognose/Vorwert');
THEMEN.forEach(([name, rx, aus, ccys]) => {
  console.log('  [' + name + ']');
  const g = {};
  U.forEach(e => { const c = TV2CCY[e.country]; if (!ccys.includes(c)) return; const t = e.title || e.indicator || ''; if (!rx.test(t) || (aus && aus.test(t))) return; (g[c + '(' + e.country + ') ' + t] = g[c + '(' + e.country + ') ' + t] || []).push(e); });
  Object.keys(g).sort().forEach(k => { const L = g[k].sort((a, b) => a.date < b.date ? -1 : 1), l = L[L.length - 1]; console.log('    ' + k + ' | ' + L.length + ' | ' + L[0].date.slice(0, 10) + '..' + l.date.slice(0, 10) + ' | ' + [wert(l), l.forecast, l.previous].join(' / ') + (l.unit ? ' ' + l.unit : '') + (l.scale ? ' ' + l.scale : '')); });
});

// D) Neue Titel: erster Termin der letzten 100 Tage nach dem 15.10., mit Wert - Umfang der Umbenennungen
const erst = {};
U.forEach(e => { const c = TV2CCY[e.country]; if (!c) return; const k = c + '(' + e.country + ') ' + (e.title || ''); (erst[k] = erst[k] || []).push(e); });
const neu = Object.keys(erst).filter(k => { const L = erst[k]; const d = L.map(e => e.date).sort(); return d[0] >= '2026-10-15' && L.some(e => wert(e) != null) && d[0] <= iso(jetzt); }).sort();
console.log('\nD) TITEL, DIE ES IN DEN LETZTEN 100 TAGEN ERST SEIT DEM 15.10. GIBT (mit Wert):', neu.length);
neu.slice(0, 150).forEach(k => { const L = erst[k].sort((a, b) => a.date < b.date ? -1 : 1), l = L[L.length - 1]; console.log('    ' + k + ' | ' + L.length + ' | ' + L[0].date.slice(0, 10) + ' | ' + [wert(l), l.forecast, l.previous].join(' / ')); });
