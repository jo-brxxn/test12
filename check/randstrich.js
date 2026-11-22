// ── KEIN TRENNSTRICH AM RAND ─────────────────────────────────────────
//
// Nutzer 2026-11-22 (Screenshot, Strich vor "Score" in der Asset-Kopfleiste
// eingekreist): "ganz an den Raendern sollen nie Striche stehen weil es dann
// nichts mehr zum abgrenzen gibt".
// Gemessen: .dmeta-controls trug border-left, war aber das ERSTE Kind von
// .dmeta - links davon nichts. Dieselbe Klasse bei 390 px: die Leiste bricht
// um, "Backtester" und der Schalter begannen eine neue Zeile mit Strich.
//
// Regel: ein Trennstrich (1-2 px, nur links ODER nur rechts, nicht farbig)
// braucht auf seiner Seite einen sichtbaren Geschwister-Nachbarn in derselben
// Zeile - sonst ist er ein Strich am Rand. Ein Strich, den ein Vorfahr mit
// overflow-x hidden/clip abschneidet, zaehlt nicht (so loest die Kopfleiste
// den Umbruch).
// Geprueft: 15 Seiten + Asset-Seite (USD, XAU), 1180 und 390 px.
//   node check/randstrich.js [--gegenprobe]  (alter Container-Strich -> rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
// Farbige/graue Akzentbalken an Listeneintraegen sind kein Trenner:
const AUSNAHMEN = ['hl-row'];   // Schlagzeilen: Balken = Wichtigkeit (lv-hi/lv-mid)
const SEITEN = ['dash', 'cur', 'mx', 'trends', 'cot', 'sent', 'seas', 'data',
  'rate', 'news', 'carry', 'pairs', 'cal', 'notes', 'regime'];

function scan(ausnahmen) {
  const out = [];
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) return null; return r; };
  const breite = (s, k) => s[`border${k}Style`] !== 'none' ? parseFloat(s[`border${k}Width`]) : 0;
  document.querySelectorAll('body *').forEach(el => {
    if (/^(TR|TD|TH|TABLE|TBODY|THEAD|INPUT|BUTTON|SELECT|TEXTAREA)$/.test(el.tagName) || el instanceof SVGElement) return;
    const kl = String(el.className || '');
    if (ausnahmen.some(a => kl.split(/\s+/).includes(a))) return;
    const s = getComputedStyle(el);
    const L = breite(s, 'Left'), R = breite(s, 'Right');
    if (breite(s, 'Top') || breite(s, 'Bottom')) return;
    const seite = L > 0 && L <= 2 && !R ? 'links' : R > 0 && R <= 2 && !L ? 'rechts' : null;
    if (!seite) return;
    const r = vis(el); if (!r) return;
    const fc = (s[seite === 'links' ? 'borderLeftColor' : 'borderRightColor'].match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (fc.length === 3 && Math.max(...fc) - Math.min(...fc) > 60) return;   // farbiger Akzentbalken
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const as = getComputedStyle(a); if (!/hidden|clip/.test(as.overflowX)) continue;
      const ar = a.getBoundingClientRect();
      if (seite === 'links' && r.left + L <= ar.left + parseFloat(as.borderLeftWidth) + 0.5) return;
      if (seite === 'rechts' && r.right - R >= ar.right - parseFloat(as.borderRightWidth) - 0.5) return;
    }
    const p = el.parentElement; let nachbar = false;
    if (p) for (const k of p.children) {
      if (k === el) continue; const kr = vis(k); if (!kr) continue;
      if (!(kr.bottom > r.top + 2 && kr.top < r.bottom - 2)) continue;
      if (seite === 'links' && kr.right <= r.left + 4) { nachbar = true; break; }
      if (seite === 'rechts' && kr.left >= r.right - 4) { nachbar = true; break; }
    }
    if (!nachbar) out.push(`${seite} ${el.tagName}.${kl.trim().split(/\s+/).join('.').slice(0, 40)} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`);
  });
  return out;
}

(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [w, h] of [[1180, 900], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); });
    if (GEGENPROBE) await p.addStyleTag({ content: '.dmeta-controls{border-left:1px solid #C9D6E8 !important;padding-left:4px !important}' });
    const ziele = [...SEITEN.map(s => ['tab', s]), ['sym', 'USD'], ['sym', 'XAU']];
    for (const [art, id] of ziele) {
      await p.evaluate(([art, id]) => { try { art === 'tab' ? showTab(id) : gotoSym(id); } catch (e) {} }, [art, id]);
      await p.waitForTimeout(350);
      const r = await p.evaluate(`(${scan})(${JSON.stringify(AUSNAHMEN)})`);
      r.forEach(x => F.push(`${w}px ${art}:${id}: ${x}`));
    }
    await p.close();
  }
  await b.close();
  const uniq = [...new Set(F)];
  if (uniq.length) { console.log(`✗ ${uniq.length} Trennstrich(e) am Rand ohne Nachbarn:`); uniq.slice(0, 30).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('✓ Kein Trennstrich am Rand (15 Seiten + USD/XAU, 1180 und 390 px)');
})().catch(e => { console.error(e); process.exit(1); });
