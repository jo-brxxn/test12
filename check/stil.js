// ── STYLE-MENUE: HINTERGRUND + ELEMENTE (seit 2026-11-15, VERSION-CHECK-731) ──
// Nutzer 2026-11-15: "6 fuer andere hintergrundfarbe 3 einfarbig und 3 mit einem modernen
// Muster ... 6 fuer designelemente ... leicht und dann immer extremer ... direkt
// umschaltbar ganz oben ueber ein Button mit menue ... Hintergrund und nicht Hintergrund
// gleichzeitig".
//  A) Style-Knopf oeffnet ein Menue mit 7 Hintergruenden (Now + 6) und 7 Element-Stufen
//  B) Jede Wahl setzt data-hg / data-el, merkt sie (localStorage) und beschriftet den Knopf
//  C) Wirkung messbar: Hintergrund 1-3 werden dunkler (Leuchtdichte faellt), 4-6 haben ein
//     Muster; Kartenrand wird mit der Element-Stufe dunkler; beide Gruppen kombinierbar
//  D) Stufe 5/6: Kartentitel bleibt lesbar (hell auf dunklem Kopf, Kontrast >= 4,5)
//  E) Nur heller Modus: im dunklen Modus aendert data-hg den Seitengrund nicht
//  F) Sync: stilHg/stilEl in Cloud-Push, -Pull und Import
// --gegenprobe: CSS-Block fehlt -> C rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const lum = c => { const m = (c || '').match(/\d+(\.\d+)?/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(x => { x = +x / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
(async () => {
  const F = [];
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const push = (main.match(/async function cloudPush[\s\S]*?\n}\n/) || [''])[0];
  if (!/data\.stilHg=stilHg/.test(push) || !/data\.stilEl=stilEl/.test(push)) F.push('F: stilHg/stilEl nicht im Cloud-Push');
  if (!/cd\.stilHg!==undefined/.test(main)) F.push('F: nicht im Cloud-Pull');
  if (!/_imp\.stilHg/.test(main)) F.push('F: nicht im Import');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/index\.html/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace(/\/\* ══ STYLE-MENUE: HINTERGRUND \+ ELEMENTE[\s\S]*?\/\* Menue \*\//, '/* Menue */'); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.removeItem('fxpro_stil_hg'); localStorage.removeItem('fxpro_stil_el'); localStorage.removeItem('fxpro_theme'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('EUR'); });
  await p.waitForTimeout(1500);
  // A
  await p.click('#hellBtn'); await p.waitForTimeout(300);
  const A = await p.evaluate(() => { const m = document.getElementById('stilMenu'); if (!m) return null; const g = [...m.querySelectorAll('.stil-gr')]; return g.map(x => x.querySelectorAll('.stil-opt').length); });
  if (!A) F.push('A: kein Menue nach Tipp auf den Style-Knopf'); else if (A.join(',') !== '7,7') F.push('A: Optionen je Gruppe ' + A.join(',') + ' (erwartet 7,7)');
  await p.keyboard.press('Escape');
  const mess = () => p.evaluate(() => { const cs = getComputedStyle(document.body), k = document.querySelector('.ab-tile, .ab-ptile'); const kh = k ? k.querySelector('.ab-tile-hd') : null, t = k ? k.querySelector('.ab-tile-t') : null;
    return { bg: cs.backgroundColor, img: cs.backgroundImage, rand: k ? getComputedStyle(k).borderTopColor : null, kopf: kh ? getComputedStyle(kh).backgroundColor : null, titel: t ? getComputedStyle(t).color : null,
      hg: document.documentElement.getAttribute('data-hg'), el: document.documentElement.getAttribute('data-el'), ls: [localStorage.getItem('fxpro_stil_hg'), localStorage.getItem('fxpro_stil_el')], knopf: document.getElementById('hellBtn').textContent }; });
  const basis = await mess();
  // B + C Hintergrund
  let vorher = lum(basis.bg);
  for (const h of ['1', '2', '3', '4', '5', '6']) {
    await p.evaluate(h => stilSetzen('hg', h), h); await p.waitForTimeout(150); const x = await mess();
    if (x.hg !== h || x.ls[0] !== h) F.push(`B: Hintergrund ${h}: data-hg=${x.hg}, gespeichert ${x.ls[0]}`);
    if (+h <= 3) { const l = lum(x.bg); if (!(l < vorher - 0.01)) F.push(`C: Hintergrund ${h} nicht dunkler (${x.bg})`); vorher = l; }
    else if (!/gradient|url\(/.test(x.img)) F.push(`C: Hintergrund ${h} ohne Muster (${x.img.slice(0, 40)})`);
  }
  if (!/Deep marble/.test((await mess()).knopf)) F.push('B: Knopf nennt die Wahl nicht (' + (await mess()).knopf + ')');
  // C Elemente (kombiniert mit Hintergrund 6)
  let randVorher = lum(basis.rand);
  for (const e of ['1', '2', '3', '4', '5', '6']) {
    await p.evaluate(e => stilSetzen('el', e), e); await p.waitForTimeout(150); const x = await mess();
    if (x.el !== e || x.hg !== '6') F.push(`B: Elemente ${e}: data-el=${x.el}, data-hg=${x.hg} (beide Gruppen muessen gleichzeitig gehen)`);
    const l = lum(x.rand); if (!(l <= randVorher + 0.001)) F.push(`C: Kartenrand bei Stufe ${e} nicht dunkler (${x.rand})`); randVorher = l;
    if (+e >= 5) { const a = lum(x.titel), k = lum(x.kopf); if (a != null && k != null) { const kr = (Math.max(a, k) + .05) / (Math.min(a, k) + .05); if (kr < 4.5) F.push(`D: Stufe ${e}: Titel-Kontrast ${kr.toFixed(2)} (Titel ${x.titel} auf ${x.kopf})`); } }
  }
  if (lum((await mess()).rand) >= lum(basis.rand) - 0.05) F.push('C: Kartenrand bei Stufe 6 kaum dunkler als Now');
  // E dunkler Modus
  await p.evaluate(() => { document.documentElement.setAttribute('data-fx-theme', 'midnight'); stilSetzen('hg', '3'); }); await p.waitForTimeout(150);
  const d3 = await mess(); await p.evaluate(() => stilSetzen('hg', '')); await p.waitForTimeout(150); const d0 = await mess();
  if (d3.bg !== d0.bg || d3.img !== d0.img) F.push('E: im dunklen Modus aendert der Hintergrund den Seitengrund');
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^C: /.test(f)); console.log(ok ? 'stil --gegenprobe: ok (fehlende Wirkung gemeldet)' : 'stil --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('stil: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('stil: ok (Menue 7+7, jede Wahl gesetzt + gemerkt, Hintergrund 1-3 dunkler / 4-6 Muster, Rand je Stufe dunkler, kombinierbar, Titel lesbar, dunkler Modus unberuehrt, synchronisiert)');
})().catch(e => { console.log('stil: ABBRUCH ' + e.message); process.exit(1); });
