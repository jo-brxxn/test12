// ── BTC SENTIMENT (seit 2026-11-14, VERSION-CHECK-723) ──────────────────
// Prueft das Vollbild "BTC Sentiment" (js/btc-sentiment.js) mit festen
// Testdaten (check/fixtures/btc_sentiment_test.json - NUR Test, nie in der App):
//  A) Knopf "BTC Sentiment" nur auf der BTC-Seite (nicht bei ETH) und er oeffnet das Fenster
//  B) Score + 12 Indikator-Karten mit Chart, Liquidations als graue Karte "No source";
//     jede Chart-Karte hat "vs BTC price"; Kartentitel 17 px
//  C) Kopfzeile = Datei (MVRV letzter Wert, STH-Kosten); "Collecting since" bei ETF
//  D) Backtest ohne Look-ahead: Signale (MVRV > 90. Perzentil, Abstand 14) =
//     unabhaengige Rechnung hier (Fenster = 365 Tage VOR dem Tag); <20 Signale -> Warnung
//  E) Fadenkreuz: Zeigen auf einen Chart zeigt die Linie in ALLEN Charts mit Daten
//  F) Zeitraum 30D -> sichtbare Spanne ~30 Tage; Zoom-Knopf halbiert
//  G) 390 px: kein Seitenueberlauf, keine Schrift < 11 px im Fenster
//  H) Gewicht aendern -> bsGewichte in snap() (geraeteuebergreifend)
// --gegenprobe: Perzentil MIT dem eigenen Tag (Look-ahead) -> D muss rot werden.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const path = require('path'); const fs = require('fs');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const FIX = path.join(__dirname, 'fixtures', 'btc_sentiment_test.json');
const TAG = 864e5;

// Unabhaengige Referenz fuer D
function referenzSignale() {
  const j = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  const auf = r => { const t0 = Date.parse(r.start + 'T00:00:00Z'); return r.v.map((v, i) => [t0 + i * TAG, v]).filter(e => e[1] != null); };
  const a = auf(j.reihen.mvrv), P = new Map(auf(j.reihen.price));
  const sig = []; let letzt = -Infinity;
  a.forEach(([t, v]) => {
    const vor = a.filter(e => e[0] < t && e[0] >= t - 365 * TAG).map(e => e[1]);
    if (vor.length < 60) return;
    const u = vor.filter(x => x < v).length, g = vor.filter(x => x === v).length;
    const pct = (u + g / 2) / vor.length * 100;
    if (pct > 90 && t - letzt >= 14 * TAG && P.get(t)) { sig.push(t); letzt = t; }
  });
  return { n: sig.length, mvrv: a[a.length - 1][1] };
}

(async () => {
  const REF = referenzSignale();
  const b = await chromium.launch(); const F = [];
  for (const [W, H] of [[1440, 900], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    await ctx.route(/btc_sentiment\.json/, r => r.fulfill({ path: FIX, contentType: 'application/json' }));
    if (GP) await ctx.route(/\/js\/btc-sentiment\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('    if (s.length >= minN) {', '    ein(a[i][1]); if (s.length >= minN) {'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    const geh = async id => { await p.evaluate(id => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(x => { x.style.display = 'none'; }); gotoSym(id); }, id); await p.waitForTimeout(1500); };
    const knopf = () => p.evaluate(() => !![...document.querySelectorAll('#detail .aql')].find(b => b.textContent.trim() === 'BTC Sentiment'));
    await geh('ETH'); if (await knopf()) F.push(o + ' A: Knopf "BTC Sentiment" auch auf der ETH-Seite');
    await geh('BTC'); if (!await knopf()) { F.push(o + ' A: kein Knopf "BTC Sentiment" auf der BTC-Seite'); await ctx.close(); continue; }
    await p.evaluate(() => [...document.querySelectorAll('#detail .aql')].find(b => b.textContent.trim() === 'BTC Sentiment').click());
    await p.waitForTimeout(1500);
    const B = await p.evaluate(() => {
      const k = [...document.querySelectorAll('#mCardInfoBody .bs-karte')];
      return { titel: document.getElementById('mCardInfoTitle').textContent, n: k.length, charts: document.querySelectorAll('#mCardInfoBody .bs-svg').length,
        ohneBtc: k.filter(x => x.querySelector('.bs-chart') && !x.querySelector('[data-bs="btc"]')).map(x => x.dataset.k),
        liq: (k.find(x => x.classList.contains('bs-aus')) || { textContent: '' }).textContent,
        kt: [...new Set(k.map(x => getComputedStyle(x.querySelector('.bs-titel')).fontSize))],
        mvrv: (document.querySelector('.bs-karte[data-k="mvrv"] .bs-wert') || {}).textContent,
        sth: (document.querySelector('.bs-karte[data-k="sth_prem"] .bs-zus') || {}).textContent,
        etfBadge: (document.querySelector('.bs-karte[data-k="etf"] .bs-badge') || {}).textContent || '' };
    });
    if (B.titel !== 'BTC Sentiment') F.push(o + ' A: Fenstertitel "' + B.titel + '"');
    if (B.n !== 14 || B.charts !== 13) F.push(`${o} B: ${B.n} Karten / ${B.charts} Charts (erwartet 14 / 13)`);
    if (B.ohneBtc.length) F.push(o + ' B: ohne "vs BTC price": ' + B.ohneBtc.join(', '));
    if (!/No source/.test(B.liq)) F.push(o + ' B: Liquidations nicht als "No source" markiert');
    if (B.kt.length !== 1 || B.kt[0] !== '17px') F.push(o + ' B: Kartentitel ' + B.kt.join(','));
    if (B.mvrv !== REF.mvrv.toFixed(2)) F.push(`${o} C: MVRV-Kopf ${B.mvrv}, Datei ${REF.mvrv.toFixed(2)}`);
    if (!/STH cost \$[\d,]+/.test(B.sth || '')) F.push(o + ' C: STH-Kosten fehlen im Kopf (' + B.sth + ')');
    if (!/^Collecting since/.test(B.etfBadge)) F.push(o + ' C: ETF ohne "Collecting since" (' + B.etfBadge + ')');
    // D) Backtest
    await p.evaluate(() => document.querySelector('[data-bs="btauf"][data-k="mvrv"]').click()); await p.waitForTimeout(300);
    const D = await p.evaluate(() => { const t = document.querySelector('.bs-karte[data-k="mvrv"] .bs-bt'); const m = t && t.textContent.match(/Signals \((\d+)\)/);
      return { n: m ? +m[1] : null, fenster: /Backtest window/.test(t ? t.textContent : ''), marker: document.querySelectorAll('.bs-chart[data-k="mvrv"] path[fill="var(--t1)"]').length }; });
    if (D.n !== REF.n) F.push(`${o} D: ${D.n} Signale, unabhaengig gerechnet ${REF.n} (Perzentil nur aus den 365 Tagen davor)`);
    if (!D.fenster) F.push(o + ' D: Backtest-Zeitraum nicht angezeigt');
    if (!(D.marker > 0)) F.push(o + ' D: keine Signal-Marker im Chart');
    // weniger als 20 Signale -> Warnung
    await p.evaluate(() => { const i = document.querySelector('[data-bs="bt"][data-f="abstand"][data-k="mvrv"]'); i.value = '400'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
    const warn = await p.evaluate(() => !!document.querySelector('.bs-karte[data-k="mvrv"] .bs-warn'));
    if (!warn) F.push(o + ' D: keine Warnung bei < 20 Signalen');
    // E) Fadenkreuz
    await p.evaluate(() => document.querySelector('.bs-chart[data-k="funding"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    const bx = await p.locator('.bs-chart[data-k="funding"]').boundingBox();
    await p.mouse.move(bx.x + bx.width * 0.7, bx.y + bx.height / 2); await p.waitForTimeout(250);
    const E = await p.evaluate(() => { const k = [...document.querySelectorAll('.bs-chart')].filter(c => c.querySelector('.bs-kreuz'));
      return { sichtbar: k.filter(c => c.querySelector('.bs-kreuz').style.display !== 'none').length, alle: k.length, rd: (document.querySelector('.bs-read[data-k="mvrv"]') || {}).textContent || '' }; });
    if (E.sichtbar < E.alle - 4) F.push(`${o} E: Fadenkreuz nur in ${E.sichtbar} von ${E.alle} Charts`);
    if (!/BTC \$/.test(E.rd)) F.push(o + ' E: Wert-Anzeige ohne BTC-Preis (' + E.rd + ')');
    // F) Zeitraum + Zoom
    await p.evaluate(() => document.querySelector('[data-bs="bereich"][data-w="30D"]').click()); await p.waitForTimeout(200);
    const s30 = await p.evaluate(() => { const m = document.querySelector('.bs-chart[data-k="mvrv"]').__m; return (m.bis - m.von) / 864e5; });
    await p.evaluate(() => document.querySelector('[data-bs="zoom"][data-w="2"]').click()); await p.waitForTimeout(200);
    const s60 = await p.evaluate(() => { const m = document.querySelector('.bs-chart[data-k="mvrv"]').__m; return (m.bis - m.von) / 864e5; });
    if (Math.abs(s30 - 30) > 1) F.push(o + ' F: 30D zeigt ' + s30.toFixed(1) + ' Tage');
    if (Math.abs(s60 - 60) > 1) F.push(o + ' F: Herauszoomen von 30 Tagen ergibt ' + s60.toFixed(1) + ' Tage (erwartet 60)');
    // G) Ueberlauf + Mindestschrift
    const G = await p.evaluate(() => { const b = document.getElementById('mCardInfoBody'); const klein = [...b.querySelectorAll('*')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11).map(e => e.tagName + ':' + e.textContent.trim().slice(0, 20));
      return { ueber: document.documentElement.scrollWidth - innerWidth, kartenUeber: [...b.querySelectorAll('.bs-karte')].filter(k => k.scrollWidth > k.clientWidth + 1).map(k => k.dataset.k), klein }; });
    if (G.ueber > 1) F.push(o + ' G: Seite laeuft ' + G.ueber + ' px ueber');
    if (G.kartenUeber.length) F.push(o + ' G: Karten laufen ueber: ' + G.kartenUeber.join(', '));
    if (G.klein.length) F.push(o + ' G: Schrift < 11 px: ' + G.klein.slice(0, 5).join(', '));
    // H) Gewicht -> snap
    await p.evaluate(() => { const s = document.querySelector('[data-bs="gewicht"][data-k="mvrv"]'); s.value = '2'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(200);
    const Hh = await p.evaluate(() => { try { return JSON.parse(snap()).bsGewichte; } catch (e) { return 'snap: ' + e.message; } });
    if (!Hh || Hh.mvrv !== 2) F.push(o + ' H: Gewicht nicht in snap() (' + JSON.stringify(Hh) + ')');
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / D: \d+ Signale/.test(f)); console.log(ok ? 'btcsentiment --gegenprobe: ok (Look-ahead gemeldet)' : 'btcsentiment --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('btcsentiment: ' + F.length + ' Befund(e)\n  ' + F.slice(0, 30).join('\n  ')); process.exit(1); }
  console.log(`btcsentiment: ok (Knopf nur BTC, 13 Charts mit vs BTC, Kopf = Datei, Backtest ${REF.n} Signale ohne Look-ahead + Warnung < 20, Fadenkreuz in allen Charts, 30D/Zoom, 390 px, Gewicht in snap())`);
})().catch(e => { console.log('btcsentiment: ABBRUCH ' + e.message); process.exit(1); });
