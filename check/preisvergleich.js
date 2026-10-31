// ══ WAECHTER: PREISVERGLEICH (Data · Prices) + CONTEXT-CHARTS ═══════════════
//
// Nutzer 2026-10-31: "Ich will das man in data auch die ganzen preischarts von
// den ganzen Assets vergleichen kann" - "ich will dort alles haben wovon es
// Preisdaten gibt und wenn was irgendwann hinzukommt soll es auch da
// hinzukommen und das gilt auch fuer in Assets ganz unten bei den Charts".
// Darstellung: "der tiefste Kurs von cad genau so weit unten im Chart ... wie
// der Kurs von Oel und umgekehrt und das gilt auch fuer den Peek".
//
// Geprueft:
//   A) VOLLSTAENDIG + WAECHST MIT: Data-Katalog und Context-Picker enthalten
//      jeden Kurs-Feed (auch ohne eigenes Asset), jedes Asset mit Kursreihe,
//      alle 28 FX-Paare, 2Y/10Y je Waehrung, VIX. Ein zur Laufzeit neu
//      hinzugefuegter Kurs-Feed taucht in BEIDEN ohne Codeaenderung auf.
//   B) TIEF UNTEN, HOCH OBEN: in 3M und 1Y liegt jedes Linientief exakt auf
//      der Nulllinie und jedes Hoch exakt auf der 100er-Linie.
//   C) ECHTE WERTE: der Hover am letzten Tag zeigt je Linie den echten letzten
//      Schluss, die Legende Tief und Hoch des Zeitraums.
//   D) PAARE RICHTIG GERECHNET: EUR/USD = EUR in USD, USD/JPY = 1 / JPY in USD,
//      EUR/JPY = EUR/USD x USD/JPY (gleicher Tag).
// Gegenproben (muessen ROT werden):
//   --gegenprobe          alle Linien auf eine gemeinsame Skala (wie vorher Basis 100) -> B rot
//   --gegenprobe-katalog  FX-Paare fehlen im Katalog                               -> A rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_K = process.argv.includes('--gegenprobe-katalog');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const M_SKALA = 'const yOf=(x,v)=>T+(1-(x.hi>x.lo?(v-x.lo)/(x.hi-x.lo):0.5))*ph;';
const M_KAT = "add('FX pairs',FX_PAIRS.map(p=>({k:'pair:'+p,t:p})));";

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if ((GP && !MAIN.includes(M_SKALA)) || (GP_K && !MAIN.includes(M_KAT))) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  let main = MAIN;
  // Gemeinsame Skala ueber alle Linien: v relativ zum kleinsten Tief / groessten Hoch aller Linien.
  if (GP) main = main.replace(M_SKALA, 'const _gLo=Math.min(...mit.map(z=>z.lo)),_gHi=Math.max(...mit.map(z=>z.hi));const yOf=(x,v)=>T+(1-(v-_gLo)/((_gHi-_gLo)||1))*ph;');
  if (GP_K) main = main.replace(M_KAT, '');
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  if (GP || GP_K) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
  const p = await ctx.newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));

  // ── A) Vollstaendig + waechst mit ──
  console.log('A) Alles mit Kursdaten ist waehlbar, Neues kommt von selbst dazu');
  const a = await p.evaluate(async () => {
    const warte = ms => new Promise(r => setTimeout(r, ms));
    const dataKeys = async () => { showTab('data'); setDataMode('preis'); closeDataPreisPicker(); openDataPreisPicker(); await warte(150); const k = [...document.querySelectorAll('#dataPreisPicker .cmp-chip')].map(c => (c.getAttribute('onclick').match(/toggleDataPreis\('([^']+)'\)/) || [])[1]); closeDataPreisPicker(); return k; };
    const ctxKeys = async () => { gotoSym('USD'); openKontextSettings('USD'); await warte(150); const k = [...document.querySelectorAll('#mCardInfoBody select.ksel')[0].options].map(o => o.value); closeM('mCardInfo'); return k; };
    const soll = [];
    Object.keys(PRICE_DATA_FEED || {}).forEach(k => soll.push('p:' + k));
    FX_PAIRS.forEach(x => soll.push('pair:' + x));
    ['USD', 'EUR', 'GBP', 'JPY'].forEach(c => { soll.push('b2:' + c); soll.push('b10:' + c); });
    soll.push('vix');
    const d = await dataKeys(), c = await ctxKeys();
    const fehltD = soll.filter(k => !d.includes(k)), fehltC = soll.filter(k => !c.includes(k));
    // Neuer Kurs-Feed zur Laufzeit (ohne Asset, ohne Codeaenderung)
    const quelle = PRICE_DATA_FEED.GOLD.series;
    PRICE_DATA_FEED.WAECHTERX = { source: 'test', invert: false, series: quelle.map(e => [e[0], e[1] * 2]) };
    const d2 = await dataKeys(), c2 = await ctxKeys();
    delete PRICE_DATA_FEED.WAECHTERX;
    return { n: soll.length, dn: d.length, cn: c.length, fehltD, fehltC, neuD: d2.includes('p:WAECHTERX'), neuC: c2.includes('p:WAECHTERX') };
  });
  if (a.fehltD.length) rot(`Data fehlt ${a.fehltD.length}: ${a.fehltD.slice(0, 6).join(', ')}`); else gruen(`Data: alle ${a.n} Pflicht-Reihen waehlbar (${a.dn} insgesamt)`);
  if (a.fehltC.length) rot(`Context-Picker fehlt ${a.fehltC.length}: ${a.fehltC.slice(0, 6).join(', ')}`); else gruen(`Context-Picker: alle ${a.n} Pflicht-Reihen waehlbar (${a.cn} Optionen)`);
  if (!a.neuD || !a.neuC) rot(`neuer Kurs-Feed taucht nicht von selbst auf (Data ${a.neuD}, Context ${a.neuC})`); else gruen('neuer Kurs-Feed erscheint in Data und Context-Picker ohne Codeaenderung');

  // ── B/C) Tief unten, Hoch oben, echte Werte ──
  console.log('B/C) Jede Linie von ihrem Tief bis zu ihrem Hoch, echte Werte');
  for (const R of [3, 12]) {
    const r = await p.evaluate(async R => {
      const warte = ms => new Promise(r => setTimeout(r, ms));
      showTab('data'); setDataMode('preis');
      dataPreisListe.length = 0; ['p:CAD', 'p:OIL', 'pair:EUR/USD', 'b10:USD', 'p:BTC'].forEach(k => dataPreisListe.push(k));
      setDataRange(R); await warte(400);
      const svg = document.querySelector('.pv-svg'); if (!svg) return { fehler: 'kein Chart' };
      const ylin = [...svg.querySelectorAll('line')].map(l => +l.getAttribute('y1'));
      const unten = Math.max(...ylin), oben = Math.min(...ylin);
      const linien = [...svg.querySelectorAll('polyline')].map(pl => { const ys = pl.getAttribute('points').split(' ').map(q => +q.split(',')[1]); return { min: Math.min(...ys), max: Math.max(...ys) }; });
      // Hover am rechten Rand
      const w = document.querySelector('.data-pc .chv'); const pts = window._chvReg ? null : null;
      const leg = [...document.querySelectorAll('.pv-i')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
      // echte letzte Schluesse
      const von = rangeCutoffStr(R);
      const letzte = dataPreisListe.map(k => { const q = abKontextReihe(k, 'USD'); const we = kerzenWochenendeErlaubt(q.quelle); const r = (q.reihe || []).filter(e => String(e[0]).slice(0, 10) >= von && (we || !istWochenende(String(e[0]).slice(0, 10)))); return r.length ? +r[r.length - 1][1] : null; });
      return { unten, oben, linien, leg, letzte };
    }, R);
    if (r.fehler) { rot(`${R}M: ${r.fehler}`); continue; }
    const schief = r.linien.filter(l => Math.abs(l.min - r.oben) > 0.6 || Math.abs(l.max - r.unten) > 0.6);
    if (r.linien.length !== 5) rot(`${R}M: ${r.linien.length} Linien statt 5`);
    else if (schief.length) rot(`${R}M: ${schief.length} von 5 Linien reichen nicht von der Null- bis zur 100er-Linie (${schief.map(l => l.min.toFixed(0) + '…' + l.max.toFixed(0)).join(', ')}; Raster ${r.oben.toFixed(0)}…${r.unten.toFixed(0)})`);
    else gruen(`${R}M: alle 5 Linien exakt von Tief (unten) bis Hoch (oben)`);
    if (r.leg.length !== 5 || r.leg.some(t => !/range/.test(t))) rot(`${R}M: Legende ohne echte Spanne: ${r.leg.join(' | ')}`);
  }
  // Hover: letzter Tag zeigt die echten letzten Schluesse
  const h = await p.evaluate(() => {
    const w = document.querySelector('.data-pc .chv'); if (!w || !w._chvShowAt) return { fehler: 'kein Hover' };
    w._chvShowAt(1); const tip = w.querySelector('.chv-tip'); const t = tip ? tip.textContent : '';
    const von = rangeCutoffStr(12);
    // Wie jeder Kurs-Chart der App: Wochenend-Zeilen nur bei Krypto (ohneWochenende).
    const soll = dataPreisListe.map(k => { const q = abKontextReihe(k, 'USD'); const we = kerzenWochenendeErlaubt(q.quelle); const r = (q.reihe || []).filter(e => we || !istWochenende(String(e[0]).slice(0, 10))); const v = +r[r.length - 1][1]; return preisWert(v, q.einheit || ''); });
    return { t, soll };
  });
  if (h.fehler) rot(h.fehler);
  else { const fehlt = h.soll.filter(v => !h.t.includes(v)); if (fehlt.length) rot(`Hover am letzten Tag zeigt nicht den echten Schluss: fehlt ${fehlt.join(', ')} in "${h.t.slice(0, 120)}"`); else gruen('Hover am letzten Tag = echte letzte Schluesse aller Linien'); }

  // ── D) Paare ──
  console.log('D) Paare aus denselben Schlusskursen');
  const d = await p.evaluate(() => {
    const letzt = r => r[r.length - 1];
    const eu = preisPaarReihe('EUR/USD'), uj = preisPaarReihe('USD/JPY'), ej = preisPaarReihe('EUR/JPY');
    const eur = new Map((priceSeriesFor('EUR') || []).map(e => [String(e[0]).slice(0, 10), +e[1]]));
    const jpy = new Map((priceSeriesFor('JPY') || []).map(e => [String(e[0]).slice(0, 10), +e[1]]));
    const [d1, v1] = letzt(eu), [d2, v2] = letzt(uj);
    const um = new Map(uj.map(e => [e[0], e[1]])), em = new Map(eu.map(e => [e[0], e[1]]));
    const [d3, v3] = letzt(ej);
    return { eu: [v1, eur.get(d1)], uj: [v2, jpy.get(d2) ? 1 / jpy.get(d2) : null], ej: [v3, em.get(d3) * um.get(d3)], n: FX_PAIRS.filter(x => (preisPaarReihe(x) || []).length > 100).length };
  });
  const nah = (a, b) => a != null && b != null && Math.abs(a / b - 1) < 1e-5;
  if (!nah(d.eu[0], d.eu[1])) rot(`EUR/USD ${d.eu[0]} statt ${d.eu[1]}`); else gruen(`EUR/USD = EUR in USD (${d.eu[0]})`);
  if (!nah(d.uj[0], d.uj[1])) rot(`USD/JPY ${d.uj[0]} statt ${d.uj[1]}`); else gruen(`USD/JPY = 1 / JPY in USD (${d.uj[0]})`);
  if (!nah(d.ej[0], d.ej[1])) rot(`EUR/JPY ${d.ej[0]} statt EUR/USD x USD/JPY ${d.ej[1]}`); else gruen(`EUR/JPY = EUR/USD x USD/JPY (${d.ej[0]})`);
  if (d.n !== 28) rot(`nur ${d.n} von 28 Paaren mit Historie`); else gruen('alle 28 Paare mit Historie');

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  const gp = GP || GP_K;
  if (gp) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ preisvergleich: ${fehler} Befund(e)` : '\n✓ preisvergleich: alles waehlbar, Tief unten/Hoch oben, echte Werte, Paare richtig');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
