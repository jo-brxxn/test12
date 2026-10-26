// ── DATA-SEITE: BIS 8 PANELS, CHARTS FUELLEN DIE FLAECHE ─────────────────
//
// Nutzer 2026-09-26: "Mach das man in data bis zu 8 Assets oder halt
// Indikatoren gleichzeitig vergleichen kann ... desto mehr Assets man
// hinzufuegt das dann auch erst die Charts kleiner werden und nicht das wenn
// man nur 2 ausgewaehlt hat das schon klein ist ... Layout ... Platz sparen".
// Per Rueckfrage: "Bildschirm fuellen" + "Kompakt". Gemessen vorher bei
// 1180x820: 2 Panels je Chart ~150 px hoch, 290 px leer darunter, 230 px
// Kopf bis zum ersten Chart. Geprueft bei 1180x820, 1-8 Assets:
//   - bis 8 Panels moeglich, ein 9. wird abgelehnt
//   - kein Seiten-Scroll (alles auf einem Bildschirm)
//   - Charthoehe faellt nie mit weniger Panels; 2 Panels UNTEREINANDER in
//     voller Breite (Nutzer 2026-09-26), beide auf dem Bildschirm
//   - jeder Chart passt in seine Zelle (kein Ueberlauf), fuellt sie (>= 90 %)
//   - Kopf = Titelzeile + Werkzeugzeile (<= 100 px), Panel-Kopf eine Zeile
//     (<= 40 px); Filter rechtsbuendig in der Titelzeile, Zeitfilter
//     rechtsbuendig in der Werkzeugzeile (Dauerregel 2026-09-26). Seit
//     2026-10-04 ist die Titelzeile der Seitenkopf wie ueberall (.pg-titel +
//     .pg-sub als Block .data-tt): der Filter steht auf der Hoehe DIESES
//     Blocks (wie Trends/COT/Kalender), nicht auf der Hoehe des Worts "Data".
//   - Datumsbeschriftung bleibt im Chart (nicht abgeschnitten)
//   node check/datalayout.js [--gegenprobe]  (festes 2-Spalten-Raster mit
//   200-px-Zeilen wie frueher -> rot)
//
// ASSET VS ASSET (seit 2026-10-26, Nutzer: "nicht nur in einem Asset
// Indikatoren vergleichen ... sondern auch mehrere Indikatoren von einem Asset
// vs mehrere von einem anderen"; per Rueckfrage: gleiche Liste paarweise,
// genau 2 Assets, bis 4 Indikatoren, dritter Schalter). Geprueft bei 1180x820:
//   - bis 3 Indikatoren (6 Panels) kein Seiten-Scroll; der 4. fuegt eine
//     4. Zeile an und die Seite scrollt - Charts bleiben >= DATA_MIN_CHART_H
//     (150 px, Regel von 2026-09-26: lieber scrollen als stauchen)
//   - 4 Indikatoren = 8 Panels in 2 Spalten
//   - jede Zeile = EIN Indikator: links Asset A, rechts Asset B, gleicher Name
//   - beide Panels einer Zeile auf derselben Y-Skala (gleiche Achsenzahlen)
//   - ein 5. Indikator wird abgelehnt
//   - dasselbe Asset auf beiden Seiten -> die Seiten tauschen
//   - 390 px: eine Spalte, A ueber B je Indikator
//   node check/datalayout.js --gegenprobe-vs  (Raster 4-spaltig -> Zeilen
//   nicht mehr gepaart -> rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const GEGENPROBE_VS = process.argv.includes('--gegenprobe-vs');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const ALLE = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'GOLD'];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); showTab('data'); setDataMode('assets'); });
  await p.waitForTimeout(700);
  if (GEGENPROBE) await p.addStyleTag({ content: '#dataBody .data-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:200px!important}' });
  const hoehe = {};
  for (const n of [1, 2, 3, 4, 6, 8]) {
    await p.evaluate(([ids, n]) => { dataAssets.length = 0; ids.slice(0, n).forEach(x => dataAssets.push(x)); if (!dataIndBase) dataIndBase = 'CPI (Headline)'; renderDataTab(); }, [ALLE, n]);
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => {
      const pg = document.getElementById('pgData'), kopf = document.querySelector('#dataBody .data-head');
      const boxen = [...document.querySelectorAll('#dataBody .data-pc')];
      return { scroll: pg.scrollHeight - pg.clientHeight, kopf: kopf ? kopf.offsetHeight : 0,
        ph: Math.max(0, ...[...document.querySelectorAll('#dataBody .data-ph')].map(e => e.offsetHeight)),
        panels: document.querySelectorAll('#dataBody .data-panel').length,
        pr: [...document.querySelectorAll('#dataBody .data-panel')].map(e => { const r = e.getBoundingClientRect(); return [r.left, r.width]; }),
        filt: (() => { const k = document.querySelector('#dataBody .data-head'), f = k && k.querySelector('.data-row select'), z = k && k.querySelector('.chart-leiste-r'); if (!k || !f) return null; const kr = k.getBoundingClientRect(), fr = f.getBoundingClientRect(), t = (k.querySelector('.data-tt') || k.querySelector('.data-h')).getBoundingClientRect();
          const zb = z && z.querySelector('button') ? z.getBoundingClientRect() : null;
          return { rechts: kr.right - fr.right, zeile: Math.abs((fr.top + fr.bottom) / 2 - (t.top + t.bottom) / 2), zeitRechts: zb ? kr.right - zb.right : null }; })(),
        boxen: boxen.map(bx => { const sv = bx.querySelector('.ind-hist-wrap svg'); const br = bx.getBoundingClientRect();
          if (!sv) return null; const sr = sv.getBoundingClientRect();
          const txt = [...sv.querySelectorAll('text')].map(t => t.getBoundingClientRect()).filter(r => r.width);
          const raus = txt.filter(r => r.left < sr.left - 1 || r.right > sr.right + 1).length;
          return { h: sr.height, fuell: sr.height / (br.height - 10), ueber: bx.scrollHeight > bx.clientHeight + 1, raus }; }) };
    });
    if (m.panels !== n) { fail(`${n} ASSETS`, `${m.panels} Panels`); continue; }
    if (m.scroll > 1) fail(`${n} ASSETS SCROLL`, `Seite scrollt ${m.scroll}px - soll auf einen Bildschirm passen`);
    if (m.kopf > 100) fail('KOPF', `${m.kopf}px hoch (Titel- + Werkzeugzeile <= 100)`);
    if (m.filt) { if (m.filt.zeile > 8) fail('FILTER', `nicht in der Titelzeile (${m.filt.zeile.toFixed(0)}px daneben)`);
      if (m.filt.rechts > 170) fail('FILTER', `nicht rechtsbuendig (${m.filt.rechts.toFixed(0)}px bis zum Kartenrand - nur der Auswahlknopf darf rechts davon stehen)`);
      if (m.filt.zeitRechts != null && m.filt.zeitRechts > 20) fail('ZEITFILTER', `nicht rechtsbuendig (${m.filt.zeitRechts.toFixed(0)}px Luecke)`); }
    if (n === 2 && m.pr.length === 2 && (Math.abs(m.pr[0][0] - m.pr[1][0]) > 1 || Math.abs(m.pr[0][1] - m.pr[1][1]) > 1)) fail('2 PANELS', 'nicht untereinander');
    if (m.ph > 40) fail('PANEL-KOPF', `${m.ph}px hoch (eine Zeile <= 40)`);
    const bx = m.boxen.filter(Boolean);
    bx.forEach((x, i) => { if (x.ueber) fail(`${n} ASSETS UEBERLAUF`, `Panel ${i + 1}`); if (x.fuell < 0.9) fail(`${n} ASSETS FUELLT NICHT`, `Panel ${i + 1}: ${(x.fuell * 100).toFixed(0)} %`); if (x.raus) fail(`${n} ASSETS LABEL`, `Panel ${i + 1}: ${x.raus} Beschriftung(en) ragen aus dem Chart`); });
    hoehe[n] = Math.min(...bx.map(x => x.h));
  }
  const ns = Object.keys(hoehe).map(Number).sort((a, c) => a - c);
  ns.forEach((n, i) => { if (i && hoehe[n] > hoehe[ns[i - 1]] + 1) fail('GROESSE', `${n} Panels hoeher als ${ns[i - 1]} (${hoehe[n].toFixed(0)} > ${hoehe[ns[i - 1]].toFixed(0)})`); });
  // 9. Asset wird abgelehnt
  const neun = await p.evaluate(ids => { dataAssets.length = 0; ids.slice(0, 8).forEach(x => dataAssets.push(x)); addDataAsset && addDataAsset(ids[8]); renderDataTab(); return document.querySelectorAll('#dataBody .data-panel').length; }, ALLE).catch(e => 'Fehler ' + e.message);
  if (neun !== 8) fail('MAXIMUM', `nach 9. Asset ${neun} Panels (erwartet 8)`);
  // ── Asset vs asset ──────────────────────────────────────────────────
  if (GEGENPROBE_VS) await p.addStyleTag({ content: '#dataBody .data-vs{grid-template-columns:repeat(4,minmax(0,1fr))!important}' });
  const vs = async () => p.evaluate(async () => {
    setDataMode('vs'); setDataVsA('USD'); setDataVsB('EUR');
    // Liste leeren und mit 4 Indikatoren fuellen, die BEIDE Assets fuehren
    const basen = () => [...document.querySelectorAll('#dataBody .data-panel .px-panel-chip')].map(x => (x.getAttribute('onclick').match(/removeDataListInd\('(.+)'\)/) || [])[1]).filter(Boolean);
    [...new Set(basen())].forEach(x => removeDataListInd(x));
    openDataIndPicker();
    const beide = [...document.querySelectorAll('#dataIndPicker .cmp-chip')].filter(c => !/ only$/.test(c.textContent)).map(c => (c.getAttribute('onclick').match(/toggleDataListInd\('(.+)'\)/) || [])[1]);
    closeDataIndPicker();
    const wahl = ['CPI (Headline)', 'Unemployment Rate', 'GDP Growth q/q', 'Retail Sales m/m'].filter(x => beide.includes(x));
    beide.forEach(x => { if (wahl.length < 4 && !wahl.includes(x)) wahl.push(x); });
    const pg = document.getElementById('pgData');
    wahl.slice(0, 3).forEach(x => toggleDataListInd(x));
    await new Promise(r => setTimeout(r, 700));
    const scroll3 = pg.scrollHeight - pg.clientHeight;
    toggleDataListInd(wahl[3]);
    const fuenft = beide.find(x => !wahl.includes(x));
    if (fuenft) toggleDataListInd(fuenft);
    await new Promise(r => setTimeout(r, 900));
    const panels = [...document.querySelectorAll('#dataBody .data-panel')].map(e => { const r = e.getBoundingClientRect(); const t = e.querySelector('.data-pt'); const sub = t && t.querySelector('.px-panel-sub');
      return { x: Math.round(r.left), y: Math.round(r.top), a: t ? t.firstChild.textContent.trim() : '', i: sub ? sub.textContent.trim() : '',
        ax: [...e.querySelectorAll('.ind-hist-wrap svg text')].filter(x => x.getAttribute('text-anchor') === 'end' && /^-?[\d.,]+%?$/.test(x.textContent.trim())).map(x => x.textContent.trim()).join('|'),
        chart: !!e.querySelector('.ind-hist-wrap svg'), h: (() => { const pc = e.querySelector('.data-pc'); return pc ? pc.getBoundingClientRect().height : 0; })() }; });
    const sels = [...document.querySelectorAll('#dataBody .data-vs-sel select')].map(s => s.value);
    setDataVsA('EUR'); await new Promise(r => setTimeout(r, 300));
    const getauscht = [...document.querySelectorAll('#dataBody .data-vs-sel select')].map(s => s.value);
    setDataVsA('USD');
    return { panels, sels, getauscht, scroll3, fuenft: !!fuenft };
  });
  const v = await vs();
  if (v.sels.join() !== 'USD,EUR') fail('VS AUSWAHL', `Assets ${v.sels.join(' vs ')} statt USD vs EUR`);
  if (v.panels.length !== 8) fail('VS PANELS', `${v.panels.length} Panels bei 4 Indikatoren (erwartet 8)${v.fuenft ? ' - auch der 5. darf nicht dazukommen' : ''}`);
  if (new Set(v.panels.map(x => x.x)).size !== 2) fail('VS SPALTEN', `${new Set(v.panels.map(x => x.x)).size} Spalten statt 2 (A | B)`);
  if (v.scroll3 > 1) fail('VS SCROLL', `3 Indikatoren: Seite scrollt ${v.scroll3}px - 6 Panels sollen auf einen Bildschirm passen`);
  v.panels.filter(x => x.chart && x.h < 150 - 1).forEach(x => fail('VS GESTAUCHT', `${x.a} ${x.i}: Chart-Zelle ${x.h.toFixed(0)} px (Minimum 150 - lieber scrollen)`));
  for (let i = 0; i + 1 < v.panels.length; i += 2) {
    const l = v.panels[i], r = v.panels[i + 1];
    if (Math.abs(l.y - r.y) > 1 || l.x >= r.x) fail('VS ZEILE', `Zeile ${i / 2 + 1}: ${l.a} ${l.i} und ${r.a} ${r.i} stehen nicht nebeneinander`);
    if (l.a !== 'USD' || r.a !== 'EUR') fail('VS SEITEN', `Zeile ${i / 2 + 1}: links ${l.a}, rechts ${r.a} (soll USD | EUR)`);
    if (l.i !== r.i) fail('VS PAAR', `Zeile ${i / 2 + 1}: ${l.i} neben ${r.i} - eine Zeile = ein Indikator`);
    if (l.chart && r.chart && l.ax !== r.ax) fail('VS SKALA', `${l.i}: Y-Achse ${l.ax} gegen ${r.ax} - gleiche Zeile, gleiche Skala`);
  }
  if (v.getauscht.join() !== 'EUR,USD') fail('VS TAUSCH', `EUR links gewaehlt -> ${v.getauscht.join(' vs ')} (erwartet EUR vs USD)`);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  const hv = await p.evaluate(async () => { renderDataTab(); await new Promise(r => setTimeout(r, 600));
    return [...document.querySelectorAll('#dataBody .data-panel')].map(e => { const t = e.querySelector('.data-pt'); return [Math.round(e.getBoundingClientRect().left), t ? t.firstChild.textContent.trim() : '']; }); });
  if (new Set(hv.map(x => x[0])).size !== 1) fail('VS HANDY', `${new Set(hv.map(x => x[0])).size} Spalten bei 390 px (erwartet 1)`);
  if (hv.some((x, i) => x[1] !== (i % 2 ? 'EUR' : 'USD'))) fail('VS HANDY', `Reihenfolge ${hv.map(x => x[1]).join(',')} (erwartet je Indikator USD, dann EUR)`);
  await p.evaluate(() => setDataMode('assets'));
  perr.forEach(x => fail('JS-FEHLER', x));
  await b.close();
  if (GEGENPROBE_VS) { if (F.some(f => /^VS /.test(f))) { console.log(`datalayout --gegenprobe-vs: ok (rot wie erwartet: ${F.filter(f => /^VS /.test(f)).length} VS-Befund(e))`); process.exit(0); } console.log('datalayout --gegenprobe-vs: FEHLER - Waechter bleibt gruen'); process.exit(1); }
  if (GEGENPROBE) { if (F.length) { console.log(`datalayout --gegenprobe: ok (rot wie erwartet, ${F.length} Befund(e))`); process.exit(0); } console.log('datalayout --gegenprobe: FEHLER - Waechter bleibt gruen'); process.exit(1); }
  if (F.length) { console.log(`datalayout: ${F.length} Befund(e)`); F.slice(0, 30).forEach(f => console.log('  ' + f)); process.exit(1); }
  console.log(`datalayout: ok (1-8 Panels ohne Scroll, Chart ${ns.map(n => n + ':' + hoehe[n].toFixed(0)).join(' ')} px, Kopf Titel+Werkzeugzeile, Filter/Zeitfilter rechts, 9. abgelehnt; Asset vs asset: bis 6 Panels ohne Scroll, 8 Panels A|B je Zeile >= 150 px, gleiche Skala, 5. abgelehnt, Tausch, Handy A ueber B)`);
})().catch(e => { console.log('datalayout: ABBRUCH ' + e.message); process.exit(1); });
