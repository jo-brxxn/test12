// ── KEIN ABGLEICH MITTEN IN DIE EINGABE (seit 2026-11-16, VERSION-CHECK-740) ──
// Nutzer 2026-11-16 (iPad): "wenn ich was beim gameplan eingebe werde ich die ganze Zeit aus
// dem textfeld rausgeschmissen und generell bei neuen Elementen und listen ... wo man scrollen
// kann ... springt [die Webseite] zu einem Zustand von vor ein paar Sekunden zurueck".
// GEMESSEN: nachgestellte Cloud + zweites Geraet, das alle 7 s hochlaedt -> 24 s Tippen im
// Gameplan: 3x Fokus weg, jedes Mal die gerade getippten Zeichen verloren (Abgleich baute die
// Seite neu). Seitdem wartet jeder automatische Abgleich / Hintergrund-Neuaufbau, bis das Feld
// verlassen und 2 s Ruhe sind (nutzerAktiv, syncNachEingabe, rerenderHintergrund), und rettet
// danach den Scroll-Stand innerer Listen.
//  A) Tippen waehrend fremder Uploads: Fokus bleibt, kein Zeichen geht verloren
//  B) danach (Ruhe): fremde Aenderung kommt an, eigener Text steht lokal UND in der Cloud
//  C) fremder Upload ohne Eingabe: die gescrollte Gameplan-Liste behaelt ihren Scroll-Stand
// --gegenprobe: nutzerAktiv() immer false (Schutz aus, Verhalten vor 740) -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const FAKE = 'https://waechter-cloud.invalid', HIER = 'http://127.0.0.1:' + PORT;
(async () => {
  const F = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 700 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('function nutzerAktiv(){', 'function nutzerAktiv(){return false;'); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  await p.goto(HIER + '/index.html'); await wartenBisDatenDa(p);
  const basis = JSON.parse(await p.evaluate(() => { flushAndSave(); return snap(); }));
  const cloud = { data: basis, updated_at: '2026-11-16T08:00:00.000Z' };
  await ctx.route(FAKE + '/**', async route => {
    const r = route.request(), u = r.url();
    if (r.method() === 'POST') { let body = null; try { body = JSON.parse(r.postData())[0]; } catch (e) { } await new Promise(x => setTimeout(x, 500)); if (body) { cloud.data = body.data; cloud.updated_at = body.updated_at; } return route.fulfill({ status: 201, body: '' }); }
    if (/select=updated_at/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ updated_at: cloud.updated_at }]) });
    if (/select=data/.test(u)) { if (process.env.DBG) console.log('PULL', (Date.now()/1000).toFixed(1)); const a = JSON.stringify([{ data: cloud.data, updated_at: cloud.updated_at }]); await new Promise(x => setTimeout(x, 500)); return route.fulfill({ status: 200, contentType: 'application/json', body: a }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await p.evaluate(([F, A]) => { localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'W', url: F, key: 'k', syncId: 'w' })); localStorage.setItem('fxpro_cloud_seen', A); localStorage.setItem('fxpro_updated', A); }, [FAKE, cloud.updated_at]);
  await p.reload(); await wartenBisDatenDa(p); await p.waitForTimeout(3000);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); showTab('gameplan'); gpWaehle('USD'); }); await p.waitForTimeout(800);
  // zweites Geraet: alle 6 s ein Upload (sein Stand + eigene Aenderung)
  let fz = 0;
  const fremd = () => { if (process.env.DBG) console.log('FREMD', (Date.now()/1000).toFixed(1)); fz++; const d = JSON.parse(JSON.stringify(cloud.data)); if (d.widgets && d.widgets.length) d.widgets[0].title = 'FREMD ' + fz; cloud.data = d; cloud.updated_at = new Date().toISOString(); };
  // A
  const sel = '.gp-d .gp-ta-th'; await p.click(sel); let soll = '', verlust = [];
  for (let i = 0; i < 30; i++) {
    await p.keyboard.type('w' + i + ' ', { delay: 40 }); soll += 'w' + i + ' ';
    // alle 6 Eingaben: das andere Geraet laedt hoch, und hier laeuft der Abgleich an (wie nach
    // dem Auto-Push-Takt) - waehrend der Cursor im Feld steht
    if (i % 6 === 5) { fremd(); await p.evaluate(() => { cloudSyncNow(); }); await p.waitForTimeout(1600); } else await p.waitForTimeout(150);
    const f = await p.evaluate(s => { const a = document.activeElement, t = document.querySelector(s); return { fok: a === t, wert: t && t.value }; }, sel);
    if (!f.fok || f.wert !== soll) { verlust.push(`fokus ${f.fok}, "${(f.wert || '').slice(-14)}" statt "${soll.slice(-14)}"`); if (!f.fok) { await p.click(sel); await p.keyboard.press('End'); } soll = await p.evaluate(s => document.querySelector(s).value, sel); }
  }
  if (verlust.length) F.push(`A: ${verlust.length}x waehrend des Tippens gestoert (Uploads des anderen Geraets: ${fz}), z. B. ${verlust[0]}`);
  // B
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.move(3, 3); await p.waitForTimeout(9000);
  const B = await p.evaluate(() => { const d = JSON.parse(snap()); return { w: d.widgets[0] && d.widgets[0].title, th: d.gameplans.USD && d.gameplans.USD.th }; });
  if (B.w !== 'FREMD ' + fz) F.push(`B: Aenderung des anderen Geraets nach der Eingabe nicht angekommen (${B.w} statt FREMD ${fz})`);
  if (!B.th || !B.th.endsWith(soll.slice(-8))) F.push(`B: eigener Text lokal verloren ("${(B.th || '').slice(-12)}")`);
  const ct = cloud.data.gameplans && cloud.data.gameplans.USD && cloud.data.gameplans.USD.th;
  if (!ct || ct !== B.th) F.push(`B: Cloud hat nicht den eigenen Text ("${(ct || '').slice(-12)}")`);
  // C
  const c0 = await p.evaluate(() => { const l = document.querySelector('.gp2-l'); l.scrollTop = 300; return l.scrollTop; });
  await p.mouse.move(3, 3); await p.waitForTimeout(2300);
  fremd(); await p.evaluate(() => cloudSyncNow()); await p.waitForTimeout(3500);
  const c1 = await p.evaluate(() => ({ s: document.querySelector('.gp2-l').scrollTop, w: JSON.parse(snap()).widgets[0].title }));
  if (c1.w !== 'FREMD ' + fz) F.push(`C: fremder Upload nicht uebernommen (${c1.w})`);
  else if (Math.abs(c1.s - c0) > 2) F.push(`C: Gameplan-Liste nach dem Abgleich bei ${c1.s} statt ${c0} px`);
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^A:/.test(f)); console.log(ok ? 'eingabesync --gegenprobe: ok (Stoerung beim Tippen gemeldet)' : 'eingabesync --gegenprobe: FEHLER ' + F.length + '\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('eingabesync: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`eingabesync: ok (30 Eingaben bei ${fz} fremden Uploads ohne Stoerung, danach beides zusammengefuehrt + in der Cloud, Scroll-Stand der Liste bleibt)`);
})().catch(e => { console.log('eingabesync: ABBRUCH ' + e.message); process.exit(1); });
