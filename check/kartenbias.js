// ── KARTEN-BADGE: FARBE FOLGT DER EIGENEN ZAHL ───────────────────────
//
// Bugreport 2026-11-22 (Screenshot SILVER, Economic Growth): Badge -3.97 stand
// NEUTRAL, waehrend Labour Market -2.72 rot war. Gemessen: deriveMacroBiasAll
// spiegelte den Karten-Bias 1:1 von USD Economic Growth (+1.64 = neutral),
// die Zahl im Badge ist aber die eigene Kartensumme (China-Zeilen unter
// "Inverse", Global Yields ...). 24 Karten betroffen (Silver, Gold, Indizes,
// Aktien, Yields).
// Regel: jede Makro-Karte (ausser COT Data, eigene Vorzeichen-Regel) traegt
// den Bias aus ihrer eigenen Summe, Schwelle +/-2 (RUB_AUTO_BIAS_THRESHOLD).
//   node check/kartenbias.js [--gegenprobe]  (alte 1:1-Spiegelung -> rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 900 } });
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  const r = await p.evaluate((geg) => {
    if (geg) syms.forEach(sym => {   // alte Logik nachstellen: Bias 1:1 von der Waehrungskarte
      const ccy = isNonFx(sym.id) && macroCcyFor(sym.id); const src = ccy && syms.find(s => s.id === ccy); if (!src) return;
      const rules = effDeriveRules(sym);
      sym.rubrics.forEach(rb => { const ru = rules[rb.name]; const sr = src.rubrics.find(x => x.name === rb.name);
        if (sr && (ru === 'same' || ru === 'inverse')) rb.bias = ru === 'same' ? sr.bias : invertBias(sr.bias); });
    });
    const F = []; let n = 0;
    syms.forEach(sym => (sym.rubrics || []).forEach(rb => {
      if (!rb.indicators || rb.name === 'COT Data') return;
      const sc = rubScore(rb); const t = RUB_AUTO_BIAS_THRESHOLD[rb.name] || 2;
      const soll = sc <= -t ? 'bear' : sc >= t ? 'bull' : 'neu';
      const ist = rb.bias === 'sbull' ? 'bull' : rb.bias === 'sbear' ? 'bear' : rb.bias;
      n++; if (ist !== soll) F.push(`${sym.id} ${rb.name}: Badge ${sc > 0 ? '+' : ''}${sc}, Bias ${rb.bias}, soll ${soll}`);
    }));
    return { n, F };
  }, GEGENPROBE);
  await b.close();
  if (perr.length) { console.log('✗ Seitenfehler:', perr.slice(0, 3).join(' | ')); process.exit(1); }
  if (r.F.length) { console.log(`✗ ${r.F.length} von ${r.n} Karten: Farbe passt nicht zur eigenen Zahl`); r.F.slice(0, 25).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log(`✓ ${r.n} Karten: Badge-Farbe folgt der eigenen Kartensumme (COT ausgenommen)`);
})().catch(e => { console.error(e); process.exit(1); });
