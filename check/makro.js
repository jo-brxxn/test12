#!/usr/bin/env node
// Makro-Karten: Table | Charts (js/makro.js).
// Nutzer-Auftrag 2026-10-20 ("einen Schalter haben zum wechseln ... drei
// grosser Chart ... in denen ich dann alle Indikatoren rein machen kann"),
// Umbau 2026-10-21 ("die Switch Funktion ist noch ziemlich blöd ... mach sie
// perfekt"; Rueckfrage: Schalter je Karte, Charts = EINE Karte mit Reitern,
// keine Einstufungen, Zahlen je Spur "abgetrennt und uebersichtlich").
//
// Geprueft (im Browser, echte Daten, 1180 und 390 px):
//   A) seit 2026-10-25 (Nutzer: "Verschieb bitte den umschalter table charts
//      in die zeile wo macro steht ganz rechts ganz schmal einfach ein
//      schalter") EIN Kippschalter rechts in der MACRO-Zeile, keiner mehr in
//      den Karten; Schalter an -> genau EINE breite Reiter-Karte (>= 90 % der
//      Reihe), keine Makro-Tabelle mehr; Reiter-Klick wechselt; Schalter aus
//      bringt alle drei Tabellen zurueck
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
//   G) Analyse-Werkzeuge: Vergleich, Statistik (nachgerechnet), Kurs-Spur
//   I) Balken (Nutzer 2026-10-25: "Balken ... die Werte in der Farbe ob es ein
//      Beat Miss oder neutral ist direkt ueber den Balken und halt die forecast
//      Linie ... entfern die Striche fuer Hikes und Cuts ... kompakter"):
//      je Release ein Balken und IMMER ein Wert darueber (Nutzerwahl "Immer
//      alle, kleiner"), Farbe = mkTon gegen die Reihe nachgerechnet, kein Wert
//      ausserhalb des Charts, waagerecht keine Ueberlappung, Forecast-Linie,
//      keine Surprise-Zeile, keine Zinsstriche, Spur <= 125 px (Handy 165)
//   H) Tempo: jede Makro-Bedienung baut nur die Makro-Reihe (0 volle Aufbauten)
//      und zeichnet jeden Chart genau einmal (Gegenprobe: alter Weg -> rot)
//
//   node check/makro.js [--gegenprobe]
//   --gegenprobe: Zeichnen abgeschaltet, ein Spurkopf verfaelscht, je Spur ein
//   Wert entfernt -> A + B + I rot
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
        .map(c => ({ name: c.querySelector('.rub-inp').value, sw: !!c.querySelector('.mk-kz .mk-sw, .mk-sw') })), MAKRO);
      if (karten.length < 3) { fail(`${ort} ${id}`, `nur ${karten.length} Makro-Karten`); continue; }
      karten.filter(k => k.sw).forEach(k => fail(`${ort} ${id}`, `Karte ${k.name}: hat noch einen eigenen Table|Charts-Schalter`));
      const sw = await p.evaluate(() => { const s = [...document.querySelectorAll('#detail .ab-rtitel .mk-rsw input')]; const t = s[0] && s[0].closest('.ab-rtitel');
        return { n: s.length, titel: t ? t.querySelector('span').textContent.trim() : null, rechts: t ? Math.round(t.getBoundingClientRect().right - s[0].closest('.mk-rsw').getBoundingClientRect().right) : null }; });
      if (sw.n !== 1 || sw.titel !== 'Macro') fail(`${ort} ${id}`, `MACRO-Zeile: ${sw.n} Schalter (Titel ${sw.titel}) statt genau einem`);
      else if (sw.rechts > 2) fail(`${ort} ${id}`, `Schalter steht ${sw.rechts} px vor dem rechten Rand der MACRO-Zeile`);
      // A) Schalter an -> eine Reiter-Karte, Reiter = zuletzt gewaehlter oder erster
      const ziel = await p.evaluate(K => (typeof makroTabWert === 'function' && K.includes(makroTabWert())) ? makroTabWert() : K[0], karten.map(k => k.name));
      await p.evaluate(() => document.querySelector('#detail .mk-rsw input').click());
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
        // I) Balken, Werte in Beat/Miss/Neutral-Farbe, Forecast-Linie, kompakt
        if (GP) await p.evaluate(() => document.querySelectorAll('#mkTabKarte .mk-spur').forEach(sp => { const w = sp.querySelectorAll('text.mk-wert'); if (w.length) w[w.length - 1].remove(); }));
        const ib = await p.evaluate(() => {
          const t = document.getElementById('mkTabKarte'), sym = getSym();
          const rub = sym.rubrics.find(x => x.name === (t.querySelector('.mk-tab.on') || {}).textContent);
          const farbe = v => { const i = document.createElement('i'); i.style.color = v; document.body.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; };
          const soll = { bull: farbe('var(--bias-bull)'), bear: farbe('var(--bias-bear)'), neu: farbe('var(--bias-neu)') };
          const out = { zins: t.querySelectorAll('.mk-zins,.mk-zins-t').length, surp: /Surp\./.test(t.textContent), spuren: [] };
          t.querySelectorAll('.mk-spur:not(.mk-spur-preis)').forEach(sp => {
            const name = sp.querySelector('.mk-spur-name').textContent.trim(), ind = rub && rub.indicators.find(i => indName(i) === name);
            const werte = [...sp.querySelectorAll('text.mk-wert')], svg = sp.querySelector('svg.mk-svg').getBoundingClientRect();
            const amTag = {}; (ind ? indChartSeries(ind, sym.id).pts : []).forEach(q => { amTag[String(q[0]).slice(0, 10)] = q; });
            const ton = [], fb = []; let raus = 0, ueber = 0, mitFc = 0;
            werte.forEach(w => { const q = amTag[w.dataset.d]; if (!q) { ton.push(w.dataset.d + ' ohne Punkt in der Reihe'); return; }
              if (q[2] != null) mitFc++;
              const tn = mkTon(ind, +q[1], q[2] == null ? null : +q[2], sym.id); if (tn !== w.dataset.ton) ton.push(`${w.dataset.d}: ${w.dataset.ton} statt ${tn}`);
              const f = getComputedStyle(w).fill; if (f !== soll[w.dataset.ton]) fb.push(`${w.dataset.d}: ${f} statt ${soll[w.dataset.ton]}`);
              const rc = w.getBoundingClientRect(); if (rc.top < svg.top - 0.5 || rc.left < svg.left - 0.5 || rc.right > svg.right + 0.5) raus++; });
            if (!sp.querySelector('.mk-wert-s')) { const rs = werte.map(w => w.getBoundingClientRect()).sort((a, b) => a.left - b.left); for (let i = 1; i < rs.length; i++) if (rs[i].left < rs[i - 1].right - 0.5) ueber++; }
            out.spuren.push({ name, linie: !!sp.querySelector('path.mk-linie'), bars: sp.querySelectorAll('rect.mk-bar').length, werte: werte.length, ton: ton.slice(0, 3), fb: fb.slice(0, 3), raus, ueber, mitFc, fc: !!sp.querySelector('path.mk-fc'), h: Math.round(sp.getBoundingClientRect().height) });
          });
          return out;
        });
        if (ib.zins) fail(`${ort} ${id} ${r} ZINSSTRICHE`, `${ib.zins} Hike/Cut-Elemente (entfernt 2026-10-25)`);
        if (ib.surp) fail(`${ort} ${id} ${r} SURPRISE`, 'Surprise-Zeile steht noch da (entfernt 2026-10-25)');
        ib.spuren.forEach(x => {
          const o = `${ort} ${id} ${r} ${x.name}`;
          if (!x.linie) {
            if (!x.bars) fail(`${o} BALKEN`, 'Release-Reihe ohne Balken');
            if (x.werte !== x.bars) fail(`${o} WERTE`, `${x.bars} Balken, aber ${x.werte} Werte darueber (Nutzerwahl: immer alle)`);
          }
          x.ton.forEach(y => fail(`${o} WERTE-FARBE`, y)); x.fb.forEach(y => fail(`${o} WERTE-FARBE`, y));
          if (x.raus) fail(`${o} WERTE`, `${x.raus} Werte ragen aus dem Chart`);
          if (x.ueber) fail(`${o} WERTE`, `${x.ueber} waagerechte Werte ueberlappen sich`);
          if (x.mitFc && !x.fc) fail(`${o} FORECAST`, `${x.mitFc} Releases mit Forecast, aber keine Forecast-Linie`);
          if (x.h > (w >= 900 ? 125 : 165)) fail(`${o} KOMPAKT`, `Spur ${x.h} px hoch (soll <= ${w >= 900 ? 125 : 165})`);
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
      // G) Analyse-Werkzeuge (2026-10-24): Vergleich, Statistik, Kurs
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
        if (!vor.cmp.includes('EUR')) makroVergleich('EUR'); return r; });
      if (g.cmpL < 1 || !g.legende) fail(`${ort} ${id} VERGLEICH`, `EUR gewaehlt, ${g.cmpL} EUR-Linien, Legende ${g.legende}`);
      if (!g.preis) fail(`${ort} ${id} KURS`, 'keine Kurs-Spur');
      if (g.stat !== g.spuren) fail(`${ort} ${id} STATISTIK`, `${g.stat} Statistikzeilen fuer ${g.spuren} Spuren`);
      g.falsch.forEach(x => fail(`${ort} ${id} STATISTIK`, x));
      if (await p.evaluate(() => typeof window.mkZinsentscheide !== 'undefined')) fail(`${ort} ${id} ZINSSTRICHE`, 'mkZinsentscheide ist noch aufrufbar');
      // H) Tempo (Nutzer 2026-10-24: "Mach es maximal schnell"): jede Makro-
      //    Bedienung baut NUR die Makro-Reihe (0 volle Aufbauten der Asset-Seite)
      //    und zeichnet jeden Chart genau EINMAL. Gemessen vorher: voller Aufbau
      //    595-717 ms je Klick + zweites Zeichnen im naechsten Bild (CPU 4x).
      if (w >= 900 && id === 'USD') {
        const t = await p.evaluate(async gp => {
          if (gp) window.__gpMakroVoll = true;
          const zwei = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const det = document.getElementById('detail'); const out = [];
          const schritte = [['Reiter', () => makroTab('Labour Market')], ['Reiter zurueck', () => makroTab('Inflation')],
            ['Chip', () => document.querySelector('#mkTabKarte .mk-chip:not(.on)').click()], ['Chip zurueck', () => document.querySelector('#mkTabKarte .mk-chip.on').click()],
            ['Compare', () => makroVergleich('CHF')], ['Compare zurueck', () => makroVergleich('CHF')], ['Price', () => makroPreis()], ['Price zurueck', () => makroPreis()],
            ['Zeitraum', () => [...document.querySelectorAll('#mkTabKarte .ind-hist-range-btn')].find(x => x.textContent.trim() === '5Y').click()],
            ['Table', () => document.querySelector('#detail .mk-rsw input').click()],
            ['Charts', () => document.querySelector('#detail .mk-rsw input').click()]];
          for (const [name, fn] of schritte) {
            let voll = 0, gezeichnet = 0;
            const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(x => { if (x.nodeType !== 1) return;
              if (x.classList.contains('dp')) voll++; if (x.classList.contains('mk-spuren')) gezeichnet++; })));
            mo.observe(det, { childList: true, subtree: true });
            fn(); await zwei(); await zwei();
            mo.disconnect();
            const boxen = document.querySelectorAll('#mkTabKarte .mk-chart').length;
            out.push({ name, voll, gezeichnet, boxen });
          }
          window.__gpMakroVoll = false;
          return out;
        }, GP);
        t.forEach(x => {
          if (x.voll) fail(`${ort} ${id} TEMPO`, `${x.name}: Asset-Seite ${x.voll}x komplett neu aufgebaut (soll 0 - nur die Makro-Reihe)`);
          if (x.gezeichnet > x.boxen) fail(`${ort} ${id} TEMPO`, `${x.name}: ${x.gezeichnet}x gezeichnet fuer ${x.boxen} Chart(s) (soll genau 1x)`);
        });
      }
      // E) Sync-Weg: Ansicht + Reiter ueberleben snap -> applySnap
      const e = await p.evaluate(() => { const s = snap(); const o = JSON.parse(s); return { ans: o.mkAnsicht, tab: o.mkTab }; });
      if (e.ans !== 'charts' || !a.reiter.includes(e.tab)) fail(`${ort} ${id} SYNC`, `snap traegt mkAnsicht=${e.ans}, mkTab=${e.tab}`);
      // zurueck auf Table (der eine Schalter in der MACRO-Zeile)
      await p.evaluate(() => document.querySelector('#detail .mk-rsw input').click());
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
    const ok = F.some(x => /kein Chart gezeichnet|ohne Chart/.test(x)) && F.some(x => /SPURKOPF/.test(x)) && F.some(x => /ZIELLINIE/.test(x)) && F.some(x => /TEMPO/.test(x)) && F.some(x => / WERTE: /.test(x));
    console.log(ok ? `makro --gegenprobe: ok (rot wie erwartet, ${F.length} Befunde)` : 'makro --gegenprobe: FEHLER - nicht gemeldet\n' + F.slice(0, 5).join('\n'));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`makro: ${F.length} Befund(e)`); F.slice(0, 40).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log('makro: ok (ein Schalter rechts in der MACRO-Zeile, Charts = eine Reiter-Karte mit aktivem Reiter der geklickten Karte, Spurkopf = Tabellenzeile, Zielband, Balken mit allen Werten in Beat/Miss-Farbe + Forecast-Linie, keine Surprise-Zeile/Zinsstriche, kompakt, Chips, Hover, Table zurueck, Einstufungen weg und gespeicherte erhalten, Sync-Weg - USD/AUD/GOLD bei 1180 und 390 px)');
})().catch(e => { console.error(e); process.exit(2); });
