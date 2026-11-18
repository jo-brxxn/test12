// ── DATA-KARTE DER MACRO-REIHE: NICHTS ABGESCHNITTEN, KEIN EIGENES SCROLLEN (seit 2026-11-18, VERSION-CHECK-760) ──
// Nutzer 2026-11-18 (iPad-Foto, CAD, Compare all): "Das data da soll auf keinen Fall abgeschnitten und
// scrollbar sein es soll alles zu sehen sein. Du solltest es nur ein wenig kleiner machen".
// Gemessen vorher (feste Hoehe clamp(440px,62vh,700px) + overflow auto): 4 Panels, iPad quer 2 davon
// ausserhalb der Karte, iPad hoch 2, Handy 3.
//  A) Data an, Compare all mit 4 Panels: kein Panel ragt aus der Karte, die Karte scrollt nicht in sich,
//     der Knopf "+ Add" liegt ganz in der Karte - 1194x834, 834x1194, 390x844, 1920x1080
//  B) "ein wenig kleiner" bleibt: bei 1194x834 ist ein Panel hoechstens 62 % der Fensterhoehe / Zeilen
//  C) Panel-Kopf (763): keine Legende, kein Ausblend-Verlauf, "As of … · Next …" ganz lesbar (nichts ragt
//     heraus oder wird abgeschnitten), Datum ohne Wochentag
// --gegenprobe: alte Regel (feste Hoehe + overflow auto) -> A rot. --gegenprobe-kopf: alter Kopf -> C rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe'), GPK = process.argv.includes('--gegenprobe-kopf');
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [834, 1194], [390, 844], [1920, 1080]]) {
    const o = W + 'x' + H;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/index\.html/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('.mk-data-slot{grid-column:1/-1;height:auto;overflow:visible;', '.mk-data-slot{grid-column:1/-1;height:clamp(440px,62vh,700px);overflow-y:auto;'); r.fulfill({ response: res, body: t }); });
    if (GPK) await ctx.route(/\/index\.html/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('.data-ph .px-asof{margin:0;font-size:var(--fs-2xs);line-height:1.15;flex-wrap:wrap;row-gap:0;min-width:0;flex:0 1 auto}', '.data-ph .px-asof{margin:0;font-size:var(--fs-2xs);flex-wrap:nowrap;overflow:hidden;min-width:0;flex:0 1 auto;-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent)}'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    await p.evaluate(() => { gotoSym('CAD'); makroDatenSchalten(true); }); await p.waitForTimeout(2500);
    await p.evaluate(() => { dataAlle = [{ a: 'CAD', k: 'i:Central Bank Rate' }, { a: 'CAD', k: 'i:CPI (Headline)' }, { a: 'CAD', k: 'i:Unemployment Rate' }, { a: 'USD', k: 'i:CPI (Headline)' }]; setDataMode('alle'); });
    await p.waitForTimeout(2500);
    const m = await p.evaluate(() => {
      const s = document.querySelector('.mk-data-slot'); if (!s) return null; const q = s.getBoundingClientRect();
      const P = [...s.querySelectorAll('.data-pc')].map(x => x.getBoundingClientRect());
      const add = [...s.querySelectorAll('button')].find(x => /Add/.test(x.textContent)); const a = add && add.getBoundingClientRect();
      const st = getComputedStyle(s);
      return { n: P.length, raus: P.filter(r => r.bottom > q.bottom + 1 || r.top < q.top - 1).length, scrollt: (st.overflowY === 'auto' || st.overflowY === 'scroll') && s.scrollHeight > s.clientHeight + 2,
        add: a ? a.top >= q.top - 1 && a.bottom <= q.bottom + 1 : null, ph: P.length ? Math.max(...P.map(r => r.height)) : 0, z: s.offsetHeight ? q.height / s.offsetHeight : 1 };
    });
    if (!m) { F.push(`${o}: Testaufbau - keine Data-Karte`); await ctx.close(); continue; }
    if (m.n < 4) F.push(`${o}: Testaufbau - nur ${m.n} Panels`);
    if (m.raus) F.push(`${o} A: ${m.raus} von ${m.n} Panels ragen aus der Data-Karte`);
    if (m.scrollt) F.push(`${o} A: Data-Karte scrollt in sich`);
    if (m.add === false) F.push(`${o} A: Knopf "+ Add" angeschnitten`);
    const C = await p.evaluate(() => [...document.querySelectorAll('.mk-data-slot .data-ph')].map(h => { const a = h.querySelector('.px-asof'); if (!a || getComputedStyle(a).display === 'none') return null; const s = getComputedStyle(a), q = h.getBoundingClientRect();
      return { lg: !!h.querySelector('.data-lg'), mask: (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none'), cut: a.scrollWidth > a.clientWidth + 1 && s.overflowX !== 'visible', raus: a.getBoundingClientRect().right > q.right + 1, wt: /^[A-Z][a-z]{2}, /.test((a.querySelector('b') || {}).textContent || '') }; }).filter(Boolean));
    C.forEach((c, i) => { if (c.lg) F.push(`${o} C: Panel ${i} hat noch die Legende im Kopf`); if (c.mask) F.push(`${o} C: Panel ${i} blendet das Datum aus`); if (c.cut || c.raus) F.push(`${o} C: Panel ${i} Datum abgeschnitten`); if (c.wt) F.push(`${o} C: Panel ${i} Datum mit Wochentag`); });
    if (W === 1194 && m.ph > H * 0.62 / 2 + 2) F.push(`${o} B: Panel ${Math.round(m.ph)} px - groesser als 62 % der Fensterhoehe je Zeile`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GPK) { const ok = F.some(f => / C: /.test(f)); console.log(ok ? 'datakarte --gegenprobe-kopf: ok (alter Kopf gemeldet)' : 'datakarte --gegenprobe-kopf: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (GP) { const ok = F.some(f => / A: /.test(f)); console.log(ok ? 'datakarte --gegenprobe: ok (abgeschnitten/scrollbar gemeldet)' : 'datakarte --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('datakarte: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('datakarte: ok (Compare all mit 4 Panels: alles in der Karte, kein eigenes Scrollen, Add ganz sichtbar, Panels so klein wie seit 748 - 4 Fenstergroessen)');
})().catch(e => { console.log('datakarte: ABBRUCH ' + e.message); process.exit(1); });
