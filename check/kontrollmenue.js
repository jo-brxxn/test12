// ══ WAECHTER: KONTROLLMENUE (Option C) AUF TRENDS, COT, SENTIMENT ═════════════
//
// Nutzer 2026-11-01: "Ich will Option c und guck wo man dieses Design noch
// alles in der App umsetzen kann" -> "Ueberall dieses Design und Aufbau".
// Ein Baustein (kmReiterHtml / kmKnopfHtml / KM_MENUES, js/main.js):
// Unteransichten = Reiter, Darstellung/"Show several at once" = EIN Knopf
// "Display" mit Zusammenfassung, Menue mit Kacheln (Gruppen) und Chips
// (Waehrungen). Data prueft check/datamenu.js.
//
// Geprueft (1000 px, iPad quer):
//   A) TRENDS: Reiter Assets | Pair links, Zeitraum rechts; keine alte
//      Chip-Leiste, kein Pair-Knopf im Kopf; Display "All" -> Menue "Show"
//      (Gruppen + 8 Waehrungen); Chip EUR -> Zusammenfassung "EUR", Menue
//      bleibt offen; Reiter Pair -> Paar-Ansicht ohne Display, Asset-Liste
//      ausgeblendet; Reiter Assets -> zurueck
//   B) COT: Liste mit Display "All", Chip JPY -> nur noch JPY-Zeilen;
//      Einzelansicht EUR: Display "Bars only" -> Kachel "Price on" zeichnet
//      die Kurslinie, "Bars only" nimmt sie wieder weg
//   C) SENTIMENT: 5 Reiter (keine .stabs-Pillen mehr), genau einer aktiv;
//      Retail: Display -> Kachel FX -> "FX"; Fear & Greed ohne Display
//   D) Nirgends mehr eine "Show several at once"-Leiste (.cmp-filter)
//   E) ASSET-SEITE (662): Price-Karte mit Display "Candles · EMA 1D + 4H",
//      Menue Chart | Trend lines; Kachel EMA 4H -> "Candles · EMA 1D";
//      Context-Karte folgt der Diagrammart; keine losen Candles|Line-Knoepfe
// Gegenprobe --gegenprobe: kein "Show"-Abschnitt (kmZeigeAbschnitt liefert
//   nichts) -> A/B rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE = '  if(!ccys.length)return null;\n  const hasNonFx=';

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if (GP && !MAIN.includes(MARKE)) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1000, height: 695 }, serviceWorkers: 'block' });
  await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  if (GP) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MAIN.replace(MARKE, '  return null;\n  const hasNonFx=') }));
  const p = await ctx.newPage(); const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.setItem('fxpro_cot_vs_price', '0'); } catch (e) {} });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  const disp = key => p.evaluate(key => { const e = [...document.querySelectorAll(`[data-km="${key}"]`)].find(x => x.offsetParent); return e ? (e.querySelector('em') || {}).textContent : null; }, key);
  const menue = () => p.evaluate(() => { const e = document.getElementById('kmMenu'); return e ? { lbl: [...e.querySelectorAll('.km-sek > .cmp-filter-lbl')].map(x => x.textContent), kach: [...e.querySelectorAll('.km-kachel b')].map(x => x.textContent), chips: [...e.querySelectorAll('.cmp-chip')].map(x => x.textContent) } : null; });
  const alteLeiste = () => p.evaluate(() => [...document.querySelectorAll('.cmp-filter-lbl')].filter(x => x.offsetParent && /show several at once/i.test(x.textContent)).length);

  // ── A) Trends ──
  console.log('A) Trends');
  await p.evaluate(() => { showTab('trends'); setTrendsFilter('ALL'); }); await p.waitForTimeout(800);
  const t0 = await p.evaluate(() => { const l = document.querySelector('#trendsBody .chart-leiste'); const tabs = l ? [...l.querySelectorAll('.chart-leiste-l .km-tab')] : []; const zeit = l && l.querySelector('.chart-leiste-r .ind-hist-range-btn'); return { tabs: tabs.map(x => x.textContent + (x.classList.contains('on') ? '*' : '')).join('|'), zeitRechts: !!zeit, pairBtn: !!document.getElementById('trendsPairBtn') }; });
  if (t0.tabs !== 'Assets*|Pair' || !t0.zeitRechts || t0.pairBtn) rot(`A: Leiste ${JSON.stringify(t0)}`);
  else gruen('A: Reiter Assets* | Pair links, Zeitraum rechts, kein Pair-Knopf im Kopf');
  const d0 = await disp('trends');
  if (d0 !== 'All') rot(`A: Display-Zusammenfassung "${d0}" statt "All"`);
  else {
    await p.locator('[data-km="trends"]').click(); await p.waitForTimeout(250);
    const m = await menue();
    if (!m || m.lbl[0] !== 'Show' || m.kach[0] !== 'All' || m.chips.length !== 8) rot(`A: Menue ${JSON.stringify(m)}`);
    else gruen(`A: Menue "Show": ${m.kach.join(', ')} + ${m.chips.length} Waehrungen`);
    await p.locator('#kmMenu .cmp-chip', { hasText: /^EUR$/ }).click(); await p.waitForTimeout(500);
    const d1 = await disp('trends'), offen = await p.evaluate(() => !!document.getElementById('kmMenu'));
    if (d1 !== 'EUR' || !offen) rot(`A: nach Chip EUR "${d1}", Menue ${offen ? 'offen' : 'zu'}`); else gruen('A: Chip EUR -> "EUR", Menue bleibt offen');
    await p.keyboard.press('Escape');
    await p.evaluate(() => clearTrendsCcyFilter()); await p.waitForTimeout(300);
  }
  await p.locator('#trendsBody .km-tab', { hasText: /^Pair$/ }).click(); await p.waitForTimeout(700);
  const t1 = await p.evaluate(() => ({ on: (document.querySelector('#trendsBody .km-tab.on') || {}).textContent, disp: !!document.querySelector('[data-km="trends"]'), sel: getComputedStyle(document.getElementById('trendsCcySel')).display, pairSel: getComputedStyle(document.getElementById('trendsPairWrap')).display }));
  await p.locator('#trendsBody .km-tab', { hasText: /^Assets$/ }).click(); await p.waitForTimeout(700);
  const t2 = await p.evaluate(() => (document.querySelector('#trendsBody .km-tab.on') || {}).textContent);
  if (t1.on !== 'Pair' || t1.disp || t1.sel !== 'none' || t1.pairSel === 'none' || t2 !== 'Assets') rot(`A: Pair ${JSON.stringify(t1)}, zurueck "${t2}"`);
  else gruen('A: Reiter Pair -> Paar-Auswahl, kein Display, Asset-Liste weg; zurueck auf Assets');

  // ── B) COT ──
  console.log('B) COT');
  await p.evaluate(() => { showTab('cot'); pickCotFilter(''); }); await p.waitForTimeout(800);
  const c0 = await disp('cot');
  if (c0 !== 'All') rot(`B: Display "${c0}" statt "All"`);
  else {
    const vor = await p.evaluate(() => document.querySelectorAll('#cotBody .pd-row').length);
    await p.locator('[data-km="cot"]').click(); await p.waitForTimeout(250);
    await p.locator('#kmMenu .cmp-chip', { hasText: /^JPY$/ }).click(); await p.waitForTimeout(500);
    const nach = await p.evaluate(() => document.querySelectorAll('#cotBody .pd-row').length), c1 = await disp('cot');
    await p.keyboard.press('Escape'); await p.evaluate(() => clearCotCcyFilter()); await p.waitForTimeout(300);
    if (c1 !== 'JPY' || !(nach > 0 && nach < vor)) rot(`B: Chip JPY -> "${c1}", Zeilen ${vor} -> ${nach}`); else gruen(`B: Liste: Chip JPY -> "JPY", Zeilen ${vor} -> ${nach}`);
  }
  await p.evaluate(() => pickCotFilter('EUR')); await p.waitForTimeout(1200);
  const h0 = await disp('cotHist');
  if (h0 !== 'Bars only') rot(`B: Einzelansicht Display "${h0}" statt "Bars only"`);
  else {
    await p.locator('[data-km="cotHist"]').click(); await p.waitForTimeout(250);
    await p.locator('#kmMenu .km-kachel', { hasText: 'Price on' }).click(); await p.waitForTimeout(800);
    const an = await p.evaluate(() => document.querySelectorAll('#cotHistWrap svg .cot-preis').length), h1 = await disp('cotHist');
    await p.locator('#kmMenu .km-kachel', { hasText: 'Bars only' }).click(); await p.waitForTimeout(800);
    const aus = await p.evaluate(() => document.querySelectorAll('#cotHistWrap svg .cot-preis').length);
    await p.keyboard.press('Escape'); await p.evaluate(() => pickCotFilter(''));
    if (!an || aus || h1 !== 'Price on') rot(`B: Price on -> ${an} Kurslinie(n), "${h1}"; Bars only -> ${aus}`); else gruen('B: Einzelansicht: "Price on" zeichnet die Kurslinie, "Bars only" nimmt sie weg');
  }

  // ── C) Sentiment ──
  console.log('C) Sentiment');
  await p.evaluate(() => { showTab('sent'); setSentSub('retail'); setSentSym(''); }); await p.waitForTimeout(800);
  const s0 = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('#sentBody .sent-nav .km-tab')].map(x => x.textContent + (x.classList.contains('on') ? '*' : '')), stabs: document.querySelectorAll('#sentBody .stabs').length }));
  if (s0.tabs.length !== 5 || s0.tabs.filter(x => x.endsWith('*')).length !== 1 || s0.stabs) rot(`C: Reiter ${JSON.stringify(s0)}`); else gruen(`C: 5 Reiter (${s0.tabs.join(' | ')}), keine Pillen`);
  const r0 = await disp('sent');
  if (r0 !== 'All') rot(`C: Retail Display "${r0}" statt "All"`);
  else {
    await p.locator('[data-km="sent"]').click(); await p.waitForTimeout(250);
    await p.locator('#kmMenu .km-kachel', { hasText: /^FX/ }).first().click(); await p.waitForTimeout(500);
    const r1 = await disp('sent');
    await p.keyboard.press('Escape'); await p.evaluate(() => clearSentCcyFilter());
    if (r1 !== 'FX') rot(`C: Retail Kachel FX -> "${r1}"`); else gruen('C: Retail: Kachel FX -> "FX"');
  }
  await p.locator('#sentBody .km-tab', { hasText: 'Fear & Greed' }).click(); await p.waitForTimeout(600);
  const fg = await p.evaluate(() => ({ on: (document.querySelector('#sentBody .km-tab.on') || {}).textContent, disp: !!document.querySelector('[data-km="sent"]') }));
  if (fg.on !== 'Fear & Greed' || fg.disp) rot(`C: Fear & Greed ${JSON.stringify(fg)}`); else gruen('C: Reiter Fear & Greed aktiv, kein Display');

  // ── D) keine alte Leiste ──
  let alt = 0;
  for (const t of ['trends', 'cot']) { await p.evaluate(t => showTab(t), t); await p.waitForTimeout(500); alt += await alteLeiste(); }
  await p.evaluate(() => { showTab('sent'); setSentSub('retail'); }); await p.waitForTimeout(500); alt += await alteLeiste();
  if (alt) rot(`D: noch ${alt} "Show several at once"-Leiste(n)`); else gruen('D: keine "Show several at once"-Leiste mehr (Trends, COT, Retail)');

  // ── E) Asset-Seite ──
  console.log('E) Asset-Seite: Price- und Context-Karte');
  await p.evaluate(() => { setPxChartTyp('candle'); setAbTrendLinienVal('d,h'); gotoSym('USD'); }); await p.waitForTimeout(1300);
  const e0 = { preis: await disp('abPreis'), ktx: await disp('abKontext'), lose: await p.evaluate(() => document.querySelectorAll('#detail .ctyp .ctyp-ic').length) };
  if (e0.preis !== 'Candles · EMA 1D + 4H' || e0.ktx !== 'Candles' || e0.lose) rot(`E: Start ${JSON.stringify(e0)}`);
  else {
    await p.locator('#detail [data-km="abPreis"]').click(); await p.waitForTimeout(250);
    const m = await menue();
    await p.locator('#kmMenu .km-kachel', { hasText: 'EMA 4H' }).click(); await p.waitForTimeout(700);
    const e1 = await disp('abPreis');
    await p.locator('#kmMenu .km-kachel', { hasText: /^Line/ }).first().click(); await p.waitForTimeout(700);
    const e2 = { preis: await disp('abPreis'), ktx: await disp('abKontext') };
    await p.keyboard.press('Escape'); await p.evaluate(() => { setPxChartTyp('candle'); setAbTrendLinienVal('d,h'); });
    if (!m || m.lbl.join('|') !== 'Chart|Trend lines' || e1 !== 'Candles · EMA 1D' || e2.preis !== 'Line · EMA 1D' || e2.ktx !== 'Line') rot(`E: Menue ${JSON.stringify(m && m.lbl)}, nach EMA 4H "${e1}", nach Line ${JSON.stringify(e2)}`);
    else gruen('E: Price "Candles · EMA 1D + 4H" -> Menue Chart|Trend lines -> "Candles · EMA 1D" -> "Line · EMA 1D", Context folgt');
  }

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ kontrollmenue: ${fehler} Befund(e)` : '\n✓ kontrollmenue: Trends, COT, Sentiment, Asset-Seite mit Reitern und Display-Menue, keine alten Leisten');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
