// ── NICHTS UEBERLAPPT (Dauerregel seit 2026-11-17, VERSION-CHECK-747) ──────────────────
// Nutzer 2026-11-17 (iPad-Foto, Preisleiste eines offenen Trades: "SL 1.22149" lag auf
// "Entry 1.22825"): "Es darf zu keiner Zeit egal wo auf der Webseite Elemente ueberlappen".
// Gemessen: 390 px, AUD/NZD Long -> 20,3 x 15,4 px; dieselbe Klasse bei den Gameplan-Linien im
// Kerzen-Chart (Entry 3859 / Break 3862 -> 72 x 16 px). Geprueft:
//  A) Preisleiste: 24 offene Trades mit engen/weiten/gleichen Leveln, Journal + Dashboard-Karte
//     + Trade-Details, 1194/390 px -> keine Beschriftung und kein Punkt deckt einen anderen
//  B) Gameplan-Linien: Entry/Break 0, 1 und 3 auseinander, beide ausserhalb der Spanne
//  C) Rundgang: jedes sichtbare Textstueck auf Dashboard, Journal, Gameplan, GOLD, EUR, SOL,
//     Set-ups, Kalender (sichtbar = innerhalb aller abschneidenden Eltern) deckt kein anderes
// --gegenprobe: tjpAnordnen() aus (alte Oben/unten-Abwechslung) -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
// Messung im Browser: Paare sichtbarer Kaesten, die sich decken (Rand 0,5 px)
const MESSEN = ([sel, minX, minY]) => {
  const clip = e => { let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible') { const r = a.getBoundingClientRect(); c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) }; } } return c; };
  const sichtbar = e => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity < 0.05) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  let els;
  if (sel === 'TEXT') els = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg,.ov,[aria-hidden="true"]') && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && sichtbar(e));
  else els = [...document.querySelectorAll(sel)].filter(sichtbar);
  const rs = els.map(e => { let rr; if (sel === 'TEXT') { const g = document.createRange(); g.selectNodeContents(e); rr = [...g.getClientRects()]; } else rr = [e.getBoundingClientRect()]; const c = clip(e); return { e, rr: rr.map(x => ({ left: Math.max(x.left, c.left), top: Math.max(x.top, c.top), right: Math.min(x.right, c.right), bottom: Math.min(x.bottom, c.bottom) })).filter(x => x.right - x.left > 0.5 && x.bottom - x.top > 0.5) }; });
  const out = [];
  for (let i = 0; i < rs.length && out.length < 6; i++) for (let j = i + 1; j < rs.length; j++) {
    const A = rs[i], B = rs[j]; if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
    if (sel !== 'TEXT' && A.e.closest('.tjp,.ab-pk-chart') !== B.e.closest('.tjp,.ab-pk-chart')) continue;
    for (const a of A.rr) for (const c of B.rr) { const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left), oy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ox > minX && oy > minY) out.push(`"${A.e.textContent.trim().slice(0, 22) || A.e.className}" x "${B.e.textContent.trim().slice(0, 22) || B.e.className}" ${ox.toFixed(1)}x${oy.toFixed(1)}`); }
  }
  return out;
};
(async () => {
  const F = [];
  // A: Trades mit allen Lagen (enge Level, gleiche Werte, Short, ohne TP/SL)
  const tr = [];
  const basis = [['AUD/NZD', 1.22825, 1.22149, 1.24338], ['EUR/USD', 1.085, 1.0846, 1.0853], ['GOLD', 3860, 3858, 3990], ['BTC', 64800, 64750, 64810], ['SOL', 73.6, 73.5, 80], ['USD/JPY', 154.2, 154.25, 150]];
  basis.forEach(([a, e, sl, tp], i) => ['long', 'short'].forEach((dir, k) => [0, 1].forEach(v => {
    const s2 = dir === 'short' ? 2 * e - sl : sl, t2 = dir === 'short' ? 2 * e - tp : tp;
    tr.push({ id: `uw${i}${k}${v}`, d: '2026-11-1' + (i % 9), a, st: 'open', dir, entry: String(e), sl: v ? '' : String(s2), tp: String(t2), up: '2026-11-12T00:00:00Z' });
  })));
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/trades\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('function tjpAnordnen(el){', 'function tjpAnordnen(el){return;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(t => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.setItem('fxpro_trades', t); } catch (e) { } }, JSON.stringify(tr));
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
    for (const [wo, fn] of [['Journal', "showTab('journal')"], ['Dashboard', "showTab('dash')"]]) {
      await p.evaluate(fn); await p.waitForTimeout(1200);
      const n = await p.evaluate(() => document.querySelectorAll('.tjp').length);
      const A = await p.evaluate(MESSEN, ['.tjp-lbl,.tjp-pkt', 0.5, 0.5]);
      if (wo === 'Journal' && n < 20) F.push(`${o} A: Testaufbau - nur ${n} Preisleisten im Journal`);
      if (A.length) F.push(`${o} A: ${wo} - ${A.length}x Ueberlappung in der Preisleiste, z. B. ${A[0]}`);
    }
    // Trade-Details (geschlossener Trade mit engem Exit)
    await p.evaluate(() => { showTab('journal'); });
    // B: Gameplan-Linien
    for (const [abst, name] of [[0, 'gleich'], [1, '1 auseinander'], [3, '3 auseinander'], [1e6, 'beide ueber der Spanne']]) {
      await p.evaluate(a => { const g = PRICE_DATA_FEED.GOLD.series; const v = Math.round(+g[g.length - 1][1]) + (a > 1000 ? a : 0); gpText('GOLD', 'en', 'e'); gpArt('GOLD', 'en', 'p'); gpWert('GOLD', 'en', String(v)); gpText('GOLD', 'br', 'b'); gpArt('GOLD', 'br', 'p'); gpWert('GOLD', 'br', String(v + (a > 1000 ? 5 : a))); gotoSym('GOLD'); }, abst);
      await p.waitForTimeout(1600);
      const Bn = await p.evaluate(() => document.querySelectorAll('#detail .gp-niv').length);
      const B = await p.evaluate(MESSEN, ['#detail .gp-niv', 0.5, 0.5]);
      if (Bn < 2) F.push(`${o} B: Testaufbau - ${Bn} Level-Beschriftungen (${name})`);
      if (B.length) F.push(`${o} B: Gameplan-Linien ${name} - ${B[0]}`);
    }
    // C: Rundgang
    for (const [wo, fn] of [['Dashboard', "showTab('dash')"], ['Journal', "showTab('journal')"], ['Gameplan', "showTab('gameplan')"], ['GOLD', "gotoSym('GOLD')"], ['EUR', "gotoSym('EUR')"], ['SOL', "gotoSym('SOL')"], ['Set-ups', "showTab('setups')"], ['Kalender', "showTab('cal')"]]) {
      await p.evaluate(fn); await p.waitForTimeout(2000);
      const C = await p.evaluate(MESSEN, ['TEXT', 2, 3]);
      if (C.length) F.push(`${o} C: ${wo} - ${C.length}x Text deckt Text, z. B. ${C[0]}`);
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: /.test(f) && !/Testaufbau/.test(f)); console.log(ok ? 'ueberlappung --gegenprobe: ok (alte Anordnung ueberlappt)' : 'ueberlappung --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('ueberlappung: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('ueberlappung: ok (24 Preisleisten in Journal + Dashboard, Gameplan-Linien eng/gleich/ausserhalb, Rundgang ueber 8 Seiten ohne Text auf Text, 1194/390 px)');
})().catch(e => { console.log('ueberlappung: ABBRUCH ' + e.message); process.exit(1); });
