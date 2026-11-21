// ── KARTEN SCROLLEN ERST NACH EINEM KLICK (seit 2026-11-19, VERSION-CHECK-773) ──
// Nutzer 2026-11-19 (PC): "alle Karten in denen man scrollen kann sollen erst scrollbar sein wenn man sie
// klickt". Gemessen vorher: Key events (Dashboard) und die Gameplan-Liste scrollten unter dem Mausrad
// selbst und hielten die Seite an; dazu je nach Datenmenge Upcoming Events, Notifications, Listen-Widgets,
// Kalender-/Notiz-/History-Listen der Asset-Seite. Muster der Price-Karte (762) jetzt fuer alle.
//  A) OHNE LISTE: auf jeder Seite (18 Tabs + USD/GOLD, 1920 + 390 px) hat kein Element im Seitenbereich
//     (ausser der Seite selbst und Fenstern) einen eigenen Scrollbereich mit Ueberhang - erkannt an der
//     Form (overflow-y auto/scroll + scrollHeight > clientHeight), neue Listen fallen also automatisch auf
//  B) Key events: Rad ohne Klick scrollt die Seite, nicht die Liste; Klick schaltet frei OHNE die Zeile
//     zu oeffnen (Zeilen sind Links); danach scrollt das Rad die Liste; Klick daneben sperrt wieder
// --gegenprobe: die Sperr-Regel aus dem CSS entfernt -> A und B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const REGEL = ':not(.ks-an){overflow-y:hidden!important}';
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1920, 1080], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    await ctx.route(/\/index\.html/, async r => { const res = await r.fetch(); let t = await res.text();
      if (!t.includes(REGEL)) F.push('Testaufbau: Sperr-Regel im CSS nicht gefunden');
      if (GP) t = t.split(REGEL).join(':not(.ks-an){}');
      r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(3000);
    await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    // B zuerst (Dashboard ist die Startseite)
    // Eigene Termine fuer heute statt des Feed-Stands (CI 2026-11-21, Samstag: kein Termin ->
    // es gab gar keine Liste, Befund "ohne Ueberhang" ohne Fehler der App - wie check/calpast.js).
    await p.evaluate(() => {
      const t = todayStr();
      for (let i = 0; i < 16; i++) calEvts.push({ id: 'ks-test' + i, name: 'Scroll Test Release ' + (i + 1), date: t, time: String(6 + (i >> 1)).padStart(2, '0') + (i % 2 ? ':30' : ':00'), currencies: 'USD', impact: i % 2 ? 'medium' : 'high', src: 'ff' });
      renderDash();
    });
    await p.waitForTimeout(600);
    const L = await p.evaluateHandle(() => [...document.querySelectorAll('.db-ev-list')].find(e => e.offsetParent && e.scrollHeight > e.clientHeight + 4) || null);
    if (!(await L.evaluate(e => !!e))) F.push(`${o} B: Testaufbau - Key events ohne Ueberhang`);
    else {
      await L.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
      const st = () => p.evaluate(l => ({ l: Math.round(l.scrollTop), s: Math.round(document.getElementById('pgDash').scrollTop || document.scrollingElement.scrollTop), tab: curPage }), L);
      const mitte = async () => { const x = await L.boundingBox(); return [x.x + x.width / 2, x.y + x.height / 2]; };
      let m = await mitte(), a = await st();
      await p.mouse.move(...m); await p.mouse.wheel(0, 150); await p.waitForTimeout(400);
      let c = await st();
      if (c.l !== a.l) F.push(`${o} B: Rad ohne Klick scrollt die Liste (${a.l} -> ${c.l})`);
      if (c.s === a.s) F.push(`${o} B: Rad ohne Klick scrollt die Seite nicht`);
      await L.evaluate(e => { e.scrollTop = 0; }); m = await mitte(); await p.mouse.click(...m); await p.waitForTimeout(400);
      c = await st();
      if (c.tab !== 'dash') F.push(`${o} B: freischaltender Klick oeffnet die Zeile (Seite ${c.tab})`);
      else {
        a = c; m = await mitte(); await p.mouse.move(...m); await p.mouse.wheel(0, 150); await p.waitForTimeout(400); c = await st();
        if (c.l <= a.l) F.push(`${o} B: nach dem Klick scrollt das Rad die Liste nicht (${a.l} -> ${c.l})`);
        await p.mouse.click(4, H - 4); await p.waitForTimeout(300);
        if (await L.evaluate(e => e.classList.contains('ks-an'))) F.push(`${o} B: Klick daneben sperrt die Liste nicht`);
      }
    }
    for (const t of ['dash', 'cur', 'GOLD', 'regime', 'news', 'mx', 'trends', 'cot', 'sent', 'seas', 'data', 'rate', 'carry', 'pairs', 'watch', 'gameplan', 'econ', 'journal', 'cal', 'notes']) {
      await p.evaluate(t => { document.querySelectorAll('.ks-an').forEach(x => x.classList.remove('ks-an')); if (t === 'cur') gotoSym('USD'); else if (t === 'GOLD') gotoSym('GOLD'); else showTab(t); }, t);
      await p.waitForTimeout(t === 'cur' || t === 'GOLD' ? 1800 : 1000);
      const r = await p.evaluate(() => {
        const seiten = new Set(Object.values(PAGE_IDS).concat(['detail', 'pageArea'])); const out = [];
        document.querySelectorAll('#pageArea *').forEach(e => {
          if (seiten.has(e.id) || !e.offsetParent || e.closest('.ov')) return;
          if (!/(auto|scroll)/.test(getComputedStyle(e).overflowY)) return;
          if (e.scrollHeight <= e.clientHeight + 4 || e.clientHeight < 40) return;
          out.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ` (${e.clientHeight}/${e.scrollHeight})`);
        });
        return out;
      });
      r.forEach(x => F.push(`${o} A: ${t} - ${x} scrollt ohne Klick`));
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: /.test(f)) && F.some(f => / B: Rad ohne Klick scrollt die Liste/.test(f)); console.log(ok ? 'klickscroll --gegenprobe: ok (ohne Sperre A und B rot)' : 'klickscroll --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('klickscroll: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('klickscroll: ok (keine Karte scrollt ohne Klick auf 19 Seiten, Key events: Rad -> Seite, Klick schaltet frei ohne zu oeffnen, daneben sperrt; 1920/390 px)');
})().catch(e => { console.log('klickscroll: ABBRUCH ' + e.message); process.exit(1); });
