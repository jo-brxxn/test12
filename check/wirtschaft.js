// ── ECONOMY MAP (seit 2026-11-21, 784; zoombare Karte seit 787) ─────────────────
// Nutzer 2026-11-21: komplette Wirtschaft nur mit boersennotierten Firmen, Hauptbereiche gross,
// kleine im Hintergrund, Hauptgruppe + Tags, Beziehungen mit Quelle/Datum/Typ, zoombar + filterbar,
// Klick auf ein Unternehmen hebt es und alle Verbindungen hervor. Thesen links bleiben.
//  A) Seitenleiste "Economy", Seite "Economy Map"; alle Sektoren und alle Firmen des Katalogs im
//     Orbit (Nutzer: "Ich will das aber als Orbit"); echte Groesse; Planeten nach Stufe groesser
//  B) Nichts ueberlappt: Sektor-/Gruppennamen, Firmen-Kaesten und ihre Schrift (Uebersicht + 2 Zoomstufen,
//     1920 und 1024 px)
//  H) Klick auf NVDA: Linien = belegte Beziehungen, verbundene Firmen hell, Rest blass, Panel mit
//     Datum + Quelle; Typ-Filter nimmt Linien weg; Tag-Filter macht unpassende blass; + / Fit zoomen
//  C) These: anlegen, Titel, Status, Gruppen verknuepfen (+ -> - -> aus), in snap(), nach Neuladen da,
//     Karte faerbt die Gruppen
//  D) Abgleich: juengere Aenderung gewinnt, Grabstein gewinnt bei Gleichstand, alte Gruppen-ids (784) bleiben verknuepft
//  E) Loeschen -> Papierkorb (econth), Wiederherstellen
//  F) Firmenfenster: NVDA echter SEC-Chart + Links mit Quelle, KO nur Platzhalter (keine erfundenen Zahlen)
//  G) econThesen in snap(), applySnap (econVereinen) und neueFelderBehalten; jede Beziehung mit Datum + Quelle
// --gegenprobe: Grabstein-Regel weg und Beschriftung ohne Platzpruefung -> D und B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW); const fs = require('fs'); const path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  const main = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
  if (!/function snap\(\)\{[^\n]*econThesen/.test(main)) F.push('G: econThesen fehlt in snap()');
  if (!/econSetzeAlle\(_mergeSync\?econVereinen\(econThesen,d\.econThesen\):d\.econThesen\)/.test(main)) F.push('G: applySnap gleicht econThesen nicht ueber econVereinen ab');
  if (!/'gameplans','econThesen'\]/.test(main)) F.push('G: econThesen fehlt in neueFelderBehalten');
  const kat = fs.readFileSync(path.join(__dirname, '..', 'js', 'wirtschaft-katalog.js'), 'utf8');
  const bez = kat.slice(kat.indexOf('export const EC_BEZ'), kat.indexOf('export const EC_ALT')).split('\n').filter(l => /^\s*\['/.test(l));
  bez.forEach(l => { if (!/'\d{4}-\d{2}-\d{2}'/.test(l) || !/'https:\/\/[^']+'\]/.test(l) || !/'(buys|power|invest|partner)'/.test(l)) F.push('G: Beziehung ohne Datum/Quelle/Typ: ' + l.trim().slice(0, 60)); });
  const b = await chromium.launch();
  const seite = async (W, H) => {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/wirtschaft\.js/, async r => { const res = await r.fetch(); let t = await res.text();
      t = t.replace('(y.t===x.t&&y.del&&!x.del)', 'false').replace('const frei=(b,ohneRing)=>b.x0>=2', 'const frei=(b,ohneRing)=>true||b.x0>=2');
      r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); p._err = []; p.on('pageerror', e => p._err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(1200);
    await p.evaluate(() => ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    return { ctx, p };
  };
  // Schrift auf Schrift und Kasten auf Kasten (Bildschirm-Rechtecke, nur sichtbarer Kartenteil)
  const ueberlapp = p => p.evaluate(() => {
    const svg = document.getElementById('ecKarte'), S = svg.getBoundingClientRect();
    const drin = r => r.right > S.left + 1 && r.left < S.right - 1 && r.bottom > S.top + 1 && r.top < S.bottom - 1;
    const T = [...svg.querySelectorAll('.ec-zn,.ec-gn,.ec-f .ec-ft,.ec-f .ec-fn')].map(e => ({ n: e.textContent, f: e.closest('[data-t]') ? e.closest('[data-t]').dataset.t : '', r: e.getBoundingClientRect() })).filter(x => drin(x.r));
    const K = [...svg.querySelectorAll('.ec-f rect')].map(e => ({ f: e.closest('[data-t]').dataset.t, r: e.getBoundingClientRect() })).filter(x => drin(x.r));
    const sch = (a, b, m) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > m && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > m;
    const out = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (!(T[i].f && T[i].f === T[j].f) && sch(T[i].r, T[j].r, 1)) out.push(T[i].n + ' | ' + T[j].n);
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) if (sch(K[i].r, K[j].r, 1)) out.push('Kasten ' + K[i].f + ' | ' + K[j].f);
    // Gruppen-/Sektorname auf einem Firmenkasten
    T.filter(t => !t.f).forEach(t => K.forEach(k => { if (sch(t.r, k.r, 1)) out.push(t.n + ' auf ' + k.f); }));
    return out;
  });
  // A + B bei 1920 und 1024
  for (const [W, H] of [[1920, 1080], [1024, 768]]) {
    const o = W + 'px';
    const { ctx, p } = await seite(W, H);
    if (W > 1000) { const nav = await p.evaluate(() => (document.getElementById('navSidebar') || {}).textContent || ''); if (!/Economy/.test(nav)) F.push(o + ' A: kein Eintrag "Economy" in der Seitenleiste'); }
    await p.evaluate(() => showTab('econ')); await p.waitForTimeout(900);
    const a = await p.evaluate(async () => { const m = await import('/js/wirtschaft-katalog.js'); const s = document.getElementById('ecKarte'), pg = document.getElementById('pgEcon');
      const z = parseFloat(getComputedStyle(pg).zoom) || 1;
      const fl = id => { const r = s.querySelector(`[data-z="${id}"] .ec-pl`); return r ? r.getBoundingClientRect().width : 0; };
      return { titel: (document.querySelector('#pgEcon .pg-titel') || {}).textContent, zonen: s.querySelectorAll('[data-z]').length, zSoll: m.EC_ZONEN.length,
        firmen: s.querySelectorAll('[data-t]').length, fSoll: new Set(m.EC_GRUPPEN.flatMap(g => g.s.map(x => x.t))).size,
        w: +s.getAttribute('width'), vb: +s.getAttribute('viewBox').split(' ')[2], gez: s.getBoundingClientRect().width / z,
        ai: fl('ai'), agr: fl('agr'), fin: fl('fin') }; });
    if (a.titel !== 'Economy Map') F.push(o + ' A: Seitentitel "' + a.titel + '"');
    if (a.zonen !== a.zSoll || a.firmen !== a.fSoll) F.push(o + ` A: ${a.zonen}/${a.zSoll} Sektoren, ${a.firmen}/${a.fSoll} Firmen auf der Karte`);
    if (!a.w || Math.abs(a.w - a.vb) > 0.5 || Math.abs(a.gez - a.w) > 2) F.push(o + ` A: Karte nicht in echter Groesse (Breite ${a.w}, viewBox ${a.vb}, gezeichnet ${a.gez.toFixed(1)})`);
    if (!(a.ai > a.fin && a.fin > a.agr)) F.push(o + ' A: Planeten nicht nach Stufe (AI > Finance > Agriculture)');
    let u = await ueberlapp(p); if (u.length) F.push(o + ' B Uebersicht: ' + u.slice(0, 4).join(' · '));
    await p.evaluate(() => { ecZoom('in'); }); await p.waitForTimeout(200);
    u = await ueberlapp(p); if (u.length) F.push(o + ' B Zoom 160%: ' + u.slice(0, 4).join(' · '));
    await p.evaluate(() => { ecFirmaWahl('NVDA'); ecFirmaZoom(); }); await p.waitForTimeout(300);
    u = await ueberlapp(p); if (u.length) F.push(o + ' B Zoom NVDA: ' + u.slice(0, 4).join(' · '));
    p._err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  // H + C-F bei 1366
  {
    const { ctx, p } = await seite(1366, 900);
    await p.evaluate(() => showTab('econ')); await p.waitForTimeout(600);
    const h = await p.evaluate(async () => { const m = await import('/js/wirtschaft-katalog.js'); const soll = m.EC_BEZ.filter(x => x[0] === 'NVDA' || x[1] === 'NVDA');
      ecFirmaWahl('NVDA'); await new Promise(r => setTimeout(r, 120));
      const s = document.getElementById('ecKarte');
      const r1 = { linien: s.querySelectorAll('.ec-l').length, soll: soll.length, soll2: soll.filter(x => x[2] !== 'invest').length, hell: s.querySelectorAll('.ec-f.hell').length, dim: s.querySelectorAll('.ec-f.dim').length,
        panel: document.querySelectorAll('#ecPanel .ec-p-b').length, quellen: document.querySelectorAll('#ecPanel .ec-p-b a[href^="https://"]').length };
      ecTypFilter('invest'); await new Promise(r => setTimeout(r, 120));
      r1.linien2 = document.querySelectorAll('#ecKarte .ec-l').length; ecTypFilter('invest');
      ecFirmaWahl('NVDA'); ecTagFilter('nuclear'); await new Promise(r => setTimeout(r, 120));
      const nuc = new Set(m.EC_GRUPPEN.flatMap(g => g.s.filter(x => (g.tags || []).includes('nuclear') || (x.split ? false : false)).map(x => x.t)));
      r1.dimTag = document.querySelectorAll('#ecKarte .ec-f.dim').length; r1.alle = document.querySelectorAll('#ecKarte .ec-f').length;
      r1.cegHell = !document.querySelector('#ecKarte .ec-f[data-t="CEG"]').classList.contains('dim'); r1.koDim = document.querySelector('#ecKarte .ec-f[data-t="KO"]').classList.contains('dim');
      ecTagFilter('nuclear');
      const z0 = document.getElementById('ecZoomT').textContent; ecZoom('in'); await new Promise(r => setTimeout(r, 80)); r1.zoom = [z0, document.getElementById('ecZoomT').textContent]; ecZoom('fit');
      return r1; });
    if (h.linien !== h.soll) F.push(`H: ${h.linien} Linien statt ${h.soll} belegte Beziehungen von NVDA`);
    if (h.hell < h.soll) F.push(`H: nur ${h.hell} verbundene Firmen hervorgehoben`);
    if (!h.dim) F.push('H: Rest der Karte nicht blass');
    if (h.panel !== h.soll || h.quellen !== h.soll) F.push(`H: Panel ${h.panel} Eintraege / ${h.quellen} Quellen statt ${h.soll}`);
    if (h.linien2 !== h.soll2) F.push(`H: Typ-Filter "Investor" aus -> ${h.linien2} Linien statt ${h.soll2}`);
    if (!h.cegHell || !h.koDim || h.dimTag >= h.alle) F.push('H: Tag-Filter "Nuclear" macht nicht genau die anderen blass');
    if (h.zoom[0] !== '100%' || h.zoom[1] !== '160%') F.push('H: Zoom-Knopf ' + h.zoom.join(' -> '));
    // C
    await p.click('.ec-neu'); await p.waitForTimeout(200); await p.keyboard.type('Waechter These', { delay: 10 });
    await p.click('.ec-sw button:has-text("Watching")'); await p.waitForTimeout(200);
    await p.click('.ec-kn:has-text("Link groups")'); await p.waitForTimeout(200);
    await p.evaluate(() => { ecGruppe('ai_acc'); ecGruppe('f_bank'); ecGruppe('f_bank'); ecGruppe('en_oil'); ecGruppe('en_oil'); ecGruppe('en_oil'); }); await p.waitForTimeout(1500);
    const c = await p.evaluate(() => { const d = JSON.parse(snap()).econThesen || {}; const id = Object.keys(d).find(k => d[k].n === 'Waechter These'); const th = id && d[id];
      const kl = g => { const e = document.querySelector(`#ecKarte .ec-g[data-g="${g}"]`); return e ? e.getAttribute('class') : ''; };
      return { th, acc: kl('ai_acc'), bank: kl('f_bank') }; });
    if (!c.th) F.push('C: These nicht in snap()');
    else {
      if (c.th.s !== 'watch') F.push('C: Status "' + c.th.s + '" statt watch');
      if (JSON.stringify(c.th.d) !== JSON.stringify({ ai_acc: 1, f_bank: -1 })) F.push('C: Gruppen ' + JSON.stringify(c.th.d) + ' statt ai_acc +1, f_bank -1 (oil dreimal = aus)');
      if (!/im-b/.test(c.acc) || !/im-s/.test(c.bank)) F.push('C: Karte faerbt die verknuepften Gruppen nicht');
    }
    await p.reload(); await wartenBisDatenDa(p); await p.waitForTimeout(800);
    await p.evaluate(() => ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    const c2 = await p.evaluate(() => { const d = JSON.parse(snap()).econThesen || {}; return Object.values(d).some(x => x.n === 'Waechter These'); });
    if (!c2) F.push('C: These nach Neuladen weg');
    // D
    const d = await p.evaluate(async () => { const m = await import('/js/wirtschaft.js');
      const a = { x: { n: 'A', s: 'active', d: {}, at: 1, t: 100 } }, bb = { x: { n: 'B', s: 'active', d: {}, at: 1, t: 200 } };
      const r1 = m.econVereinen(a, bb).x.n, r2 = m.econVereinen(bb, a).x.n;
      const grab = { x: { del: 1, t: Date.now() } }, alt = { x: { n: 'alt', s: 'active', d: {}, at: 1, t: Date.now() - 5000 } };
      const r3 = !!m.econVereinen(grab, alt).x.del, r4 = !!m.econVereinen(alt, grab).x.del;
      const tg = Date.now(), r5 = !!m.econVereinen({ x: { n: 'gleich', s: 'active', d: {}, at: 1, t: tg } }, { x: { del: 1, t: tg } }).x.del;
      const r6 = JSON.stringify(m.econRein({ y: { n: 'alt', s: 'active', d: { chips: 1, banks: -1 }, at: 1, t: 1 } }).y.d);
      return { r1, r2, r3, r4, r5, r6 }; });
    if (d.r1 !== 'B' || d.r2 !== 'B') F.push('D: juengere Aenderung gewinnt nicht (' + d.r1 + '/' + d.r2 + ')');
    if (!d.r3 || !d.r4) F.push('D: geloeschte These kommt durch eine aeltere Kopie zurueck');
    if (!d.r5) F.push('D: bei gleichem Zeitpunkt gewinnt nicht das Loeschen (Grabstein)');
    if (d.r6 !== JSON.stringify({ ai_acc: 1, f_bank: -1 })) F.push('D: alte Gruppen-ids gehen verloren: ' + d.r6);
    // E
    p.on('dialog', x => x.accept());
    await p.evaluate(() => { showTab('econ'); }); await p.waitForTimeout(400);
    const id = await p.evaluate(() => { const d = JSON.parse(snap()).econThesen; return Object.keys(d).find(k => d[k].n === 'Waechter These'); });
    await p.evaluate(id => { ecThWahl(id); }, id); await p.waitForTimeout(200);
    await p.click('.ec-del'); await p.waitForTimeout(900);
    const e1 = await p.evaluate(id => { const d = JSON.parse(snap()); const t = (d.research.trash || []).find(x => x.kind === 'econth' && x.data && x.data.id === id); return { del: !!(d.econThesen[id] && d.econThesen[id].del), trash: t && t.id, label: t ? trashEntryLabel(t) : '' }; }, id);
    if (!e1.del || !e1.trash) F.push('E: Loeschen legt keinen Grabstein/Papierkorb-Eintrag an');
    else {
      if (!/Waechter These/.test(e1.label)) F.push('E: Papierkorb-Bezeichnung "' + e1.label + '"');
      await p.evaluate(t => restoreTrashItem(t), e1.trash); await p.waitForTimeout(800);
      const e2 = await p.evaluate(id => { const d = JSON.parse(snap()).econThesen[id]; return d && !d.del && d.n; }, id);
      if (e2 !== 'Waechter These') F.push('E: Wiederherstellen bringt die These nicht zurueck');
    }
    // F
    await p.evaluate(() => ecAktie('NVDA')); await p.waitForTimeout(2500);
    const f1 = await p.evaluate(() => ({ auf: getComputedStyle(document.getElementById('mEconFirma')).display !== 'none', chart: !!document.querySelector('#mEconFirmaB .ec-ch rect'), platz: document.querySelectorAll('#mEconFirmaB .ec-pz').length, links: document.querySelectorAll('#mEconFirmaB a[href^="https://"]').length, knopf: /Open asset page/.test(document.getElementById('mEconFirmaK').textContent) }));
    if (!f1.auf) F.push('F: Firmenfenster oeffnet nicht');
    if (!f1.chart) F.push('F: NVDA ohne SEC-Chart');
    if (f1.platz !== 3) F.push('F: NVDA ' + f1.platz + ' Platzhalter statt 3 (Forecasts, CapEx, Where the money goes)');
    if (!f1.links) F.push('F: NVDA ohne Links mit Quelle');
    if (!f1.knopf) F.push('F: NVDA ohne "Open asset page"');
    await p.evaluate(() => { closeM('mEconFirma'); ecAktie('KO'); }); await p.waitForTimeout(600);
    const f2 = await p.evaluate(() => ({ chart: !!document.querySelector('#mEconFirmaB .ec-ch'), platz: document.querySelectorAll('#mEconFirmaB .ec-pz').length, zahl: /\$\d|\d\.\dB|\d+%/.test(document.getElementById('mEconFirmaB').textContent) }));
    if (f2.chart || f2.zahl) F.push('F: KO zeigt Zahlen ohne Quelle');
    if (f2.platz !== 4) F.push('F: KO ' + f2.platz + ' Platzhalter statt 4');
    p._err.forEach(e => F.push('JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => /^D: /.test(f)) && F.some(f => / B /.test(f)); console.log(ok ? 'wirtschaft --gegenprobe: ok (ohne Grabstein-Regel D rot, Beschriftung ohne Platzpruefung B rot)' : 'wirtschaft --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('wirtschaft: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('wirtschaft: ok (alle Sektoren/Firmen in echter Groesse, Flaechen nach Stufe, nichts ueberlappt in 3 Zoomstufen 1920/1024, NVDA hebt Links + Quellen hervor, Typ-/Tag-Filter, Zoom, Thesen, Abgleich mit Grabstein + alte ids, Papierkorb, Firmenfenster nur echte Zahlen, jede Beziehung mit Datum/Quelle/Typ)');
})().catch(e => { console.log('wirtschaft: ABBRUCH ' + e.message); process.exit(1); });
