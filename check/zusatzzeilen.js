// ── EIGENE ZEILEN SILBER / OEL / ERDGAS / BTC (seit 2026-11-19, VERSION-CHECK-766, Score-Modell 37) ──
// Nutzer 2026-11-18: "Füg bei Silber auch die Industrieindikatoren hinzu aber aus usa ... Und füg die
// Sachen bei Öl hinzu die du meinst. Die Vorschläge von Erdgas und btc auch übernehmen." Rueckfragen
// 2026-11-19: Silber "Wie gesagt (Beat bullish)", Oel Rig Count, Erdgas + BTC "trotzdem".
// ind_data.json und btc_score.json werden hier eingeschleust:
//  A) SILVER: US ISM Manufacturing PMI + US Industrial Production je 0,5, Beat -> +, Miss -> -
//  B) OIL: Oil Rig Count 0,5, mehr Bohrtuerme -> bearish, weniger -> bullish (ohne Forecast: gegen Vorwoche)
//  C) NATGAS: Gas Storage vs 5Y - Aenderung unter dem 5-Jahres-Schnitt derselben Woche -> +0,5, darueber -> -0,5
//  D) BTC: BTC Sentiment Score >= 70 -> -0,5, <= 30 -> +0,5, dazwischen 0
//  E) kein anderes Asset hat die Zeilen (Gold, Kupfer, SOL, USD); Kalender-Muster treffen nur die echten Titel
// --gegenprobe: Rig Count nicht in LOWER_IS_BETTER_RE -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const tag = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
(async () => {
  const F = [];
  const b = await chromium.launch();
  // Gas: letzte Woche 61B; Vorjahre derselben ISO-Woche 80/90/70/85/75 (Schnitt 80) -> unter Schnitt -> bullish
  const gd = tag(6), gj = +gd.slice(0, 4);
  const gasHist = [1, 2, 3, 4, 5].map((k, i) => { const d = new Date(gd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 364 * k); return [d.toISOString().slice(0, 10), [80, 90, 70, 85, 75][i] + 'B', null]; });
  for (const [fall, w] of [['hoch', { ism: ['52.1', '49.5'], ip: ['0.6%', '0.2%'], rig: ['420', '410'], gas: '61B', btc: 78 }], ['tief', { ism: ['47.9', '49.5'], ip: ['-0.4%', '0.1%'], rig: ['400', '410'], gas: '95B', btc: 22 }], ['mitte', { ism: ['52.1', '49.5'], ip: ['0.6%', '0.2%'], rig: ['410', '410'], gas: '61B', btc: 50 }]]) {
    const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
    await ctx.route(/\/ind_data\.json/, async r => { const res = await r.fetch(); const d = await res.json(); const u = d.USD = d.USD || {};
      u['US ISM Manufacturing PMI'] = { actual: w.ism[0], forecast: w.ism[1], previous: '49.0', date: tag(3), event: 'ISM Manufacturing PMI', history: [] };
      u['US Industrial Production'] = { actual: w.ip[0], forecast: w.ip[1], previous: '0.1%', date: tag(4), event: 'Industrial Production MoM', period: 'm/m', history: [] };
      u['Oil Rig Count'] = { actual: w.rig[0], forecast: null, previous: w.rig[1], date: tag(2), event: 'Baker Hughes Oil Rig Count', history: [] };
      u['Gas Storage'] = { actual: w.gas, forecast: null, previous: '70B', date: gd, event: 'EIA Natural Gas Stocks Change', history: [], historyFull: [...gasHist, [gd, w.gas, null]] };
      r.fulfill({ response: res, body: JSON.stringify(d) }); });
    await ctx.route(/\/btc_score\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updated: new Date().toISOString(), datum: tag(0), wert: w.btc, komponenten: 6 }) }));
    if (GP) await ctx.route(/\/js\/calendar\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('|oil rig count/i;', '/i;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(4000);
    const R = await p.evaluate(() => {
      const z = (id, rn, n) => { const s = syms.find(x => x.id === id); const r = s && (s.rubrics || []).find(x => x.name === rn); const i = r && r.indicators.find(x => stripPeriodSuffix(x.name).base === n); return i ? { sc: indScore(i, r), bias: i.bias, gew: i.gew, act: i.research && i.research.actual, prev: i.research && i.research.previous } : null; };
      const fremd = []; ['GOLD', 'COPPER', 'SOL', 'USD', 'SP500'].forEach(id => { const s = syms.find(x => x.id === id); (s.rubrics || []).forEach(r => (r.indicators || []).forEach(i => { if (['US ISM Manufacturing PMI', 'US Industrial Production', 'Oil Rig Count', 'Gas Storage vs 5Y', 'BTC Sentiment Score'].includes(stripPeriodSuffix(i.name).base)) fremd.push(id + ':' + i.name); })); });
      return { ism: z('SILVER', 'Economic Growth', 'US ISM Manufacturing PMI'), ip: z('SILVER', 'Economic Growth', 'US Industrial Production'), rig: z('OIL', 'Economic Growth', 'Oil Rig Count'), gas: z('NATGAS', 'Economic Growth', 'Gas Storage vs 5Y'), btc: z('BTC', 'COT Data', 'BTC Sentiment Score'), fremd };
    });
    const soll = fall === 'hoch' ? { ism: 1, ip: 1, rig: -1, gas: 1, btc: -1 } : fall === 'tief' ? { ism: -1, ip: -1, rig: 1, gas: -1, btc: 1 } : { ism: 1, ip: 1, rig: 0, gas: 1, btc: 0 };
    const tagK = { ism: 'A', ip: 'A', rig: 'B', gas: 'C', btc: 'D' };
    for (const k of Object.keys(soll)) {
      const r = R[k]; if (!r) { F.push(`${fall} ${tagK[k]}: Zeile ${k} fehlt`); continue; }
      const s = Math.sign(Math.round(r.sc * 1000));
      if (s !== soll[k]) F.push(`${fall} ${tagK[k]}: ${k} Beitrag ${r.sc} (Bias ${r.bias}, ${r.act} / ${r.prev}) - erwartet Vorzeichen ${soll[k]}`);
      if (Math.abs(r.sc) > 0.5 + 1e-9) F.push(`${fall} ${tagK[k]}: ${k} Beitrag ${r.sc} ueber 0,5`);
      if ((k === 'gas' || k === 'btc') && soll[k] && Math.abs(Math.abs(r.sc) - 0.5) > 1e-9) F.push(`${fall} ${tagK[k]}: ${k} feste Punkte ${r.sc} statt 0,5`);
    }
    if (fall === 'hoch' && R.gas && !/5Y avg 80B/.test(R.gas.prev || '')) F.push(`hoch C: Gas-Vergleichswert "${R.gas.prev}" statt "5Y avg 80B"`);
    R.fremd.forEach(x => F.push(`${fall} E: fremde Zeile ${x}`));
    if (fall === 'hoch') {
      const D = await p.evaluate(async () => { const m = await import('/js/event-matchers.js'); const M = m.IND_EVENT_MATCHERS; const t = (k, n, c) => !!(M[k] && M[k](n, c)); const f = [];
        [['US ISM Manufacturing PMI', 'ISM Manufacturing PMI', 'USD', true], ['US ISM Manufacturing PMI', 'ISM Manufacturing Prices', 'USD', false], ['US ISM Manufacturing PMI', 'S&P Global Manufacturing PMI', 'USD', false],
         ['US Industrial Production', 'Industrial Production MoM', 'USD', true], ['US Industrial Production', 'Industrial Production YoY', 'USD', false], ['US Industrial Production', 'Industrial Production MoM', 'EUR', false],
         ['Oil Rig Count', 'Baker Hughes Oil Rig Count', 'USD', true], ['Oil Rig Count', 'Baker Hughes Total Rig Count', 'USD', false]].forEach(([k, n, c, s]) => { if (t(k, n, c) !== s) f.push(`${k} / "${n}" ${c}: ${s ? 'trifft nicht' : 'trifft faelschlich'}`); });
        return f; });
      D.forEach(x => F.push('E: ' + x));
    }
    err.forEach(e => F.push(fall + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / B: /.test(f)); console.log(ok ? 'zusatzzeilen --gegenprobe: ok (Rig Count falsch herum gemeldet)' : 'zusatzzeilen --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('zusatzzeilen: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('zusatzzeilen: ok (Silber ISM + IP je 0,5 Beat bullish, Oel Rig Count mehr = bearish, Erdgas vs 5-Jahres-Schnitt +-0,5, BTC Sentiment 70/30 +-0,5, nur bei ihrem Asset, Kalender-Muster)');
})().catch(e => { console.log('zusatzzeilen: ABBRUCH ' + e.message); process.exit(1); });
