// ── MODELL 28: ZINSKURVE, NUR-ANZEIGE-ZEILEN, DECKEL, DIVISOR ──────────────
//
// Nutzer 2026-10-25: "setz bitte alle deine Vorschlaege um" + "mach das wenn
// 10y schneller als 2y steigt das es bearish ist aber wenn beide steigen dann
// gut wenn 2y schneller" (docs/score-model.md, Modell 28). Hier geprueft:
//   A) Yield Curve (10Y-2Y): UNABHAENGIG aus bond_data.json nachgerechnet
//      (Abstand 10Y-2Y, 5- gegen 21-Tage-Schnitt, 3 bp Totzone, +-0,5;
//      Versteilerung bearish) - bei allen acht Waehrungen.
//   B) 10Y Bond Yield zaehlt bei Waehrungen 0, bei Nicht-FX unveraendert.
//   C) Nur-Anzeige-Zeilen zaehlen NICHT im Divisor (symTrackedCount) - sonst
//      doppelt bestraft (Merksatz "Altersgrenze" in docs/score-model.md).
//   D) Deckel: kein Block ueber seinem Maximum; Score-Fenster nennt den Grund.
//   node check/modell28.js [--gegenprobe]   (Kurve mit falschem Vorzeichen -> rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs'), path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const FX = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'];
const BOND = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bond_data.json'), 'utf8'));

function kurveSoll(c, gestern) {
  const b = BOND[c] || {}, s10 = (b['10Y Bond Yield'] || {}).series, s2 = (b['2Y Bond Yield'] || {}).series;
  if (!Array.isArray(s10) || !Array.isArray(s2)) return null;
  const m2 = new Map(); s2.forEach(e => { const d = String(e[0]).slice(0, 10), v = +e[1]; if (d <= gestern && isFinite(v)) m2.set(d, v); });
  const r = s10.map(e => [String(e[0]).slice(0, 10), +e[1]]).filter(([d, v]) => d <= gestern && isFinite(v) && m2.has(d)).map(([d, v]) => [d, v - m2.get(d)]).sort((a, b) => a[0].localeCompare(b[0]));
  if (r.length < 21) return null;
  const avg = n => r.slice(-n).reduce((a, e) => a + e[1], 0) / n;
  const diff = avg(5) - avg(21);
  return diff > 0.03 ? -0.5 : diff < -0.03 ? 0.5 : 0;
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  if (GEGENPROBE) await p.evaluate(() => syms.forEach(s => (s.rubrics || []).forEach(r => (r.indicators || []).forEach(i => { if (i.name === 'Yield Curve (10Y-2Y)' && i.pkt) i.pkt = -i.pkt; }))));

  const ist = await p.evaluate(async F8 => {
    const SC = await import('/js/score.js'), indIsStale = SC.indIsStale, symTrackedCount = SC.symTrackedCount, indScoreParts = SC.indScoreParts, indScore = SC.indScore;
    const o = { heute: todayStr(), kurve: {}, zehn: [], nonfx10: 0, divisor: [], deckel: [], fenster: '' };
    const NA = { _: ['PCE', '10Y Bond Yield', 'ZEW Economic Sentiment'], EUR: ['GDP Growth QoQ', 'Retail Sales'], GBP: ['Retail Sales'] };
    syms.forEach(s => {
      const fx = F8.includes(s.id);
      let n = 0;
      (s.rubrics || []).forEach(r => {
        const blk = {};
        (r.indicators || []).forEach(i => {
          const bn = stripPeriodSuffix(i.name).base, t = indScoreParts(i, r);
          if (fx && i.name === 'Yield Curve (10Y-2Y)') o.kurve[s.id] = i.pkt;
          if (fx && bn === '10Y Bond Yield' && t.total !== 0) o.zehn.push(s.id + ' ' + t.total);
          if (!fx && bn === '10Y Bond Yield' && t.total !== 0) o.nonfx10++;
          if (!indIsStale(i) && !(fx && (NA._.includes(bn) || (NA[s.id] || []).includes(bn)))) n++;
          if (fx) [['rates', ['2Y Bond Yield', '2Y Yield Gap (20d)'], 1.25], ['jobs', ['NFP / Employment Change', 'Unemployment Rate'], 1], ['conf', ['Consumer Confidence'], 0.5]]
            .forEach(([id, namen, max]) => { if (namen.includes(bn)) { blk[id] = blk[id] || { max, s: 0 }; blk[id].s += indScore(i, r); } });
        });
        Object.keys(blk).forEach(k => { if (Math.abs(blk[k].s) > blk[k].max + 0.011) o.deckel.push(`${s.id} ${k}: ${blk[k].s}`); });
      });
      if (symTrackedCount(s) !== n) o.divisor.push(`${s.id}: app ${symTrackedCount(s)}, soll ${n}`);
    });
    try { openScoreInfoSym('EUR'); o.fenster = document.getElementById('scoreInfoBody').innerText; closeM('mScoreInfo'); } catch (e) { o.fenster = 'FEHLER ' + e; }
    return o;
  }, FX);
  const gestern = new Date(Date.parse(ist.heute + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);   // datum-ok: reine Datumsrechnung auf dem App-Tag
  let geprueft = 0;
  FX.forEach(c => {
    const soll = kurveSoll(c, gestern);
    if (soll == null) { if (ist.kurve[c] != null) fail('KURVE OHNE GRUNDLAGE', c); return; }
    geprueft++;
    if (ist.kurve[c] == null) fail('KURVE FEHLT', c);
    else if (Math.abs(ist.kurve[c] - soll) > 1e-9) fail('KURVE', `${c}: ${ist.kurve[c]} statt ${soll} (unabhaengig aus bond_data.json)`);
  });
  ist.zehn.forEach(x => fail('10Y ZAEHLT BEI WAEHRUNG', x));
  if (!ist.nonfx10) fail('10Y NICHT-FX', 'kein Nicht-FX-Asset zaehlt seinen 10Y-Trend mehr - Modell 28 gilt nur fuer Waehrungen');
  ist.divisor.forEach(x => fail('DIVISOR', x));
  ist.deckel.forEach(x => fail('DECKEL', x));
  if (/^FEHLER/.test(ist.fenster)) fail('SCORE-FENSTER', ist.fenster);
  else if (!/measured|Measured|Replaced/.test(ist.fenster)) fail('SCORE-FENSTER', 'nennt den Grund fuer Nur-Anzeige-Zeilen nicht');

  perr.forEach(x => fail('JS-FEHLER', x));
  await b.close();
  if (GEGENPROBE) { if (F.length) { console.log(`modell28 --gegenprobe: ok (rot wie erwartet, ${F.length} Befund(e))`); process.exit(0); } console.log('modell28 --gegenprobe: FEHLER - Waechter bleibt gruen'); process.exit(1); }
  if (F.length) { console.log(`modell28: ${F.length} Befund(e)`); F.forEach(f => console.log('  ' + f)); process.exit(1); }
  console.log(`modell28: ok (Zinskurve bei ${geprueft} Waehrungen unabhaengig nachgerechnet, 10Y bei Waehrungen 0 und bei ${ist.nonfx10} Nicht-FX-Zeilen unveraendert, Divisor ohne Nur-Anzeige-Zeilen, kein Block ueber seinem Deckel)`);
})().catch(e => { console.log('modell28: ABBRUCH ' + e.message); process.exit(1); });
