// ══ WAECHTER: PRICE-KARTE B (Release-Pfeile, Spalte, eigene Pfeile, Vergleich) ══
//
// Nutzer 2026-11-01 (Wahl aus drei Entwuerfen): "Option b nur eine Aenderung
// mit Pfeilen statt Punkten und mach einen Button die Markierungen aus dem
// Chart auszublenden und mach es so wie bei data bei compare all das man einen
// grossen Filter hat und bis zu 2 Assets in den Chart hinzufuegen kann wenn das
// passiert soll der Chart automatisch zu Linien werden sonst bei nur einem
// Asset als Kerze" - dazu der Seitenaufbau "Price volle Breite, Kalender rechts
// neben History, 3 Karten nebeneinander" und "Entfern den Button preischart".
// Geprueft (1366 px; G bei 390 px):
//   A) AUFBAU: Price allein in der ersten Reihe (volle Breite), darunter
//      Pinned notes · History · Calendar in EINER Reihe; kein "Price chart"
//   B) PFEILE: EUR 3M hat Pfeile, jeder in einer Bias-Farbe, jeder im Chart
//      und ueber einem Tag mit Kurs (nicht schwebend in der Mitte)
//   C) SPALTE: zuerst "Next up"; Tipp auf einen Pfeil -> Datum als Titel,
//      so viele Karten wie der Pfeil Releases zaehlt, jede mit Forecast und
//      Previous; Tipp ins Leere -> wieder "Next up"
//   D) AUSBLENDEN: Knopf Markers -> 0 Pfeile, aria-pressed false, Einstellung
//      gespeichert (fxpro_pk_marken = 0); wieder an -> Pfeile da
//   E) EIGENER PFEIL: + Mark -> Tag -> Popover; leer speichern geht nicht;
//      gespeichert = Notiz mit pm, hohler Pfeil, "Mine" in der Spalte;
//      loeschen -> aus den Notizen, im Papierkorb
//   F) VERGLEICH: Gruppen-Fenster; 1 Kurs dazu -> 2 Linien, keine Kerzen,
//      Display "Lines ..."; 2 dazu -> 3 Linien, Fenster zu, ein dritter geht
//      nicht; alle weg -> wieder Kerzen, Display "Candles ..."
//   G) HANDY (390): Spalte UNTER dem Chart, Pfeile je Woche
// Gegenproben: --gegenprobe-leer (Tipp ins Leere wirkt nicht) -> C rot,
//   --gegenprobe-linien (Vergleich als Kerzen) -> F rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP_L = process.argv.includes('--gegenprobe-leer');
const GP_K = process.argv.includes('--gegenprobe-linien');
const PK = fs.readFileSync(path.join(__dirname, '..', 'js', 'preiskarte.js'), 'utf8');
const M_L = '  if(pkSel)pkWaehle(null);\n},true);';
const M_K = "preisChartHtml(keys,W,H,{typ:'linie',";
const BC = ['rgb(11, 95, 204)', 'rgb(220, 36, 48)', 'rgb(85, 97, 122)'];

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if ((GP_L && !PK.includes(M_L)) || (GP_K && !PK.includes(M_K))) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  let pk = PK;
  if (GP_L) pk = pk.replace(M_L, '\n},true);');
  if (GP_K) pk = pk.replace(M_K, "preisChartHtml(keys,W,H,{typ:'kerze',");
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const perr = [];
  async function seite(w, h, asset) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (GP_L || GP_K) await ctx.route(u => u.origin === HIER && /\/js\/preiskarte\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: pk }));
    const p = await ctx.newPage(); p.on('pageerror', e => perr.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.removeItem('fxpro_pk_marken'); } catch (e) {} });
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    await p.evaluate(a => { showTab('cur'); selSym(a); window.scrollTo(0, 0); }, asset); await p.waitForTimeout(1200);
    return { p, ctx };
  }
  // 2026-11-11: ohne Auswahl traegt der Spaltenkopf den Umschalter Next up | Biggest moves - Titel = aktiver Reiter
  const titel = p => p.evaluate(() => ((document.querySelector('.pk-col-t') || document.querySelector('.pk-col .pk-modus .on')) || {}).textContent || '');
  {
    console.log('── 1366 px, EUR');
    const { p, ctx } = await seite(1366, 1024, 'EUR');
    // A
    const a = await p.evaluate(() => {
      const cards = document.querySelector('#detail .ab-cards').getBoundingClientRect();
      const prow = [...document.querySelectorAll('#detail .ab-prow > .ab-col')];
      const r3 = [...document.querySelectorAll('#detail .ab-orow3 > .ab-col')].map(c => ({ k: c.firstElementChild ? c.firstElementChild.className : '', t: Math.round(c.getBoundingClientRect().top) }));
      return { n: prow.length, pk: prow.length ? !!prow[0].querySelector('.ab-ptile.pk') : false, w: prow.length ? prow[0].getBoundingClientRect().width / cards.width : 0, r3, knopf: [...document.querySelectorAll('#detail .dmeta-hist-btn')].some(x => /price chart/i.test(x.textContent)) };
    });
    const ord = a.r3.map(x => /ab-htile/.test(x.k) ? 'History' : /abc-cal/.test(x.k) ? 'Calendar' : /ab-ntile/.test(x.k) ? 'Pinned' : x.k).join('|');
    if (a.n !== 1 || !a.pk || a.w < 0.97) rot(`A: erste Reihe ${a.n} Karte(n), Price ${a.pk}, Breite ${(a.w * 100).toFixed(0)} %`);
    else if (ord !== 'Pinned|History|Calendar' || new Set(a.r3.map(x => x.t)).size !== 1) rot(`A: zweite Reihe ${ord}, Oberkanten ${a.r3.map(x => x.t).join('/')}`);
    else if (a.knopf) rot('A: Knopf "Price chart" steht noch in der Kopfleiste');
    else gruen('A: Price volle Breite, darunter Pinned notes · History · Calendar in einer Reihe, kein "Price chart"');
    // B
    const bb = await p.evaluate(() => {
      const ch = document.querySelector('.ab-ptile.pk .pk-chart .chv').getBoundingClientRect();
      return [...document.querySelectorAll('.pk-pf')].map(pf => {
        const r = pf.getBoundingClientRect(), i = pf.querySelector('.pk-pf-i:not(.pk-eig)');
        return { x: r.left + r.width / 2 - ch.left, y: r.bottom - ch.top, w: ch.width, h: ch.height, col: i ? getComputedStyle(i).color : null };
      });
    });
    const schlecht = bb.filter(z => !BC.includes(z.col) || z.x < 0 || z.x > z.w || z.y < -2 || z.y > z.h * 0.92);
    if (bb.length < 10) rot(`B: nur ${bb.length} Pfeile auf EUR 3M`);
    else if (schlecht.length) rot(`B: ${schlecht.length} Pfeil(e) ausserhalb/ohne Bias-Farbe, z. B. ${JSON.stringify(schlecht[0])}`);
    else gruen(`B: ${bb.length} Pfeile, alle in Bias-Farbe und ueber einem Kurs im Chart`);
    // C
    const t0 = await titel(p);
    const ziel = await p.evaluate(() => { const l = [...document.querySelectorAll('.pk-pf')].filter(x => x.querySelector('.pk-pf-i:not(.pk-eig)')); const pf = l[Math.floor(l.length / 2)]; const n = pf.querySelector('.pk-n'); return { b: pf.dataset.b, n: n ? +n.textContent : 1 }; });
    await p.locator(`.pk-pf[data-b="${ziel.b}"]`).click(); await p.waitForTimeout(400);
    const c1 = await p.evaluate(() => ({ t: (document.querySelector('.pk-col-t') || {}).textContent || '', k: [...document.querySelectorAll('.pk-col .pk-ev:not(.pk-ev-eig)')].map(e => /Forecast/.test(e.textContent) && /Previous/.test(e.textContent)), on: document.querySelectorAll('.pk-pf.on').length }));
    const box = await p.locator('.ab-ptile.pk .pk-chart .chv').boundingBox();
    await p.mouse.click(box.x + box.width * 0.5, box.y + box.height - 6); await p.waitForTimeout(400);
    const t2 = await titel(p);
    if (t0 !== 'Next up') rot(`C: Spalte startet mit "${t0}"`);
    else if (!/\d/.test(c1.t) || c1.k.length !== ziel.n || c1.k.some(x => !x) || c1.on !== 1) rot(`C: nach Tipp Titel "${c1.t}", ${c1.k.length} Karten (Pfeil zaehlt ${ziel.n}), gewaehlt ${c1.on}`);
    else if (t2 !== 'Next up') rot(`C: Tipp ins Leere -> "${t2}" statt Next up`);
    else gruen(`C: Next up -> Tipp "${c1.t}" mit ${ziel.n} Karte(n) (Forecast/Previous) -> ins Leere -> Next up`);
    // D
    await p.click('.pk-mk-btn'); await p.waitForTimeout(500);
    const d1 = await p.evaluate(() => ({ n: document.querySelectorAll('.pk-pf').length, pr: document.querySelector('.pk-mk-btn').getAttribute('aria-pressed'), ls: localStorage.getItem('fxpro_pk_marken'), add: !!document.querySelector('.pk-add-btn') }));
    await p.click('.pk-mk-btn'); await p.waitForTimeout(500);
    const d2 = await p.evaluate(() => document.querySelectorAll('.pk-pf').length);
    if (d1.n || d1.pr !== 'false' || d1.ls !== '0' || d1.add || !d2) rot(`D: aus -> ${d1.n} Pfeile, pressed ${d1.pr}, gespeichert ${d1.ls}, + Mark ${d1.add}; wieder an -> ${d2}`);
    else gruen(`D: Markers aus -> 0 Pfeile, gespeichert (fxpro_pk_marken=0), wieder an -> ${d2}`);
    // E
    await p.click('.pk-add-btn'); await p.waitForTimeout(150);
    await p.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.5); await p.waitForTimeout(350);
    const pop = await p.evaluate(() => !!document.getElementById('pkPop'));
    let e1 = null;
    if (pop) {
      await p.click('#pkPop .pk-ok'); await p.waitForTimeout(200);
      const leer = await p.evaluate(() => ({ pop: !!document.getElementById('pkPop'), n: resNotes().filter(n => n.pm).length }));
      await p.fill('#pkIn', 'Waechter-Pfeil'); await p.click('#pkPop .pk-rund[aria-label="Bullish"]'); await p.click('#pkPop .pk-ok'); await p.waitForTimeout(800);
      e1 = await p.evaluate(() => { const n = resNotes().find(x => x.pm && x.title === 'Waechter-Pfeil'); return { leer: null, n: !!n, bias: n && n.bias, a: n && n.pm.a, hohl: document.querySelectorAll('.pk-pf-i.pk-eig').length, mine: document.querySelectorAll('.pk-col .pk-ev-eig').length, id: n && n.id }; });
      e1.leer = leer;
      if (e1.id) { await p.locator('.pk-col .pk-ev-eig .pk-del').first().click(); await p.waitForTimeout(600); }
      e1.weg = await p.evaluate(id => ({ n: resNotes().some(x => x.id === id), trash: (research.trash || []).some(t => t.data && t.data.id === id) }), e1.id);
    }
    if (!pop) rot('E: kein Popover nach + Mark und Tipp');
    else if (!e1.leer.pop || e1.leer.n) rot(`E: leer gespeichert (Popover ${e1.leer.pop}, Notizen ${e1.leer.n})`);
    else if (!e1.n || e1.bias !== 'bull' || e1.a !== 'EUR' || !e1.hohl || !e1.mine) rot(`E: gespeichert ${JSON.stringify(e1)}`);
    else if (e1.weg.n || !e1.weg.trash) rot(`E: loeschen -> noch in Notizen ${e1.weg.n}, im Papierkorb ${e1.weg.trash}`);
    else gruen('E: + Mark -> Popover, leer nicht speicherbar, Notiz mit pm (EUR, bull), hohler Pfeil + "Mine"; loeschen -> Papierkorb');
    // F
    await p.click('#pkVglBtn'); await p.waitForTimeout(250);
    await p.evaluate(() => pkVglGruppe('Metals')); await p.waitForTimeout(200);
    await p.locator('#pkVglPicker .data-picker-body .cmp-chip').first().click(); await p.waitForTimeout(1000);
    const f1 = await p.evaluate(() => ({ l: document.querySelectorAll('.pk-vgl .pv-linie').length, k: document.querySelectorAll('.pk-vgl .pv-kz').length, d: (document.querySelector('[data-km="abPreis"] em') || {}).textContent || '', pf: document.querySelectorAll('.pk-pf').length }));
    if (!(await p.evaluate(() => !!document.getElementById('pkVglPicker')))) { await p.click('#pkVglBtn'); await p.waitForTimeout(250); }
    await p.evaluate(() => pkVglGruppe('Indices')); await p.waitForTimeout(200);
    await p.locator('#pkVglPicker .data-picker-body .cmp-chip').first().click(); await p.waitForTimeout(1000);
    const f2 = await p.evaluate(() => ({ l: document.querySelectorAll('.pk-vgl .pv-linie').length, offen: !!document.getElementById('pkVglPicker'), vgl: pkZustand().vgl.EUR.length }));
    await p.evaluate(() => { pkVglUmschalten('p:SILVER'); }); await p.waitForTimeout(300);
    const f3 = await p.evaluate(() => pkZustand().vgl.EUR.length);
    for (let i = 0; i < 2; i++) { const x = p.locator('.pk-vgl .pv-x').first(); if (await x.count()) { await x.click(); await p.waitForTimeout(800); } }
    const f4 = await p.evaluate(() => ({ vgl: !!document.querySelector('.pk-vgl'), k: document.querySelectorAll('.ab-ptile.pk .ab-chart rect').length, d: (document.querySelector('[data-km="abPreis"] em') || {}).textContent || '' }));
    if (f1.l !== 2 || f1.k || !/^Lines/.test(f1.d) || !f1.pf) rot(`F: 1 dazu -> ${f1.l} Linien, ${f1.k} Kerzengruppen, Display "${f1.d}", ${f1.pf} Pfeile`);
    else if (f2.l !== 3 || f2.offen || f2.vgl !== 2 || f3 !== 2) rot(`F: 2 dazu -> ${f2.l} Linien, Fenster offen ${f2.offen}; dritter -> ${f3} statt 2`);
    else if (f4.vgl || f4.k < 20 || !/^Candles/.test(f4.d)) rot(`F: alle weg -> Vergleich ${f4.vgl}, ${f4.k} Kerzen, Display "${f4.d}"`);
    else gruen('F: 1 Kurs dazu -> 2 Linien (Display "Lines"), 2 -> 3 Linien + Fenster zu, kein dritter, alle weg -> Kerzen');
    await ctx.close();
  }
  {
    console.log('── 390 px, USD');
    const { p, ctx } = await seite(390, 844, 'USD');
    const g = await p.evaluate(() => {
      const ch = document.querySelector('.ab-ptile.pk .pk-chart').getBoundingClientRect(), col = document.querySelector('.ab-ptile.pk .pk-col').getBoundingClientRect();
      const pf = [...document.querySelectorAll('.pk-pf')];
      return { unter: col.top >= ch.bottom - 1, n: pf.length, woche: pf.length && pf.every(x => /^Week of/.test(x.getAttribute('aria-label'))), rechts: Math.max(...[...document.querySelectorAll('.ab-ptile.pk *')].map(e => e.getBoundingClientRect().right)) - innerWidth };
    });
    if (!g.unter || !g.n || !g.woche || g.rechts > 1) rot(`G: Spalte unter dem Chart ${g.unter}, ${g.n} Pfeile, je Woche ${g.woche}, ueber den Rand ${g.rechts.toFixed(1)} px`);
    else gruen(`G: Spalte unter dem Chart, ${g.n} Pfeile je Woche, nichts ragt ueber den Rand`);
    await ctx.close();
  }
  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP_L || GP_K) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ preiskarte: ${fehler} Befund(e)` : '\n✓ preiskarte: Aufbau, Pfeile, Spalte, Ausblenden, eigene Pfeile, Vergleich, Handy');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
