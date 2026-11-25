// ── NOTES: ORDNER MIT MINDMAP (Nutzer 2026-11-23, VERSION-CHECK-813) ─────────────
//  A) Karte heisst "Notes", Tipp oeffnet das Fenster; Ordner anlegen, Punkte + Unterpunkt anlegen
//  B) Baum: kein Knoten ueberlappt einen anderen, jeder Unterpunkt steht rechts von seinem Eltern-Punkt
//  C) Teilen: derselbe Ordner erscheint beim zweiten Asset; im snap() (Sync), nach Neuladen erhalten
//  D) Pinned note einsortieren -> Punkt im Ordner, Notiz nicht mehr angepinnt
//  E) Abgleich zweier Geraete (noVereinen): ein geloeschter Punkt kommt NICHT zurueck, neuerer Stand gewinnt
//  Z) (2026-11-25) Fenster fest: Fenster/Ueberlagerung/Flaeche scrollen nicht (overflow hidden, Flaeche
//     touch-action none); Ziehen in der Flaeche verschiebt, Strg+Rad zoomt, Fit; Zoom-Leiste verdeckt keinen Knoten
// --gegenprobe: Abgleich ohne Loesch-Marker (alter Punkt gewinnt) -> E rot.
// --gegenprobe-fest: Ansicht wird nie angewendet (kein Verschieben/Zoomen) -> Z rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const GP = process.argv.includes('--gegenprobe');
const GPZ = process.argv.includes('--gegenprobe-fest');
(async () => {
  const F = [], b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  const NOJS = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'notizordner.js'), 'utf8');
  if (GP) await ctx.route(/\/js\/notizordner\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: NOJS.replace('r.p[pid] = !px ? py : !py ? px : ((py.t || 0) >= (px.t || 0) ? py : px);', 'r.p[pid] = (px && !px.del) ? px : (py && !py.del) ? py : (px || py);') }));
  if (GPZ) await ctx.route(/\/js\/notizordner\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: NOJS.replace('we.style.transform = `translate(', 'void `translate(') }));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  const weg = () => p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  await p.goto(URL); await wartenBisDatenDa(p); await p.waitForTimeout(1500); await weg();
  // E zuerst (reine Logik ueber die echte Modul-Funktion)
  const E = await p.evaluate(async () => {
    const m = await import('./js/notizordner.js');
    const a = { f1: { id: 'f1', name: 'X', assets: ['USD'], t: 10, p: { p1: { id: 'p1', ti: 'alt', b: 'bull', t: 10 } } } };
    const bb = { f1: { id: 'f1', name: 'X', assets: ['USD'], t: 10, p: { p1: { id: 'p1', del: 20, t: 20 }, p2: { id: 'p2', ti: 'neu', b: 'bear', t: 15 } } } };
    const v = m.noVereinen(a, bb), w = m.noVereinen(bb, a);
    return { p1: !!(v.f1.p.p1 && !v.f1.p.p1.del), p1w: !!(w.f1.p.p1 && !w.f1.p.p1.del), p2: !!v.f1.p.p2 };
  });
  if (E.p1 || E.p1w) F.push('E: geloeschter Punkt kommt beim Abgleich zurueck');
  if (!E.p2) F.push('E: neuer Punkt des anderen Geraets fehlt nach dem Abgleich');
  // A
  await p.evaluate(() => { research.notes.push({ id: 'chkpin1', title: 'Check pinned', body: 'x', bias: 'bear', pin: true, asset: 'SILVER', ts: new Date().toISOString() }); save(); gotoSym('SILVER'); });
  await p.waitForTimeout(1200);
  const k = await p.evaluate(() => { const c = document.querySelector('.no-karte'); return c ? { t: c.querySelector('.ab-tile-t').textContent.trim() } : null; });
  if (!k || k.t !== 'Notes') F.push(`A: Karte "Notes" fehlt (${k && k.t})`);
  const kb = await p.locator('.no-karte .ab-tile-hd').boundingBox();
  await p.mouse.click(kb.x + 60, kb.y + kb.height / 2 + 40); await p.waitForTimeout(400);
  if (!(await p.isVisible('#mNotesOrdner'))) F.push('A: Tipp auf die Karte oeffnet das Fenster nicht');
  await p.click('.no-newf'); await p.fill('#noNameIn', 'Check folder'); await p.click('#mNoName .btn.g'); await p.waitForTimeout(300);
  const add = async (ti, b, par) => { await p.click('.no-kopf .btn.g'); await p.fill('#noPtTi', ti); await p.fill('#noPtTx', 'text ' + ti); await p.click(`#noPtBias [data-v=${b}]`);
    if (par) { await p.click('#noPtArtAst'); await p.selectOption('#noPtPar', { label: par }); } await p.click('#mNoPunkt .btn.g'); await p.waitForTimeout(300); };
  await add('Alpha', 'bear'); await add('Alpha child with a rather long title that must wrap onto lines', 'bull', 'Alpha'); await add('Beta', 'neu');
  if (await p.isVisible('#mNoPunkt')) F.push('A: Save schliesst das Punkt-Fenster nicht');
  // B
  const B = await p.evaluate(() => {
    const r = [...document.querySelectorAll('#noCanvas .no-pt,#noCanvas .no-root')].map(e => ({ t: e.textContent.trim(), r: e.getBoundingClientRect() }));
    let ue = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i].r, c = r[j].r; if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) ue++; }
    const alpha = r.find(x => x.t.startsWith('Alpha') && !x.t.includes('child')), kind = r.find(x => x.t.includes('child'));
    return { n: r.length, ue, rechts: alpha && kind ? kind.r.left > alpha.r.right : false };
  });
  if (B.n !== 4) F.push(`B: ${B.n} Knoten statt 4 (Wurzel + 3)`);
  if (B.ue) F.push(`B: ${B.ue} Ueberlappung(en) im Baum`);
  if (!B.rechts) F.push('B: Unterpunkt steht nicht rechts vom Eltern-Punkt');
  // Z
  const zst = () => p.evaluate(() => { const cv = document.getElementById('noCanvas'), m = document.querySelector('#mNotesOrdner .modal'), ov = document.getElementById('mNotesOrdner');
    const z = cv.querySelector('.no-zoom').getBoundingClientRect();
    const deckt = [...cv.querySelectorAll('.no-pt,.no-root')].filter(e => { const r = e.getBoundingClientRect(); return r.right > z.left && r.left < z.right && r.bottom > z.top && r.top < z.bottom; }).length;
    return { tf: (document.getElementById('noWelt') || {}).style ? document.getElementById('noWelt').style.transform : '', cv: getComputedStyle(cv).overflow, ta: getComputedStyle(cv).touchAction, m: getComputedStyle(m).overflow, ov: getComputedStyle(ov).overflowX, sl: m.scrollLeft + ov.scrollLeft + cv.scrollLeft, deckt }; });
  const z0 = await zst();
  if (z0.cv !== 'hidden' || z0.ta !== 'none' || z0.m !== 'hidden' || z0.ov !== 'hidden') F.push(`Z: Fenster/Flaeche nicht fest (Flaeche ${z0.cv}/${z0.ta}, Fenster ${z0.m}, Ueberlagerung ${z0.ov})`);
  if (z0.deckt) F.push(`Z: Zoom-Leiste verdeckt ${z0.deckt} Knoten`);
  const cb = await p.locator('#noCanvas').boundingBox();
  await p.mouse.move(cb.x + 30, cb.y + cb.height - 30); await p.mouse.down();
  for (let i = 1; i <= 6; i++) await p.mouse.move(cb.x + 30 + 15 * i, cb.y + cb.height - 30 - 5 * i);
  await p.mouse.up(); await p.waitForTimeout(200);
  const z1 = await zst();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.keyboard.down('Control'); await p.mouse.wheel(0, -200); await p.keyboard.up('Control'); await p.waitForTimeout(200);
  const z2 = await zst();
  const sk = t => +((/scale\(([\d.]+)\)/.exec(t || '') || [])[1] || 0);
  if (!z1.tf || z1.tf === z0.tf) F.push(`Z: Ziehen in der Flaeche verschiebt nichts (${z0.tf} -> ${z1.tf})`);
  if (!(sk(z2.tf) > sk(z1.tf))) F.push(`Z: Strg+Rad zoomt nicht (${z1.tf} -> ${z2.tf})`);
  if (z2.sl) F.push(`Z: Fenster/Flaeche hat gescrollt (${z2.sl} px)`);
  await p.click('.no-zoom button[title="Fit the whole map"]'); await p.waitForTimeout(150);
  if ((await zst()).deckt) F.push('Z: nach Fit verdeckt die Zoom-Leiste einen Knoten');
  // C
  await p.evaluate(() => { const o = Object.values(JSON.parse(snap()).notizOrdner).find(x => x.name === 'Check folder'); ordnerTeilen(o.id, 'GOLD', true); });
  await p.waitForTimeout(300);
  // D
  await p.click('.no-pin .btn'); await p.waitForTimeout(300); await p.click('#mNoPunkt .btn.g'); await p.waitForTimeout(400);
  const D = await p.evaluate(() => ({ pin: research.notes.find(n => n.id === 'chkpin1').pin, da: [...document.querySelectorAll('#noCanvas .no-pt')].some(e => /Check pinned/.test(e.textContent)) }));
  if (D.pin) F.push('D: einsortierte Notiz ist noch angepinnt'); if (!D.da) F.push('D: einsortierte Notiz fehlt als Punkt');
  await p.reload(); await wartenBisDatenDa(p); await p.waitForTimeout(1500); await weg();
  await p.evaluate(() => gotoSym('GOLD')); await p.waitForTimeout(1000);
  const C = await p.evaluate(() => { const c = document.querySelector('.no-karte'); return c ? c.textContent : ''; });
  if (!/Check folder/.test(C)) F.push('C: geteilter Ordner fehlt beim zweiten Asset nach dem Neuladen');
  err.forEach(x => F.push('JS-Fehler: ' + x));
  await b.close();
  if (GPZ) { const ok = F.some(f => /^Z: (Ziehen|Strg)/.test(f)); console.log(ok ? 'notizordner --gegenprobe-fest: ok (Z rot)' : 'notizordner --gegenprobe-fest: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (GP) { const ok = F.some(f => /^E: geloeschter/.test(f)); console.log(ok ? 'notizordner --gegenprobe: ok (Loeschung ohne Marker rot)' : 'notizordner --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log(`notizordner: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log('notizordner: ok (Karte Notes -> Fenster, Ordner + Punkte + Unterpunkt, Baum ohne Ueberlappung, geteilt bei Gold nach Neuladen, Pinned einsortiert, Abgleich mit Loesch-Marker, Fenster fest + Flaeche verschieben/zoomen)');
})().catch(e => { console.log('notizordner: ABBRUCH ' + e.message); process.exit(1); });
