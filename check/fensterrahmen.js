// ── FENSTER ZWISCHEN KOPFZEILE UND SEITENLEISTE (seit 2026-11-17, VERSION-CHECK-743) ──
// Nutzer 2026-11-17: "alle Fenster die man oeffnen kann sollen absofort innerhalb der oberen
// und linken Leiste sein damit man auch die Pfeiltaste da benutzen kann. Klickt man was anderes
// schliesst es sich wenn der Inhalt nicht gespeichert ist wird wie normal gefragt".
// Rueckfrage: Pfeil-Tipp = Fenster zu + Pfeil wirkt; Handy volle Breite unter der Kopfzeile.
//  A) 1194 px: Overlay beginnt an der Unterkante der Kopfzeile und rechts der Seitenleiste,
//     das Fenster liegt ganz darin (Settings, New trade)
//  B) 390 px: Overlay unter der Kopfzeile, volle Breite
//  C) New trade ohne Eingabe, Tipp auf den Undo-Pfeil: Fenster zu UND Undo ausgefuehrt
//  D) New trade mit Eingabe, Tipp auf "Dashboard" in der Seitenleiste (Handy: Undo-Pfeil): Nachfrage,
//     Seite und Fenster bleiben, der Tipp wirkt nicht
//  E) statisch: keine Fenster-Regel rechnet mit inset:0 + 100vw/100dvh (Vollbild-Varianten)
// --gegenprobe: ovRahmen setzt nichts -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  // E
  [...html.matchAll(/([^{}]*(?:\.ov\b|modal|-voll)[^{}]*)\{([^}]*)\}/g)].forEach(m => {
    if (/position:fixed/.test(m[2]) && /inset:0\b/.test(m[2]) && /100vw|100dvh/.test(m[2])) F.push('E: Fenster-Regel ignoriert die Leisten: ' + m[1].trim().slice(0, 80));
  });
  if (!/\.ov\{position:fixed;inset:var\(--ov-t/.test(html)) F.push('E: .ov rechnet nicht mit --ov-t/--ov-l');
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace("r.setProperty('--ov-t',t+'px');r.setProperty('--ov-l',l+'px');", ''); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); });
    const lage = id => p.evaluate(id => {
      const ov = document.getElementById(id), m = ov.querySelector('.modal') || ov.firstElementChild, h = document.querySelector('.hdr').getBoundingClientRect(), sb = document.getElementById('navSidebar').getBoundingClientRect();
      const r = ov.getBoundingClientRect(), mr = m.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left), hdr: Math.round(h.bottom), sb: Math.round(sb.right), drin: mr.top >= r.top - 1 && mr.left >= r.left - 1 && mr.right <= r.right + 1 && mr.bottom <= r.bottom + 1 };
    }, id);
    // A / B
    for (const [id, auf] of [['mCloud', () => openCloudM()], ['mTrade', () => { showTab('journal'); tjNeu(); }]]) {
      await p.evaluate(auf); await p.waitForTimeout(500);
      const L = await lage(id);
      const sollL = W > 700 ? L.sb : 0;
      if (Math.abs(L.top - L.hdr) > 1) F.push(`${o} ${W > 700 ? 'A' : 'B'}: ${id} beginnt bei ${L.top} px statt unter der Kopfzeile (${L.hdr} px)`);
      if (Math.abs(L.left - sollL) > 1) F.push(`${o} ${W > 700 ? 'A' : 'B'}: ${id} links bei ${L.left} px statt ${sollL} px`);
      if (!L.drin) F.push(`${o} ${W > 700 ? 'A' : 'B'}: ${id} ragt aus seinem Bereich`);
      await p.evaluate(id => closeM(id), id); await p.waitForTimeout(200);
    }
    // C: Undo-Pfeil bei offenem, leerem Fenster
    await p.evaluate(() => { showTab('gameplan'); gpBias('CHF', 'bull'); }); await p.waitForTimeout(1200);
    await p.evaluate(() => { showTab('journal'); tjNeu(); }); await p.waitForTimeout(500);
    const ub = await p.evaluate(() => { const b = document.getElementById('undoBtn').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, !document.getElementById('undoBtn').disabled]; });
    if (!ub[2]) F.push(`${o} C: Testaufbau - nichts zum Rueckgaengigmachen`);
    else {
      await p.mouse.click(ub[0], ub[1]); await p.waitForTimeout(700);
      const C = await p.evaluate(() => ({ zu: getComputedStyle(document.getElementById('mTrade')).display === 'none', b: (JSON.parse(snap()).gameplans.CHF || {}).b || '' }));
      if (!C.zu) F.push(`${o} C: Tipp auf den Pfeil schliesst New trade nicht`);
      if (C.b !== '') F.push(`${o} C: Tipp auf den Pfeil bei offenem Fenster macht nichts rueckgaengig (CHF ${C.b})`);
    }
    // D: Ungespeichertes + Tipp auf die Seitenleiste
    await p.evaluate(() => { showTab('journal'); tjNeu(); }); await p.waitForTimeout(500);
    await p.fill('#tjEntry', '1.2345'); await p.waitForTimeout(100);
    // Handy: das Fenster deckt die Leiste (volle Breite) -> dort die Kopfzeile (Undo-Pfeil) antippen
    const nav = W <= 700 ? ub : await p.evaluate(() => { const e = [...document.querySelectorAll('#navSidebar *')].find(x => x.children.length < 4 && /^\s*Dashboard\s*$/.test(x.textContent) && x.getBoundingClientRect().width > 0); const b = (e.closest('button,a,[onclick]') || e).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await p.mouse.click(nav[0], nav[1]); await p.waitForTimeout(500);
    const D = await p.evaluate(() => ({ frage: getComputedStyle(document.getElementById('mUnsaved')).display !== 'none', seite: curPage, offen: getComputedStyle(document.getElementById('mTrade')).display !== 'none' }));
    if (!D.frage) F.push(`${o} D: Ungespeichertes + Tipp auf die Seitenleiste ohne Nachfrage`);
    if (D.seite !== 'journal' || !D.offen) F.push(`${o} D: Seite gewechselt bzw. Fenster weg trotz offener Nachfrage (${D.seite})`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: /.test(f)); console.log(ok ? 'fensterrahmen --gegenprobe: ok (Fenster ueber den Leisten gemeldet)' : 'fensterrahmen --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('fensterrahmen: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('fensterrahmen: ok (Fenster unter der Kopfzeile + rechts der Leiste, Handy volle Breite, Pfeil schliesst + macht rueckgaengig, Ungespeichertes fragt nach, 1194/390 px)');
})().catch(e => { console.log('fensterrahmen: ABBRUCH ' + e.message); process.exit(1); });
