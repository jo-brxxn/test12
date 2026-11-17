// ── MAUS UND ANZEIGE DECKEN SICH AUCH BEIM SEITEN-ZOOM (seit 2026-11-17, VERSION-CHECK-751) ──
// Nutzer 2026-11-17 (PC-Foto): "die Maus ist weiter links aber ausgewaehlt ist weiter rechts
// aber es werden die Daten von wo die Maus ist angezeigt ... Reparier das".
// Ursache: am PC vergroessert --pg-zoom (CSS zoom) Seiten und Fenster. getBoundingClientRect/
// clientX sind Bildschirm-Pixel, style.left/top und Chart-Masse (offsetWidth, viewBox = clientWidth)
// Seiten-Pixel. Wer beides mischt, verschiebt um den Faktor Zoom. Gemessen vorher:
//   Hover-Linie Asset-Seite  98 px (1920, Zoom 1,205) / 420 px (2560, Zoom 1,616)
//   Trade-Chart Tipp          68 px / 294 px, SL-Griff 81 px neben der Maus
//   COT-Tooltip              185 px / 743 px neben der Linie
// Geprueft bei 1920 und 2560 px (Zoom > 1):
//  A) Hover-Linie (.chv, Asset-Seite USD) bei 40 % und 70 % der Breite: hoechstens 5 % der
//     Breite (mind. 24 px) neben der Maus - Rest ist das Einrasten auf den naechsten Punkt
//  B) Trade-Chart (New trade, GOLD): Tipp in die Mitte -> Kasten beginnt hoechstens 1,5 Kerzen
//     neben dem Tipp; SL-Griff 40 px gezogen -> Griff hoechstens 3 px neben der Maus
//  C) COT-Verlauf (EUR): Tooltip-Mitte hoechstens 3 px neben der Hover-Linie (ausser am Rand)
//  D) Assets-Panel der Seitenleiste beginnt an der Unterkante der Kopfzeile (Nutzer-Foto PC
//     2026-11-17: "das ausklappbare von den Assets geht nicht bis ganz nach oben"; vorher
//     13 px Luecke bei 1920, 52 px bei 2560, VERSION-CHECK-753)
// --gegenprobe: alte Rechnung der Hover-Linie (Rect statt offsetWidth) -> A rot.
// --gegenprobe-panel: alte --nav-top-Rechnung (Bildschirm-Pixel) -> D rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe'), GPP = process.argv.includes('--gegenprobe-panel');
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1920, 1080], [2560, 1440]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GPP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace("t=Math.round(r.top/z*100)/100+'px'", "t=Math.round(r.top)+'px'"); r.fulfill({ response: res, body: t }); });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('const r={width:w.offsetWidth||rr.width,height:w.offsetHeight||rr.height};', 'const r=rr;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
    const zoom = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pg-zoom')) || 1);
    if (zoom < 1.1) F.push(`${o}: Testaufbau - Seiten-Zoom nur ${zoom}`);
    // D
    await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(1200);
    const ab = await p.evaluate(() => { const e = [...document.querySelectorAll('#navSidebar *')].find(x => x.children.length < 4 && /^\s*Assets\s*$/.test(x.textContent)); if (!e) return null; const b = (e.closest('button,a,[onclick]') || e).getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    if (!ab) F.push(`${o} D: Testaufbau - kein Assets-Knopf`);
    else {
      const offen = await p.evaluate(() => { const s = document.getElementById('sidebar'); return !!(s && s.classList.contains('open')); });
      if (!offen) { await p.mouse.click(ab[0], ab[1]); await p.waitForTimeout(700); }
      const D = await p.evaluate(() => { const s = document.getElementById('sidebar'), h = document.querySelector('.hdr').getBoundingClientRect(); return s && s.classList.contains('open') ? { top: s.getBoundingClientRect().top, hdr: h.bottom } : null; });
      if (!D) F.push(`${o} D: Assets-Panel geht nicht auf`);
      else if (Math.abs(D.top - D.hdr) > 1) F.push(`${o} D: Assets-Panel beginnt ${(D.top - D.hdr).toFixed(1)} px unter der Kopfzeile`);
      if (!offen) { await p.mouse.click(ab[0], ab[1]); await p.waitForTimeout(400); }
    }
    // A await p.waitForTimeout(2500);
    const KARTE = () => [...document.querySelectorAll('#detail .chv[data-chv]')].filter(x => x.getBoundingClientRect().width > 100)[0];
    const hatA = await p.evaluate(`(${KARTE})()?((${KARTE})().scrollIntoView({block:'center'}),true):false`);
    if (!hatA) F.push(`${o} A: Testaufbau - kein Hover-Chart auf der USD-Seite`);
    else {
      await p.waitForTimeout(400);
      for (const anteil of [0.4, 0.7]) {
        const r = await p.evaluate(`(()=>{const b=(${KARTE})().getBoundingClientRect();return[b.x,b.y,b.width,b.height];})()`);
        const mx = r[0] + r[2] * anteil, my = r[1] + r[3] * 0.5;
        await p.mouse.move(mx, my); await p.waitForTimeout(250);
        const lx = await p.evaluate(`(()=>{const l=(${KARTE})().querySelector('.chv-line');if(!l||getComputedStyle(l).display==='none')return null;const b=l.getBoundingClientRect();return b.left+b.width/2;})()`);
        const tol = Math.max(24, r[2] * 0.05);
        if (lx == null) F.push(`${o} A: keine Hover-Linie bei ${anteil * 100} %`);
        else if (Math.abs(lx - mx) > tol) F.push(`${o} A: Hover-Linie ${(lx - mx).toFixed(1)} px neben der Maus (bei ${anteil * 100} %, erlaubt ${tol.toFixed(0)})`);
      }
    }
    // B
    await p.evaluate(() => { showTab('journal'); tjNeu(); }); await p.waitForTimeout(600);
    await p.evaluate(() => { const s = document.getElementById('tjAsset'); s.value = 'GOLD'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(1500);
    const sv = await p.evaluate(() => { const s = document.querySelector('#mTrade svg.tj-ch-svg'); if (!s) return null; const b = s.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, W: +s.getAttribute('width') }; });
    if (!sv) F.push(`${o} B: Testaufbau - kein Trade-Chart`);
    else {
      const cx = sv.x + sv.w * 0.5, cy = sv.y + sv.h * 0.5;
      await p.mouse.click(cx, cy); await p.waitForTimeout(500);
      const B = await p.evaluate(() => { const e = document.querySelector('#mTrade .tj-wbox'), r = e && e.getBoundingClientRect(); const n = document.querySelectorAll('#mTrade svg.tj-ch-svg .tj-kz,#mTrade svg.tj-ch-svg rect').length; return { l: r && r.left, n }; });
      const kerze = sv.w / Math.max(20, Math.floor((sv.W - 72) / 7));
      if (B.l == null) F.push(`${o} B: Tipp setzt keinen Kasten`);
      else if (Math.abs(B.l - cx) > Math.max(1.5 * kerze, 8)) F.push(`${o} B: Kasten beginnt ${(B.l - cx).toFixed(1)} px neben dem Tipp`);
      const sl = await p.evaluate(() => { const s = document.querySelector('#mTrade .tj-hd.k-sl'); if (!s) return null; const b = s.getBoundingClientRect(); return [b.x + 8, b.y + b.height / 2]; });
      if (!sl) F.push(`${o} B: kein SL-Griff nach dem Tipp`);
      else {
        await p.mouse.move(sl[0], sl[1]); await p.mouse.down(); await p.mouse.move(sl[0], sl[1] + 40, { steps: 4 });
        const gy = await p.evaluate(() => { const b = document.querySelector('#mTrade .tj-hd.k-sl').getBoundingClientRect(); return b.y + b.height / 2; });
        await p.mouse.up();
        if (Math.abs(gy - sl[1] - 40) > 3) F.push(`${o} B: SL-Griff ${(gy - sl[1] - 40).toFixed(1)} px neben der Maus`);
      }
    }
    await p.evaluate(() => closeM('mTrade')).catch(() => { }); await p.waitForTimeout(200);
    // C
    await p.evaluate(() => { showTab('cot'); pickCotFilter('EUR'); }); await p.waitForTimeout(2500);
    const hit = () => p.evaluate(() => { const hs = [...document.querySelectorAll('#cotHistWrap .cot-hit')]; const e = hs[Math.floor(hs.length * 0.5)]; if (!e) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    if (!(await hit())) F.push(`${o} C: Testaufbau - kein COT-Verlauf`);
    else {
      await p.evaluate(() => { const hs = [...document.querySelectorAll('#cotHistWrap .cot-hit')]; hs[Math.floor(hs.length * 0.5)].scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300);
      const h = await hit(); await p.mouse.move(h[0], h[1]); await p.waitForTimeout(300);
      const C = await p.evaluate(() => { const t = document.getElementById('cotHoverTip').getBoundingClientRect(), v = document.querySelector('#cotHoverVLine'); const vr = v && v.getBoundingClientRect(); return { t: t.x + t.width / 2, v: vr ? vr.x + vr.width / 2 : null }; });
      if (C.v == null) F.push(`${o} C: keine COT-Hover-Linie`);
      else if (Math.abs(C.t - C.v) > 3) F.push(`${o} C: COT-Tooltip ${(C.t - C.v).toFixed(1)} px neben der Linie`);
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GPP) { const ok = F.some(f => / D: Assets-Panel beginnt/.test(f)); console.log(ok ? 'zoomhover --gegenprobe-panel: ok (Luecke unter der Kopfzeile gemeldet)' : 'zoomhover --gegenprobe-panel: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (GP) { const ok = F.some(f => / A: Hover-Linie/.test(f)); console.log(ok ? 'zoomhover --gegenprobe: ok (alte Rechnung verschiebt die Linie)' : 'zoomhover --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('zoomhover: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('zoomhover: ok (Hover-Linie, Trade-Chart Tipp + SL-Griff, COT-Tooltip liegen bei 1920/2560 px Seiten-Zoom an der Maus, Assets-Panel buendig unter der Kopfzeile)');
})().catch(e => { console.log('zoomhover: ABBRUCH ' + e.message); process.exit(1); });
