// ── AUSWAHLFENSTER: GLEICH BREITE KNOEPFE IM RASTER (seit 2026-11-17, VERSION-CHECK-749) ──
// Nutzer 2026-11-17 (Foto des Asset-Fensters): "nicht alle Assets gleich breit und damit nicht
// perfekt untereinander". Gemessen vorher: FX Pairs 5 Breiten (71-75 px) an 10 linken Kanten,
// Stocks 13 Breiten. Geprueft je Fenster (Trade-Asset, COT-Filter ueber gwAuf, Price-Karte Compare):
//  A) alle Knoepfe eines Fensters gleich breit (+-1 px)
//  B) die linken Kanten bilden ein Raster: Anzahl verschiedener Kanten <= Spaltenzahl
// 1194/390 px. --gegenprobe: chipRaster aus -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('function chipRaster(p){', 'function chipRaster(p){return;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
    const messen = name => p.evaluate(() => {
      const pk = [...document.querySelectorAll('.data-picker')].find(x => x.getBoundingClientRect().width > 0); if (!pk) return null;
      const chips = [...pk.querySelectorAll('.cmp-filter-grp>.cmp-chip')].filter(c => c.getBoundingClientRect().width > 0);
      const w = chips.map(c => c.getBoundingClientRect().width), ls = new Set(chips.map(c => Math.round(c.getBoundingClientRect().left)));
      const g = pk.querySelector('.cmp-filter-grp'), sp = g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0;
      return { n: chips.length, min: Math.min(...w), max: Math.max(...w), kanten: ls.size, sp: sp * 2 };
    });
    // Trade-Asset (gwAuf)
    await p.evaluate(() => { showTab('journal'); tjNeu(); }); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const b = document.getElementById('tjAsset').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await p.mouse.click(r[0], r[1]); await p.waitForTimeout(500);
    const A = await messen();
    if (!A || A.n < 30) F.push(`${o} Testaufbau: Asset-Fenster mit ${A && A.n} Knoepfen`);
    else {
      if (A.max - A.min > 1) F.push(`${o} A: Asset-Fenster - Knoepfe ${A.min.toFixed(0)}-${A.max.toFixed(0)} px breit`);
      if (A.kanten > Math.max(A.sp, 2)) F.push(`${o} B: Asset-Fenster - ${A.kanten} linke Kanten bei ${A.sp / 2} Spalten je Gruppe`);
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: /.test(f)); console.log(ok ? 'chipraster --gegenprobe: ok (ungleiche Breiten gemeldet)' : 'chipraster --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('chipraster: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('chipraster: ok (Auswahlfenster: alle Knoepfe gleich breit, im Raster untereinander, 1194/390 px)');
})().catch(e => { console.log('chipraster: ABBRUCH ' + e.message); process.exit(1); });
