// ── GLOBAL YIELDS (seit 2026-11-22, VERSION-CHECK-799, Score-Modell 40) ──
// Nutzer 2026-11-22: "global yields ... alle 10y yields der Waehrungen ... daraus ein yield ... Trend durch einen
// Daily 90 Ema ... ueberall bei Non fx ausser yields ... ueber Ema negativ 0.5".
//  A) Zeile "Global Yields" in der Inflation-Karte jedes Nicht-FX-Assets ausser Yield-Assets; FX/Yields ohne
//  B) Wert und EMA 90 UNABHAENGIG aus bond_data.json nachgerechnet (Durchschnitt ab dem Tag mit allen Reihen)
//  C) ueber EMA -> -0,5, darunter -> +0,5, Beitrag im Score genau so
// --gegenprobe: Vorzeichen in der App gedreht -> C rot
const fs = require('fs'), path = require('path');
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const MARKE = "const bias=a[1]>ema?'bear':a[1]<ema?'bull':'neu';";
(async () => {
  const F = [], OK = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/data-feeds\.js/, async r => { const res = await r.fetch(); const t = await res.text(); if (!t.includes(MARKE)) F.push('Gegenprobe: Marke fehlt'); r.fulfill({ response: res, body: t.replace(MARKE, "const bias=a[1]>ema?'bull':a[1]<ema?'bear':'neu';") }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(1500);
  const ist = await p.evaluate(() => { const heute = todayStr(); const out = { heute, z: {} };
    syms.forEach(s => { const rub = (s.rubrics || []).find(r => r.name === 'Inflation'); const i = rub && rub.indicators.find(x => x.name === 'Global Yields');
      out.z[s.id] = { fx: !isNonFx(s.id), yld: /YIELD$/.test(s.id), da: !!i, bias: i && i.bias, a: i && i.research && i.research.actual, ema: i && i.research && i.research.ema, d: i && i.research && i.research.date, sc: i ? indScore(i, rub) : null }; });
    return out; });
  const fehlt = Object.entries(ist.z).filter(([id, z]) => !z.fx && !z.yld && !z.da).map(([id]) => id);
  const falsch = Object.entries(ist.z).filter(([id, z]) => (z.fx || z.yld) && z.da).map(([id]) => id);
  if (fehlt.length || falsch.length) F.push(`A: fehlt bei ${fehlt.join(',') || '-'}; faelschlich bei ${falsch.join(',') || '-'}`);
  else OK.push(`A: Zeile bei ${Object.values(ist.z).filter(z => z.da).length} Nicht-FX-Assets, nicht bei FX/Yields`);
  // B unabhaengig
  const bond = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bond_data.json'), 'utf8'));
  const gestern = new Date(Date.parse(ist.heute + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);   // datum-ok: reine Datumsrechnung auf dem App-Tag
  const rs = Object.keys(bond).map(c => ((bond[c] || {})['10Y Bond Yield'] || {}).series).filter(Array.isArray).map(s => s.filter(e => String(e[0]).slice(0, 10) <= gestern && isFinite(+e[1])).map(e => [String(e[0]).slice(0, 10), +e[1]]));
  const tage = [...new Set(rs.flat().map(e => e[0]))].sort(), last = rs.map(() => null), ix = rs.map(() => 0), reihe = [];
  tage.forEach(t => { rs.forEach((s, k) => { while (ix[k] < s.length && s[ix[k]][0] <= t) { last[k] = s[ix[k]][1]; ix[k]++; } }); if (last.every(v => v != null)) reihe.push([t, last.reduce((a, v) => a + v, 0) / last.length]); });
  let soll = null;
  if (reihe.length >= 90) { let ema = reihe.slice(0, 90).reduce((a, x) => a + x[1], 0) / 90; for (let i = 90; i < reihe.length; i++) ema = reihe[i][1] * (2 / 91) + ema * (1 - 2 / 91);
    const a = reihe[reihe.length - 1]; soll = { d: a[0], a: a[1].toFixed(2) + '%', ema: ema.toFixed(2) + '%', bias: a[1] > ema ? 'bear' : a[1] < ema ? 'bull' : 'neu' }; }
  const g = ist.z.GOLD || {};
  if (!soll) F.push('B: weniger als 90 gemeinsame Tage - Pruefung wirkungslos');
  else if (g.a !== soll.a || g.ema !== soll.ema || g.d !== soll.d) F.push(`B: App ${g.a} / EMA ${g.ema} (${g.d}), nachgerechnet ${soll.a} / EMA ${soll.ema} (${soll.d})`);
  else OK.push(`B: ${rs.length} Renditen, Durchschnitt ${soll.a}, EMA 90 ${soll.ema} (${soll.d}) unabhaengig gleich`);
  if (soll) { const pkt = soll.bias === 'bull' ? 0.5 : soll.bias === 'bear' ? -0.5 : 0;
    const ab = Object.entries(ist.z).filter(([, z]) => z.da && (z.bias !== soll.bias || Math.abs(z.sc - pkt) > 1e-9)).map(([id, z]) => `${id} ${z.bias} ${z.sc}`);
    if (ab.length) F.push(`C: erwartet ${soll.bias} ${pkt}: ${ab.slice(0, 5).join(' · ')}`); else OK.push(`C: ueberall ${soll.bias} ${pkt > 0 ? '+' : ''}${pkt}`); }
  if (err.length) F.push('JS: ' + err.slice(0, 2).join(' | '));
  await b.close();
  OK.forEach(m => console.log('  ✓ ' + m)); F.forEach(m => console.log('  ✗ ' + m));
  if (GP) { console.log(F.length ? `Gegenprobe ok: ${F.length} Befund(e), wie erwartet rot.` : 'Gegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(F.length ? 0 : 1); }
  console.log(F.length ? `✗ globalyields: ${F.length} Befund(e)` : 'globalyields: ok (Zeile bei allen Nicht-FX ausser Yields, Durchschnitt + EMA 90 unabhaengig nachgerechnet, ueber EMA -0,5 / darunter +0,5)');
  process.exit(F.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
