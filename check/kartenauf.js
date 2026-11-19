// ── HISTORY- UND KALENDER-KARTE: KEIN INNERES SCROLLEN, TIPP OEFFNET (seit 2026-11-18, VERSION-CHECK-759) ──
// Nutzer 2026-11-18: "die history Karte nicht mehr scrollbar machst das soll nur gehen wenn man sie
// oeffnet und sie soll sich auch oeffnen wenn man nur irgendwo auf sie drauf drueckt. Sowie bei dem
// minikalender". Gemessen vorher: History-Karte .histp 388 px sichtbar von 10070 px (scrollbar),
// Kalender-Karte Ansicht Past .calp 230 von 12513 px (scrollbar).
//  A) in beiden Karten (Kalender: Month UND Past) kein Element, das scrollen kann (overflow auto/scroll
//     mit mehr Inhalt als Hoehe) - 1194 und 390 px
//  B) Tipp auf eine freie Stelle der Karte (Kopf rechts neben dem Titel, Chart, Liste) -> Fenster offen
//  C) Knopf in der Karte (seit 775 nur "Open full history") wirkt allein und oeffnet das Fenster
//  D) Ziehen auf dem Chart (ohne Schere) ist kein Tipp -> kein Fenster
//  E) Price-Karte (762): kein "Biggest moves", "Go to Trends" in der Trend-score-Zeile, Event-Liste
//     scrollt erst nach einem Tipp, Tipp daneben sperrt wieder
// --gegenprobe: alte Regel (overflow auto) + Karte ohne onclick -> A und B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [W, H] of [[1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) {
      await ctx.route(/\/index\.html/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('.ab-htile-bd>.histp,.ab-htile .histp{overflow:hidden;', '.ab-htile-bd>.histp,.ab-htile .histp{overflow:auto;').replace('.ab-htile-bd{flex:1 1 auto;min-height:0;overflow:hidden;', '.ab-htile-bd{flex:1 1 auto;min-height:0;overflow:auto;').replace('.hp{flex:1 1 auto;min-height:0;', '.hp{flex:0 0 auto;min-height:900px;').replace('.calp-karte .calp{overflow:hidden;', '.calp-karte .calp{overflow:auto;'); r.fulfill({ response: res, body: t }); });
      await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace(`onclick="abKarteAuf(event,()=>openHistModal('\${escJH(c.id)}'))"`, ''); r.fulfill({ response: res, body: t }); });
    }
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(2500);
    const SCROLL = sel => p.evaluate(sel => { const k = document.querySelector(sel); if (!k) return null; const out = []; [k, ...k.querySelectorAll('*')].forEach(x => { const s = getComputedStyle(x); if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && x.scrollHeight > x.clientHeight + 2) out.push(String(x.className || x.id).slice(0, 30) + ' ' + x.clientHeight + '/' + x.scrollHeight); }); return out; }, sel);
    const offen = id => p.evaluate(id => { const m = document.getElementById(id); return !!m && getComputedStyle(m).display !== 'none'; }, id);
    const zu = () => p.evaluate(() => { ['mHist', 'mAssetCal'].forEach(id => { try { closeM(id); } catch (e) { } }); });
    const tipp = async (sel, fx, fy) => { const r = await p.evaluate(([sel, fx, fy]) => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.x + q.width * fx, q.y + q.height * fy]; }, [sel, fx, fy]); if (!r) return false; await p.waitForTimeout(200); const r2 = await p.evaluate(([sel, fx, fy]) => { const q = document.querySelector(sel).getBoundingClientRect(); return [q.x + q.width * fx, q.y + q.height * fy]; }, [sel, fx, fy]); await p.mouse.click(r2[0], r2[1]); await p.waitForTimeout(500); return true; };
    // A History
    const aH = await SCROLL('.ab-htile');
    if (aH === null) F.push(`${o} A: Testaufbau - keine History-Karte`); else if (aH.length) F.push(`${o} A: History-Karte scrollt: ${aH.join(', ')}`);
    // B History: Liste, Chart
    for (const [wo, sel, fx, fy] of [['Liste (sichtbarer Teil)', '.ab-htile .ab-htile-bd', 0.5, 0.85], ['Chart', '.ab-htile .hp-ch', 0.5, 0.5], ['Kopf', '.ab-htile .ab-tile-hd', 0.6, 0.5]]) {
      await zu(); if (!(await tipp(sel, fx, fy))) { F.push(`${o} B: Testaufbau - ${wo} nicht gefunden`); continue; }
      if (!(await offen('mHist'))) F.push(`${o} B: Tipp auf die History-Karte (${wo}) oeffnet das Fenster nicht`);
    }
    // C History: Knopf in der Karte ("Open full history") wirkt allein - seit 775 ist er der einzige Knopf
    //   (Zeitraum-Knoepfe gibt es nur noch im Fenster); er oeffnet das Fenster GENAU einmal und wirft nichts
    await zu();
    const knopf = await p.evaluate(() => { const bt = document.querySelector('.ab-htile .ab-goto-b'); if (!bt) return null; bt.scrollIntoView({ block: 'center' }); const q = bt.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; });
    if (!knopf) F.push(`${o} C: Testaufbau - kein Knopf "Open full history"`);
    else { await p.mouse.click(knopf[0], knopf[1]); await p.waitForTimeout(500); if (!(await offen('mHist'))) F.push(`${o} C: Knopf "Open full history" oeffnet das Fenster nicht`); }
    // D: Ziehen auf dem Chart (ohne Schere) oeffnet NICHT
    await zu();
    const ch = await p.evaluate(() => { const el = document.querySelector('.ab-htile [data-br]'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const q = el.getBoundingClientRect(); return [q.x, q.y, q.width, q.height]; });
    if (ch) { await p.mouse.move(ch[0] + ch[2] * 0.3, ch[1] + ch[3] * 0.5); await p.mouse.down(); await p.mouse.move(ch[0] + ch[2] * 0.7, ch[1] + ch[3] * 0.5, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500);
      if (await offen('mHist')) F.push(`${o} D: Ziehen auf dem History-Chart oeffnet das Fenster`); }
    // Kalender: Month und Past
    for (const sicht of ['month', 'past']) {
      await zu(); await p.evaluate(s => setAbCalSicht(s), sicht); await p.waitForTimeout(1200);
      const aC = await SCROLL('.abc-cal');
      if (aC === null) { F.push(`${o} A: Testaufbau - keine Kalender-Karte (${sicht})`); continue; }
      if (aC.length) F.push(`${o} A: Kalender-Karte (${sicht}) scrollt: ${aC.join(', ')}`);
      if (!(await tipp(sicht === 'past' ? '.abc-cal .calp' : '.abc-cal .abc-range', 0.5, 0.5))) { F.push(`${o} B: Testaufbau - Kalender-Flaeche (${sicht}) nicht gefunden`); continue; }
      if (!(await offen('mAssetCal'))) F.push(`${o} B: Tipp auf die Kalender-Karte (${sicht}) oeffnet das Fenster nicht`);
    }
    await zu(); await p.evaluate(() => setAbCalSicht('month'));
    // E: Price-Karte (762) - kein "Biggest moves", "Go to Trends" in der Trend-score-Zeile,
    //    Event-Liste scrollt erst nach einem Tipp, Tipp daneben sperrt wieder
    await p.evaluate(() => document.querySelector('.ab-ptile.pk').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    const E = await p.evaluate(() => { const k = document.querySelector('.ab-ptile.pk'), go = k.querySelector('.ab-goto-b'), ln = k.querySelector('.ab-scoreline'); const g = go && go.getBoundingClientRect(), l = ln && ln.getBoundingClientRect();
      return { biggest: /Biggest moves/.test(k.textContent), goZeile: !!(g && l && g.top >= l.top - 2 && g.bottom <= l.bottom + 2) }; });
    if (E.biggest) F.push(`${o} E: "Biggest moves" noch da`);
    if (!E.goZeile) F.push(`${o} E: "Go to Trends" nicht in der Trend-score-Zeile`);
    const lp = await p.evaluate(() => { const q = document.querySelector('.ab-ptile.pk .pk-list').getBoundingClientRect(); return [q.x + q.width / 2, q.y + Math.min(q.height, 200) / 2]; });
    await p.mouse.move(lp[0], lp[1]); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
    const st0 = await p.evaluate(() => document.querySelector('.ab-ptile.pk .pk-list').scrollTop);
    if (st0 > 0) F.push(`${o} E: Event-Liste scrollt ohne Tipp (${st0} px)`);
    const scrollbar = await p.evaluate(() => { const l = document.querySelector('.ab-ptile.pk .pk-list'); return l.scrollHeight > l.clientHeight + 2; });
    // das Rad bei gesperrter Liste scrollt richtigerweise die SEITE - Liste neu anpeilen
    await p.evaluate(() => document.querySelector('.ab-ptile.pk .pk-list').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    const lp2 = await p.evaluate(() => { const q = document.querySelector('.ab-ptile.pk .pk-list').getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; });
    await p.mouse.click(lp2[0], lp2[1]); await p.waitForTimeout(200); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
    const st1 = await p.evaluate(() => document.querySelector('.ab-ptile.pk .pk-list').scrollTop);
    if (scrollbar && !(st1 > 0)) F.push(`${o} E: Event-Liste scrollt nach dem Tipp nicht`);
    await p.mouse.click(4, H - 4); await p.waitForTimeout(200);
    if (await p.evaluate(() => document.querySelector('.ab-ptile.pk .pk-col').classList.contains('pk-scroll'))) F.push(`${o} E: Tipp daneben sperrt die Liste nicht wieder`);
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / A: History-Karte scrollt/.test(f)) && F.some(f => / B: Tipp auf die History-Karte/.test(f)); console.log(ok ? 'kartenauf --gegenprobe: ok (Scrollen + fehlendes Oeffnen gemeldet)' : 'kartenauf --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('kartenauf: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('kartenauf: ok (History- und Kalender-Karte ohne inneres Scrollen, Tipp irgendwo oeffnet das Fenster, Knoepfe in der Karte wirken allein, 1194/390 px)');
})().catch(e => { console.log('kartenauf: ABBRUCH ' + e.message); process.exit(1); });
