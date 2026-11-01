// ── WAECHTER: OIL INVENTORIES (OIL) + MPC VOTE SPLIT (GBP) ───────────────────
// Nutzer 2026-11-01: "fueg bei Oel den Indikator oil inventories hinzu bei
// economy und bei gbp die stimmverteilung die auch immer veroeffentlicht wird"
// - per Rueckfrage: Oil Inventories zaehlt halb; MPC Vote Split nach der
// Messung (kein Effekt, t -0,35) nur Anzeige (SCORE_ZERO).
// Der Indikator-Feed laeuft nur auf dem Runner; geprueft wird deshalb der
// ECHTE Code aus Workflow und App an echten TradingView-Titeln (cal_hist/):
//   A) der Workflow legt die drei Stimmen-Reihen jeder Sitzung zu EINEM
//      Ereignis "BoE MPC Vote Split" zusammen, Wert "Hike-Cut-Hold" (wie der
//      Forex-Factory-Kalender), 9 Stimmen je Sitzung (8 bei unbesetzter Stelle,
//      gemessen 2017), mindestens 70 Sitzungen
//   B) die Regeln treffen nur den eigenen Release: Oil Inventories = EIA-
//      Gesamtbestaende (nicht API, Cushing, Imports), MPC Vote Split = nur das
//      zusammengelegte Ereignis, keine der drei Einzelreihen
//   C) parseNumLike liest "7-0-2" als Netto 7, "0-5-4" als -5; Datum und
//      Millionen-Werte unveraendert
//   D) App: Oil Inventories nur bei OIL (Economic Growth), ihr Bias wird von
//      resetNonFxIndBias nicht zurueckgesetzt, halbes Gewicht; MPC Vote Split
//      unter dem Leitzins, sein Kalender-Muster liefert nur den Termin
// Gegenprobe: --gegenprobe (Netto-Regel und Bias-Ausnahme entfernt) -> C, D rot
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GP = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const lies = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const y = lies('.github/workflows/update-ff-calendar.yml');
let cal = lies('js/calendar.js'), main = lies('js/main.js');
const score = lies('js/score.js'), em = lies('js/event-matchers.js');
const M_V3 = 'if(v3)return Number(v3[1])-Number(v3[2]);';
const M_EIG = 'if(istAssetEigen(sym.id,ind.name))return;';
if (GP) {
  if (!cal.includes(M_V3) || !main.includes(M_EIG)) { console.log('mpcoel: Gegenprobe - Marke nicht gefunden'); process.exit(1); }
  cal = cal.replace(M_V3, ''); main = main.replace(M_EIG, '');
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ── echte TradingView-Titel aus dem Archiv ──
const ev = [];
fs.readdirSync(path.join(ROOT, 'cal_hist')).filter(f => /^\d{4}\.json$/.test(f)).forEach(f => {
  const d = JSON.parse(lies('cal_hist/' + f));
  (d.ev || []).forEach(e => ev.push(e));
});

// ── A) Zusammenlegen der Stimmen ──
{
  const i = y.indexOf('(function mpcVoteSplit(){'), j = y.indexOf('})();', i);
  if (i < 0 || j < 0) fail('A', 'mpcVoteSplit() im Workflow nicht gefunden');
  else {
    const evts = ev.filter(e => e[1] === 'GBP').map(e => ({ country: 'GB', title: e[2], date: e[0], actual: e[4], forecast: e[5], previous: e[6] }));
    const vorher = evts.length;
    const log = console.log; console.log = () => {};
    try { new Function('evts', 'norm', y.slice(i, j + 5))(evts, norm); } catch (e) { fail('A', 'Block wirft: ' + e.message); }
    console.log = log;
    const neu = evts.slice(vorher);
    const tage = new Set(ev.filter(e => e[1] === 'GBP' && /^BoE MPC Vote (Hike|Unchanged|Cut)$/.test(e[2]) && e[4] !== '').map(e => e[0].slice(0, 10)));
    if (neu.length < 70) fail('A', `nur ${neu.length} Sitzungen zusammengelegt (Archiv: ${tage.size} Tage)`);
    const schlecht = neu.filter(e => !/^\d-\d-\d$/.test(e.actual) || ![8, 9].includes(e.actual.split('-').reduce((s, v) => s + +v, 0)) || e.title !== 'BoE MPC Vote Split');
    if (schlecht.length) fail('A', `${schlecht.length} Sitzungen mit falschem Wert, z. B. ${JSON.stringify(schlecht[0])}`);
    // Folge Hike-Cut-Hold: Stichprobe 2026-09-17 = Hike 3, Cut 0, Hold 6
    const s = neu.find(e => String(e.date).startsWith('2026-09-17'));
    if (s && s.actual !== '3-0-6') fail('A', `2026-09-17 ergibt ${s.actual} statt 3-0-6 (Hike-Cut-Hold)`);
  }
}
// ── B) Regeln ──
{
  const i = y.indexOf('const EXCORE='), j = y.indexOf('];', y.indexOf('const RULES=[', i));
  let RULES = null;
  try { RULES = new Function('return (()=>{' + y.slice(i, j + 2) + ' return RULES;})()')(); } catch (e) { fail('B', 'RULES nicht lesbar: ' + e.message); }
  if (RULES) {
    const treffer = (ind, t, c) => RULES.some(r => r.ind === ind && r.test(norm(t), c));
    const oil = RULES.filter(r => r.ind === 'Oil Inventories'), mpc = RULES.filter(r => r.ind === 'MPC Vote Split');
    if (!oil.length || !mpc.length) fail('B', 'Regel fehlt (Oil Inventories / MPC Vote Split)');
    if (!treffer('Oil Inventories', 'EIA Crude Oil Stocks Change', 'USD')) fail('B', 'Oil Inventories trifft die EIA-Reihe nicht');
    ['API Crude Oil Stock Change', 'EIA Cushing Crude Oil Stocks Change', 'EIA Crude Oil Imports Change', 'API Weekly Crude Oil Stock', 'Business Inventories MoM'].forEach(t => { if (treffer('Oil Inventories', t, 'USD')) fail('B', `Oil Inventories trifft fremde Reihe "${t}"`); });
    if (!treffer('MPC Vote Split', 'BoE MPC Vote Split', 'GBP')) fail('B', 'MPC Vote Split trifft das zusammengelegte Ereignis nicht');
    ['BoE MPC Vote Hike', 'BoE MPC Vote Cut', 'BoE MPC Vote Unchanged', 'MPC Official Bank Rate Votes', 'BoE Interest Rate Decision'].forEach(t => { if (treffer('MPC Vote Split', t, 'GBP')) fail('B', `MPC Vote Split trifft "${t}"`); });
    // Andere Regeln duerfen die neuen Titel nicht fangen
    RULES.filter(r => r.ind !== 'MPC Vote Split').forEach(r => { if (r.test('boe mpc vote split', 'GBP')) fail('B', `${r.ind} trifft "BoE MPC Vote Split"`); });
    RULES.filter(r => r.ind !== 'Oil Inventories').forEach(r => { if (r.test('eia crude oil stocks change', 'USD')) fail('B', `${r.ind} trifft die EIA-Oelreihe`); });
  }
}
// ── C) Zahlen-Erkennung ──
{
  const i = cal.indexOf('function parseNumLikeRoh(s){'), j = cal.indexOf('\n}\n', i);
  let p = null;
  try { p = new Function(cal.slice(i, j + 3) + ' return parseNumLikeRoh;')(); } catch (e) { fail('C', 'parseNumLikeRoh nicht lesbar: ' + e.message); }
  if (p) [['7-0-2', 7], ['0-5-4', -5], ['3-0-6', 3], ['0-0-9', 0], ['2026-10-28', 2026], ['-1.892M', -1892000], ['229K', 229000], ['3.75%', 3.75]].forEach(([s, soll]) => {
    const ist = p(s);
    if (Math.abs(ist - soll) > 1e-6) fail('C', `parseNumLike("${s}") = ${ist}, soll ${soll}`);
  });
}
// ── D) App-Verdrahtung ──
{
  if (!/const ASSET_EIGENE_IND=\{OIL:\{'Economic Growth':\['Oil Inventories'\]\}\};/.test(main)) fail('D', 'ASSET_EIGENE_IND: Oil Inventories nicht (nur) bei OIL / Economic Growth');
  const r = main.indexOf('function resetNonFxIndBias(sym){'), r2 = main.indexOf('\n}\n', r);
  const rs = main.slice(r, r2);
  if (!rs.includes(M_EIG) || rs.indexOf(M_EIG) > rs.indexOf("if(derived&&ind.bias!=='neu')ind.bias='neu';")) fail('D', 'resetNonFxIndBias setzt den Bias der OIL-eigenen Zeile zurueck');
  if (!/const ASSET_EIGEN_HALB=new Set\(\['Oil Inventories'\]\);/.test(score) || !score.includes('if(ASSET_EIGEN_HALB.has(stripPeriodSuffix(ind.name).base))return true;')) fail('D', 'Oil Inventories zaehlt nicht halb');
  if (!/\['MPC Vote Split',\['GBP'\]\]/.test(main)) fail('D', 'MPC Vote Split nicht fuer GBP angelegt');
  if (!/const SCORE_ZERO=new Set\(\[[^\]]*'MPC Vote Split'/.test(score)) fail('D', 'MPC Vote Split zaehlt im Score (Nutzer-Entscheid: nur Anzeige)');
  if (!em.includes("IND_EVENT_MATCHERS['MPC Vote Split'].nurTermin=true;") || !main.includes('if(!matcher||matcher.nurTermin)return[];')) fail('D', 'MPC-Kalendermuster liefert auch den Wert (nurTermin fehlt)');
  if (!/const fx=fxAsset\|\|istAssetEigen\(c\.id,ind\.name\);/.test(lies('js/data-feeds.js'))) fail('D', 'applyIndDataFeed rechnet den Bias der OIL-eigenen Zeile nicht');
}

if (GP) { console.log(F.length ? `mpcoel: Gegenprobe ok - ${F.length} Befund(e) rot, wie erwartet:\n  ` + F.join('\n  ') : 'mpcoel: Gegenprobe FEHLGESCHLAGEN - Waechter bleibt gruen'); process.exit(F.length ? 0 : 1); }
if (F.length) { console.log('mpcoel: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
console.log('mpcoel: ok (MPC-Stimmen je Sitzung zusammengelegt als Hike-Cut-Hold, Regeln nur eigener Release, Netto-Stimmen gelesen, Oil Inventories nur OIL + halbes Gewicht + eigener Bias)');
