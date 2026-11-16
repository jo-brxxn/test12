// ── ALTE KERZEN AUSLAGERN: price_data.json -> price_ohlc.json (seit 2026-11-16) ──
// Nutzer 2026-11-16: "Es werden ja nur die letzt 100 Tage oder so an Preis gebraucht
// fuer Score der Rest kann ja in eine andere Datei und bei Bedarf geladen werden".
// Gemessen: 100 Tage reichen NICHT (Marktrelevanz braucht >= 5 Release-Tage je Indikator,
// ein Monats-Indikator hat in 100 Tagen 3). Der Score braucht aber nur den SCHLUSS.
// Die Kerze (Open/High/Low) macht die Datei gross. Deshalb:
//   price_data.json  = jeder Tag mit Schluss; Open/High/Low nur fuer die letzten KERZEN_TAGE
//   price_ohlc.json  = Open/High/Low aller aelteren Tage, laedt die App erst, wenn ein Chart
//                      weiter zurueck zeigt (ladeKerzenArchiv in js/data-feeds.js)
// Gemessen am 2026-11-16: price_data.json 896 -> 640 KB, hochgerechnet aufs volle
// 1100-Punkte-Fenster 1167 -> 817 KB. price_ohlc.json 416 KB.
// Laeuft nach JEDEM Schreiber von price_data.json (stuendlicher Feed, Yahoo-Backfill,
// backfill-ohlc.yml). Idempotent: ein zweiter Lauf aendert nichts.
// ⚠ Der Score bleibt gleich auf jedem Geraet: er liest nur price_data.json
// (priceSeriesFor), nie das Archiv - sonst haenge er davon ab, ob jemand einen Chart
// geoeffnet hat.
import fs from 'node:fs';
export const KERZEN_TAGE = 183;
const D = process.argv.slice(2).find(x => !x.startsWith('--')) || '.';
const pf = D + '/price_data.json', af = D + '/price_ohlc.json';
let pd, ar = { assets: {} };
try { pd = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch (e) { console.log('kerzen-auslagern: price_data.json unlesbar - nichts geaendert (' + e.message + ')'); process.exit(0); }
try { const a = JSON.parse(fs.readFileSync(af, 'utf8')); if (a && a.assets && typeof a.assets === 'object') ar = a; } catch (e) { }
// --einlesen: Archiv zurueck in price_data.json (vor backfill-ohlc.yml, damit dessen
// "Tage mit Kerze ueberspringen" weiter greift). Danach immer ohne Flag erneut aufrufen.
if (process.argv.includes('--einlesen')) {
  let n = 0;
  Object.keys(ar.assets).forEach(id => {
    const s = pd[id] && pd[id].series; if (!Array.isArray(s)) return;
    const m = new Map(ar.assets[id].map(e => [e[0], e]));
    pd[id].series = s.map(e => { const x = Array.isArray(e) && e.length < 5 && m.get(e[0]); if (!x) return e; n++; return [e[0], e[1], x[1], x[2], x[3]]; });
  });
  fs.writeFileSync(pf, JSON.stringify(pd));
  console.log('kerzen-auslagern --einlesen: ' + n + ' Kerzen zurueck in price_data.json');
  process.exit(0);
}
const heute = new Date().toISOString().slice(0, 10);
const ab = new Date(Date.now() - KERZEN_TAGE * 864e5).toISOString().slice(0, 10);
let raus = 0, alt = 0;
const neu = {};
Object.keys(pd).forEach(id => {
  const s = pd[id] && pd[id].series;
  if (!Array.isArray(s)) return;
  const m = new Map((ar.assets[id] || []).map(e => [e[0], e]));
  const tage = new Set();
  pd[id].series = s.map(e => {
    if (!Array.isArray(e)) return e;
    tage.add(e[0]);
    if (e[0] >= ab || e.length < 5) return e;
    m.set(e[0], [e[0], e[2], e[3], e[4]]); raus++;
    return [e[0], e[1]];
  });
  // nur Tage, die es in price_data.json noch gibt (deren Fenster ist 1100 Punkte)
  const l = [...m.values()].filter(e => tage.has(e[0]) && e[0] < ab).sort((a, b) => a[0] < b[0] ? -1 : 1);
  alt += m.size - l.length;
  if (l.length) neu[id] = l;
});
fs.writeFileSync(pf, JSON.stringify(pd));
fs.writeFileSync(af, JSON.stringify({ updated: heute, ab, note: 'Open/High/Low of daily candles BEFORE ab; [date,open,high,low], raw quote like price_data.json (same invert flag). Closes stay in price_data.json.', assets: neu }));
console.log(`kerzen-auslagern: ${raus} Kerzen vor ${ab} ausgelagert, ${alt} veraltete entfernt; price_data.json ${(fs.statSync(pf).size / 1024).toFixed(0)} KB, price_ohlc.json ${(fs.statSync(af).size / 1024).toFixed(0)} KB`);
