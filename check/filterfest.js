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
// Gegenproben (muessen ROT werden):
//   --gegenprobe          ✕ ohne Platz + Popup bei jedem Antippen neu ausgerichtet -> A, B rot
//   --gegenprobe-spalten  eine Spalte                                              -> C rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_SP = process.argv.includes('--gegenprobe-spalten');
const MARKE = 'if(el.dataset.fest)return;';
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if (GP && !MAIN.includes(MARKE)) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const perr = [];
  const HIER = new globalThis.URL(URL).origin;
  for (const vp of [{ width: 1180, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' });
    await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (GP) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MAIN.replace(MARKE, '') }));
    const p = await ctx.newPage();
    p.on('pageerror', e => perr.push(String(e)));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    if (GP) await p.addStyleTag({ content: '.flt-x[hidden]{display:none!important}' });
    if (GP_SP) await p.addStyleTag({ content: '.data-picker-body{columns:1!important}' });

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
        const grp = e ? [...e.querySelectorAll('.data-picker-grp')].map(g => Math.round(g.getBoundingClientRect().left)) : [];
        return { a, n, spalten: new Set(grp).size, gruppen: grp.length, breite: e ? Math.round(e.getBoundingClientRect().width) : 0 };
      }, [pu.auf.toString().replace(/^\(\)\s*=>\s*\{|\}$/g, ''), pu.id, pu.tippen]);
      if (r.fehler) { rot(`${pu.name}: ${r.fehler}`); continue; }
      if (!r.n) gruen(`${pu.name}: nach dem Antippen geschlossen (voll) - Lage vorher geprueft`);
      else if (Math.abs(r.n.x - r.a.x) >= 2 || Math.abs(r.n.y - r.a.y) >= 2) rot(`${pu.name}: Popup nach drei Antippen um ${r.n.x - r.a.x}/${r.n.y - r.a.y} px versetzt`);
      else gruen(`${pu.name}: steht fest`);
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
  const gp = GP || GP_SP;
  if (gp) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ filterfest: ${fehler} Befund(e)` : '\n✓ filterfest: Filter stehen fest, Gruppen in 2 Spalten');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
