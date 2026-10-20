// ── NIVEAU-BLOCK DES SCORES: ZAHLEN GEGEN IHR NORMAL ──────────────────────
//
// Nutzer 2026-10-16: "es ist aktuell viel actual vs forecast aber nicht ist
// die Inflation ueber Target und wie weit usw gleiches gilt fuer alle anderen
// Zahlen und Daten. Wie bekommt man das darein?" (Modell 22, docs/score-model.md).
// Hier UNABHAENGIG aus ind_data.json nachgerechnet und gegen die Zeilen der
// acht Waehrungen gehalten:
//   A) Inflation vs Target: Ø Headline+Core y/y (USD: PCE) minus offizielles Ziel;
//   C) Unemployment / Wages: robuster z gegen den 10-Jahres-Median
//      (Median-Abweichung x 1,4826), Arbeitslosigkeit mit umgedrehtem Vorzeichen;
//   E) Waehrungen RELATIV zum Ø der anderen sieben, Stufen laut NIV;
//   F) Nicht-FX (S&P 500 ↔ USD, inverse) liest das ABSOLUTE Niveau;
//   I) entfernte Zeilen stehen nirgends: Real Rate, Growth, PMI, Rate Path (Modell 24/25),
//      Inflation/Unemployment/Consumer Confidence Trend (3M) (Modell 27).
//   node check/niveau.js [--gegenprobe]   (Waehrungen absolut statt relativ)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs'), path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const IND = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ind_data.json'), 'utf8'));
// Seit Modell 27 auch die drei Trend-Zeilen (Nutzer-Entscheid 2026-10-20).
const ALT = ['Real Rate vs Peers', 'Growth vs Trend', 'PMI vs 50', 'Rate Path vs Peers', 'Inflation Trend (3M)', 'Unemployment Trend (3M)', 'Consumer Confidence Trend (3M)'];
const FX = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'];
const ZIEL = { USD: 2, EUR: 2, GBP: 2, JPY: 2, CHF: 1, CAD: 2, AUD: 2.5, NZD: 2 };
const STUFEN = { inflT: [[0.7, 0.5], [0.3, 0.25]], labT: [[0.4, 0.5], [0.2, 0.25]], confT: [[5, 0.5], [2, 0.25]], infl: [[2, 1], [1, 0.75], [0.5, 0.5]], lab: [[1.5, 1], [1, 0.75], [0.5, 0.5]], wage: [[1.5, 0.75], [0.75, 0.5]] };
const NAME = { infl: 'Inflation vs Target', lab: 'Unemployment vs Normal', wage: 'Wages vs Normal' };
const zahl = s => { const m = String(s == null ? '' : s).match(/-?\d[\d.,]*/); return m ? parseFloat(m[0].replace(/,/g, '')) : null; };
const tag = d => Date.parse(String(d).slice(0, 10) + 'T00:00:00Z');
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stufe = (t, x0) => { const x = Math.round(x0 * 1000) / 1000; const st = STUFEN[t].find(([ab]) => Math.abs(x) >= ab); return st ? Math.sign(x) * st[1] : 0; };
const reihe = e => { const m = new Map(); ((e && e.historyFull) || []).forEach(h => { const v = zahl(h[1]); if (v != null) m.set(String(h[0]).slice(0, 10), v); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])); };
function frisch(r, heute) { if (r.length < 2) return false; const ab = []; for (let i = 1; i < r.length; i++) ab.push((tag(r[i][0]) - tag(r[i - 1][0])) / 864e5); const z = Math.max(7, med(ab.slice(-24)) || 30); return (heute - tag(r[r.length - 1][0])) / 864e5 <= Math.min(200, Math.max(45, 2.5 * z)); }
function robust(r, heute, aktTage) {
  const f = r.filter(([d]) => tag(d) >= heute - 10 * 365.25 * 864e5);
  if (f.length < 12 || tag(r[0][0]) > heute - 5 * 365.25 * 864e5) return null;
  const l = tag(r[r.length - 1][0]), akt = r.filter(([d]) => tag(d) >= l - aktTage * 864e5).map(x => x[1]);
  const w = f.map(x => x[1]), m = med(w), mad = med(w.map(v => Math.abs(v - m))) * 1.4826;
  return mad > 0 ? (akt.reduce((a, v) => a + v, 0) / akt.length - m) / mad : null;
}
function inflation(c, heute, nurHead) {
  const paare = c === 'USD' && !nurHead ? ['PCE', 'Core PCE'] : ['CPI (Headline)', 'Core CPI'];
  return paare.slice(0, nurHead ? 1 : 2).map(b => { const e = IND[c] && IND[c][b]; if (!e) return null;
    const yy = String(e.period || '').toLowerCase() === 'y/y' || /yoy|y\/y/i.test(String(e.event || '')) || e.source === 'tepage';
    const v = zahl(e.actual); if (!yy || v == null || !e.date) return null; const r = reihe(e);
    return (r.length >= 2 ? frisch(r, heute) : (heute - tag(e.date)) / 864e5 <= 45) ? v : null; }).filter(v => v != null);
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  const heute = tag(await p.evaluate(gp => { if (gp) { window.__nivAbsolut = true; applyNiveauFeed(); } return todayStr(); }, GEGENPROBE));
  // Unabhaengige Rechnung
  const abs = {}; FX.forEach(c => { abs[c] = {}; const I = IND[c] || {};
    const inf = inflation(c, heute, false); if (inf.length) abs[c].infl = inf.reduce((a, v) => a + v, 0) / inf.length - ZIEL[c];
    const u = reihe(I['Unemployment Rate']); if (u.length && frisch(u, heute)) { const z = robust(u, heute, 92); if (z != null) abs[c].lab = -z; }
    const we = I['Avg Hourly Earnings'], w = reihe(we);
    if (we && (String(we.period || '').toLowerCase() === 'y/y' || /yoy|3mo\/yr|y\/y/i.test(String(we.event || ''))) && w.length && frisch(w, heute)) { const z = robust(w, heute, 92); if (z != null) abs[c].wage = z; }
    // G) Richtung: Inflation y/y jetzt minus >= 80 Tage davor; Arbeitslosigkeit Ø 3M minus Ø 3M davor
    const ir = reihe(I[c === 'USD' ? 'PCE' : 'CPI (Headline)']);
    if (ir.length >= 4 && frisch(ir, heute)) { const [d1, v1] = ir[ir.length - 1], vor = ir.filter(([d]) => tag(d) <= tag(d1) - 80 * 864e5).pop(); if (vor && tag(d1) - tag(vor[0]) <= 200 * 864e5) abs[c].inflT = v1 - vor[1]; }
    if (u.length >= 6 && frisch(u, heute)) { const l = tag(u[u.length - 1][0]), a = u.filter(([d]) => tag(d) > l - 92 * 864e5).map(x => x[1]), bb = u.filter(([d]) => tag(d) <= l - 92 * 864e5 && tag(d) > l - 184 * 864e5).map(x => x[1]);
      if (a.length && bb.length) abs[c].labT = -(a.reduce((s, v) => s + v, 0) / a.length - bb.reduce((s, v) => s + v, 0) / bb.length); }
    // H) Consumer Confidence Trend (3M, Modell 26): gleiche Fenster, Indexpunkte, steigend = bullish
    const cf = reihe(I['Consumer Confidence']);
    if (cf.length >= 6 && frisch(cf, heute)) { const l = tag(cf[cf.length - 1][0]), a = cf.filter(([d]) => tag(d) > l - 92 * 864e5).map(x => x[1]), bb = cf.filter(([d]) => tag(d) <= l - 92 * 864e5 && tag(d) > l - 184 * 864e5).map(x => x[1]);
      if (a.length && bb.length) abs[c].confT = a.reduce((s, v) => s + v, 0) / a.length - bb.reduce((s, v) => s + v, 0) / bb.length; }
  });
  const soll = {}; FX.forEach(c => { soll[c] = {}; Object.keys(NAME).forEach(t => { const x = abs[c][t]; if (x == null) return;
    const pe = FX.filter(o => o !== c && abs[o][t] != null).map(o => abs[o][t]); if (pe.length < 4) return;
    soll[c][t] = stufe(t, x - pe.reduce((a, v) => a + v, 0) / pe.length); }); });
  // I) Seit Modell 24/25 nicht mehr gewertet (Backtest): diese Zeilen duerfen nirgends stehen.
  const alt = await p.evaluate(A => syms.flatMap(s => (s.rubrics || []).flatMap(r => (r.indicators || []).filter(i => A.includes(i.name)).map(i => s.id + ' ' + i.name))), ALT);
  if (alt.length) fail('ALTZEILE', alt.slice(0, 4).join(', '));
  const ist = await p.evaluate(N => { const o = {};
    ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD', 'SP500'].forEach(id => { const s = syms.find(x => x.id === id); o[id] = {};
      (s.rubrics || []).forEach(r => (r.indicators || []).forEach(i => { const t = Object.keys(N).find(k => N[k] === i.name); if (t) o[id][t] = { pkt: indScore(i, r), rub: r.name, act: i.research && i.research.actual }; })); });
    return o; }, NAME);
  let n = 0;
  FX.forEach(c => Object.keys(NAME).forEach(t => {
    const s = soll[c][t], i = ist[c][t];
    if (s == null && i) { fail('GEISTERZEILE', `${c} ${NAME[t]} steht da, die Daten tragen sie nicht`); return; }
    if (s != null && !i) { fail('ZEILE FEHLT', `${c} ${NAME[t]} (soll ${s})`); return; }
    if (s == null) return; n++;
    if (Math.abs(i.pkt - s) > 1e-9) fail('PUNKTE', `${c} ${NAME[t]}: ${i.pkt} statt ${s} (absolut ${abs[c][t].toFixed(3)})`);
  }));
  // F) S&P 500: Inflation-Karte invers zu USD, absolutes US-Niveau
  const spi = ist.SP500.infl;
  if (spi && abs.USD.infl != null && Math.abs(spi.pkt - (-stufe('infl', abs.USD.infl))) > 1e-9) fail('NICHT-FX', `S&P 500 Inflation vs Target ${spi.pkt} statt ${-stufe('infl', abs.USD.infl)} (US absolut, invers)`);
  if (n < 16) fail('ABDECKUNG', `nur ${n} Niveau-Zeilen bei den acht Waehrungen (erwartet >= 16, seit Modell 27 drei Zeilenarten)`);
  if (perr.length) fail('Seitenfehler', perr.slice(0, 3).join(' | '));
  await b.close();
  if (F.length) { console.log(`✗ niveau: ${F.length} Befund(e)\n  ` + F.slice(0, 20).join('\n  ')); process.exit(1); }
  console.log(`✓ niveau: ${n} Zeilen der acht Waehrungen unabhaengig aus ind_data.json nachgerechnet (relativ zu den Peers), S&P 500 absolut invers`);
})().catch(e => { console.log('✗ niveau: ' + e.message); process.exit(1); });
