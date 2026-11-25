// ── CHECKLISTS (Nutzer 2026-11-25, VERSION-CHECK-822) ──────────────────────────
//  A) Leiste: "Checklists" da, "Trash" NICHT mehr (nur noch ueber die Settings: Knopf in mCloud oeffnet die Seite)
//  B) Vorlage "Rate decision": Liste mit 2 Ordnern + 4 Fragen, aufgeklappt; Frage = Titel + Stichpunkte (jede Zeile)
//  C) Frage ueber das Fenster in einen Ordner, nach oben verschieben, in anderen Ordner umhaengen
//  D) Frage loeschen -> Papierkorb -> wiederherstellen; Neuladen: alles noch da (snap)
//  E) Abgleich zweier Geraete (chkVereinen): geloeschte Frage kommt NICHT zurueck, neuere gewinnt
//  F) Kartentitel 17 px (Regel 9), nichts ragt bei 390 px aus der Karte
// --gegenprobe: Abgleich ohne Loesch-Marker (alte Frage gewinnt) -> E rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [], b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/checklisten\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'checklisten.js'), 'utf8').replace("const juenger = (x, y) => !x ? y : !y ? x : ((y.t || 0) > (x.t || 0) || ((y.t || 0) === (x.t || 0) && y.del && !x.del)) ? y : x;", "const juenger = (x, y) => !x ? y : !y ? x : (x.del ? y : (y.del ? x : ((y.t || 0) > (x.t || 0) ? y : x)));") }));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  const weg = () => p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  await p.goto(URL); await wartenBisDatenDa(p); await weg();
  // E (Logik ueber die echte Modul-Funktion)
  const E = await p.evaluate(async () => {
    const m = await import('./js/checklisten.js');
    const a = { l1: { id: 'l1', name: 'L', c: 'rate', o: 1, t: 10, f: {}, q: { q1: { id: 'q1', ti: 'alt', tx: '', o: 1, t: 10 } } } };
    const bb = { l1: { id: 'l1', name: 'L', c: 'rate', o: 1, t: 10, f: {}, q: { q1: { id: 'q1', del: 20, t: 20 }, q2: { id: 'q2', ti: 'neu', tx: '', o: 2, t: 15 } } } };
    const v = m.chkVereinen(a, bb), w = m.chkVereinen(bb, a);
    return { q1: !!(v.l1.q.q1 && !v.l1.q.q1.del), q1w: !!(w.l1.q.q1 && !w.l1.q.q1.del), q2: !!v.l1.q.q2 };
  });
  if (E.q1 || E.q1w) F.push('E: geloeschte Frage kommt beim Abgleich zurueck');
  if (!E.q2) F.push('E: neue Frage des anderen Geraets fehlt nach dem Abgleich');
  // A
  const A = await p.evaluate(() => { const t = [...document.querySelectorAll('#navSidebar .np')].map(x => x.textContent.trim()); return { chk: t.some(x => /^Checklists$/.test(x)), trash: t.some(x => /^Trash$/.test(x)), knopf: !![...document.querySelectorAll('#mCloud button')].find(x => /Trash/.test(x.textContent)) }; });
  if (!A.chk) F.push('A: "Checklists" fehlt in der Leiste'); if (A.trash) F.push('A: "Trash" steht noch in der Leiste'); if (!A.knopf) F.push('A: Settings ohne Knopf "Trash"');
  await p.evaluate(() => { const k = [...document.querySelectorAll('#mCloud button')].find(x => /Trash/.test(x.textContent)); k.click(); }); await p.waitForTimeout(300);
  if (!(await p.isVisible('#pgNotes'))) F.push('A: Knopf "Trash" in den Settings oeffnet die Seite nicht');
  // B
  await p.click('#navSidebar .np:has-text("Checklists")'); await p.waitForTimeout(300);
  await p.click('.chk-vl:has-text("Rate decision")'); await p.waitForTimeout(300);
  const B = await p.evaluate(() => { const k = document.querySelector('.chk-karte.auf'); return k ? { f: k.querySelectorAll('.chk-f').length, q: k.querySelectorAll('.chk-q').length, pk: k.querySelector('.chk-q .chk-pk') ? k.querySelector('.chk-q .chk-pk').children.length : 0 } : null; });
  if (!B || B.f !== 2 || B.q !== 4) F.push(`B: Vorlage ergibt ${JSON.stringify(B)} statt 2 Ordner / 4 Fragen`);
  else if (B.pk < 2) F.push('B: Erklaerung nicht als Stichpunkte (jede Zeile ein Punkt)');
  // C
  await p.click('.chk-f:has-text("Decision") .chk-f-akt button:has-text("Question")'); await p.waitForTimeout(200);
  await p.fill('#chkQTi', 'Check question'); await p.fill('#chkQTx', '- one\n- two'); await p.click('#mChkFrage .btn.g'); await p.waitForTimeout(300);
  const reihe = () => p.evaluate(() => [...document.querySelectorAll('.chk-f')].map(f => [...f.querySelectorAll('.chk-q-x>b')].map(x => x.textContent)));
  let r = await reihe();
  if (!r[0] || r[0][r[0].length - 1] !== 'Check question') F.push(`C: neue Frage nicht am Ende von "Decision" (${JSON.stringify(r[0])})`);
  await p.click('.chk-q:has-text("Check question") .chk-mv button[aria-label="Move up"]'); await p.waitForTimeout(300);
  r = await reihe(); if (!r[0] || r[0][1] !== 'Check question') F.push(`C: nach oben verschieben wirkt nicht (${JSON.stringify(r[0])})`);
  await p.click('.chk-q-x:has-text("Check question")'); await p.waitForTimeout(200); await p.selectOption('#chkQOrd', { label: 'Market' }); await p.click('#mChkFrage .btn.g'); await p.waitForTimeout(300);
  r = await reihe(); if (!r[1] || !r[1].includes('Check question') || r[0].includes('Check question')) F.push(`C: Umhaengen in "Market" wirkt nicht (${JSON.stringify(r)})`);
  // D
  await p.click('.chk-q-x:has-text("Check question")'); await p.waitForTimeout(200); await p.click('#chkQDel'); await p.waitForTimeout(300);
  const tr = await p.evaluate(() => (research.trash || []).filter(t => t.kind === 'chkq').map(t => t.id));
  if (!tr.length) F.push('D: geloeschte Frage nicht im Papierkorb');
  else { await p.evaluate(id => restoreTrashItem(id), tr[0]); await p.waitForTimeout(300); if (!(await p.evaluate(() => [...document.querySelectorAll('.chk-q-x>b')].some(x => x.textContent === 'Check question')))) F.push('D: Wiederherstellen bringt die Frage nicht zurueck'); }
  await p.waitForTimeout(900); await p.reload(); await wartenBisDatenDa(p); await weg(); await p.evaluate(() => showTab('chk')); await p.waitForTimeout(400);
  const D = await p.evaluate(() => [...document.querySelectorAll('.chk-karte .ab-tile-t')].map(x => x.textContent));
  if (!D.includes('Rate decision')) F.push('D: Liste nach dem Neuladen weg');
  // F
  const fs1 = await p.evaluate(() => getComputedStyle(document.querySelector('.chk-karte .ab-tile-t')).fontSize);
  if (fs1 !== '17px') F.push(`F: Kartentitel ${fs1} statt 17px`);
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { document.querySelector('.chk-karte .chk-hd').click(); }); await p.waitForTimeout(300);
  const ueber = await p.evaluate(() => { const out = []; document.querySelectorAll('.chk-karte').forEach(k => { const kr = k.getBoundingClientRect(); k.querySelectorAll('button,b,li,.chk-sub').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > kr.right + 1 || r.left < kr.left - 1)) out.push(e.textContent.trim().slice(0, 30)); }); }); return out; });
  if (ueber.length) F.push(`F: bei 390 px ragt aus der Karte: ${ueber.slice(0, 4).join(' | ')}`);
  err.forEach(x => F.push('JS-Fehler: ' + x));
  await b.close();
  if (GP) { const ok = F.some(f => /^E: geloeschte/.test(f)); console.log(ok ? 'checklisten --gegenprobe: ok (Loeschung ohne Marker rot)' : 'checklisten --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log(`checklisten: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log('checklisten: ok (Leiste ohne Trash, Trash ueber Settings, Vorlage 2 Ordner/4 Fragen mit Stichpunkten, Frage anlegen/verschieben/umhaengen, Papierkorb, Neuladen, Abgleich mit Loesch-Marker, 17 px, 390 px)');
})().catch(e => { console.log('checklisten: ABBRUCH ' + e.message); process.exit(1); });
