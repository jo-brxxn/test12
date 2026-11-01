// ══ WAECHTER: DATA-KONTROLLMENUE (Option C) ══════════════════════════════════
//
// Nutzer 2026-11-01 (Screenshot, Leiste eingekreist): "bau mal ein richtiges
// kontrollmenue ... weil aktuell weis man nicht ob die Knoepfe
// zusammengehoeren oder getrennt ich will mehr Uebersicht" - Wahl Option C:
// Ansicht als Reiter, EIN Knopf "Display" mit der aktuellen Wahl als
// Zusammenfassung, der ein Menue mit Kacheln (Layout · Scale · Chart) oeffnet.
//
// Geprueft (1180 und 390 px):
//   A) REITER: in jeder Ansicht genau 5 Reiter links in der Werkzeugzeile,
//      genau einer aktiv = die Ansicht; Tipp wechselt die Ansicht; keine
//      alten Pillen-Leisten (.px-modes) und kein loser Candles|Line-Schalter
//   B) DISPLAY-KNOPF nur in Prices und Compare all, Zusammenfassung = Zustand
//      (Prices: Layout · [Scale nur bei One chart] · Chart; Compare all: Chart)
//   C) MENUE: unter dem Knopf, linksbuendig (oder am Rand begrenzt), ganz im
//      Bild; Abschnitte Layout/Scale/Chart (Compare all: nur Chart); Scale bei
//      Side by side gesperrt; Kachel wirkt sofort, Menue bleibt offen, die
//      Zusammenfassung folgt; Tipp daneben und Esc schliessen
// Gegenproben: --gegenprobe-zusammenfassung (keine Zusammenfassung/kein
//   Knopf) -> B rot, --gegenprobe-anker (Menue rechtsbuendig) -> C rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP_Z = process.argv.includes('--gegenprobe-zusammenfassung');
const GP_A = process.argv.includes('--gegenprobe-anker');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const M_Z = "  if(!teile||!teile.length)return'';";
const M_A = '  pickerAnkern(el,btn,true);';

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if ((GP_Z && !MAIN.includes(M_Z)) || (GP_A && !MAIN.includes(M_A))) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  let main = MAIN;
  if (GP_Z) main = main.replace(M_Z, "  return'';");
  if (GP_A) main = main.replace(M_A, '  pickerAnkern(el,btn);');
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const perr = [];
  for (const [w, h] of [[1180, 820], [390, 844]]) {
    console.log(`── ${w} px`);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (GP_Z || GP_A) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
    const p = await ctx.newPage(); p.on('pageerror', e => perr.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    await p.evaluate(() => { showTab('data'); setPxChartTyp('line'); dataPreisListe = ['p:OIL', 'p:GOLD']; setDataPreisAnsicht('neben'); });

    // ── A) Reiter ──
    const modi = ['assets', 'inds', 'vs', 'preis', 'alle'];
    let aFehler = 0;
    for (const m of modi) {
      await p.evaluate(m => setDataMode(m), m); await p.waitForTimeout(250);
      const r = await p.evaluate(() => { const t = [...document.querySelectorAll('#dataBody .data-row2 .chart-leiste-l .km-tab')]; return { n: t.length, on: t.filter(x => x.classList.contains('on')).map(x => x.textContent.trim()), alt: document.querySelectorAll('#dataBody .px-modes, #dataBody .data-head .ctyp').length, mode: dataMode }; });
      const soll = { assets: 'By asset', inds: 'By indicator', vs: 'Asset vs asset', preis: 'Prices', alle: 'Compare all' }[m];
      if (r.n !== 5 || r.on.length !== 1 || r.on[0] !== soll) { rot(`A ${m}: ${r.n} Reiter, aktiv ${JSON.stringify(r.on)} (soll "${soll}")`); aFehler++; }
      if (r.alt) { rot(`A ${m}: noch ${r.alt} alte Pillen-/Schalterleiste(n) im Kopf`); aFehler++; }
    }
    await p.locator('#dataBody .km-tab', { hasText: 'By indicator' }).click(); await p.waitForTimeout(250);
    const tipp = await p.evaluate(() => dataMode);
    if (tipp !== 'inds') { rot(`A: Tipp auf "By indicator" -> Ansicht ${tipp}`); aFehler++; }
    if (!aFehler) gruen('A: 5 Reiter in jeder Ansicht, genau einer aktiv, Tipp wechselt, keine alten Leisten');

    // ── B) Display-Knopf ──
    const disp = () => p.evaluate(() => { const e = document.querySelector('[data-km="data"]'); return e ? (e.querySelector('em') || {}).textContent || '' : null; });
    const bErg = {};
    for (const m of modi) { await p.evaluate(m => setDataMode(m), m); await p.waitForTimeout(200); bErg[m] = await disp(); }
    await p.evaluate(() => { setDataMode('preis'); setDataPreisAnsicht('eins'); setDataPreisSkala('bruch'); }); await p.waitForTimeout(250);
    const eins = await disp();
    const bOk = bErg.assets === null && bErg.inds === null && bErg.vs === null && bErg.preis === 'Side by side · Line' && bErg.alle === 'Line' && eins === 'One chart · Common · Line';
    if (!bOk) rot(`B: Display-Knopf ${JSON.stringify(bErg)}, One chart: "${eins}"`);
    else gruen('B: Display nur in Prices/Compare all, Zusammenfassung = Zustand ("Side by side · Line", "One chart · Common · Line", "Line")');

    // ── C) Menue ──
    await p.evaluate(() => { setDataPreisAnsicht('neben'); window.scrollTo(0, 0); }); await p.waitForTimeout(250);
    if (!(await p.locator('[data-km="data"]').count())) { rot('C: kein Display-Knopf'); }
    else {
      await p.locator('[data-km="data"]').click(); await p.waitForTimeout(250);
      const m = await p.evaluate(() => { const e = document.getElementById('kmMenu'), bt = document.querySelector('[data-km="data"]'); if (!e) return null; const r = e.getBoundingClientRect(), q = bt.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, bl: q.left, bb: q.bottom, vw: innerWidth, sek: [...e.querySelectorAll('.km-sek > .cmp-filter-lbl')].map(x => x.textContent.split(' ·')[0]), aus: [...e.querySelectorAll('.km-kachel:disabled')].map(x => x.querySelector('b').textContent) }; });
      if (!m) rot('C: Menue geht nicht auf');
      else {
        const links = Math.abs(m.l - m.bl) < 1.5 || (m.l >= 8 - 0.5 && m.r <= m.vw - 8 + 0.5 && m.bl + (m.r - m.l) > m.vw - 8);
        if (m.t < m.bb - 0.5 || !links || m.l < 7.5 || m.r > m.vw - 7.5) rot(`C: Menue ${Math.round(m.l)}…${Math.round(m.r)} oben ${Math.round(m.t)} (Knopf links ${Math.round(m.bl)}, unten ${Math.round(m.bb)}, Fenster ${m.vw})`);
        else if (m.sek.join('|') !== 'Layout|Scale|Chart' || m.aus.join('|') !== 'Low → high|Common') rot(`C: Abschnitte ${m.sek.join('|')}, gesperrt ${m.aus.join('|')}`);
        else gruen(`C: Menue unter dem Knopf (${Math.round(m.l)}…${Math.round(m.r)}), Layout|Scale|Chart, Scale bei Side by side gesperrt`);
        await p.locator('#kmMenu .km-kachel').filter({ has: p.locator('b', { hasText: /^One chart$/ }) }).click(); await p.waitForTimeout(300);
        const n = await p.evaluate(() => ({ offen: !!document.getElementById('kmMenu'), ans: dataPreisAnsicht, z: (document.querySelector('[data-km="data"] em') || {}).textContent, aus: document.querySelectorAll('#kmMenu .km-kachel:disabled').length }));
        if (!n.offen || n.ans !== 'eins' || n.z !== 'One chart · Common · Line' || n.aus) rot(`C: Kachel One chart -> offen ${n.offen}, Ansicht ${n.ans}, "${n.z}", gesperrt ${n.aus}`);
        else gruen('C: Kachel wirkt sofort, Menue bleibt offen, Zusammenfassung folgt, Scale wieder frei');
        await p.keyboard.press('Escape'); await p.waitForTimeout(150);
        const esc = await p.evaluate(() => !document.getElementById('kmMenu'));
        await p.locator('[data-km="data"]').click(); await p.waitForTimeout(200);
        await p.mouse.click(w - 20, h - 20); await p.waitForTimeout(200);
        const weg = await p.evaluate(() => !document.getElementById('kmMenu'));
        if (!esc || !weg) rot(`C: schliessen - Esc ${esc}, Tipp daneben ${weg}`); else gruen('C: Esc und Tipp daneben schliessen das Menue');
        await p.evaluate(() => setDataMode('alle')); await p.waitForTimeout(200);
        await p.locator('[data-km="data"]').click(); await p.waitForTimeout(200);
        const alle = await p.evaluate(() => [...document.querySelectorAll('#kmMenu .km-sek > .cmp-filter-lbl')].map(x => x.textContent).join('|'));
        await p.evaluate(() => kmZu());
        if (alle !== 'Chart') rot(`C: Compare all zeigt "${alle}" statt nur Chart`); else gruen('C: Compare all - nur Chart');
      }
    }
    await ctx.close();
  }
  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP_Z || GP_A) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ datamenu: ${fehler} Befund(e)` : '\n✓ datamenu: Reiter, Display-Knopf mit Zusammenfassung, Menue unter dem Knopf, wirkt sofort, schliesst sauber');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
