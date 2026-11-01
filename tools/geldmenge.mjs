// ══ GELDMENGE (Money Supply) AUS DEN QUELLEN DER ZENTRALBANKEN ═══════════════
// Nutzer 2026-11-01: "Ergaenz noch ueberall den Indikator m3 money supply bei
// inflation" - per Rueckfrage EUR/GBP/USD aus TradingView (Feed-RULES im
// Workflow) und fuer JPY, CHF, AUD, CAD, NZD "Quellen der Zentralbanken
// anbinden". Gemessen per Sonde (probe-money-sources.yml, 2026-11-01):
//   CHF  SNB-API CSV, Wuerfel snbmonagg: GM3 "VV" = Vorjahresrate, dazu das
//        echte Veroeffentlichungsdatum (PublishingDate)
//   AUD  RBA-Tabelle D1, Reihe DGFAM312 = M3, Wachstum ueber 12 Monate
//   CAD  Bank of Canada Valet: die Bank fuehrt KEIN M3 als Reihe (Sonde 2026-11-01:
//        Gruppe ATABLE_MONETARY_AGGREGATES nur M1+, M1++, M2++). Ihre Leitgroesse
//        fuer die breite Geldmenge ist M2++ -> M2PP_12MTH (Vorjahresrate)
//   JPY  BoJ stat-search, Tabelle md02_m_1_en.html: M3, Vorjahresrate der
//        Durchschnittsbestaende
//   NZD  RBNZ sperrt den Runner (403, Cloudflare - wie beim Core CPI 2026-10-27)
//        -> Trading Economics: aktueller und Vormonats-Bestand aus der
//        Seitenbeschreibung -> Monatsrate. Historie waechst mit jedem Lauf.
// Nie geschaetzt (Regel 4): jede Zahl ist eine veroeffentlichte Rate oder
// das Verhaeltnis zweier veroeffentlichter Bestaende.
// Datum: der Release (SNB PublishingDate, sonst der Tag, an dem dieser Lauf
// den neuen Monat zuerst sah - so bleibt er Lauf fuer Lauf stehen); die
// Historie traegt das Monatsende des Bezugsmonats (datumArt "ref" - die
// Price-Karte setzt fuer solche Reihen nur den juengsten Pfeil).
// Aufruf: node tools/geldmenge.mjs [--probe]   (--probe: nur ausgeben)
//   im Workflow nach dem Indikator-Schritt; Vorstand aus mg_prev.json.
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PROBE = process.argv.includes('--probe');
const IND = 'Money Supply';
const heute = new Date().toISOString().slice(0, 10);
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const ende = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const pct = v => (Math.round(v * 10) / 10).toFixed(1) + '%';
const vorJahr = ym => { const [y, m] = ym.split('-'); return (+y - 1) + '-' + m; };
const vorMonat = ym => { let [y, m] = ym.split('-').map(Number); m--; if (!m) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };

async function hol(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return await r.text();
}

// Jede Quelle liefert {quelle, event, art, pts:[[YYYY-MM, Zahl]], pub?}
const QUELLEN = {
  async CHF() {
    const t = await hol('https://data.snb.ch/api/cube/snbmonagg/data/csv/en');
    const pub = (t.match(/"PublishingDate";"(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
    const pts = [];
    t.split(/\r?\n/).forEach(l => {
      const c = l.split(';').map(x => x.replace(/^﻿/, '').replace(/^"|"$/g, ''));
      if (c[1] === 'VV' && c[2] === 'GM3' && /^\d{4}-\d{2}$/.test(c[0]) && c[3] !== '' && c[3] != null && isFinite(+c[3])) pts.push([c[0], +c[3]]);
    });
    return { quelle: 'snb', event: 'M3 Money Supply YoY (SNB)', art: 'y/y', pts, pub };
  },
  async AUD() {
    const t = await hol('https://www.rba.gov.au/statistics/tables/csv/d1-data.csv');
    const zeilen = t.split(/\r?\n/).map(l => l.split(',').map(x => x.replace(/^﻿/, '').trim()));
    const id = zeilen.find(z => z[0] === 'Series ID');
    const sp = id ? id.indexOf('DGFAM312') : -1;
    if (sp < 0) throw new Error('RBA D1: Reihe DGFAM312 fehlt');
    const pubZ = zeilen.find(z => /^publication date$/i.test(z[0]));
    // Datenzeilen "30/09/2026" (TT/MM/JJJJ), Publication date "30-Oct-2026" (Sonde 2026-11-01)
    const datum = s => {
      s = String(s || '').trim();
      let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      if (m) return m[3] + '-' + String(MON[m[2].toLowerCase()]).padStart(2, '0') + '-' + m[1].padStart(2, '0');
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : null;
    };
    const pts = [];
    zeilen.forEach(z => { const d = datum(z[0]); if (d && z[sp] !== '' && isFinite(+z[sp])) pts.push([d.slice(0, 7), +z[sp]]); });
    return { quelle: 'rba', event: 'M3 Money Supply YoY (RBA D1)', art: 'y/y', pts, pub: pubZ ? datum(pubZ[sp] || pubZ[1]) : null };
  },
  async CAD() {
    const t = JSON.parse(await hol('https://www.bankofcanada.ca/valet/observations/M2PP_12MTH/json?start_date=2007-01-01'));
    const pts = [];
    (t.observations || []).forEach(o => { const v = o.M2PP_12MTH && o.M2PP_12MTH.v; if (o.d && v != null && v !== '' && isFinite(+v)) pts.push([o.d.slice(0, 7), +v]); });
    return { quelle: 'boc', event: 'M2++ Money Supply YoY (Bank of Canada)', art: 'y/y', pts };
  },
  async JPY() {
    const t = await hol('https://www.stat-search.boj.or.jp/ssi/mtshtml/md02_m_1_en.html');
    const zeilen = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()));
    const namen = zeilen.find(z => /^Name of/i.test(z[0] || ''));
    if (!namen) throw new Error('BoJ: keine Namenszeile');
    // M3, Vorjahresrate (der Durchschnittsbestaende)
    const sp = namen.findIndex(x => /^M3\b/.test(x) && /previous year/i.test(x));
    if (sp < 0) throw new Error('BoJ: keine M3-Vorjahresspalte (' + namen.slice(1).join(' | ').slice(0, 200) + ')');
    const pts = [];
    zeilen.forEach(z => { const m = (z[0] || '').match(/^(\d{4})\/(\d{2})$/); if (m && z[sp] !== undefined && z[sp] !== '' && isFinite(+z[sp].replace(/,/g, ''))) pts.push([m[1] + '-' + m[2], +z[sp].replace(/,/g, '')]); });
    return { quelle: 'boj', event: 'M3 Money Stock YoY (BoJ)', art: 'y/y', pts };
  },
  async NZD() {
    const t = await hol('https://tradingeconomics.com/new-zealand/money-supply-m3');
    const m = t.match(/Money Supply M3 in New Zealand (?:increased|decreased|remained unchanged) (?:to|at) ([\d.,]+) NZD Million in ([A-Za-z]+) from ([\d.,]+) NZD Million in ([A-Za-z]+) of (\d{4})/);
    if (!m) throw new Error('TE NZD: Beschreibung nicht lesbar');
    const a = +m[1].replace(/,/g, ''), b = +m[3].replace(/,/g, ''), mo = MON[m[2].toLowerCase()];
    if (!(a > 0 && b > 0) || !mo) throw new Error('TE NZD: Werte nicht lesbar');
    // Jahr: das genannte gehoert zum Vormonat; liegt der Bezugsmonat davor im Jahr (Januar), ist es das Folgejahr
    const vmo = MON[m[4].toLowerCase()], j = +m[5] + (mo < vmo ? 1 : 0);
    const ym = j + '-' + String(mo).padStart(2, '0');
    return { quelle: 'te', event: 'M3 Money Supply MoM (RBNZ via Trading Economics)', art: 'm/m', pts: [[ym, (a / b - 1) * 100]] };
  },
};

function eintrag(ccy, r, alt) {
  // Historie: Vorstand (derselben Quelle) + neue Punkte, je Bezugsmonat einer
  const map = {};
  const altOk = alt && alt.source === r.quelle && Array.isArray(alt.historyFull);
  if (altOk) alt.historyFull.forEach(h => { if (h && h[0]) map[String(h[0]).slice(0, 7)] = h[1]; });
  r.pts.forEach(([ym, v]) => { map[ym] = pct(v); });
  const yms = Object.keys(map).sort().filter(ym => ym >= '2007-01');
  if (!yms.length) return null;
  const neu = yms[yms.length - 1], vor = yms[yms.length - 2];
  // Release-Datum: SNB/RBA nennen es; sonst der erste Lauf, der den Monat sah.
  const datum = r.pub && r.pub <= heute ? r.pub : (altOk && alt.ref === neu && alt.date ? alt.date : heute);
  return {
    actual: map[neu], forecast: null, previous: vor ? map[vor] : null, date: datum,
    event: r.event, period: r.art, source: r.quelle, ref: neu, datumArt: 'ref',
    history: yms.slice(-4).map(ym => [ym === neu ? datum : ende(ym), map[ym]]),
    historyFull: yms.map(ym => [ende(ym), map[ym], null]),
  };
}

const out = PROBE ? {} : JSON.parse(fs.readFileSync('ind_data.json', 'utf8'));
let alt = {};
try { alt = JSON.parse(fs.readFileSync('mg_prev.json', 'utf8')); } catch (e) {}
for (const ccy of Object.keys(QUELLEN)) {
  const vorher = alt[ccy] && alt[ccy][IND];
  try {
    const r = await QUELLEN[ccy]();
    if (!r.pts.length) throw new Error('keine Punkte');
    const e = eintrag(ccy, r, vorher);
    if (!e) throw new Error('kein Eintrag');
    console.log(`[mg] ${ccy} ${e.actual} (${e.ref}, Vormonat ${e.previous}, Release ${e.date}, ${e.historyFull.length} Monate, ${r.event})`);
    if (PROBE) console.log('     letzte 3:', JSON.stringify(e.historyFull.slice(-3)), r.code || '');
    else (out[ccy] = out[ccy] || {})[IND] = e;
  } catch (err) {
    console.log(`[mg] ${ccy}: ${err.message}` + (vorher ? ` - letzter Stand bleibt (${vorher.actual}, ${vorher.date})` : ' - kein Vorstand'));
    if (!PROBE && vorher) (out[ccy] = out[ccy] || {})[IND] = vorher;
  }
}
if (!PROBE) fs.writeFileSync('ind_data.json', JSON.stringify(out));
