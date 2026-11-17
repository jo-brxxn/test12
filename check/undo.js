// ── UNDO / REDO: 20 Schritte, dauerhaft, ueber alle Geraete (seit 2026-11-17, VERSION-CHECK-741) ──
// Nutzer 2026-11-17: "Die Tasten oben rechts also die Pfeile ... die letzen 20 Aktionen zu
// merken egal was es ist außer halt scrollen und iwas öffnen ... dauerhaft". Rueckfrage:
// ueber alle Geraete, ein Feld = ein Schritt. Logik: js/undo.js.
// Zwei Geraete (A, B) an einer nachgestellten Cloud:
//  A) Tippen in ein Feld (Gameplan-These, echte Tasten) = EIN Schritt; Seiten oeffnen = keiner
//  B) ein automatisches Speichern mitten in der Eingabe (Feed: Kalender-Eintrag + save() ohne
//     Markierung) landet NICHT im Schritt - Undo nimmt den Text zurueck, der Feed-Eintrag bleibt
//  C) 24 Aenderungen -> genau 20 Schritte, der aelteste ist weg
//  D) nach Neuladen: Verlauf da, Undo wirkt
//  E) Trade anlegen -> Undo entfernt ihn (Grabstein, bleibt auch nach dem Abgleich weg), Redo
//  F) ueber Geraete: A aendert, B holt den Stand, B macht Undo -> A hat es nach dem Abgleich
//     ebenfalls zurueck; eine fremde Aenderung an anderer Stelle bleibt dabei stehen
// --gegenprobe: save() ohne Markierung zaehlt als Nutzer-Schritt (Verhalten ohne Trennung) -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const FAKE = 'https://waechter-cloud.invalid', HIER = 'http://127.0.0.1:' + PORT;
const warte = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const F = [];
  const b = await chromium.launch();
  let cloud = null;
  const geraet = async () => {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/undo\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('if(!nutzer){', 'if(false){'); r.fulfill({ response: res, body: t }); });
    await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    await ctx.route(FAKE + '/**', async route => {
      const r = route.request(), u = r.url();
      if (r.method() === 'POST') { let body = null; try { body = JSON.parse(r.postData())[0]; } catch (e) { } if (body) cloud = { data: body.data, updated_at: body.updated_at }; return route.fulfill({ status: 201, body: '' }); }
      if (/select=updated_at/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud ? [{ updated_at: cloud.updated_at }] : []) });
      if (/select=data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud ? [{ data: cloud.data, updated_at: cloud.updated_at }] : []) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const p = await ctx.newPage(); p._err = []; p.on('pageerror', e => p._err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto(HIER + '/index.html'); await wartenBisDatenDa(p);
    return p;
  };
  const weg = p => p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); });
  const L = p => p.evaluate(() => { const l = undoLog(); return { pos: l.pos, n: l.e.length, l: l.e.map(e => e.l) }; });
  const A = await geraet();
  // Cloud mit A's Stand anlegen, dann beide Geraete verbinden
  const basis = JSON.parse(await A.evaluate(() => { flushAndSave(); return snap(); }));
  cloud = { data: basis, updated_at: '2026-11-17T08:00:00.000Z' };
  const verbinden = async (p, seen) => { await p.evaluate(([F, U, S]) => { localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'W', url: F, key: 'k', syncId: 'w' })); localStorage.setItem('fxpro_cloud_seen', S || U); localStorage.setItem('fxpro_updated', U); localStorage.removeItem('fxpro_undo_log'); }, [FAKE, cloud.updated_at, seen]); await p.reload(); await wartenBisDatenDa(p); await p.waitForTimeout(2500); await weg(p); };
  await verbinden(A);
  const ruhe = async p => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.mouse.move(2, 2); await p.waitForTimeout(1300); };
  // A
  const l0 = await L(A);
  await A.evaluate(() => { showTab('gameplan'); gpWaehle('EUR'); }); await A.waitForTimeout(500);
  await A.evaluate(() => { showTab('cal'); }); await A.waitForTimeout(400);
  await A.evaluate(() => { showTab('gameplan'); gpWaehle('EUR'); }); await A.waitForTimeout(500);
  const l1 = await L(A);
  if (l1.n !== l0.n) F.push(`A: Seiten oeffnen hat ${l1.n - l0.n} Undo-Schritt(e) erzeugt`);
  await A.click('.gp-d .gp-ta-th'); await A.keyboard.type('Rates diverge', { delay: 25 }); await ruhe(A);
  const l2 = await L(A);
  if (l2.n - l1.n !== 1) F.push(`A: 13 getippte Zeichen = ${l2.n - l1.n} Schritte statt 1 (${l2.l.slice(-3).join(', ')})`);
  // B: automatisches Speichern mitten in der Eingabe
  await A.click('.gp-d .gp-ta-th'); await A.keyboard.press('End'); await A.keyboard.type(' and more', { delay: 25 });
  await A.evaluate(() => { calEvts.push({ id: 'undoAuto1', name: 'Feed event', date: todayStr(), time: '', currencies: 'USD', impact: 'low', src: 'ff' }); save(); });
  await A.keyboard.type('!', { delay: 25 }); await ruhe(A);
  await A.evaluate(() => doUndo()); await A.waitForTimeout(500);
  const Bz = await A.evaluate(() => ({ th: (JSON.parse(snap()).gameplans.EUR || {}).th, feed: calEvts.some(e => e.id === 'undoAuto1') }));
  if (Bz.th !== 'Rates diverge') F.push(`B: Undo nach Eingabe ergibt These "${Bz.th}" statt "Rates diverge"`);
  if (!Bz.feed) F.push('B: Undo hat einen automatischen Feed-Eintrag mit zurueckgenommen (gehoert nicht zum Nutzer-Schritt)');
  // C: 24 Aenderungen
  for (let i = 0; i < 24; i++) { await A.evaluate(i => { gpBias('GBP', i % 2 ? 'bear' : 'bull'); }, i); await A.waitForTimeout(450); }
  await A.waitForTimeout(500);
  const lc = await L(A);
  if (lc.n !== 20 || lc.pos !== 20) F.push(`C: nach 24 Aenderungen ${lc.n} Schritte (pos ${lc.pos}) statt 20`);
  // D: neu laden
  await A.reload(); await wartenBisDatenDa(A); await A.waitForTimeout(1500); await weg(A);
  const ld = await L(A);
  if (ld.n !== 20) F.push(`D: nach Neuladen ${ld.n} Schritte statt 20`);
  const d0 = await A.evaluate(() => (JSON.parse(snap()).gameplans.GBP || {}).b);
  await A.evaluate(() => doUndo()); await A.waitForTimeout(400);
  const d1 = await A.evaluate(() => (JSON.parse(snap()).gameplans.GBP || {}).b);
  if (d0 === d1) F.push(`D: Undo nach Neuladen wirkt nicht (Bias GBP bleibt ${d0})`);
  await A.evaluate(() => doRedo()); await A.waitForTimeout(400);
  // E: Trade
  const tn = () => A.evaluate(() => JSON.parse(localStorage.getItem('fxpro_trades') || '[]').filter(t => !t.del && t.a === 'UNDOTEST').length);
  await A.evaluate(() => { showTab('journal'); tjNeu(); document.getElementById('tjAsset').value = 'UNDOTEST'; document.getElementById('tjEntry').value = '1'; tjFormSpeichern(); });
  await A.waitForTimeout(900);
  const e1 = await tn();
  await A.evaluate(() => doUndo()); await A.waitForTimeout(600);
  const e2 = await tn();
  await A.evaluate(() => cloudSyncNow()); await A.waitForTimeout(2500);
  const e3 = await tn();
  await A.evaluate(() => doRedo()); await A.waitForTimeout(600);
  const e4 = await tn();
  if (e1 !== 1) F.push('E: Testaufbau - Trade nicht angelegt');
  else if (e2 !== 0 || e3 !== 0) F.push(`E: Undo entfernt den Trade nicht dauerhaft (nach Undo ${e2}, nach Abgleich ${e3})`);
  else if (e4 !== 1) F.push('E: Redo bringt den Trade nicht zurueck');
  // F: zweites Geraet
  await A.evaluate(() => { showTab('gameplan'); gpBias('JPY', 'bull'); }); await A.waitForTimeout(900);
  await A.evaluate(() => cloudSyncNow()); await A.waitForTimeout(2500);
  const B = await geraet(); await verbinden(B, '2000-01-01T00:00:00.000Z');
  await B.evaluate(() => cloudSyncNow()); await B.waitForTimeout(2500);
  const fb = await B.evaluate(() => ({ jpy: (JSON.parse(snap()).gameplans.JPY || {}).b, top: (undoLog().e[undoLog().pos - 1] || {}).l }));
  if (fb.jpy !== 'bull' || fb.top !== 'Gameplan · JPY') F.push(`F: Geraet B hat Stand/Verlauf nicht (JPY ${fb.jpy}, oberster Schritt ${fb.top})`);
  else {
    // fremde Aenderung an anderer Stelle (direkt in der Cloud, ohne Verlauf)
    const d = JSON.parse(JSON.stringify(cloud.data)); if (d.widgets && d.widgets[0]) d.widgets[0].title = 'FREMD UNDO'; cloud = { data: d, updated_at: new Date().toISOString() };
    await B.evaluate(() => cloudSyncNow()); await B.waitForTimeout(2500);
    await B.evaluate(() => doUndo()); await B.waitForTimeout(800);
    await B.evaluate(() => cloudSyncNow()); await B.waitForTimeout(2500);
    await A.evaluate(() => cloudSyncNow()); await A.waitForTimeout(2500);
    const fa = await A.evaluate(() => ({ jpy: (JSON.parse(snap()).gameplans.JPY || {}).b || '', w: (JSON.parse(snap()).widgets[0] || {}).title, pos: undoLog().pos, top: (undoLog().e[undoLog().pos] || {}).l }));
    if (fa.jpy !== '') F.push(`F: Undo auf Geraet B kommt auf A nicht an (JPY ${fa.jpy})`);
    if (fa.w !== 'FREMD UNDO') F.push(`F: Undo hat die fremde Aenderung an anderer Stelle zurueckgenommen (${fa.w})`);
    if (fa.top !== 'Gameplan · JPY') F.push(`F: Verlauf auf A nicht nachgezogen (Redo-Schritt ${fa.top})`);
  }
  [A, B].forEach((p, i) => p._err.forEach(e => F.push('ABCD'[i] + ' JS-Fehler: ' + e)));
  await b.close();
  if (GP) { const ok = F.some(f => /^B:/.test(f)); console.log(ok ? 'undo --gegenprobe: ok (Feed-Aenderung im Nutzer-Schritt gemeldet)' : 'undo --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('undo: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('undo: ok (Feld = 1 Schritt, Oeffnen = keiner, Feed bleibt draussen, 20 Schritte, nach Neuladen, Trade mit Grabstein, Undo auf Geraet B kommt auf A an, fremde Aenderung bleibt)');
})().catch(e => { console.log('undo: ABBRUCH ' + e.message); process.exit(1); });

