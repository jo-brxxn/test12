// ── SET-UPS: FILTERLEISTE (seit 2026-11-15, VERSION-CHECK-730) ────────────────
// Nutzer 2026-11-15 (Foto der Leiste "Filter by currency ... All FX Non-FX Yields", All UND
// Non-FX schwarz): "Einmal fehlt da Stocks also jede neue Asset Kategorie muss da drinne sein
// und generell muessen da alle Assets angezeigt werden die die Webseite hat wenn all
// ausgewaehlt ist. Und wenn aber nur fx oder yields ausgewaehlt ist dann kann nicht auch all
// in schwarz sein all zeigt immer alles und kann so nur alleine an sein".
//  A) Jede Asset-Klasse, die es in syms gibt (ausser fx), hat einen Gruppen-Chip
//  B) All: jedes Nicht-FX-Asset steht als Zeile da (alle syms ausser den 8 Waehrungen)
//  C) Genau EIN Gruppen-Chip ist an: nach FX / Non-FX / jeder Klasse ist All aus; All
//     wieder an schaltet alle anderen aus
//  D) Klasse Stocks zeigt nur Aktien, alle 13
//  E) Gemerkt: setupKlasse im Cloud-Push, -Pull und Import
//  F) 390 px: kein Seitenueberlauf
// --gegenprobe: All-Zustand wie vorher (nur an den Waehrungs-Chips) -> C rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const push = (main.match(/async function cloudPush[\s\S]*?\n}\n/) || [''])[0];
  if (!/data\.setupKlasse=setupKlasse/.test(push)) F.push('E: setupKlasse nicht im Cloud-Push');
  if (!/cd\.setupKlasse!==undefined/.test(main)) F.push('E: setupKlasse nicht im Cloud-Pull');
  if (!/_imp\.setupKlasse/.test(main)) F.push('E: setupKlasse nicht im Import');
  const b = await chromium.launch();
  for (const [W, H] of [[1366, 1024], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('const alleAn=!active&&!setupFxOnly&&!setupNonFxOnly&&!setupKlasse;', 'const alleAn=!active;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); ['fxpro_setup_ccy', 'fxpro_setup_fxonly', 'fxpro_setup_nonfxonly', 'fxpro_setup_yieldsonly', 'fxpro_setup_klasse'].forEach(k => localStorage.removeItem(k)); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); showTab('pairs'); });
    await p.waitForTimeout(1500);
    const lies = () => p.evaluate(() => {
      const q = [...document.querySelectorAll('.cmp-filter .cmp-quick')];
      const zeilen = new Set([...document.querySelectorAll('#pairCats [onclick*="gotoSym("], #pairCats [data-id]')].map(e => { const m = (e.getAttribute('onclick') || '').match(/gotoSym\('([^']+)'/); return m ? m[1] : e.dataset.id; }).filter(Boolean));
      return { chips: q.map(x => x.textContent.trim()), an: q.filter(x => x.classList.contains('on')).map(x => x.textContent.trim()),
        klassen: [...new Set(syms.map(s => assetCls(s.id)).filter(k => k && k !== 'fx'))],
        nonFx: syms.filter(s => assetCls(s.id) !== 'fx').map(s => s.id), sichtbar: [...zeilen].filter(id => syms.some(s => s.id === id)),
        kls: Object.fromEntries(syms.map(s => [s.id, assetCls(s.id)])), ueber: document.documentElement.scrollWidth - innerWidth };
    });
    const klick = async t => { await p.evaluate(t => { const b = [...document.querySelectorAll('.cmp-filter .cmp-quick')].find(x => x.textContent.trim() === t); if (b) b.click(); }, t); await p.waitForTimeout(400); };
    let L = await lies();
    // A
    const labelVon = { crypto: 'Crypto', metal: 'Metals', energy: 'Energy', index: 'Indices', stock: 'Stocks', yield: 'Yields' };
    L.klassen.forEach(k => { const l = labelVon[k] || (k.charAt(0).toUpperCase() + k.slice(1)); if (!L.chips.includes(l)) F.push(`${o} A: kein Chip fuer die Klasse ${k} (${l}); Chips: ${L.chips.join('|')}`); });
    // B
    if (L.an.join('|') !== 'All') F.push(`${o} B: beim Start an: ${L.an.join('|')} (erwartet nur All)`);
    const fehlen = L.nonFx.filter(id => !L.sichtbar.includes(id));
    if (fehlen.length) F.push(`${o} B: bei All fehlen ${fehlen.length} Assets: ${fehlen.slice(0, 8).join(', ')}`);
    // C
    for (const t of L.chips.filter(c => c !== 'All')) {
      await klick(t); const x = await lies();
      if (x.an.length !== 1 || x.an[0] !== t) F.push(`${o} C: nach "${t}" an: ${x.an.join('|')} (erwartet nur ${t})`);
      await klick('All'); const y = await lies();
      if (y.an.join('|') !== 'All') F.push(`${o} C: nach All an: ${y.an.join('|')}`);
    }
    // D
    await klick('Stocks'); const D = await lies();
    const st = D.sichtbar.filter(id => D.kls[id] === 'stock'), fremd = D.sichtbar.filter(id => D.kls[id] !== 'stock');
    if (st.length !== 13) F.push(`${o} D: Stocks zeigt ${st.length} Aktien (erwartet 13)`);
    if (fremd.length) F.push(`${o} D: Stocks zeigt auch ${fremd.slice(0, 5).join(', ')}`);
    await klick('All');
    if (L.ueber > 1) F.push(`${o} F: Seite laeuft ${L.ueber} px ueber`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / C: nach "/.test(f)); console.log(ok ? 'setupfilter --gegenprobe: ok (All + Gruppe gleichzeitig gemeldet)' : 'setupfilter --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('setupfilter: ' + F.length + ' Befund(e)\n  ' + F.slice(0, 30).join('\n  ')); process.exit(1); }
  console.log('setupfilter: ok (Chip je Asset-Klasse aus SB_CATS, All zeigt jedes Asset, immer nur ein Gruppen-Chip an, Stocks = 13 Aktien, synchronisiert)');
})().catch(e => { console.log('setupfilter: ABBRUCH ' + e.message); process.exit(1); });
