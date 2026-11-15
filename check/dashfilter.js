// ── DASHBOARD: KATEGORIE-FILTER + EINGEKLAPPTE BIAS-SPALTEN (seit 2026-11-15, 727) ──
// Nutzer 2026-11-15: "Arbeite bei dem Score Ranking auch mit einem extend Button ...
// auch fuer bullish und bearish begrenzen" (Antwort: unter den Top 3 je Spalte 3) und
// "bei dem Ranking und bei der Performance Karte die Auswahl nach all und den ganzen
// Kategorien also Forex crypto usw". 1440 und 390 px:
//  A) Beide Karten haben die Chip-Zeile All/FX/Crypto/Metals/Energy/Indices/Stocks/Yields,
//     All ist aktiv; Performance: Chips links, Zeitraum rechts in derselben Zeile (PC)
//  B) Bias scores: jede Spalte zeigt eingeklappt hoechstens 3; jede laengere Spalte hat
//     "Show all N"; Tipp zeigt alle N, nochmal Tipp wieder 3
//  C) Filter Stocks: Bias scores und Performance zeigen NUR Aktien (assetCls 'stock');
//     FX nur Waehrungen
//  D) Filter bleibt: localStorage + im Cloud-Push (data.dashBiasKat / dashPerfKat)
//  E) kein Ueberlauf der Seite, keine JS-Fehler
// --gegenprobe: Filter wirkungslos (dashKatPasst immer true) -> C muss rot werden.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const KATS = ['All', 'FX', 'Crypto', 'Metals', 'Energy', 'Indices', 'Stocks', 'Yields'];
(async () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const F = [];
  // D statisch: Push/Pull/Export/Import
  const push = (main.match(/async function cloudPush[\s\S]*?\n}\n/) || [''])[0];
  if (!/data\.dashBiasKat=dashBiasKat/.test(push) || !/data\.dashPerfKat=dashPerfKat/.test(push)) F.push('D: Filter nicht im Cloud-Push');
  if (!/cd\.dashBiasKat!==undefined/.test(main) || !/cd\.dashPerfKat!==undefined/.test(main)) F.push('D: Filter nicht im Cloud-Pull');
  if (!/_imp\.dashBiasKat/.test(main)) F.push('D: Filter nicht im Import');
  const b = await chromium.launch();
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace("function dashKatPasst(id,k){return k==='ALL'||assetCls(id)===k;}", 'function dashKatPasst(id,k){return true;}'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.removeItem('fxpro_dash_bias_kat'); localStorage.removeItem('fxpro_dash_perf_kat'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.mov,.mov2,.ov').forEach(m => { m.style.display = 'none'; }); showTab('dash'); });
    await p.waitForTimeout(1500);
    const lies = () => p.evaluate(() => {
      const bias = document.getElementById('dbBias'), perf = document.getElementById('dbPerf');
      const chips = k => k ? [...k.querySelectorAll('.db-kat-b')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')) : null;
      const ids = el => el ? [...el.querySelectorAll('.db-bias[data-id]')].map(x => x.dataset.id) : [];
      const sp = bias ? [...bias.querySelectorAll('.dbv-sp')].map(x => ({ b: x.dataset.bias, sicht: [...x.querySelectorAll('.db-bias')].filter(e => !e.hidden).length, alle: x.querySelectorAll('.db-bias').length, knopf: (x.querySelector('.dbv-mehr') || {}).textContent || '' })) : [];
      const perfIds = perf ? [...perf.querySelectorAll('.perf-row')].map(r => { const m = (r.getAttribute('onclick') || '').match(/gotoSym\('([^']+)'/); return m ? m[1] : ''; }) : [];
      const zf = perf && perf.querySelector('.dx-zf-perf'), kat = zf && zf.querySelector('.db-kat'), win = zf && zf.querySelector('.db-perf-win');
      return { cb: chips(bias), cp: chips(perf), ids: ids(bias), sp, perfIds, kls: Object.fromEntries([...ids(bias), ...perfIds].map(i => [i, assetCls(i)])),
        perfLage: kat && win ? { katL: Math.round(kat.getBoundingClientRect().left - zf.getBoundingClientRect().left), winR: Math.round(zf.getBoundingClientRect().right - win.getBoundingClientRect().right), gleich: Math.abs(kat.getBoundingClientRect().top - win.getBoundingClientRect().top) < 4 } : null,
        ueber: document.documentElement.scrollWidth - innerWidth };
    });
    let L = await lies();
    if (!L.cb || L.cb.join('|') !== KATS.map((k, i) => i ? k : k + '*').join('|')) F.push(`${o} A: Bias-Chips ${JSON.stringify(L.cb)}`);
    if (!L.cp || L.cp.join('|') !== KATS.map((k, i) => i ? k : k + '*').join('|')) F.push(`${o} A: Performance-Chips ${JSON.stringify(L.cp)}`);
    if (W > 1000 && L.perfLage && (L.perfLage.katL > 2 || L.perfLage.winR > 2 || !L.perfLage.gleich)) F.push(`${o} A: Performance-Zeile ${JSON.stringify(L.perfLage)} (Chips links, Zeitraum rechts, eine Zeile)`);
    // B
    L.sp.forEach(x => { if (x.sicht > 3) F.push(`${o} B: Spalte ${x.b} zeigt ${x.sicht} (max 3)`); if (x.alle > 3 && !/Show all \d+/.test(x.knopf)) F.push(`${o} B: Spalte ${x.b} (${x.alle}) ohne "Show all"`); });
    const lang = L.sp.find(x => x.alle > 3);
    if (lang) {
      await p.evaluate(b => document.querySelector(`#dbBias .dbv-sp[data-bias="${b}"] .dbv-mehr`).click(), lang.b); await p.waitForTimeout(300);
      let x = (await lies()).sp.find(y => y.b === lang.b); if (x.sicht !== lang.alle) F.push(`${o} B: nach "Show all" ${x.sicht} von ${lang.alle} sichtbar`);
      await p.evaluate(b => document.querySelector(`#dbBias .dbv-sp[data-bias="${b}"] .dbv-mehr`).click(), lang.b); await p.waitForTimeout(300);
      x = (await lies()).sp.find(y => y.b === lang.b); if (x.sicht !== 3) F.push(`${o} B: nach "Show less" ${x.sicht} sichtbar (erwartet 3)`);
    } else F.push(o + ' B: keine Spalte mit mehr als 3 - Pruefung untauglich');
    // C
    for (const [chip, kls] of [['Stocks', 'stock'], ['FX', 'fx']]) {
      await p.evaluate(c => { [...document.querySelectorAll('#dbBias .db-kat-b')].find(b => b.textContent.trim() === c).click(); }, chip); await p.waitForTimeout(300);
      await p.evaluate(c => { [...document.querySelectorAll('#dbPerf .db-kat-b')].find(b => b.textContent.trim() === c).click(); }, chip); await p.waitForTimeout(300);
      L = await lies();
      const fremdB = L.ids.filter(i => L.kls[i] !== kls), fremdP = L.perfIds.filter(i => L.kls[i] !== kls);
      if (!L.ids.length) F.push(`${o} C: Bias scores bei ${chip} leer`);
      if (fremdB.length) F.push(`${o} C: Bias scores bei ${chip} mit fremden Assets: ${fremdB.slice(0, 5).join(', ')}`);
      if (fremdP.length) F.push(`${o} C: Performance bei ${chip} mit fremden Assets: ${fremdP.slice(0, 5).join(', ')}`);
      const kurz = await p.evaluate(() => { const sp = [...document.querySelectorAll('#dbBias .dbv-p-sp')][1]; if (!sp) return null; return { lbl: sp.querySelector('.db-gr-lbl').textContent.trim(), w: [...sp.querySelectorAll('.db-bias[data-id]')].map(z => symScoreCmp(syms.find(s => s.id === z.dataset.id))) }; });
      if (kurz && kurz.lbl === 'Strongest short' && kurz.w.some(v => v >= 0)) F.push(`${o} C: "Strongest short" bei ${chip} mit nicht negativem Score (${kurz.w.join(', ')})`);
    }
    // D) gemerkt
    const ls = await p.evaluate(() => [localStorage.getItem('fxpro_dash_bias_kat'), localStorage.getItem('fxpro_dash_perf_kat')]);
    if (ls[0] !== 'fx' || ls[1] !== 'fx') F.push(`${o} D: localStorage ${JSON.stringify(ls)} (erwartet fx/fx)`);
    if (L.ueber > 1) F.push(`${o} E: Seite laeuft ${L.ueber} px ueber`);
    err.forEach(e => F.push(o + ' E JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / C: .*fremden Assets/.test(f)); console.log(ok ? 'dashfilter --gegenprobe: ok (wirkungsloser Filter gemeldet)' : 'dashfilter --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('dashfilter: ' + F.length + ' Befund(e)\n  ' + F.slice(0, 30).join('\n  ')); process.exit(1); }
  console.log('dashfilter: ok (Chips in Bias scores + Performance, Spalten je 3 mit Show all, Filter Stocks/FX wirkt, gemerkt + synchronisiert, kein Ueberlauf)');
})().catch(e => { console.log('dashfilter: ABBRUCH ' + e.message); process.exit(1); });
