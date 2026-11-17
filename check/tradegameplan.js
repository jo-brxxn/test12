// ── GAMEPLAN AM TRADE (seit 2026-11-17, VERSION-CHECK-741) ─────────────────────
// Nutzer 2026-11-17: "bei Open trades das wenn ich ja ein Asset auswaehle direkt die These
// angehaengt wird zu dem Asset also den aktuellen gameplan ... Wenn der gameplan leer ist dann
// oeffnet sich beim hinzufuegen druecken ein Fenster und man kann ihn [dann] ausfuellen das wird
// dann auch so fuer den gameplan uebernommen". Rueckfrage: Kopie beim Speichern, These Pflicht.
//  A) GOLD mit Plan: Formular zeigt den Plan beim Asset, Speichern haengt eine Kopie an (t.gp)
//  B) Gameplan danach geaendert -> die Kopie am Trade bleibt wie beim Einstieg
//  C) NZD/JPY ohne Plan: Speichern oeffnet das Fenster mit beiden Waehrungen, ohne These kein
//     Trade; ausgefuellt -> Trade gespeichert UND beide Gameplans haben die These
//  D) Asset ohne eigene Seite: kein Fenster, Trade ohne Plan gespeichert
//  E) Karte "Open trades" zeigt Asset-Name + These
//  F) 390 px: Fenster ohne Seitenueberlauf
//  G) Asset-Auswahl wie jeder Asset-Filter (Nutzer 2026-11-17): Gruppen FX Pairs + Kategorien,
//     Antippen oeffnet das 2-Spalten-Fenster, Wahl setzt das Asset und zeigt den Plan
//  H) Open date geaendert -> das Werkzeug im Chart beginnt dort, seine Breite bleibt
// --gegenprobe H: node check/tradegameplan.js --gegenprobe-datum (tjDatumNeu ohne Verschieben) -> H rot.
// --gegenprobe: Pflicht-Pruefung entfernt -> C rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe'), GPD = process.argv.includes('--gegenprobe-datum');
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GPD) await ctx.route(/\/js\/trades\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('a.value=d;if(b)b.value=\'\';', ''); r.fulfill({ response: res, body: t }); });
    if (GP) await ctx.route(/\/js\/trades\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('if(ohne.length){tjGpFensterAuf(ohne);return false;}', ''); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov').forEach(m => { m.style.display = 'none'; }); showTab('journal'); });
    const trades = () => p.evaluate(() => JSON.parse(localStorage.getItem('fxpro_trades') || '[]').filter(t => !t.del));
    const neu = async a => { await p.evaluate(() => tjNeu()); await p.waitForTimeout(300); await p.evaluate(a => tjAssetSetzen(a), a); await p.waitForTimeout(400); };
    const offen = id => p.evaluate(id => getComputedStyle(document.getElementById(id)).display !== 'none', id);
    // G
    await p.evaluate(() => tjNeu()); await p.waitForTimeout(300);
    const Gg = await p.evaluate(() => [...document.querySelectorAll('#tjAsset optgroup')].map(g => g.label));
    if (Gg[0] !== 'FX Pairs' && Gg[0] !== 'Watchlist' || !['Metals', 'Indices', 'Energy'].every(x => Gg.includes(x))) F.push(`${o} G: Asset-Auswahl nicht nach Kategorien (${Gg.join('|')})`);
    const rG = await p.evaluate(() => { const b = document.getElementById('tjAsset').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await p.mouse.click(rG[0], rG[1]); await p.waitForTimeout(400);
    if (!(await p.evaluate(() => !!document.getElementById('gwPicker')))) F.push(`${o} G: Antippen der Asset-Auswahl oeffnet kein 2-Spalten-Fenster`);
    else { await p.click('#gwPicker button:has-text("Silver")'); await p.waitForTimeout(400);
      const gv = await p.evaluate(() => [document.getElementById('tjAsset').value, document.getElementById('tjGpBox').hidden]);
      if (gv[0] !== 'SILVER' || gv[1]) F.push(`${o} G: Wahl im Fenster setzt das Asset/den Plan nicht (${gv})`); }
    // H: Open date aendern -> Werkzeug beginnt dort, Breite bleibt (Nutzer 2026-11-17)
    await p.waitForTimeout(800);
    const hb = await p.evaluate(() => { const r = document.getElementById('tjChart').getBoundingClientRect(); return [r.x + r.width * 0.55, r.y + r.height * 0.5]; });
    await p.mouse.click(hb[0], hb[1]); await p.waitForTimeout(500);
    const H0 = await p.evaluate(() => { const r = document.querySelector('#tjChart-tool rect'); return { w0: document.getElementById('tjW0').value, w: r && +r.getAttribute('width') }; });
    await p.fill('#tjDate', '2026-10-01'); await p.dispatchEvent('#tjDate', 'change'); await p.waitForTimeout(900);
    const H1 = await p.evaluate(() => { const r = document.querySelector('#tjChart-tool rect'); return { w0: document.getElementById('tjW0').value, w: r && +r.getAttribute('width'), t: document.getElementById('tjChTitel').textContent }; });
    if (!H0.w0) F.push(`${o} H: Testaufbau - Tipp setzt kein Werkzeug`);
    else if (H1.w0 !== '2026-10-01' || Math.abs((H1.w || 0) - H0.w) > 1) F.push(`${o} H: neues Open date verschiebt das Werkzeug nicht (Beginn ${H1.w0}, Breite ${H0.w} -> ${H1.w})`);
    if (H1.t !== 'Silver') F.push(`${o} G: Chart-Titel "${H1.t}" statt "Silver"`);
    await p.evaluate(() => closeM('mTrade'));
    // A
    await p.evaluate(() => { gpBias('GOLD', 'bull'); gpText('GOLD', 'th', 'Real yields falling'); }); await p.waitForTimeout(600);
    await neu('GOLD');
    const box = await p.evaluate(() => { const x = document.getElementById('tjGpBox'); return x && !x.hidden ? x.innerText : ''; });
    if (!/Gameplan · Gold/i.test(box) || !/Real yields falling/.test(box)) F.push(`${o} A: Formular zeigt den GOLD-Plan nicht ("${box.replace(/\n/g, ' | ').slice(0, 80)}")`);
    await p.click('#mTrade .m-btns .btn.g'); await p.waitForTimeout(600);
    if (await offen('mTradeGp')) F.push(`${o} A: Fenster offen, obwohl GOLD eine These hat`);
    let t = await trades(); const tg = t.find(x => x.a === 'GOLD');
    if (!tg || !Array.isArray(tg.gp) || tg.gp[0].id !== 'GOLD' || tg.gp[0].th !== 'Real yields falling' || tg.gp[0].b !== 'bull') F.push(`${o} A: Trade ohne Kopie des Plans: ${JSON.stringify(tg && tg.gp)}`);
    // B
    await p.evaluate(() => gpText('GOLD', 'th', 'Changed later')); await p.waitForTimeout(600);
    t = await trades();
    if ((t.find(x => x.a === 'GOLD').gp || [{}])[0].th !== 'Real yields falling') F.push(`${o} B: Kopie am Trade hat sich mit dem Gameplan geaendert`);
    // C
    await neu('NZD/JPY');
    await p.click('#mTrade .m-btns .btn.g'); await p.waitForTimeout(500);
    const C1 = await p.evaluate(() => ({ s0: !document.getElementById('tjgS0').hidden && document.getElementById('tjgN0').textContent, s1: !document.getElementById('tjgS1').hidden && document.getElementById('tjgN1').textContent }));
    if (!(await offen('mTradeGp'))) F.push(`${o} C: NZD/JPY ohne Plan - kein Gameplan-Fenster`);
    else {
      if (!C1.s0 || !C1.s1) F.push(`${o} C: Fenster zeigt nicht beide Waehrungen (${C1.s0} | ${C1.s1})`);
      await p.click('#mTradeGp .m-btns .btn.g'); await p.waitForTimeout(300);
      const fehl = await p.evaluate(() => { const e = document.getElementById('tjgErr'); return e && !e.hidden ? e.textContent : ''; });
      if (!/thesis/i.test(fehl)) F.push(`${o} C: Speichern ohne These ohne Meldung`);
      if ((await trades()).some(x => x.a === 'NZD/JPY')) F.push(`${o} C: Trade ohne These gespeichert`);
      if (W < 500) { const ue = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ue > 1) F.push(`${o} F: Fenster laeuft ${ue} px ueber`); }
      await p.fill('#tjgTh0', 'RBNZ on hold'); await p.click('#tjgS1 .tj-seg-b[data-b="bear"]'); await p.fill('#tjgTh1', 'BoJ hikes again');
      await p.click('#mTradeGp .m-btns .btn.g'); await p.waitForTimeout(800);
    }
    t = await trades(); const tn = t.find(x => x.a === 'NZD/JPY');
    const gpS = await p.evaluate(() => { const g = JSON.parse(snap()).gameplans; return { nzd: (g.NZD || {}).th, jpy: (g.JPY || {}).th, jb: (g.JPY || {}).b }; });
    if (!tn) F.push(`${o} C: Trade nach dem Ausfuellen nicht gespeichert`);
    else if (!Array.isArray(tn.gp) || tn.gp.map(x => x.th).join('|') !== 'RBNZ on hold|BoJ hikes again') F.push(`${o} C: Kopie am Trade falsch: ${JSON.stringify(tn.gp)}`);
    if (!GP && (gpS.nzd !== 'RBNZ on hold' || gpS.jpy !== 'BoJ hikes again' || gpS.jb !== 'bear')) F.push(`${o} C: Eingabe nicht in den Gameplan uebernommen ${JSON.stringify(gpS)}`);
    // D
    await neu('MYASSET1'); await p.click('#mTrade .m-btns .btn.g'); await p.waitForTimeout(500);
    if (await offen('mTradeGp')) F.push(`${o} D: Fenster fuer ein Asset ohne Gameplan`);
    t = await trades(); const td = t.find(x => x.a === 'MYASSET1');
    if (!td) F.push(`${o} D: Trade ohne Gameplan-Asset nicht gespeichert`); else if (td.gp && td.gp.length) F.push(`${o} D: Asset ohne Gameplan hat trotzdem einen Plan`);
    // E
    await p.evaluate(() => renderJournal()); await p.waitForTimeout(300);
    const E = await p.evaluate(() => [...document.querySelectorAll('.tjo .tj-gp-kurz')].map(x => x.innerText.replace(/\s+/g, ' ').trim()));
    if (!E.some(x => /Gold/i.test(x) && /Real yields falling/.test(x))) F.push(`${o} E: Karte "Open trades" ohne Asset + These (${E.join(' | ').slice(0, 120)})`);
    const ue = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ue > 1) F.push(`${o} F: Journal laeuft ${ue} px ueber`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GPD) { const ok = F.some(f => / H: neues/.test(f)); console.log(ok ? 'tradegameplan --gegenprobe-datum: ok (stehengebliebenes Werkzeug gemeldet)' : 'tradegameplan --gegenprobe-datum: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (GP) { const ok = F.some(f => / C: /.test(f)); console.log(ok ? 'tradegameplan --gegenprobe: ok (fehlendes Pflicht-Fenster gemeldet)' : 'tradegameplan --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('tradegameplan: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('tradegameplan: ok (Plan im Formular, Kopie am Trade bleibt, leerer Plan -> Pflicht-Fenster mit beiden Waehrungen, Eingabe auch im Gameplan, Asset ohne Plan ohne Fenster, These auf der Karte, 1194/390 px)');
})().catch(e => { console.log('tradegameplan: ABBRUCH ' + e.message); process.exit(1); });
