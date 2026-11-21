// ── ECONOMY MAP (seit 2026-11-21, VERSION-CHECK-784) ─────────────────────────
// Nutzer 2026-11-21: neue Kategorie, Wirtschaft als Bild (Orbit gewaehlt), Gruppen mit Firmen,
// Klick auf Firma -> Revenue/Earnings/Forecasts/CapEx, links Thesen zum Zuordnen; Platzhalter
// fuer alles ohne Quelle. "nur den Inhalt ... nicht das Aussenrum".
//  A) Seitenleiste "Economy", Seite "Economy Map" mit .pg-titel, 7 Sektoren + 36 Gruppen im Orbit,
//     Orbit in echter Groesse (SVG-Breite = gezeichnete Breite, kein Skalieren der Schrift)
//  B) Nichts ueberlappt: Gruppennamen untereinander und mit fremden Monden/Planeten (Kreisgeometrie, 1920, 1024)
//  C) These: anlegen, Titel tippen, Status, Gruppen verknuepfen (+ -> - -> aus), in snap(),
//     nach Neuladen noch da; Karte faerbt die verknuepften Gruppen
//  D) Abgleich: je These gewinnt die juengere Aenderung, Grabstein gewinnt bei Gleichstand,
//     Geloeschtes kommt durch eine aeltere Kopie nicht zurueck
//  E) Loeschen -> Papierkorb (econth), Wiederherstellen bringt die These zurueck
//  F) Firmenfenster: NVDA mit echtem SEC-Chart, KO nur Platzhalter-Rahmen (keine erfundenen Zahlen)
//  G) econThesen in snap(), applySnap (Abgleich ueber econVereinen) und neueFelderBehalten
// --gegenprobe: Grabstein-Regel und Beschriftungs-Ausweichen entfernt -> D und B rot.
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
  const b = await chromium.launch();
  const seite = async (W, H) => {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/wirtschaft\.js/, async r => { const res = await r.fetch(); let t = await res.text();
      t = t.replace('(y.t===x.t&&y.del&&!x.del)', 'false').replace('const k=kand.reduce((b3,c)=>fl(c)<fl(b3)?c:b3,kand[0]);', 'const k=kand[0];');
      r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); p._err = []; p.on('pageerror', e => p._err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(1200);
    await p.evaluate(() => ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    return { ctx, p };
  };
  // Beschriftungen + Kreise: keine Ueberdeckung (Bildschirm-Rechtecke)
  const ueberlapp = p => p.evaluate(() => {
    const T = [...document.querySelectorAll('#ecOrbit .ec-mn, #ecOrbit .ec-pl-n')].map(e => ({ n: e.textContent, g: e.dataset.lg || '', r: e.getBoundingClientRect() }));
    const K = [...document.querySelectorAll('#ecOrbit .ec-mond .kr, #ecOrbit .ec-pl-z')].map(e => ({ g: e.closest('[data-g]') ? e.closest('[data-g]').dataset.g : 'planet', r: e.getBoundingClientRect() }));
    const sch = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const out = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (T[i].g !== T[j].g || !T[i].g) { if (sch(T[i].r, T[j].r) && !(T[i].g === '' && T[j].g === '' && Math.abs(T[i].r.left - T[j].r.left) < 60)) out.push(T[i].n + ' | ' + T[j].n); }
    // Gruppennamen gegen fremde Monde und alle Planeten (Kreis-Rechteck um 4 px eingezogen)
    // Kreis gegen Rechteck: naechster Punkt des Rechtecks naeher als der Radius (2 px Spiel)
    T.filter(t => t.g).forEach(t => K.forEach(k => { if (k.g === t.g) return; const cx = (k.r.left + k.r.right) / 2, cy = (k.r.top + k.r.bottom) / 2, rad = k.r.width / 2;
      const nx = Math.max(t.r.left, Math.min(cx, t.r.right)), ny = Math.max(t.r.top, Math.min(cy, t.r.bottom));
      if (Math.hypot(nx - cx, ny - cy) < rad - 2) out.push(t.n + ' auf ' + (k.g === 'planet' ? 'Planet' : 'Mond ' + k.g)); }));
    return out;
  });
  // A + B bei 1920 und 1024
  for (const [W, H] of [[1920, 1080], [1024, 768]]) {
    const o = W + 'px';
    const { ctx, p } = await seite(W, H);
    if (W > 1000) { const nav = await p.evaluate(() => (document.getElementById('navSidebar') || {}).textContent || ''); if (!/Economy/.test(nav)) F.push(o + ' A: kein Eintrag "Economy" in der Seitenleiste'); }
    await p.evaluate(() => showTab('econ')); await p.waitForTimeout(900);
    const a = await p.evaluate(() => { const s = document.querySelector('#ecOrbit svg'), ob = document.getElementById('ecOrbit'), pg = document.getElementById('pgEcon');
      const z = parseFloat(getComputedStyle(pg).zoom) || 1;
      return { titel: (document.querySelector('#pgEcon .pg-titel') || {}).textContent, monde: document.querySelectorAll('#ecOrbit .ec-mond').length, planeten: document.querySelectorAll('#ecOrbit .ec-pl-z').length,
        w: s ? +s.getAttribute('width') : 0, vb: s ? +s.getAttribute('viewBox').split(' ')[2] : 0, gez: s ? s.getBoundingClientRect().width / z : 0 }; });
    if (a.titel !== 'Economy Map') F.push(o + ' A: Seitentitel "' + a.titel + '"');
    if (a.monde !== 36 || a.planeten !== 7) F.push(o + ` A: ${a.planeten} Sektoren / ${a.monde} Gruppen statt 7 / 36`);
    if (!a.w || Math.abs(a.w - a.vb) > 0.5 || Math.abs(a.gez - a.w) > 2) F.push(o + ` A: Orbit nicht in echter Groesse (Breite ${a.w}, viewBox ${a.vb}, gezeichnet ${a.gez.toFixed(1)})`);
    const u = await ueberlapp(p); if (u.length) F.push(o + ' B: Ueberlappung ' + u.slice(0, 4).join(' · '));
    p._err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  // C-F bei 1366
  {
    const { ctx, p } = await seite(1366, 900);
    await p.evaluate(() => showTab('econ')); await p.waitForTimeout(600);
    await p.click('.ec-neu'); await p.waitForTimeout(200); await p.keyboard.type('Waechter These', { delay: 10 });
    await p.click('.ec-sw button:has-text("Watching")'); await p.waitForTimeout(200);
    await p.click('.ec-kn:has-text("Link groups")'); await p.waitForTimeout(200);
    await p.evaluate(() => { ecGruppe('chips'); ecGruppe('banks'); ecGruppe('banks'); ecGruppe('oil'); ecGruppe('oil'); ecGruppe('oil'); }); await p.waitForTimeout(1500);
    const c = await p.evaluate(() => { const d = JSON.parse(snap()).econThesen || {}; const id = Object.keys(d).find(k => d[k].n === 'Waechter These'); const th = id && d[id];
      return { id, th, chips: (document.querySelector('.ec-mond[data-g="chips"]') || { classList: { contains: () => false } }).classList.contains('im-d'), banks: (document.querySelector('.ec-mond[data-g="banks"]') || { classList: { contains: () => false } }).classList.contains('im-s') }; });
    if (!c.th) F.push('C: These nicht in snap()');
    else {
      if (c.th.s !== 'watch') F.push('C: Status "' + c.th.s + '" statt watch');
      if (JSON.stringify(c.th.d) !== JSON.stringify({ chips: 1, banks: -1 })) F.push('C: Gruppen ' + JSON.stringify(c.th.d) + ' statt chips +1, banks -1 (oil dreimal = aus)');
      if (!c.chips || !c.banks) F.push('C: Karte faerbt die verknuepften Gruppen nicht');
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
      return { r1, r2, r3, r4, r5 }; });
    if (d.r1 !== 'B' || d.r2 !== 'B') F.push('D: juengere Aenderung gewinnt nicht (' + d.r1 + '/' + d.r2 + ')');
    if (!d.r3 || !d.r4) F.push('D: geloeschte These kommt durch eine aeltere Kopie zurueck');
    if (!d.r5) F.push('D: bei gleichem Zeitpunkt gewinnt nicht das Loeschen (Grabstein)');
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
    const f1 = await p.evaluate(() => ({ auf: getComputedStyle(document.getElementById('mEconFirma')).display !== 'none', chart: !!document.querySelector('#mEconFirmaB .ec-ch rect'), platz: document.querySelectorAll('#mEconFirmaB .ec-pz').length, knopf: /Open asset page/.test(document.getElementById('mEconFirmaK').textContent) }));
    if (!f1.auf) F.push('F: Firmenfenster oeffnet nicht');
    if (!f1.chart) F.push('F: NVDA ohne SEC-Chart');
    if (f1.platz !== 3) F.push('F: NVDA ' + f1.platz + ' Platzhalter statt 3 (Forecasts, CapEx, Where the money goes)');
    if (!f1.knopf) F.push('F: NVDA ohne "Open asset page"');
    await p.evaluate(() => { closeM('mEconFirma'); ecAktie('KO'); }); await p.waitForTimeout(600);
    const f2 = await p.evaluate(() => ({ chart: !!document.querySelector('#mEconFirmaB .ec-ch'), platz: document.querySelectorAll('#mEconFirmaB .ec-pz').length, zahl: /\$\d|\d\.\dB|\d+%/.test(document.getElementById('mEconFirmaB').textContent) }));
    if (f2.chart || f2.zahl) F.push('F: KO zeigt Zahlen ohne Quelle');
    if (f2.platz !== 4) F.push('F: KO ' + f2.platz + ' Platzhalter statt 4');
    p._err.forEach(e => F.push('JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (GP) { const ok = F.some(f => / D: /.test(' ' + f)) && F.some(f => / B: /.test(f)); console.log(ok ? 'wirtschaft --gegenprobe: ok (ohne Grabstein-Regel D rot, ohne Ausweichen B rot)' : 'wirtschaft --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('wirtschaft: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('wirtschaft: ok (Seitenleiste, 7 Sektoren/36 Gruppen in echter Groesse, nichts ueberlappt 1920/1024, These anlegen/Status/verknuepfen/Neuladen, Abgleich mit Grabstein, Papierkorb, NVDA echt + KO nur Platzhalter, snap/applySnap/neueFelderBehalten)');
})().catch(e => { console.log('wirtschaft: ABBRUCH ' + e.message); process.exit(1); });
