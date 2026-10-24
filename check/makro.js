#!/usr/bin/env node
// Makro-Karten: Table | Charts (js/makro.js).
// Nutzer-Auftrag 2026-10-20 ("einen Schalter haben zum wechseln ... drei
// grosser Chart ... in denen ich dann alle Indikatoren rein machen kann"),
// Umbau 2026-10-21 ("die Switch Funktion ist noch ziemlich blöd ... mach sie
// perfekt"; Rueckfrage: Schalter je Karte, Charts = EINE Karte mit Reitern,
// keine Einstufungen, Zahlen je Spur "abgetrennt und uebersichtlich").
//
// Geprueft (im Browser, echte Daten, 1180 und 390 px):
//   A) jede Makro-Karte mit Reihen hat ihren Schalter; "Charts" auf Karte X
//      -> genau EINE breite Reiter-Karte (>= 90 % der Reihe), aktiver Reiter X,
//      keine Makro-Tabelle mehr; Reiter-Klick wechselt; "Table" bringt alle
//      drei Tabellen zurueck
//   B) Spurkopf = Tabellenzeile: Act/Fc/Prev der Spur stimmen Zeichen fuer
//      Zeichen mit der Tabelle ueberein (eine Rechnung, indZeilenWerte);
//      je Spur ein eigener Block mit Kopf, Zahl der Spuren = Chips an;
//      ein Chip-Klick aendert die Spurenzahl
//   C) Zielband: USD-CPI y/y "Target 2%", AUD "Target 2–3%"; Ziel = waagerechte
//      blaue gestrichelte Linie (Nutzer 2026-10-21)
//   D) Einstufungen sind weg (kein .mk-an, kein makroEinstufen), gespeicherte
//      bleiben im Speicher (snap -> sanitizeSnapIds behaelt tags/hist)
//   E) Ansicht und Reiter gehen in den Sync-Weg (snap -> applySnap)
//   F) Hover schreibt die Werte in die Lesezeile; keine JS-Fehler
//
//   node check/makro.js [--gegenprobe]
//   --gegenprobe: Zeichnen abgeschaltet und ein Spurkopf verfaelscht -> A + B rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const MAKRO = ['Inflation', 'Labour Market', 'Economic Growth'];

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
      await p.evaluate(id => { gotoSym(id); if (makroGross()) makroSicht('table'); }, id); await p.waitForTimeout(700);
      // Tabellenwerte merken (Act/Fc/Prev je Indikator) - Massstab fuer B
      const tab = await p.evaluate(MAKRO => {
        const out = {};
        [...document.querySelectorAll('#detail .rub-card')].filter(c => MAKRO.includes((c.querySelector('.rub-inp') || {}).value)).forEach(c => {
          c.querySelectorAll('tr.ind-row').forEach(tr => { out[tr.querySelector('.ir-name-txt').textContent.trim()] = [tr.querySelector('.ir-act').textContent.trim(), tr.querySelector('.ir-fc').textContent.trim(), tr.querySelector('.ir-prev').textContent.trim()]; });
        });
        return out;
      }, MAKRO);
      const karten = await p.evaluate(MAKRO => [...document.querySelectorAll('#detail .rub-card')].filter(c => MAKRO.includes((c.querySelector('.rub-inp') || {}).value))
        .map(c => ({ name: c.querySelector('.rub-inp').value, sw: !!c.querySelector('.mk-kz .mk-sw') })), MAKRO);
      if (karten.length < 3) { fail(`${ort} ${id}`, `nur ${karten.length} Makro-Karten`); continue; }
      karten.filter(k => !k.sw).forEach(k => fail(`${ort} ${id}`, `Karte ${k.name}: kein Table|Charts-Schalter`));
      // A) Charts auf der ZWEITEN Karte -> deren Reiter ist aktiv
      const ziel = karten[1].name;
      await p.evaluate(ziel => { const c = [...document.querySelectorAll('#detail .rub-card')].find(c => (c.querySelector('.rub-inp') || {}).value === ziel);
        [...c.querySelectorAll('.mk-kz .mk-sw button')].find(x => x.textContent.trim() === 'Charts').click(); }, ziel);
      await p.waitForTimeout(600);
      if (GP) await p.evaluate(() => { document.querySelectorAll('.mk-chart').forEach(x => { x.innerHTML = ''; }); });
      const a = await p.evaluate(MAKRO => {
        const k = [...document.querySelectorAll('#detail #mkTabKarte')];
        const board = document.querySelector('#detail .ab-cards').getBoundingClientRect().width;
        const t = k[0];
        return { n: k.length, breit: t ? Math.round(t.getBoundingClientRect().width) : 0, board: Math.round(board),
          aktiv: t ? (t.querySelector('.mk-tab.on') || {}).textContent : null, reiter: t ? [...t.querySelectorAll('.mk-tab')].map(x => x.textContent) : [],
          tabellen: [...document.querySelectorAll('#detail .rub-card')].filter(c => MAKRO.includes((c.querySelector('.rub-inp') || {}).value) && c.querySelector('.ind-table')).length,
          spuren: t ? t.querySelectorAll('.mk-spur:not(.mk-spur-preis)').length : 0, svg: t ? t.querySelectorAll('.mk-spur:not(.mk-spur-preis) svg').length : 0, chipsOn: t ? t.querySelectorAll('.mk-chip.on').length : 0,
          kein: !!document.querySelector('#detail .mk-an, #detail .mk-an-o'), txt: t ? t.textContent : '' };
      }, MAKRO);
      if (a.n !== 1) { fail(`${ort} ${id}`, `Charts: ${a.n} Reiter-Karten statt genau einer`); continue; }
      if (a.breit < a.board * 0.9) fail(`${ort} ${id}`, `Reiter-Karte nur ${a.breit} von ${a.board} px breit`);
      if (a.aktiv !== ziel) fail(`${ort} ${id}`, `Charts auf "${ziel}" geklickt, aktiver Reiter "${a.aktiv}"`);
      if (a.tabellen) fail(`${ort} ${id}`, `Charts gewaehlt, ${a.tabellen} Makro-Tabellen stehen noch da`);
      if (!a.svg) fail(`${ort} ${id} ${ziel}`, 'Charts gewaehlt, aber kein Chart gezeichnet');
      if (a.spuren !== a.chipsOn) fail(`${ort} ${id} ${ziel}`, `${a.spuren} Spuren, aber ${a.chipsOn} Chips an`);
      if (a.kein) fail(`${ort} ${id}`, 'Einstufungen stehen noch da');
      // Alle Reiter durchgehen: B, C, Chip, Hover
      for (const r of a.reiter) {
        await p.evaluate(r => makroTab(r), r); await p.waitForTimeout(450);
        if (GP) await p.evaluate(() => { const v = document.querySelector('#mkTabKarte .mk-spur-kopf .mk-kv b'); if (v) v.textContent = '999'; });
        const s = await p.evaluate(() => { const t = document.getElementById('mkTabKarte');
          return { aktiv: (t.querySelector('.mk-tab.on') || {}).textContent, koepfe: [...t.querySelectorAll('.mk-spur:not(.mk-spur-preis)')].map(sp => ({ name: sp.querySelector('.mk-spur-name').textContent.trim(),
            werte: [...sp.querySelectorAll('.mk-kv')].slice(0, 3).map(x => x.querySelector('b').textContent.trim()), svg: !!sp.querySelector('svg') })), txt: t.textContent }; });
        if (s.aktiv !== r) fail(`${ort} ${id}`, `Reiter "${r}" geklickt, aktiv "${s.aktiv}"`);
        s.koepfe.forEach(k => {
          if (!k.svg) fail(`${ort} ${id} ${r}`, `Spur ${k.name} ohne Chart`);
          const soll = tab[k.name];
          if (!soll) fail(`${ort} ${id} ${r} SPURKOPF`, `${k.name} steht nicht in der Tabelle`);
          else if (JSON.stringify(soll) !== JSON.stringify(k.werte)) fail(`${ort} ${id} ${r} SPURKOPF`, `${k.name}: Kopf ${k.werte.join(' / ')}, Tabelle ${soll.join(' / ')}`);
        });
        if (r === 'Inflation' && s.koepfe.some(k => /CPI \(Headline\)/.test(k.name))) {
          const soll = id === 'AUD' ? 'Target 2–3%' : 'Target 2%';
          if (!s.txt.includes(soll)) fail(`${ort} ${id} Inflation`, `Zielband "${soll}" fehlt`);
          // Ziel = waagerechte BLAUE gestrichelte Linie (Nutzer 2026-10-21)
          const z = await p.evaluate(() => { const l = document.querySelector('#mkTabKarte .mk-ziel'); if (!l) return null;
            const blau = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim();
            const probe = document.createElement('span'); probe.style.color = blau; document.body.appendChild(probe); const soll = getComputedStyle(probe).color; probe.remove();
            const cs = getComputedStyle(l); return { farbe: cs.stroke, soll, strich: l.getAttribute('stroke-dasharray'), waag: l.getAttribute('y1') === l.getAttribute('y2') }; });
          if (GP && z) z.farbe = 'rgb(0, 0, 0)';
          if (!z) fail(`${ort} ${id} ZIELLINIE`, 'keine Ziellinie');
          else { if (z.farbe !== z.soll) fail(`${ort} ${id} ZIELLINIE`, `Farbe ${z.farbe}, soll Blau ${z.soll}`);
            if (!z.strich) fail(`${ort} ${id} ZIELLINIE`, 'nicht gestrichelt'); if (!z.waag) fail(`${ort} ${id} ZIELLINIE`, 'nicht waagerecht'); }
        }
        const vor = s.koepfe.length;
        await p.evaluate(() => { const t = document.getElementById('mkTabKarte'); const x = t.querySelector('.mk-chip:not(.on)') || t.querySelector('.mk-chip.on'); x.click(); });
        await p.waitForTimeout(450);
        const nach = await p.evaluate(() => document.querySelectorAll('#mkTabKarte .mk-spur:not(.mk-spur-preis)').length);
        if (nach === vor && !GP) fail(`${ort} ${id} ${r}`, `Chip-Klick ohne Wirkung (${vor} -> ${nach} Spuren)`);
        if (w >= 900) {
          const lese = await p.evaluate(() => { const t = document.getElementById('mkTabKarte'); const sp = t.querySelector('.mk-spuren'); const s = sp && sp.querySelector('svg'); if (!s) return null; const rc = s.getBoundingClientRect();
            sp.dispatchEvent(new PointerEvent('pointermove', { clientX: rc.left + rc.width * 0.7, clientY: rc.top + 30, bubbles: true })); return t.querySelector('.mk-read').textContent.trim().length; });
          if (lese === 0) fail(`${ort} ${id} ${r}`, 'Hover schreibt nichts in die Lesezeile');
        }
      }
      // G) Analyse-Werkzeuge (2026-10-24): Vergleich, Statistik, Zinsentscheide, Kurs
      const g = await p.evaluate(async () => {
        const vor = makroOptWert(); makroTab('Inflation'); makroVergleich('EUR'); await new Promise(r => setTimeout(r, 450));
        const k = document.getElementById('mkTabKarte'); const eigen = getSym().id === 'GOLD' ? 'USD' : getSym().id;
        const r = { eigen, cmpL: k.querySelectorAll('.mk-cmp-l[data-ccy="EUR"]').length, legende: [...k.querySelectorAll('.mk-spur-cmp')].some(x => /EUR/.test(x.textContent)),
          preis: !!k.querySelector('.mk-spur-preis .mk-preis-l'), stat: k.querySelectorAll('.mk-spur-stat').length, spuren: k.querySelectorAll('.mk-spur:not(.mk-spur-preis)').length, falsch: [] };
        // Statistik unabhaengig nachrechnen: 3M-Veraenderung der ersten Spur
        const rub = getSym().rubrics.find(x => x.name === 'Inflation'); const ind = rub.indicators.find(i => indName(i) === k.querySelector('.mk-spur-name').textContent.trim());
        const pts = indChartSeries(ind, getSym().id).pts.map(q => [String(q[0]).slice(0, 10), +q[1]]).filter(q => isFinite(q[1]));
        const l = pts[pts.length - 1]; const z = new Date(l[0] + 'T00:00:00Z'); z.setUTCMonth(z.getUTCMonth() - 3); let b = null; pts.forEach(q => { if (Date.parse(q[0] + 'T00:00:00Z') <= z.getTime()) b = q; });
        const st = mkStatistik({ ind, pts: indChartSeries(ind, getSym().id).pts.map(q => [String(q[0]).slice(0, 10), +q[1], q[2] == null ? null : +q[2]]), unit: '' }, getSym().id);
        if (b && z.getTime() - Date.parse(b[0] + 'T00:00:00Z') <= 62 * 864e5 && Math.abs(st.ch[3] - (l[1] - b[1])) > 1e-9) r.falsch.push(`3M ${st.ch[3]} statt ${l[1] - b[1]}`);
        // Zinsentscheide = Aenderungen der Leitzinsreihe im Fenster, je Spur eine Linie
        const R = rub.mkRange == null ? 36 : rub.mkRange; const ab = new Date(); if (R !== 'MAX') ab.setUTCMonth(ab.getUTCMonth() - R);
        r.zinsSoll = mkZinsentscheide(eigen).filter(e => R === 'MAX' || Date.parse(e.d + 'T00:00:00Z') >= ab.getTime() + 31 * 864e5).length; r.zinsLinien = k.querySelectorAll('.mk-spur:first-child .mk-zins').length;
        if (!vor.cmp.includes('EUR')) makroVergleich('EUR'); return r; });
      if (g.cmpL < 1 || !g.legende) fail(`${ort} ${id} VERGLEICH`, `EUR gewaehlt, ${g.cmpL} EUR-Linien, Legende ${g.legende}`);
      if (!g.preis) fail(`${ort} ${id} KURS`, 'keine Kurs-Spur');
      if (g.stat !== g.spuren) fail(`${ort} ${id} STATISTIK`, `${g.stat} Statistikzeilen fuer ${g.spuren} Spuren`);
      g.falsch.forEach(x => fail(`${ort} ${id} STATISTIK`, x));
      if (g.zinsSoll && !g.zinsLinien && !GP) fail(`${ort} ${id} ZINS`, `${g.zinsSoll} Zinsentscheide in der Reihe, aber keine Markerlinie`);
      // E) Sync-Weg: Ansicht + Reiter ueberleben snap -> applySnap
      const e = await p.evaluate(() => { const s = snap(); const o = JSON.parse(s); return { ans: o.mkAnsicht, tab: o.mkTab }; });
      if (e.ans !== 'charts' || !a.reiter.includes(e.tab)) fail(`${ort} ${id} SYNC`, `snap traegt mkAnsicht=${e.ans}, mkTab=${e.tab}`);
      // zurueck auf Table (Schalter im Kopf der Reiter-Karte)
      await p.evaluate(() => [...document.querySelectorAll('#mkTabKarte .mk-sw button')].find(x => x.textContent.trim() === 'Table').click());
      await p.waitForTimeout(450);
      const zur = await p.evaluate(MAKRO => ({ tk: !!document.getElementById('mkTabKarte'), tabs: [...document.querySelectorAll('#detail .rub-card')].filter(c => MAKRO.includes((c.querySelector('.rub-inp') || {}).value) && c.querySelector('.ind-table')).length }), MAKRO);
      if (zur.tk || zur.tabs < 3) fail(`${ort} ${id}`, `Table bringt nur ${zur.tabs} von 3 Tabellen zurueck`);
    }
    // D) Einstufungen: keine Oberflaeche mehr, gespeicherte bleiben erhalten
    const d = await p.evaluate(() => {
      researchAnalysis.USD = researchAnalysis.USD || {};
      researchAnalysis.USD.Inflation = Object.assign(researchAnalysis.USD.Inflation || { bias: null, text: '' }, { tags: { level: 'below' }, hist: [{ d: '2026-10-20', k: 'level', v: 'below' }] });
      const s2 = sanitizeSnapIds(JSON.parse(snap()));
      const a = s2.researchAnalysis.USD.Inflation;
      return { tags: a.tags && a.tags.level, hist: (a.hist || []).length, fn: typeof window.makroEinstufen };
    });
    if (d.tags !== 'below' || d.hist !== 1) fail(`${ort} EINSTUFUNG`, 'gespeicherte Einstufung geht im Sync-Weg verloren');
    if (d.fn !== 'undefined') fail(`${ort} EINSTUFUNG`, 'makroEinstufen ist noch aufrufbar');
    perr.forEach(x => fail(`${ort} JS-FEHLER`, x));
    await ctx.close();
  }
  await b.close();
  if (GP) {
    const ok = F.some(x => /kein Chart gezeichnet|ohne Chart/.test(x)) && F.some(x => /SPURKOPF/.test(x)) && F.some(x => /ZIELLINIE/.test(x));
    console.log(ok ? `makro --gegenprobe: ok (rot wie erwartet, ${F.length} Befunde)` : 'makro --gegenprobe: FEHLER - nicht gemeldet\n' + F.slice(0, 5).join('\n'));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`makro: ${F.length} Befund(e)`); F.slice(0, 40).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('makro: ok (Schalter je Makro-Karte, Charts = eine Reiter-Karte mit aktivem Reiter der geklickten Karte, Spurkopf = Tabellenzeile, Zielband, Chips, Hover, Table zurueck, Einstufungen weg und gespeicherte erhalten, Sync-Weg - USD/AUD/GOLD bei 1180 und 390 px)');
})().catch(e => { console.error(e); process.exit(2); });
