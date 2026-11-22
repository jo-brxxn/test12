// ══ EUR JOB VACANCY RATE AUS EUROSTAT (seit 2026-11-22, VERSION-CHECK-804) ═══
// Nutzer-Foto 2026-11-22 (EUR, Labour Market): "Job vacancies ist irgendwie kaputt und hat keine Historie".
// Gemessen: ind_data.json hatte fuer EUR KEINE Reihe "JOLTS Job Openings" - die Zeile zeigte den kuratierten
// Startwert 2,2 % vom 2026-03-18 (OUT OF DATE). Quelle jetzt: Eurostat jvs_q_nace2, Euroraum (EA20),
// Wirtschaftszweige B-S, Quote der offenen Stellen (JOBRATE), quartalsweise, mit voller Historie.
// Datum: das Aktualisierungsdatum des Datensatzes (Eurostat "updated") fuer das juengste Quartal,
// die Historie traegt das Quartalsende (datumArt "ref"). Nie geschaetzt: jede Zahl kommt von Eurostat.
// Aufruf: node tools/stellen.mjs [--probe]   (--probe: nur ausgeben)
import fs from 'node:fs';

const PROBE = process.argv.includes('--probe');
const IND = 'JOLTS Job Openings', CCY = 'EUR';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BASIS = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/jvs_q_nace2?format=JSON&lang=EN&geo=EA20&nace_r2=B-S&indic_em=JOBRATE';
const pct = v => (Math.round(v * 10) / 10).toFixed(1) + '%';
const qEnde = q => { const [y, n] = q.split('-Q').map(Number); return new Date(Date.UTC(y, n * 3, 0)).toISOString().slice(0, 10); };

async function hol(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
// JSON-stat 2.0: Reihe fuer eine feste Auswahl je Dimension (Zeit frei)
function reihe(j, wahl) {
  const ids = j.id, size = j.size, dim = j.dimension;
  const zeit = dim.time.category.index, pos = {};
  ids.forEach(d => { if (d !== 'time') { const idx = dim[d].category.index; const k = wahl[d] in idx ? wahl[d] : Object.keys(idx)[0]; pos[d] = idx[k]; } });
  const out = [];
  Object.entries(zeit).sort((a, b) => a[1] - b[1]).forEach(([q, ti]) => {
    let flat = 0; ids.forEach((d, k) => { flat = flat * size[k] + (d === 'time' ? ti : pos[d]); });
    const v = j.value[flat] ?? j.value[String(flat)];
    if (v != null && isFinite(+v)) out.push([q, +v]);
  });
  return out;
}

const j = await hol(BASIS);
const kat = d => Object.keys(j.dimension[d].category.index);
if (PROBE) { j.id.forEach(d => console.log('[jv] Dimension', d, kat(d).slice(0, 12).join(','), kat(d).length > 12 ? '…' : '')); console.log('[jv] updated', j.updated); }
// Schlagzeile der Eurostat-Meldung: saisonbereinigt nicht fuer alle Laender - nimm NSA (die Meldung zitiert NSA),
// Groessenklasse gesamt. Beide werden im --probe ausgegeben, damit die Wahl gegen die Meldung pruefbar ist.
const varianten = {};
(j.dimension.s_adj ? kat('s_adj') : ['-']).forEach(sa => (j.dimension.sizeclas ? kat('sizeclas') : ['-']).forEach(sz => {
  varianten[sa + '/' + sz] = reihe(j, { s_adj: sa, sizeclas: sz, geo: 'EA20', nace_r2: 'B-S', indic_em: 'JOBRATE', freq: 'Q', unit: 'PC' });
}));
if (PROBE) Object.entries(varianten).forEach(([k, r]) => console.log('[jv]', k, r.length, 'Quartale, letzte 4:', JSON.stringify(r.slice(-4))));
const pts = varianten['NSA/TOTAL'] || varianten['NSA/-'] || Object.values(varianten)[0];
if (!pts || pts.length < 2) throw new Error('Eurostat: keine Reihe');
const neu = pts[pts.length - 1], vor = pts[pts.length - 2];
const upd = String(j.updated || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
const e = {
  actual: pct(neu[1]), forecast: null, previous: pct(vor[1]), date: upd, event: 'Job Vacancy Rate (Eurostat, euro area)',
  period: null, source: 'eurostat', ref: neu[0], datumArt: 'ref',
  history: pts.slice(-4).map(([q, v], i, a) => [i === a.length - 1 ? upd : qEnde(q), pct(v)]),
  historyFull: pts.map(([q, v]) => [qEnde(q), pct(v), null]),
};
console.log(`[jv] EUR Job Vacancy Rate ${e.actual} (${e.ref}, Vorquartal ${e.previous}, Stand ${e.date}, ${pts.length} Quartale)`);
if (!PROBE) { const out = JSON.parse(fs.readFileSync('ind_data.json', 'utf8')); (out[CCY] = out[CCY] || {})[IND] = e; fs.writeFileSync('ind_data.json', JSON.stringify(out)); }
