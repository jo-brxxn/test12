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
// Zweite Runde (Nutzer 2026-10-31: "einheitliche skala ... an einer Stelle
// die Skalierung aendert und auf eine andere umspringt", "One chart | Side by
// side", Kerzen "einmal ein Chart mit Blue bias Farbe dann der andere mit
// schwarz bias Farbe", "compare all ... plus ... Filter ... im Filter nochmal
// Filter"):
//   E) COMMON = ACHSENBRUCH: OIL+CAD (Spannen ueberlappen) teilen ein Band,
//      GOLD bekommt ein eigenes, dazwischen genau ein Bruch. Je Linie ergibt
//      die Achsenbeschriftung ihres Bandes am Linien-Hoch/-Tief den echten
//      Hoechst-/Tiefstkurs (echte Preise, gleiche Skala im Band).
//   F) KERZEN-FARBEN: in EINEM Chart Kurs 1 --cndl-up (blau), Kurs 2
//      --cndl-dn (schwarz), Kurs 3 eine eigene Farbe; steigt = hohl, faellt =
//      gefuellt. Side by side: normale Kerzenfarben (steigt blau, faellt
//      schwarz, gefuellt).
//   G) SIDE BY SIDE: je Kurs ein Panel mit eigenem Chart, jede Linie von
//      ihrem Tief bis zu ihrem Hoch (eigene Skala).
//   A2) PAARE A-Z (Nutzer 2026-10-31: "die fx Paare im Filter muessen besser
//      sortiert sein nach Alphabet"): Data-Prices-Fenster, Compare all
//      (Basiswaehrungen und Paare) und die Paar-Liste unter Trends.
//   H) COMPARE ALL (echte Klicks): Gruppe -> Asset -> Chart, jeder Tipp ein
//      Panel, bei 8 schliesst das Fenster, ✕ entfernt; ein zur Laufzeit neuer
//      Kurs-Feed steht ohne Codeaenderung in seiner Gruppe; bei 390 px stehen
//      beide Auswahlfenster ganz im Bild (pickerAnkern, gemessen left -30).
// Gegenproben (muessen ROT werden):
//   --gegenprobe          alle Linien auf eine gemeinsame Skala (wie vorher Basis 100) -> B rot
//   --gegenprobe-katalog  FX-Paare fehlen im Katalog                               -> A rot
//   --gegenprobe-bruch    Common zeichnet wie Low -> high (kein Bruch, 0-100)      -> E rot
//   --gegenprobe-farben   steigende Kerzen gefuellt statt hohl                     -> F rot
//   --gegenprobe-anker    Auswahlfenster ohne Begrenzung am linken Rand            -> H rot
//   --gegenprobe-az       Paare wieder in Marktreihenfolge                         -> A2 rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_K = process.argv.includes('--gegenprobe-katalog');
const GP_B = process.argv.includes('--gegenprobe-bruch');
const GP_F = process.argv.includes('--gegenprobe-farben');
const GP_A = process.argv.includes('--gegenprobe-anker');
const GP_AZ = process.argv.includes('--gegenprobe-az');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const M_SKALA = '    yOf=(x,v)=>T+(1-(x.hi>x.lo?(v-x.lo)/(x.hi-x.lo):0.5))*ph;';
const M_BRUCH = "  if(skala==='band'){\n    yOf=";
const M_FARBE = "fill=\"${bias||!auf?farbe:'none'}\"";
const M_AZ = 'const FX_PAIRS_AZ=FX_PAIRS.slice().sort();';
const M_ANKER = "Math.min(Math.round(window.innerWidth-r.right),Math.round(window.innerWidth-breit-8))";
const M_KAT = "add('FX pairs',FX_PAIRS.map(p=>({k:'pair:'+p,t:p})));";

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if ((GP && !MAIN.includes(M_SKALA)) || (GP_K && !MAIN.includes(M_KAT)) || (GP_B && !MAIN.includes(M_BRUCH)) || (GP_F && !MAIN.includes(M_FARBE)) || (GP_A && !MAIN.includes(M_ANKER)) || (GP_AZ && !MAIN.includes(M_AZ))) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  let main = MAIN;
  // Gemeinsame Skala ueber alle Linien: v relativ zum kleinsten Tief / groessten Hoch aller Linien.
  if (GP) main = main.replace(M_SKALA, '    const _gLo=Math.min(...mit.map(z=>z.lo)),_gHi=Math.max(...mit.map(z=>z.hi));yOf=(x,v)=>T+(1-(v-_gLo)/((_gHi-_gLo)||1))*ph;');
  if (GP_K) main = main.replace(M_KAT, '');
  if (GP_B) main = main.replace(M_BRUCH, "  if(skala==='band'||skala==='bruch'){\n    yOf=");
  if (GP_F) main = main.replace(M_FARBE, 'fill="${farbe}"');
  if (GP_A) main = main.replace(M_ANKER, 'Math.round(window.innerWidth-r.right)');
  if (GP_AZ) main = main.replace(M_AZ, 'const FX_PAIRS_AZ=FX_PAIRS.slice();');
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  const gpAn = GP || GP_K || GP_B || GP_F || GP_A || GP_AZ;
  if (gpAn) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
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

  // ── A2) Paare A-Z in jedem Filter ──
  console.log('A2) FX-Paare in den Filtern von A bis Z');
  const az = await p.evaluate(async () => {
    const warte = ms => new Promise(r => setTimeout(r, ms));
    const sortiert = l => l.length > 1 && l.every((x, i) => !i || l[i - 1].localeCompare(x) <= 0);
    showTab('data'); setDataMode('preis'); closeDataPreisPicker(); openDataPreisPicker(); await warte(150);
    const grp = [...document.querySelectorAll('#dataPreisPicker .data-picker-grp')].find(g => /FX pairs/i.test((g.querySelector('.cmp-filter-lbl') || {}).textContent || ''));
    const prices = grp ? [...grp.querySelectorAll('.cmp-chip')].map(c => c.textContent.trim()) : [];
    closeDataPreisPicker();
    const items = dataAlleItems('PAIRS');
    const basen = items.map(g => g.name), paare = items.flatMap(g => g.l.map(x => x.t));
    // die Paar-Liste wird erst im Paar-Modus (Knopf "Pair") befuellt
    showTab('trends'); await warte(300); document.getElementById('trendsPairBtn').click(); await warte(400);
    const og = document.querySelector('#trendsPairSel optgroup[label="FX Pairs"]');
    const trends = og ? [...og.querySelectorAll('option')].map(o => o.value) : [];
    setTrendsFilter('ALL');
    return { prices: [prices.length, sortiert(prices), prices.slice(0, 4)], basen: [basen.length, sortiert(basen), basen], paare: [paare.length, sortiert(paare), paare.slice(0, 4)], trends: [trends.length, sortiert(trends), trends.slice(0, 4)] };
  });
  for (const [wo, [n, ok, bsp]] of Object.entries({ 'Data Prices': az.prices, 'Compare all Basiswaehrungen': az.basen, 'Compare all Paare': az.paare, 'Trends': az.trends })) {
    if (!ok) rot(`A2: ${wo}: ${n} Eintraege, nicht A-Z (${bsp.join(', ')} …)`); else gruen(`A2: ${wo}: ${n} Eintraege A-Z (${bsp.slice(0, 3).join(', ')} …)`);
  }

  // ── B/C) Tief unten, Hoch oben, echte Werte ──
  console.log('B/C) Jede Linie von ihrem Tief bis zu ihrem Hoch, echte Werte');
  for (const R of [3, 12]) {
    const r = await p.evaluate(async R => {
      const warte = ms => new Promise(r => setTimeout(r, ms));
      showTab('data'); setDataMode('preis'); setPxChartTyp('line'); setDataPreisAnsicht('eins'); setDataPreisSkala('band');
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

  // ── E) Common = Achsenbruch mit echten Preisen ──
  console.log('E) Common: aehnliche Niveaus teilen ein Band, dazwischen ein Bruch, echte Preise');
  const e = await p.evaluate(async () => {
    const warte = ms => new Promise(r => setTimeout(r, ms));
    showTab('data'); setDataMode('preis'); setPxChartTyp('line'); setDataPreisAnsicht('eins');
    dataPreisListe.length = 0; ['p:OIL', 'p:CAD', 'p:GOLD'].forEach(k => dataPreisListe.push(k));
    setDataPreisSkala('bruch'); setDataRange(3); await warte(400);
    const svg = document.querySelector('#dataBody .pv-svg'); if (!svg) return { fehler: 'kein Chart' };
    const brueche = [...svg.querySelectorAll('.pv-bruch')].map(l => +l.getAttribute('y1'));
    const L = Math.min(...[...svg.querySelectorAll('line')].map(l => +l.getAttribute('x1')));
    const ticks = [...svg.querySelectorAll('text')].filter(t => t.getAttribute('text-anchor') === 'end' && Math.abs(+t.getAttribute('x') - (L - 7)) < 0.6)
      .map(t => ({ y: +t.getAttribute('y') - 4, v: parseFloat(t.textContent.replace(/[^0-9.\-]/g, '')) })).filter(t => isFinite(t.v));
    const von = rangeCutoffStr(3);
    const linien = [...svg.querySelectorAll('polyline.pv-linie')].map(pl => {
      const k = pl.getAttribute('data-k'), ys = pl.getAttribute('points').split(' ').map(q => +q.split(',')[1]);
      const q = abKontextReihe(k, 'USD'), we = kerzenWochenendeErlaubt(q.quelle);
      const c = (q.reihe || []).filter(x => String(x[0]).slice(0, 10) >= von && (we || !istWochenende(String(x[0]).slice(0, 10)))).map(x => +x[1]);
      return { k, yMin: Math.min(...ys), yMax: Math.max(...ys), lo: Math.min(...c), hi: Math.max(...c) };
    });
    return { brueche, ticks, linien };
  });
  if (e.fehler) rot('E: ' + e.fehler);
  else {
    const bandVon = y => e.brueche.filter(b => b < y).length;   // 0 = oberstes Band
    const band = {}; e.linien.forEach(l => { band[l.k] = bandVon((l.yMin + l.yMax) / 2); });
    if (e.brueche.length !== 1) rot(`E: ${e.brueche.length} Brueche statt 1 (OIL+CAD ein Band, GOLD ein eigenes)`);
    else if (band['p:OIL'] !== band['p:CAD'] || band['p:GOLD'] === band['p:OIL']) rot(`E: Baender falsch: ${JSON.stringify(band)}`);
    else gruen('E: OIL + CAD teilen ein Band, GOLD eigenes Band, genau ein Bruch dazwischen');
    // Achsenbeschriftung des Bandes -> Wert am Linien-Hoch/-Tief
    e.linien.forEach(l => {
      const t = e.ticks.filter(x => bandVon(x.y) === band[l.k]).sort((a, b) => a.y - b.y);
      if (t.length < 2) { rot(`E: ${l.k}: Band ohne Preis-Achse (${t.length} Beschriftung)`); return; }
      const a = t[0], z = t[t.length - 1], wert = y => a.v + (y - a.y) * (z.v - a.v) / (z.y - a.y);
      const hoch = wert(l.yMin), tief = wert(l.yMax), tol = Math.max(Math.abs(z.v - a.v) * 0.02, 1e-9);
      if (Math.abs(hoch - l.hi) > tol || Math.abs(tief - l.lo) > tol) rot(`E: ${l.k}: Achse zeigt ${tief.toFixed(2)}…${hoch.toFixed(2)}, echt ${l.lo}…${l.hi}`);
      else gruen(`E: ${l.k}: Achse = echte Preise (${l.lo} … ${l.hi})`);
    });
  }

  // ── F) Kerzenfarben ──
  console.log('F) Kerzen: Kurs 1 blau, Kurs 2 schwarz, steigt hohl / faellt gefuellt; nebeneinander Bias-Farben');
  const f = await p.evaluate(async () => {
    const warte = ms => new Promise(r => setTimeout(r, ms));
    setPxChartTyp('candle'); setDataPreisAnsicht('eins'); setDataPreisSkala('band'); await warte(400);
    const eins = [...document.querySelectorAll('#dataBody .pv-kz')].map(g => {
      const auf = [...g.querySelectorAll('rect.pv-auf')], ab = [...g.querySelectorAll('rect.pv-ab')];
      return { k: g.dataset.k, n: auf.length + ab.length, aufFill: [...new Set(auf.map(r => r.getAttribute('fill')))], aufStroke: [...new Set(auf.map(r => r.getAttribute('stroke')))], abFill: [...new Set(ab.map(r => r.getAttribute('fill')))] };
    });
    setDataPreisAnsicht('neben'); await warte(500);
    const neben = [...document.querySelectorAll('#dataBody .pv-kz')].map(g => ({ k: g.dataset.k, auf: [...new Set([...g.querySelectorAll('rect.pv-auf')].map(r => r.getAttribute('fill')))], ab: [...new Set([...g.querySelectorAll('rect.pv-ab')].map(r => r.getAttribute('fill')))] }));
    return { eins, neben };
  });
  const sollFarbe = ['var(--cndl-up)', 'var(--cndl-dn)'];
  if (f.eins.length !== 3) rot(`F: ${f.eins.length} Kerzen-Reihen statt 3`);
  f.eins.forEach((r, i) => {
    const farbe = r.aufStroke[0] || r.abFill[0];
    const ok = r.n > 20 && r.aufFill.every(x => x === 'none') && r.abFill.length === 1 && r.aufStroke.length <= 1 && (!r.aufStroke.length || r.aufStroke[0] === r.abFill[0])
      && (i < 2 ? farbe === sollFarbe[i] : !sollFarbe.includes(farbe));
    if (!ok) rot(`F: ein Chart, Kurs ${i + 1} (${r.k}): ${r.n} Kerzen, steigt fill ${r.aufFill.join('/')} stroke ${r.aufStroke.join('/')}, faellt fill ${r.abFill.join('/')}`);
    else gruen(`F: ein Chart, Kurs ${i + 1} (${r.k}) ${farbe}: steigt hohl, faellt gefuellt`);
  });
  if (f.neben.length !== 3 || f.neben.some(r => r.auf.join() !== 'var(--cndl-up)' || r.ab.join() !== 'var(--cndl-dn)')) rot(`F: nebeneinander nicht in Kerzenfarben: ${JSON.stringify(f.neben)}`);
  else gruen('F: nebeneinander: steigt --cndl-up, faellt --cndl-dn, gefuellt');

  // ── G) Side by side ──
  console.log('G) Side by side: je Kurs ein Panel, eigene Skala');
  const g = await p.evaluate(async () => {
    const warte = ms => new Promise(r => setTimeout(r, ms));
    setPxChartTyp('line'); setDataPreisAnsicht('neben'); await warte(500);
    return [...document.querySelectorAll('#dataBody .data-panel')].map(pn => {
      const svg = pn.querySelector('.pv-svg'); if (!svg) return null;
      const pl = svg.querySelector('polyline.pv-linie'); const ys = pl.getAttribute('points').split(' ').map(q => +q.split(',')[1]);
      // Plotflaeche = Chart-Hoehe minus Rand oben (10) und Datumsachse (24)
      const ph = +svg.getAttribute('height') - 34;
      return { k: pl.getAttribute('data-k'), spanne: (Math.max(...ys) - Math.min(...ys)) / (ph || 1) };
    });
  });
  if (g.length !== 3 || g.some(x => !x)) rot(`G: ${g.length} Panels / ${g.filter(Boolean).length} Charts statt 3`);
  else if (g.some(x => x.spanne < 0.8 || x.spanne > 1.001)) rot(`G: Linie fuellt ihr Panel nicht (eigene Skala): ${g.map(x => x.k + ' ' + Math.round(x.spanne * 100) + '%').join(', ')}`);
  else gruen(`G: 3 Panels, jede Linie fuellt ihre eigene Skala (${g.map(x => Math.round(x.spanne * 100) + '%').join(', ')} der Plothoehe)`);

  // ── H) Compare all ──
  console.log('H) Compare all: Gruppe -> Asset -> Chart, bis 8, neue Feeds von selbst');
  await p.evaluate(() => { showTab('data'); setDataMode('alle'); dataAlle = []; renderDataTab(); });
  await p.waitForTimeout(300);
  const tipp = async sel => { await p.locator(sel).first().click(); await p.waitForTimeout(200); };
  const anzahl = () => p.evaluate(() => ({ panels: document.querySelectorAll('#dataBody .data-panel').length, offen: !!document.getElementById('dataAllePicker'), alle: dataAlle.map(x => x.a + '|' + x.k) }));
  await tipp('#dataAlleBtn');
  await tipp('#dataAllePicker .dap-reihe .ind-hist-range-btn:has-text("Energy")');
  await tipp('#dataAllePicker .data-picker-body .cmp-chip:has-text("Price")');
  await tipp('#dataAllePicker .dap-reihe .ind-hist-range-btn:has-text("Currencies")');
  await tipp('#dataAllePicker .dap-reihe .cmp-chip:text-is("EUR")');
  await tipp('#dataAllePicker .data-picker-body .cmp-chip:has-text("EUR 10Y yield")');
  await tipp('#dataAllePicker .data-picker-body .cmp-chip:has-text("CPI (Headline)")');
  await tipp('#dataAllePicker .dap-reihe .ind-hist-range-btn:has-text("FX pairs")');
  await tipp('#dataAllePicker .data-picker-body .cmp-chip:text-is("EUR/USD")');
  let h1 = await anzahl();
  const sollH = ['OIL|p:OIL', 'EUR|b10:EUR', 'EUR|i:CPI (Headline)', 'PAIRS|pair:EUR/USD'];
  if (h1.panels !== 4 || sollH.some((x, i) => h1.alle[i] !== x) || !h1.offen) rot(`H: nach 4 Tipps ${h1.panels} Panels, ${JSON.stringify(h1.alle)}, Fenster ${h1.offen ? 'offen' : 'zu'}`);
  else gruen('H: 4 Tipps (Energy/OIL Price, EUR 10Y, EUR CPI, EUR/USD) = 4 Panels, Fenster bleibt offen');
  // bis 8 -> schliesst
  await tipp('#dataAllePicker .dap-reihe .ind-hist-range-btn:has-text("Currencies")');
  await tipp('#dataAllePicker .dap-reihe .cmp-chip:text-is("USD")');
  for (let i = 0; i < 4; i++) await tipp(`#dataAllePicker .data-picker-body .cmp-chip:not(.on) >> nth=0`);
  h1 = await anzahl();
  if (h1.panels !== 8 || h1.offen) rot(`H: bei 8: ${h1.panels} Panels, Fenster ${h1.offen ? 'noch offen' : 'zu'}`); else gruen('H: 8 Panels, Fenster schliesst sich');
  await p.locator('#dataBody .data-panel .px-panel-chip').first().click(); await p.waitForTimeout(300);
  h1 = await anzahl();
  if (h1.panels !== 7 || h1.alle[0] === 'OIL|p:OIL') rot(`H: ✕ entfernt nicht das Panel (${h1.panels}, ${h1.alle[0]})`); else gruen('H: ✕ entfernt das Panel');
  // neuer Kurs-Feed zur Laufzeit
  await p.evaluate(() => { const q = PRICE_DATA_FEED.GOLD.series; PRICE_DATA_FEED.WAECHTERY = { source: 'test', invert: false, series: q.map(x => [x[0], x[1] * 3]) }; dataAlle.length = 0; renderDataTab(); });
  await tipp('#dataAlleBtn');
  const neu = await p.evaluate(() => [...document.querySelectorAll('#dataAllePicker .dap-reihe .ind-hist-range-btn')].map(x => x.textContent));
  let neuOk = false;
  for (const gName of neu) { await p.locator('#dataAllePicker .dap-reihe .ind-hist-range-btn', { hasText: gName }).first().click(); await p.waitForTimeout(120); if (await p.locator('#dataAllePicker .dap-reihe .cmp-chip:text-is("WAECHTERY")').count()) { neuOk = gName; break; } }
  await p.evaluate(() => { delete PRICE_DATA_FEED.WAECHTERY; closeDataAllePicker(); });
  if (!neuOk) rot('H: neuer Kurs-Feed taucht in Compare all nicht auf'); else gruen(`H: neuer Kurs-Feed steht ohne Codeaenderung in "${neuOk}"`);
  // 390 px: beide Fenster im Bild
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
  for (const [modus, knopf, fenster] of [['alle', '#dataAlleBtn', '#dataAllePicker'], ['preis', '#dataPreisBtn', '#dataPreisPicker']]) {
    await p.evaluate(m => { closeDataAllePicker(); closeDataPreisPicker(); setDataMode(m); window.scrollTo(0, 0); }, modus); await p.waitForTimeout(300);
    await p.locator(knopf).click(); await p.waitForTimeout(300);
    const r = await p.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right) }; }, fenster);
    if (!r) rot(`H 390 px: ${fenster} geht nicht auf`);
    else if (r.l < 8 || r.r > 390 - 8) rot(`H 390 px: ${fenster} ragt aus dem Bild (left ${r.l}, right ${r.r})`);
    else gruen(`H 390 px: ${fenster} ganz im Bild (${r.l}…${r.r})`);
  }

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  const gp = gpAn;
  if (gp) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ preisvergleich: ${fehler} Befund(e)` : '\n✓ preisvergleich: alles waehlbar, Tief unten/Hoch oben, echte Werte, Paare richtig, Achsenbruch, Kerzenfarben, Side by side, Compare all');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
