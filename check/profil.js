// ── COUNTRY PROFILE: NUR BEI WAEHRUNGEN, UEBER MACRO, DREI SPALTEN ─────────
//
// Nutzer 2026-10-25: "eine neue karte die sich von ganz links nach ganz rechts
// erstreckt ueber macro ... in drei spalten" + "nenn die neue karte country
// profile und fueg sie erstmal nur bei fx ein" (docs/design-system.md
// "Country profile"). Hier geprueft:
//   A) Jede der acht Waehrungen hat die Karte, kein Nicht-FX-Asset.
//   B) Sie steht direkt ueber der MACRO-Zeile und ist genau so breit wie sie.
//   C) Drei Spalten (Central bank | Economy | What moves it) - bei 1440 px
//      nebeneinander, bei 390 px untereinander, nie breiter als die Karte.
//   D) "in score xW" / "shown only" an jedem Rohstoff = ROHSTOFF_KORB (sonst
//      verspricht die Karte etwas, das der Score nicht tut).
//   F) Kein Datum mit vierstelligem Jahr ("Mar 2026") - App-Regel "Mar '26".
//   E) country_data.json fehlt (Workflow noch nicht gelaufen / 404): Karte
//      steht trotzdem, ohne JS-Fehler.
//   node check/profil.js [--gegenprobe]   (Karte bei einer Waehrung entfernt -> rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const FX = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'];
const NICHT_FX = ['GOLD', 'OIL', 'SP500', 'DAX', 'BTC'];
const ROH_ID = { 'Crude oil (WTI)': 'OIL', 'Iron ore': 'IRON', 'Coal': 'COAL', 'Gold': 'GOLD', 'LNG (JKM)': 'LNG', 'Gas (TTF)': 'GAS', 'Dairy (WMP futures)': 'DAIRY' };

async function seite(b, breite, ohneDaten) {
  const ctx = await b.newContext({ viewport: { width: breite, height: 1000 }, serviceWorkers: 'block' });
  if (ohneDaten) await ctx.route('**/country_data.json*', r => r.fulfill({ status: 404, body: '' }));
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  return { p, perr, ctx };
}

async function messen(p, id) {
  await p.evaluate(i => gotoSym(i), id);
  await p.waitForTimeout(900);
  return p.evaluate(gp => {
    if (gp) { const k = document.getElementById('cpKarte'); if (k && getSym().id === 'JPY') k.closest('.cp-row').remove(); }
    const k = document.getElementById('cpKarte');
    const makro = [...document.querySelectorAll('#detail .ab-rtitel')].find(e => /^Macro/i.test(e.textContent.trim()));
    const o = { da: !!k, makro: !!makro };
    if (!k) return o;
    const r = k.getBoundingClientRect(), m = makro ? makro.getBoundingClientRect() : null;
    o.karte = { x: Math.round(r.left), w: Math.round(r.width), unten: Math.round(r.bottom) };
    if (m) o.mk = { x: Math.round(m.left), w: Math.round(m.width), oben: Math.round(m.top) };
    // Zwischen Karte und MACRO-Titel darf keine andere Karte stehen.
    o.direkt = !!makro && k.closest('.cp-row') && k.closest('.cp-row').nextElementSibling === makro;
    o.spalten = [...k.querySelectorAll('.cp-grid > .cp-col')].map(s => { const b = s.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), kopf: (s.querySelector('.cp-kopf') || {}).textContent || '' }; });
    o.breiter = [...k.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > r.right + 1 || b.left < r.left - 1); }).slice(0, 3).map(e => e.className || e.tagName);
    o.roh = [...k.querySelectorAll('.cp-roh')].map(e => ({ n: (e.querySelector('.cp-roh-k b') || {}).textContent || '', badge: (e.querySelector('.cp-roh-s') || {}).textContent || '' }));
    o.korb = (window.ROHSTOFF_KORB || {})[getSym().id] || null;
    // Datumsregel (check/datum.js prueft nur die gerade offene Seite): kein
    // vierstelliges Jahr in den festen Fakten irgendeiner Waehrung.
    const MON = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
    const re = new RegExp(MON + '\\.?,? *\\d{0,2},? *(19|20)\\d{2}\\b|\\b\\d{1,2}\\.? *' + MON + ',? *(19|20)\\d{2}\\b');
    const tw = document.createTreeWalker(k, NodeFilter.SHOW_TEXT); o.datum = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (re.test(n.nodeValue || '')) o.datum.push(n.nodeValue.trim().slice(0, 60));
    return o;
  }, GEGENPROBE);
}

(async () => {
  const b = await chromium.launch();
  // A-D bei 1440 px mit den Daten, die der Server hat.
  const { p, perr, ctx } = await seite(b, 1440, false);
  const KORB = await p.evaluate(() => { try { return ROHSTOFF_KORB; } catch (e) { return null; } });
  if (!KORB) fail('TESTAUFBAU', 'ROHSTOFF_KORB nicht in der window-Bruecke');
  for (const id of FX) {
    const o = await messen(p, id);
    if (!o.da) { fail('KARTE FEHLT', id); continue; }
    if (!o.makro) { fail('MACRO-ZEILE FEHLT', id); continue; }
    if (!o.direkt) fail('NICHT DIREKT UEBER MACRO', id);
    if (o.karte.unten > o.mk.oben) fail('UEBERLAPPT MACRO', `${id}: Karte bis ${o.karte.unten}, Macro ab ${o.mk.oben}`);
    if (Math.abs(o.karte.x - o.mk.x) > 2 || Math.abs(o.karte.w - o.mk.w) > 2) fail('NICHT VOLLE BREITE', `${id}: Karte x${o.karte.x} b${o.karte.w}, Macro-Zeile x${o.mk.x} b${o.mk.w}`);
    const soll = ['Central bank', 'Economy', 'What moves it'];
    if (o.spalten.length !== 3 || soll.some((t, i) => !new RegExp(t, 'i').test(o.spalten[i].kopf))) fail('SPALTEN', `${id}: ${o.spalten.map(s => s.kopf.trim()).join(' | ') || 'keine'}`);
    else if (!(o.spalten[0].r <= o.spalten[1].x && o.spalten[1].r <= o.spalten[2].x && Math.abs(o.spalten[0].y - o.spalten[2].y) < 4)) fail('NICHT NEBENEINANDER (1440)', id);
    if (o.breiter.length) fail('UEBER DEN KARTENRAND', `${id}: ${o.breiter.join(', ')}`);
    o.datum.forEach(t => fail('DATUM MIT VIERSTELLIGEM JAHR', `${id}: "${t}"`));
    o.roh.forEach(r => {
      const rid = ROH_ID[r.n.trim()];
      if (!rid) { fail('ROHSTOFF UNBEKANNT', `${id}: "${r.n}" - ROH_ID im Waechter ergaenzen`); return; }
      const k = ((KORB || {})[id] || []).find(e => e[0] === rid);
      if (k && !new RegExp('in score ×' + Math.abs(k[1]).toString().replace('.', '\\.') + '\\b').test(r.badge)) fail('BADGE', `${id} ${rid}: zaehlt x${k[1]}, Karte zeigt "${r.badge.trim()}"`);
      if (!k && !/shown only/.test(r.badge)) fail('BADGE', `${id} ${rid}: zaehlt nicht, Karte zeigt "${r.badge.trim()}"`);
    });
  }
  for (const id of NICHT_FX) {
    const da = await p.evaluate(i => { if (!syms.find(s => s.id === i)) return null; gotoSym(i); return true; }, id);
    if (da == null) continue;
    await p.waitForTimeout(700);
    if (await p.$('#cpKarte')) fail('KARTE BEI NICHT-FX', id);
  }
  perr.forEach(x => fail('JS-FEHLER (1440)', x));
  await ctx.close();

  // C) Handy: Spalten untereinander, nichts ueber den Rand. E) ohne country_data.json.
  const h = await seite(b, 390, true);
  for (const id of ['EUR', 'AUD']) {
    const o = await messen(h.p, id);
    if (!o.da) { fail('KARTE FEHLT (390, ohne Daten)', id); continue; }
    if (o.spalten.length === 3 && !(o.spalten[1].y > o.spalten[0].y && o.spalten[2].y > o.spalten[1].y)) fail('NICHT UNTEREINANDER (390)', id);
    if (o.breiter.length) fail('UEBER DEN KARTENRAND (390)', `${id}: ${o.breiter.join(', ')}`);
  }
  h.perr.forEach(x => fail('JS-FEHLER (390, ohne country_data.json)', x));
  await b.close();

  if (GEGENPROBE) { if (F.length) { console.log(`profil --gegenprobe: ok (rot wie erwartet, ${F.length} Befund(e))`); process.exit(0); } console.log('profil --gegenprobe: FEHLER - Waechter bleibt gruen'); process.exit(1); }
  if (F.length) { console.log(`profil: ${F.length} Befund(e)`); F.forEach(f => console.log('  ' + f)); process.exit(1); }
  console.log(`profil: ok (Country profile bei allen ${FX.length} Waehrungen direkt ueber Macro in voller Breite, drei Spalten, Rohstoff-Badges = ROHSTOFF_KORB, nicht bei Nicht-FX, Handy ohne country_data.json fehlerfrei)`);
})().catch(e => { console.log('profil: ABBRUCH ' + e.message); process.exit(1); });
