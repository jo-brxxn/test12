// ── SEASONALITY-KACHEL: LAUFENDES JAHR FEST UEBER DEN BALKEN ──────────────
//
// Nutzer 2026-09-27: "Bei der seasonality Karte bei Assets fehlt der
// Umschaltbare vs Price mach das Fest darein ohne Button nicht abschaltbar".
// Seit 2026-10-11 (VERSION-CHECK-601, Nutzer-Wahl Version 1) sind es
// Monatszeilen: je Monat ein waagerechter Balken ab der 0-Linie, das
// laufende Jahr als Punkte + gestrichelte Linie auf DERSELBEN Skala.
// Geprueft fuer jedes Asset mit Saisonalitaet (Asset-Seite, 1280px):
//   A) je Monat mit Kursdaten des laufenden Jahres (seasCurYearReturns - die
//      Reihe des Seasonality-Tabs) genau ein Punkt, sonst keiner;
//   B) Punkt und Balken auf EINER Skala: 0-Linie = Spurmitte, Balkenbreite =
//      |avg|/max * 48% der Spur, Punkt-x = 50% + v/max * 48%, max ueber
//      Balken UND Punkte (+-1px);
//   C) Punkt auf der Mitte seiner Monatszeile, Linie durch alle Punkte;
//   D) kein Schalter in der Kachel (fest, nicht abschaltbar), Legende da.
//   node check/seasvsprice.js [--gegenprobe]   (Punkte per CSS ausgeblendet)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  const ids = await p.evaluate(gp => {
    ['introOv', 'lockScreen'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    if (gp) { const st = document.createElement('style'); st.textContent = '.sz-p{display:none!important}'; document.head.appendChild(st); }
    return Object.keys((SEASONALITY_DATA && SEASONALITY_DATA.assets) || {}).filter(id => syms.some(s => s.id === id));
  }, GEGENPROBE);
  if (!ids.length) fail('Voraussetzung', 'keine Saisonalitaet geladen');
  let geprueft = 0, punkte = 0;
  for (const id of ids) {
    await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(250);
    const r = await p.evaluate(id => {
      const t = [...document.querySelectorAll('#detail .ab-tile')].find(x => x.querySelector('.sz'));
      if (!t) return { fehlt: true };
      const A = SEASONALITY_DATA.assets[id];
      const cy = seasCurYearReturns(id, A.inv) || {};
      const monate = A.months.slice().sort((a, b) => a[0] - b[0]);
      const max = Math.max(...monate.map(m => Math.abs(+m[1])), ...Object.values(cy).filter(isFinite).map(Math.abs)) || 1;
      const spur = t.querySelector('.sz-rows').getBoundingClientRect();
      const zeilen = [...t.querySelectorAll('.sz-r')];
      const dots = [...t.querySelectorAll('.sz-p')].filter(d => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().width > 0);
      const fehler = [];
      if (zeilen.length !== monate.length) fehler.push(`${zeilen.length} Zeilen statt ${monate.length}`);
      const null0 = spur.left + spur.width / 2;
      let n = 0;
      zeilen.forEach((z, i) => {
        const nr = monate[i][0], avg = +monate[i][1];
        const bar = z.querySelector('.sz-b').getBoundingClientRect();
        const soll = Math.abs(avg) / max * 0.48 * spur.width;
        if (Math.abs(bar.width - soll) > 1) fehler.push(`B ${nr}: Balken ${bar.width.toFixed(1)}px statt ${soll.toFixed(1)}px`);
        const ab = avg >= 0 ? bar.left : bar.right;
        if (Math.abs(ab - null0) > 1) fehler.push(`B ${nr}: Balken startet nicht auf der 0-Linie`);
        const zr = z.getBoundingClientRect(), mitte = zr.top + zr.height / 2;
        const d = dots.find(x => { const q = x.getBoundingClientRect(); return Math.abs(q.top + q.height / 2 - mitte) < zr.height / 2; });
        if (cy[nr] == null) { if (d) fehler.push(`A ${nr}: Punkt ohne Kursdaten`); return; }
        if (!d) { fehler.push(`A ${nr}: kein Punkt, obwohl ${cy[nr].toFixed(2)}% vorliegt`); return; }
        n++;
        const q = d.getBoundingClientRect();
        const x = q.left + q.width / 2, sollX = spur.left + (0.5 + cy[nr] / max * 0.48) * spur.width;
        if (Math.abs(x - sollX) > 1) fehler.push(`B ${nr}: Punkt bei ${(x - spur.left).toFixed(1)}px statt ${(sollX - spur.left).toFixed(1)}px`);
        if (Math.abs(q.top + q.height / 2 - mitte) > 1) fehler.push(`C ${nr}: Punkt nicht auf der Zeilenmitte`);
      });
      if (dots.length !== n) fehler.push(`A: ${dots.length} Punkte, ${n} zugeordnet`);
      const pl = t.querySelector('.sz-svg polyline');
      const lp = pl ? pl.getAttribute('points').trim().split(/\s+/).length : 0;
      if (n > 1 && lp !== n) fehler.push(`C: Linie hat ${lp} Punkte statt ${n}`);
      const knopf = [...t.querySelectorAll('button')].filter(x => /vs\s*price|this year/i.test(x.textContent + (x.title || ''))).length;
      return { fehler, n, knopf, leg: !!t.querySelector('.sz-leg'), mitDaten: Object.keys(cy).length };
    }, id);
    if (r.fehlt) { fail(id, 'keine Seasonality-Kachel'); continue; }
    geprueft++; punkte += r.n;
    r.fehler.slice(0, 3).forEach(x => fail(id, x));
    if (r.knopf) fail(id + ' D', 'die Kachel hat einen Schalter - das laufende Jahr muss fest drin sein');
    if (r.mitDaten && !r.leg) fail(id + ' D', 'Legende "This year (price)" fehlt');
  }
  if (perr.length) fail('Seitenfehler', perr.slice(0, 3).join(' | '));
  await b.close();
  if (F.length) { console.log('✗ Seasonality vs Price:\n  ' + F.slice(0, 20).join('\n  ')); process.exit(1); }
  console.log(`✓ Seasonality vs Price: ${geprueft} Kacheln, ${punkte} Monatspunkte auf der Balkenskala (Monatszeilen), Linie durch alle Punkte, kein Schalter`);
})().catch(e => { console.log('✗ seasvsprice: ' + e.message); process.exit(1); });
