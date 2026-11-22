// ── WELTKUGEL: ERST TIPPEN, DANN DREHEN (seit 2026-11-22, VERSION-CHECK-790) ──
// Nutzer 2026-11-22: "Bei der Weltkugel soll man auch erst tippen damit man scrollen kann"
// (wie die Karten-Listen, 773). Vorher: .globe-host touch-action none -> ein Finger auf der
// Kugel scrollte die Seite NIE, jedes Wischen drehte die Kugel.
//  A) ohne Tipp: touch-action erlaubt Scrollen, Finger-Wisch auf der Kugel dreht nicht (kein .grabbing)
//  B) Tipp auf die Kugel -> .gl-an, touch-action none, Wisch dreht (.grabbing)
//  C) Tipp daneben (ausserhalb der Kugel) -> gesperrt, Wisch dreht wieder nicht
//  D) Maus: Ziehen dreht ohne Tipp (Rad scrollt sowieso die Seite)
// --gegenprobe: Sperre im Code entfernt -> A rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const MARKE = "  if(ev.pointerType!=='mouse'&&!host.classList.contains('gl-an'))return;";
(async () => {
  const F = [], OK = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/globe\.js/, async r => { const res = await r.fetch(); let t = await res.text(); if (!t.includes(MARKE)) F.push('Gegenprobe: Marke fehlt'); r.fulfill({ response: res, body: t.replace(MARKE, '') }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  await p.evaluate(() => showTab('dash')); await p.waitForTimeout(2500);
  const k = await p.evaluate(() => { const h = document.getElementById('dashGlobeHost'); if (!h) return null; h.scrollIntoView({ block: 'center' }); const s = h.querySelector('svg').getBoundingClientRect(); return { x: s.x + s.width / 2, y: s.y + s.height / 2, r: s.width / 2 }; });
  if (!k) { console.log('kugeltipp: Testaufbau - keine Kugel auf dem Dashboard'); process.exit(1); }
  await p.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(p);
  const zustand = () => p.evaluate(() => { const h = document.getElementById('dashGlobeHost'); return { an: h.classList.contains('gl-an'), ta: getComputedStyle(h).touchAction }; });
  // Wisch waagrecht ueber die Kugel; gemessen wird, ob ein Dreh-Ziehen beginnt (.grabbing)
  const wisch = async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: k.x - 40, y: k.y }] });
    let grab = false;
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: k.x - 40 + 14 * i, y: k.y }] }); await p.waitForTimeout(20); grab = grab || await p.evaluate(() => document.getElementById('dashGlobeHost').classList.contains('grabbing')); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(250);
    return grab;
  };
  const tipp = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300); };
  // A
  const a0 = await zustand(), aG = await wisch();
  if (a0.ta === 'none' || aG) F.push(`A: ohne Tipp touch-action "${a0.ta}", Wisch dreht ${aG}`); else OK.push(`A: ohne Tipp touch-action "${a0.ta}", Wisch dreht nicht`);
  // B: Tipp nicht auf einen Marker (Mitte; Marker koennen dort liegen -> notfalls etwas versetzt)
  const ziel = await p.evaluate(k => { for (const [dx, dy] of [[0, 0], [0, 30], [0, -30], [30, 0], [-30, 0]]) { const id = (window.__globeMarkerPositionen ? window.__globeMarkerPositionen() : []).find(m => Math.hypot(m.x - k.x - dx, m.y - k.y - dy) < 24); if (!id) return [k.x + dx, k.y + dy]; } return [k.x, k.y]; }, k);
  await tipp(ziel[0], ziel[1]);
  const b0 = await zustand(), bG = await wisch();
  if (!b0.an || b0.ta !== 'none' || !bG) F.push(`B: nach Tipp gl-an ${b0.an}, touch-action "${b0.ta}", Wisch dreht ${bG}`); else OK.push('B: Tipp schaltet frei, touch-action none, Wisch dreht');
  // C
  await tipp(k.x + k.r + 60 < 1190 ? k.x + k.r + 60 : k.x - k.r - 60, k.y);
  const c0 = await zustand(), cG = await wisch();
  if (c0.an || cG) F.push(`C: Tipp daneben -> gl-an ${c0.an}, Wisch dreht ${cG}`); else OK.push('C: Tipp daneben sperrt wieder');
  // D
  await p.mouse.move(k.x - 40, k.y); await p.mouse.down(); let dG = false;
  for (let i = 1; i <= 6; i++) { await p.mouse.move(k.x - 40 + 14 * i, k.y); dG = dG || await p.evaluate(() => document.getElementById('dashGlobeHost').classList.contains('grabbing')); }
  await p.mouse.up();
  if (!dG) F.push('D: Maus-Ziehen dreht nicht'); else OK.push('D: Maus-Ziehen dreht ohne Tipp');
  if (err.length) F.push('JS: ' + err.slice(0, 2).join(' | '));
  await b.close();
  OK.forEach(m => console.log('  ✓ ' + m)); F.forEach(m => console.log('  ✗ ' + m));
  if (GP) { console.log(F.length ? `Gegenprobe ok: ${F.length} Befund(e), wie erwartet rot.` : 'Gegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(F.length ? 0 : 1); }
  console.log(F.length ? `✗ kugeltipp: ${F.length} Befund(e)` : 'kugeltipp: ok (Weltkugel erst nach Tipp drehbar, sonst scrollt die Seite; Maus unveraendert)');
  process.exit(F.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
