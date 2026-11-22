// ── BERECHNETE ZEILEN HABEN EINE HISTORIE, KEINE COT-GEISTERZEILEN (seit 2026-11-22, VERSION-CHECK-808) ──
// Nutzer-Foto 2026-11-22: "Job vacancies ist irgendwie kaputt und hat keine Historie gleiches gilt fuer den
// anderen Indikator" (Yield Curve) -> "Ja dann schau dir das alles an und beheb das".
//  A) Yield Curve (8 FX), 10Y Real Yield, Global Yields, Gas Storage vs 5Y: Chart-Reihe >= 2 Punkte
//  B) Assets ohne COT-Bericht tragen keine COT-Zeilen (Net Bullish/Bearish, WoW) mehr
// --gegenprobe: Kurve ohne eigene Reihe -> A rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const MARKE = "  else if(ccy&&base===KURVE_IND){pts=bondSpreadPts(ccy);unit=' pp';}";
(async () => {
  const F = [], OK = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); const t = await res.text(); if (!t.includes(MARKE)) F.push('Gegenprobe: Marke fehlt'); r.fulfill({ response: res, body: t.replace(MARKE, '') }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const NAMEN = ['Yield Curve (10Y-2Y)', '10Y Real Yield', 'Global Yields', 'Gas Storage vs 5Y'], leer = [], n = {}, geist = [];
    syms.forEach(s => (s.rubrics || []).forEach(rub => (rub.indicators || []).forEach(i => {
      if (NAMEN.includes(i.name)) { n[i.name] = (n[i.name] || 0) + 1; if (indChartSeries(i, s.id).pts.length < 2) leer.push(s.id + ' ' + i.name); }
      if (rub.name === 'COT Data' && !COT_SYMS.includes(s.id) && /^(Net Bullish Positioning|Net Bearish Positioning|WoW Change)/.test(i.name)) geist.push(s.id + ' ' + i.name);
    }))); return { leer, n, geist }; });
  if (r.leer.length || Object.keys(r.n).length < 4) F.push(`A: ohne Historie ${r.leer.slice(0, 6).join(' · ') || '-'}; gefunden ${JSON.stringify(r.n)}`);
  else OK.push(`A: ${Object.entries(r.n).map(([k, v]) => v + '× ' + k).join(', ')} - alle mit Historie`);
  if (r.geist.length) F.push('B: COT-Geisterzeilen ' + r.geist.slice(0, 6).join(' · ')); else OK.push('B: keine COT-Zeilen bei Assets ohne COT-Bericht');
  if (err.length) F.push('JS: ' + err.slice(0, 2).join(' | '));
  await b.close();
  OK.forEach(m => console.log('  ✓ ' + m)); F.forEach(m => console.log('  ✗ ' + m));
  if (GP) { console.log(F.length ? `Gegenprobe ok: ${F.length} Befund(e), wie erwartet rot.` : 'Gegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(F.length ? 0 : 1); }
  console.log(F.length ? `✗ chartreihen: ${F.length} Befund(e)` : 'chartreihen: ok (berechnete Zeilen mit Historie, keine COT-Geisterzeilen)');
  process.exit(F.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
