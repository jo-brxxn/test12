// ══ WAECHTER: HOVER BEI MEHREREN LINIEN = PUNKT AUF JEDER LINIE ══════════════
//
// Nutzer 2026-10-31 (iPad-Screenshot Data · Prices, OIL + GOLD): "die Info
// Karte die man beim hovern sieht von der muss der Punkt auf beiden Preisen
// sein und die Linie durch die Karte muss sich nach oben durchziehen und der
// Preis des Assets das weiter oben steht in der Darstellung muss auch auf der
// Karte oben stehen wenn das nicht mehr so ist muss es tauschen".
//
// GEMESSEN (1366 px, 1Y): an einer Stelle mit GOLD oben (y 555) und OIL
// darunter (y 654) gab es EINEN Punkt (auf OIL), die Fuehrungslinie lief von
// 654 nach unten (GOLD lag ueber ihrem Ende), die Karte zeigte OIL zuerst.
// Ursache: chartHoverWrap kannte je Stelle genau einen Punkt, der Aufrufer
// gab immer den ersten Kurs. Dieselbe Klasse in Trends (Fokus-Linien) und
// Score vs Price.
//
// Geprueft (echtes Hovern mit der Maus):
//   A) Data · Prices (OIL + GOLD, Linie): an einer Stelle mit GOLD oben und
//      einer mit OIL oben je ein Punkt AUF jeder Linie (y der Polylinie an
//      dieser Stelle), Karte in derselben Reihenfolge wie die Punkte, die
//      Fuehrungslinie reicht von der Plot-Oberkante bis zum Boden.
//   B) Trends (alle Assets, Fokus): ein Punkt je farbiger Zeile, die farbigen
//      Zeilen in der Reihenfolge der Punkte (von oben nach unten).
//   C) Trends · EUR, Score vs Price: zwei Punkte, Zeilen nach Lage.
//   D) Ein-Linien-Chart (Trends · EUR, Score): bleibt bei EINEM Punkt und der
//      Linie vom Punkt zum Boden (Nutzer-Wunsch 2026-09-05).
// Gegenprobe --gegenprobe: chartHoverWrap ignoriert ys (alter Stand) -> rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE = 'const ys=Array.isArray(best.ys)&&best.ys.length>1?best.ys:null;';

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if (GP && !MAIN.includes(MARKE)) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1366, height: 1024 }, serviceWorkers: 'block' });
  await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  if (GP) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MAIN.replace(MARKE, 'const ys=null;') }));
  const p = await ctx.newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));

  // Hovern an x (px im .chv) und messen: sichtbare Punkte (y, Farbe), Linie, Kartenzeilen (Farbe)
  const hover = async (w, x) => {
    const box = await w.boundingBox();
    await p.mouse.move(box.x + x, box.y + box.height * 0.5); await p.waitForTimeout(150);
    return w.evaluate(w => {
      const wr = w.getBoundingClientRect(), an = e => e && getComputedStyle(e).display !== 'none';
      const farbe = c => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
      const dots = [...w.querySelectorAll('.chv-dot')].filter(an).map(d => ({ y: d.getBoundingClientRect().top + d.offsetHeight / 2 - wr.top, c: getComputedStyle(d).borderTopColor })).sort((a, b) => a.y - b.y);
      const ln = w.querySelector('.chv-line'), lr = ln.getBoundingClientRect();
      const tip = w.querySelector('.chv-tip');
      const zeilen = [...tip.children].filter(c => c.tagName === 'DIV' && !c.classList.contains('chv-tip-d')).map(c => {
        const pkt = c.querySelector('.tr-tip-dot'), sp = c.querySelector('span[style*="color"]');
        const roh = pkt ? pkt.style.background : (sp ? sp.style.color : '');
        return { t: c.textContent.trim().slice(0, 24), c: roh ? farbe(roh) : '', grau: /color:\s*var\(--t3\)/.test(c.getAttribute('style') || '') };
      });
      return { dots, linie: an(ln) ? [lr.top - wr.top, lr.bottom - wr.top] : null, zeilen, h: wr.height };
    });
  };

  // ── A) Data · Prices ──
  console.log('A) Data · Prices (OIL + GOLD): Punkt auf beiden Linien, Karte nach Lage, Linie bis oben');
  await p.evaluate(() => { showTab('data'); setDataMode('preis'); setPxChartTyp('line'); setDataPreisAnsicht('eins'); setDataPreisSkala('band'); dataPreisListe = ['p:OIL', 'p:GOLD']; setDataRange(12); });
  await p.waitForTimeout(700);
  const st = await p.evaluate(() => {
    const svg = document.querySelector('#dataBody .pv-svg');
    const pl = [...svg.querySelectorAll('polyline.pv-linie')].map(x => ({ k: x.dataset.k, m: new Map(x.getAttribute('points').split(' ').map(q => q.split(',').map(Number)).map(q => [q[0].toFixed(1), q[1]])) }));
    const xs = [...pl[0].m.keys()].filter(x => pl[1].m.has(x)).map(x => ({ x: +x, oil: pl[0].m.get(x), gold: pl[1].m.get(x) }));
    return { gold: xs.filter(z => z.gold < z.oil - 60)[3], oil: xs.filter(z => z.oil < z.gold - 60)[3] };
  });
  const wA = p.locator('#dataBody .chv').first();
  for (const [name, z] of [['GOLD oben', st.gold], ['OIL oben', st.oil]]) {
    if (!z) { rot(`A ${name}: keine passende Stelle im Chart`); continue; }
    const r = await hover(wA, z.x);
    const soll = [z.oil, z.gold].sort((a, b) => a - b);
    const nah = r.dots.length === 2 && r.dots.every((d, i) => Math.abs(d.y - soll[i]) < 2);
    const reihen = r.zeilen.map(x => x.t.split(' ')[0]).join(',');
    const sollReihe = z.gold < z.oil ? 'GOLD,OIL' : 'OIL,GOLD';
    const farbenGleich = r.zeilen.length === r.dots.length && r.zeilen.every((x, i) => x.c === r.dots[i].c);
    if (!nah) rot(`A ${name}: Punkte ${JSON.stringify(r.dots.map(d => Math.round(d.y)))}, Linien bei ${Math.round(soll[0])}/${Math.round(soll[1])}`);
    else if (reihen !== sollReihe || !farbenGleich) rot(`A ${name}: Karte ${reihen} (Farben ${farbenGleich ? 'passen' : 'passen nicht'}), erwartet ${sollReihe}`);
    else if (!r.linie || r.linie[0] > 12 || r.linie[1] < r.h - 30) rot(`A ${name}: Fuehrungslinie ${JSON.stringify(r.linie && r.linie.map(Math.round))} reicht nicht von oben (≤ 12) bis unten`);
    else gruen(`A ${name}: Punkte auf beiden Linien (${r.dots.map(d => Math.round(d.y)).join('/')}), Karte ${reihen}, Linie ${Math.round(r.linie[0])}…${Math.round(r.linie[1])}`);
  }
  await p.mouse.move(2, 2);

  // ── B) Trends mit Fokus ──
  console.log('B) Trends (Fokus): ein Punkt je farbiger Linie, Reihenfolge nach Lage');
  await p.evaluate(() => { showTab('trends'); try { setTrendsFilter('ALL'); } catch (e) {} });
  await p.waitForTimeout(800);
  const wB = p.locator('#trendsBody .chv').first();
  if (!(await wB.count())) rot('B: kein Trends-Chart');
  else {
    const bx = await wB.boundingBox();
    for (const f of [0.4, 0.75]) {
      const r = await hover(wB, bx.width * f);
      const farbig = r.zeilen.filter(x => !x.grau);
      const ok = r.dots.length === farbig.length && r.dots.length > 1 && farbig.every((x, i) => x.c === r.dots[i].c);
      if (!ok) rot(`B ${Math.round(f * 100)} %: ${r.dots.length} Punkte, ${farbig.length} farbige Zeilen (${farbig.map(x => x.t).join(', ')})`);
      else gruen(`B ${Math.round(f * 100)} %: ${r.dots.length} Punkte = ${farbig.length} farbige Zeilen, gleiche Reihenfolge`);
    }
    await p.mouse.move(2, 2);
  }

  // ── C/D) Trends · EUR: Score vs Price + Ein-Linien-Score ──
  console.log('C/D) Trends · EUR: Score vs Price mit zwei Punkten, Score allein mit einem');
  await p.evaluate(() => { setTrendsFilter('EUR'); }); await p.waitForTimeout(800);
  const ws = await p.locator('#trendsBody .chv').all();
  let sahZwei = false, sahEins = false;
  for (const w of ws) {
    await w.scrollIntoViewIfNeeded(); const bx = await w.boundingBox(); if (!bx) continue;
    const r = await hover(w, bx.width * 0.6);
    if (r.zeilen.length === 2) {
      sahZwei = true;
      const ok = r.dots.length === 2 && r.zeilen.every((x, i) => x.c === r.dots[i].c);
      if (!ok) rot(`C: Score vs Price: ${r.dots.length} Punkte, Karte ${r.zeilen.map(x => x.t).join(' | ')}`);
      else gruen(`C: Score vs Price: 2 Punkte, Karte nach Lage (${r.zeilen.map(x => x.t.split(/[-+0-9]/)[0]).join(', ')})`);
    } else if (r.zeilen.length === 1) {
      sahEins = true;
      const d = r.dots[0];
      if (r.dots.length !== 1 || !r.linie || Math.abs(r.linie[0] - d.y) > 2) rot(`D: Ein-Linien-Chart: ${r.dots.length} Punkte, Linie ${JSON.stringify(r.linie)} statt ab dem Punkt`);
      else gruen(`D: Ein-Linien-Chart: ein Punkt, Linie vom Punkt (${Math.round(d.y)}) zum Boden`);
    }
    await p.mouse.move(2, 2);
  }
  if (!sahZwei) rot('C: kein Score-vs-Price-Chart gefunden');
  if (!sahEins) rot('D: kein Ein-Linien-Chart gefunden');

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ hoverpunkte: ${fehler} Befund(e)` : '\n✓ hoverpunkte: Punkt auf jeder Linie, Karte nach Lage, Linie bis oben; Ein-Linien-Charts unveraendert');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
