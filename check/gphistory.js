// ── GAMEPLAN-HISTORY (seit 2026-11-17, VERSION-CHECK-756) ──────────────────────────────────
// Nutzer 2026-11-17: "bei den gameplans ... Ich mach selber also muss es einen Button geben um
// das da abzulegen" + "im Papierkorb soll alles reinkommen was auf der Webseite geloescht wird".
// gameplans[id].h = abgelegte Staende; Loeschen = Grabstein + Papierkorb (kind 'gphist').
// Geprueft:
//  A) "Save to history" zweimal -> zwei Eintraege im Fenster, neueste oben, mit Datum
//  B) Loeschen -> Grabstein, Eintrag im Papierkorb und auf der Trash-Seite
//  C) Abgleich mit einem Geraet, das den Grabstein nicht kennt und selbst etwas abgelegt hat:
//     der geloeschte Eintrag bleibt weg, der fremde kommt dazu (Vereinigung + Loesch-Marker)
//  D) Wiederherstellen aus dem Papierkorb, danach Abgleich mit dem alten Grabstein: bleibt da
//  E) nach Neuladen alles wie vorher; F) die Gameplan-Kopie am Trade traegt keine History
// --gegenprobe: alte Vereinigung (ganzer Eintrag, juengeres t gewinnt) -> C rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/gameplan\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('const h=histVereinen(a[id]&&a[id].h,b[id].h);', 'const h=histRein(((b[id].t||0)>=((a[id]||{}).t||0)?b[id]:a[id]||b[id]).h);'); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  const H = () => p.evaluate(() => JSON.stringify(((JSON.parse(snap()).gameplans.EUR || {}).h || []).map(x => x.del ? 'DEL' : x.th)));
  // A
  await p.evaluate(() => { gpText('EUR', 'th', 'GH eins'); gpBias('EUR', 'bull'); gpHistAblegen('EUR'); gpText('EUR', 'th', 'GH zwei'); gpHistAblegen('EUR'); gpHistAuf('EUR'); });
  await p.waitForTimeout(300);
  const A = await p.evaluate(() => [...document.querySelectorAll('#gpHistBody .ph-z b')].map(x => x.textContent));
  if (A.join('|') !== 'GH zwei|GH eins') F.push('A: Fenster zeigt ' + JSON.stringify(A) + ' statt ["GH zwei","GH eins"]');
  // B
  const hid = await p.evaluate(() => JSON.parse(snap()).gameplans.EUR.h.find(x => x.th === 'GH eins').id);
  await p.evaluate(h => gpHistLoeschen('EUR', h), hid); await p.waitForTimeout(200);
  if (await H() !== '["DEL","GH zwei"]') F.push('B: nach Loeschen ' + await H());
  const imMuell = await p.evaluate(() => (research.trash || []).filter(t => t.kind === 'gphist').length);
  if (imMuell !== 1) F.push('B: ' + imMuell + ' Eintraege im Papierkorb statt 1');
  await p.evaluate(() => { closeM('mGpHist'); showTab('notes'); }); await p.waitForTimeout(400);
  if (!(await p.evaluate(() => /GH eins/.test(document.getElementById('pgNotes').innerText)))) F.push('B: Trash-Seite zeigt den Eintrag nicht');
  // C: fremdes Geraet ohne Grabstein, mit eigenem neuen Eintrag, juengeres t
  const C = await p.evaluate(async h => {
    const m = await import('/js/gameplan.js'); const lok = JSON.parse(snap()).gameplans, fremd = JSON.parse(JSON.stringify(lok));
    fremd.EUR.h = [{ id: h, at: 1, u: 1, b: 'bull', th: 'GH eins', en: { t: '', k: '', v: '' }, br: { t: '', k: '', v: '' } }, { id: 'ghfremd', at: Date.now() + 5, u: Date.now() + 5, b: 'bear', th: 'GH fremd', en: { t: '', k: '', v: '' }, br: { t: '', k: '', v: '' } }];
    fremd.EUR.t = Date.now() + 10;
    return JSON.stringify(m.gpVereinen(lok, fremd).EUR.h.map(x => x.del ? 'DEL' : x.th));
  }, hid);
  if (C !== '["DEL","GH zwei","GH fremd"]') F.push('C: Vereinigung ' + C + ' statt ["DEL","GH zwei","GH fremd"]');
  // D
  await p.evaluate(() => { const t = research.trash.find(t => t.kind === 'gphist'); restoreTrashItem(t.id); }); await p.waitForTimeout(200);
  const D = await p.evaluate(async h => {
    const m = await import('/js/gameplan.js'); const lok = JSON.parse(snap()).gameplans, alt = JSON.parse(JSON.stringify(lok));
    alt.EUR.h = alt.EUR.h.map(x => x.id === h ? { id: h, at: x.at, u: x.u - 1000, del: 1 } : x);
    return JSON.stringify(m.gpVereinen(lok, alt).EUR.h.map(x => x.del ? 'DEL' : x.th));
  }, hid);
  if (D !== '["GH eins","GH zwei"]') F.push('D: nach Wiederherstellen + Abgleich mit altem Grabstein ' + D);
  // E
  const vor = await H();
  await p.reload(); await wartenBisDatenDa(p); await p.waitForTimeout(800);
  if (await H() !== vor) F.push('E: nach Neuladen ' + await H() + ' statt ' + vor);
  // F
  const Fk = await p.evaluate(async () => { const m = await import('/js/gameplan.js'); const k = m.gpKopie('EUR'); return k ? ('h' in k) : 'keine Kopie'; });
  if (Fk !== false) F.push('F: Gameplan-Kopie fuer Trades traegt History (' + Fk + ')');
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^C:/.test(f)); console.log(ok ? 'gphistory --gegenprobe: ok (Grabstein geht beim Abgleich verloren)' : 'gphistory --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('gphistory: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('gphistory: ok (Ablegen, Fenster, Loeschen -> Trash, Vereinigung mit Grabstein, Wiederherstellen schlaegt alten Grabstein, Neuladen, Trade-Kopie ohne History)');
})().catch(e => { console.log('gphistory: ABBRUCH ' + e.message); process.exit(1); });
