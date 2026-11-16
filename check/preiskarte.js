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
//      Previous; Tipp ins Leere -> wieder "Next up" (nach Verlassen des Charts - Fahren
//      ueber den Chart zeigt seit 2026-11-15 den Tag unter der Maus)
//   D) AUSBLENDEN: Knopf Markers -> 0 Pfeile, aria-pressed false, Einstellung
//      gespeichert (fxpro_pk_marken = 0); wieder an -> Pfeile da
//   E) EIGENER PFEIL: + Mark -> Tag -> Popover; leer speichern geht nicht;
//      gespeichert = Notiz mit pm, Flagge mit Text im Chart (seit 2026-11-15), "Mine" in der Spalte;
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
    // B (seit 2026-11-16, 738: Release-Pfeile und Markers-Knopf entfernt)
    const bb = await p.evaluate(() => ({ pf: document.querySelectorAll('.pk-pf').length, mk: !!document.querySelector('.pk-mk-btn'), add: !!document.querySelector('.pk-add-btn') }));
    if (bb.pf || bb.mk || !bb.add) rot(`B: ${bb.pf} Pfeile, Markers-Knopf ${bb.mk}, + Mark ${bb.add} (erwartet 0 / false / true)`);
    else gruen('B: keine Release-Pfeile, kein Markers-Knopf, + Mark da');
    // C/H: Maus ueber einer Kerze -> Spalte zeigt GENAU diesen Tag mit seinen Releases
    const t0 = await titel(p);
    const box = await p.locator('.ab-ptile.pk .pk-chart .chv').boundingBox();
    let treffer = null, fx = 0;
    for (let f = 0.35; f < 0.98 && !treffer; f += 0.02) {
      await p.mouse.move(box.x + box.width * f, box.y + box.height * 0.5); await p.waitForTimeout(120);
      const z = await p.evaluate(() => { const h = pkZustand().hover; if (!h) return null; const rel = (pkReleases('EUR') || {})[h.k] || []; return { k: h.k, soll: rel.length, ist: document.querySelectorAll('.pk-col .pk-ev:not(.pk-ev-eig)').length, t: (document.querySelector('.pk-col-t') || {}).textContent || '' }; });
      if (z && z.soll > 0) { treffer = z; fx = f; }
    }
    if (t0 !== 'Next up') rot(`C: Spalte startet mit "${t0}"`);
    else if (!treffer) rot('H: Fahren ueber den Chart findet keinen Tag mit Releases');
    else if (treffer.ist !== treffer.soll || !/\d/.test(treffer.t)) rot(`H: ${treffer.k}: Spalte "${treffer.t}" mit ${treffer.ist} Karten, der Tag hat ${treffer.soll} Releases`);
    else gruen(`H: Maus ueber ${treffer.k} -> Spalte "${treffer.t}" mit genau ${treffer.soll} Release(s) des Tages`);
    // Klick haelt fest, Maus weg -> bleibt; derselbe Tag nochmal geklickt -> Next up
    const px = box.x + box.width * fx, py = box.y + box.height * 0.5;
    await p.mouse.click(px, py); await p.waitForTimeout(400);
    await p.mouse.move(2, 2); await p.waitForTimeout(400);
    const c1 = await p.evaluate(() => ({ sel: pkZustand().sel, t: (document.querySelector('.pk-col-t') || {}).textContent || '' }));
    await p.mouse.click(px, py); await p.waitForTimeout(400);
    await p.mouse.move(2, 2); await p.waitForTimeout(400);
    const c2 = await titel(p);
    if (!c1.sel || !/\d/.test(c1.t)) rot(`C: Klick haelt den Tag nicht fest (Auswahl ${JSON.stringify(c1.sel)}, Titel "${c1.t}")`);
    else if (c2 !== 'Next up') rot(`C: derselbe Tag nochmal geklickt -> "${c2}" statt Next up`);
    else gruen(`C: Klick haelt ${c1.sel.k} fest (Maus weg -> bleibt "${c1.t}"), nochmal -> Next up`);
    await p.evaluate(() => pkModusSetzen('next')); await p.waitForTimeout(300);
    const t2 = await titel(p);
    if (t2 !== 'Next up') rot(`C: Reiter Next up -> "${t2}"`);
    // D: Finger (Touch) ueber den Chart -> Tag in der Spalte, bleibt nach dem Loslassen
    const cdp = await ctx.newCDPSession(p);
    const yy = box.y + box.height * 0.5, x0 = box.x + box.width * 0.5, x1 = box.x + box.width * 0.8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: yy }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 6, y: yy }] }); await p.waitForTimeout(40); }
    const d1 = await p.evaluate(() => ({ sel: pkZustand().sel, t: (document.querySelector('.pk-col-t') || {}).textContent || '' }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
    const d2 = await p.evaluate(() => ({ sel: pkZustand().sel, t: (document.querySelector('.pk-col-t') || {}).textContent || '' }));
    if (!d1.sel || !/\d/.test(d1.t)) rot(`D: Finger ueber dem Chart zeigt keinen Tag (${JSON.stringify(d1)})`);
    else if (!d2.sel || d2.t !== d1.t) rot(`D: nach dem Loslassen weg (${JSON.stringify(d2)})`);
    else gruen(`D: Finger zieht ueber den Chart -> Spalte "${d1.t}", bleibt nach dem Loslassen`);
    await p.evaluate(() => pkModusSetzen('next')); await p.waitForTimeout(300);
    // E
    await p.click('.pk-add-btn'); await p.waitForTimeout(150);
    await p.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.5); await p.waitForTimeout(350);
    const pop = await p.evaluate(() => !!document.getElementById('pkPop'));
    let e1 = null;
    if (pop) {
      await p.click('#pkPop .pk-ok'); await p.waitForTimeout(200);
      const leer = await p.evaluate(() => ({ pop: !!document.getElementById('pkPop'), n: resNotes().filter(n => n.pm).length }));
      await p.fill('#pkIn', 'Waechter-Pfeil'); await p.click('#pkPop .pk-rund[aria-label="Bullish"]'); await p.click('#pkPop .pk-ok'); await p.waitForTimeout(800);
      e1 = await p.evaluate(() => { const n = resNotes().find(x => x.pm && x.title === 'Waechter-Pfeil'); return { leer: null, n: !!n, bias: n && n.bias, a: n && n.pm.a, hohl: [...document.querySelectorAll('.pk-flagge')].filter(f => /Waechter-Pfeil/.test(f.textContent)).length, mine: document.querySelectorAll('.pk-col .pk-ev-eig').length, id: n && n.id }; });
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
    if (f1.l !== 2 || f1.k || !/^Lines/.test(f1.d)) rot(`F: 1 dazu -> ${f1.l} Linien, ${f1.k} Kerzengruppen, Display "${f1.d}", ${f1.pf} Pfeile`);
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
    if (!g.unter || g.n || g.rechts > 1) rot(`G: Spalte unter dem Chart ${g.unter}, ${g.n} Pfeile (erwartet 0), ueber den Rand ${g.rechts.toFixed(1)} px`);
    else gruen('G: Spalte unter dem Chart, keine Pfeile, nichts ragt ueber den Rand');
    await ctx.close();
  }
  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP_L || GP_K) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ preiskarte: ${fehler} Befund(e)` : '\n✓ preiskarte: Aufbau, Pfeile, Spalte, Ausblenden, eigene Pfeile, Vergleich, Handy');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
