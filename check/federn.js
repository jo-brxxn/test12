// ══ WAECHTER: LEICHTES FEDERN AM SCROLL-ENDE ══════════════════════════════════
//
// Nutzer 2026-11-01: "Im Filter und generell wenn man scrollt dann bounct das
// ja am Ende immer so zurueck das finde ich gut mach das ueberall wo man
// scrollen kann" - "Senkrecht und seitlich aber in Tabellen nur ganz wenig und
// generell nur ganz wenig das es nicht so verspielt aussieht" (Wahl: eigenes
// leichtes Federn, js/federn.js; iOS-Federn hat keine einstellbare Staerke).
//
// Geprueft (echte Touch-Ereignisse ueber CDP):
//   A) NATIV AUS: jeder sichtbare Scrollbereich (auch .pc/.detail und die
//      Chip-Fenster) hat overscroll-behavior none in beiden Achsen - sonst
//      kaeme das volle iOS-Gummiband zum leichten dazu
// Die Deckel liest der Waechter aus FEDER_MAX in js/federn.js (seit 663, als
// das Federn auf Wunsch staerker wurde); "leicht" sichert die Obergrenze
// LEICHT_MAX - ein Deckel darueber ist rot, auch wenn er in der Datei steht.
//   B) SEITE: am Anfang 200 px nach unten ziehen -> Inhalt 1..Deckel px versetzt,
//      nach dem Loslassen wieder 0
//   C) LISTE: Dashboard-Liste oben (ziehen nach unten) und unten (nach oben)
//      -> 1..Deckel px, die Seite dahinter bewegt sich NICHT (keine Weitergabe),
//      danach wieder 0
//   D) SEITLICH (390 px): breiter Bereich am linken Rand nach rechts gezogen
//      -> 1..Deckel px, danach 0
//   E) AUSLAUFEN: kurz nach einer Beruehrung schnell an den Rand gescrollt ->
//      kurzer Kick (Animation hoechstens Deckel innen); per Mausrad (ohne
//      Beruehrung) -> kein Kick
// Gegenproben: --gegenprobe (federnAn wird nicht gestartet) -> B/C/D/E rot,
//   --gegenprobe-nativ (Seite wieder overscroll-behavior auto) -> A rot,
//   --gegenprobe-stark (Deckel innen 40 px) -> C rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_N = process.argv.includes('--gegenprobe-nativ');
const GP_S = process.argv.includes('--gegenprobe-stark');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const FED = fs.readFileSync(path.join(__dirname, '..', 'js', 'federn.js'), 'utf8');
const M_AN = 'try{federnAn();}catch(e){}';
const M_MAX_RE = /export const FEDER_MAX = \{ seite: (\d+), innen: (\d+), x: (\d+) \};/;
const M_MAX = (FED.match(M_MAX_RE) || [''])[0];
const [, D_S, D_I, D_X] = (FED.match(M_MAX_RE) || [0, 0, 0, 0]).map(Number);
// Obergrenze fuer "leicht" (Nutzer: "generell nur ganz wenig das es nicht so
// verspielt aussieht"; 663: "bischen staerker" -> 20/12/9).
const LEICHT_MAX = { seite: 24, innen: 14, x: 10 };

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);
const px = s => { const m = String(s || '').trim().split(/\s+/).map(parseFloat); return m.length ? m : [0]; };

(async () => {
  if ((GP && !MAIN.includes(M_AN)) || (GP_S && !M_MAX)) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  if (!M_MAX) { rot('FEDER_MAX in js/federn.js nicht gefunden'); process.exit(1); }
  if (D_S > LEICHT_MAX.seite || D_I > LEICHT_MAX.innen || D_X > LEICHT_MAX.x) rot(`Deckel ${D_S}/${D_I}/${D_X} ueber der Obergrenze fuer leichtes Federn (${LEICHT_MAX.seite}/${LEICHT_MAX.innen}/${LEICHT_MAX.x})`);
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  async function seite(w, h) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (GP) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MAIN.replace(M_AN, '') }));
    if (GP_S) await ctx.route(u => u.origin === HIER && /\/js\/federn\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FED.replace(M_MAX, `export const FEDER_MAX = { seite: ${D_S}, innen: 40, x: ${D_X} };`) }));
    const p = await ctx.newPage();
    p.perr = []; p.on('pageerror', e => p.perr.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    if (GP_N) await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.pc,.detail{overscroll-behavior-y:auto!important}'; document.head.appendChild(s); }));
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    p.cdp = await ctx.newCDPSession(p);
    return p;
  }
  // Ziehen: Start (x,y), Weg (dx,dy) in 15 Schritten; mess() waehrend und 450 ms nach dem Loslassen
  const zieh = async (p, x, y, dx, dy, mess) => {
    const t = (a, c) => [{ x: a, y: c, id: 1 }];
    await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: t(x, y) });
    for (let i = 1; i <= 15; i++) await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: t(x + dx * i / 15, y + dy * i / 15) });
    await p.waitForTimeout(60);
    const w = await p.evaluate(mess);
    await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(450);
    return { w, n: await p.evaluate(mess) };
  };
  // Versatz der Kinder eines markierten Bereichs (groesster Betrag, je Achse)
  const versatz = () => { const e = document.querySelector('[data-fe-test]'); let x = 0, y = 0; [...e.children].forEach(k => { const v = (k.style.translate || '').trim().split(/\s+/).map(parseFloat); if (Math.abs(v[0] || 0) > Math.abs(x)) x = v[0] || 0; if (Math.abs(v[1] || 0) > Math.abs(y)) y = v[1] || 0; }); const pc = document.querySelector('.pc:not([style*="display: none"])'); return { x, y, top: e.scrollTop, left: e.scrollLeft }; };

  const p = await seite(1180, 820);
  // ── A) nativ aus ──
  console.log('A) Natives iOS-Federn ueberall aus');
  const tabs = ['dash', 'cal', 'news', 'data', 'trends', 'cot'];
  let nA = 0; const falsch = new Set();
  for (const t of tabs) {
    await p.evaluate(t => { try { showTab(t); } catch (e) {} }, t); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const out = []; let n = 0; document.querySelectorAll('body *').forEach(e => { if (!e.offsetParent && e.tagName !== 'BODY') return; const cs = getComputedStyle(e); const sy = /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1, sx = /(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1; if (!sy && !sx) return; n++; if (cs.overscrollBehaviorY !== 'none' || cs.overscrollBehaviorX !== 'none') out.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) + ' ' + cs.overscrollBehaviorX + '/' + cs.overscrollBehaviorY); }); return { n, out }; });
    nA += r.n; r.out.forEach(x => falsch.add(x));
  }
  await p.evaluate(() => { showTab('data'); setDataMode('preis'); openDataPreisPicker(); }); await p.waitForTimeout(300);
  const pk = await p.evaluate(() => { const e = document.getElementById('dataPreisPicker'); const cs = e && getComputedStyle(e); const w = cs ? cs.overscrollBehaviorY + '/' + cs.overscrollBehaviorX : 'fehlt'; closeDataPreisPicker(); return w; });
  if (pk !== 'none/none') falsch.add('#dataPreisPicker ' + pk);
  if (falsch.size) rot(`A: natives Federn noch an: ${[...falsch].slice(0, 6).join(', ')}`); else gruen(`A: ${nA} Scrollbereiche auf ${tabs.length} Tabs + Chip-Fenster ohne natives Federn`);

  // ── B) Seite ──
  console.log('B) Seite: 200 px ueber den Anfang gezogen');
  await p.evaluate(() => showTab('dash')); await p.waitForTimeout(700);
  const st = await p.evaluate(() => { document.querySelectorAll('[data-fe-test]').forEach(e => e.removeAttribute('data-fe-test')); const e = [...document.querySelectorAll('.pc')].find(x => x.offsetParent && x.scrollHeight > x.clientHeight); if (!e) return null; e.scrollTop = 0; e.setAttribute('data-fe-test', '1'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 100 }; });
  if (!st) rot('B: keine scrollbare Seite');
  else {
    const r = await zieh(p, st.x, st.y, 0, 200, versatz);
    if (!(r.w.y > 0.9 && r.w.y <= D_S + 0.01)) rot(`B: Seite beim Ziehen ${r.w.y} px (soll 1..${D_S})`);
    else if (Math.abs(r.n.y) > 0.01) rot(`B: Seite nach dem Loslassen noch ${r.n.y} px versetzt`);
    else gruen(`B: Seite federt ${r.w.y} px (Deckel ${D_S}), danach 0`);
  }

  // ── C) Liste ──
  console.log('C) Dashboard-Liste: oben und unten, Seite bleibt stehen');
  const li = await p.evaluate(() => { document.querySelectorAll('[data-fe-test]').forEach(e => e.removeAttribute('data-fe-test')); const e = [...document.querySelectorAll('.dw-body > *')].find(x => x.offsetParent && /(auto|scroll)/.test(getComputedStyle(x).overflowY) && x.scrollHeight > x.clientHeight + 40); if (!e) return null; e.scrollIntoView({ block: 'center' }); e.scrollTop = 0; e.setAttribute('data-fe-test', '1'); const r = e.getBoundingClientRect(); return { cls: String(e.className).split(' ')[0], x: r.left + r.width / 2, y: r.top + 30, yU: r.bottom - 30 }; });
  if (!li) rot('C: keine scrollbare Dashboard-Liste');
  else {
    const seiteVor = await p.evaluate(() => { const pc = [...document.querySelectorAll('.pc')].find(x => x.offsetParent); return pc.scrollTop + '|' + [...pc.children].map(k => k.style.translate).join(''); });
    const r1 = await zieh(p, li.x, li.y, 0, 200, versatz);
    const seiteNach = await p.evaluate(() => { const pc = [...document.querySelectorAll('.pc')].find(x => x.offsetParent); return pc.scrollTop + '|' + [...pc.children].map(k => k.style.translate).join(''); });
    await p.evaluate(() => { const e = document.querySelector('[data-fe-test]'); e.scrollTop = e.scrollHeight; });
    const r2 = await zieh(p, li.x, li.yU, 0, -200, versatz);
    const ok = v => Math.abs(v) > 0.9 && Math.abs(v) <= D_I + 0.01;
    if (!ok(r1.w.y) || r1.w.y < 0) rot(`C: .${li.cls} oben ${r1.w.y} px (soll +1..${D_I})`);
    else if (!ok(r2.w.y) || r2.w.y > 0) rot(`C: .${li.cls} unten ${r2.w.y} px (soll -1..-${D_I})`);
    else if (Math.abs(r1.n.y) > 0.01 || Math.abs(r2.n.y) > 0.01) rot(`C: .${li.cls} nach dem Loslassen nicht zurueck (${r1.n.y}/${r2.n.y})`);
    else if (seiteVor !== seiteNach) rot(`C: die Seite hat sich mitbewegt (${seiteVor} -> ${seiteNach})`);
    else gruen(`C: .${li.cls} federt oben ${r1.w.y} / unten ${r2.w.y} px (Deckel ${D_I}), Seite steht, danach 0`);
  }

  // ── E) Auslaufen ──
  console.log('E) Auslaufen an den Rand: Kick nach Beruehrung, nicht per Mausrad');
  if (li) {
    const kickTest = async beruehrt => {
      if (beruehrt) { await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 3, y: 3, id: 1 }] }); await p.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      return p.evaluate(async () => { const e = document.querySelector('[data-fe-test]'); e.scrollTop = 300; await new Promise(r => setTimeout(r, 60)); for (let i = 0; i < 8; i++) { e.scrollTop -= 60; await new Promise(r => setTimeout(r, 16)); } await new Promise(r => setTimeout(r, 30)); const an = [...e.children].flatMap(k => k.getAnimations()); const amp = Math.max(0, ...an.flatMap(a => a.effect.getKeyframes().map(f => Math.abs(parseFloat(String(f.translate || '0').split(/\s+/)[1] || 0))))); return { n: an.length, amp }; });
    };
    const mitT = await kickTest(true);
    await p.waitForTimeout(2700);
    const ohneT = await kickTest(false);
    if (!mitT.n || mitT.amp < 1 || mitT.amp > D_I + 0.01) rot(`E: nach Beruehrung ${mitT.n} Animationen, Ausschlag ${mitT.amp} px (soll 1..${D_I})`);
    else if (ohneT.n) rot(`E: per Mausrad (ohne Beruehrung) trotzdem ${ohneT.n} Animationen`);
    else gruen(`E: Kick ${mitT.amp} px nach Beruehrung, keiner per Mausrad`);
  }
  const perr = [...p.perr];

  // ── D) seitlich ──
  console.log('D) Seitlich (390 px): breiter Bereich am linken Rand');
  const q = await seite(390, 844);
  let gefunden = null;
  for (const t of ['dash', 'cal', 'mx', 'cot', 'pairs', 'news', 'wl']) {
    await q.evaluate(t => { try { showTab(t); } catch (e) {} }, t); await q.waitForTimeout(500);
    gefunden = await q.evaluate(() => { document.querySelectorAll('[data-fe-test]').forEach(e => e.removeAttribute('data-fe-test')); const e = [...document.querySelectorAll('body *')].find(x => x.offsetParent && !x.classList.contains('pc') && /(auto|scroll)/.test(getComputedStyle(x).overflowX) && x.scrollWidth > x.clientWidth + 20 && x.clientHeight > 40 && x.children.length); if (!e) return null; e.scrollIntoView({ block: 'center' }); e.scrollLeft = 0; e.setAttribute('data-fe-test', '1'); const r = e.getBoundingClientRect(); return { cls: String(e.className).split(' ')[0] || e.tagName, x: r.left + 40, y: r.top + Math.min(r.height / 2, 40) }; });
    if (gefunden) { gefunden.tab = t; break; }
  }
  if (!gefunden) rot('D: kein seitlich scrollbarer Bereich bei 390 px gefunden');
  else {
    const r = await zieh(q, gefunden.x, gefunden.y, 200, 0, versatz);
    if (!(r.w.x > 0.9 && r.w.x <= D_X + 0.01)) rot(`D: ${gefunden.tab} .${gefunden.cls} seitlich ${r.w.x} px (soll 1..${D_X})`);
    else if (Math.abs(r.n.x) > 0.01) rot(`D: seitlich nach dem Loslassen noch ${r.n.x} px`);
    else gruen(`D: ${gefunden.tab} .${gefunden.cls} federt seitlich ${r.w.x} px (Deckel ${D_X}), danach 0`);
  }
  perr.push(...q.perr);

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  const gp = GP || GP_N || GP_S;
  if (gp) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ federn: ${fehler} Befund(e)` : `\n✓ federn: natives Federn aus, leichtes Federn an Seite (${D_S}), Listen (${D_I}), seitlich (${D_X}), Kick nur nach Beruehrung`);
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
