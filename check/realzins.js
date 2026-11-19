// ── US-REALZINS IM SCORE: NUR NICHT-FX OHNE ENERGIE (seit 2026-11-19, VERSION-CHECK-765, Score-Modell 36) ──
// Nutzer 2026-11-18: "Realzinsen auch ueberall hinzufuegen", Rueckfrage 2026-11-19: "Mach es nur bei
// nicht fx und nicht bei Energie". bond_data.json bekommt hier eine eingeschleuste Reihe
// USD["10Y Real Yield"] (so liefert sie der Workflow seit 765):
//  A) Zeile "10Y Real Yield" in der Inflation-Karte bei Gold, Silber, Kupfer, BTC, SOL, S&P 500, Nasdaq,
//     DAX und einer Aktie - NICHT bei USD, EUR, Oel, Erdgas und den Yield-Assets
//  B) Realzins steigt (SMA5 > SMA21 + 3 bp) -> bearish, Beitrag genau -0,5; faellt -> +0,5; flach -> 0
//  C) die Zeile ist auf der Asset-Seite sichtbar (Inflation-Karte von Gold) und zeigt den letzten Wert
// --gegenprobe: ohne Umkehr (steigt -> bullish) -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
// 40 Handelstage bis vorgestern; Verlauf je Fall
function reihe(fall) {
  const out = []; const d = new Date(); d.setUTCDate(d.getUTCDate() - 2);
  const tage = []; while (tage.length < 40) { if (d.getUTCDay() % 6) tage.unshift(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() - 1); }
  tage.forEach((t, i) => { const v = fall === 'steigt' ? 1.8 + i * 0.02 : fall === 'faellt' ? 2.6 - i * 0.02 : 2.2; out.push([t, String(Math.round(v * 1000) / 1000)]); });
  return out;
}
(async () => {
  const F = [];
  const b = await chromium.launch();
  const MIT = ['GOLD', 'SILVER', 'COPPER', 'PLATINUM', 'IRONORE', 'BTC', 'SOL', 'SP500', 'NAS', 'DAX', 'NIKKEI', 'RUSSELL'];
  const OHNE = ['USD', 'EUR', 'JPY', 'OIL', 'NATGAS'];
  for (const [fall, soll] of [['steigt', -0.5], ['faellt', 0.5], ['flach', 0]]) {
    const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
    await ctx.route(/\/bond_data\.json/, async r => { const res = await r.fetch(); const d = await res.json(); (d.USD = d.USD || {})['10Y Real Yield'] = { source: 'https://home.treasury.gov/', series: reihe(fall) }; r.fulfill({ response: res, body: JSON.stringify(d) }); });
    if (GP) await ctx.route(/\/js\/data-feeds\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace("const bias=sg.bias==='bull'?'bear':sg.bias==='bear'?'bull':'neu';", 'const bias=sg.bias;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(3500);
    const R = await p.evaluate(() => {
      const yid = (syms.find(s => assetCls(s.id) === 'yield') || {}).id, st = syms.find(s => assetCls(s.id) === 'stock');
      const ids = ['GOLD', 'SILVER', 'COPPER', 'PLATINUM', 'IRONORE', 'NIKKEI', 'RUSSELL', 'BTC', 'SOL', 'SP500', 'NAS', 'DAX', 'USD', 'EUR', 'JPY', 'OIL', 'NATGAS', yid, st && st.id].filter(Boolean);
      const o = { yid, st: st && st.id, z: {} };
      ids.forEach(id => { const s = syms.find(x => x.id === id); if (!s) { o.z[id] = 'fehlt'; return; }
        const z = []; (s.rubrics || []).forEach(r => (r.indicators || []).forEach(i => { if (i.name === '10Y Real Yield') z.push({ rub: r.name, bias: i.bias, sc: indScore(i, r), act: i.research && i.research.actual }); }));
        o.z[id] = z; });
      return o;
    });
    const mit = [...MIT, R.st].filter(Boolean), ohne = [...OHNE, R.yid];
    for (const id of mit) {
      const z = R.z[id];
      if (z === 'fehlt') { F.push(`${fall} A: Testaufbau - ${id} fehlt`); continue; }
      if (z.length !== 1) { F.push(`${fall} A: ${id} hat ${z.length} Realzins-Zeilen statt 1`); continue; }
      if (z[0].rub !== 'Inflation') F.push(`${fall} A: ${id} Realzins in ${z[0].rub} statt Inflation`);
      if (Math.abs(z[0].sc - soll) > 1e-9) F.push(`${fall} B: ${id} Beitrag ${z[0].sc} statt ${soll} (Bias ${z[0].bias})`);
    }
    for (const id of ohne) { const z = R.z[id]; if (Array.isArray(z) && z.length) F.push(`${fall} A: ${id} hat eine Realzins-Zeile`); }
    if (fall === 'steigt') {
      await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('GOLD'); }); await p.waitForTimeout(2500);
      const C = await p.evaluate(() => { const el = [...document.querySelectorAll('#pageArea *')].find(e => e.children.length === 0 && /^\s*10Y Real Yield\s*$/.test(e.textContent) && e.offsetParent); if (!el) return null; const row = el.closest('tr,.ind-row,[class*="ind"]') || el.parentElement; const q = el.getBoundingClientRect(); return { sicht: q.width > 0 && q.height > 0, text: (row && row.textContent) || '' }; });
      if (!C) F.push('steigt C: Zeile "10Y Real Yield" auf der Gold-Seite nicht sichtbar');
      else if (!/2\.58%/.test(C.text)) F.push(`steigt C: Zeile zeigt den letzten Wert 2.58% nicht ("${C.text.slice(0, 80)}")`);
    }
    err.forEach(e => F.push(fall + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / B: /.test(f)); console.log(ok ? 'realzins --gegenprobe: ok (ohne Umkehr falsche Richtung gemeldet)' : 'realzins --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('realzins: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('realzins: ok (Inflation-Karte bei Metallen, Krypto, Indizes, Aktie; nicht bei FX, Energie, Yields; steigt -0,5 / faellt +0,5 / flach 0; sichtbar auf der Gold-Seite)');
})().catch(e => { console.log('realzins: ABBRUCH ' + e.message); process.exit(1); });
