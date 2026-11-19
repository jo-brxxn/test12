// ── AUSWAHLLISTEN SCHNEIDEN KEINE BUCHSTABEN AB (seit 2026-11-19, VERSION-CHECK-773) ──
// Nutzer 2026-11-19 (PC-Foto): "Im Asset Filter sind Buchstaben abgeschnitten" (Copper, COT-Seite).
// Gemessen vorher: .cot-filterbar select 34 px hoch, padding 8+8 px -> 16 px Platz fuer 14-px-Schrift,
// die 16,8 px Zeilenhoehe braucht (1920 und 1194 px). Fix: padding 0 15px, Hoehe bleibt 34 px.
// Geprueft: jede sichtbare Auswahlliste (<select>) auf allen Seiten mit Filtern, 1920/1194/390 px:
//  A) Innenhoehe (clientHeight - padding oben/unten) >= 1,2 x Schriftgroesse
// --gegenprobe: altes padding 8px 15px wieder gesetzt -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = []; let n = 0;
  const b = await chromium.launch();
  for (const [W, H] of [[1920, 1080], [1194, 834], [390, 844]]) {
    const o = W + 'px';
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(1500);
    if (GP) await p.addStyleTag({ content: '.cot-filterbar select{padding:8px 15px!important}' });
    for (const t of ['dash', 'cur', 'cot', 'trends', 'seas', 'data', 'sent', 'carry', 'news', 'cal', 'rate', 'pairs', 'journal', 'gameplan', 'mx', 'regime']) {
      await p.evaluate(t => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); if (t === 'cur') gotoSym('USD'); else showTab(t); }, t);
      await p.waitForTimeout(t === 'cur' ? 1500 : 700);
      const r = await p.evaluate(() => [...document.querySelectorAll('select')].filter(x => x.offsetParent && x.getBoundingClientRect().height).map(s => {
        const c = getComputedStyle(s), fs = parseFloat(c.fontSize), inh = s.clientHeight - parseFloat(c.paddingTop) - parseFloat(c.paddingBottom);
        return { name: (s.id || s.className || 'select') + ' "' + ((s.options[s.selectedIndex] || {}).text || '').slice(0, 20) + '"', inh: Math.round(inh * 10) / 10, soll: Math.round(fs * 12) / 10 };
      }));
      r.forEach(x => { n++; if (x.inh < x.soll - 0.05) F.push(`${o} A: ${t} ${x.name} - ${x.inh} px Platz fuer ${x.soll} px Zeile`); });
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  if (!n) F.push('Testaufbau: keine Auswahlliste gefunden');
  if (GP) { const ok = F.some(f => / A: cot /.test(f)); console.log(ok ? 'selectschnitt --gegenprobe: ok (altes Padding gemeldet)' : 'selectschnitt --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('selectschnitt: ' + F.length + ' Befund(e)\n  ' + F.slice(0, 30).join('\n  ')); process.exit(1); }
  console.log(`selectschnitt: ok (${n} Auswahllisten auf 16 Seiten, 1920/1194/390 px: Platz >= 1,2 x Schrift)`);
})().catch(e => { console.log('selectschnitt: ABBRUCH ' + e.message); process.exit(1); });
