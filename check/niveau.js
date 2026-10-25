// ── NIVEAU-BLOCK: SEIT MODELL 28 KOMPLETT ENTFERNT ─────────────────────────
//
// Modell 22-27 hatte Zeilen "wie steht die Zahl gegen ihr Normal" (Inflation
// vs Target, Unemployment vs Normal, Wages vs Normal ...). Nutzer 2026-10-25:
// "Entfern bitte komplett den indikator inflation vs target" und "inflation
// vs ziel komplett raus und arbeitslosigkeit vs normal und loehne vs normal
// auch raus" (Modell 28, docs/score-model.md).
// Dieser Waechter prueft, dass KEINE dieser Zeilen mehr irgendwo steht - auch
// nicht aus einem gespeicherten Stand eines Geraets, der vor Modell 28 lag:
// er spielt einen alten Stand mit den drei Zeilen ein und verlangt, dass der
// naechste Feed-Durchlauf sie entfernt.
//   node check/niveau.js [--gegenprobe]   (Aufraeumen abgeschaltet -> muss rot werden)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const WEG = ['Real Rate vs Peers', 'Growth vs Trend', 'PMI vs 50', 'Rate Path vs Peers', 'Inflation Trend (3M)', 'Unemployment Trend (3M)', 'Consumer Confidence Trend (3M)',
  'Inflation vs Target', 'Unemployment vs Normal', 'Wages vs Normal'];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })).newPage();
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);

  // A) Nach dem Start steht keine der Zeilen an irgendeinem Asset.
  const jetzt = await p.evaluate(W => syms.flatMap(s => (s.rubrics || []).flatMap(r => (r.indicators || []).filter(i => W.includes(i.name)).map(i => s.id + ' ' + i.name))), WEG);
  if (jetzt.length) fail('ZEILE STEHT NOCH', jetzt.slice(0, 5).join(', '));

  // B) Ein alter Stand (vor Modell 28) mit den drei Zeilen: der naechste Feed-
  //    Durchlauf muss sie entfernen und der Score darf sie nicht zaehlen.
  const alt = await p.evaluate(gp => {
    const out = { vorher: 0, nachher: [], punkte: 0 };
    ['USD', 'EUR', 'GBP', 'GOLD'].forEach(id => {
      const s = syms.find(x => x.id === id); if (!s) return;
      [['Inflation', 'Inflation vs Target', 'infl'], ['Labour Market', 'Unemployment vs Normal', 'lab'], ['Labour Market', 'Wages vs Normal', 'wage']].forEach(([rn, n, t]) => {
        const r = (s.rubrics || []).find(x => x.name === rn); if (!r) return;
        r.indicators.push({ id: 'chk' + id + t, name: n, bias: 'bull', imp: false, date: '', interval: '', points: [], pkt: 0.75, research: { actual: '+1.0pp', niveau: t, source: 'ind_data.json' } });
        out.vorher++;
      });
    });
    if (!gp) applyNiveauFeed();
    syms.forEach(s => (s.rubrics || []).forEach(r => (r.indicators || []).forEach(i => {
      if (['Inflation vs Target', 'Unemployment vs Normal', 'Wages vs Normal'].includes(i.name)) { out.nachher.push(s.id + ' ' + i.name); out.punkte += indScore(i, r); }
    })));
    return out;
  }, GEGENPROBE);
  if (!alt.vorher) fail('TESTAUFBAU', 'keine alte Zeile eingespielt');
  if (alt.nachher.length) fail('ALTER STAND NICHT AUFGERAEUMT', `${alt.nachher.length} Zeile(n), zusammen ${Math.round(alt.punkte * 100) / 100} Punkte: ${alt.nachher.slice(0, 4).join(', ')}`);

  perr.forEach(x => fail('JS-FEHLER', x));
  await b.close();
  if (GEGENPROBE) { if (F.length) { console.log(`niveau --gegenprobe: ok (rot wie erwartet, ${F.length} Befund(e))`); process.exit(0); } console.log('niveau --gegenprobe: FEHLER - Waechter bleibt gruen'); process.exit(1); }
  if (F.length) { console.log(`niveau: ${F.length} Befund(e)`); F.forEach(f => console.log('  ' + f)); process.exit(1); }
  console.log(`niveau: ok (Niveau-Block seit Modell 28 weg: keine Zeile an keinem Asset, ${alt.vorher} Zeilen aus einem alten Stand beim naechsten Feed-Durchlauf entfernt)`);
})().catch(e => { console.log('niveau: ABBRUCH ' + e.message); process.exit(1); });
