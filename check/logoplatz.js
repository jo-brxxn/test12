// ── LOGO NIE UEBER DEM INHALT, AUCH MIT PC-ZOOM (seit 2026-11-19, VERSION-CHECK-773) ──
// Nutzer 2026-11-19 (PC-Fotos): "Dann ist das Logo an manchen Stellen komplett falsch teilweise mitten in
// der Karte". Gemessen vorher (1920 px, Dashboard-Zoom 1,205, Performance-Karte): Logo-Oberkante 22 px
// UEBER dem letzten Inhalt. Ursache: lgKarte teilte Hoehe/Breite noch einmal durch den Zoom, obwohl
// lgFreiraum seit 2026-11-11 schon in Kartenmass misst (currentCSSZoom enthaelt alle Vorfahren).
// Geprueft bei 1920 und 2560 px (Zoom > 1) auf Dashboard und Asset-Seite (USD):
//  A) jedes sichtbare Logo (.lg-frei) liegt unter dem letzten Inhalt seiner Karte (1 px Toleranz)
//  B) und innerhalb der Karte, ueber dem Go-to-Fuss
// --gegenprobe: die doppelte Teilung durch den Zoom wieder eingebaut -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const NEU = "lg.style.top=Math.round(m.unten-m.top-hoehe-Math.min(18,m.frei*0.08))+'px';";
(async () => {
  const F = []; let n = 0;
  const b = await chromium.launch();
  for (const [W, H] of [[1920, 1080], [2560, 1440]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text();
      if (!t.includes(NEU)) F.push('Testaufbau: lgKarte-Zeile nicht gefunden');
      if (GP) t = t.replace(NEU, "lg.style.top=Math.round((m.unten-m.top-hoehe-Math.min(18,m.frei*0.08))/(card.currentCSSZoom||1))+'px';");
      r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(4000);
    for (const t of ['dash', 'cur']) {
      await p.evaluate(t => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); if (t === 'cur') gotoSym('USD'); else showTab(t); }, t);
      await p.waitForTimeout(3000);
      const r = await p.evaluate(() => [...document.querySelectorAll('.lg-frei')].filter(l => l.offsetParent && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().height > 4).map(l => {
        const c = l.parentElement, cr = c.getBoundingClientRect(), lr = l.getBoundingClientRect();
        let unten = cr.top; const fuss = c.querySelector(':scope > .ab-goto');   // Go-to-Fuss liegt bewusst UNTER dem Logo (logo.js C)
        const fussOben = fuss && fuss.offsetParent ? fuss.getBoundingClientRect().top : cr.bottom;
        c.querySelectorAll('*').forEach(e => { if (l.contains(e) || (fuss && fuss.contains(e)) || e.children.length || !e.textContent.trim() || !e.offsetParent) return; const q = e.getBoundingClientRect(); if (q.height && q.bottom <= cr.bottom + 1) unten = Math.max(unten, q.bottom); });
        const name = ((c.querySelector('.dw-t-txt,.ab-tile-t,.rub-inp,.dw-hdr,h3') || {}).textContent || c.className).trim().slice(0, 28);
        return { name, oben: Math.round(lr.top), inhalt: Math.round(unten), drin: lr.top >= cr.top - 1 && lr.bottom <= fussOben + 1, zoom: +(c.currentCSSZoom || 1).toFixed(3) };
      }));
      r.forEach(x => { n++;
        if (x.oben < x.inhalt - 1) F.push(`${o} A: ${t} "${x.name}" - Logo ${x.inhalt - x.oben} px ueber dem Inhalt (Zoom ${x.zoom})`);
        if (!x.drin) F.push(`${o} B: ${t} "${x.name}" - Logo ragt aus der Karte oder in den Fuss`); });
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (!n && !GP) F.push('Testaufbau: kein sichtbares Logo gefunden');
  if (GP) { const ok = F.some(f => / A: /.test(f)); console.log(ok ? 'logoplatz --gegenprobe: ok (doppelte Zoom-Teilung gemeldet)' : 'logoplatz --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('logoplatz: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`logoplatz: ok (${n} Logos unter dem Inhalt und in ihrer Karte, Dashboard + Asset-Seite, 1920/2560 px mit Zoom)`);
})().catch(e => { console.log('logoplatz: ABBRUCH ' + e.message); process.exit(1); });
