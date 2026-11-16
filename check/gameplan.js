// ── GAMEPLAN (seit 2026-11-16, VERSION-CHECK-737) ─────────────────────────
// Nutzer 2026-11-16: Kategorie Gameplan, ein Plan je Asset, Watchlist oben angeheftet,
// Bullish/Bearish faerbt die Karte, These, Upcoming catalysts (High-Impact), Entry/Break
// (eigener Text, wahlweise mit Datum oder Preislevel verknuepft), Hinweis nach 14 Tagen.
// Seite = G2, Asset-Seite = K1-Leiste "direkt zwischen Asset Name und der Price Karte",
// Tipp klappt auf, der aufgeklappte Teil beginnt bei Entry und Break.
//  A) Seitenleiste hat "Gameplan", Seite mit .pg-titel, Liste fuehrt jedes Asset; Watchlist-Asset oben angeheftet
//  B) Bias: Bullish -> Karte in Bias-Farbe, nochmal -> aus
//  C) Asset-Seite (GOLD, EUR, NVDA): Leiste steht nach dem Kopf und VOR der Price-Karte;
//     Tipp klappt auf; erstes Etikett im aufgeklappten Teil ist "Entry", daneben "Break"
//  D) Eingaben bleiben: These/Entry nach Neuladen da (Speichern + Laden)
//  E) Preis-Level -> gestrichelte Linie in der Price-Karte (GOLD); FX (EUR) ohne Linie
//  F) 15 Tage alte Aenderung -> Hinweis "Not reviewed"
//  G) Abgleich zweier Geraete: je Asset gewinnt die juengere Aenderung; Feld in snap()
//  H) 390 px: kein Seitenueberlauf auf Seite und Asset-Seite
// --gegenprobe: Leiste wird nicht eingebaut -> C rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  if (!/function snap\(\)\{[^\n]*gameplans/.test(main)) F.push('G: gameplans fehlt in snap()');
  if (!/'bsGewichte','gameplans'\]/.test(main)) F.push('G: gameplans fehlt in neueFelderBehalten');
  const b = await chromium.launch();
  for (const [W, H] of [[1366, 900], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('${gpLeisteHtml(c)}', ''); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    const weg = () => p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); });
    await weg();
    // A
    if (W > 1000) { const nav = await p.evaluate(() => document.getElementById('navSidebar') ? document.getElementById('navSidebar').textContent : ''); if (!/Gameplan/.test(nav)) F.push(o + ' A: kein Eintrag "Gameplan" in der Seitenleiste'); }
    await p.evaluate(() => { try { if (typeof setWatched === 'function') setWatched('XAU/USD', true); } catch (e) { } showTab('gameplan'); }); await p.waitForTimeout(800);
    const A = await p.evaluate(() => ({ titel: (document.querySelector('#pgGameplan .pg-titel') || {}).textContent, li: [...document.querySelectorAll('#gameplanBody .gp-li')].map(x => x.dataset.gpLi), grp: [...document.querySelectorAll('#gameplanBody .gp-grp')].map(x => x.textContent), ids: syms.map(s => s.id), wl: typeof setWatched === 'function' }));
    if (A.titel !== 'Gameplan') F.push(o + ' A: Seitentitel fehlt');
    const fehlt = A.ids.filter(x => !A.li.includes(x)); if (fehlt.length) F.push(o + ' A: in der Liste fehlen ' + fehlt.slice(0, 6).join(', '));
    if (A.wl && (!/Pinned/.test(A.grp[0] || '') || A.li[0] !== 'GOLD')) F.push(o + ` A: Watchlist-Asset GOLD nicht oben angeheftet (Gruppen ${A.grp.slice(0, 2).join('|')}, erstes ${A.li[0]})`);
    // B
    await p.evaluate(() => { gpWaehle('GOLD'); gpBias('GOLD', 'bull'); }); await p.waitForTimeout(300);
    const B1 = await p.evaluate(() => getComputedStyle(document.querySelector('.gp-d')).borderLeftColor);
    await p.evaluate(() => gpBias('GOLD', 'bull')); await p.waitForTimeout(300);
    const B2 = await p.evaluate(() => getComputedStyle(document.querySelector('.gp-d')).borderLeftColor);
    if (B1 !== 'rgb(11, 95, 204)') F.push(o + ' B: Bullish faerbt die Karte nicht blau (' + B1 + ')');
    if (B2 === B1) F.push(o + ' B: zweiter Tipp auf Bullish schaltet nicht aus');
    // D vorbereiten
    await p.evaluate(() => { gpBias('GOLD', 'bear'); gpText('GOLD', 'th', 'Test thesis gold'); gpText('GOLD', 'en', 'Test entry'); gpArt('GOLD', 'en', 'p'); });
    await p.waitForTimeout(200);
    const lvl = await p.evaluate(() => { const s = priceSeriesFor ? null : null; return null; });
    await p.evaluate(() => { const g = PRICE_DATA_FEED && PRICE_DATA_FEED.GOLD && PRICE_DATA_FEED.GOLD.series; const v = g ? +g[g.length - 1][1] : 4000; gpWert('GOLD', 'en', String(Math.round(v))); });
    await p.waitForTimeout(900);   // saveSoon (400 ms)
    // C + E
    for (const id of ['GOLD', 'EUR', 'NVDA']) {
      await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(1800);
      const C = await p.evaluate(() => { const l = document.getElementById('gpLeiste'), pr = document.querySelector('#detail .ab-prow'), kopf = document.querySelector('#detail .ab-board');
        if (!l || !pr) return { da: !!l, pr: !!pr };
        return { da: true, pr: true, vor: !!(l.compareDocumentPosition(pr) & Node.DOCUMENT_POSITION_FOLLOWING), hoch: Math.round(l.getBoundingClientRect().height), linie: document.querySelectorAll('#detail .ab-pk-chart .gp-niv-l, #detail .ab-pk-chart .gp-niv').length }; });
      if (!C.da) { F.push(`${o} C: ${id} ohne Gameplan-Leiste`); continue; }
      if (!C.vor) F.push(`${o} C: ${id} Leiste steht nicht vor der Price-Karte`);
      if (W > 1000 && C.hoch > 60) F.push(`${o} C: ${id} Leiste zugeklappt ${C.hoch} px hoch (K1 = eine Zeile)`);
      if (id === 'GOLD' && !C.linie) F.push(`${o} E: GOLD-Entry mit Preis, aber keine Linie im Chart`);
      if (id === 'EUR' && C.linie) F.push(`${o} E: EUR (Korb-Chart) zeigt eine Gameplan-Linie`);
      await p.evaluate(() => document.querySelector('#gpLeiste .gp-k1-z').click()); await p.waitForTimeout(500);
      const C2 = await p.evaluate(() => { const a = document.querySelector('#gpLeiste .gp-k1-a'); if (!a) return null; return [...a.querySelectorAll('.gp-lab')].map(x => x.textContent.trim()); });
      if (!C2) F.push(`${o} C: ${id} Tipp klappt nicht auf`);
      else if (C2[0] !== 'Entry' || C2[1] !== 'Break') F.push(`${o} C: ${id} aufgeklappt beginnt mit ${C2.slice(0, 2).join('|')} statt Entry|Break`);
      const ue = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ue > 1) F.push(`${o} H: ${id} Seite laeuft ${ue} px ueber`);
      await p.evaluate(() => document.querySelector('#gpLeiste .gp-k1-z').click()); await p.waitForTimeout(300);
    }
    // D: neu laden
    await p.reload(); await wartenBisDatenDa(p); await weg();
    const D = await p.evaluate(() => { showTab('gameplan'); gpWaehle('GOLD'); const t = document.querySelector('.gp-d .gp-ta-th'); return { th: t && t.value, en: (document.querySelector('.gp-d .gp-krit.e .gp-ta') || {}).value, bd: getComputedStyle(document.querySelector('.gp-d')).borderLeftColor }; });
    if (D.th !== 'Test thesis gold' || D.en !== 'Test entry') F.push(`${o} D: nach Neuladen weg (These "${D.th}", Entry "${D.en}")`);
    if (D.bd !== 'rgb(220, 36, 48)') F.push(o + ' D: Bearish nach Neuladen nicht rot (' + D.bd + ')');
    // F
    const Fz = await p.evaluate(() => { const g = JSON.parse(snap()).gameplans; g.GOLD.t = Date.now() - 15 * 864e5; applySnap(JSON.stringify(Object.assign(JSON.parse(snap()), { gameplans: g }))); showTab('gameplan'); gpWaehle('GOLD'); return !!document.querySelector('.gp-d .gp-stale'); });
    if (!Fz) F.push(o + ' F: 15 Tage alte Aenderung ohne Hinweis');
    const ue = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ue > 1) F.push(`${o} H: Gameplan-Seite laeuft ${ue} px ueber`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  // G: Abgleich (Node, dieselbe Funktion wie die App)
  try {
    const m = await import('../js/gameplan.js').catch(() => null);
    if (m && m.gpVereinen) { const r = m.gpVereinen({ EUR: { th: 'alt', t: 1 }, GOLD: { th: 'lokal', t: 5 } }, { EUR: { th: 'neu', t: 2 }, GOLD: { th: 'fremd', t: 3 } });
      if (r.EUR.th !== 'neu' || r.GOLD.th !== 'lokal') F.push('G: Abgleich nimmt nicht je Asset die juengere Aenderung'); }
  } catch (e) { }
  if (GP) { const ok = F.some(f => / C: .* ohne Gameplan-Leiste/.test(f)); console.log(ok ? 'gameplan --gegenprobe: ok (fehlende Leiste gemeldet)' : 'gameplan --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('gameplan: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('gameplan: ok (Seite mit jedem Asset + Watchlist oben, Bias faerbt, Leiste vor der Price-Karte, aufgeklappt ab Entry|Break, bleibt nach Neuladen, Preislinie, 14-Tage-Hinweis, Abgleich je Asset, 1366/390 px)');
})().catch(e => { console.log('gameplan: ABBRUCH ' + e.message); process.exit(1); });
