// ── ALTE KERZEN BEI BEDARF (price_ohlc.json, seit 2026-11-16, VERSION-CHECK-735) ──
// Nutzer 2026-11-16: "Es werden ja nur die letzt 100 Tage oder so an Preis gebraucht fuer
// Score der Rest kann ja in eine andere Datei und bei Bedarf geladen werden".
// price_data.json lag bei 896/900 KB. Seitdem lagert tools/kerzen-auslagern.mjs
// Open/High/Low aelter als 183 Tage nach price_ohlc.json aus; der Schluss bleibt.
// Der Waechter baut die geteilten Dateien selbst aus dem aktuellen price_data.json
// (unabhaengig davon, ob der Feed schon geteilt hat) und liefert sie dem Browser:
//  A) Rundreise: auslagern + --einlesen ergibt bitgenau das Original
//  B) Score-Pfade lesen das Archiv nie (score.js, trendTagesReihe nur priceSeriesFor)
//  C) GOLD 3M: price_ohlc.json wird NICHT geholt (Start bleibt schlank)
//  D) GOLD 1Y: price_ohlc.json wird geholt, eine Kerze vor 200 Tagen hat wieder Hoch/Tief
//  E) alle Scores vor und nach dem Laden des Archivs identisch
// --gegenprobe: der Lade-Ausloeser der Price-Karte fehlt -> D rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path'); const os = require('os');
const { execFileSync } = require('child_process');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const ROOT = path.join(__dirname, '..');
(async () => {
  const F = [];
  // A) Dateien bauen + Rundreise
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kerzen-'));
  const orig = fs.readFileSync(path.join(ROOT, 'price_data.json'), 'utf8');
  fs.writeFileSync(path.join(tmp, 'price_data.json'), orig);
  const oa = path.join(ROOT, 'price_ohlc.json'); if (fs.existsSync(oa)) fs.copyFileSync(oa, path.join(tmp, 'price_ohlc.json'));
  const tool = path.join(ROOT, 'tools', 'kerzen-auslagern.mjs');
  // erst alles zurueck (falls der Feed schon geteilt hat), dann frisch teilen
  execFileSync('node', [tool, '--einlesen', tmp]); const voll = fs.readFileSync(path.join(tmp, 'price_data.json'), 'utf8');
  execFileSync('node', [tool, tmp]);
  const geteilt = fs.readFileSync(path.join(tmp, 'price_data.json'), 'utf8'), archiv = fs.readFileSync(path.join(tmp, 'price_ohlc.json'), 'utf8');
  execFileSync('node', [tool, '--einlesen', tmp]);
  if (fs.readFileSync(path.join(tmp, 'price_data.json'), 'utf8') !== voll) F.push('A: auslagern + einlesen ergibt NICHT das Original');
  if (geteilt.length >= voll.length) F.push(`A: price_data.json nach dem Teilen nicht kleiner (${voll.length} -> ${geteilt.length})`);
  // B) statisch
  const score = fs.readFileSync(path.join(ROOT, 'js', 'score.js'), 'utf8'), main = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  if (/priceSeriesAnzeige|PRICE_OHLC|price_ohlc/.test(score)) F.push('B: score.js liest das Kerzen-Archiv');
  const tr = (main.match(/function trendTagesReihe[\s\S]*?\n}\n/) || [''])[0];
  if (!tr || /priceSeriesAnzeige|preisReiheLang|preisReiheAnzeige/.test(tr)) F.push('B: trendTagesReihe liest die Anzeige-Reihe (mit Archiv) statt priceSeriesFor');
  const df = fs.readFileSync(path.join(ROOT, 'js', 'data-feeds.js'), 'utf8'), tl = fs.readFileSync(path.join(ROOT, 'tools', 'kerzen-auslagern.mjs'), 'utf8');
  const kt = x => (x.match(/KERZEN_TAGE\s*=\s*(\d+)/) || [])[1];
  if (!kt(df) || kt(df) !== kt(tl)) F.push(`B: KERZEN_TAGE App ${kt(df)} != Werkzeug ${kt(tl)} - die App laedt das Archiv sonst zu spaet oder zu frueh`);
  // Browser
  const b = await chromium.launch();
  const lauf = async range => {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 1024 }, serviceWorkers: 'block' });
    let geholt = 0;
    await ctx.route(/\/price_data\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: geteilt }));
    await ctx.route(/\/price_ohlc\.json/, r => { geholt++; r.fulfill({ status: 200, contentType: 'application/json', body: archiv }); });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace("if(!FX.includes(c.id)){const f=abFenster();kerzenArchivBei(c.id,f.max?null:f.von);}", ''); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(r => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.setItem('fxpro_ab_range', r); } catch (e) { } }, range);
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(2500);
    const vor = await p.evaluate(() => syms.map(s => s.id + ':' + symScore(s)).join('|'));
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); gotoSym('GOLD'); });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const g = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10); const s = preisReiheAnzeige('GOLD') || []; const e = s.find(x => x[0] >= g); return { e, nach: syms.map(s => s.id + ':' + symScore(s)).join('|') }; });
    err.forEach(e => F.push(range + ' JS-Fehler: ' + e));
    await ctx.close();
    return { geholt, kerze: r.e, gleich: vor === r.nach };
  };
  const C = await lauf('3M');
  if (C.geholt) F.push('C: bei 3M wurde price_ohlc.json geholt (' + C.geholt + 'x) - gehoert nur zu langen Zeitraeumen');
  const D = await lauf('1Y');
  if (!D.geholt) F.push('D: bei 1Y wurde price_ohlc.json nicht geholt');
  else if (!D.kerze || D.kerze.length < 5) F.push('D: GOLD-Kerze vor 200 Tagen ohne Hoch/Tief nach dem Laden: ' + JSON.stringify(D.kerze));
  if (!D.gleich) F.push('E: Scores nach dem Laden des Archivs anders als vorher');
  await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
  if (GP) { const ok = F.some(f => /^D:/.test(f)); console.log(ok ? 'kerzenarchiv --gegenprobe: ok (fehlendes Nachladen gemeldet)' : 'kerzenarchiv --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('kerzenarchiv: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`kerzenarchiv: ok (price_data.json ${(voll.length / 1024).toFixed(0)} -> ${(geteilt.length / 1024).toFixed(0)} KB, Archiv ${(archiv.length / 1024).toFixed(0)} KB, Rundreise bitgenau, 3M laedt nichts nach, 1Y laedt die Kerzen, Scores unveraendert)`);
})().catch(e => { console.log('kerzenarchiv: ABBRUCH ' + e.message); process.exit(1); });
