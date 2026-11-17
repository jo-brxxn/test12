// ── PAPIERKORB FUER ALLES, WAS AUF DER SEITE GELOESCHT WIRD (seit 2026-11-17, VERSION-CHECK-757) ──
// Nutzer 2026-11-17: "im Papierkorb soll alles reinkommen was auf der Webseite geloescht wird"
// (Rueckfrage: Menuepunkt Trash, 30 Tage). Je Art ueber den ECHTEN Loeschweg der App:
// anlegen -> loeschen -> weg + genau ein Papierkorb-Eintrag mit lesbarem Namen -> Restore ->
// wieder da. Arten: Kalender-Eintrag (eigener), Pair, Watchlist, Preisalarm, Event-Alarm,
// Dashboard-Karte, Asset-Karte, Indikator, Asset, Trade, Notiz, Gameplan-History.
// Dazu: Trash-Seite listet alle Arten; Feed-Kalendereintraege (src 'ff') kommen NICHT hinein.
// --gegenprobe: trashAblegen tut nichts -> rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('function trashAblegen(kind,data){', 'function trashAblegen(kind,data){return;'); r.fulfill({ response: res, body: t }); });
  const tr = [{ id: 'pktr1', d: '2026-11-10', a: 'EUR/USD', st: 'closed', dir: 'long', entry: '1.08', exit: '1.09', pnl: '100', cd: '2026-11-12', up: '2026-11-12T00:00:00Z' }];
  await ctx.addInitScript(t => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); if (!sessionStorage.getItem('pk')) { localStorage.setItem('fxpro_trades', t); sessionStorage.setItem('pk', '1'); } } catch (e) { } }, JSON.stringify(tr));
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  const R = await p.evaluate(async () => {
    const out = [], T = () => (research.trash || []).length, warte = ms => new Promise(r => setTimeout(r, ms));
    const fall = async (name, anlegen, loeschen, da) => {
      try {
        await anlegen(); if (!da()) { out.push(`${name}: Testaufbau - nicht angelegt`); return; }
        const n0 = T(); await loeschen(); await warte(200);
        if (da()) { out.push(`${name}: nach dem Loeschen noch da`); return; }
        if (T() !== n0 + 1) { out.push(`${name}: ${T() - n0} Papierkorb-Eintraege statt 1`); return; }
        const t = research.trash[research.trash.length - 1], lab = trashEntryLabel(t);
        if (!lab || /^(Note|undefined)$/.test(lab)) out.push(`${name}: Papierkorb-Eintrag ohne lesbaren Namen (${lab})`);
        restoreTrashItem(t.id); await warte(200);
        if (!da()) out.push(`${name}: nach Restore nicht wieder da`);
        if ((research.trash || []).some(x => x.id === t.id)) out.push(`${name}: nach Restore noch im Papierkorb`);
      } catch (e) { out.push(`${name}: Fehler ${e.message}`); }
    };
    await fall('Kalender', () => { calEvts.push({ id: 'pkce1', name: 'PK Termin', date: '2026-12-01', time: '', currencies: 'USD', impact: 'high', src: '' }); }, () => delCalEv('pkce1'), () => calEvts.some(e => e.id === 'pkce1'));
    await fall('Pair', () => { pairs.push({ id: 'pkp1', name: 'EUR/GBP' }); }, () => delPair('pkp1'), () => pairs.some(x => x.id === 'pkp1'));
    await fall('Watchlist', () => { setWatched('EUR/USD', true); }, () => watchEntfernen('EUR/USD'), () => isWatched('EUR/USD'));
    await fall('Preisalarm', () => { priceAlerts.push({ id: 'pkpa1', target: 'EUR', dir: 'above', level: '1.2' }); }, () => delPriceAlert('pkpa1'), () => priceAlerts.some(x => x.id === 'pkpa1'));
    await fall('Event-Alarm', () => { eventAlerts.push({ id: 'pkea1', name: 'PK Alarm', fireAt: '2026-12-01T10:00:00Z' }); }, () => deleteEvtAlertById('pkea1'), () => eventAlerts.some(x => x.id === 'pkea1'));
    await fall('Dashboard-Karte', () => { window.__pkw = widgets[widgets.length - 1].id; }, () => delWidget(window.__pkw), () => widgets.some(w => w.id === window.__pkw));
    await fall('Asset-Karte', () => { gotoSym('EUR'); window.__pkr = getSym().rubrics[getSym().rubrics.length - 1].name; }, () => delRub(getSym().rubrics.length - 1), () => syms.find(s => s.id === 'EUR').rubrics.some(r => r.name === window.__pkr));
    await fall('Indikator', () => { gotoSym('EUR'); window.__pki = getSym().rubrics[0].indicators[0].id; }, () => delInd(0, 0), () => syms.find(s => s.id === 'EUR').rubrics[0].indicators.some(i => i.id === window.__pki));
    await fall('Asset', () => { }, () => { openDelSym('INTC'); confirmDelSym(); }, () => syms.some(s => s.id === 'INTC'));
    await fall('Trade', () => { showTab('journal'); }, () => { tjZeigen('pktr1'); tjLoeschen(); }, () => JSON.parse(localStorage.getItem('fxpro_trades') || '[]').some(x => x.id === 'pktr1' && !x.del));
    await fall('Notiz', () => { research.notes.push({ id: 'pkn1', fids: [], title: 'PK Notiz', body: 'x', tags: [], fav: false, pin: true, arch: false, ts: new Date().toISOString(), up: new Date().toISOString(), bias: 'neu', evt: null, asset: 'USD' }); }, () => resNoteToTrash('pkn1'), () => research.notes.some(n => n.id === 'pkn1'));
    await fall('Gameplan-History', () => { gpText('GBP', 'th', 'PK These'); gpHistAblegen('GBP'); window.__pkh = JSON.parse(snap()).gameplans.GBP.h.slice(-1)[0].id; }, () => gpHistLoeschen('GBP', window.__pkh), () => JSON.parse(snap()).gameplans.GBP.h.some(x => x.id === window.__pkh && !x.del));
    // Feed-Kalender nicht in den Papierkorb
    const ff = calEvts.find(e => e.src === 'ff');
    if (ff) { const n0 = T(); delCalEv(ff.id); if (T() !== n0) out.push('Feed-Kalendereintrag landet im Papierkorb'); }
    return out;
  });
  R.forEach(r => F.push(r));
  // Trash-Seite
  await p.evaluate(() => { pairs.push({ id: 'pkp2', name: 'AUD/NZD' }); delPair('pkp2'); showTab('notes'); }); await p.waitForTimeout(500);
  const seite = await p.evaluate(() => document.getElementById('pgNotes').innerText);
  if (!/Trash/.test(seite) || !/AUD\/NZD/.test(seite) || !/Pair/.test(seite)) F.push('Trash-Seite zeigt den geloeschten Pair nicht mit Typ und Namen');
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /Papierkorb-Eintraege statt 1/.test(f)); console.log(ok ? 'papierkorb --gegenprobe: ok (ohne Papierkorb-Eintrag rot)' : 'papierkorb --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('papierkorb: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('papierkorb: ok (12 Arten ueber die echten Loeschwege: weg, ein Eintrag mit Namen, Restore wieder da; Feed-Kalender bleibt draussen; Trash-Seite listet)');
})().catch(e => { console.log('papierkorb: ABBRUCH ' + e.message); process.exit(1); });
