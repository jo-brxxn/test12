#!/usr/bin/env node
// ── ALLE WAECHTER ─────────────────────────────────────────────────
//     node check/all.js --static        (ohne Browser, ~5 s - VOR JEDEM PUSH)
//     node check/all.js                 (alles, braucht den Testserver, ~40 min lokal)
//     node check/all.js --teil 2/6      (zweites von sechs gleich langen Paketen - so laeuft die CI)
//     node check/all.js --nur makro,altgeraet   (nur diese, z. B. die zur Aenderung passenden)
//     node check/all.js --liste [--teil i/n]    (zeigt nur, was laufen wuerde)
//     node check/all.js --base <ref>    (Vergleichsbasis fuer rules/scorediff/summarydiff)
//
// Seit 2026-10-24 (Nutzer: "pushen und kein Pruefllauf"): vor dem Push nur
// --static; den vollen Lauf macht die CI bei jedem Push auf main, in sechs
// parallelen Paketen (.github/workflows/checks.yml) - ~12 statt ~69 Minuten.
//
// Jede Pruefung hier existiert, weil der zugehoerige Fehler schon einmal
// beim Nutzer angekommen ist. Neue Pruefung dazu = neuer Eintrag in PRUEFUNGEN.
// `s` = Sekunden im CI-Lauf (Lauf 608, 2026-10-24) - danach teilt --teil die
// Pakete auf (laengste zuerst in das jeweils kuerzeste Paket). Bei einer neuen
// oder deutlich veraenderten Pruefung grob nachtragen; falsch ist nur "fehlt".
const { spawnSync } = require('child_process');
const http = require('http');

const args = process.argv.slice(2);
const wertNach = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const nurStatisch = args.includes('--static');
const nurListe = args.includes('--liste');
const basis = wertNach('--base') || process.env.CHECK_BASE || 'origin/main';
const teilArg = wertNach('--teil');
const nurArg = wertNach('--nur');
const PORT = process.env.CHECK_PORT || '8935';
const URL = `http://127.0.0.1:${PORT}/index.html`;

// kette: scorediff + summarydiff MUESSEN vor rules laufen (rules liest deren
// Ergebnis, um zu entscheiden, ob ein SCORE_MODEL_VERSION-/
// SUMMARY_ENGINE_VERSION-Bump wirklich noetig ist) - --teil haelt die drei
// deshalb in EINEM Paket und in dieser Reihenfolge.
const PRUEFUNGEN = [
  { n: 'syntax',    s: 2,   d: 'JS der <script>-Bloecke, alle js/*.js als Modul, YAML und jeder run-Block', f: 'check/syntax.js', args: [], browser: false },
  { n: 'scorediff', s: 43,  d: 'rechnet jeden Score gegen die Basis nach', f: 'check/scorediff.js', args: [basis], browser: true, kette: true },
  { n: 'summarydiff', s: 42, d: 'vergleicht jeden Kartentext gegen die Basis', f: 'check/summarydiff.js', args: [basis], browser: true, kette: true },
  { n: 'rules',     s: 1,   d: 'Versions-Bumps, Workflow-Ausgaben, neue Felder in snap() -> neueFelderBehalten', f: 'check/rules.js', args: [basis], browser: false, kette: true },
  { n: 'structure', s: 1,   d: 'doppelte ids/Bloecke, Handler in der window-Bruecke, jeder Modul-Import exportiert', f: 'check/structure.js', args: ['index.html'], browser: false },
  { n: 'score',     s: 15,  d: 'Rechenkette, _symId, Bias gegen Rohdaten, Idempotenz', f: 'check/score.js', args: ['normalized'], browser: true },
  { n: 'display',   s: 27,  d: 'angezeigte Scores im DOM gegen den Sollwert, Feed-Zuordnung, News-Einordnung', f: 'check/display.js', args: ['normalized'], browser: true },
  { n: 'runtime',   s: 151, d: 'alle Tabs, Modals und Zustaende ohne JS-Fehler', f: 'check/runtime.js', args: [], browser: true },
  { n: 'quickcap',  s: 1,   d: 'Schnellerfassung: Zerlegung an echten Beispielen', f: 'check/quickcapture.js', args: [], browser: false },
  { n: 'putcall',   s: 1,   d: 'Put/Call: eine Schwellen-Wahrheit, passend zur eigenen Reihe', f: 'check/putcall.js', args: [], browser: false },
  { n: 'datum',     s: 32,  d: 'Jedes Datum mit Jahr, und zwar zweistellig', f: 'check/datum.js', args: [], browser: true },
  { n: 'achsen',    s: 30,  d: 'Achsen: gleiche Abstaende, runde Zahlen, spiegelgleich um die Null', f: 'check/achsen.js', args: [], browser: true },
  { n: 'html',      s: 38,  d: 'Kein zerbrochenes HTML-Attribut (rohes " im Attributtext)', f: 'check/html.js', args: [], browser: true },
  { n: 'notizen',   s: 24,  d: 'Notizen ueberleben Sync/Undo/Import mit Text und Ordnern', f: 'check/notizen.js', args: [], browser: true },
  { n: 'layout',    s: 120, d: 'Ueberlauf ueber Viewports und Karten', f: 'check/layout.js', args: [], browser: true },
  { n: 'dashboard', s: 187, d: 'ueberlappende Karten und Zonen-Ueberlauf', f: 'check/dashboard.js', args: [], browser: true },
  { n: 'symbole',   s: 31,  d: 'Flaggen ein Stueck, Glanz begrenzt, jede Karte ein Symbol', f: 'check/symbole.js', args: [], browser: true },
  { n: 'uebergang', s: 39,  d: 'Wisch beim Seitenwechsel, Panel, History-Karte fest', f: 'check/uebergang.js', args: [], browser: true },
  { n: 'logo',      s: 38,  d: 'FX-Logo: Ladebildschirm, leere Kartenflaeche, Intro entfernt', f: 'check/logo.js', args: [], browser: true },
  { n: 'korb',      s: 25,  d: 'Waehrungen als Korb gegen die 7 anderen: Invariante, Node-Nachbau, Price-Karte, Performance', f: 'check/korb.js', args: [], browser: true },
  { n: 'infoi',     s: 29,  d: 'Info-i: 0,6 x Titelschrift, blau, rechts oben auf Titelhoehe, ueberall', f: 'check/infoi.js', args: [], browser: true },
  { n: 'chartpunkte', s: 25, d: 'Punkte/Labels auf SVG-Charts: Bezugsbox = SVG, Punkte auf dem Knick', f: 'check/chartpunkte.js', args: [], browser: true },
  { n: 'retailwahl', s: 29, d: 'Go to Retail: Paar-Auswahl (Waehrungen, bei USD + Non-FX getrennt)', f: 'check/retailwahl.js', args: [], browser: true },
  { n: 'stapel',    s: 27,  d: 'Asset-Stapel: Panelbreite haengt nicht an den Scores', f: 'check/stapel.js', args: [], browser: true },
  { n: 'archiv',    s: 28,  d: 'Lange Kurshistorie erst bei Bedarf, Lade-Logo, Scores unberuehrt', f: 'check/archiv.js', args: [], browser: true },
  { n: 'cotpreis',  s: 36,  d: 'COT vs Price auf den Balken (Kurs gegen USD nachgerechnet), jedes Asset mit Kurs-Chart', f: 'check/cotpreis.js', args: [], browser: true },
  { n: 'calpast',   s: 28,  d: 'Past Releases: Liste je Asset in Kalender-Karte und -Fenster, eine Quelle je Tag, Zeitfilter bis zur Archivtiefe', f: 'check/calpast.js', args: [], browser: true },
  { n: 'seasvsprice', s: 29, d: 'Seasonality-Kachel: laufendes Jahr fest als Linie auf der Balkenskala, kein Schalter', f: 'check/seasvsprice.js', args: [], browser: true },
  { n: 'chartsync', s: 26,  d: 'Offene Indikator-Charts teilen den Cursor ueber das Datum (Stand am Tag), Compare klein in der Legendenzeile', f: 'check/chartsync.js', args: [], browser: true },
  { n: 'yachse',    s: 48,  d: 'Y-Beschriftung an jedem Daten-Chart, Data: gleicher Indikator = gleiche Skala', f: 'check/yachse.js', args: [], browser: true },
  { n: 'hierarchie', s: 38, d: 'Schrifthierarchie: Seitentitel 24/800 > Kartentitel 17/700 > Text, jede Karte mit ⓘ, alle Seiten', f: 'check/hierarchie.js', args: [], browser: true },
  { n: 'einheit',   s: 42,  d: 'Filter/Zeitfilter/ⓘ/Candles|Line an festen Stellen auf allen Seiten', f: 'check/einheit.js', args: [], browser: true },
  { n: 'datalayout', s: 27, d: 'Data: bis 8 Panels, Charts fuellen den Bildschirm, kompakter Kopf', f: 'check/datalayout.js', args: [], browser: true },
  { n: 'kopfleiste', s: 27, d: 'Asset-Kopf: Knoepfe gross, mittig, rechtsbuendig, Zahnrad = Schrifthoehe', f: 'check/kopfleiste.js', args: [], browser: true },
  { n: 'zellen',    s: 44,  d: 'Werte-Zellen der Indikator-Tabellen: kein Ueberlauf, kein Satz, kein Deutsch', f: 'check/zellen.js', args: [], browser: true },
  { n: 'zeitfilter', s: 28, d: 'Zeitfilter: gross 3M..10Y/Max, Mini 6M/1Y/6Y/Max, nur mit Daten, rechtsbuendig', f: 'check/zeitfilter.js', args: [], browser: true },
  { n: 'trend',     s: 22,  d: 'Trend 1D/4H: EMA20 +-0,25 ATR, 1D in Node nachgerechnet, Schalter, Overlay', f: 'check/trend.js', args: [], browser: true },
  { n: 'fliesstext', s: 47, d: 'Kein Fliesstext: alle Tabs, Asset-Seite, jedes ⓘ-Fenster und Help nur Punkte/Fakten', f: 'check/fliesstext.js', args: [], browser: true },
  { n: 'pcbewegung', s: 3,  d: 'PC/Windows: Animationen haengen an den App-Schaltern, nicht an prefers-reduced-motion', f: 'check/pcbewegung.js', args: [], browser: true },
  { n: 'positionen', s: 25, d: 'COT als Linie mit Score-Zonen, Retail/COT-Liste als Abweichung von 50 % - gleiche Zahlen, Balken px-genau', f: 'check/positionen.js', args: [], browser: true },
  { n: 'scrollfuell', s: 30, d: 'Mausrad ueber Karten scrollt die Seite, History fuellt ihre Reihe, ⓘ in der Quellenzeile, Dashboard-Karten direkt aneinander', f: 'check/scrollfuell.js', args: [], browser: true },
  { n: 'tabellenfest', s: 30, d: 'Innere Scrollbereiche federn nicht ueber ihre Raender (overscroll none)', f: 'check/tabellenfest.js', args: [], browser: true },
  { n: 'scorenachrechnung', s: 59, d: 'Score unabhaengig nachgerechnet (Indikator bis Paar, Staerke), jede angezeigte Score-Zahl, Datumsgrenze', f: 'check/scorenachrechnung.js', args: [], browser: true },
  { n: 'regeln',    s: 24,  d: 'COT, Rendite-Trends, 2Y-Zinsdifferenz, Carry, Rohstoffe, Score-Fenster, Momentum weg', f: 'check/regeln.js', args: [], browser: true },
  { n: 'niveau',    s: 23,  d: 'Niveau-Block: Inflation vs Ziel, Arbeitslosigkeit und Loehne gegen ihr Normal - relativ zu den Peers, unabhaengig nachgerechnet; entfernte Zeilen stehen nirgends', f: 'check/niveau.js', args: [], browser: true },
  { n: 'makro',     s: 82,  d: 'Makro: Schalter je Karte, Reiter-Karte, Spurkopf = Tabellenzeile, Ziellinie, Analyse-Werkzeuge, Sync-Weg, Tempo (Teil-Aufbau)', f: 'check/makro.js', args: [], browser: true },
  { n: 'trades',    s: 50,  d: 'Journal: kein Trade geht verloren - Abgleich laedt eigene hoch, alte App, zwei Tabs, Upload-Fehler sichtbar + Wiederholung, Grabstein', f: 'check/trades.js', args: [], browser: true },
  { n: 'altgeraet', s: 46,  d: 'Noch offene alte App loescht keine neuen Felder, bewusste Aenderungen kommen an, veraltete App laedt nicht hoch, Basis ueberlebt Neuladen', f: 'check/altgeraet.js', args: [], browser: true },
  { n: 'zeitspanne', s: 71, d: 'Zeitspanne per Ziehen an allen Charts mit Zeitfilter: Chip mit ×, weniger Punkte, × stellt her, Touch per langem Druck', f: 'check/zeitspanne.js', args: [], browser: true },
  { n: 'kartentitel', s: 32, d: 'Kartentitel einheitlich 17 px, Info-i blau und kleiner, Notizen in Bias-Farbe', f: 'check/kartentitel.js', args: [], browser: true },
  { n: 'kalender',  s: 24,  d: 'Kalender-Karte: vergangene Tage blass mit Punkt, Releases aus der Historie; Next-Termine inkl. gleicher Veroeffentlichung', f: 'check/kalender.js', args: [], browser: true },
  { n: 'namen',     s: 217, d: 'Asset-/Paarnamen nie gekuerzt (auch mit breiter Schrift wie auf dem iPad), Set-ups-Chip bleibt in seiner Zelle', f: 'check/namen.js', args: [], browser: true },
  { n: 'scrollhalt', s: 103, d: 'Asset-Seite neu gezeichnet: Scrollstand bleibt (WebKit nachgestellt)', f: 'check/scrollhalt.js', args: [], browser: true },
  { n: 'rahmen',    s: 28,  d: 'dunkle Koepfe/Bedienelemente: jeder Text lesbar (helle Vorlage Terminal Pro)', f: 'check/rahmen.js', args: [], browser: true },
  { n: 'cards',     s: 150, d: 'Text/Elemente verlassen nie den Kartenrand (alle Tabs)', f: 'check/cards.js', args: [], browser: true },
  { n: 'nav',       s: 162, d: 'Sidebar-Klickregel, mit Maus UND mit Touch', f: 'check/nav.js', args: [], browser: true },
  { n: 'typo',      s: 35,  d: 'Schrifthierarchie in allen Fenstern', f: 'check/typo.js', args: [], browser: true },
  // Rechnet je Vorlage (Terminal Pro, Midnight Term) Kontrast und Bedeutung
  // nach. ⚠ Bedeutung ueber den FARBTON, nicht ueber Helligkeit - Blau und
  // Rot koennen gleich hell und trotzdem eindeutig sein.
  { n: 'theme',     s: 2,   d: 'Design-Vorlagen Terminal Pro + Midnight Term: Kontrast, Bedeutungsfarben, Tokens', f: 'check/theme.js', args: [], browser: true },
  { n: 'kerzen',    s: 28,  d: 'Kerzen: ein Tag, kein Wochenende, eigene Farben, keine erfundenen Dochte', f: 'check/kerzen.js', args: [], browser: true },
  { n: 'seasretail', s: 28, d: 'Saisonalitaet/Retail: Schwellen, Deckel, Monats-Markierung', f: 'check/seasretail.js', args: [], browser: true },
  { n: 'feedgroesse', s: 1, d: 'Live-Feeds: Groessendeckel, keine Einrueckung, eine Frist', f: 'check/feedgroesse.js', args: [], browser: false },
  { n: 'kalendervorschau', s: 1, d: '3-Monats-Kalender: Workflow-Schritt gegen nachgebaute Quellen, FXStreet-Namen, keine TV-Low-Termine, ins TV-Fenster gerueckte Releases', f: 'check/kalendervorschau.js', args: [], browser: false },
  { n: 'feedregeln', s: 1,  d: 'Indikator-Feed: NFP ohne Benchmark-Revision, US-PMI nur ISM, Bereinigung eingeschleppter Historienpunkte', f: 'check/feedregeln.js', args: [], browser: false },
  // csskomm + inlinest: beide 2026-09-19 aus einem Fehler derselben Sitzung
  // (ein CSS-Kommentar verschluckte Regeln, ein Inline-style hebelte eine
  // Zustandsregel aus). Statisch, deshalb im schnellen Teil.
  { n: 'csskomm',   s: 1,   d: 'Kein CSS-Kommentar verschluckt Regeln', f: 'check/csskommentar.js', args: [], browser: false },
  { n: 'inlinest',  s: 1,   d: 'Kein Inline-style, der eine Zustandsregel aushebelt', f: 'check/inlinestyle.js', args: [], browser: false },
  { n: 'kartenlook', s: 34, d: 'Kartenoptik und Kopfleiste der Asset-Seite', f: 'check/kartenlook.js', args: [], browser: true },
  { n: 'regime',    s: 29,  d: 'Regime Radar: Zahlen gegen die Rohdaten, Nenner, Kernbedingung', f: 'check/regime.js', args: [], browser: true },
  { n: 'historie',  s: 70,  d: 'Historie: Score-Linie, Alterung nachgerechnet, jeder Tag einzeln', f: 'check/historie.js', args: [], browser: true },
  { n: 'versionssicht', s: 87, d: 'Kopfzeile: Versionsnummer ab 1000px voll sichtbar, Suchfeld gibt nach', f: 'check/versionssicht.js', args: [], browser: true },
  // 2026-09-26: jede Score-Aenderung mit exakter Ursache (Nutzer: "alles was
  // den Score aendert aufgezeichnet ... kein Wert soll leer bleiben").
  { n: 'journal',   s: 85,  d: 'Score-Journal: jede Bewegung mit Ursache, Teile = Veraenderung, kein leerer Wert', f: 'check/journal.js', args: [], browser: true },
  { n: 'zurueck',   s: 88,  d: 'Nichts springt zurueck: Abgleich waehrend der Eingabe, jede Nutzer-Aenderung markiert, Push waehrend der Eingabe', f: 'check/zurueck.js', args: [], browser: true },
  { n: 'eingaben',  s: 172, d: 'Kein Fenster verliert Eingaben beim Schliessen, Nachfrage in Bias-Farben, Knopfleiste fest unten', f: 'check/eingaben.js', args: [], browser: true },
  { n: 'filterreset', s: 36, d: '✕ neben Asset-Dropdowns mit "alle"-Ansicht: nur bei Auswahl, direkt daneben, setzt zurueck', f: 'check/filterreset.js', args: [], browser: true },
  { n: 'designregeln', s: 461, d: 'Design-Audit: keine Emojis, eine Schrift, Diagramm-/Mindestschrift 11 px, 3 Hoehen, Trefferflaechen ohne Ueberdeckung, aktiv Navy, Rot nur bearish', f: 'check/designregeln.js', args: [], browser: true },
  // 2026-10-03: "es ruckelt ... Animationen nicht clean ... hakt" - zaehlt statt zu stoppen.
  { n: 'performance', s: 116, d: 'Endlos-Animationen nur transform/opacity, max. 400 gleichzeitig, nichts haengt nach, Leerlauf ohne Vermessung, ein Aufbau je Asset-Wechsel', f: 'check/performance.js', args: [], browser: true },
  { n: 'backtester', s: 34, d: 'Backtester: Sitzungen, Releases, Kursreaktion gegen die Rohdaten', f: 'check/backtester.js', args: [], browser: true },
  { n: 'erklaerung', s: 283, d: 'Erklaerungen hinter dem ⓘ, zentriert, nicht in der Karte', f: 'check/erklaerung.js', args: [], browser: true },
];

// ── Pakete fuer --teil: laengste Einheit zuerst in das kuerzeste Paket ──
// Rein aus PRUEFUNGEN berechnet, also in jedem CI-Job gleich - jeder Job
// rechnet die Aufteilung selbst und nimmt sich sein Paket.
function pakete(n) {
  const kette = PRUEFUNGEN.filter(p => p.kette);
  const einheiten = [{ p: kette, s: kette.reduce((a, p) => a + p.s, 0) },
    ...PRUEFUNGEN.filter(p => p.browser && !p.kette).map(p => ({ p: [p], s: p.s }))];
  einheiten.sort((a, b) => b.s - a.s);
  const t = Array.from({ length: n }, () => ({ s: 0, p: [] }));
  einheiten.forEach(e => { const k = t.reduce((m, x) => (x.s < m.s ? x : m)); k.p.push(...e.p); k.s += e.s; });
  t.forEach(k => k.p.sort((a, b) => PRUEFUNGEN.indexOf(a) - PRUEFUNGEN.indexOf(b)));
  return t;
}

function auswahl() {
  if (nurArg) {
    const namen = nurArg.split(',').map(x => x.trim().replace(/^check\//, '').replace(/\.js$/, '')).filter(Boolean);
    const unbekannt = namen.filter(x => !PRUEFUNGEN.some(p => p.n === x || p.f === `check/${x}.js`));
    if (unbekannt.length) { console.error(`Unbekannt: ${unbekannt.join(', ')} (Namen siehe node check/all.js --liste)`); process.exit(2); }
    return PRUEFUNGEN.filter(p => namen.includes(p.n) || namen.some(x => p.f === `check/${x}.js`));
  }
  if (teilArg) {
    const m = /^(\d+)\/(\d+)$/.exec(teilArg);
    if (!m || +m[1] < 1 || +m[1] > +m[2]) { console.error('--teil erwartet i/n, z. B. 2/6'); process.exit(2); }
    return pakete(+m[2])[+m[1] - 1].p;
  }
  return PRUEFUNGEN.filter(p => !nurStatisch || !p.browser);
}

function serverErreichbar() {
  return new Promise(ok => {
    const anf = http.get(URL, r => { r.resume(); ok(true); });
    anf.on('error', () => ok(false));
    anf.setTimeout(2500, () => { anf.destroy(); ok(false); });
  });
}

(async () => {
  const liste = auswahl();
  if (nurListe) {
    const n = teilArg ? +teilArg.split('/')[1] : 0;
    if (n && !nurArg) pakete(n).forEach((k, i) => console.log(`Teil ${i + 1}/${n} ~${Math.round(k.s / 60)} min (${k.p.length}): ${k.p.map(p => p.n).join(', ')}`));
    else liste.forEach(p => console.log(`${p.n.padEnd(18)} ${String(p.s).padStart(4)} s  ${p.browser ? 'Browser' : 'statisch'}  ${p.d}`));
    return;
  }
  // Der Testserver wird BEWUSST nicht von hier gestartet: ein Kindprozess,
  // der den Lauf ueberdauert, verhaelt sich je nach Umgebung unterschiedlich.
  // Lokal einmal pro Sitzung starten, in der CI als eigener Schritt:
  //   python3 -m http.server 8935 --directory . &
  if (liste.some(p => p.browser) && !(await serverErreichbar())) {
    console.error(`Kein Testserver auf ${URL}.\n` +
      `  Starten mit:  python3 -m http.server ${PORT} --directory . &\n` +
      `  Oder nur die statischen Pruefungen fahren:  node check/all.js --static`);
    process.exit(1);
  }
  const fehlgeschlagen = [], zeiten = [];
  const T0 = Date.now();
  for (const p of liste) {
    const t0 = Date.now();
    const r = spawnSync('node', [p.f, ...p.args], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: Object.assign({}, process.env, { CHECK_URL: URL })
    });
    const s = Math.round((Date.now() - t0) / 100) / 10;
    zeiten.push([p.n, s]);
    const aus = (r.stdout || '') + (r.stderr || '');
    // Die Playwright-Skripte melden Befunde als JSON und beenden mit 0 -
    // deshalb zusaetzlich auf einen Befund-Zaehler groesser 0 pruefen.
    const zahl = (aus.match(/"(?:fehler|total)"\s*:\s*(\d+)/) || [])[1];
    const schlecht = r.status !== 0 || (zahl != null && Number(zahl) > 0);
    console.log(`${schlecht ? '✗' : '✓'} ${p.n.padEnd(10)} ${String(s + 's').padStart(6)}  ${p.d}`);
    if (schlecht) { fehlgeschlagen.push(p.n); console.log(aus.split('\n').slice(0, 40).map(l => '     ' + l).join('\n')); }
  }
  const ges = Math.round((Date.now() - T0) / 1000);
  if (liste.length > 3) console.log(`\n${liste.length} Pruefungen in ${Math.floor(ges / 60)} min ${ges % 60} s` +
    `${teilArg ? ` (Teil ${teilArg})` : ''}; laengste: ${zeiten.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, s]) => `${n} ${s}s`).join(', ')}`);
  if (fehlgeschlagen.length) {
    console.error(`\nNICHT BESTANDEN: ${fehlgeschlagen.join(', ')}`);
    process.exit(1);
  }
  console.log('Alle Waechter gruen.');
})();
