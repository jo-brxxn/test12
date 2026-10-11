// ── PC (WINDOWS): ANIMATIONEN HAENGEN AN DEN APP-SCHALTERN, NICHT AM SYSTEM ──
// Nutzer 2026-10-11 (Windows + Chrome): "am pc funktioniert die start
// Animation nicht". Ursache: Windows "Animationseffekte aus" -> Chrome meldet
// prefers-reduced-motion:reduce -> 15 CSS-Bloecke + wischErlaubt() schalteten
// Lade-Logo, Seitenwechsel und Einblendungen ab. Seitdem entscheiden allein
// die App-Schalter (Settings, synchronisiert; CSS: body.no-ui-anim).
//   A) statisch: kein @media (prefers-reduced-motion ...) in index.html, kein
//      matchMedia('(prefers-reduced-motion ...)') in js/*.js
//   B) Browser mit reducedMotion:'reduce' (1920x1080): das Lade-Logo animiert
//   C) dieselbe Seite mit body.no-ui-anim: das Lade-Logo steht (Schalter wirkt)
//   node check/pcbewegung.js [--gegenprobe]  (Gegenprobe: die alte
//   @media-Regel wieder eingesetzt -> B rot)
const fs = require('fs'), path = require('path');
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const n1 = (html.match(/@media\s*\(\s*prefers-reduced-motion/g) || []).length;
if (n1) fail('A STATISCH', `${n1}x @media (prefers-reduced-motion) in index.html - das schaltet unter Windows "Animationseffekte aus" die App-Animationen ab`);
fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => {
  const t = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  if (/matchMedia\(\s*['"]\(prefers-reduced-motion/.test(t)) fail('A STATISCH', `js/${f} fragt prefers-reduced-motion ab`);
});
(async () => {
  const b = await chromium.launch();
  for (const aus of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(([gp, aus]) => {
      window.__ladeTest = 1;
      if (gp) document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '@media(prefers-reduced-motion:reduce){.fxlogo>.lg-k{animation:none!important}}'; document.head.appendChild(st); });
      if (aus) document.addEventListener('DOMContentLoaded', () => document.body.classList.add('no-ui-anim'));
    }, [GEGENPROBE, aus]);
    await p.goto(URL, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => { const k = document.querySelector('.fxlogo.lg-lade>.lg-k'); return { da: !!k, anim: k ? getComputedStyle(k).animationName : null, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }; });
    if (!r.reduce) fail('MESSUNG', 'reducedMotion-Emulation greift nicht');
    if (!r.da) fail('MESSUNG', 'kein Lade-Logo gefunden');
    else if (!aus && r.anim === 'none') fail('B WINDOWS', 'Lade-Logo steht still, obwohl die App-Animationen an sind (System meldet reduzierte Bewegung)');
    else if (aus && r.anim !== 'none') fail('C SCHALTER', `Lade-Logo animiert (${r.anim}) trotz ausgeschalteter UI-Animationen`);
    await ctx.close();
  }
  await b.close();
  if (GEGENPROBE) {
    const ok = F.some(x => x.startsWith('B '));
    console.log(ok ? 'pcbewegung --gegenprobe: ok (alte @media-Regel wird gemeldet)' : 'pcbewegung --gegenprobe: FEHLER\n  ' + F.join('\n  '));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`pcbewegung: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log('pcbewegung: ok (keine prefers-reduced-motion-Weiche mehr; mit Windows "Animationen aus" laeuft das Lade-Logo, der App-Schalter stoppt es)');
})().catch(e => { console.log('pcbewegung: ABBRUCH ' + e.message); process.exit(1); });
