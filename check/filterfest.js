// ══ WAECHTER: FILTER STEHEN FEST, GRUPPEN IN 2 SPALTEN ═════════════════════
//
// Nutzer 2026-10-31: "was mich nervt ist das wenn ich im Filter was auswaehle
// das dann er teilweise Position wechselt das soll nicht so sein lass ihn fest
// stehen und in Filtern ist es ja immer in Gruppen unterteilt mach das man
// nicht ewig scrollen muss sondern mach 2 Spalten nebeneinander".
//
// GEMESSEN vorher: Asset-Filter auf COT, Retail, Put/Call, Net flow und
// Fear & Greed rutschten nach einer Auswahl 47 px nach links (Handy 12-43 px),
// weil das ✕ zum Zuruecksetzen erst dann rechts daneben erschien (Leiste
// rechtsbuendig). Das Data-Popup "Assets" sprang nach dem ersten Antippen
// 138 px nach links: es wurde nach JEDEM Antippen neu am wandernden Knopf
// ausgerichtet.
//
// Geprueft (ohne gepflegte Liste - jede Seite wird nach Auswahllisten mit
// Gruppen durchsucht, neue Filter sind automatisch dabei):
//   A) jede Gruppen-Auswahlliste auf 16 Seiten, 1180 und 390 px: nach einer
//      Auswahl steht sie auf dem Pixel (Toleranz 2 px - die ganze Seite
//      verschiebt sich beim Neuzeichnen um Bruchteile eines Pixels)
//   B) Chip-Popups (Data Assets, Data Indicators, Country profile): nach drei
//      Antippen dieselbe Lage
//   C) Chip-Popups ab 480 px: die Gruppen stehen in 2 Spalten
//   D) WIE DIE iOS-LISTE (Nutzer 2026-10-31: "nicht ewig weit nach unten ...
//      scrollen ... um an die letzten Punkte zu kommen"): Popup hoechstens
//      halbe Fensterhoehe (mind. 240 px), nie ueber den unteren Rand, der
//      letzte Punkt per Scrollen IM Popup erreichbar, Kopfzeile bleibt oben
//   E) OPTION a (Nutzer 2026-10-31 "Ja a"): JEDE Auswahlliste mit Gruppen auf
//      allen Seiten + die Context-Charts oeffnet beim echten Antippen das
//      2-Spalten-Fenster (gleiche Optionen wie die Liste), die Wahl kommt an,
//      das Fenster ist danach zu, die Liste steht wo sie stand
// Gegenproben (muessen ROT werden):
//   --gegenprobe          ✕ ohne Platz + Popup bei jedem Antippen neu ausgerichtet -> A, B rot
//   --gegenprobe-spalten  eine Spalte                                              -> C rot
//   --gegenprobe-hoehe    Popup ohne Hoehengrenze                                  -> D rot
//   --gegenprobe-nativ    Listen wieder als Browser-Liste                          -> E rot
//   (F, seit 2026-11-08: Gegenprobe von Hand - ✕ wieder rechts vom Feld -> F rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_SP = process.argv.includes('--gegenprobe-spalten');
const GP_H = process.argv.includes('--gegenprobe-hoehe');
const GP_N = process.argv.includes('--gegenprobe-nativ');
const MARKE_N = "if(s.disabled||s.hasAttribute('data-nativ')||!s.querySelector('optgroup'))continue;";
const MARKE = 'if(el.dataset.fest)return;';
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if ((GP && !MAIN.includes(MARKE)) || (GP_N && !MAIN.includes(MARKE_N))) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const perr = [];
  const HIER = new globalThis.URL(URL).origin;
  for (const vp of [{ width: 1180, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' });
    await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (GP || GP_N) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: GP ? MAIN.replace(MARKE, '') : MAIN.replace(MARKE_N, 'continue;') }));
    const p = await ctx.newPage();
    p.on('pageerror', e => perr.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    if (GP) await p.addStyleTag({ content: '.flt-x[hidden]{display:none!important}' });
    if (GP_SP) await p.addStyleTag({ content: '.data-picker-body{columns:1!important}' });
    if (GP_H) await p.addStyleTag({ content: '.data-picker{max-height:none!important;overflow:visible!important}' });

    // ── A) Gruppen-Auswahllisten ──
    console.log(`A) Auswahllisten stehen fest (${vp.width} px)`);
    const ziele = ['dash', 'mx', 'trends', 'cot', 'sent:retail', 'sent:putcall', 'sent:netflow', 'sent:fg', 'sent:aaii', 'seas', 'data', 'rate', 'carry', 'regime', 'cal', 'news'];
    let geprueft = 0, gesprungen = 0;
    for (const z of ziele) {
      const [t, s] = z.split(':');
      await p.evaluate(([t, s]) => { showTab(t); if (s) setSentSub(s); }, [t, s]); await p.waitForTimeout(600);
      const liste = await p.evaluate(() => [...document.querySelectorAll('select')].filter(x => { const r = x.getBoundingClientRect(); return r.width > 0 && x.querySelector('optgroup') && !x.closest('.modal,#fdOv'); }).map(x => x.getAttribute('onchange') || ''));
      for (const oc of liste) {
        if (!oc) continue;
        const v = await p.evaluate(oc => {
          const s = [...document.querySelectorAll('select')].find(x => x.getAttribute('onchange') === oc); if (!s) return null;
          const a = s.getBoundingClientRect();
          const o = [...s.options].filter(x => x.value && !x.selected);
          if (!o.length) return null;
          s.value = o[Math.min(3, o.length - 1)].value; s.dispatchEvent(new Event('change', { bubbles: true }));
          return { x: a.left, y: a.top, wahl: s.value };
        }, oc);
        if (!v) continue;
        await p.waitForTimeout(450);
        const n = await p.evaluate(oc => { const s = [...document.querySelectorAll('select')].find(x => x.getAttribute('onchange') === oc); if (!s) return null; const q = s.getBoundingClientRect(); return { x: q.left, y: q.top }; }, oc);
        geprueft++;
        if (!n) { rot(`${z}: Filter ${oc.slice(0, 24)} nach Wahl von ${v.wahl} verschwunden`); gesprungen++; }
        else if (Math.abs(n.x - v.x) >= 2 || Math.abs(n.y - v.y) >= 2) { rot(`${z}: ${oc.slice(0, 24)} nach Wahl von ${v.wahl} um ${Math.round(n.x - v.x)}/${Math.round(n.y - v.y)} px versetzt`); gesprungen++; }
        await p.evaluate(oc => { const s = [...document.querySelectorAll('select')].find(x => x.getAttribute('onchange') === oc); if (s && s.options[0]) { s.selectedIndex = 0; s.dispatchEvent(new Event('change', { bubbles: true })); } }, oc);
        await p.waitForTimeout(250);
      }
    }
    if (!geprueft) rot('keine Gruppen-Auswahlliste gefunden - Stufe A laeuft ins Leere');
    else if (!gesprungen) gruen(`${geprueft} Auswahllisten bleiben nach der Auswahl stehen`);

    // ── F) kein unsichtbarer Platz RECHTS vom Filter (Nutzer 2026-11-08, iPad-Foto
    // COT: Luecke zwischen "All assets" und "Refresh" = reservierter Platz des ✕).
    // Das ✕ steht links vom Feld; das Feld schliesst die (rechtsbuendige) Leiste ab.
    console.log(`F) kein leerer Platz rechts vom Filter (${vp.width} px)`);
    let fGez = 0, fLuecke = 0;
    for (const z of ziele) {
      const [t, s] = z.split(':');
      const r = await p.evaluate(([t, s]) => { showTab(t); if (s) setSentSub(s); return [...document.querySelectorAll('.cot-filterbar')].filter(f => f.offsetParent && f.querySelector('.flt-x') && f.querySelector('select')).map(f => { const fr = f.getBoundingClientRect(), sr = f.querySelector('select').getBoundingClientRect(); return Math.round(fr.right - sr.right); }); }, [t, s]);
      r.forEach(d => { fGez++; if (d > 1) { fLuecke++; rot(`${z}: ${d} px leerer Platz rechts vom Filter (unsichtbares ✕)`); } });
      // ueberall (auch Kalender/News/Trends): ein verstecktes ✕ belegt keinen Platz
      const belegt = await p.evaluate(() => [...document.querySelectorAll('.flt-x[hidden]')].filter(x => { const pg = x.closest('[id^=pg]'); return pg && pg.offsetParent && x.getBoundingClientRect().width > 0; }).map(x => x.id || (x.getAttribute('onclick') || '').slice(0, 24)));
      belegt.forEach(b => { fLuecke++; rot(`${z}: verstecktes ✕ ${b} belegt Platz (sichtbare Luecke)`); });
    }
    if (!fGez) rot('keine Filter-Leiste mit ✕ gefunden - Stufe F laeuft ins Leere');
    else if (!fLuecke) gruen(`${fGez} Filter-Leisten schliessen mit dem Feld ab`);

    // ── E) Option a: echtes Antippen jeder Gruppen-Liste ──
    console.log(`E) Gruppen-Listen oeffnen das 2-Spalten-Fenster (${vp.width} px)`);
    let eN = 0, eFehl = 0;
    const eZiele = ziele.concat(['kontext']);
    for (const z of eZiele) {
      const [t, s] = z.split(':');
      await p.evaluate(([t, s]) => { if (t === 'kontext') { gotoSym('GOLD'); openKontextSettings('GOLD'); } else { try { closeM('mCardInfo'); } catch (e) {} showTab(t); if (s) setSentSub(s); } }, [t, s]); await p.waitForTimeout(600);
      // Adressiert ueber die Reihenfolge der SICHTBAREN Gruppen-Listen - nach einer
      // Wahl baut die Seite neu, eine Markierung am Element ginge verloren.
      await p.evaluate(() => { window.__ffListe = () => [...document.querySelectorAll('select')].filter(x => x.getBoundingClientRect().width > 0 && x.querySelector('optgroup')); });
      const liste = await p.evaluate(() => window.__ffListe().map((x, i) => i));
      for (const i of liste) {
        const a = await p.evaluate(i => { const x = (window.__ffListe()[i]); if (!x) return null; x.scrollIntoView({ block: 'center' }); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, n: x.options.length, g: x.querySelectorAll('optgroup').length, v: x.value, oc: (x.getAttribute('onchange') || x.className).slice(0, 26) }; }, i);
        if (!a) continue;
        await p.waitForTimeout(120);
        const a2 = await p.evaluate(i => { const x = (window.__ffListe()[i]); const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, i);
        await p.mouse.click(a2.x, a2.y); await p.waitForTimeout(250);
        eN++;
        const f = await p.evaluate(() => { const e = document.getElementById('gwPicker'); if (!e) return null; const q = e.getBoundingClientRect(); const gr = [...e.querySelectorAll('.data-picker-grp')].map(g => Math.round(g.getBoundingClientRect().left)); const k = [...e.querySelectorAll('.cmp-chip')]; const w = k.filter(c => !c.classList.contains('on') && !c.disabled)[1] || k.filter(c => !c.classList.contains('on') && !c.disabled)[0]; let ziel = null; if (w) { w.scrollIntoView({ block: 'nearest' }); const r = w.getBoundingClientRect(); ziel = { x: r.left + r.width / 2, y: r.top + r.height / 2, t: w.textContent.trim() }; } return { n: k.length, sp: new Set(gr).size, g: gr.length, h: Math.round(q.height), unten: Math.round(q.bottom), ziel }; });
        if (!f) { rot(`${z} ${a.oc}: Antippen oeffnet kein 2-Spalten-Fenster (Browser-Liste)`); eFehl++; continue; }
        if (f.n !== a.n) { rot(`${z} ${a.oc}: Fenster zeigt ${f.n} statt ${a.n} Optionen`); eFehl++; }
        if (vp.width >= 480 && f.g >= 2 && f.sp < 2) { rot(`${z} ${a.oc}: ${f.g} Gruppen in einer Spalte`); eFehl++; }
        if (f.unten > vp.height) { rot(`${z} ${a.oc}: Fenster reicht ueber den Rand (${f.unten} px)`); eFehl++; }
        if (!f.ziel) continue;
        await p.mouse.click(f.ziel.x, f.ziel.y); await p.waitForTimeout(450);
        const n = await p.evaluate(([i, oc]) => { const x = (window.__ffListe()[i]) || [...document.querySelectorAll('select')].find(y => (y.getAttribute('onchange') || y.className).slice(0, 26) === oc && y.getBoundingClientRect().width > 0); if (!x) return null; return { txt: x.options[x.selectedIndex] ? x.options[x.selectedIndex].textContent.trim() : '', offen: !!document.getElementById('gwPicker') }; }, [i, a.oc]);
        if (!n || n.txt !== f.ziel.t) { rot(`${z} ${a.oc}: "${f.ziel.t}" gewaehlt, Liste zeigt "${n && n.txt}"`); eFehl++; }
        else if (n.offen) { rot(`${z} ${a.oc}: Fenster nach der Wahl noch offen`); eFehl++; }
        // Zuruecksetzen, damit die naechste Seite den Ausgangsstand hat
        await p.evaluate(([i, v]) => { const x = (window.__ffListe()[i]); if (x && x.value !== v) { x.value = v; x.dispatchEvent(new Event('change', { bubbles: true })); } }, [i, a.v]);
        await p.waitForTimeout(200);
      }
    }
    await p.evaluate(() => { try { closeM('mCardInfo'); } catch (e) {} try { resetKontextSlots('GOLD'); closeM('mCardInfo'); } catch (e) {} });
    if (!eN) rot('Stufe E: keine Gruppen-Liste gefunden');
    else if (!eFehl) gruen(`${eN} Gruppen-Listen: Antippen -> 2-Spalten-Fenster, Wahl kommt an, Fenster zu`);

    // ── B/C) Chip-Popups ──
    console.log(`B/C) Chip-Popups (${vp.width} px)`);
    const popups = [
      { name: 'Data Assets', id: 'dataAssetPicker', auf: () => { showTab('data'); setDataMode('assets'); setDataAsset('USD'); openDataAssetPicker(); }, tippen: ['EUR', 'GOLD', 'GBP'].map(x => `toggleDataAsset('${x}')`) },
      { name: 'Data Indicators', id: 'dataIndPicker', auf: () => { showTab('data'); setDataMode('inds'); setDataAsset('USD'); openDataIndPicker(); }, tippen: null },
      { name: 'Country profile', id: 'cpfPicker', auf: () => { gotoSym('USD'); cpFensterAuf(); setTimeout(() => { const k = document.querySelector('#mCountryProfile [onclick^="cpfOeffnen"]'); if (k) k.click(); setTimeout(cpfPicker, 300); }, 300); }, tippen: ['cpfUmschalten(0)', 'cpfUmschalten(1)', 'cpfUmschalten(2)'] }
    ];
    for (const pu of popups) {
      const r = await p.evaluate(async ([auf, id, tippen]) => {
        const warte = ms => new Promise(r => setTimeout(r, ms));
        try { (new Function(auf))(); } catch (e) { return { fehler: String(e) }; }
        // auf das Popup warten statt fest zu warten (unter Last dauert das Oeffnen laenger)
        for (let i = 0; i < 40 && !document.getElementById(id); i++) await warte(150);
        await warte(200);
        const box = () => { const e = document.getElementById(id); if (!e) return null; const q = e.getBoundingClientRect(); return { x: Math.round(q.left), y: Math.round(q.top) }; };
        const a = box(); if (!a) return { fehler: 'Popup nicht offen' };
        // Indicators: die ersten drei Chips des Popups antippen
        const klicks = tippen || [...document.querySelectorAll('#' + id + ' .cmp-chip')].slice(0, 3).map(c => c.getAttribute('onclick'));
        for (const k of klicks) { if (!document.getElementById(id)) break; try { (new Function(k))(); } catch (e) {} await warte(250); }
        const n = box();
        const e = document.getElementById(id);
        // D) Hoehe begrenzt, innen scrollbar bis zum letzten Punkt, Kopf bleibt
        let hoehe = null;
        if (e) {
          const q = e.getBoundingClientRect(), grenze = Math.max(240, Math.round(innerHeight * 0.5));
          e.scrollTop = e.scrollHeight;
          const chips = [...e.querySelectorAll('.cmp-chip')], l = chips.length ? chips[chips.length - 1].getBoundingClientRect() : null;
          const hd = e.querySelector('.data-picker-hd'), hq = hd ? hd.getBoundingClientRect() : null;
          hoehe = { h: Math.round(q.height), grenze, unten: Math.round(q.bottom), vh: innerHeight, letzter: !!l && l.bottom <= q.bottom + 1 && l.top >= q.top - 1, kopf: !!hq && Math.abs(hq.top - q.top) < 2 };
          e.scrollTop = 0;
        }
        const grp = e ? [...e.querySelectorAll('.data-picker-grp')].map(g => Math.round(g.getBoundingClientRect().left)) : [];
        return { a, n, hoehe, spalten: new Set(grp).size, gruppen: grp.length, breite: e ? Math.round(e.getBoundingClientRect().width) : 0 };
      }, [pu.auf.toString().replace(/^\(\)\s*=>\s*\{|\}$/g, ''), pu.id, pu.tippen]);
      if (r.fehler) { rot(`${pu.name}: ${r.fehler}`); continue; }
      if (!r.n) gruen(`${pu.name}: nach dem Antippen geschlossen (voll) - Lage vorher geprueft`);
      else if (Math.abs(r.n.x - r.a.x) >= 2 || Math.abs(r.n.y - r.a.y) >= 2) rot(`${pu.name}: Popup nach drei Antippen um ${r.n.x - r.a.x}/${r.n.y - r.a.y} px versetzt`);
      else gruen(`${pu.name}: steht fest`);
      if (r.hoehe) {
        const d = r.hoehe;
        if (d.h > d.grenze + 1 || d.unten > d.vh) rot(`${pu.name}: Popup ${d.h} px hoch, bis y=${d.unten} (Grenze ${d.grenze} px, Fenster ${d.vh} px)`);
        else if (!d.letzter) rot(`${pu.name}: letzter Punkt per Scrollen im Popup nicht erreichbar`);
        else if (!d.kopf) rot(`${pu.name}: Kopfzeile scrollt mit weg`);
        else gruen(`${pu.name}: ${d.h} px (Grenze ${d.grenze}), scrollt innen bis zum letzten Punkt, Kopf bleibt`);
      }
      if (vp.width >= 480 && r.gruppen >= 2) {
        if (r.spalten < 2) rot(`${pu.name}: ${r.gruppen} Gruppen in einer Spalte (Breite ${r.breite} px) - soll 2 Spalten`);
        else gruen(`${pu.name}: ${r.gruppen} Gruppen in 2 Spalten`);
      }
      await p.evaluate(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); try { closeM('mCountryProfile'); } catch (e) {} });
      await p.waitForTimeout(200);
    }
    await ctx.close();
  }
  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  const gp = GP || GP_SP || GP_H || GP_N;
  if (gp) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ filterfest: ${fehler} Befund(e)` : '\n✓ filterfest: Filter stehen fest, Gruppen in 2 Spalten');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
