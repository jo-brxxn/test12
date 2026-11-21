// ── "AWAITING" NUR FUER ECHT FEHLENDE RELEASES, ZEITZONEN-FEST (seit 2026-11-21, VERSION-CHECK-782) ──
// Nutzer-Foto 2026-11-20 (iPad, Berlin): JPY "GDP Growth q/q" mit Marke "AWAITING VALUE", obwohl der Wert
// (0 %, 15.11.) da war. Gemessen am Datenstand vom 20.11. 06:09 UTC: Forex Factory fuehrt "Prelim GDP q/q"
// am 15.11. 18:50 New York = 16.11. 00:50 Berlin ohne Actual, der Feed-Wert traegt das UTC-Datum 15.11. -
// indAwaitingEvent verglich nur die Datumstexte (16.11. > 15.11.) und hielt denselben Release fuer neu.
// Hier mit eingeschleusten Daten, Zeitzone Europe/Berlin:
//  A) derselbe Release ueber Mitternacht (Kalender ohne Actual, Feed-Wert am UTC-Tag davor) -> KEINE Marke
//  B) ein echter spaeterer Release (7 Tage nach dem Feed-Wert) ohne Actual -> Marke bleibt
// --gegenprobe: alter reiner Datumsvergleich -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const tag = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
(async () => {
  const F = [];
  const b = await chromium.launch();
  for (const [fall, kalTag, soll] of [['A', 5, false], ['B', 2, true]]) {
    const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
    const feedTag = tag(5);   // Feed-Wert (UTC-Datum)
    // Kalender: A = derselbe Release 18:50 New York am Feed-Tag (= naechster Tag 00:50 Berlin); B = 3 Tage spaeter
    const kal = fall === 'A' ? `${feedTag}T18:50:00-05:00` : `${tag(2)}T18:50:00-05:00`;
    await ctx.route(/\/ind_data\.json/, async r => { const res = await r.fetch(); const d = await res.json(); const j = d.JPY = d.JPY || {};
      j['GDP Growth QoQ'] = { actual: '0%', forecast: '0.1%', previous: '0.3%', date: feedTag, event: 'GDP Growth Rate QoQ Prel', source: 'tv', period: 'q/q', history: [] };
      r.fulfill({ response: res, body: JSON.stringify(d) }); });
    await ctx.route(/\/ff_calendar\.json/, async r => { const res = await r.fetch(); let d = await res.json(); if (!Array.isArray(d)) d = [];
      d = d.filter(e => !(e.country === 'JPY' && /gdp/i.test(e.title)));
      d.push({ title: 'Prelim GDP q/q', country: 'JPY', date: kal, impact: 'High', forecast: '0.1%', previous: '0.3%' });
      r.fulfill({ response: res, body: JSON.stringify(d) }); });
    if (GP) await ctx.route(/\/js\/score\.js/, async r => { const res = await r.fetch(); let t = await res.text();
      t = t.replace("if(have&&(ev.date<=have||t<=Date.parse(have+'T00:00:00Z')+36*3600e3))return;", 'if(have&&ev.date<=have)return;'); r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(3000);
    const r = await p.evaluate(async () => { const m = await import('/js/score.js'); const s = syms.find(x => x.id === 'JPY');
      let gdp = null; s.rubrics.forEach(rb => rb.indicators.forEach(i => { if (/^GDP Growth QoQ/.test(i.name)) gdp = i; }));
      if (!gdp) return { fehlt: true }; const ev = m.indAwaitingEvent('JPY', gdp); return { have: gdp.research && gdp.research.date, ev: ev && (ev.date + ' ' + ev.time + ' ' + ev.name) }; });
    if (r.fehlt) F.push(`${fall}: Testaufbau - JPY GDP-Zeile fehlt`);
    else if (!!r.ev !== soll) F.push(`${fall}: ${soll ? 'echter fehlender Release NICHT gemeldet' : 'derselbe Release als "Awaiting" gemeldet'} (Wert ${r.have}, Kalender ${r.ev || '-'})`);
    err.forEach(e => F.push(fall + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => /^A: /.test(f)); console.log(ok ? 'awaitzone --gegenprobe: ok (reiner Datumsvergleich meldet denselben Release)' : 'awaitzone --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('awaitzone: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('awaitzone: ok (derselbe Release ueber Mitternacht Berlin ohne Marke, echter spaeterer Release ohne Wert mit Marke)');
})().catch(e => { console.log('awaitzone: ABBRUCH ' + e.message); process.exit(1); });
