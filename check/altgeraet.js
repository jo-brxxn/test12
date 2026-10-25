#!/usr/bin/env node
// ══ WAECHTER: EINE NOCH OFFENE ALTE APP LOESCHT NICHTS ══════════════════
//
// Nutzer 2026-10-21: "es gab auch bugs das wenn man was anklickt das es dann
// nach ein paar Sekunden wieder umspringt ich will dass da keine bugs sind".
// GEMESSEN (zwei Browser, eine nachgestellte Cloud): Geraet A (618) stellt
// Makro-Charts, 10Y und "Below target" ein; Geraet B, noch mit der vorher
// geoeffneten App 613, laedt beim naechsten automatischen Speichern hoch und
// laesst mkAnsicht und die Einstufungen weg - 613 kennt sie nicht. Beim
// naechsten Abgleich von A: Charts -> Table, Einstufung weg.
//
// Das alte Geraet wird hier OHNE alten Code nachgestellt: es schickt genau
// den Stand, den eine App ohne diese Felder schickt (Schluessel fehlen).
// Geprueft:
//   A) fremder Stand ohne mkAnsicht / tags / hist / mkInds / mkRange kommt an
//      -> A behaelt Charts, Zeitraum, Spuren und Einstufung, Anzeige inklusive
//   B) eine BEWUSSTE Aenderung eines Geraets, das die Felder kennt (Schluessel
//      da: mkAnsicht null, tags {}), kommt weiter an
//   C) traegt die Cloud eine hoehere App-Nummer, laedt diese App nichts mehr
//      hoch und laedt neu (ohne offene Eingaben) bzw. zeigt "Reload"
//   D) Basis ueberlebt ein Neuladen: offene Eingabe, Neuladen, ein anderes
//      Geraet hat inzwischen woanders geaendert -> beides bleibt
//   E) ein aelterer Tab desselben Geraets (localStorage) loescht nichts
//
//   node check/altgeraet.js [--gegenprobe]
//   --gegenprobe: neueFelderBehalten abgeschaltet -> A und E muessen rot werden
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const FAKE = 'https://waechter-cloud.invalid';
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const ok = m => { if (!GP) console.log('  ✓ ' + m); };

// Was eine App ohne die Makro-Felder (<= 613) hochlaedt.
function altStand(d) {
  const o = JSON.parse(JSON.stringify(d));
  delete o.mkAnsicht; delete o.mkTab; delete o.appVer;
  Object.values(o.researchAnalysis || {}).forEach(c => Object.values(c || {}).forEach(r => { if (r && typeof r === 'object') { delete r.tags; delete r.hist; } }));
  (o.syms || []).forEach(s => (s.rubrics || []).forEach(r => { delete r.mkInds; delete r.mkRange; }));
  return o;
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  const HIER = new globalThis.URL(URL).origin;
  await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  const cloud = { data: null, updated_at: '2026-10-21T08:00:00.000Z' };
  const pushes = [];
  await ctx.route(FAKE + '/**', async route => {
    const r = route.request(), u = r.url();
    if (r.method() === 'POST') { const body = JSON.parse(r.postData())[0]; cloud.data = body.data; cloud.updated_at = body.updated_at; pushes.push(body.data); return route.fulfill({ status: 201, body: '' }); }
    if (/select=updated_at/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ updated_at: cloud.updated_at }]) });
    if (/select=data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ data: cloud.data, updated_at: cloud.updated_at }] : []) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const p = await ctx.newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const weg = () => p.evaluate(gp => { if (gp) window.__gpKeinBehalten = true; ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); }, GP);
  await p.goto(URL); await wartenBisDatenDa(p); await weg();
  cloud.data = JSON.parse(await p.evaluate(() => { flushAndSave(); return snap(); }));
  await p.evaluate(([FAKE, T]) => { localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'W', url: FAKE, key: 'k', syncId: 'w' }));
    localStorage.setItem('fxpro_cloud_seen', T); localStorage.setItem('fxpro_updated', T); localStorage.removeItem('fxpro_user_pending'); }, [FAKE, cloud.updated_at]);
  await p.reload(); await wartenBisDatenDa(p); await weg(); await p.waitForTimeout(1500);

  // Einstellen wie ein Nutzer: Gold, Charts, 10Y, eine Spur aus, eine Einstufung
  await p.evaluate(() => gotoSym('GOLD')); await p.waitForTimeout(600);
  const klick = (sel, txt) => p.evaluate(([sel, txt]) => { const x = [...document.querySelectorAll(sel)].find(y => y.textContent.trim() === txt); if (!x) return false; x.click(); return true; }, [sel, txt]);
  const zustand = () => p.evaluate(() => { const inf = getSym().rubrics.find(r => r.name === 'Inflation'); const a = ((researchAnalysis.USD || {}).Inflation || {});
    return { ui: (i => i ? (i.checked ? 'Charts' : 'Table') : '')(document.querySelector('#detail .mk-rsw input')), charts: !!document.querySelector('#detail .mk-chart svg'), range: inf.mkRange, inds: JSON.stringify(inf.mkInds || null),
      tab: (document.querySelector('#mkTabKarte .mk-tab.on') || {}).textContent || '', tags: JSON.stringify(a.tags || {}), hist: (a.hist || []).length }; });
  // Seit 2026-10-25 ein Kippschalter rechts in der MACRO-Zeile (statt Table|Charts je Karte)
  if (!await p.evaluate(() => { const i = document.querySelector('#detail .mk-rsw input'); if (!i) return false; if (!i.checked) i.click(); return true; })) fail('Aufbau', 'kein Charts-Schalter'); await p.waitForTimeout(300);
  await klick('#detail .ind-hist-range-btn', '10Y'); await p.waitForTimeout(300);
  await p.evaluate(() => { const c = document.querySelector('#detail .mk-chip.on'); if (c) c.click(); }); await p.waitForTimeout(300);
  // Reiter Labour Market, dann zurueck auf Inflation-Spuren ist nicht noetig: der Reiter selbst wird geprueft
  await p.evaluate(() => makroTab('Labour Market')); await p.waitForTimeout(300);
  await p.evaluate(() => makroTab('Inflation')); await p.waitForTimeout(300);
  await p.evaluate(() => makroTab('Labour Market')); await p.waitForTimeout(300);
  // Einstufungen haben seit 620 keine Oberflaeche mehr - gespeicherte (aus 614-619) muessen trotzdem bleiben
  await p.evaluate(() => { researchAnalysis.USD = researchAnalysis.USD || {}; researchAnalysis.USD.Inflation = Object.assign(researchAnalysis.USD.Inflation || { bias: null, text: '' }, { tags: { level: 'below' }, hist: [{ d: '2026-10-20', k: 'level', v: 'below' }] }); markUserEditTs(); save(); });
  await p.waitForTimeout(2500);
  const soll = await zustand();
  if (soll.ui !== 'Charts' || soll.range !== 120 || soll.tags === '{}' || soll.tab !== 'Labour Market') fail('Aufbau', 'Einstellungen kamen nicht an: ' + JSON.stringify(soll));

  // ── A: das alte Geraet laedt hoch ──
  console.log('A) alte App laedt ohne die neuen Felder hoch');
  const neu = () => new Date(Date.now() + 1000).toISOString();
  cloud.data = altStand(cloud.data); cloud.updated_at = neu();
  await p.evaluate(() => cloudSyncNow()); await p.waitForTimeout(2500);
  const nachA = await zustand();
  for (const k of ['ui', 'charts', 'range', 'inds', 'tab', 'tags', 'hist']) {
    if (JSON.stringify(nachA[k]) !== JSON.stringify(soll[k])) fail('A ALTES GERAET LOESCHT', `${k}: vorher ${JSON.stringify(soll[k])}, nach dem Abgleich ${JSON.stringify(nachA[k])}`);
  }
  if (JSON.stringify(nachA) === JSON.stringify(soll)) ok('Charts, Reiter, 10Y, Spuren und gespeicherte Einstufung bleiben');

  // ── B: bewusste Aenderung eines Geraets, das die Felder kennt ──
  console.log('B) bewusste Aenderung eines aktuellen Geraets kommt an');
  const d = JSON.parse(JSON.stringify(cloud.data.mkAnsicht !== undefined ? cloud.data : JSON.parse(await p.evaluate(() => snap()))));
  d.mkAnsicht = null; ((d.researchAnalysis.USD || {}).Inflation || {}).tags = {};
  cloud.data = d; cloud.updated_at = neu();
  await p.evaluate(() => cloudSyncNow()); await p.waitForTimeout(2500);
  const nachB = await zustand();
  if (nachB.ui !== 'Table') fail('B BEWUSSTE AENDERUNG', `Table vom anderen Geraet kam nicht an (steht ${nachB.ui})`);
  if (nachB.tags !== '{}') fail('B BEWUSSTE AENDERUNG', `geleerte Einstufung kam nicht an (${nachB.tags})`);
  if (nachB.ui === 'Table' && nachB.tags === '{}') ok('Table und geleerte Einstufung vom anderen Geraet kommen an');

  // ── C: hoehere App-Nummer in der Cloud ──
  console.log('C) neuere App in der Cloud: diese laedt nichts mehr hoch');
  const n0 = pushes.length;
  const eigene = await p.evaluate(() => +(/VERSION-CHECK-(\d+)/.exec(document.getElementById('hlbName').textContent) || [0, 0])[1]);
  const dc = JSON.parse(JSON.stringify(cloud.data)); dc.appVer = eigene + 1; cloud.data = dc; cloud.updated_at = neu();
  await p.evaluate(() => { window.__reloads = 0; });
  const nav = p.waitForEvent('framenavigated', { timeout: 6000 }).then(() => true).catch(() => false);
  await p.evaluate(() => cloudSyncNow());
  const neuGeladen = await nav;
  if (!neuGeladen) fail('C VERALTET', 'App hat trotz hoeherer Nummer in der Cloud nicht neu geladen');
  else ok('ohne offene Eingabe: neu geladen');
  await wartenBisDatenDa(p); await weg(); await p.waitForTimeout(1500);
  // mit offener Eingabe: kein Neuladen, kein Upload, Hinweis sichtbar
  await p.evaluate(() => { sessionStorage.removeItem('fxpro_ver_reload'); gotoSym('GOLD'); });
  await p.waitForTimeout(500);
  await klick('#detail .ind-hist-range-btn', '3Y'); await p.waitForTimeout(200);
  const n1 = pushes.length;
  cloud.updated_at = neu();
  await p.evaluate(() => cloudSyncNow()); await p.waitForTimeout(2500);
  await p.evaluate(() => { try { cloudPush(false); } catch (e) {} }); await p.waitForTimeout(1500);
  const c = await p.evaluate(() => ({ bar: !!document.querySelector('#appAlt .app-alt-btn'), txt: (document.querySelector('#appAlt') || {}).textContent || '' }));
  if (pushes.length !== n1) fail('C VERALTET', `veraltete App hat trotzdem ${pushes.length - n1}x hochgeladen`);
  if (!c.bar) fail('C VERALTET', 'mit offener Eingabe kein "Reload"-Hinweis');
  if (pushes.length === n1 && c.bar) ok('mit offener Eingabe: kein Upload, Hinweis "' + c.txt.trim() + '"');
  if (pushes.length < n0) fail('C', 'Zaehler kaputt');

  // ── D: Basis ueberlebt ein Neuladen ──
  console.log('D) offene Eingabe, Neuladen, anderes Geraet aendert woanders');
  const p2 = await ctx.newPage(); p2.on('pageerror', e => perr.push(String(e)));
  await ctx.clearCookies();
  // frische Cloud ohne hoehere Nummer
  delete cloud.data.appVer; cloud.updated_at = neu();
  await p.close();
  await p2.goto(URL); await wartenBisDatenDa(p2);
  await p2.evaluate(gp => { if (gp) window.__gpKeinBehalten = true; ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); sessionStorage.clear(); }, GP);
  await p2.waitForTimeout(2500);
  await p2.evaluate(() => gotoSym('GOLD')); await p2.waitForTimeout(500);
  // Charts an und hochgeladen (B hatte Table gesetzt). Seit 2026-10-25 EIN Schalter
  // fuer alle Karten - er oeffnet den zuletzt gewaehlten Reiter; D liest Inflation.
  await p2.evaluate(() => { const i = document.querySelector('#detail .mk-rsw input'); if (i && !i.checked) i.click(); makroTab('Inflation'); });
  await p2.waitForTimeout(3000);
  // Eingabe, dann SOFORT neu laden (Push kommt nicht mehr durch: Netz weg)
  const sperre = r => r.abort();
  await ctx.route(FAKE + '/**', sperre);
  await p2.evaluate(() => { const b = [...document.querySelectorAll('#detail .ind-hist-range-btn')].find(x => x.textContent.trim() === '5Y'); b.click(); flushAndSave(); });
  await p2.waitForTimeout(2000);
  await ctx.unroute(FAKE + '/**', sperre);
  // anderes Geraet aendert woanders (JPY-Indikator-Notiz)
  const d2 = JSON.parse(JSON.stringify(cloud.data));
  const jpy = d2.syms.find(s => s.id === 'JPY'); const ji = jpy.rubrics.filter(r => (r.indicators || []).length).slice(-1)[0].indicators[0]; ji.info = 'WAECHTER altgeraet fremd';
  cloud.data = d2; cloud.updated_at = neu();
  await p2.reload(); await wartenBisDatenDa(p2); await p2.evaluate(gp => { if (gp) window.__gpKeinBehalten = true; ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); }, GP);
  // Der Start-Abgleich laeuft erst nach den Boot-Feeds: bis zu 15 s warten.
  const lies = () => p2.evaluate(() => { const inf = syms.find(s => s.id === 'GOLD').rubrics.find(r => r.name === 'Inflation'); const jpy = syms.find(s => s.id === 'JPY');
    return { range: inf.mkRange, fremd: JSON.stringify(jpy).includes('WAECHTER altgeraet fremd') }; });
  let dz = await lies();
  for (let i = 0; i < 30 && !(dz.range === 60 && dz.fremd); i++) { await p2.waitForTimeout(500); dz = await lies(); }
  if (dz.range !== 60) fail('D BASIS NACH NEULADEN', `eigene Eingabe 5Y nach dem Neuladen weg (steht ${dz.range})`);
  if (!dz.fremd) fail('D BASIS NACH NEULADEN', 'Aenderung des anderen Geraets wurde ueberschrieben');
  if (dz.range === 60 && dz.fremd) ok('eigene Eingabe und fremde Aenderung bleiben beide');

  // ── E: aelterer Tab desselben Geraets ──
  console.log('E) aelterer Tab schreibt localStorage ohne die neuen Felder');
  await p2.evaluate(() => { const i = document.querySelector('#detail .mk-rsw input'); if (i && !i.checked) i.click(); });
  await p2.waitForTimeout(3500);
  const vorE = await p2.evaluate(() => makroGross());
  await p2.evaluate(() => { const o = JSON.parse(localStorage.getItem(SK)); delete o.mkAnsicht; localStorage.setItem(SK, JSON.stringify(o)); localStorage.setItem('fxpro_updated', new Date().toISOString()); adoptExternalState(); });
  await p2.waitForTimeout(500);
  const nachE = await p2.evaluate(() => makroGross());
  if (vorE && !nachE) fail('E ALTER TAB', 'Charts -> Table, nachdem ein alter Tab ohne mkAnsicht gespeichert hat');
  else if (vorE && nachE) ok('Charts bleibt');
  else fail('E', 'Aufbau: Charts war nicht an');

  perr.forEach(e => fail('JS-Fehler', e));
  await b.close();
  if (GP) {
    const rot = ['A ALTES GERAET LOESCHT', 'E ALTER TAB'].every(t => F.some(f => f.startsWith(t)));
    console.log(rot ? `altgeraet --gegenprobe: ok (A und E rot, ${F.length} Befunde)` : 'altgeraet --gegenprobe: FEHLER - nicht rot\n  ' + F.join('\n  '));
    process.exit(rot ? 0 : 1);
  }
  if (F.length) { console.log(`altgeraet: ${F.length} Befund(e)`); F.forEach(x => console.log('  ✗ ' + x)); process.exit(1); }
  console.log('altgeraet: ok (alte App loescht nichts, bewusste Aenderungen kommen an, veraltete App laedt nicht hoch, Basis ueberlebt Neuladen, alter Tab loescht nichts)');
})().catch(e => { console.log('altgeraet: ABBRUCH ' + e.message); process.exit(1); });
