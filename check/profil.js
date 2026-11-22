// ── PROFIL: NAME, INITIALEN, BEGRUESSUNG, LANGES DRUECKEN (2026-11-22, VERSION-CHECK-800) ──
// Nutzer: "optional Namen und Nachnamen ... Beide Anfangsbuchstaben ... oben rechts ... hans Stein ...
// HS ... entfern den nutzernamen ... Begruessung ... Vorname ... sonst Trader ... wenn man auf den Kreis
// oben rechts drueckt lange das dann direkt dark Mode und light Mode sich wechseln".
//  A) ohne Namen: Personen-Symbol, "Trader"; kein Benutzername-Feld mehr
//  B) hans / Stein -> Kreis "HS", Begruessung "hans", profil im snap() (Sync), nach Neuladen erhalten
//  C) langes Druecken wechselt Dark/Light und oeffnet die Settings NICHT; kurzes Tippen oeffnet sie
// --gegenprobe: Initialen nur aus dem Vornamen -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [], b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/main\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'main.js'), 'utf8').replace('return b(profil.vor)+b(profil.nach);', 'return b(profil.vor);') }));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  const laden = async () => { await p.goto(URL); await wartenBisDatenDa(p); await p.waitForTimeout(1500);
    await p.evaluate(gp => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); });
    }); };
  const st = () => p.evaluate(() => ({ kreis: document.getElementById('profileCircle').textContent.trim(), svg: !!document.querySelector('#profileCircle svg'),
    gruss: ((document.querySelector('#dashGruss .dx-name') || {}).textContent || ''), theme: document.documentElement.getAttribute('data-fx-theme') || '',
    cfg: getComputedStyle(document.getElementById('mCloud')).display !== 'none', user: !!document.getElementById('cloudUsername') }));
  await laden();
  let s = await st();
  if (!s.svg || s.kreis) F.push(`A: ohne Namen Kreis "${s.kreis}" statt Personen-Symbol`);
  if (s.gruss !== 'Trader') F.push(`A: Begruessung "${s.gruss}" statt Trader`);
  if (s.user) F.push('A: Feld Benutzername noch da');
  await p.click('#profileBtn'); await p.waitForTimeout(300);
  if (!(await st()).cfg) F.push('C: kurzes Tippen oeffnet die Settings nicht');
  await p.fill('#profilVor', 'hans'); await p.fill('#profilNach', 'Stein'); await p.waitForTimeout(400);
  s = await st();
  if (s.kreis !== 'HS') F.push(`B: Kreis "${s.kreis}" statt HS`);
  if (s.gruss !== 'hans') F.push(`B: Begruessung "${s.gruss}" statt hans`);
  const sn = await p.evaluate(() => JSON.parse(snap()).profil);
  if (!sn || sn.vor !== 'hans' || sn.nach !== 'Stein') F.push('B: profil fehlt im snap() - kein Sync');
  await p.evaluate(() => closeM('mCloud')); await p.waitForTimeout(300);
  const vor = (await st()).theme, bb = await p.locator('#profileBtn').boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(900); await p.mouse.up(); await p.waitForTimeout(400);
  s = await st();
  if (s.theme === vor) F.push('C: langes Druecken wechselt das Theme nicht');
  if (s.cfg) F.push('C: langes Druecken oeffnet zusaetzlich die Settings');
  await laden(); s = await st();
  if (s.kreis !== 'HS') F.push(`B: nach Neuladen Kreis "${s.kreis}"`);
  err.forEach(x => F.push('JS-Fehler: ' + x));
  await b.close();
  if (GP) { const ok = F.some(f => /^B: Kreis/.test(f)); console.log(ok ? 'profil --gegenprobe: ok (falsche Initialen rot)' : 'profil --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log(`profil: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
  console.log('profil: ok (ohne Namen Symbol + Trader, hans Stein -> HS + hans, im Sync, nach Neuladen da; lang = Dark/Light ohne Settings, kurz = Settings)');
})().catch(e => { console.log('profil: ABBRUCH ' + e.message); process.exit(1); });
