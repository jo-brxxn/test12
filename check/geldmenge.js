// ── WAECHTER: MONEY SUPPLY (Geldmenge) BEI ALLEN ACHT WAEHRUNGEN ───────────────
// Nutzer 2026-11-01: "Ergaenz noch ueberall den Indikator m3 money supply bei
// inflation" - per Rueckfrage EUR/GBP/USD im Score (gegen die Messung) und die
// uebrigen fuenf ueber die Quellen der Zentralbanken (tools/geldmenge.mjs).
// Geprueft am ECHTEN Code (Workflow, Skript, App) und echten TV-Titeln (cal_hist):
//   A) Regeln: EUR = "M3 Money Supply Annual Growth" (bis 10/2026 "... YoY", fuehrt seither den Bestand), GBP = "M4 Money Supply MoM";
//      USD kommt NICHT mehr aus TV (seit 2026-11-23 Fed H.6) - kein USD-Titel
//      darf als Money Supply gelesen werden (EINE Quelle je Zeile)
//   B) Jahresraten aus Bestaenden (jahresraten() in tools/geldmenge.mjs):
//      nur wo Bestand UND Vorjahresbestand echt da sind, Luecke bleibt Luecke;
//      USD liest M2.M aus dem Fed-Paket, NZD Broad money MCA.MDB.BM
//   C) Zentralbank-Schritt: Skript mit USD/JPY/CHF/AUD/CAD/NZD und ihren Reihen,
//      Eintraege mit datumArt "ref", Schritt mit continue-on-error + Vorstand
//   D) App: Zeile fuer alle acht Waehrungen mit Anzeigenamen, Kalender-Muster nur
//      Termin, Price-Karte setzt bei datumArt "ref" nur den juengsten Pfeil,
//      Score-Modell 31 mit Journal-Zeile
// Gegenprobe: --gegenprobe (Rate ohne Vorjahresbezug, Price-Karte ohne
//   ref-Regel) -> B und D rot
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GP = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const lies = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let y = lies('.github/workflows/update-ff-calendar.yml');
let mg = lies('tools/geldmenge.mjs');
let pk = lies('js/preiskarte.js');
const main = lies('js/main.js'), em = lies('js/event-matchers.js'), score = lies('js/score.js'), jr = lies('js/journal.js');
const M_RATE = 'filter(ym => lv[vorJahr(ym)] > 0 && lv[ym] > 0)';
const M_REF = "const nurJuengster=!!(f&&f.datumArt==='ref'&&f.date&&f.actual!=null);";
if (GP) {
  if (!mg.includes(M_RATE) || !pk.includes(M_REF)) { console.log('geldmenge: Gegenprobe - Marke nicht gefunden'); process.exit(1); }
  mg = mg.replace(M_RATE, 'filter(ym => lv[ym] > 0)'); pk = pk.replace(M_REF, 'const nurJuengster=false;');
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const ev = [];
fs.readdirSync(path.join(ROOT, 'cal_hist')).filter(f => /^\d{4}\.json$/.test(f)).forEach(f => (JSON.parse(lies('cal_hist/' + f)).ev || []).forEach(e => ev.push(e)));

// ── A) Regeln ──
{
  const i = y.indexOf('const EXCORE='), j = y.indexOf('];', y.indexOf('const RULES=[', i));
  let RULES = null;
  try { RULES = new Function('return (()=>{' + y.slice(i, j + 2) + ' return RULES;})()')(); } catch (e) { fail('A', 'RULES nicht lesbar: ' + e.message); }
  if (RULES) {
    const wer = (t, c) => RULES.filter(r => r.test(norm(t), c)).map(r => r.ind);
    const soll = [['M3 Money Supply Annual Growth', 'EUR'], ['M4 Money Supply MoM', 'GBP']];
    soll.forEach(([t, c]) => { const w = wer(t, c); if (w.join() !== 'Money Supply') fail('A', `"${t}" (${c}) -> ${JSON.stringify(w)} statt nur Money Supply`); });
    const nie = [['Money Supply', 'USD'], ['US M2 Money Supply YoY', 'USD'], ['M2 Money Supply YoY', 'USD'], ['M3 Money Supply 3M', 'EUR'], ['M2 Money Supply YoY', 'CNY'], ['M4 Money Supply YoY', 'GBP']];
    if (/usM2Jahresrate\(\)\{/.test(y)) fail('A', 'usM2Jahresrate() rechnet noch im Workflow - zweite Quelle fuer USD');
    nie.forEach(([t, c]) => { const w = wer(t, c).filter(x => x === 'Money Supply'); if (w.length) fail('A', `"${t}" (${c}) wird als Money Supply gelesen`); });
  }
}
// ── B) Jahresraten aus Bestaenden ──
{
  const i = mg.indexOf('function jahresraten(lv)'), j = mg.indexOf('\n}\n', i);
  if (i < 0) fail('B', 'jahresraten() fehlt in tools/geldmenge.mjs');
  else {
    const vorJahr = ym => { const [a, m] = ym.split('-'); return (+a - 1) + '-' + m; };
    let jr_ = null;
    try { jr_ = new Function('vorJahr', mg.slice(i, j + 2) + '\nreturn jahresraten;')(vorJahr); } catch (e) { fail('B', 'nicht ausfuehrbar: ' + e.message); }
    if (jr_) {
      const lv = { '2024-01': 100, '2024-02': 110, '2025-01': 105, '2025-02': 121, '2025-03': 130 };   // 2025-03 ohne Vorjahr
      const r = JSON.stringify(jr_(lv).map(([ym, v]) => [ym, +v.toFixed(2)]));
      if (r !== '[["2025-01",5],["2025-02",10]]') fail('B', `Jahresraten ${r} statt [["2025-01",5],["2025-02",10]] (Monat ohne Vorjahresbestand darf keinen Wert bekommen)`);
    }
  }
  if (!/SERIES_NAME="M2\\\.M"/.test(mg) || !mg.includes('datadownload/Output.aspx?rel=H6&filetype=zip')) fail('B', 'USD: Fed-H.6-Paket bzw. Reihe M2.M fehlt');
  if (!mg.includes("'MCA.MDB.BM'") || !mg.includes('hc50-long-run.xlsx')) fail('B', 'NZD: RBNZ Broad money (MCA.MDB.BM, C50 long run) fehlt');
}
// ── C) Zentralbank-Schritt ──
{
  ['USD', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD'].forEach(c => { if (!new RegExp('async ' + c + '\\((alt)?\\)').test(mg)) fail('C', `Quelle ${c} fehlt in tools/geldmenge.mjs`); });
  [['snbmonagg', 'CHF SNB'], ['DGFAM312', 'AUD RBA D1'], ['M2PP_12MTH', 'CAD BoC M2++'], ['md02_m_1_en', 'JPY BoJ'], ['new-zealand/money-supply-m3', 'NZD (TE)']].forEach(([s, n]) => { if (!mg.includes(s)) fail('C', `${n}: ${s} fehlt`); });
  if (!/datumArt: 'ref'/.test(mg)) fail('C', 'Eintraege ohne datumArt "ref"');
  const k = y.indexOf('- name: Fetch money supply (central banks)');
  const schritt = k < 0 ? '' : y.slice(k, y.indexOf('- name:', k + 10));
  if (!schritt) fail('C', 'Workflow-Schritt "Fetch money supply" fehlt');
  else if (!/continue-on-error: true/.test(schritt) || !/mg_prev\.json/.test(schritt) || !/node tools\/geldmenge\.mjs/.test(schritt)) fail('C', 'Schritt ohne continue-on-error, Vorstand oder Skript-Aufruf');
}
// ── D) App ──
{
  { const df = lies('js/data-feeds.js'), q = [...mg.matchAll(/quelle: '(\w+)'/g)].map(m => m[1]).filter(x => x !== 'te');
    q.forEach(k => { if (!new RegExp('\\n  ' + k + ":'https://").test(df)) fail('D', `Quellen-Link fuer "${k}" fehlt in FEED_QUELLE_LINK (Zeile zeigte tradingview.com)`); });
    if (!/const src=FEED_QUELLE_LINK\[f\.source\]\|\|/.test(df)) fail('D', 'Quellen-Link liest f.source nicht'); }
  if (!/\['Money Supply',\['USD','EUR','GBP','CHF','JPY','CAD','AUD','NZD'\]\]/.test(main)) fail('D', 'Money Supply nicht fuer alle acht Waehrungen angelegt');
  ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'].forEach(c => { if (!new RegExp('\\n  ' + c + ":\\{'Money Supply':'(M|Broad Money)").test(main)) fail('D', `${c}: Anzeigename fehlt`); });
  if (!em.includes("IND_EVENT_MATCHERS['Money Supply'].nurTermin=true;")) fail('D', 'Kalender-Muster liefert auch den Wert (USD-Bestand!)');
  if (!pk.includes(M_REF)) fail('D', 'Price-Karte: datumArt "ref" setzt Pfeile auf Monatsenden statt auf den Release');
  if (!(+(score.match(/const SCORE_MODEL_VERSION=(\d+);/) || [])[1] >= 31) || !/\n\s+31:'new row Money Supply/.test(jr)) fail('D', 'Score-Modell 31 oder Journal-Zeile fehlt');
}

if (GP) { console.log(F.length ? `geldmenge: Gegenprobe ok - ${F.length} Befund(e) rot, wie erwartet:\n  ` + F.join('\n  ') : 'geldmenge: Gegenprobe FEHLGESCHLAGEN - Waechter bleibt gruen'); process.exit(F.length ? 0 : 1); }
if (F.length) { console.log('geldmenge: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
console.log('geldmenge: ok (Regeln EUR M3 / GBP M4, kein USD aus TV, Jahresraten aus Bestaenden nachgerechnet, USD Fed M2.M, NZD RBNZ Broad money, Zentralbank-Schritt USD/JPY/CHF/AUD/CAD/NZD, App-Zeile x8, nur Termin aus dem Kalender, Pfeil am Release, Modell 31)');
