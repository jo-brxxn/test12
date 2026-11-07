// ══ WAECHTER: WELTKUGEL IN WEBKIT (Safari-Engine, iPad-Pixeldichte 2) ═══════
//
// Nutzer-Ziel 2026-11-06: "dass sich die Weltkugel ohne neu zu laden perfekt
// dreht ohne zu haengen". Das iPad nutzt WebKit - Chromium-Messungen allein
// belegen das nicht. Dieser Waechter misst die Kugel im vollen Dashboard in
// WebKit bei Pixeldichte 2 (wie das iPad):
//   A) Zeichenweg: Web Worker mit eigenem Bildtakt (OffscreenCanvas)
//   B) Kugel allein >= 58 Zeichnungen/s, p95 <= 20 ms, <= 2 % Bilder > 20 ms;
//      im vollen Dashboard >= 54/s, p95 <= 26 ms (vom Worker gemeldete Bild-
//      abstaende; abwechselnd je 4 Laeufe a 5 s nach einem Aufwaermlauf)
//   C) 0 Dokument-Aenderungen in der Kugel-Karte (sonst setzt der Browser die
//      ganze Seite je Bild neu zusammen)
//   D) Rueckkehr ins Dashboard ohne Neuaufbau, Marker-Tipp oeffnet das Asset
//   E) gleichmaessige Drehung: nie rueckwaerts, Tempo 4 Grad/s +-10 % (p5/p95)
// GEMESSEN 2026-11-07 (Container ohne GPU - WebKit setzt den Bildschirm auf der
// CPU zusammen, die Untergrenze liegt hier bei p95 ~21-24 ms): vorher 47-50/s,
// p95 39 ms (zwei Canvas + feste Ebenen + flackernde Duesenflamme im SVG);
// nachher 60-62/s, p95 21-22 ms.
// WebKit ist nicht ueberall installiert (CI: nur Chromium) - dann wird
// uebersprungen (Exit 0 mit Hinweis). Installation lokal:
//   PLAYWRIGHT_BROWSERS_PATH=<ordner> node <playwright>/cli.js install webkit && ... install-deps webkit
//   PLAYWRIGHT_BROWSERS_PATH=<ordner> node check/webkitkugel.js
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
let webkit;
try { ({ webkit } = require(PW)); } catch (e) { try { ({ webkit } = require('playwright')); } catch (e2) {} }
const PORT = process.env.PORT || 8935;
const GP = process.argv.includes('--gegenprobe');   // Kugel im Hauptthread (ohne Worker) -> A rot
const URL = process.env.CHECK_URL || `http://127.0.0.1:${PORT}/index.html`;
(async () => {
  let b;
  try { b = await webkit.launch(); } catch (e) { console.log('webkitkugel: uebersprungen (WebKit nicht installiert: ' + String(e.message || e).split('\n')[0].slice(0, 80) + ')'); process.exit(0); }
  const F = [];
  const p = await b.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
  if (GP) await p.addInitScript(() => { window.__globusOhneWorker = true; });
  await p.addInitScript(() => { try { sessionStorage.setItem('fxpro_unlocked', '1'); localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  await p.goto(URL); await p.waitForTimeout(8000);
  await p.evaluate(() => { const l = document.getElementById('lockScreen'); if (l) l.remove(); showTab('dash'); const g = document.getElementById('dbGlobe'); if (g) g.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(3500);
  const modus = await p.evaluate(async () => { const m = await import('/js/globe.js'); return m._globeHosts.map(s => s.modus + (s.workerRaf ? '+takt' : '')).join(','); });
  if (modus !== 'worker+takt') F.push(`A: Zeichenweg "${modus}" statt Worker mit eigenem Bildtakt`);
  // Abwechselnd gemessen (Lastschwankungen treffen beide gleich): Dashboard wie
  // es ist und die Kugel allein; 1 Aufwaermlauf, dann je 4 Laeufe a 5 s.
  await p.evaluate(() => { const st = document.createElement('style'); st.id = 'wkVgl'; document.head.appendChild(st); });
  const lauf = css => p.evaluate(async css => {
    document.getElementById('wkVgl').textContent = css; document.getElementById('dbGlobe').scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 800));
    const card = document.getElementById('dbGlobe'); let mut = 0; const mo = new MutationObserver(m => { mut += m.length; });
    mo.observe(card, { subtree: true, attributes: true, childList: true, characterData: true });
    const z0 = window.__globusZeichnungen || 0; window.__globusLuecken = []; window.__globusWinkel = []; const t0 = performance.now();
    await new Promise(r => setTimeout(r, 5000)); mo.disconnect();
    const s = (performance.now() - t0) / 1000, a = (window.__globusLuecken || []).slice().sort((x, y) => x - y);
    const tempo = (() => { const W = (window.__globusWinkel || []).slice(), v = []; for (let i = 1; i < W.length; i++) { const dt = (W[i][0] - W[i - 1][0]) / 1000; if (dt > 0.004) v.push((((W[i][1] - W[i - 1][1]) % 360 + 540) % 360 - 180) / dt); } v.sort((a, b) => a - b); return v.length ? { n: v.length, rueck: v.filter(x => x < 0).length, med: v[v.length >> 1], p5: v[Math.floor(v.length * .05)], p95: v[Math.floor(v.length * .95)] } : null; })();
    return { jeS: ((window.__globusZeichnungen || 0) - z0) / s, p95: a.length ? a[Math.floor(a.length * .95)] : 999, ueber: a.filter(v => v > 20).length / Math.max(1, a.length) * 100, mut, tempo };
  }, css);
  const ALLEIN = '.dx-top,.dx-r3,.dx-r4,.dx-r5,[data-slot=markt],.hdr,#navSidebar{display:none!important}*{animation:none!important}';
  await lauf('');
  const D = [], K = [];
  for (let i = 0; i < 4; i++) { D.push(await lauf('')); K.push(await lauf(ALLEIN)); }
  await lauf('');
  const m = (a, f) => a.reduce((x, r) => x + r[f], 0) / a.length;
  const jeS = m(D, 'jeS'), p95 = m(D, 'p95'), kJeS = m(K, 'jeS'), kP95 = m(K, 'p95'), kU = m(K, 'ueber'), mut = D.reduce((x, r) => x + r.mut, 0);
  if (kJeS < 58 || kP95 > 20 || kU > 2) F.push(`B: Kugel allein ${kJeS.toFixed(1)} Zeichnungen/s, p95 ${kP95.toFixed(1)} ms, ${kU.toFixed(0)} % > 20 ms (verlangt >= 58/s, p95 <= 20 ms, <= 2 %)`);
  // E) gleichmaessige Drehung (Nutzer-Fotos 2026-11-07: vor und zurueck, -22 bis +19 Grad/s)
  [...D, ...K].forEach((r, i) => { const t = r.tempo; if (!t) F.push('E: keine Winkel vom Worker'); else if (t.rueck > 0 || t.p5 < 3.6 || t.p95 > 4.4) F.push(`E: Drehung ungleichmaessig (Lauf ${i + 1}): ${t.rueck} rueckwaerts, Tempo ${t.p5.toFixed(2)}-${t.p95.toFixed(2)} Grad/s, Median ${t.med.toFixed(2)} (soll 4)`); });
  if (jeS < 54 || p95 > 26) F.push(`B: Kugel im Dashboard ${jeS.toFixed(1)} Zeichnungen/s, p95 ${p95.toFixed(1)} ms (verlangt >= 54/s, p95 <= 26 ms)`);
  if (mut > 0) F.push(`C: Kugel-Karte ${mut}x im Dokument veraendert in 20 s`);
  const d = await p.evaluate(async () => {
    const s0 = document.querySelector('#dashGlobeHost svg'); showTab('cal'); await new Promise(r => setTimeout(r, 700)); showTab('dash'); await new Promise(r => setTimeout(r, 1200));
    document.getElementById('dbGlobe').scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 400));
    return { gleich: document.querySelector('#dashGlobeHost svg') === s0, mk: (window.__globeMarkerPositionen() || [])[0] };
  });
  if (!d.gleich) F.push('D: Kugel nach Seitenwechsel neu aufgebaut');
  if (d.mk) { await p.mouse.click(d.mk.x, d.mk.y); await p.waitForTimeout(800); const pg = await p.evaluate(() => curPage); if (pg !== 'cur') F.push(`D: Marker ${d.mk.id} getippt -> Seite ${pg} statt Asset`); }
  else F.push('D: keine sichtbaren Marker');
  await b.close();
  if (GP) { const ok = F.some(f => f.startsWith('A:')); console.log(ok ? 'webkitkugel --gegenprobe: ok (Hauptthread-Zeichnen wird gemeldet)' : 'webkitkugel --gegenprobe: FEHLER - nicht gemeldet'); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('webkitkugel: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`webkitkugel: ok (WebKit, Pixeldichte 2, ${modus}: Kugel allein ${kJeS.toFixed(1)}/s p95 ${kP95.toFixed(1)} ms ${kU.toFixed(0)} % > 20 ms; im Dashboard ${jeS.toFixed(1)}/s p95 ${p95.toFixed(1)} ms; 0 Dokument-Aenderungen, Rueckkehr ohne Neuaufbau, Marker-Tipp oeffnet Asset, Drehung gleichmaessig 4 Grad/s ohne Rueckwaerts-Schritt)`);
})().catch(e => { console.error(e); process.exit(2); });
