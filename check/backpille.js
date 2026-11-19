// ── ZURUECK-PILLE GEHOERT ZUR ZIELSEITE (seit 2026-11-19, VERSION-CHECK-773) ──
// Nutzer 2026-11-19 (PC): "von einem Asset ueber eine Karte zu einer Kategorie und von da zum Dashboard
// dann soll das back weggehen Tat es aber nicht". Gemessen vorher: USD -> "Go to Trends" -> Seitenleiste
// Dashboard -> Pille sichtbar (1920 + 390 px); showTab raeumte sie nur auf der Ursprungsseite ab.
// Echte Klicks, 1920 und 390 px:
//  A) Asset -> Go-to-Knopf einer Karte -> Pille sichtbar auf der Zielseite
//  B) danach Seitenleiste/Menue "Dashboard" -> Pille weg, auch nach einem weiteren Seitenwechsel nicht zurueck
//  C) Asset -> Go-to -> Pille klicken -> zurueck auf dem Asset, Pille weg
//  D) Watchlist-Weg (watchQuickGo) -> andere Seite per showTab -> Pille weg
// --gegenprobe: die Zielseiten-Zeile in showTab entfernt -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1920, 1080], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace("if(_resReturnActive){if(!_quickZielTab)_quickZielTab=tab;else if(tab!==_quickZielTab)rueckwegAus();}", ''); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(2500);
    const st = () => p.evaluate(() => { const pl = document.getElementById('resBackBar'); const r = pl && pl.getBoundingClientRect(); return { tab: curPage, sym: (getSym() || {}).id, sicht: !!(pl && getComputedStyle(pl).display !== 'none' && r.width > 0 && r.height > 0) }; });
    const goTo = async () => {
      await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('USD'); }); await p.waitForTimeout(1200);
      const k = await p.evaluateHandle(() => [...document.querySelectorAll('#detail button[onclick*="assetQuickGo"]')].find(e => e.offsetParent));
      if (!(await k.evaluate(e => !!e))) return false;
      await k.evaluate(e => e.scrollIntoView({ block: 'center' })); await k.click(); await p.waitForTimeout(700); return true;
    };
    if (!(await goTo())) { F.push(`${o} A: Testaufbau - kein Go-to-Knopf auf der USD-Seite`); await ctx.close(); continue; }
    let s = await st();
    if (!s.sicht) F.push(`${o} A: nach dem Go-to (${s.tab}) keine Pille`);
    const nav = await p.evaluateHandle(() => [...document.querySelectorAll('#navSidebar [onclick*="dash"], #navSidebar [data-tab="dash"], .mob-nav [onclick*="dash"]')].find(e => e.offsetParent));
    if (await nav.evaluate(e => !!e)) await nav.click(); else await p.evaluate(() => showTab('dash'));
    await p.waitForTimeout(700); s = await st();
    if (s.tab !== 'dash') F.push(`${o} B: Testaufbau - Dashboard nicht erreicht (${s.tab})`);
    if (s.sicht) F.push(`${o} B: Pille nach Wechsel aufs Dashboard noch sichtbar`);
    await p.evaluate(() => showTab('cot')); await p.waitForTimeout(500); s = await st();
    if (s.sicht) F.push(`${o} B: Pille nach weiterem Seitenwechsel (cot) wieder da`);
    await goTo(); await p.evaluate(() => document.getElementById('resBackPill').click()); await p.waitForTimeout(800); s = await st();
    if (s.tab !== 'cur' || s.sym !== 'USD') F.push(`${o} C: Pille fuehrt nach ${s.tab}/${s.sym} statt zurueck auf USD`);
    if (s.sicht) F.push(`${o} C: Pille nach dem Zurueck noch sichtbar`);
    await p.evaluate(() => { showTab('watch'); watchQuickGo('trends', 'EUR'); }); await p.waitForTimeout(600); s = await st();
    if (!s.sicht) F.push(`${o} D: Watchlist-Weg ohne Pille (${s.tab})`);
    await p.evaluate(() => showTab('news')); await p.waitForTimeout(600); s = await st();
    if (s.sicht) F.push(`${o} D: Pille nach Wechsel auf News noch sichtbar`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / B: Pille/.test(f)); console.log(ok ? 'backpille --gegenprobe: ok (Pille bleibt ohne Zielseiten-Regel stehen)' : 'backpille --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('backpille: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('backpille: ok (Pille nur auf der Zielseite: Go-to zeigt sie, jeder andere Seitenwechsel raeumt sie ab, Zurueck fuehrt aufs Asset; 1920/390 px)');
})().catch(e => { console.log('backpille: ABBRUCH ' + e.message); process.exit(1); });
