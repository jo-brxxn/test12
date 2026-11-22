// ── CHINA-BLOCK IM SCORE: AUD + KUPFER (seit 2026-11-18, VERSION-CHECK-764, Score-Modell 35) ──
// Nutzer 2026-11-18: "wenn die Indikatoren bei aud so gut sind dann bau die in den Score ein aber wenn
// du so 3 einbaust dann mach maximal 1,5 Gewicht drauf und pack die in Economic Groth rein. Und nimm
// die auch bei Kupfer mit rein." Rueckfrage: "je nach Messung" (Ereignisstudie cal_hist 2016-2026).
// ind_data.json wird hier um eine CNY-Sektion ergaenzt (wie sie der Workflow seit 764 liefert):
//  A) AUD Economic Growth hat China New Loans + China Retail Sales (Gewicht 0,5/0,5), Kupfer zusaetzlich
//     China NBS Manufacturing PMI (0,75/0,375/0,375) - Summe je Asset <= 1,5
//  B) Beat (Actual > Forecast) -> bullish, Miss -> bearish; Betrag hoechstens das Gewicht (Altersabschlag)
//  C) kein anderes Asset hat die Zeilen (Gold, NZD, USD), der Block wird NICHT gespiegelt
//     (seit 790 hat Silber NBS PMI + Industrial Production je 0,5, Beat bullish, unten gestrichelt)
//  D) Kalender-Muster treffen die echten Titel (cal_hist) und keine falschen (Caixin, YTD, Loan Prime Rate)
// --gegenprobe: ohne Feed-Weiche (CNY) -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  const CNY = {
    'China New Loans': { actual: '1500B', forecast: '1200B', previous: '1300B', date: '2026-11-12', event: 'New Yuan Loans', history: [] },
    'China Retail Sales': { actual: '2.1%', forecast: '2.8%', previous: '3.0%', date: '2026-11-14', event: 'Retail Sales YoY', history: [] },
    'China NBS Manufacturing PMI': { actual: '50.6', forecast: '49.8', previous: '49.8', date: '2026-10-31', event: 'NBS Manufacturing PMI', history: [] },
    'China Industrial Production': { actual: '6.1%', forecast: '5.5%', previous: '5.8%', date: '2026-11-14', event: 'Industrial Production YoY', history: [] },
  };
  await ctx.route(/\/ind_data\.json/, async r => { const res = await r.fetch(); const d = await res.json(); d.CNY = CNY; r.fulfill({ response: res, body: JSON.stringify(d) }); });
  if (GP) await ctx.route(/\/js\/data-feeds\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('feed=assetEigenFeed(c.id,ind.name)?IND_DATA_FEED[feedCcy]:feed0', 'feed=feed0'); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(4000);
  const R = await p.evaluate(() => {
    const out = {};
    ['AUD', 'COPPER', 'SILVER', 'GOLD', 'NZD', 'USD'].forEach(id => {
      const s = syms.find(x => x.id === id); const rub = (s.rubrics || []).find(r => r.name === 'Economic Growth');
      out[id] = (rub ? rub.indicators : []).filter(i => /^China /.test(i.name)).map(i => ({ n: i.name, gew: i.gew, bias: i.bias, sc: indScore(i, rub) }));
    });
    return out;
  });
  const soll = { AUD: { 'China New Loans': 0.5, 'China Retail Sales': 0.5 }, COPPER: { 'China NBS Manufacturing PMI': 0.75, 'China New Loans': 0.375, 'China Retail Sales': 0.375 },
    // 790: Silber NBS PMI + Industrial Production je 0,5, Beat bullish trotz inverser Wachstums-Karte
    SILVER: { 'China NBS Manufacturing PMI': 0.5, 'China Industrial Production': 0.5 } };
  const richtung = { 'China New Loans': 1, 'China Retail Sales': -1, 'China NBS Manufacturing PMI': 1, 'China Industrial Production': 1 };
  for (const [id, m] of Object.entries(soll)) {
    const z = R[id]; const summe = Object.values(m).reduce((a, x) => a + x, 0);
    if (summe > 1.5 + 1e-9) F.push(`A: ${id} China-Block ${summe} > 1,5`);
    for (const [n, g] of Object.entries(m)) {
      const r = z.find(x => x.n === n);
      if (!r) { F.push(`A: ${id} ohne Zeile ${n}`); continue; }
      if (Math.abs((r.gew || 0) - g) > 1e-9) F.push(`A: ${id} ${n} Gewicht ${r.gew} statt ${g}`);
      // Betrag = Gewicht x Altersabschlag des Modells (aeltere Releases klingen ab, wie bei jedem Indikator)
      if (Math.sign(r.sc) !== richtung[n] || Math.abs(r.sc) > g + 0.011 || Math.abs(r.sc) < g * 0.4) F.push(`B: ${id} ${n} Beitrag ${r.sc} - erwartet Vorzeichen ${richtung[n]}, Betrag bis ${g} (Bias ${r.bias})`);
    }
    if (z.length !== Object.keys(m).length) F.push(`A: ${id} hat ${z.length} China-Zeilen statt ${Object.keys(m).length}`);
  }
  ['GOLD', 'NZD', 'USD'].forEach(id => { if (R[id].length) F.push(`C: ${id} hat China-Zeilen: ${R[id].map(x => x.n).join(', ')}`); });
  // D: Kalender-Muster
  const D = await p.evaluate(async () => {
    const m = await import('/js/event-matchers.js'); const M = m.IND_EVENT_MATCHERS; const t = (k, n, c) => !!(M[k] && M[k](n, c));
    const fehler = [];
    [['China New Loans', 'New Yuan Loans', 'CNY', true], ['China New Loans', 'New Loans', 'CNY', true], ['China New Loans', 'Loan Prime Rate 1Y', 'CNY', false], ['China New Loans', 'Outstanding Loan Growth YoY', 'CNY', false],
     ['China Retail Sales', 'Retail Sales YoY', 'CNY', true], ['China Retail Sales', 'Retail Sales YTD YoY', 'CNY', false], ['China Retail Sales', 'Retail Sales YoY', 'AUD', false],
     ['China NBS Manufacturing PMI', 'NBS Manufacturing PMI', 'CNY', true], ['China NBS Manufacturing PMI', 'Caixin Manufacturing PMI', 'CNY', false], ['China NBS Manufacturing PMI', 'Manufacturing PMI', 'USD', false]]
      .forEach(([k, n, c, soll]) => { if (t(k, n, c) !== soll) fehler.push(`${k} / "${n}" ${c}: ${!soll ? 'trifft faelschlich' : 'trifft nicht'}`); });
    return fehler;
  });
  D.forEach(x => F.push('D: ' + x));
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^B: /.test(f)); console.log(ok ? 'chinablock --gegenprobe: ok (ohne CNY-Feed kein Beitrag)' : 'chinablock --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('chinablock: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('chinablock: ok (AUD 0,5+0,5, Kupfer 0,75+0,375+0,375, Beat bullish/Miss bearish bis hoechstens zum Gewicht, nicht gespiegelt, Kalender-Muster treffen nur die echten Titel)');
})().catch(e => { console.log('chinablock: ABBRUCH ' + e.message); process.exit(1); });
