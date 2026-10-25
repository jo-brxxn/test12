#!/usr/bin/env node
// ══ WAECHTER: KEIN TRADE GEHT VERLOREN (Journal, js/trades.js) ══════════
//
// Nutzer 2026-10-24: "stell sicher das die Sachen gespeichert werden und
// nicht verloren gehen also alle in supabase sicher landen".
// Mehrere Geraete = getrennte Browser-Kontexte, EINE nachgestellte
// Cloud-Zeile (fx_sync). Geprueft:
//   A) Cloud hat nur TA (anderes Geraet), dieses Geraet lokal TB, nichts
//      offen -> nach dem Abgleich liegen TA UND TB in der Cloud
//   B) Cloud-Stand ganz ohne tradeJournal (alte App) -> lokale Trades
//      gehen wieder hoch
//   C) zwei Tabs: Tab 1 legt C1 an, der aeltere Tab 2 danach C2 ->
//      localStorage UND Cloud haben beide
//   D) Upload scheitert (35 s, laenger als ein 15-s-Takt) -> sichtbare
//      Meldung; Cloud wieder erreichbar -> der Trade landet OHNE neue
//      Eingabe, Anzeige "in the cloud"
//   E) Loeschen auf Geraet 1 kommt als Grabstein an; Geraet 2 mit dem alten
//      Trade holt ihn beim Abgleich nicht zurueck
//
//   node check/trades.js [--gegenprobe]
//   --gegenprobe: die vier Sicherungen aus (window.__gpTj) -> A-D muessen rot sein
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const FAKE = 'https://waechter-cloud.invalid';
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const ok = m => console.log('  ✓ ' + m);

const cloud = { data: null, updated_at: 'U-START', failPost: false, posts: 0, zeiten: [] };
const imCloud = () => ((cloud.data && cloud.data.tradeJournal) || []).filter(t => t && !t.del).map(t => t.a).sort();
const grab = id => ((cloud.data && cloud.data.tradeJournal) || []).find(t => t && t.id === id);
const warte = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 250)); } return fn(); };
const trade = (id, a, up) => ({ id, d: '2026-10-02', cd: '2026-10-02', st: 'closed', a, dir: 'long', pnl: 100, up: up || '2026-10-02T10:00:00.000Z' });

(async () => {
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const route = async ctx => {
    await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    await ctx.route(FAKE + '/**', async r => {
      const q = r.request(), u = q.url();
      if (q.method() === 'POST') {
        if (cloud.failPost) return r.fulfill({ status: 500, body: 'down' });
        const body = JSON.parse(q.postData())[0]; cloud.data = body.data; cloud.updated_at = body.updated_at; cloud.posts++; cloud.zeiten.push(Date.now());
        return r.fulfill({ status: 201, body: '' });
      }
      if (/select=updated_at/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ updated_at: cloud.updated_at }] : []) });
      if (/select=data/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ data: cloud.data, updated_at: cloud.updated_at }] : []) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  };
  const perr = [];
  const weg = p => p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
  // Grundstand der App (gueltige Cloud-Zeile)
  const c0 = await b.newContext({ serviceWorkers: 'block' }); await route(c0);
  const p0 = await c0.newPage(); await p0.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); } catch (e) {} });
  await p0.goto(URL); await wartenBisDatenDa(p0); await weg(p0);
  const basis = JSON.parse(await p0.evaluate(() => { flushAndSave(); return snap(); }));
  await c0.close();

  const geraete = [];
  const geraet = async (seed, seen, opt) => {
    const o = opt || {};
    const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' }); await route(ctx);
    await ctx.addInitScript(([FAKE, seed, seen, gp]) => { try {
      if (gp) window.__gpTj = true;
      if (!localStorage.getItem('__w_seed')) {
        localStorage.setItem('__w_seed', '1'); localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0');
        localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'W', url: FAKE, key: 'k', syncId: 'w' }));
        localStorage.setItem('fxpro_cloud_seen', seen); localStorage.setItem('fxpro_updated', seen); localStorage.removeItem('fxpro_user_pending');
        localStorage.setItem('fxpro_trades', JSON.stringify(seed));
      } } catch (e) {} }, [FAKE, seed, seen, GP]);
    const seite = async () => { const p = await ctx.newPage(); p.on('pageerror', e => perr.push(String(e))); p.on('dialog', d => d.accept());
      await p.goto(URL); await wartenBisDatenDa(p); await weg(p); return p; };
    const p = await seite(); geraete.push(ctx);
    return { ctx, p, seite };
  };
  const neuerTrade = (p, a) => p.evaluate(a => { tjNeu('2026-10-02'); document.getElementById('tjAsset').value = a; document.getElementById('tjPnl').value = '100'; return tjFormSpeichern(); }, a);

  // ── A: Abgleich mit fremden Trades - die eigenen muessen hoch ─────────
  console.log('A) Abgleich holt fremde Trades und laedt die eigenen, die der Cloud fehlen, hoch');
  // Erst ganz normal abgleichen lassen (beim Laden laedt die App ohnehin hoch,
  // das wuerde den Fall verdecken), DANN schreibt ein anderes Geraet die
  // Cloud ohne TB, DANN kommt der Abgleich - jetzt steht nichts anderes an.
  cloud.data = { ...basis, tradeJournal: [trade('ta', 'A-TA')] }; cloud.updated_at = 'U-A';
  const gA = await geraet([trade('tb', 'A-TB')], 'U-ALT');
  // 20 s: der 15-s-Takt (flushAndSave) holt einmal einen liegengebliebenen
  // Upload-Timer nach - erst danach ist der Fall "spaeterer Abgleich" echt.
  await gA.p.waitForTimeout(20000);
  cloud.data = JSON.parse(JSON.stringify(cloud.data)); cloud.data.tradeJournal = [trade('ta', 'A-TA'), trade('tx', 'A-TX')]; cloud.updated_at = 'U-A2';
  await gA.p.evaluate(() => cloudPull(false));
  await warte(() => imCloud().includes('A-TB'), 9000);
  const lokalA = await gA.p.evaluate(() => trades.filter(t => !t.del).map(t => t.a).sort().join(','));
  if (!imCloud().includes('A-TB') || !imCloud().includes('A-TX')) fail('A', `Cloud hat ${imCloud().join(',') || 'nichts'} statt A-TA,A-TB,A-TX (lokal: ${lokalA})`);
  else ok(`Cloud danach: ${imCloud().join(', ')} · lokal: ${lokalA}`);

  // ── B: alte App hat ohne tradeJournal hochgeladen ─────────────────────
  console.log('B) Cloud-Stand ohne tradeJournal (alte App) - lokale Trades gehen wieder hoch');
  cloud.data = { ...basis, tradeJournal: [] }; cloud.updated_at = 'U-B';
  const gB = await geraet([trade('tc', 'B-TC')], 'U-ALT2');
  await gB.p.waitForTimeout(20000);
  cloud.data = JSON.parse(JSON.stringify(cloud.data)); delete cloud.data.tradeJournal; cloud.updated_at = 'U-B2';
  await gB.p.evaluate(() => cloudPull(false));
  await warte(() => imCloud().includes('B-TC'), 9000);
  if (!imCloud().includes('B-TC')) fail('B', `Cloud hat ${imCloud().join(',') || 'kein tradeJournal'} - B-TC fehlt`);
  else ok(`Cloud danach: ${imCloud().join(', ')}`);

  // ── C: zwei Tabs desselben Geraets ────────────────────────────────────
  console.log('C) Zwei Tabs: der aeltere ueberschreibt den Trade des anderen nicht');
  const tab1 = gB.p, tab2 = await gB.seite();
  await tab2.waitForTimeout(800);
  await neuerTrade(tab1, 'C-1'); await tab1.waitForTimeout(400);
  await neuerTrade(tab2, 'C-2');
  await warte(() => imCloud().includes('C-1') && imCloud().includes('C-2'), 12000);
  const platte = await tab2.evaluate(() => JSON.parse(localStorage.getItem('fxpro_trades') || '[]').filter(t => !t.del).map(t => t.a).sort().join(','));
  if (!/C-1/.test(platte) || !/C-2/.test(platte)) fail('C', `localStorage nach beiden Tabs: ${platte}`);
  if (!imCloud().includes('C-1') || !imCloud().includes('C-2')) fail('C', `Cloud nach beiden Tabs: ${imCloud().join(',')}`);
  if (/C-1/.test(platte) && /C-2/.test(platte) && imCloud().includes('C-1') && imCloud().includes('C-2')) ok(`localStorage + Cloud: C-1 und C-2`);

  // ── D: Upload scheitert, Anzeige + Wiederholung ───────────────────────
  console.log('D) Upload scheitert: sichtbare Meldung, danach landet der Trade ohne neue Eingabe');
  await tab2.close();
  const pD = gB.p;
  await pD.evaluate(() => showTab('journal')); await pD.waitForTimeout(500);
  cloud.failPost = true;
  await neuerTrade(pD, 'D-1');
  await pD.waitForTimeout(3500);
  // Ausfall laenger als ein 15-s-Takt: der eine Nachhol-Upload von
  // flushAndSave scheitert auch - danach hilft nur die eigene Wiederholung.
  const tAusfall = Date.now();
  const stD = await pD.evaluate(() => { const e = document.getElementById('tjCloud'); if (!e) return null; const r = e.getBoundingClientRect(); return { t: e.innerText.replace(/\s+/g, ' '), sicht: r.width > 0 && r.height > 0, k: e.className }; });
  if (!stD || !stD.sicht || !/fehler/.test(stD.k)) fail('D', `keine sichtbare Fehlermeldung nach gescheitertem Upload: ${JSON.stringify(stD)}`);
  else ok(`Meldung sichtbar: "${stD.t}"`);
  await pD.waitForTimeout(Math.max(0, 35000 - (Date.now() - tAusfall)));
  cloud.failPost = false; const tFrei = Date.now(), nVor = cloud.zeiten.length;
  const angekommen = await warte(() => imCloud().includes('D-1'), 30000);
  console.log(`    (Uploads nach Freigabe: ${cloud.zeiten.slice(nVor).map(t => ((t - tFrei) / 1000).toFixed(1) + ' s').join(', ') || 'keiner'})`);
  if (!angekommen) fail('D', `Cloud nach 35 s Ausfall wieder da, D-1 nach 30 s ohne neue Eingabe nicht hochgeladen (Cloud: ${imCloud().join(',')})`);
  else {
    await pD.waitForTimeout(400);
    const stD2 = await pD.evaluate(() => (document.getElementById('tjCloud') || {}).className || '');
    if (!/\bok\b/.test(stD2)) fail('D', `nach dem Hochladen zeigt die Seite nicht "in the cloud" (${stD2})`);
    else ok('ohne neue Eingabe hochgeladen, Anzeige "in the cloud"');
  }

  // ── E: Grabstein ──────────────────────────────────────────────────────
  console.log('E) Geloeschter Trade kommt nicht vom anderen Geraet zurueck');
  const idE = await pD.evaluate(() => trades.find(t => t.a === 'D-1').id);
  const altE = await pD.evaluate(id => JSON.stringify(trades.find(t => t.id === id)), idE);
  await pD.evaluate(id => { tjZeigen(id); tjLoeschen(); }, idE);
  await warte(() => { const g = grab(idE); return g && g.del; }, 9000);
  // Zweites Geraet kennt den Trade noch lebend (aelterer Stand)
  const gE = await geraet([JSON.parse(altE)], 'U-ALT3');
  await gE.p.waitForTimeout(4000);
  const g = grab(idE), lokalE = await gE.p.evaluate(id => { const t = trades.find(x => x.id === id); return t ? !!t.del : 'fehlt'; }, idE);
  if (!g || !g.del) fail('E', `Grabstein in der Cloud verloren: ${JSON.stringify(g)}`);
  else if (lokalE !== true) fail('E', `zweites Geraet hat den geloeschten Trade noch (del=${lokalE})`);
  else ok('Grabstein bleibt in der Cloud, zweites Geraet uebernimmt das Loeschen');

  if (perr.length) fail('Seitenfehler', perr.slice(0, 3).join(' | '));
  for (const c of geraete) await c.close().catch(() => {});
  await b.close();
  if (GP) {
    const rot = ['A', 'B', 'C', 'D'].filter(k => F.some(f => f.startsWith(k + ':')));
    const fehlt = ['A', 'B', 'C', 'D'].filter(k => !rot.includes(k));
    if (fehlt.length) { console.log(`✗ Gegenprobe: ${fehlt.join(', ')} blieb gruen ohne Sicherung`); F.forEach(f => console.log('  ' + f)); process.exit(1); }
    console.log(`✓ Gegenprobe: ohne Sicherung rot in ${rot.join(', ')}`); F.forEach(f => console.log('    ' + f)); process.exit(0);
  }
  if (F.length) { console.log(`trades: ${F.length} Befund(e)`); F.forEach(f => console.log('  ' + f)); process.exit(1); }
  console.log('trades: ok (A Abgleich laedt eigene hoch, B alte App, C zwei Tabs, D Fehler sichtbar + Wiederholung, E Grabstein)');
})().catch(e => { console.error(e); process.exit(1); });
