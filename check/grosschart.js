// ── GROSSER PREISCHART (Nutzer 2026-11-27, VERSION-CHECK-825) ────────────────────
//  A) Price-Karte: "Open chart" unten rechts, KEIN "+ Mark", KEINE Marker (pk-nt) mehr in der Karte
//  B) Fenster oeffnet, Canvas in Fenstergroesse gezeichnet, Legende mit O/H/L/C
//  C) Rad zoomt (Spanne kleiner), Ziehen verschiebt (i0 aendert sich), Preisachse ziehen streckt, Doppeltipp zurueck
//  D) Marker: vorhandene Notiz mit pm erscheint als Kasten; "+ Mark" -> Kerze -> Ort -> Fenster -> Notiz mit
//     pm {a,d,bd,bp}, Kasten sichtbar; Kasten ziehen speichert neue Lage (bd/bp), pm.d bleibt
//  E) Tastatur: Pfeil links bewegt das Fadenkreuz eine Kerze
// --gegenprobe: Verschieben des Kastens speichert nicht -> D rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [], b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/grosschart\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'grosschart.js'), 'utf8').replace('H.pushU(); n.pm = pm;', 'H.pushU();') }));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto(URL); await wartenBisDatenDa(p); await p.waitForTimeout(1500);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); });
    const now = new Date().toISOString(), k = tagesKerzen(preisReiheAnzeige('GOLD'), 'GOLD'), d = k[k.length - 15].d;
    research.notes.push({ id: 'gcchk1', fids: [], title: 'Check mark', body: '', tags: ['chart'], pin: false, ts: now, up: now, bias: 'bear', asset: '', pm: { a: 'GOLD', d, bd: d, bo: 0, bp: k[k.length - 15].c } }); save(); gotoSym('GOLD'); });
  await p.waitForTimeout(1200);
  const A = await p.evaluate(() => ({ open: !!document.querySelector('.ab-ptile.pk .gc-open button'), add: !!document.querySelector('.ab-ptile.pk .pk-add-btn'), nt: document.querySelectorAll('.ab-ptile.pk .pk-nt').length }));
  if (!A.open) F.push('A: kein "Open chart" in der Price-Karte'); if (A.add) F.push('A: "+ Mark" steht noch in der Karte'); if (A.nt) F.push(`A: ${A.nt} Marker noch in der Karte`);
  await p.click('.ab-ptile.pk .gc-open button'); await p.waitForTimeout(700);
  const Bz = await p.evaluate(() => { const c = document.getElementById('gcCanvas'), f = document.getElementById('gcFlaeche').getBoundingClientRect(); return { auf: document.getElementById('mPreisGross').style.display !== 'none', w: c.clientWidth, fw: f.width, h: c.clientHeight, leg: document.getElementById('gcLeg').textContent, z: gcZustand() }; });
  if (!Bz.auf) F.push('B: Fenster oeffnet nicht');
  if (Math.abs(Bz.w - Bz.fw) > 2 || Bz.h < 300) F.push(`B: Canvas ${Bz.w}x${Bz.h} statt Flaechenbreite ${Bz.fw}`);
  if (!/O .*H .*L .*C /.test(Bz.leg) && !/Prev/.test(Bz.leg)) F.push(`B: Legende ohne O/H/L/C (${Bz.leg.slice(0, 60)})`);
  const fb = await p.locator('#gcFlaeche').boundingBox(), z0 = Bz.z;
  await p.mouse.move(fb.x + fb.width * 0.6, fb.y + fb.height * 0.5); await p.mouse.wheel(0, -400); await p.waitForTimeout(150);
  const z1 = await p.evaluate(() => gcZustand());
  if (!((z1.i1 - z1.i0) < (z0.i1 - z0.i0) * 0.95)) F.push('C: Rad zoomt nicht');
  await p.mouse.move(fb.x + fb.width * 0.5, fb.y + fb.height * 0.5); await p.mouse.down(); await p.mouse.move(fb.x + fb.width * 0.5 + 150, fb.y + fb.height * 0.5, { steps: 6 }); await p.mouse.up();
  const z2 = await p.evaluate(() => gcZustand());
  if (!(z2.i0 < z1.i0 - 1)) F.push('C: Ziehen verschiebt nicht');
  await p.mouse.move(fb.x + fb.width - 30, fb.y + fb.height * 0.5); await p.mouse.down(); await p.mouse.move(fb.x + fb.width - 30, fb.y + fb.height * 0.5 + 60, { steps: 4 }); await p.mouse.up();
  const z3 = await p.evaluate(() => gcZustand());
  if (!((z3.hi - z3.lo) > (z2.hi - z2.lo) * 1.1)) F.push('C: Preisachse ziehen streckt nicht');
  await p.dblclick('#gcFlaeche', { position: { x: fb.width * 0.4, y: fb.height * 0.5 } }); await p.waitForTimeout(150);
  const z4 = await p.evaluate(() => gcZustand());
  if (Math.abs(z4.i0 - z0.i0) > 0.5) F.push('C: Doppeltipp setzt nicht zurueck');
  // D
  if (!(await p.locator('.gc-nt[data-nt="gcchk1"]').count())) F.push('D: vorhandene Notiz mit pm erscheint nicht als Kasten');
  await p.click('#gcMarkBtn'); await p.mouse.click(fb.x + fb.width * 0.7, fb.y + fb.height * 0.5); await p.waitForTimeout(100); await p.mouse.click(fb.x + fb.width * 0.5, fb.y + fb.height * 0.3); await p.waitForTimeout(300);
  if (!(await p.isVisible('#mGcMark'))) F.push('D: "+ Mark" -> kein Fenster');
  else { await p.fill('#gcMarkTi', 'GC neu'); await p.click('#mGcMark [data-b=bull]'); await p.click('#mGcMark .btn.g'); await p.waitForTimeout(300); }
  const n = await p.evaluate(() => { const x = resNotes().find(q => q.title === 'GC neu'); return x && { pm: x.pm, b: x.bias }; });
  if (!n || n.pm.a !== 'GOLD' || !n.pm.d || !n.pm.bd || n.pm.bp == null || n.b !== 'bull') F.push(`D: neue Marke falsch gespeichert (${JSON.stringify(n)})`);
  if (!(await p.locator('.gc-nt:has-text("GC neu")').count())) F.push('D: neue Marke nicht im Chart');
  const vor = await p.evaluate(() => JSON.stringify(resNotes().find(q => q.id === 'gcchk1').pm));
  const bx = await p.locator('.gc-nt[data-nt="gcchk1"]').boundingBox();
  await p.mouse.move(bx.x + 8, bx.y + 6); await p.mouse.down(); await p.mouse.move(bx.x + 8, bx.y + 120, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300);
  const nach = await p.evaluate(() => resNotes().find(q => q.id === 'gcchk1').pm), v = JSON.parse(vor);
  if (nach.bp === v.bp || nach.d !== v.d) F.push(`D: Kasten ziehen speichert die neue Lage nicht (${vor} -> ${JSON.stringify(nach)})`);
  // E
  await p.evaluate(() => { document.getElementById('gcFlaeche').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })); });
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  const z5 = await p.evaluate(() => gcZustand());
  if (z5.hov !== z5.n - 3) F.push(`E: Pfeiltaste -> Fadenkreuz bei ${z5.hov}, erwartet ${z5.n - 3}`);
  err.forEach(x => F.push('JS-Fehler: ' + x));
  await b.close();
  if (GP) { const ok = F.some(f => /^D: Kasten ziehen/.test(f)); console.log(ok ? 'grosschart --gegenprobe: ok (Verschieben ohne Speichern rot)' : 'grosschart --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log(`grosschart: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log('grosschart: ok (Karte: Open chart, keine Marker/+ Mark; Fenster: Canvas, Legende, Zoom, Verschieben, Achse strecken, Doppeltipp; Marker anzeigen/setzen/verschieben; Pfeiltasten)');
})().catch(e => { console.log('grosschart: ABBRUCH ' + e.message); process.exit(1); });
