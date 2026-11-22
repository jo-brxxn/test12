// ── SCORE-REGELN-FENSTER "HOW THE SCORE WORKS" (2026-11-22, VERSION-CHECK-794) ──
// Nutzer: "Entfern das bei allen Assets oben mit Next Event und mach dort Score
// hin ... Fenster ... wie sich der Score ergibt ... oben rechts ein Zahnrad ...
// settings Fenster ... in der Leiste das Zahnrad auch ueberall entfernen ...
// sollen da nicht die ganzen Assets stehen das kann man ueber einen Filter loesen".
//  A) JEDE Asset-Seite: kein "Next event", Knopf "Score" in der Leiste, kein Zahnrad
//  B) JEDE Indikator-Zeile jedes Assets hat eine bekannte Regel (srTyp != 'unbekannt'),
//     und ihr echter Beitrag |indScore| liegt nie ueber dem Hoechstwert, den das
//     Fenster fuer diese Regel nennt (srMax) - sonst luegt das Fenster
//  C) Sentiment-Schwellen im Fenster = Verhalten von sentEval (dort Literale)
//  D) Fenster: Knopf oeffnet es; Zahnrad nur bei Nicht-FX und oeffnet die Settings;
//     FX-COT gegen die Spekulanten, Gold-Inflation gedreht
//  E) Settings: keine Kachel je Asset mehr; verbinden ueber die gruppierte Liste
//     (2-Spalten-Fenster), Chip mit x loest wieder
// --gegenprobe: Retail-Zeilen verlieren ihre Regel -> B muss rot werden.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  // Gegenprobe aus der Datei auf der Platte (kein r.fetch: geht auch ohne laufenden Server)
  if (GP) await ctx.route(/\/js\/scoreregeln\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'scoreregeln.js'), 'utf8').replace("if (ind.name === h.RETAIL_IND_NAME) return 'retail';", '') }));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto(URL); await wartenBisDatenDa(p); await p.waitForTimeout(2500);
  await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));

  // B + C (ohne Klicks, alle Assets)
  const R = await p.evaluate(() => {
    const o = { b: [], c: [], n: 0, ids: syms.map(s => s.id) };
    syms.forEach(s => (s.rubrics || []).forEach(r => (r.indicators || []).forEach(i => {
      o.n++;
      const t = srTyp(s.id, r, i);
      if (t === 'unbekannt') { o.b.push(`${s.id} ${r.name}: "${i.name}" hat keine Regel im Fenster`); return; }
      const v = Math.abs(indScore(i, r)), m = srMax(s.id, r, i, t);
      if (v > m + 1e-9) o.b.push(`${s.id} "${i.name}" (${t}) traegt ${v}, das Fenster nennt hoechstens ${m}`);
    })));
    const soll = [['vix', 28, 'bull'], ['vix', 27.9, 'neu'], ['vix', 13, 'bear'], ['vix', 13.1, 'neu'],
      ['aaii', -20, 'bull'], ['aaii', -19.9, 'neu'], ['aaii', 20, 'bear'], ['aaii', 19.9, 'neu'],
      ['cryptoFng', 25, 'bull'], ['cryptoFng', 26, 'neu'], ['cryptoFng', 75, 'bear'], ['cryptoFng', 74, 'neu']];
    soll.forEach(([k, v, b]) => { const e = sentEval(k, { value: v, date: todayStr() }); const ist = e && e.bias; if (ist !== b) o.c.push(`sentEval ${k} ${v} -> ${ist}, Fenster sagt ${b}`); });
    return o;
  });
  F.push(...R.b.slice(0, 15).map(x => 'B: ' + x), ...R.c.map(x => 'C: ' + x));

  // A: jede Asset-Seite
  for (const id of R.ids) {
    await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(350);
    const a = await p.evaluate(() => {
      const d = document.querySelector('#detail .dmeta'); if (!d) return { fehlt: true };
      return { next: /next event/i.test(d.textContent), score: [...d.querySelectorAll('.dmeta-hist-btn')].some(x => x.textContent.trim() === 'Score'), gear: !!d.querySelector('.cfg-gear') };
    });
    if (a.fehlt) F.push(`A: ${id} ohne Kopfleiste`);
    else { if (a.next) F.push(`A: ${id} zeigt noch "Next event"`); if (!a.score) F.push(`A: ${id} ohne Knopf "Score"`); if (a.gear) F.push(`A: ${id} Zahnrad noch in der Leiste`); }
  }

  // D: Fenster
  const fenster = async id => {
    await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(500);
    await p.locator('#detail .dmeta-hist-btn', { hasText: /^Score$/ }).click(); await p.waitForTimeout(400);
    return p.evaluate(() => ({ offen: getComputedStyle(document.getElementById('mScoreRegeln')).display !== 'none', gear: document.getElementById('srGear').offsetParent !== null,
      z: [...document.querySelectorAll('#srBody .sr-z')].map(z => [z.querySelector('.sr-z-t').textContent, z.querySelector('.sr-z-p').textContent]) }));
  };
  const eur = await fenster('EUR');
  if (!eur.offen) F.push('D: Knopf "Score" oeffnet das Fenster nicht');
  if (eur.gear) F.push('D: Zahnrad bei EUR (FX hat keine Settings)');
  const cot = eur.z.find(z => /COT speculators/.test(z[0]));
  if (!cot || !/^−/.test(cot[1])) F.push(`D: EUR COT nicht gegen die Spekulanten (${cot && cot[1]})`);
  await p.evaluate(() => closeM('mScoreRegeln'));
  const gold = await fenster('GOLD');
  if (!gold.gear) F.push('D: kein Zahnrad bei GOLD');
  const inf = gold.z.find(z => /USD Inflation beats/.test(z[0]));
  if (!inf || !/^−1/.test(inf[1])) F.push(`D: GOLD Inflation nicht gedreht (${inf && inf[1]})`);
  await p.locator('#srGear').click(); await p.waitForTimeout(500);
  const cfg = await p.evaluate(() => ({ auf: getComputedStyle(document.getElementById('mAssetCfg')).display !== 'none', zu: getComputedStyle(document.getElementById('mScoreRegeln')).display === 'none' }));
  if (!cfg.auf) F.push('D: Zahnrad oeffnet die Settings nicht'); if (!cfg.zu) F.push('D: Score-Fenster bleibt hinter den Settings offen');

  // E: Settings
  const e = await p.evaluate(() => ({ kacheln: document.querySelectorAll('#assetCfgBody .acfg-syncbtn').length, gruppen: document.querySelectorAll('#assetCfgBody select.acfg-add optgroup').length }));
  if (e.kacheln) F.push(`E: ${e.kacheln} Asset-Kacheln im Settings-Fenster`);
  if (!e.gruppen) F.push('E: keine gruppierte Liste zum Verbinden');
  const sel = await p.locator('#assetCfgBody select.acfg-add').boundingBox();
  if (sel) {
    await p.mouse.click(sel.x + sel.width / 2, sel.y + sel.height / 2); await p.waitForTimeout(400);
    if (!(await p.isVisible('#gwPicker'))) F.push('E: Liste oeffnet das 2-Spalten-Fenster nicht');
    else {
      await p.locator('#gwPicker .cmp-chip', { hasText: /^Silver$/ }).click(); await p.waitForTimeout(500);
      const v = await p.locator('#assetCfgBody .acfg-link').allTextContents();
      if (!v.some(t => /Silver/.test(t))) F.push('E: Silver nach Auswahl nicht verbunden');
      else { await p.locator('#assetCfgBody .acfg-link button').first().click(); await p.waitForTimeout(500);
        if (await p.locator('#assetCfgBody .acfg-link').count()) F.push('E: x loest die Verbindung nicht'); }
    }
  }
  err.forEach(x => F.push('JS-Fehler: ' + x));
  await b.close();
  if (GP) { const ok = F.some(f => /^B: .*Retail Positioning/.test(f)); console.log(ok ? 'scoreregeln --gegenprobe: ok (Zeile ohne Regel rot gemeldet)' : 'scoreregeln --gegenprobe: FEHLER - Waechter bleibt gruen\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log(`scoreregeln: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log(`scoreregeln: ok (${R.ids.length} Asset-Seiten mit "Score" statt "Next event", ${R.n} Zeilen mit Regel und Beitrag <= Fensterwert, Sentiment-Schwellen, Zahnrad nur Nicht-FX -> Settings, Verbinden ueber Filter)`);
})().catch(e => { console.log('scoreregeln: ABBRUCH ' + e.message); process.exit(1); });
