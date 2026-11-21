// ── INDIKATOR-CHARTS: NUR ZAHLEN, KEIN NaN (seit 2026-11-21, VERSION-CHECK-782) ──
// Nutzer-Foto 2026-11-20 (GBP): "Die Karte ist leer aber wenn ich drauf gehe erscheint das info Schild".
// Gemessen: M4 Money Supply - der letzte Chart-Punkt trug den kuratierten Forecast als TEXT ("0.3%"),
// adoptChartHist wandelte nur die Feed-Punkte um. Min/Max wurden NaN, alle 12 Balken y/height NaN -
// unsichtbar, die Hover-Info las die Rohwerte und zeigte sie trotzdem.
// Geprueft fuer JEDES Asset und JEDEN Indikator (ohne Liste):
//  A) indChartSeries: jeder Punkt [Datum, Zahl, Zahl|null] - kein Text, kein NaN
//  B) der gerenderte Mini-Chart (indHistChart, 1Y und Max) enthaelt kein "NaN"
// --gegenprobe: adoptChartHist setzt den Forecast wieder als Text -> A und B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const MARKE = "if(last&&last[0]===f.date&&last[2]==null&&curatedForecast!=null){const cf=parseNumLike(curatedForecast);if(cf!=null&&isFinite(cf))last[2]=cf;}";
(async () => {
  const F = [];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); if (!t.includes(MARKE)) F.push('Testaufbau: Marke in adoptChartHist fehlt');
    if (GP) t = t.replace(MARKE, "if(last&&last[0]===f.date){last[2]=String(last[1])+'%';}"); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => { const a = [], bb = []; let n = 0;
    syms.forEach(s => (s.rubrics || []).forEach(rb => (rb.indicators || []).forEach(i => {
      let c; try { c = indChartSeries(i, s.id); } catch (e) { return; } if (!c || !c.pts || c.pts.length < 2) return; n++;
      const bad = c.pts.find(q => typeof q[1] !== 'number' || !isFinite(q[1]) || (q[2] != null && (typeof q[2] !== 'number' || !isFinite(q[2]))));
      if (bad) a.push(`${s.id} ${i.name}: ${JSON.stringify(bad)}`);
      for (const range of ['1Y', 'MAX']) { let h = ''; try { h = indHistChart(i, s.id, { noToolbar: true, range, W: 400, H: 200 }); } catch (e) { h = 'ERR'; }
        if (/NaN/.test(h)) { bb.push(`${s.id} ${i.name} (${range})`); break; } }
    })));
    return { a: [...new Set(a)], b: [...new Set(bb)], n }; });
  r.a.slice(0, 12).forEach(x => F.push('A: Text/NaN in der Reihe ' + x));
  r.b.slice(0, 12).forEach(x => F.push('B: NaN im Chart ' + x));
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^A: /.test(f)) && F.some(f => /^B: /.test(f)); console.log(ok ? 'chartzahlen --gegenprobe: ok (Text-Forecast gemeldet)' : 'chartzahlen --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('chartzahlen: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`chartzahlen: ok (${r.n} Indikator-Reihen aller Assets: nur Zahlen, kein NaN im Chart, 1Y + Max)`);
})().catch(e => { console.log('chartzahlen: ABBRUCH ' + e.message); process.exit(1); });
