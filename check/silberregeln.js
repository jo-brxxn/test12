// ── SILBER: KARTEN INVERS, REGEL JE INDIKATOR, CHINA-BLOCK (seit 2026-11-22, VERSION-CHECK-792, Modell 39) ──
// Nutzer 2026-11-22: "das Zahnrad einstellst, genauso wie bei Gold, dass Inflation schlecht, Arbeitsmarkt auch
// schlecht und Wirtschaftswachstum schlecht ... China-Indikatoren ... abgetrennt ... mit so einer kleinen
// gestrichelten Linie ganz unten ... positiv zaehlen ... im Zahnrad ... einzelne Indikatoren bearish setzen".
//  A) SILVER: Inflation, Interest Rates, Labour Market, Economic Growth = inverse; ISM-Zeile inverse (indRules)
//  B) jede gespiegelte Zeile der drei Karten = Gegenteil der USD-Zeile
//  C) China NBS PMI + China Industrial Production unten, erste China-Zeile mit gestrichelter Linie
//  D) Zahnrad: Einzelzeile NFP auf Bullish -> wie USD; zurueck auf Card -> wieder invers; Zeilen im Menue
// --gegenprobe: Einzelregeln werden nicht angewendet -> D rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const MARKE = '    indRegelnAnwenden(sym,srcSym);';
(async () => {
  const F = [], OK = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); const t = await res.text(); if (!t.includes(MARKE)) F.push('Gegenprobe: Marke fehlt'); r.fulfill({ response: res, body: t.replace(MARKE, '') }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
  await p.evaluate(() => gotoSym('SILVER')); await p.waitForTimeout(3000);
  const KARTEN = ['Inflation', 'Labour Market', 'Economic Growth'];
  const a = await p.evaluate(() => { const s = getSym(); return { d: s.deriveRules || {}, i: s.indRules || {} }; });
  const falschA = ['Inflation', 'Interest Rates', 'Labour Market', 'Economic Growth'].filter(k => a.d[k] !== 'inverse');
  if (falschA.length || a.i['US ISM Manufacturing PMI'] !== 'inverse') F.push(`A: Regeln ${JSON.stringify(a)}`); else OK.push('A: vier Karten inverse, ISM-Zeile inverse');
  const bz = await p.evaluate(K => { const s = getSym(), u = syms.find(x => x.id === 'USD'); const out = { n: 0, f: [] };
    K.forEach(k => { const r = s.rubrics.find(x => x.name === k), ur = u.rubrics.find(x => x.name === k);
      r.indicators.forEach(i => { const ui = ur.indicators.find(x => x.name === i.name); if (!ui || ui.bias === 'neu') return; out.n++;
        const soll = ui.bias === 'bull' ? 'bear' : 'bull'; if (i.bias !== soll) out.f.push(`${k}/${i.name}: USD ${ui.bias}, Silber ${i.bias}`); }); });
    return out; }, KARTEN);
  if (!bz.n) F.push('B: keine gespiegelte Zeile mit Bias - Pruefung wirkungslos'); else if (bz.f.length) F.push('B: ' + bz.f.join(' · ')); else OK.push(`B: ${bz.n} gespiegelte Zeilen = Gegenteil von USD`);
  const c = await p.evaluate(() => { const r = getSym().rubrics.find(x => x.name === 'Economic Growth'); const n = r.indicators.map(i => i.name);
    const tr = document.querySelector('#detail tr.ind-china-start'); const td = tr && tr.querySelector('td');
    return { letzte: n.slice(-2), start: tr && tr.dataset.indbase, stil: td ? getComputedStyle(td).borderTopStyle : null, gew: r.indicators.filter(i => /^China /.test(i.name)).map(i => i.gew) }; });
  if (c.letzte.join('|') !== 'China NBS Manufacturing PMI|China Industrial Production' || c.start !== 'China NBS Manufacturing PMI' || c.stil !== 'dashed' || c.gew.join() !== '0.5,0.5') F.push(`C: ${JSON.stringify(c)}`);
  else OK.push('C: China NBS PMI + IP je 0,5 ganz unten, gestrichelte Linie davor');
  const d = await p.evaluate(async () => { const nfp = () => getSym().rubrics.find(x => x.name === 'Labour Market').indicators.find(i => i.name === 'NFP / Employment Change');
    const usd = syms.find(x => x.id === 'USD').rubrics.find(x => x.name === 'Labour Market').indicators.find(i => i.name === 'NFP / Employment Change').bias;
    openAssetCfg(); await new Promise(r => setTimeout(r, 300)); const zeilen = document.querySelectorAll('#assetCfgBody .acfg-indrow').length;
    setAssetIndRule('NFP / Employment Change', 'same'); await new Promise(r => setTimeout(r, 300)); const b1 = nfp().bias;
    setAssetIndRule('NFP / Employment Change', ''); await new Promise(r => setTimeout(r, 300)); const b2 = nfp().bias;
    closeM('mAssetCfg'); return { usd, b1, b2, zeilen }; });
  if (d.usd === 'neu') F.push('D: USD-NFP neutral - Pruefung wirkungslos');
  else if (d.b1 !== d.usd || d.b2 === d.usd || d.zeilen < 20) F.push(`D: USD ${d.usd}, Einzelregel Bullish -> ${d.b1}, zurueck -> ${d.b2}, ${d.zeilen} Zeilen im Menue`);
  else OK.push(`D: Einzelregel NFP Bullish -> ${d.b1} (wie USD), zurueck auf Card -> ${d.b2}; ${d.zeilen} Zeilen im Zahnrad`);
  if (err.length) F.push('JS: ' + err.slice(0, 2).join(' | '));
  await b.close();
  OK.forEach(m => console.log('  ✓ ' + m)); F.forEach(m => console.log('  ✗ ' + m));
  if (GP) { console.log(F.length ? `Gegenprobe ok: ${F.length} Befund(e), wie erwartet rot.` : 'Gegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(F.length ? 0 : 1); }
  console.log(F.length ? `✗ silberregeln: ${F.length} Befund(e)` : 'silberregeln: ok (Silber-Karten invers zu USD, ISM invers, China-Block unten gestrichelt, Einzelregel im Zahnrad)');
  process.exit(F.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
