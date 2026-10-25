#!/usr/bin/env node
// Zeitspanne per Schere (Nutzer 2026-10-20): "bei den Zeitfilter will ich noch
// eine ... haben damit soll man dann im Chart die Zeitspanne auswaehlen koennen
// die man sehen will und mit x geht das wieder weg".
// Seit 2026-10-25 (Nutzer): "die Funktion soll nur gehen wenn man vorher auf
// die Schere geklickt hat sonst nicht" + "wenn man das benutzt muss das in
// allen Charts zu sehen sein" (Wahl: alle Charts der Ansicht).
//
// Je Chart-Art (Asset-Price, History, Indikator, Trends, Data, Price-Tab,
// Paar-Uebersicht, Makro, Chart-Fenster des Country profile):
//   O) OHNE Schere von 30 % auf 70 % ziehen -> KEIN Chip, nichts geaendert.
//   A) Schere antippen, ziehen -> Chip "Von – Bis ×", B) WENIGER Punkte,
//   C) × -> Chip weg, Punktzahl wie vorher.
// V) Ansicht: Schere in der Price-Karte -> Price, History UND Makro-Charts
//    zeigen die Spanne (je ein Chip); × an EINEM Chip nimmt alle weg.
//    Ebenso im Chart-Fenster: alle Panels tragen die Spanne.
// T) Touch (390 px): weder langes Druecken + Ziehen noch Wischen setzt ohne
//    Schere eine Spanne; mit Schere reicht ein einfaches Ziehen, danach ist
//    die Schere aus.
//   node check/zeitspanne.js [--gegenprobe | --gegenprobe-ohne-schere | --gegenprobe-einzeln]
//     --gegenprobe            Ziehen abgeschaltet       -> A rot
//     --gegenprobe-ohne-schere altes Maus-Ziehen ohne Schere -> O rot
//     --gegenprobe-einzeln    Spanne nur am eigenen Chart -> V rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe'), GP_OS = process.argv.includes('--gegenprobe-ohne-schere'), GP_EIN = process.argv.includes('--gegenprobe-einzeln');
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
  ['Chart-Fenster', 'gotoSym("EUR");setTimeout(()=>cpfOeffnen("niv:Unemployment Rate"),900)', '#cpfBody [data-br="cpfSetRange"]'],
];
// Punkte im Chart: Hover-Registry (.chv), sonst Tagesanker (History/Makro: Spanne in Tagen)
const zaehle = (p, sel) => p.evaluate(sel => {
  const el = document.querySelector(sel); if (!el) return null;
  if (el.dataset.chv) return (window._chvReg && window._chvReg[el.dataset.chv] || []).length || el.querySelectorAll('rect,circle').length;
  if (el.dataset.brLin) return +el.dataset.brLin.split('|')[1];
  return null;
}, sel);
const chips = p => p.evaluate(() => [...document.querySelectorAll('.br-chip')].filter(e => e.offsetParent).length);
const ziehe = async (p, sel) => {
  const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox(), y = r.y + r.height * 0.5;
  await p.mouse.move(r.x + r.width * 0.3, y); await p.mouse.down();
  await p.mouse.move(r.x + r.width * 0.5, y, { steps: 5 }); await p.mouse.move(r.x + r.width * 0.7, y, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(800);
};
const schere = (p, key) => p.evaluate(k => { const b = [...document.querySelectorAll('.br-sch')].find(x => x.dataset.brk === k && x.offsetParent); if (b) b.click(); return !!b; }, key);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(/supabase/, r => r.abort());
  const p = await ctx.newPage(); const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(g => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} if (g.gp) window.__gpKeinBrush = true; if (g.os) window.__gpOhneSchere = true; if (g.ein) window.__gpEinzeln = true; }, { gp: GP, os: GP_OS, ein: GP_EIN });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
  for (const [n, nav, sel] of FAELLE) {
    await p.evaluate(nav); await p.waitForTimeout(1800);
    const el = await p.$(sel); if (!el) { fail(n, `kein Chart ${sel}`); continue; }
    const key = await p.evaluate(sel => document.querySelector(sel).dataset.br, sel);
    const sch = await p.evaluate(k => [...document.querySelectorAll('.br-sch')].filter(b => b.dataset.brk === k && b.offsetParent).length, key);
    if (!sch) fail(n, `kein Scheren-Knopf neben dem Zeitfilter (${key})`);
    const vor = await zaehle(p, sel), c0 = await chips(p);
    // O) ohne Schere: nichts
    await ziehe(p, sel);
    const cO = await chips(p);
    if (cO > c0) { fail(n, 'OHNE Schere setzt Ziehen eine Spanne (soll nur nach Klick auf die Schere gehen)'); await p.evaluate(() => { const x = [...document.querySelectorAll('.br-chip .br-x')].find(e => e.offsetParent); if (x) x.click(); }); await p.waitForTimeout(800); }
    // A-C) mit Schere
    await schere(p, key); await ziehe(p, sel);
    const c1 = await chips(p), nach = await zaehle(p, sel);
    if (c1 <= c0) { fail(n, 'mit Schere: nach dem Ziehen kein Chip "Von – Bis ×"'); continue; }
    if (!(nach < vor)) fail(n, `Spanne wirkt nicht: ${vor} -> ${nach} Punkte`);
    await p.evaluate(() => { const x = [...document.querySelectorAll('.br-chip .br-x')].find(e => e.offsetParent); x.click(); });
    await p.waitForTimeout(800);
    const c2 = await chips(p), zur = await zaehle(p, sel);
    if (c2 >= c1) fail(n, '× nimmt den Chip nicht weg');
    if (zur !== vor) fail(n, `× stellt nicht her: ${vor} -> ${zur} Punkte`);
    else ok++;
    await p.evaluate(() => { document.querySelectorAll('.ov').forEach(o => { if (o.id && getComputedStyle(o).display !== 'none') try { closeM(o.id); } catch (e) {} }); });
  }
  // V) Ansicht: Asset-Seite (Price + History + Makro) und Chart-Fenster (alle Panels)
  await p.evaluate(() => { gotoSym('USD'); if (!makroGross()) makroSicht('charts'); }); await p.waitForTimeout(1500);
  const wo = () => p.evaluate(() => ({
    ab: !!document.querySelector('#detail .ab-ptile .br-chip'), hist: !!document.querySelector('#detail [data-br="hist"]') && !!document.querySelector('#detail .ab-htile-bd .br-chip, #detail .histp .br-chip'),
    mk: !!document.querySelector('#detail .rub-card .br-chip, #detail .mk-karte .br-chip'), n: [...document.querySelectorAll('#detail .br-chip')].filter(e => e.offsetParent).length }));
  await schere(p, 'ab'); await ziehe(p, '#detail .ab-ptile [data-br="ab"]');
  const v1 = await wo();
  if (!v1.ab) fail('ANSICHT', 'Price-Karte zeigt die Spanne nicht');
  if (!v1.hist) fail('ANSICHT', 'History-Karte uebernimmt die Spanne der Price-Karte nicht');
  if (!v1.mk) fail('ANSICHT', 'Makro-Charts uebernehmen die Spanne der Price-Karte nicht');
  await p.evaluate(() => { const x = [...document.querySelectorAll('#detail .br-chip .br-x')].find(e => e.offsetParent); if (x) x.click(); }); await p.waitForTimeout(1000);
  const v2 = await wo();
  if (v2.n) fail('ANSICHT', `× an einem Chip laesst ${v2.n} andere stehen`);
  await p.evaluate(() => { gotoSym('EUR'); }); await p.waitForTimeout(1200);
  await p.evaluate(() => { cpfOeffnen('niv:Unemployment Rate'); cpfUmschalten(0); }); await p.waitForTimeout(800);
  await schere(p, 'cpfSetRange'); await ziehe(p, '#cpfBody [data-br="cpfSetRange"]');
  const fen = await p.evaluate(() => ({ panels: document.querySelectorAll('#cpfBody .cpf-panel').length, custom: (document.querySelector('#cpfBody .ind-hist-range-btn.on:not(.br-sch)') || {}).textContent }));
  if (fen.panels < 2) fail('ANSICHT', `Chart-Fenster: ${fen.panels} Panel(s) statt 2`);
  else if (fen.custom !== 'Custom') fail('ANSICHT', `Chart-Fenster: Zeitfilter steht auf "${fen.custom}" statt Custom - die Spanne gilt nicht fuer alle Panels`);
  await p.evaluate(() => closeM('mCpChart'));
  perr.forEach(x => fail('JS-FEHLER', x));
  await ctx.close();
  // T) Touch
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
  if (await touch(true)) fail('TOUCH', 'ohne Schere setzt langes Druecken + Ziehen eine Spanne (soll nur mit Schere gehen)');
  if (await touch(false)) fail('TOUCH', 'kurzes Wischen setzt eine Spanne (soll Tooltip/Scrollen bleiben)');
  await t.evaluate(() => { const b = [...document.querySelectorAll('.br-sch')].find(x => x.dataset.brk === 'ab' && x.offsetParent); b.click(); });
  const scharf = await t.evaluate(() => !!document.querySelector('#detail .ab-ptile [data-br="ab"].br-scharf'));
  if (!scharf) fail('SCHERE', 'Antippen schaltet den Chart nicht scharf');
  if (!(await touch(false))) fail('SCHERE', 'mit Schere setzt einfaches Ziehen keine Spanne');
  const aus = await t.evaluate(() => !document.querySelector('.br-sch.on'));
  if (!aus) fail('SCHERE', 'nach der Auswahl bleibt die Schere an');
  await b.close();
  const gp = (name, re) => { const r = F.some(x => re.test(x)); console.log(r ? `zeitspanne ${name}: ok (rot wie erwartet, ${F.length} Befunde)` : `zeitspanne ${name}: FEHLER - nicht gemeldet`); process.exit(r ? 0 : 1); };
  if (GP) gp('--gegenprobe', /kein Chip/);
  if (GP_OS) gp('--gegenprobe-ohne-schere', /OHNE Schere/);
  if (GP_EIN) gp('--gegenprobe-einzeln', /ANSICHT/);
  if (F.length) { console.log(`zeitspanne: ${F.length} Befund(e)`); F.forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log(`zeitspanne: ok (${ok}/${FAELLE.length} Chart-Arten: ohne Schere keine Auswahl, mit Schere Chip + weniger Punkte, × stellt her; Ansicht: Price -> History + Makro, Fenster -> alle Panels, ein × fuer alle; Touch: nur mit Schere)`);
})().catch(e => { console.error(e); process.exit(2); });
