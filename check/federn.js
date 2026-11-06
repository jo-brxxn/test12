// ══ WAECHTER: NATIVES iOS-FEDERN DER SEITEN ══════════════════════════════════
//
// Nutzer 2026-11-06: "bau wieder das normale iOS bouncen ein beim scrollen".
// Zurueck zum Stand vor 2026-11-01: die SEITEN-Scroller (.pc, .detail) haben
// das native Gummiband (overscroll-behavior-y: auto), Listen und Tabellen in
// Karten stehen fest (*{overscroll-behavior:none}, geprueft von
// check/tabellenfest.js). Das eigene Leicht-Federn (js/federn.js, 2026-11-01
// bis 675) ist aus.
// Geprueft:
//   A) jede sichtbare Seite (.pc) und die Asset-Detailspalte (.detail):
//      overscroll-behavior-y auto
//   B) federnAn() wird in js/main.js nicht mehr gestartet
// Gegenprobe: --gegenprobe (Seiten wieder none) -> A rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const F = [];
if (/^\s*try\{federnAn\(\);\}catch\(e\)\{\}/m.test(MAIN)) F.push('B: federnAn() laeuft noch - eigenes Federn kaeme zum nativen dazu');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { const e = document.getElementById('lockScreen'); if (e) e.remove(); });
  if (GP) await p.addStyleTag({ content: '.pc,.detail{overscroll-behavior:none!important}' });
  for (const t of ['dash', 'cal', 'trends', 'cur']) {
    const r = await p.evaluate(t => { showTab(t); return [...document.querySelectorAll('.pc,.detail')].filter(e => e.offsetParent).map(e => ({ id: e.id || e.className.slice(0, 20), y: getComputedStyle(e).overscrollBehaviorY })); }, t);
    await p.waitForTimeout(300);
    r.forEach(x => { if (x.y !== 'auto') F.push(`A: ${t} ${x.id} overscroll-behavior-y ${x.y} statt auto (kein natives Federn)`); });
  }
  await b.close();
  if (GP) { const ok = F.some(f => f.startsWith('A:')); console.log(ok ? 'federn --gegenprobe: ok (Seite ohne Federn wird gemeldet)' : 'federn --gegenprobe: FEHLER - nicht gemeldet'); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('federn: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('federn: ok (Seiten federn nativ, eigenes Federn aus)');
})();
