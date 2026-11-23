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
//   NZD  RBNZ sperrt den Runner (403, Cloudflare - wie beim Core CPI 2026-10-27).
//        Seit 2026-11-23 (Nutzer: "Find bei nzd und usd Daten die weiter
//        zurueckgehen"): BESTAND Broad money (RBNZ C50, MCA.MDB.BM) aus der
//        Wayback-Kopie von hc50-long-run.xlsx (ab 03/1988) + die zwei neuesten
//        Bestaende von Trading Economics ("Money Supply M3" = dieselbe Zahl,
//        gemessen 09/2026 459.840 vs RBNZ 11/2025 443.578 bei +4,5 % p.a.).
//        Daraus die JAHRESRATE (vorher Monatsrate) - wie die uebrigen sieben.
//        Die Bestaende reisen im Eintrag mit (levels), damit spaetere Laeufe
//        die Vorjahresmonate haben. Monate ohne Bestand bleiben leer.
//   USD  Seit 2026-11-23: M2 saisonbereinigt monatlich (SERIES_NAME "M2.M")
//        aus dem H.6-Paket der Fed (Data Download Program, ab 01/1959) ->
//        Jahresrate ab 01/1960. Vorher die Rate aus TV-Bestaenden (6 Punkte).
//        ⚠ Die Fed stellt die fertigen DDP-Pakete am 31.03.2027 ein (steht in
//        der Datei selbst) - bis dahin auf den Nachfolger umziehen.
// Nie geschaetzt (Regel 4): jede Zahl ist eine veroeffentlichte Rate oder
// das Verhaeltnis zweier veroeffentlichter Bestaende.
// Datum: der Release (SNB PublishingDate, sonst der Tag, an dem dieser Lauf
// den neuen Monat zuerst sah - so bleibt er Lauf fuer Lauf stehen); die
// Historie traegt das Monatsende des Bezugsmonats (datumArt "ref" - die
// Price-Karte setzt fuer solche Reihen nur den juengsten Pfeil).
// Aufruf: node tools/geldmenge.mjs [--probe]   (--probe: nur ausgeben)
//   im Workflow nach dem Indikator-Schritt; Vorstand aus mg_prev.json.
import fs from 'node:fs';
import zlib from 'node:zlib';

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
async function holBin(url, ms = 120000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return Buffer.from(await r.arrayBuffer());
}
// Eine Datei aus einem ZIP (xlsx, Fed-Paket) - zentrales Verzeichnis lesen, kein Zusatzpaket
function entpacke(buf, name) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('kein ZIP');
  const n = buf.readUInt16LE(e + 10); let o = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const meth = buf.readUInt16LE(o + 10), csz = buf.readUInt32LE(o + 20), fl = buf.readUInt16LE(o + 28), xl = buf.readUInt16LE(o + 30), cl = buf.readUInt16LE(o + 32), lo = buf.readUInt32LE(o + 42);
    const fn = buf.toString('utf8', o + 46, o + 46 + fl);
    if (fn === name) {
      const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), roh = buf.subarray(start, start + csz);
      return (meth === 8 ? zlib.inflateRawSync(roh) : roh).toString('utf8');
    }
    o += 46 + fl + xl + cl;
  }
  throw new Error('nicht im ZIP: ' + name);
}
// Jahresraten aus Bestaenden {YYYY-MM: Zahl}: nur wo BEIDE echten Bestaende da sind
function jahresraten(lv) {
  return Object.keys(lv).sort().filter(ym => lv[vorJahr(ym)] > 0 && lv[ym] > 0).map(ym => [ym, (lv[ym] / lv[vorJahr(ym)] - 1) * 100]);
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
  async NZD(alt) {
    const lv = {};
    if (alt && alt.source === 'rbnz' && alt.levels) Object.assign(lv, alt.levels);
    // 1) RBNZ C50 long run (Broad money) ueber die neueste Wayback-Kopie
    const ORIG = 'https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/series/c/c50/hc50-long-run.xlsx';
    let wb = '';
    try {
      const cdx = JSON.parse(await hol('http://web.archive.org/cdx/search/cdx?url=' + encodeURIComponent(ORIG) + '&output=json&fl=timestamp&filter=statuscode:200'));
      const ts = (cdx.slice(1).pop() || [])[0];
      if (!ts) throw new Error('keine Sicherung');
      // Neue Sicherung anstossen, wenn die letzte aelter als 30 Tage ist (Save Page Now, oeffentlich) -
      // die Datei selbst kommt erst im naechsten Lauf; schlaegt es fehl, bleibt alles wie es ist.
      const alter = (Date.now() - Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8))) / 864e5;
      if (alter > 30 && !PROBE) { try { await fetch('https://web.archive.org/save/' + ORIG, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); wb = ' (Sicherung angestossen)'; } catch (e) { wb = ' (Sicherung nicht angestossen: ' + e.message + ')'; } }
      const buf = await holBin(`http://web.archive.org/web/${ts}id_/${ORIG}`);
      const ss = [...entpacke(buf, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
      const zeilen = {};
      for (const m of entpacke(buf, 'xl/worksheets/sheet1.xml').matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        let v = (/<v>(.*?)<\/v>/.exec(m[4] || '') || [])[1] || '';
        if (/t="s"/.test(m[3]) && v !== '') v = ss[+v];
        (zeilen[+m[2]] = zeilen[+m[2]] || {})[m[1]] = v;
      }
      const idZ = Object.values(zeilen).find(z => z.A === 'Series Id');
      const spalte = idZ && Object.keys(idZ).find(k => idZ[k] === 'MCA.MDB.BM');
      if (!spalte) throw new Error('Reihe MCA.MDB.BM fehlt');
      let n = 0;
      Object.values(zeilen).forEach(z => {
        const d = +z.A, v = +z[spalte];
        if (!(d > 20000 && v > 0)) return;
        lv[new Date(Date.UTC(1899, 11, 30) + d * 864e5).toISOString().slice(0, 7)] = v; n++;
      });
      wb = ` RBNZ-Kopie ${ts.slice(0, 8)}: ${n} Monate` + wb;
    } catch (e) { wb = ' RBNZ-Kopie: ' + e.message; }
    // 2) die zwei neuesten Bestaende von Trading Economics (faellt TE aus, bleibt die RBNZ-Kopie)
    let te = '';
    try {
    const t = await hol('https://tradingeconomics.com/new-zealand/money-supply-m3');
    const m = t.match(/Money Supply M3 in New Zealand (?:increased|decreased|remained unchanged) (?:to|at) ([\d.,]+) NZD Million in ([A-Za-z]+) from ([\d.,]+) NZD Million in ([A-Za-z]+) of (\d{4})/);
    if (!m) throw new Error('TE NZD: Beschreibung nicht lesbar');
    const a = +m[1].replace(/,/g, ''), b = +m[3].replace(/,/g, ''), mo = MON[m[2].toLowerCase()], vmo = MON[m[4].toLowerCase()];
    if (!(a > 0 && b > 0) || !mo || !vmo) throw new Error('TE NZD: Werte nicht lesbar');
    // Jahr: das genannte gehoert zum Vormonat; liegt der Bezugsmonat davor im Jahr (Januar), ist es das Folgejahr
    const j = +m[5] + (mo < vmo ? 1 : 0), ym = j + '-' + String(mo).padStart(2, '0'), vym = m[5] + '-' + String(vmo).padStart(2, '0');
    // die RBNZ-Datei (amtlich, revidiert) geht vor; TE fuellt nur Monate, die dort (noch) fehlen
    if (!lv[ym]) lv[ym] = a; if (!lv[vym]) lv[vym] = b;
    te = ` TE ${vym} ${b} -> ${ym} ${a}`;
    } catch (e) { te = ' TE: ' + e.message; }
    if (!Object.keys(lv).length) throw new Error('weder RBNZ-Kopie noch TE:' + wb + te);
    return { quelle: 'rbnz', event: 'Broad Money (M3) YoY (RBNZ C50, latest via Trading Economics)', art: 'y/y', ab: '1989-03', levels: lv, pts: jahresraten(lv), code: wb + te };
  },
  async USD() {
    const buf = await holBin('https://www.federalreserve.gov/datadownload/Output.aspx?rel=H6&filetype=zip');
    const x = entpacke(buf, 'h6_data.xml');
    const blk = x.match(/<(?:\w+:)?Series [^>]*SERIES_NAME="M2\.M"[^>]*>([\s\S]*?)<\/(?:\w+:)?Series>/);
    if (!blk) throw new Error('Fed H.6: Reihe M2.M fehlt');
    const lv = {};
    for (const o of blk[1].matchAll(/<(?:\w+:)?Obs [^>]*>/g)) {
      const v = (/OBS_VALUE="([^"]+)"/.exec(o[0]) || [])[1], d = (/TIME_PERIOD="([^"]+)"/.exec(o[0]) || [])[1];
      if (d && v != null && isFinite(+v) && +v > 0) lv[d.slice(0, 7)] = +v;
    }
    const n = Object.keys(lv).length;
    if (n < 24) throw new Error('Fed H.6: nur ' + n + ' Monate M2');
    return { quelle: 'fed', event: 'M2 Money Supply YoY (Fed H.6)', art: 'y/y', ab: '1960-01', pts: jahresraten(lv), code: ` Fed M2.M: ${n} Monate` };
  },
};

function eintrag(ccy, r, alt) {
  // Historie: Vorstand (derselben Quelle) + neue Punkte, je Bezugsmonat einer
  const map = {};
  const altOk = alt && alt.source === r.quelle && Array.isArray(alt.historyFull);
  if (altOk) alt.historyFull.forEach(h => { if (h && h[0]) map[String(h[0]).slice(0, 7)] = h[1]; });
  r.pts.forEach(([ym, v]) => { map[ym] = pct(v); });
  const yms = Object.keys(map).sort().filter(ym => ym >= (r.ab || '2007-01'));
  if (!yms.length) return null;
  const neu = yms[yms.length - 1], vor = yms[yms.length - 2];
  // Release-Datum: SNB/RBA nennen es; sonst der erste Lauf, der den Monat sah.
  const datum = r.pub && r.pub <= heute ? r.pub : (altOk && alt.ref === neu && alt.date ? alt.date : heute);
  return {
    actual: map[neu], forecast: null, previous: vor ? map[vor] : null, date: datum,
    event: r.event, period: r.art, source: r.quelle, ref: neu, datumArt: 'ref',
    history: yms.slice(-4).map(ym => [ym === neu ? datum : ende(ym), map[ym]]),
    historyFull: yms.map(ym => [ende(ym), map[ym], null]),
    ...(r.levels ? { levels: r.levels } : {}),
  };
}

const out = PROBE ? {} : JSON.parse(fs.readFileSync('ind_data.json', 'utf8'));
let alt = {};
try { alt = JSON.parse(fs.readFileSync('mg_prev.json', 'utf8')); } catch (e) {}
for (const ccy of Object.keys(QUELLEN)) {
  const vorher = alt[ccy] && alt[ccy][IND];
  try {
    const r = await QUELLEN[ccy](vorher);
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
