// ── DATA-VOLLBILD (seit 2026-11-19/20, VERSION-CHECK-775/777) ──
// Nutzer 2026-11-19: Vollbild "der ganze ... bildschirm ... ausser die obere Leiste ... oben in flach den Filter
// und den Zeitfilter mehr nicht. In maximal eine Zeile"; iPad-Fotos 2026-11-19: "nicht scrollbar machst" (6 Panels,
// zweite Reihe abgeschnitten) und Settings-Fenster im Vollbild (linker Streifen anders abgedunkelt, weil das
// Fenster-Dunkel die Seitenleiste aussparte, die im Vollbild ueberdeckt ist).
//  A) #pgData deckt alles unter der oberen Leiste ab (links 0, rechts Fensterbreite, unten Fensterhoehe)
//  B) kein Scrollen: scrollHeight == clientHeight, letztes Panel endet im Bild (6 und 8 Panels)
//  C) Kopf = eine Zeile; das ✕ zum Verlassen liegt ganz im Bild
//  D) ein Fenster (Settings) deckt die GANZE Breite ab (Punkt links aussen trifft das Fenster-Dunkel)
//  E) Esc beendet das Vollbild
// 1194x834, 1920x1080, 390x844. --gegenprobe: Ausnahme in ovRahmen entfernt -> D rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const MARKE = "&&!document.body.classList.contains('data-voll')){const b=sb.getBoundingClientRect();";
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H, n] of [[1194, 834, 6], [1920, 1080, 8], [390, 844, 6]]) {
    const o = `${W}px/${n}`;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); if (!t.includes(MARKE)) F.push('Testaufbau: Marke in ovRahmen fehlt'); if (GP) t = t.replace(MARKE, "){const b=sb.getBoundingClientRect();"); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(1500);
    await p.evaluate(n => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); showTab('data'); setDataMode('assets'); dataAssets.length = 0; ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'].slice(0, n).forEach(x => dataAssets.push(x)); dataIndBase = 'CPI (Headline)'; renderDataTab(); }, n);
    await p.waitForTimeout(900);
    await p.click('.data-voll-b'); await p.waitForTimeout(1000);
    const m = await p.evaluate(() => { const pg = document.getElementById('pgData'), q = pg.getBoundingClientRect(), h = document.querySelector('.hdr').getBoundingClientRect();
      const ps = [...pg.querySelectorAll('.data-panel')], letzt = ps[ps.length - 1].getBoundingClientRect(), z = document.querySelector('.data-voll-z'), x = document.querySelector('.data-voll-b').getBoundingClientRect();
      const kinder = z ? [...z.children].filter(c => c.getBoundingClientRect().width).map(c => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2)) : [];
      return { l: q.left, r: q.right, t: q.top, u: q.bottom, hu: h.bottom, sh: pg.scrollHeight, ch: pg.clientHeight, letzt: letzt.bottom, x: [x.left, x.right], zeilen: new Set(kinder.map(v => Math.round(v / 6))).size }; });
    if (Math.abs(m.l) > 1 || Math.abs(m.r - W) > 1 || Math.abs(m.u - H) > 1 || Math.abs(m.t - m.hu) > 2) F.push(`${o} A: Flaeche ${Math.round(m.l)}..${Math.round(m.r)} x ${Math.round(m.t)}..${Math.round(m.u)} statt 0..${W} x ${Math.round(m.hu)}..${H}`);
    if (m.sh > m.ch + 1) F.push(`${o} B: scrollt (${m.sh} > ${m.ch})`);
    if (m.letzt > H + 1) F.push(`${o} B: letztes Panel endet bei ${Math.round(m.letzt)} > ${H}`);
    if (m.zeilen > 1) F.push(`${o} C: Kopf in ${m.zeilen} Zeilen`);
    if (m.x[0] < 0 || m.x[1] > W + 0.5) F.push(`${o} C: ✕ ausserhalb des Bildes (${Math.round(m.x[0])}..${Math.round(m.x[1])})`);
    if (W > 700) {
      await p.evaluate(() => openM('mCloud')); await p.waitForTimeout(500);
      const d = await p.evaluate(() => { const e = document.elementFromPoint(4, innerHeight - 6); return !!(e && e.closest('.ov')); });
      if (!d) F.push(`${o} D: Fenster-Dunkel deckt den linken Rand nicht ab`);
      await p.evaluate(() => closeM('mCloud')); await p.waitForTimeout(300);
    }
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    if (await p.evaluate(() => document.body.classList.contains('data-voll'))) F.push(`${o} E: Esc beendet das Vollbild nicht`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / D: /.test(f)); console.log(ok ? 'datavoll --gegenprobe: ok (Fenster-Dunkel ohne Ausnahme gemeldet)' : 'datavoll --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('datavoll: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('datavoll: ok (ganze Flaeche unter der Leiste, kein Scrollen mit 6/8 Panels, Kopf einzeilig, ✕ im Bild, Fenster deckt ganz ab, Esc; 1194/1920/390 px)');
})().catch(e => { console.log('datavoll: ABBRUCH ' + e.message); process.exit(1); });
