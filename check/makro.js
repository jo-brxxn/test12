#!/usr/bin/env node
// Makro-Karten: Table | Charts + Analyse-Einstufungen (js/makro.js).
// Nutzer-Auftrag 2026-10-20: "zu den Rubriken da wo die drei makrokarten sind
// will ich einen Schalter haben zum wechseln ... drei grosser Chart ... in
// denen ich dann alle Indikatoren rein machen kann ... und dann will ich
// auswaehlen koennen Beschreibungen dafuer ... ueber Target im Target oder
// unterm Target".
//
// Geprueft (im Browser, echte Daten):
//   A) jede Makro-Karte mit Indikatoren hat den Schalter; "Charts" zeichnet
//      ein SVG mit genau so vielen Spuren wie Chips an sind; "Table" bringt
//      die Tabelle zurueck; ein Chip-Klick aendert die Spurenzahl
//   B) der Wert im Spurkopf ist der letzte Punkt der echten Reihe
//      (indChartSeries) - keine zweite Quelle
//   C) Zielband: USD-CPI y/y "Target 2%", AUD "Target 2–3%"
//   D) jeder Vorschlag stimmt mit einer UNABHAENGIGEN Nachrechnung aus
//      nivAlle() ueberein (gleiche Schwellen wie die kleinste Score-Stufe)
//   E) Einstufung per Klick: landet bei der WAEHRUNG (Gold teilt USD), im
//      Verlauf, ueberlebt snap -> sanitizeSnapIds, zweiter Klick nimmt zurueck
//   F) Hover schreibt die Werte in die Lesezeile; keine JS-Fehler
//
//   node check/makro.js [--gegenprobe]
//   --gegenprobe: Zeichnen abgeschaltet und ein falscher Vorschlag -> A + D rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);

(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1180, 820], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: w < 900 });
    await ctx.route(/supabase/, r => r.abort());
    const p = await ctx.newPage();
    const perr = []; p.on('pageerror', e => perr.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
    
    const ort = `${w}x${h}`;
    for (const id of ['USD', 'AUD', 'GOLD']) {
      await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(700);
      // EIN Schalter in der Reihen-Ueberschrift "Macro" fuer alle Makro-Karten
      const sw = await p.evaluate(() => !!document.querySelector('#detail .mk-swrow .mk-sw'));
      if (!sw) { fail(`${ort} ${id}`, 'kein Table|Charts-Schalter in der Reihe "Macro"'); continue; }
      await p.evaluate(() => [...document.querySelectorAll('#detail .mk-swrow .mk-sw button')].find(x => x.textContent.trim() === 'Charts').click());
      await p.waitForTimeout(600);
      const karten = await p.evaluate(() => [...document.querySelectorAll('#detail .rub-card')].map((c, i) => ({ i, name: (c.querySelector('.rub-inp') || {}).value, sw: !!c.querySelector('.mk-chart'),
        breit: Math.round(c.getBoundingClientRect().width), board: Math.round(document.querySelector('#detail .ab-cards').getBoundingClientRect().width) })));
      const makro = karten.filter(k => ['Inflation', 'Labour Market', 'Economic Growth'].includes(k.name));
      if (makro.length < 3) fail(`${ort} ${id}`, `nur ${makro.length} Makro-Karten gefunden`);
      makro.filter(k => !k.sw).forEach(k => fail(`${ort} ${id}`, `Karte ${k.name}: Charts gewaehlt, aber kein Chart`));
      makro.filter(k => k.sw && k.breit < k.board * 0.9).forEach(k => fail(`${ort} ${id}`, `Karte ${k.name} im Charts-Modus nur ${k.breit} von ${k.board} px breit - kein grosser Chart`));
      for (const k of makro.filter(k => k.sw)) {
        // A) Charts an
        if (GP) await p.evaluate(() => { document.querySelectorAll('.mk-chart').forEach(x => { x.innerHTML = ''; }); });
        const r = await p.evaluate(([i, id]) => {
          const c = document.querySelectorAll('#detail .rub-card')[i];
          const svg = c.querySelector('.mk-chart svg'), chipsOn = c.querySelectorAll('.mk-chip.on').length, tab = !!c.querySelector('.ind-table');
          const sym = syms.find(s => s.id === id), rub = sym.rubrics.find(x => x.name === c.querySelector('.rub-inp').value);
          // B) Spurkoepfe gegen die echte Reihe
          const koepfe = svg ? [...svg.querySelectorAll('text')].filter(t => t.querySelector('tspan')).map(t => t.textContent) : [];
          const gew = (rub.mkInds && rub.mkInds.length ? rub.indicators.filter(x => rub.mkInds.includes(x.id)) : rub.indicators.filter(x => indChartSeries(x, id).pts.length >= 2).slice(0, 3));
          const falsch = [];
          gew.forEach(ind => { const pts = indChartSeries(ind, id).pts; const last = pts[pts.length - 1]; const soll = indName(ind) + fmtIndVal(+last[1], indChartSeries(ind, id).unit || '');
            if (!koepfe.some(k => k.replace(/\s/g, '').startsWith(soll.replace(/\s/g, '')))) falsch.push(`${indName(ind)} soll ${fmtIndVal(+last[1], '')}`); });
          return { svg: !!svg, spuren: koepfe.length, chipsOn, tab, falsch, txt: svg ? svg.textContent : '' };
        }, [k.i, id]);
        if (!r.svg) { fail(`${ort} ${id} ${k.name}`, 'Charts gewaehlt, aber kein Chart gezeichnet'); continue; }
        if (r.tab) fail(`${ort} ${id} ${k.name}`, 'Charts gewaehlt, Tabelle steht trotzdem da');
        if (r.spuren !== r.chipsOn) fail(`${ort} ${id} ${k.name}`, `${r.spuren} Spuren, aber ${r.chipsOn} Chips an`);
        r.falsch.forEach(x => fail(`${ort} ${id} ${k.name} SPURKOPF`, x));
        // C) Zielband
        if (k.name === 'Inflation' && /CPI \(Headline\)/.test(r.txt)) {
          const soll = id === 'AUD' ? 'Target 2–3%' : 'Target 2%';
          if (!r.txt.includes(soll)) fail(`${ort} ${id} Inflation`, `Zielband "${soll}" fehlt`);
        }
        // Chip-Klick aendert die Spurenzahl
        const vorher = r.spuren;
        await p.evaluate(i => { const c = document.querySelectorAll('#detail .rub-card')[i]; const x = c.querySelector('.mk-chip:not(.on)') || c.querySelector('.mk-chip.on'); x.click(); }, k.i);
        await p.waitForTimeout(450);
        const nach = await p.evaluate(i => { const c = document.querySelectorAll('#detail .rub-card')[i]; const s = c.querySelector('.mk-chart svg'); return s ? [...s.querySelectorAll('text')].filter(t => t.querySelector('tspan')).length : 0; }, k.i);
        if (nach === vorher && !GP) fail(`${ort} ${id} ${k.name}`, `Chip-Klick ohne Wirkung (${vorher} -> ${nach} Spuren)`);
        // F) Hover
        if (w >= 900) {
          const lese = await p.evaluate(i => { const c = document.querySelectorAll('#detail .rub-card')[i]; const s = c.querySelector('.mk-chart svg'); if (!s) return null; const rc = s.getBoundingClientRect();
            s.dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + rc.width * 0.7, clientY: rc.top + 40, bubbles: true })); return c.querySelector('.mk-read').textContent.trim().length; }, k.i);
          if (lese === 0) fail(`${ort} ${id} ${k.name}`, 'Hover schreibt nichts in die Lesezeile');
        }
      }
      // zurueck auf Table
      await p.evaluate(() => [...document.querySelectorAll('#detail .mk-swrow .mk-sw button')].find(x => x.textContent.trim() === 'Table').click());
      await p.waitForTimeout(450);
      const tabs = await p.evaluate(() => [...document.querySelectorAll('#detail .rub-card')].filter(c => ['Inflation', 'Labour Market', 'Economic Growth'].includes((c.querySelector('.rub-inp') || {}).value) && c.querySelector('.ind-table')).length);
      if (tabs < 3) fail(`${ort} ${id}`, `Table bringt nur ${tabs} von 3 Tabellen zurueck`);
    }
    // D) Vorschlaege unabhaengig nachgerechnet
    const d = await p.evaluate(gp => {
      const out = [];
      const S = { level: 0.5, trend: 0.3, tight: 0.5, labT: 0.2, wages: 0.75, conf: 2 };
      ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'].forEach(c => {
        const n = nivAlle()[c] || {};
        const soll = {};
        if (n.infl) soll['Inflation.level'] = n.infl.x > S.level ? 'above' : n.infl.x < -S.level ? 'below' : 'at';
        if (n.inflT) soll['Inflation.trend'] = n.inflT.x >= S.trend ? 'rising' : n.inflT.x <= -S.trend ? 'falling' : 'stable';
        if (n.lab) soll['Labour Market.tight'] = n.lab.x >= S.tight ? 'tight' : n.lab.x <= -S.tight ? 'loose' : 'balanced';
        if (n.labT) soll['Labour Market.trend'] = n.labT.x >= S.labT ? 'improving' : n.labT.x <= -S.labT ? 'weakening' : 'stable';
        if (n.wage) soll['Labour Market.wages'] = n.wage.x >= S.wages ? 'hot' : n.wage.x <= -S.wages ? 'cool' : 'normal';
        if (n.confT) soll['Economic Growth.conf'] = n.confT.x >= S.conf ? 'rising' : n.confT.x <= -S.conf ? 'falling' : 'stable';
        Object.entries(soll).forEach(([k, v]) => {
          const [rub, dim] = k.split('.');
          let ist = (mkVorschlaege(c, rub)[dim] || {}).v;
          if (gp && dim === 'level') ist = ist === 'above' ? 'below' : 'above';
          if (ist !== v) out.push(`${c} ${k}: Vorschlag ${ist}, Daten sagen ${v}`);
        });
      });
      return out;
    }, GP);
    d.forEach(x => fail(`${ort} VORSCHLAG`, x));
    // E) Einstufung speichern, teilen, Sync-Weg, zuruecknehmen
    await p.evaluate(() => gotoSym('GOLD')); await p.waitForTimeout(600);
    const e = await p.evaluate(() => {
      const sym = getSym(); const ki = sym.rubrics.findIndex(r => r.name === 'Inflation'); const rub = sym.rubrics[ki];
      makroSicht('charts');
      makroEinstufen(ki, 'level', 'below');
      const a = researchAnalysis.USD && researchAnalysis.USD.Inflation;
      const r = { tag: a && a.tags && a.tags.level, hist: a && a.hist && a.hist.slice(-1)[0], gold: !!(researchAnalysis.GOLD && researchAnalysis.GOLD.Inflation && researchAnalysis.GOLD.Inflation.tags) };
      const s2 = sanitizeSnapIds(JSON.parse(snap()));
      r.sync = s2.researchAnalysis && s2.researchAnalysis.USD && s2.researchAnalysis.USD.Inflation && s2.researchAnalysis.USD.Inflation.tags && s2.researchAnalysis.USD.Inflation.tags.level;
      r.syncHist = s2.researchAnalysis.USD.Inflation.hist && s2.researchAnalysis.USD.Inflation.hist.length;
      r.chipOn = !!document.querySelector('#detail .mk-an-o.on');
      makroEinstufen(ki, 'level', 'below');
      r.zurueck = (researchAnalysis.USD.Inflation.tags || {}).level || null;
      makroSicht('table');
      return r;
    });
    if (e.tag !== 'below') fail(`${ort} EINSTUFUNG`, `Klick nicht gespeichert (${e.tag})`);
    if (e.gold) fail(`${ort} EINSTUFUNG`, 'bei GOLD statt bei der Waehrung USD gespeichert');
    if (!e.hist || e.hist.v !== 'below') fail(`${ort} EINSTUFUNG`, 'kein Verlaufseintrag');
    if (e.sync !== 'below' || !e.syncHist) fail(`${ort} EINSTUFUNG`, 'geht im Sync-Weg (snap -> sanitizeSnapIds) verloren');
    if (!e.chipOn) fail(`${ort} EINSTUFUNG`, 'gewaehlte Einstufung nicht markiert');
    if (e.zurueck) fail(`${ort} EINSTUFUNG`, 'zweiter Klick nimmt die Einstufung nicht zurueck');
    perr.forEach(x => fail(`${ort} JS-FEHLER`, x));
    await ctx.close();
  }
  await b.close();
  if (GP) {
    const ok = F.some(x => /kein Chart gezeichnet/.test(x)) && F.some(x => /VORSCHLAG/.test(x));
    console.log(ok ? `makro --gegenprobe: ok (rot wie erwartet, ${F.length} Befunde)` : 'makro --gegenprobe: FEHLER - nicht gemeldet\n' + F.slice(0, 5).join('\n'));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`makro: ${F.length} Befund(e)`); F.slice(0, 40).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('makro: ok (Table|Charts auf allen Makro-Karten von USD/AUD/GOLD bei 1180 und 390 px, Spuren = Chips, Spurkopf = echte Reihe, Zielband, Vorschlaege = Nachrechnung, Einstufung bei der Waehrung + Verlauf + Sync-Weg)');
})().catch(e => { console.error(e); process.exit(2); });
