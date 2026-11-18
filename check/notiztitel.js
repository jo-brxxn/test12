// ── NOTIZTITEL GANZ + ENTPINNEN LANDET IN DER HISTORY (seit 2026-11-18, VERSION-CHECK-758) ──
// Nutzer 2026-11-18: "Mach so das jede Notiz von aussen die Ueberschrift komplett zu lesen ist und
// nicht abgekuerzt also abgeschnitten wird" + "wenn ich eine Note unpinne ... die Note soll ja in
// der history sein aber ist sie nicht".
// Gemessen vorher: Pinned-Karte + Watchlist einzeilig mit Ellipse, Bank-Karte nach 3 Zeilen gekappt;
// Haken "Pin" im Notizfenster entfernen + Save -> kein hist -> beim naechsten Laden im Trash.
//  A) langer Titel ganz lesbar (kein Ueberlauf, keine Kappung): Pinned-Karte, Bank-Karte,
//     Watchlist, History-Fenster, Trash-Seite - 1194 und 390 px
//  B) Entpinnen ueber den Knopf an der Karte UND ueber den Haken im Fenster -> History,
//     nach Neuladen noch dort, nicht im Trash; neue Notiz ohne Pin ebenso
// --gegenprobe: alte Titel-Regeln (Ellipse) -> A rot; --gegenprobe-hist: Fenster setzt keinen
// History-Stempel -> B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe'), GPH = process.argv.includes('--gegenprobe-hist');
const LANG = 'Fed signals two more hikes because services inflation stays sticky well above target into Q1';
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/index\.html/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace(/\.ab-nt-ti,\.wt-pin-ti,\.aqn-n-ti,[^{]*\{[^}]*\}/, ''); r.fulfill({ response: res, body: t }); });
    if (GPH) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('n.pin=n.arch||n.cb?false:pin;n.up=now;notizHistStempel(n,now);', 'n.pin=n.arch||n.cb?false:pin;n.up=now;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    // A
    await p.evaluate(L => {
      const now = new Date().toISOString(), n = (id, x) => Object.assign({ id, fids: [], title: L, body: 'Body', tags: [], fav: false, pin: true, arch: false, ts: now, up: now, bias: 'bull', evt: null, asset: 'USD' }, x || {});
      research.notes.push(n('ntl1'), n('ntl2', { pin: false, hist: now }), n('ntl3', { pin: false, asset: '', cb: { b: 'USD', s: 'infl', m: '2026-11-05' } }));
      setWatched('EUR/USD', true); trashResNote({ ...n('ntl9') }); save();
    }, LANG);
    const MESS = sel => p.evaluate(([sel, L]) => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0 && e.textContent.includes('Fed signals'))
      .map(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || e.textContent.trim().length < L.length - 2), [sel, LANG]);
    for (const [wo, fn, sel] of [['Pinned-Karte', "gotoSym('USD')", '.ab-ntile .ab-nt-ti'], ['Bank-Karte', "gotoSym('USD')", '.zb-schaft .ab-nt-ti,.zb-card .ab-nt-ti'], ['Watchlist', "showTab('watch')", '.wt-pin-ti'],
      ['History', "gotoSym('USD');pinHistAuf('USD')", '#pinHistBody b'], ['Trash', "closeM('mPinHist');showTab('notes')", '.tr-ti b']]) {
      await p.evaluate(fn); await p.waitForTimeout(1500);
      const r = await MESS(sel);
      if (!r.length) F.push(`${o} A: ${wo} - Testaufbau, Titel nicht gefunden`);
      else if (r.some(x => x)) F.push(`${o} A: ${wo} - Titel abgeschnitten`);
    }
    // B (nur einmal)
    if (W === 1194) {
      const neu = async (t, pin) => {
        await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(600);
        await p.evaluate(() => newResNoteForAsset('USD')); await p.waitForTimeout(300);
        await p.fill('#resNTitle', t);
        if (!pin) await p.locator('#resNPin').uncheck();
        await p.locator('#mResNote button', { hasText: /^Save/ }).first().click(); await p.waitForTimeout(500);
      };
      await neu('NTH Knopf', true); await neu('NTH Haken', true); await neu('NTH ohne Pin', false);
      await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(800);
      const kn = await p.evaluate(() => { const z = [...document.querySelectorAll('.ab-nt')].find(e => /NTH Knopf/.test(e.textContent)); const bt = z && [...z.querySelectorAll('button')].find(x => /Unpin/.test(x.title)); if (!bt) return null; bt.scrollIntoView({ block: 'center' }); const r = bt.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      if (!kn) F.push('B: Testaufbau - kein Unpin-Knopf an der Karte'); else { await p.mouse.click(kn[0], kn[1]); await p.waitForTimeout(400); }
      await p.evaluate(() => { const n = research.notes.find(x => x.title === 'NTH Haken'); openResNote(n.id); }); await p.waitForTimeout(300);
      await p.locator('#resNPin').uncheck(); await p.locator('#mResNote button', { hasText: /^Save/ }).first().click(); await p.waitForTimeout(500);
      await p.reload(); await wartenBisDatenDa(p); await p.waitForTimeout(1000);
      const B = await p.evaluate(() => ['NTH Knopf', 'NTH Haken', 'NTH ohne Pin'].map(t => { const n = research.notes.find(x => x.title === t); return [t, !!(n && !n.pin && n.hist), (research.trash || []).some(x => x.data && x.data.title === t), typeof pinHist === 'function' && pinHist('USD').some(x => x.title === t)]; }));
      B.forEach(([t, hist, trash, liste]) => { if (!hist || trash || !liste) F.push(`B: "${t}" nach Neuladen ${trash ? 'im Trash' : 'nicht in der History'}`); });
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: .*abgeschnitten/.test(f)); console.log(ok ? 'notiztitel --gegenprobe: ok (Ellipse gemeldet)' : 'notiztitel --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (GPH) { const ok = F.some(f => /^B: .*Haken.*im Trash|^B: .*ohne Pin.*im Trash/.test(f)); console.log(ok ? 'notiztitel --gegenprobe-hist: ok (Entpinnen im Fenster landet im Trash)' : 'notiztitel --gegenprobe-hist: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('notiztitel: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('notiztitel: ok (langer Titel ganz in Pinned-Karte, Bank-Karte, Watchlist, History, Trash bei 1194/390 px; Entpinnen per Knopf, per Haken und neue Notiz ohne Pin -> History, auch nach Neuladen)');
})().catch(e => { console.log('notiztitel: ABBRUCH ' + e.message); process.exit(1); });
