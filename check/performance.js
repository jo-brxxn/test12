// ══ WAECHTER: PERFORMANCE (ruckelfrei, ohne Leerlauf-Arbeit) ═══════════════
//
// Nutzer 2026-10-03: "Die Webseite hat Performance Probleme also es ruckelt
// manchmal und Animationen und so sind einfach nicht clean und es hakt und
// braucht teilweise laenger zu laden".
//
// GEMESSEN vorher (Chromium, 1180x820, ungedrosselt):
//   - Trends: 3292 Punkte mit je EIGENER Einblend-Animation -> 2,1 s PrePaint,
//     2,3 s Stillstand beim Seitenwechsel, danach ~250 ms je Bild.
//   - Dashboard im Leerlauf: box-shadow-Puls der COT-Hinweiskarte, 608 ms
//     Paint je 4 s.
//   - COT: der Countdown schrieb jede Sekunde innerHTML -> jede Sekunde eine
//     volle Karten-Vermessung (~250 getBoundingClientRect).
//   - Overview: der Globus schrieb jedes Bild seine Beschriftung neu -> die
//     Seiten-Beobachter liefen in JEDEM Bild (212 ms querySelectorAll +
//     146 ms Kartenvermessung je 4 s).
//   - Asset-Sprung vom Dashboard: die Asset-Seite wurde zweimal aufgebaut
//     (erst das alte, dann das neue Asset), beim ersten Asset der Sitzung ein
//     drittes Mal, als das Kalender-Archiv eintraf - mitten im Wisch.
//
// Geprueft wird ueber ZAEHLWERTE, nicht ueber Millisekunden: Zeiten schwanken
// mit der Last des Rechners (die Waechter laufen nacheinander auf derselben
// CPU), Zaehlwerte nicht. Ein roter Lauf ist dadurch immer ein echter Fund.
//
//   S) STATISCH: eine Endlos-Animation bewegt nur transform/opacity. Alles
//      andere (box-shadow, background-position, filter ...) malt in jedem
//      Bild neu. Ausnahmen stehen mit Grund in ERLAUBT_MALEND.
//   A) Je Seite hoechstens MAX_GLEICHZEITIG laufende Animationen direkt nach
//      dem Wechsel.
//   B) Fertige Einblendungen haengen nicht nach (fill-mode both/forwards haelt
//      den Effekt fest): hoechstens MAX_FERTIG je Seite nach 2,6 s.
//   C) Leerlauf: reine Textwechsel (Uhr, Countdown, Zahlen) loesen keine
//      Kartenvermessung aus - hoechstens MAX_MESSUNGEN getBoundingClientRect
//      in 2 s je Seite.
//   D) Ein Asset-Wechsel = EIN Aufbau der Asset-Seite (Dashboard -> Asset per
//      gotoSym und per Panel, Asset -> Asset), im Fenster liegt beim ersten
//      Asset auch die Ankunft des Kalender-Archivs.
//   E) Asset-Symbole (Flaggen-Welle, Glanz, Oel, Metall, Index) laufen als
//      FILMSTREIFEN auf der GPU: keine SMIL-Animation, keine live laufende
//      CSS-Animation auf Symbol-Teilen, jeder Film bewegt nur transform.
//      Vorher (gemessen 2026-10-03): Asset-Seite 28 %, Dashboard 33 %
//      Hauptthread im Leerlauf, selbst mit ALLEN Symbolen ausgeblendet noch
//      557 ms je 4 s - die Animationen liefen in den geteilten Vorlagen.
// Gegenproben (muessen ROT werden):
//   --gegenprobe-punkte    jeder Trend-Punkt bekommt wieder eine Animation -> A rot
//   --gegenprobe-fill      .list-in wieder mit fill-mode both            -> B rot
//   --gegenprobe-text      Textwechsel-Filter aus (window.__gpNurText)   -> C rot
//   --gegenprobe-doppelt   alter Ablauf showTab('cur') + selSym          -> D rot
//   --gegenprobe-smil      Wellen-SMIL wieder in den Vorlagen             -> E rot
//   --gegenprobe-chv       Aufraeumen der Chart-Registry aus               -> F rot
//   --gegenprobe-globus    Kugel wieder in jedem Bild neu gezeichnet       -> G rot
//   --gegenprobe-drehung   Worker rechnet wieder aus altem Stand hoch      -> G rot (Drehung bei belegtem Hauptthread)
//   --gegenprobe-kueste    Kuesten unvereinfacht (14.000 Punkte je Bild)   -> G rot
//   --gegenprobe-ruhe      Kugel ruht im Leerlauf nie (Frist unendlich)    -> H rot
//   --gegenprobe-ebene     Calendar-Tabelle ohne eigene Ebene              -> I rot
//   --gegenprobe-kugelweg  Kugel-Schleife laeuft auf jeder Seite weiter    -> J rot
// (F, seit 2026-10-16) Speicher: nach 60 Seiten-/Asset-Wechseln haelt die
//      Hover-Registry der Charts (_chvReg) nur Eintraege fuer Charts, die im
//      Dokument stehen (+ eine Runde Puffer). Vorher wuchs sie unbegrenzt:
//      +3,5 MB Heap je 40 Wechsel, 250.000 Zeichenketten nach 80 Wechseln.
// (I, seit 2026-10-24) Ein Scroll-Container, der mit seinem Inhalt waechst
//      (scrollt nicht selbst senkrecht, z. B. overflow-x fuer schmale
//      Bildschirme) und >= GROSS_SCROLLER Elemente haelt, hat eine eigene
//      Ebene (will-change: transform). GEMESSEN: die Calendar-Tabelle (5.215
//      Elemente, 17.700 px) wurde in JEDEM Bild der Seiten-Einblendung neu
//      geordnet - 7x ~170 ms Layerize, Wechsel 1.294 ms, Handy dpr 3 929 ms;
//      mit eigener Ebene 160-180 ms.
// (J, seit 2026-10-24) Ausserhalb der Kugel-Seite laeuft die Kugel-Schleife
//      nicht: 0 Bild-Aufrufe der Kugel und 0 laufende Animationen in der Kugel
//      auf Calendar/Asset. Seit 2026-11-06 lebt die Kugel im Dashboard
//      (#dbGlobe, Overview entfernt). Nutzer 2026-10-24: "wenn man nicht auf
//      der Weltkugel ist soll diese sich auch nicht drehen".
// (G, seit 2026-10-16) Overview-Kugel im Normaltempo hoechstens 40
//      Neuzeichnungen je Sekunde (Bewegung < 0,5 px je Bild wird nicht
//      gezeichnet) - vorher 60, gemessen ~1.760 ms Rechenzeit je 5 s im
//      Leerlauf, danach ~1.180. Der Radar-Strahl laeuft weiter in jedem Bild.
const fs = require('fs');
const path = require('path');
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const GP_PUNKTE = process.argv.includes('--gegenprobe-punkte');
const GP_FILL = process.argv.includes('--gegenprobe-fill');
const GP_TEXT = process.argv.includes('--gegenprobe-text');
const GP_DOPPELT = process.argv.includes('--gegenprobe-doppelt');
const GP_SMIL = process.argv.includes('--gegenprobe-smil');
const GP_CHV = process.argv.includes('--gegenprobe-chv');
const GP_GLOBUS = process.argv.includes('--gegenprobe-globus');
const GP_RUHE = process.argv.includes('--gegenprobe-ruhe');
const GP_DREHUNG = process.argv.includes('--gegenprobe-drehung');
const GP_KUESTE = process.argv.includes('--gegenprobe-kueste');
const GP_EBENE = process.argv.includes('--gegenprobe-ebene');
const GP_KUGELWEG = process.argv.includes('--gegenprobe-kugelweg');
const GP = GP_PUNKTE || GP_FILL || GP_TEXT || GP_DOPPELT || GP_SMIL || GP_CHV || GP_GLOBUS || GP_DREHUNG || GP_KUESTE || GP_RUHE || GP_EBENE || GP_KUGELWEG;

const MAX_GLEICHZEITIG = 400;   // Trends nachher ~110, vorher 3363
const MAX_FERTIG = 3;           // pageFadeIn/detailFadeIn halten bewusst (transform-Kontext), sonst 0
const MAX_MESSUNGEN = 20;       // nachher 0 auf allen Seiten, COT vorher ~500
const GROSS_SCROLLER = 1000;    // Calendar-Tabelle 5.215; naechstgroesste mitwachsende: Matrix 274, COT 213

// Endlos-Animationen, die etwas anderes als transform/opacity bewegen und das
// duerfen - jeweils mit Grund. Neue Eintraege nur mit Messung.
const ERLAUBT_MALEND = {
  aiTick: 'laeuft nur noch auf der pausierten Abtast-Probe (.ai-probe), die den Filmstreifen baut - E prueft, dass sie nirgends live laeuft',
  aiTickDot: 'wie aiTick',
  globePing: 'Overview-Globus: SVG, die Kugel wird ohnehin fortlaufend neu gezeichnet (G begrenzt den Takt)',
  jetFlameFlicker: 'Overview-Globus: SVG-Jet, wie globePing',
  skelShimmer: 'laeuft nur, solange ein Platzhalter laedt',
};
const NUR_GPU = new Set(['transform', 'opacity', 'offset', 'animation-timing-function']);

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

// ── S) statisch ──────────────────────────────────────────────────────────
function statisch() {
  const wurzel = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');
  const js = fs.readdirSync(path.join(wurzel, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(wurzel, 'js', f), 'utf8')).join('\n');
  const kf = {};
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let d = 1, j = m.index + m[0].length;
    while (d && j < css.length) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
    const body = css.slice(m.index + m[0].length, j - 1).replace(/\d+(\.\d+)?%|from|to/g, '');
    kf[m[1]] = new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map(x => x[1]));
  }
  const endlos = new Set();
  for (const quelle of [css, js]) for (const m of quelle.matchAll(/animation(?:-name)?\s*:\s*([^;}`'"]+)/g)) {
    if (!/infinite/.test(m[1])) continue;
    for (const n of m[1].match(/[A-Za-z][\w-]*/g) || []) if (kf[n]) endlos.add(n);
  }
  const falsch = [...endlos].filter(n => [...kf[n]].some(p => !NUR_GPU.has(p)) && !ERLAUBT_MALEND[n]);
  falsch.forEach(n => rot(`Endlos-Animation "${n}" malt in jedem Bild neu (${[...kf[n]].filter(p => !NUR_GPU.has(p)).join(', ')}) - transform/opacity verwenden`));
  if (!falsch.length) gruen(`${endlos.size} Endlos-Animationen bewegen nur transform/opacity (${Object.keys(ERLAUBT_MALEND).length} begruendete Ausnahmen)`);
}

(async () => {
  console.log('S) Endlos-Animationen');
  statisch();

  const { chromium } = require(PW);
  const { wartenBisDatenDa } = require('./warten.js');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const perr = [];
  p.on('pageerror', e => perr.push(String(e.message || e)));
  await p.addInitScript(gp => {
    try { localStorage.setItem('fxpro_help_seen', '1'); } catch (e) {}
    if (gp.text) window.__gpNurText = true;
    if (gp.kugelweg) window.__gpGlobusUeberall = true;
    // J: Bild-Aufrufe je Rueckruf-Name zaehlen (die Kugel-Schleife heisst "frame")
    window.__rafN = {};
    const raf0 = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = f => { const k = (f && f.name) || '?'; window.__rafN[k] = (window.__rafN[k] || 0) + 1; return raf0(f); };
    if (gp.css) document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = gp.css; document.head.appendChild(s); });
  }, {
    text: GP_TEXT,
    kugelweg: GP_KUGELWEG,
    css: (GP_PUNKTE ? '.tr-dots-in circle{animation:trFadeIn 1s ease both}' : '') + (GP_FILL ? '.list-in{animation-fill-mode:both!important}' : '') + (GP_EBENE ? '.cal-table{will-change:auto!important}' : ''),
  });
  // Ankunft des Kalender-Archivs im Fenster von D nachweisen
  const archiv = [];
  p.on('requestfinished', r => { if (/cal_hist\//.test(r.url())) archiv.push(r.url().split('/').pop().split('?')[0]); });

  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); showTab('dash'); });
  await p.waitForTimeout(1200);

  // ── D) ein Aufbau je Asset-Wechsel ───────────────────────────────────────
  // Zuerst, damit der erste Asset-Besuch der Sitzung (Archiv kommt) dabei ist.
  console.log('D) Ein Asset-Wechsel = ein Aufbau');
  const aufbauten = async (wie, code) => p.evaluate(async ([code, doppelt]) => {
    const det = document.getElementById('detail'); let n = 0;
    const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(x => { if (x.nodeType === 1 && x.classList.contains('dp')) n++; })));
    mo.observe(det, { childList: true });
    if (doppelt) { const id = code.match(/'(\w+)'/)[1]; showTab('cur', null, 'fx'); selSym(id); }
    else (0, eval)(code);
    await new Promise(r => setTimeout(r, 2500));
    mo.disconnect();
    return n;
  }, [code, GP_DOPPELT && wie !== 'Asset -> Asset' && /'\w+'/.test(code)]);
  // Am 1. eines Monats hat die Monatskarte keine vergangenen Tage - dann
  // fragt sie das Archiv gar nicht an (abCalNachTag: ab nur, wenn der
  // Monatsanfang vor heute liegt). CI-Lauf 660 (2026-11-01) war deshalb rot,
  // ohne Fehler in der App. An dem Tag kommt das Archiv ueber den Vormonat
  // (derselbe Knopf wie in der Karte), ebenfalls mit genau einem Aufbau.
  const ersterTag = await p.evaluate(() => new Date().getDate() === 1);
  const faelle = [
    ['Dashboard -> Asset (gotoSym, erstes Asset)', "showTab('dash')", "gotoSym('USD')"],
    ['Dashboard -> Asset (Panel)', "showTab('dash')", "sbClick('GBP')"],
    ['Asset -> Asset', "gotoSym('USD')", "sbClick('EUR')"],
  ];
  if (ersterTag) faelle.push(['Asset -> Vormonat (1. des Monats, Archiv)', "gotoSym('USD')", 'abCalShift(-1)']);
  for (const [wie, vorher, code] of faelle) {
    await p.evaluate(v => (0, eval)(v), vorher); await p.waitForTimeout(900);
    const n = await aufbauten(wie, code);
    if (n !== 1) rot(`${wie}: Asset-Seite ${n}x aufgebaut (soll 1)`); else gruen(`${wie}: 1 Aufbau`);
  }
  if (ersterTag) await p.evaluate(() => abCalShift(1));
  if (!archiv.length) rot('Kalender-Archiv kam im Pruef-Fenster nicht an - der Archiv-Fall war nicht abgedeckt');
  else gruen(`Archiv (${[...new Set(archiv)].join(', ')}) kam im Fenster an, ohne zweiten Aufbau`);

  // ── A/B/C je Seite ──────────────────────────────────────────────────────
  console.log('A) gleichzeitige Animationen / B) fertige Einblendungen / C) Leerlauf-Messungen');
  const SEITEN = [["showTab('dash')", 'Dashboard'], ["gotoSym('USD')", 'Asset USD'], ["showTab('trends')", 'Trends'], ["showTab('cal')", 'Calendar'],
    ["showTab('watch')", 'Watchlist'], ["showTab('cot')", 'COT'], ["showTab('pairs')", 'Set-ups'],
    ["showTab('carry')", 'Carry'], ["showTab('mx')", 'Matrix'], ["showTab('sent')", 'Sentiment'], ["showTab('news')", 'News']];
  for (const [code, name] of SEITEN) {
    const r = await p.evaluate(async code => {
      try { (0, eval)(code); } catch (e) { return { err: String(e) }; }
      await new Promise(r => setTimeout(r, 150));
      const laufend = document.getAnimations().filter(a => a.playState === 'running').length;
      const proName = {}; document.getAnimations().forEach(a => { const k = a.animationName || a.constructor.name; proName[k] = (proName[k] || 0) + 1; });
      await new Promise(r => setTimeout(r, 2450));
      const fertig = document.getAnimations().filter(a => a.playState === 'finished');
      const fertigNamen = {}; fertig.forEach(a => { const k = a.animationName || a.constructor.name; fertigNamen[k] = (fertigNamen[k] || 0) + 1; });
      // C: Leerlauf - wie oft wird in 2 s vermessen?
      let mess = 0; const g = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () { mess++; return g.call(this); };
      await new Promise(r => setTimeout(r, 2000));
      Element.prototype.getBoundingClientRect = g;
      return { laufend, proName, fertig: fertig.length, fertigNamen, mess };
    }, code);
    if (r.err) { rot(`${name}: ${r.err}`); continue; }
    const top = m => Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(', ');
    const zeile = [];
    if (r.laufend > MAX_GLEICHZEITIG) rot(`${name}: ${r.laufend} Animationen gleichzeitig (max ${MAX_GLEICHZEITIG}) - ${top(r.proName)}`); else zeile.push(`${r.laufend} Animationen`);
    if (r.fertig > MAX_FERTIG) rot(`${name}: ${r.fertig} fertige Einblendungen haengen nach (max ${MAX_FERTIG}) - ${top(r.fertigNamen)}; fill-mode backwards verwenden`); else zeile.push(`${r.fertig} fertig`);
    if (r.mess > MAX_MESSUNGEN) rot(`${name}: ${r.mess} Layout-Messungen in 2 s Leerlauf (max ${MAX_MESSUNGEN})`); else zeile.push(`${r.mess} Messungen im Leerlauf`);
    if (zeile.length === 3) gruen(`${name.padEnd(10)} ${zeile.join(' · ')}`);
  }

  // ── E) Asset-Symbole nur als GPU-Film ────────────────────────────────────
  console.log('E) Asset-Symbole: Film statt Live-Animation');
  for (const [code, name] of [["showTab('dash')", 'Dashboard'], ["gotoSym('USD')", 'Asset USD'], ["gotoSym('GOLD')", 'Asset GOLD']]) {
    const r = await p.evaluate(async ([code, gp]) => {
      if (gp) { const w = document.querySelector('#aiWave path'); if (w && !w.querySelector('animate')) w.insertAdjacentHTML('beforeend', '<animate attributeName="d" dur="1.8s" repeatCount="indefinite" values="' + w.getAttribute('d') + ';' + w.getAttribute('d').replace(/,0\./g, ',0.5') + '"/>'); }
      (0, eval)(code);
      // Filme werden im Leerlauf nachgezogen und erst im onload ihres Bildes
      // eingeschaltet (.ai-film-on). Gewartet wird deshalb, bis jedes sichtbare
      // Fenster gefuellt UND eingeschaltet ist - nicht nur gefuellt: im
      // Volllauf 2026-10-05 lagen zwischen Fuellen und onload ~100 ms (Spur:
      // 215 -> 317 ms), die Messung fiel hinein und meldete "0 von 1" (GOLD).
      // Kommt ein Film nie, bleibt es nach 4 s rot wie bisher.
      const offen = () => document.querySelector('.ai-film-win[data-film]:empty') || [...document.querySelectorAll('.ai-wrap')].some(w => w.getClientRects().length && w.querySelector('.ai-film-win') && !w.classList.contains('ai-film-on'));
      for (let i = 0; i < 40 && offen(); i++) await new Promise(r => setTimeout(r, 100));
      const smil = document.querySelectorAll('animate, animateTransform, animateMotion').length;
      const live = document.getAnimations().filter(a => a.playState === 'running' && /^ai(Sheen|Drip|MetalSheen|Tick|TickDot)$/.test(a.animationName || '')).length;
      const filme = [...document.querySelectorAll('.ai-wrap.ai-film-on .ai-film')].filter(f => f.getClientRects().length);
      const fremd = filme.filter(f => f.getAnimations().some(a => a.animationName !== 'aiFilm')).length;
      const sichtbar = [...document.querySelectorAll('.ai-wrap')].filter(w => w.getClientRects().length && w.querySelector('.ai-film-win')).length;
      return { smil, live, filme: filme.length, fremd, sichtbar };
    }, [code, GP_SMIL]);
    const z = [];
    if (r.smil) rot(`${name}: ${r.smil} SMIL-Animationen im Dokument - laufen auch fuer unsichtbare Symbole und ziehen die ganze Seite mit`); else z.push('kein SMIL');
    if (r.live) rot(`${name}: ${r.live} CSS-Animationen auf Symbol-Teilen laufen live`); else z.push('nichts live');
    if (r.fremd) rot(`${name}: ${r.fremd} Filme mit anderer Animation als aiFilm (transform)`);
    if (r.filme < r.sichtbar) rot(`${name}: nur ${r.filme} von ${r.sichtbar} sichtbaren animierbaren Symbolen zeigen ihren Film`); else z.push(`${r.filme}/${r.sichtbar} Symbole als Film`);
    if (z.length === 3) gruen(`${name.padEnd(10)} ${z.join(' · ')}`);
  }

  // ── F) Hover-Registry der Charts waechst nicht ───────────────────────────
  console.log('F) Speicher: Chart-Registry nach 60 Wechseln');
  if (GP_CHV) await p.evaluate(() => { window.__gpKeinChvAufr = true; });
  for (let i = 0; i < 60; i++) {
    await p.evaluate(i => { const ids = ['EUR', 'USD', 'GOLD', 'JPY', 'NAS']; if (i % 2) gotoSym(ids[i % 5]); else showTab(['dash', 'trends', 'mx', 'cot', 'pairs', 'cal'][i % 6]); }, i);
    await p.waitForTimeout(90);
  }
  await p.evaluate(() => showTab('dash')); await p.waitForTimeout(2300); await p.evaluate(() => { showTab('trends'); }); await p.waitForTimeout(600);
  const reg = await p.evaluate(() => ({ n: Object.keys(window._chvReg || {}).length, dom: document.querySelectorAll('.chv[data-chv]').length }));
  if (reg.n > reg.dom * 2 + 150) rot(`Chart-Registry haelt ${reg.n} Eintraege, im Dokument stehen ${reg.dom} Charts - sie waechst mit jedem Aufbau`);
  else gruen(`Chart-Registry ${reg.n} Eintraege bei ${reg.dom} Charts im Dokument`);

  // ── G) Dashboard-Kugel: jedes Bild eine Bewegung, Dokument still, 60/s gedrosselt
  // Nutzer 2026-11-06: "perfekt drehen ohne zu haengen". GEMESSEN: jede
  // Aenderung im Dokument (SVG-Attribut, Marker-transform, Canvas im
  // Hauptthread) liess die GANZE Dashboard-Seite je Bild neu zusammensetzen -
  // bei 4x gedrosselter CPU 34 Bilder/s. Seit 682 zeichnet ein Web Worker
  // (OffscreenCanvas, js/globe-worker.js): 60 Bilder/s auch bei 4x und 6x.
  // Verlangt: Worker-Modus; Kugel-Zeichnungen >= 90 % der Bilder; in der
  // Kugel-Karte 0 Dokument-Aenderungen in 2 s; bei 4x CPU >= 54 Bilder/s und
  // p95 <= 20 ms.
  // Gegenproben: --gegenprobe-globus (alte 0,5-px-Schwelle) -> Zeichnungen rot;
  //   --gegenprobe-hauptthread (ohne Worker) -> 4x-Messung rot.
  console.log('G) Dashboard-Kugel: jedes Bild, Dokument still, 60/s bei 4x CPU');
  await p.evaluate(async gp => {
    if (gp.schwelle) window.__gpGlobusSchwelle = true;
    if (gp.drehung) window.__gpGlobusHochrechnung = true;
    if (gp.kueste) { window.__gpGlobusKuesteRoh = true; const m = await import('/js/globe.js'); showTab('dash'); m.startGlobes({ neu: true }); }
    if (gp.haupt) { window.__globusOhneWorker = true; const m = await import('/js/globe.js'); showTab('dash'); m.startGlobes({ neu: true }); }
    showTab('dash'); const g = document.getElementById('dbGlobe'); if (g) g.scrollIntoView({ block: 'center' });
  }, { schwelle: GP_GLOBUS, drehung: GP_DREHUNG, kueste: GP_KUESTE, haupt: process.argv.includes('--gegenprobe-hauptthread') });
  await p.mouse.move(5, 5); await p.mouse.move(9, 9);
  await p.waitForTimeout(2500);
  const kugelMessen = (belegt) => p.evaluate(async (belegt) => {
    const card = document.getElementById('dbGlobe'); if (!card || !card.querySelector('canvas.globe-canvas')) return null;
    let mut = 0; const mo = new MutationObserver(ms => { mut += ms.length; });
    mo.observe(card, { attributes: true, subtree: true, childList: true, characterData: true });
    const z0 = window.__globusZeichnungen || 0, g = []; let l = performance.now(); window.__globusLuecken = []; window.__globusWinkel = [];
    // belegt: Hauptthread alle 250 ms 70 ms blockiert (wie Uhr/Feed-Aufbau auf dem iPad)
    const last = belegt ? setInterval(() => { const e = performance.now() + 70; while (performance.now() < e); }, 250) : 0;
    await new Promise(r => { const t0 = l; const f = n => { g.push(n - l); l = n; if (n - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    clearInterval(last); mo.disconnect(); g.sort((a, b) => a - b);
    const m = await import('/js/globe.js');
    // Kugel-Takt: im Worker-Modus die vom Worker gemeldeten Bildabstaende, sonst der Hauptthread
    const L = (window.__globusLuecken || []).slice().sort((a, b) => a - b), w = L.length >= 30;
    const p95 = w ? L[Math.floor(L.length * .95)] : g[Math.floor(g.length * .95)], fps = w ? 1000 / (L.reduce((a, b) => a + b, 0) / L.length) : g.length / 2;
    const tempo = (() => { const W = (window.__globusWinkel || []).slice(), v = []; for (let i = 1; i < W.length; i++) { const dt = (W[i][0] - W[i - 1][0]) / 1000; if (dt > 0.004) v.push((((W[i][1] - W[i - 1][1]) % 360 + 540) % 360 - 180) / dt); } v.sort((a, b) => a - b); return v.length ? { n: v.length, rueck: v.filter(x => x < 0).length, med: v[v.length >> 1], p5: v[Math.floor(v.length * .05)], p95: v[Math.floor(v.length * .95)] } : null; })();
    return { n: (window.__globusZeichnungen || 0) - z0, bilder: g.length, mut, p95, fps, max: w ? L[L.length - 1] : g[g.length - 1], modus: m._globeHosts.map(x => x.modus).join(','), tempo };
  }, !!belegt);
  const gl = await kugelMessen();
  // Kuesten je Kugelgroesse vereinfacht (2026-11-07, WebKit: spaete Bilder liefen
  // mit der Pfad-Punktzahl; 14.000 -> 4.781 bei 318 px, im Bild kein Unterschied)
  const kp = await p.evaluate(() => window.__globusKuestenPunkte || 0);
  if (!kp) rot('Kugel meldet keine Kuesten-Punktzahl');
  else if (kp > 6000) rot(`Kugel-Kuesten ${kp} Punkte - unvereinfacht, jedes Bild rastert den vollen Pfad (soll <= 6.000)`);
  else gruen(`Kugel-Kuesten ${kp} Punkte (vereinfacht, <= 6.000)`);
  if (!gl) rot('Dashboard-Kugel (Canvas-Ebenen) nicht gefunden');
  else {
    if (gl.modus !== 'worker') rot(`Kugel zeichnet im Hauptthread (${gl.modus || '-'}) statt im Worker`); else gruen('Kugel zeichnet im Web Worker (OffscreenCanvas)');
    if (gl.n < gl.bilder * 0.9) rot(`Kugel nur ${gl.n} Bewegungen bei ${gl.bilder} Bildern - sie rueckt nicht jedes Bild weiter (ruckelt)`);
    else gruen(`Kugel ${gl.n} Bewegungen bei ${gl.bilder} Bildern (jedes Bild)`);
    if (gl.mut > 0) rot(`Kugel-Karte ${gl.mut}x im Dokument veraendert in 2 s - jede Aenderung setzt die ganze Seite neu zusammen`);
    else gruen('Kugel-Karte im Dokument unveraendert (0 Aenderungen in 2 s)');
  }
  const cdpG = await p.context().newCDPSession(p);
  await cdpG.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.waitForTimeout(800);
  const g4 = await kugelMessen();
  await cdpG.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await p.waitForTimeout(500);
  const gB = await kugelMessen(true);
  // Gleichmaessige Drehung (Nutzer-Fotos 2026-11-07: Kugel sprang vor und zurueck,
  // gemessen -22 bis +19 Grad/s statt 4): nie rueckwaerts, Tempo 4 Grad/s +-10 %.
  // Auch bei belegtem Hauptthread - dort entstand der Fehler (Worker rechnete aus
  // dem letzten Hauptthread-Stand hoch; Gegenprobe --gegenprobe-drehung).
  for (const [lbl, r] of [['1x CPU', gl], ['4x CPU', g4], ['Hauptthread belegt (70 ms je 250 ms)', gB]]) {
    const t = r && r.tempo;
    if (!t) { rot(`${lbl}: keine Winkel vom Worker gemeldet`); continue; }
    if (t.rueck > 0 || t.p5 < 3.6 || t.p95 > 4.4) rot(`${lbl}: Drehung ungleichmaessig - ${t.rueck} Rueckwaerts-Schritte, Tempo p5 ${t.p5.toFixed(2)} / Median ${t.med.toFixed(2)} / p95 ${t.p95.toFixed(2)} Grad/s (soll 4)`);
    else gruen(`${lbl}: Drehung gleichmaessig (0 rueckwaerts, ${t.p5.toFixed(2)}-${t.p95.toFixed(2)} Grad/s, Median ${t.med.toFixed(2)})`);
  }
  if (g4) { if (g4.fps < 54 || g4.p95 > 20) rot(`bei 4x CPU Kugel nur ${g4.fps.toFixed(0)} Bilder/s, p95 ${g4.p95.toFixed(1)} ms - sie haengt auf langsamen Geraeten`); else gruen(`bei 4x CPU Kugel ${g4.fps.toFixed(0)} Bilder/s, p95 ${g4.p95.toFixed(1)} ms, max ${g4.max.toFixed(0)} ms`); }
  await p.evaluate(async () => { window.__gpGlobusSchwelle = false; window.__gpGlobusHochrechnung = false; if (window.__gpGlobusKuesteRoh) { window.__gpGlobusKuesteRoh = false; const m = await import('/js/globe.js'); m.startGlobes({ neu: true }); } if (window.__globusOhneWorker) { window.__globusOhneWorker = false; const m = await import('/js/globe.js'); m.startGlobes({ neu: true }); } });

  // ── H) Overview-Kugel ruht im Leerlauf und wacht bei Eingabe auf ─────────
  // GEMESSEN 2026-10-17: Overview im Leerlauf 1.120-1.330 ms Arbeit je 5 s,
  // ohne Kugel 22 ms. Ohne Eingabe muss die Kugel nach der Frist ruhen
  // (0 Neuzeichnungen), nach einer Mausbewegung sofort wieder drehen.
  // Seit 2026-11-06 umgekehrt (Nutzer: "Es muss nur drehen"): die Kugel ruht
  // NIE - sie dreht ohne Eingabe weiter. Gegenprobe --gegenprobe-ruhe schaltet
  // die alte 1,5-s-Ruhe ein -> rot.
  console.log('H) Dashboard-Kugel: dreht ohne Eingabe weiter (keine Ruhe)');
  await p.evaluate(gp => { window.__gpGlobusRuheMs = gp ? 1500 : undefined; }, GP_RUHE);
  await p.mouse.move(12, 12);
  await p.waitForTimeout(1500 + 3500);
  const zaehle = () => p.evaluate(async () => {
    if (!document.querySelector('#dashGlobeHost canvas.globe-canvas')) return null;
    const z0 = window.__globusZeichnungen || 0; await new Promise(r => setTimeout(r, 1500));
    return { n: (window.__globusZeichnungen || 0) - z0, ruht: !!document.querySelector('.globe-host.globe-ruht') };
  });
  const ruhe = await zaehle();
  await p.mouse.move(40, 40); await p.mouse.move(60, 60);
  const wach = await zaehle();
  if (!ruhe || !wach) rot('Dashboard-Kugel nicht gefunden');
  else {
    if (ruhe.n < 5 || ruhe.ruht) rot(`Kugel ohne Eingabe nur ${ruhe.n}x in 1,5 s gezeichnet (ruht: ${ruhe.ruht}) - sie bleibt stehen statt zu drehen`);
    else gruen(`Kugel dreht ohne Eingabe weiter (${ruhe.n} Neuzeichnungen in 1,5 s)`);
    if (wach.n < 5 || wach.ruht) rot(`Kugel nach Mausbewegung nur ${wach.n}x in 1,5 s neu gezeichnet - sie wacht nicht auf`);
    else gruen(`Kugel nach Eingabe wieder ${wach.n} Neuzeichnungen in 1,5 s`);
  }
  await p.evaluate(() => { window.__gpGlobusRuheMs = 0; showTab('dash'); });

  // ── I) Grosse, mitwachsende Scroll-Container haben eine eigene Ebene ─────
  console.log('I) Grosse mitwachsende Scroll-Container: eigene Ebene');
  for (const [code, name] of [["showTab('cal')", 'Calendar'], ["showTab('dash')", 'Dashboard'], ["gotoSym('USD')", 'Asset USD'], ["showTab('mx')", 'Matrix'],
    ["showTab('cot')", 'COT'], ["showTab('trends')", 'Trends'], ["showTab('carry')", 'Carry'], ["showTab('pairs')", 'Set-ups'], ["showTab('news')", 'News'],
    ["showTab('sent')", 'Sentiment'], ["showTab('seas')", 'Seasonality'], ["showTab('data')", 'Data'], ["showTab('journal')", 'Journal'], ["showTab('regime')", 'Regime']]) {
    const r = await p.evaluate(async ([code, gross]) => {
      try { (0, eval)(code); } catch (e) { return { err: String(e) }; }
      await new Promise(r => setTimeout(r, 400));
      const seite = document.getElementById(PAGE_IDS[curPage]);
      const ohne = [], mit = [];
      for (const e of seite.querySelectorAll('*')) {
        if (e instanceof SVGElement) continue;
        const s = getComputedStyle(e);
        if (!/auto|scroll/.test(s.overflowX + ' ' + s.overflowY)) continue;
        const n = e.getElementsByTagName('*').length;
        if (n < gross || e.scrollHeight > e.clientHeight + 1) continue;   // klein, oder echter (senkrechter) Scrollbereich
        const k = e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' (' + n + ' Elemente)';
        (/transform/.test(s.willChange) ? mit : ohne).push(k);
      }
      return { ohne, mit };
    }, [code, GROSS_SCROLLER]);
    if (r.err) { rot(`${name}: ${r.err}`); continue; }
    if (r.ohne.length) rot(`${name}: ${r.ohne.join(', ')} - mitwachsender Scroll-Container ohne eigene Ebene, wird in jedem Bild der Seiten-Einblendung neu geordnet (will-change: transform)`);
    else if (r.mit.length) gruen(`${name.padEnd(11)} ${r.mit.join(', ')} mit eigener Ebene`);
  }
  gruen('uebrige Seiten ohne grosse mitwachsende Scroll-Container');

  // ── J) Ausserhalb der Overview steht die Kugel ───────────────────────────
  console.log('J) Kugel ausserhalb des Dashboards');
  await p.evaluate(() => showTab('dash')); await p.mouse.move(70, 70); await p.waitForTimeout(1500);
  const kugelLief = await p.evaluate(() => (window.__rafN || {}).frame || 0);
  if (!kugelLief) rot('Kugel-Schleife lief auf dem Dashboard gar nicht - Messung von J ungueltig');
  for (const [code, name] of [["showTab('trends')", 'Trends'], ["showTab('cal')", 'Calendar'], ["gotoSym('USD')", 'Asset USD']]) {
    await p.evaluate(() => showTab('dash')); await p.mouse.move(80, 80); await p.waitForTimeout(800);
    const r = await p.evaluate(async code => {
      (0, eval)(code);
      await new Promise(r => setTimeout(r, 300));   // ein Bild Auslauf: die Schleife beendet sich im naechsten Aufruf
      window.__rafN.frame = 0;
      await new Promise(r => setTimeout(r, 1500));
      const over = document.getElementById('dbGlobe') || document.body;
      const anim = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && over.contains(a.effect.target)).length;
      return { frames: window.__rafN.frame || 0, anim };
    }, code);
    if (r.frames || r.anim) rot(`${name}: Kugel laeuft weiter - ${r.frames} Bild-Aufrufe in 1,5 s, ${r.anim} laufende Animationen in der Kugel`);
    else gruen(`${name.padEnd(10)} Kugel steht: 0 Bild-Aufrufe, 0 Animationen`);
  }
  // ── K) Rueckkehr ins Dashboard: Kugel laeuft weiter, KEIN Neuaufbau ───────
  // Nutzer 2026-11-06: "mach das die sich nicht die ganze Zeit neu laedt sondern
  // einfach normal sich dreht". Gegenprobe: --gegenprobe-neubau (startGlobes
  // baut immer neu) -> rot.
  console.log('K) Kugel: Seitenwechsel und zurueck ohne Neuaufbau');
  const k = await p.evaluate(async gp => {
    showTab('dash'); await new Promise(r => setTimeout(r, 900));
    const h = document.getElementById('dashGlobeHost'); if (!h) return null;
    const svg0 = h.querySelector('svg');
    if (gp) window.__gpGlobusNeubau = true;
    showTab('cal'); await new Promise(r => setTimeout(r, 600)); showTab('dash'); await new Promise(r => setTimeout(r, 900));
    return { gleich: h.querySelector('svg') === svg0 };
  }, process.argv.includes('--gegenprobe-neubau'));
  if (!k) rot('Dashboard-Kugel nicht gefunden (K)');
  else if (!k.gleich) rot('Kugel nach Kalender -> Dashboard neu aufgebaut statt fortgesetzt');
  else gruen('Kugel nach Seitenwechsel fortgesetzt (dasselbe Bild, kein Neuaufbau)');
  await p.evaluate(() => showTab('dash'));

  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  await b.close();
  if (GP) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n${fehler} Befund(e).` : '\nPerformance-Waechter gruen.');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
