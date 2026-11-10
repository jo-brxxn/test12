// ── WAECHTER: MONEY SUPPLY (Geldmenge) BEI ALLEN ACHT WAEHRUNGEN ───────────────
// Nutzer 2026-11-01: "Ergaenz noch ueberall den Indikator m3 money supply bei
// inflation" - per Rueckfrage EUR/GBP/USD im Score (gegen die Messung) und die
// uebrigen fuenf ueber die Quellen der Zentralbanken (tools/geldmenge.mjs).
// Geprueft am ECHTEN Code (Workflow, Skript, App) und echten TV-Titeln (cal_hist):
//   A) Regeln: EUR = "M3 Money Supply Annual Growth" (bis 10/2026 "... YoY", fuehrt seither den Bestand), GBP = "M4 Money Supply MoM", USD nur
//      die zusammengesetzte Jahresrate - der M2-BESTAND ("Money Supply") nie
//      direkt; keine andere Regel faengt diese Titel
//   B) USD-Jahresrate (usM2Jahresrate) an den Bestaenden aus cal_hist: >= 12
//      Werte, jeder = Bestand / Bestand 11-13 Monate vorher, plausibel (-10..30 %)
//   C) Zentralbank-Schritt: Skript mit JPY/CHF/AUD/CAD/NZD und ihren Reihen,
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
let pk = lies('js/preiskarte.js');
const main = lies('js/main.js'), em = lies('js/event-matchers.js'), score = lies('js/score.js'), jr = lies('js/journal.js'), mg = lies('tools/geldmenge.mjs');
const M_RATE = 'if(v0&&st[v0]>0)rate[d]=(st[d]/st[v0]-1)*100;';
const M_REF = "const nurJuengster=!!(f&&f.datumArt==='ref'&&f.date&&f.actual!=null);";
if (GP) {
  if (!y.includes(M_RATE) || !pk.includes(M_REF)) { console.log('geldmenge: Gegenprobe - Marke nicht gefunden'); process.exit(1); }
  y = y.replace(M_RATE, 'if(st[d]>0)rate[d]=st[d]/1e12;'); pk = pk.replace(M_REF, 'const nurJuengster=false;');
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
    const soll = [['M3 Money Supply Annual Growth', 'EUR'], ['M4 Money Supply MoM', 'GBP'], ['US M2 Money Supply YoY', 'USD']];
    soll.forEach(([t, c]) => { const w = wer(t, c); if (w.join() !== 'Money Supply') fail('A', `"${t}" (${c}) -> ${JSON.stringify(w)} statt nur Money Supply`); });
    const nie = [['Money Supply', 'USD'], ['M3 Money Supply 3M', 'EUR'], ['M2 Money Supply YoY', 'CNY'], ['M4 Money Supply YoY', 'GBP']];
    nie.forEach(([t, c]) => { const w = wer(t, c).filter(x => x === 'Money Supply'); if (w.length) fail('A', `"${t}" (${c}) wird als Money Supply gelesen`); });
  }
}
// ── B) USD-Jahresrate aus dem Bestand ──
{
  const i = y.indexOf('(function usM2Jahresrate(){'), j = y.indexOf('})();', i);
  if (i < 0) fail('B', 'usM2Jahresrate() fehlt im Workflow');
  else {
    const F_ = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
    const evts = ev.filter(e => e[1] === 'USD' && e[2] === 'Money Supply' && e[4] !== '').map(e => { const m = String(e[4]).match(/^([\d.]+)([KMBT]?)$/); return m ? { country: 'US', title: 'Money Supply', date: e[0], actual: +m[1], scale: m[2] } : null; }).filter(Boolean);
    const vorher = evts.length, log = console.log; console.log = () => {};
    try { new Function('evts', 'norm', y.slice(i, j + 5))(evts, norm); } catch (e) { fail('B', 'Block wirft: ' + e.message); }
    console.log = log;
    const neu = evts.slice(vorher);
    // unabhaengig nachgerechnet
    const st = {}; evts.slice(0, vorher).forEach(e => { st[new Date(e.date).toISOString().slice(0, 10)] = e.actual * (F_[e.scale] || 1); });
    const tage = Object.keys(st).sort();
    let falsch = 0;
    neu.forEach(e => {
      const d = e.date.slice(0, 10), t = Date.parse(d);
      const v0 = tage.filter(x => { const a = (t - Date.parse(x)) / 864e5; return a >= 335 && a <= 395; }).pop();
      const soll = v0 ? ((st[d] / st[v0] - 1) * 100).toFixed(1) + '%' : null;
      if (e.actual !== soll || !(Math.abs(parseFloat(e.actual)) < 30)) falsch++;
    });
    if (neu.length < 12) fail('B', `nur ${neu.length} Jahresraten aus ${vorher} Bestaenden`);
    else if (falsch) fail('B', `${falsch} von ${neu.length} Jahresraten falsch (z. B. ${JSON.stringify(neu[neu.length - 1])})`);
  }
}
// ── C) Zentralbank-Schritt ──
{
  ['JPY', 'CHF', 'AUD', 'CAD', 'NZD'].forEach(c => { if (!new RegExp('async ' + c + '\\(\\)').test(mg)) fail('C', `Quelle ${c} fehlt in tools/geldmenge.mjs`); });
  [['snbmonagg', 'CHF SNB'], ['DGFAM312', 'AUD RBA D1'], ['M2PP_12MTH', 'CAD BoC M2++'], ['md02_m_1_en', 'JPY BoJ'], ['new-zealand/money-supply-m3', 'NZD (TE)']].forEach(([s, n]) => { if (!mg.includes(s)) fail('C', `${n}: ${s} fehlt`); });
  if (!/datumArt: 'ref'/.test(mg)) fail('C', 'Eintraege ohne datumArt "ref"');
  const k = y.indexOf('- name: Fetch money supply (central banks)');
  const schritt = k < 0 ? '' : y.slice(k, y.indexOf('- name:', k + 10));
  if (!schritt) fail('C', 'Workflow-Schritt "Fetch money supply" fehlt');
  else if (!/continue-on-error: true/.test(schritt) || !/mg_prev\.json/.test(schritt) || !/node tools\/geldmenge\.mjs/.test(schritt)) fail('C', 'Schritt ohne continue-on-error, Vorstand oder Skript-Aufruf');
}
// ── D) App ──
{
  if (!/\['Money Supply',\['USD','EUR','GBP','CHF','JPY','CAD','AUD','NZD'\]\]/.test(main)) fail('D', 'Money Supply nicht fuer alle acht Waehrungen angelegt');
  ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'].forEach(c => { if (!new RegExp('\\n  ' + c + ":\\{'Money Supply':'M").test(main)) fail('D', `${c}: Anzeigename fehlt`); });
  if (!em.includes("IND_EVENT_MATCHERS['Money Supply'].nurTermin=true;")) fail('D', 'Kalender-Muster liefert auch den Wert (USD-Bestand!)');
  if (!pk.includes(M_REF)) fail('D', 'Price-Karte: datumArt "ref" setzt Pfeile auf Monatsenden statt auf den Release');
  if (!/const SCORE_MODEL_VERSION=31;/.test(score) || !/\n\s+31:'new row Money Supply/.test(jr)) fail('D', 'Score-Modell 31 oder Journal-Zeile fehlt');
}

if (GP) { console.log(F.length ? `geldmenge: Gegenprobe ok - ${F.length} Befund(e) rot, wie erwartet:\n  ` + F.join('\n  ') : 'geldmenge: Gegenprobe FEHLGESCHLAGEN - Waechter bleibt gruen'); process.exit(F.length ? 0 : 1); }
if (F.length) { console.log('geldmenge: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
console.log('geldmenge: ok (Regeln EUR M3 / GBP M4 / USD-Jahresrate, USD-Rate aus Bestaenden nachgerechnet, Zentralbank-Schritt JPY/CHF/AUD/CAD/NZD, App-Zeile x8, nur Termin aus dem Kalender, Pfeil am Release, Modell 31)');
