// ── MACRO-FENSTER DER AKTIEN (seit 2026-11-15, VERSION-CHECK-729) ──────────
// Nutzer 2026-11-15: "in der Kategorie Stocks die drei makrokarten Inflation usw nicht
// da ... sondern einen weiteren quicklink namens Macro ... Fenster wo dann die Karten
// drinne sind mit allen Funktionen" + "darein soll auch die Bank kommen".
//  A) NVDA: auf der Seite KEINE Zentralbank und KEINE Macro-Reihe; Quicklink "Macro" da
//  B) Tipp -> Fenster ~2/3 der Breite (PC 0,55-0,8; Handy fast voll), darin Zentralbank +
//     drei Makro-Karten (Inflation, Labour Market, Economic Growth)
//  C) Funktionen im Fenster: Zeile aufklappen und Data-Schalter -> Fenster bleibt offen
//  D) Done schliesst; Escape schliesst
//  E) EUR (keine Aktie): Zentralbank + Macro-Reihe weiter auf der Seite, kein Macro-Knopf
// --gegenprobe: Fenster wird nicht gebaut -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const b = await chromium.launch(); const F = [];
  for (const [W, H] of [[1366, 1024], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('function stkMakroFensterHtml(c){\n  if(!stkMakroOffen)return', "function stkMakroFensterHtml(c){\n  if(true)return"); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); gotoSym('NVDA'); });
    await p.waitForTimeout(1800);
    const seite = () => p.evaluate(() => ({
      zb: !!document.querySelector('#detail > * .zb-karte, #detail [id^="zbKarte"]') && !document.querySelector('.stk-mk-fenster [id^="zbKarte"], .stk-mk-fenster .zb-karte') ,
      titel: [...document.querySelectorAll('#detail .ab-rtitel, #detail .ab-reihe-t')].filter(e => !e.closest('.stk-mk-fenster')).map(x => x.textContent.trim()),
      makroAufSeite: [...document.querySelectorAll('#detail [data-mkreihe] .rub-card')].filter(e => !e.closest('.stk-mk-fenster')).map(x => x.id),
      knopf: [...document.querySelectorAll('#detail .aql')].map(b => b.textContent.trim()) }));
    let A = await seite();
    if (A.zb) F.push(o + ' A: Zentralbank-Karte steht auf der Aktien-Seite');
    if (A.makroAufSeite.length) F.push(o + ' A: Makro-Karten auf der Aktien-Seite: ' + A.makroAufSeite.join(', '));
    if (!A.knopf.includes('Macro')) { F.push(o + ' A: kein Quicklink "Macro" (' + A.knopf.join('|') + ')'); await ctx.close(); continue; }
    await p.evaluate(() => [...document.querySelectorAll('#detail .aql')].find(b => b.textContent.trim() === 'Macro').click()); await p.waitForTimeout(1200);
    const B = await p.evaluate(() => { const w = document.querySelector('.stk-mk-fenster'); if (!w) return null; const r = w.getBoundingClientRect();
      return { anteil: r.width / innerWidth, zb: !!w.querySelector('[id^="zbKarte"], .zb-karte, .zb-bau, .zb'), karten: [...w.querySelectorAll('[data-mkreihe] .rub-card')].map(x => x.id) }; });
    if (!B) { F.push(o + ' B: kein Fenster nach Tipp auf Macro'); await ctx.close(); continue; }
    if (W > 1000 && (B.anteil < 0.55 || B.anteil > 0.8)) F.push(`${o} B: Fensterbreite ${(B.anteil * 100).toFixed(0)} % (erwartet ~2/3)`);
    if (W < 500 && B.anteil < 0.9) F.push(`${o} B: Handy-Fenster nur ${(B.anteil * 100).toFixed(0)} % breit`);
    if (!B.zb) F.push(o + ' B: keine Zentralbank im Fenster');
    if (B.karten.length !== 3) F.push(o + ' B: ' + B.karten.length + ' Makro-Karten im Fenster statt 3 (Inflation, Labour Market, Economic Growth)');
    // C) Funktionen
    const zeile = await p.evaluate(() => { const r = document.querySelector('.stk-mk-fenster tr[onclick], .stk-mk-fenster .ind-row'); if (!r) return false; r.click(); return true; });
    await p.waitForTimeout(600);
    if (!zeile) F.push(o + ' C: keine aufklappbare Zeile im Fenster');
    if (!await p.evaluate(() => !!document.querySelector('.stk-mk-fenster'))) F.push(o + ' C: Fenster nach Zeilen-Tipp zu');
    const data = await p.evaluate(() => { const i = document.querySelector('.stk-mk-fenster .mk-rsw input, .stk-mk-fenster [onchange*="makroDaten"]'); if (!i) return false; i.click(); return true; });
    await p.waitForTimeout(800);
    if (data && !await p.evaluate(() => !!document.querySelector('.stk-mk-fenster'))) F.push(o + ' C: Fenster nach Data-Schalter zu');
    if (data) { await p.evaluate(() => { const i = document.querySelector('.stk-mk-fenster .mk-rsw input, .stk-mk-fenster [onchange*="makroDaten"]'); if (i) i.click(); }); await p.waitForTimeout(600); }   // zurueck (Schalter gilt sonst auch fuer EUR)
    // D) Done / Escape
    await p.evaluate(() => { const d = document.querySelector('.stk-mk-zu'); if (d) d.click(); }); await p.waitForTimeout(500);
    if (await p.evaluate(() => !!document.querySelector('.stk-mk-fenster'))) F.push(o + ' D: Done schliesst das Fenster nicht');
    await p.evaluate(() => stkMakroAuf()); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    if (await p.evaluate(() => !!document.querySelector('.stk-mk-fenster'))) F.push(o + ' D: Escape schliesst das Fenster nicht');
    // E) EUR
    await p.evaluate(() => gotoSym('EUR')); await p.waitForTimeout(1500);
    const E = await p.evaluate(() => ({ makro: document.querySelectorAll('#detail [data-mkreihe] .rub-card').length, knopf: [...document.querySelectorAll('#detail .aql')].some(b => b.textContent.trim() === 'Macro'), zb: !!document.querySelector('#detail [id^="zbKarte"], #detail .zb-karte') }));
    if (E.makro < 3) F.push(o + ' E: EUR ohne die drei Makro-Karten auf der Seite');
    if (E.knopf) F.push(o + ' E: EUR hat einen Macro-Knopf');
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / B: kein Fenster/.test(f)); console.log(ok ? 'stkmakro --gegenprobe: ok (fehlendes Fenster gemeldet)' : 'stkmakro --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('stkmakro: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('stkmakro: ok (Aktie ohne Zentralbank/Makro auf der Seite, Quicklink Macro -> Fenster ~2/3 mit Zentralbank + 3 Karten, Funktionen wirken, Done/Escape, EUR unveraendert)');
})().catch(e => { console.log('stkmakro: ABBRUCH ' + e.message); process.exit(1); });
