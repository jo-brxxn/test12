#!/usr/bin/env node
// Zeitspanne per Ziehen (Nutzer 2026-10-20): "bei den Zeitfilter will ich noch
// eine ... haben damit soll man dann im Chart die Zeitspanne auswaehlen koennen
// die man sehen will und mit x geht das wieder weg". Nutzerwahl: im Chart
// ziehen, an allen Charts mit Zeitfilter.
//
// Je Chart-Art (Asset-Price, History, Indikator, Trends, Data, Price-Tab,
// Paar-Uebersicht, Makro): Maus von 30 % auf 70 % ziehen ->
//   A) Chip "Von – Bis ×" erscheint, B) der Chart zeigt WENIGER Punkte als
//   vorher (die Spanne wirkt wirklich), C) × -> Chip weg, Punktzahl wie vorher.
// D) Touch (390 px): lange druecken + ziehen setzt die Spanne; kurzes Wischen nicht.
//   node check/zeitspanne.js [--gegenprobe]   (Ziehen abgeschaltet -> A rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`); let ok = 0;
const FAELLE = [
  ['Asset Price', 'gotoSym("EUR")', '#detail .ab-ptile [data-br="ab"]'],
  ['History', 'gotoSym("EUR")', '#detail [data-br="hist"]'],
  ['Indikator', 'gotoSym("EUR");(()=>{const b=[...document.querySelectorAll("#detail [onclick*=toggleIndDetailRow]")][0];if(b)b.click()})()', '#detail [data-br="setIndHistRange"]'],
  ['Trends', 'showTab("trends")', '#pgTrends [data-br="setTrendsRange"]'],
  ['Data', 'showTab("data")', '#pgData [data-br="setDataRange"]'],
  ['Price-Tab', 'openPriceChart("EUR")', '[data-br="setPriceRange"]'],
  ['Paar', 'gotoPairOverview("EUR/USD")', '[data-br="setPairOvRange"]'],
  ['Makro', 'gotoSym("USD");if(!makroGross())makroSicht("charts")', '#detail .mk-chart[data-br]'],
];
// Punkte im Chart: Hover-Registry (.chv), sonst Tagesanker (History/Makro: Spanne in Tagen)
const zaehle = (p, sel) => p.evaluate(sel => {
  const el = document.querySelector(sel); if (!el) return null;
  if (el.dataset.chv) return (window._chvReg && window._chvReg[el.dataset.chv] || []).length || el.querySelectorAll('rect,circle').length;
  if (el.dataset.brLin) return +el.dataset.brLin.split('|')[1];
  return null;
}, sel);
const chips = p => p.evaluate(() => [...document.querySelectorAll('.br-chip')].filter(e => e.offsetParent).length);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/supabase/, r => r.abort());
  const p = await ctx.newPage(); const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(gp => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} if (gp) window.__gpKeinBrush = true; }, GP);
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
  for (const [n, nav, sel] of FAELLE) {
    await p.evaluate(nav); await p.waitForTimeout(1200);
    const el = await p.$(sel); if (!el) { fail(n, `kein Chart ${sel}`); continue; }
    await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox();
    const vor = await zaehle(p, sel), c0 = await chips(p);
    const y = r.y + r.height * 0.5;
    await p.mouse.move(r.x + r.width * 0.3, y); await p.mouse.down();
    await p.mouse.move(r.x + r.width * 0.5, y, { steps: 5 }); await p.mouse.move(r.x + r.width * 0.7, y, { steps: 5 }); await p.mouse.up();
    await p.waitForTimeout(800);
    const c1 = await chips(p), nach = await zaehle(p, sel);
    if (c1 <= c0) { fail(n, 'nach dem Ziehen kein Chip "Von – Bis ×"'); continue; }
    if (!(nach < vor)) fail(n, `Spanne wirkt nicht: ${vor} -> ${nach} Punkte`);
    await p.evaluate(() => { const x = [...document.querySelectorAll('.br-chip .br-x')].find(e => e.offsetParent); x.click(); });
    await p.waitForTimeout(800);
    const c2 = await chips(p), zur = await zaehle(p, sel);
    if (c2 >= c1) fail(n, '× nimmt den Chip nicht weg');
    if (zur !== vor) fail(n, `× stellt nicht her: ${vor} -> ${zur} Punkte`);
    else ok++;
    await p.evaluate(() => { document.querySelectorAll('.ov').forEach(o => { if (o.id && getComputedStyle(o).display !== 'none') try { closeM(o.id); } catch (e) {} }); });
  }
  perr.forEach(x => fail('JS-FEHLER', x));
  await ctx.close();
  // D) Touch: lange druecken + ziehen
  const tctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await tctx.route(/supabase/, r => r.abort());
  const t = await tctx.newPage();
  await t.addInitScript(gp => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} if (gp) window.__gpKeinBrush = true; }, GP);
  await t.goto(URL); await wartenBisDatenDa(t);
  await t.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('EUR'); });
  await t.waitForTimeout(1200);
  const touch = async lang => t.evaluate(async lang => {
    const el = document.querySelector('#detail .ab-ptile [data-br="ab"]'); el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect(), y = r.top + r.height / 2, ev = (typ, x) => el.dispatchEvent(new PointerEvent(typ, { bubbles: true, pointerType: 'touch', pointerId: 7, clientX: x, clientY: y, isPrimary: true }));
    ev('pointerdown', r.left + r.width * 0.3);
    await new Promise(z => setTimeout(z, lang ? 500 : 60));
    for (let k = 1; k <= 8; k++) { ev('pointermove', r.left + r.width * (0.3 + 0.05 * k)); await new Promise(z => setTimeout(z, 16)); }
    ev('pointerup', r.left + r.width * 0.7);
    await new Promise(z => setTimeout(z, 700));
    const n = [...document.querySelectorAll('.br-chip')].filter(e => e.offsetParent).length;
    if (n) { const x = [...document.querySelectorAll('.br-chip .br-x')].find(e => e.offsetParent); x.click(); await new Promise(z => setTimeout(z, 500)); }
    return n;
  }, lang);
  if (!(await touch(true))) fail('TOUCH', 'lange druecken + ziehen setzt keine Spanne');
  if (await touch(false)) fail('TOUCH', 'kurzes Wischen setzt schon eine Spanne (soll Tooltip/Scrollen bleiben)');
  await b.close();
  if (GP) { const r = F.some(x => /kein Chip/.test(x)); console.log(r ? `zeitspanne --gegenprobe: ok (rot wie erwartet, ${F.length} Befunde)` : 'zeitspanne --gegenprobe: FEHLER - nicht gemeldet'); process.exit(r ? 0 : 1); }
  if (F.length) { console.log(`zeitspanne: ${F.length} Befund(e)`); F.forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log(`zeitspanne: ok (${ok}/${FAELLE.length} Chart-Arten: Ziehen setzt die Spanne, Chip mit ×, weniger Punkte, × stellt her; Touch: lange druecken + ziehen ja, kurzes Wischen nein)`);
})().catch(e => { console.error(e); process.exit(2); });
