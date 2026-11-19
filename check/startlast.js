// ── STARTLAST GEMESSEN: WELCHE DATEN LAEDT DIE APP BEIM START WIRKLICH? (seit 2026-11-19, VERSION-CHECK-767) ──
// Anlass: check/feedgroesse.js rechnete mit einer von Hand gefuehrten Liste. Gemessen am 2026-11-19:
// gezaehlt wurden price_hist (665 KB), country_data, fng_hist, rate_probabilities - die laden beim Start
// gar nicht; uebersehen wurden globe_land (231 KB), commodity_data (74 KB), country_shapes (29 KB), die
// laden. Angenommen 3675 KB, wirklich 3263 KB. Ein Deckel auf einer falschen Liste schuetzt nichts.
// Hier wird die App geladen (Dashboard, 1194 und 390 px) und jede .json-Antwort mitgeschnitten:
//  A) jede beim Start geladene Datei steht in FEEDS (feedgroesse.js) - sonst fehlt sie in der Summe
//  B) jede Datei aus EINZELN (nur bei Bedarf) laedt beim Start NICHT
//  C) die gemessene Startsumme liegt unter GESAMT_KB
// --gegenprobe: globe_land.json aus FEEDS gestrichen -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const fs = require('fs'), path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const fg = fs.readFileSync(path.join(__dirname, 'feedgroesse.js'), 'utf8');
const liste = name => { const m = fg.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`)); return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : null; };
let FEEDS = liste('FEEDS'); const EINZELN = liste('EINZELN'); const GESAMT = +((fg.match(/const GESAMT_KB = (\d+)/) || [])[1]);
if (GP) FEEDS = FEEDS.filter(f => f !== 'globe_land.json');
(async () => {
  const F = [];
  if (!FEEDS || !EINZELN || !GESAMT) { console.log('startlast: ABBRUCH - Listen in feedgroesse.js nicht gelesen'); process.exit(1); }
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const L = new Map();
    p.on('response', async r => { const u = r.url(); if (!/\.json(\?|$)/.test(u) || !u.includes('127.0.0.1')) return; const n = u.split('?')[0].split('/').slice(-2).join('/').replace(/^[^/]*\//, ''); let g = 0; try { g = (await r.body()).length; } catch (e) { } L.set(n, g); });
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(6000);
    const o = W + 'px';
    const daten = [...L.keys()].filter(n => !/^(manifest|skills-lock)\.json$/.test(n) && !n.includes('/'));
    daten.filter(n => !FEEDS.includes(n)).forEach(n => F.push(`${o} A: ${n} (${Math.round(L.get(n) / 1024)} KB) laedt beim Start, steht aber nicht in FEEDS`));
    daten.filter(n => EINZELN.includes(n)).forEach(n => F.push(`${o} B: ${n} steht in EINZELN (nur bei Bedarf), laedt aber beim Start`));
    const summe = daten.reduce((s, n) => s + L.get(n), 0) / 1024;
    if (summe > GESAMT) F.push(`${o} C: Startlast ${Math.round(summe)} KB > ${GESAMT} KB`);
    if (W === 1194) console.log(`[startlast] ${daten.length} Dateien, ${Math.round(summe)} KB: ` + daten.map(n => n.replace('.json', '') + ' ' + Math.round(L.get(n) / 1024)).join(', '));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: globe_land/.test(f)); console.log(ok ? 'startlast --gegenprobe: ok (fehlende Datei in FEEDS gemeldet)' : 'startlast --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('startlast: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('startlast: ok (jede Start-Datei in FEEDS, nichts aus EINZELN beim Start, Summe unter ' + GESAMT + ' KB, 1194/390 px)');
})().catch(e => { console.log('startlast: ABBRUCH ' + e.message); process.exit(1); });
