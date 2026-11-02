// ══ WAECHTER: SCHLAGZEILEN BEHALTEN IHRE BREITE ═════════════════════════════
//
// CI 675 (2026-11-01, `namen`): in der Dashboard-Karte "Headlines" bei 360 px
// blieben der Schlagzeile 29 von 231 px - die Seitenspalte (Quelle bis 150 px
// + Zeit) nahm den Rest. 15 von 16 Titeln brachen nach 2 Zeilen ab, auf der
// News-Seite 61 px, in der Headlines-Karte der Asset-Seite 131/272 px.
// `namen` sah das nur zufaellig (Titel mit "Goldman" enthielt "Gold").
// Nutzer-Wahl 2026-11-02 (Option A): in schmalen Listen (<= 420 px) steht
// Quelle/Zeit UNTER dem Titel.
// Geprueft an Dashboard (alle Kartentypen), News-Seite und Asset-Seite (GOLD,
// SP500, EUR), 360 / 390 px mit breiter Schrift, 820 / 1180 / 1366 px; in jede
// Liste wird zusaetzlich eine Grenzfall-Zeile gesetzt (lange Quelle, zwei
// Assets, "+2", NEW), damit der Lauf nicht vom Nachrichtenstand abhaengt:
//   A) jeder Titel ist mindestens halb so breit wie seine Zeile
//   B) die Meta-Zeile (Quelle/Zeit/Chips) ragt nie aus der Zeile
//   C) schmale Liste (<= 420 px): Meta-Zeile liegt UNTER dem Titel
// Gegenprobe: --gegenprobe (alte Seitenspalte) -> A rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_CSS = '.hl-row{grid-template-columns:minmax(0,1fr) auto!important;gap:14px!important}' +
  '.hl-side{flex-direction:column!important;align-items:flex-end!important;text-align:right!important}';
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const BREIT = 'DejaVu Sans';

(async () => {
  const b = await chromium.launch();
  let zeilen = 0, schmal = 0;
  const laeufe = [[360, 780, true], [390, 844, true], [820, 1180, false], [1180, 820, false], [1366, 1024, false]];
  for (const [w, h, breit] of laeufe) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: w < 900 });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
    const perr = []; p.on('pageerror', e => perr.push(String(e)));
    await p.goto(URL); await wartenBisDatenDa(p);
    if (breit) await p.addStyleTag({ content: `:root{--ff-text:'FX Sym','${BREIT}',sans-serif!important}` });
    if (GP) await p.addStyleTag({ content: GP_CSS });
    await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
    const ort = `${w}x${h}${breit ? ' breite Schrift' : ''}`;
    const pruefe = async wo => {
      const r = await p.evaluate(() => {
        // Grenzfall-Zeile: 25-Zeichen-Quelle (Feed-Deckel), zwei Assets, "+2", NEW
        const muster = { t: 'High mortgage rates to hit US home sales, slow price growth in 2027: Goldman Sachs', s: 'Mortgage Professional Ame…',
          u: 'https://example.com/schlagzeilen-waechter', d: new Date(Date.now() - 6e5).toISOString(), a: ['EUR', 'GOLD'], n: 3, w: 6,
          o: [{ s: 'Reuters', u: 'https://example.com/a' }, { s: 'CNBC', u: 'https://example.com/b' }] };
        document.querySelectorAll('.hl-list,.news-card-body').forEach(l => { if (l.offsetParent) l.insertAdjacentHTML('afterbegin', newsRowHtml(muster)); });
        const out = []; let n = 0, eng = 0;
        document.querySelectorAll('.hl-row').forEach(row => {
          if (!row.offsetParent) return;
          const t = row.querySelector('.hl-title'), s = row.querySelector('.hl-side');
          if (!t || !s) return;
          n++;
          const liste = row.closest('.hl-list,.news-card-body');
          const lb = liste ? liste.getBoundingClientRect().width : 9999;
          if (lb <= 420) eng++;
          const rr = row.getBoundingClientRect(), tr = t.getBoundingClientRect(), sr = s.getBoundingClientRect();
          const name = '"' + t.textContent.slice(0, 40) + '…"';
          if (t.clientWidth < row.clientWidth * 0.5) out.push(['A', `Titel ${t.clientWidth}px von ${row.clientWidth}px Zeile ${name}`]);
          [s, ...s.querySelectorAll('*')].forEach(e => {
            const er = e.getBoundingClientRect();
            if (er.width && (er.right > rr.right + 0.5 || er.left < rr.left - 0.5)) out.push(['B', `${e.className || e.tagName} ragt ${Math.round(Math.max(er.right - rr.right, rr.left - er.left))}px aus der Zeile ${name}`]);
          });
          if (lb <= 420 && sr.top < tr.bottom - 1) out.push(['C', `Liste ${Math.round(lb)}px: Meta-Zeile neben statt unter dem Titel ${name}`]);
        });
        return { out, n, eng };
      });
      zeilen += r.n; schmal += r.eng;
      const gesehen = new Set();
      r.out.forEach(([k, x]) => { if (!gesehen.has(k + x)) { gesehen.add(k + x); fail(`${k} ${ort} ${wo}`, x); } });
      return r.n;
    };
    await p.evaluate(() => { const da = new Set(widgets.map(x => x.type)); W_TYPES.forEach((t, i) => { if (!da.has(t.type)) widgets.push({ id: 'hltest' + i, type: t.type, title: t.label, order: widgets.length, content: '' }); }); showTab('dash'); renderDash(); });
    await p.waitForTimeout(700);
    if (!(await pruefe('Dashboard'))) fail('KEINE ZEILEN ' + ort, 'Dashboard ohne Schlagzeilen-Zeile');
    await p.evaluate(() => showTab('news')); await p.waitForTimeout(500);
    if (!(await pruefe('News'))) fail('KEINE ZEILEN ' + ort, 'News-Seite ohne Schlagzeilen-Zeile');
    for (const s of ['GOLD', 'SP500', 'EUR']) { await p.evaluate(s => gotoSym(s), s); await p.waitForTimeout(600); await pruefe('Asset ' + s); }
    perr.forEach(x => fail('JS-FEHLER ' + ort, x));
    await ctx.close();
  }
  await b.close();
  if (zeilen < 60) fail('ZU WENIG GEMESSEN', `nur ${zeilen} Zeilen`);
  if (schmal < 20) fail('ZU WENIG SCHMALE LISTEN', `nur ${schmal} Zeilen in Listen <= 420 px - Handy-Faelle nicht erreicht`);
  if (GP) {
    const ok = F.some(x => x.startsWith('A '));
    console.log(ok ? `schlagzeilen --gegenprobe: ok (alte Seitenspalte wird gemeldet, ${F.filter(x => x.startsWith('A ')).length} Befunde)` : 'schlagzeilen --gegenprobe: FEHLER - nicht gemeldet');
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`schlagzeilen: ${F.length} Befund(e)`); F.slice(0, 30).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log(`schlagzeilen: ok (${zeilen} Zeilen auf Dashboard, News, Asset-Seite; ${schmal} in schmalen Listen mit Quelle/Zeit unter dem Titel; jeder Titel >= halbe Zeile)`);
})();
