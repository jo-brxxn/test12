// ── ZENTRALBANK-KARTE: NOTIZEN JE SITZUNG, REGEL, BANNER, ARCHIV ──────────
// Nutzer 2026-10-27: Karte "Central bank" auf jeder Asset-Seite (Gebaeude mit
// drei Saeulen Inflation / Labour market / Economy, Notizen je Saeule, roter
// Banner nach dem Zinsentscheid, Archiv frueherer Sitzungen) - "Auch die
// Notizen muessen sicher zuverlaessig gespeichert werden". Code:
// js/zentralbank.js. Die Notizen sind normale research.notes mit Feld cb.
//
// Geprueft:
//   A) Karte auf allen 8 Waehrungen (eigene Bank, Flagge) und auf Non-FX
//      (verknuepfte Bank)
//   B) Notiz per Eingabe + Enter: steht in der Karte, in research.notes mit
//      cb {b,s,m=letzte Sitzung}, im gespeicherten Stand (localStorage) und
//      nach dem NEULADEN wieder in der Karte
//   C) Regel der Asset-Verknuepfung: dieselbe USD-Notiz ist auf GOLD in der
//      Inflations-Saeule (inverse) umgekehrt gefaerbt, in Economy (same)
//      nicht; eine auf GOLD eingegebene Notiz wird in USD-Sicht gespeichert
//   D) Banner: steht ohne Notiz der aktuellen Sitzung, weg nach der ersten
//      Notiz; ✕ haelt ueber das Neuladen (zbQuittung im Speicher)
//   E) Snapshot-Runde (snap -> applySnap): cb-Feld bleibt
//   F) Tippen waehrend die Asset-Seite neu gezeichnet wird: Text und Fokus bleiben
//   G) Loeschen = Papierkorb
//   H) Archiv: Uhr hinter die naechste Sitzung gestellt -> Saeulen leer,
//      Archiv zaehlt 1, Fenster zeigt die Notizen unter dem Sitzungsdatum
// Gegenproben (muessen ROT werden):
//   --gegenprobe-regel     Asset-Regel wird ignoriert            -> C rot
//   --gegenprobe-speichern neue Notiz wird nicht gespeichert     -> B rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP_REGEL = process.argv.includes('--gegenprobe-regel');
const GP_SPEICHERN = process.argv.includes('--gegenprobe-speichern');
const GP = GP_REGEL || GP_SPEICHERN;
const F = []; const rot = (t, x) => { F.push(`${t}: ${x}`); console.log(`  ✗ ${t}: ${x}`); };
const gruen = t => console.log('  ✓ ' + t);

async function oeffnen(ctx, id) {
  const p = await ctx.newPage();
  p.on('pageerror', e => rot('JS-FEHLER', String(e.message || e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(id => {
    ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); });
    gotoSym(id);
  }, id);
  await p.waitForTimeout(900);
  return p;
}
const karte = p => p.evaluate(() => {
  const k = document.getElementById('zbKarte'); if (!k) return null;
  const s = [...k.querySelectorAll('.zb-saeulen .zb-s')].map(x => ({
    t: (x.querySelector('.zb-s-t') || {}).textContent, inv: !!x.querySelector('.zb-s-inv'),
    n: [...x.querySelectorAll('.zb-n')].map(n => ({ tx: (n.querySelector('.zb-n-tx') || {}).textContent, farbe: getComputedStyle(n).borderLeftColor })) }));
  return { name: (k.querySelector('.zb-name') || {}).textContent, flagge: !!k.querySelector('.zb-tafel use'), banner: !!k.querySelector('.zb-banner'),
    archiv: +(((k.querySelector('.zb-arch b') || {}).textContent) || 0), saeulen: s, ohne: !!k.querySelector('.zb-nolink') };
});
const farbe = (p, b) => p.evaluate(b => { const d = document.createElement('div'); d.style.color = `var(--bias-${b})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, b);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  // Gegenproben-Schalter per Init-Skript: sie muessen jedes Neuladen ueberleben.
  await ctx.addInitScript(([gpR, gpS]) => {
    try { localStorage.setItem('fxpro_help_seen', '1'); } catch (e) {}
    if (gpR) window.__gpZbKeineRegel = true;
    if (gpS) window.__gpZbOhneSave = true;
  }, [GP_REGEL, GP_SPEICHERN]);

  // ── A ──
  console.log('A) Karte auf jeder Asset-Seite');
  let p = await oeffnen(ctx, 'USD');
  const namen = { USD: 'Federal Reserve', EUR: 'European Central Bank', GBP: 'Bank of England', JPY: 'Bank of Japan', CHF: 'Swiss National Bank', CAD: 'Bank of Canada', AUD: 'Reserve Bank of Australia', NZD: 'Reserve Bank of New Zealand', GOLD: 'Federal Reserve', SP500: 'Federal Reserve' };
  for (const [id, n] of Object.entries(namen)) {
    await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(250);
    const k = await karte(p);
    if (!k) { rot('A KARTE', `${id}: keine Zentralbank-Karte`); continue; }
    if (k.name !== n) rot('A NAME', `${id}: "${k.name}" statt "${n}"`);
    if (!k.flagge) rot('A FLAGGE', `${id}: keine Flagge im Medaillon`);
    if (k.saeulen.map(x => x.t).join('|') !== 'Inflation|Labour market|Economy') rot('A SAEULEN', `${id}: ${k.saeulen.map(x => x.t).join('|')}`);
  }
  if (!F.length) gruen(`${Object.keys(namen).length} Assets: Name, Flagge, drei Saeulen`);

  // ── B + D ──
  console.log('B) Speichern + Neuladen, D) Banner');
  await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(300);
  let k = await karte(p);
  const vorher = k.saeulen[0].n.length;
  const bannerVorher = k.banner;
  const TX = 'Prueftext Inflation ' + Date.now();
  await p.click('#zbKarte .zb-s:nth-child(1) .zb-w-bull');
  await p.fill('#zbIn-infl', TX); await p.press('#zbIn-infl', 'Enter'); await p.waitForTimeout(400);
  k = await karte(p);
  const sitz = await p.evaluate(() => { const s = zbSitzungen('USD'); return s.letzte ? s.letzte.d : null; });
  const nr = await p.evaluate(tx => (research.notes || []).find(n => n.title === tx) || null, TX);
  if (!k.saeulen[0].n.some(n => n.tx === TX)) rot('B KARTE', 'neue Notiz steht nicht in der Inflations-Saeule');
  if (!nr || !nr.cb || nr.cb.b !== 'USD' || nr.cb.s !== 'infl' || nr.cb.m !== sitz) rot('B DATEN', `research.notes: ${JSON.stringify(nr && nr.cb)} (erwartet USD/infl/${sitz})`);
  if (nr && nr.bias !== 'bull') rot('B BIAS', `gespeichert ${nr.bias} statt bull`);
  await p.waitForTimeout(600);
  const platte = await p.evaluate(tx => (localStorage.getItem('fxpro_v1') || '').includes(tx), TX);
  if (!platte) rot('B SPEICHER', 'Notiz steht nicht im gespeicherten Stand (localStorage)');
  if (bannerVorher && vorher === 0 && k.banner) rot('D BANNER', 'Banner steht nach der ersten Notiz noch da');
  await p.reload(); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('USD'); }); await p.waitForTimeout(700);
  k = await karte(p);
  if (!k || !k.saeulen[0].n.some(n => n.tx === TX)) rot('B NEULADEN', 'Notiz nach dem Neuladen nicht mehr in der Karte');
  else gruen('Notiz in Karte, research.notes (cb USD/infl/' + sitz + '), Speicher und nach dem Neuladen');
  // ✕ auf einer anderen Bank haelt ueber das Neuladen
  await p.evaluate(() => gotoSym('CAD')); await p.waitForTimeout(300);
  k = await karte(p);
  if (k.banner && !k.saeulen.some(s => s.n.length)) {
    await p.click('#zbKarte .zb-banner-x'); await p.waitForTimeout(400);
    await p.reload(); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('CAD'); }); await p.waitForTimeout(600);
    k = await karte(p);
    if (k.banner) rot('D QUITTUNG', 'CAD-Banner nach ✕ und Neuladen wieder da');
    else gruen('Banner weg nach erster Notiz; ✕ haelt ueber das Neuladen');
  } else gruen('Banner weg nach erster Notiz (CAD ohne Banner - ✕ nicht pruefbar)');

  // ── C ──
  console.log('C) Regel der Verknuepfung (GOLD: Inflation inverse, Economy same)');
  const [bull, bear] = [await farbe(p, 'bull'), await farbe(p, 'bear')];
  await p.evaluate(() => gotoSym('GOLD')); await p.waitForTimeout(400);
  k = await karte(p);
  const gi = k.saeulen[0].n.find(n => n.tx === TX);
  if (!k.saeulen[0].inv) rot('C REGEL', 'Inflation auf GOLD nicht als inverse markiert');
  if (!gi) rot('C NOTIZ', 'USD-Notiz fehlt auf GOLD (gleiche Bank)');
  else if (gi.farbe !== bear) rot('C FARBE', `USD bullish -> auf GOLD ${gi.farbe}, erwartet bearish ${bear}`);
  if (k.saeulen[2].inv) rot('C REGEL', 'Economy auf GOLD faelschlich inverse');
  const TX2 = 'Gold bullish Inflation ' + Date.now();
  await p.click('#zbKarte .zb-s:nth-child(1) .zb-w-bull');
  await p.fill('#zbIn-infl', TX2); await p.press('#zbIn-infl', 'Enter'); await p.waitForTimeout(400);
  const n2 = await p.evaluate(tx => (research.notes || []).find(n => n.title === tx) || null, TX2);
  if (!n2 || n2.bias !== 'bear') rot('C SPEICHERSICHT', `auf GOLD bullish eingegeben -> gespeichert ${n2 && n2.bias} (erwartet bear in USD-Sicht)`);
  if (!F.some(f => /^C /.test(f))) gruen('USD bullish = GOLD bearish (Inflation), Economy unveraendert, Eingabe auf GOLD in USD-Sicht gespeichert');

  // ── E ──
  console.log('E) Snapshot-Runde');
  const e = await p.evaluate(tx => { applySnap(snap()); const n = (research.notes || []).find(x => x.title === tx); return n && n.cb ? n.cb.b + '/' + n.cb.s + '/' + n.cb.m : null; }, TX);
  if (!e) rot('E SNAPSHOT', 'cb-Feld nach snap -> applySnap weg'); else gruen('cb bleibt ueber snap -> applySnap (' + e + ')');

  // ── F ──
  console.log('F) Tippen waehrend Neuzeichnen');
  await p.evaluate(() => gotoSym('EUR')); await p.waitForTimeout(300);
  await p.click('#zbIn-arb'); await p.keyboard.type('halb getippt');
  await p.evaluate(() => renderDetail()); await p.waitForTimeout(150);
  const f = await p.evaluate(() => { const el = document.getElementById('zbIn-arb'); return { v: el && el.value, fokus: document.activeElement === el }; });
  if (f.v !== 'halb getippt' || !f.fokus) rot('F ENTWURF', `nach renderDetail: Text "${f.v}", Fokus ${f.fokus}`); else gruen('Text und Fokus bleiben beim Neuzeichnen');
  await p.keyboard.press('Escape');

  // ── G ──
  console.log('G) Loeschen = Papierkorb');
  await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(300);
  p.once('dialog', d => d.accept());
  const g = await p.evaluate(async tx2 => {
    const n = research.notes.find(x => x.title === tx2); if (!n) return 'fehlt';
    zbWeg(n.id); await new Promise(r => setTimeout(r, 200));
    const weg = !research.notes.some(x => x.id === n.id), korb = (research.trash || []).some(t => t.data && t.data.id === n.id);
    return weg && korb ? 'ok' : `weg ${weg}, Papierkorb ${korb}`;
  }, TX2);
  if (g !== 'ok') rot('G PAPIERKORB', g); else gruen('geloeschte Notiz liegt im Papierkorb');
  await p.close();

  // ── H ── Uhr hinter die naechste USD-Sitzung
  console.log('H) Archiv nach der naechsten Sitzung');
  const naechste = await (async () => { const q = await oeffnen(ctx, 'USD'); const d = await q.evaluate(() => { const s = zbSitzungen('USD'); return s.naechste ? s.naechste.d : null; }); await q.close(); return d; })();
  if (!naechste) rot('H TERMIN', 'keine naechste Fed-Sitzung im Kalender - Archiv nicht pruefbar');
  else {
    const q = await ctx.newPage();
    q.on('pageerror', e => rot('JS-FEHLER', String(e.message || e)));
    await q.clock.install({ time: new Date(naechste + 'T23:30:00') });
    await q.goto(URL); await wartenBisDatenDa(q);
    await q.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); gotoSym('USD'); }); await q.waitForTimeout(700);
    k = await karte(q);
    const h = await q.evaluate(() => { const s = zbSitzungen('USD'); return s.letzte && s.letzte.d; });
    if (h !== naechste) rot('H SITZUNG', `letzte Sitzung ${h} statt ${naechste}`);
    if (k.saeulen.some(s => s.n.length)) rot('H LEER', `Saeulen nach der neuen Sitzung nicht leer: ${k.saeulen.map(s => s.n.length).join('/')}`);
    if (k.archiv < 1) rot('H ARCHIV', `Archiv-Zaehler ${k.archiv}`);
    if (!k.banner) rot('H BANNER', 'kein Banner nach der neuen Sitzung');
    await q.click('#zbKarte .zb-arch'); await q.waitForTimeout(300);
    const a = await q.evaluate(tx => { const b = document.getElementById('zbArchivBody'); const m = document.getElementById('mZbArchiv');
      return { offen: m && getComputedStyle(m).display !== 'none', text: b ? b.textContent : '', tage: b ? b.querySelectorAll('.zb-a-tag').length : 0, drin: b ? b.textContent.includes(tx) : false }; }, TX);
    if (!a.offen || !a.drin) rot('H FENSTER', `Archiv offen ${a.offen}, Notiz darin ${a.drin} (${a.tage} Sitzungen)`);
    if (!F.some(f => /^H /.test(f))) gruen(`Uhr auf ${naechste}: Saeulen leer, Banner da, Archiv ${k.archiv} Sitzung(en), Notiz im Fenster`);
    await q.close();
  }

  await b.close();
  if (GP) { if (F.length) { console.log(`\nGegenprobe ok: ${F.length} Befund(e), wie erwartet rot.`); process.exit(0); } console.log('\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(1); }
  if (F.length) { console.log(`\nzentralbank: ${F.length} Befund(e).`); process.exit(1); }
  console.log('\nzentralbank: ok (Karte auf allen Assets, Speichern + Neuladen, Regel inverse, Banner + Quittung, Snapshot, Entwurf, Papierkorb, Archiv nach neuer Sitzung)');
})().catch(e => { console.log('zentralbank: ABBRUCH ' + (e && e.stack || e)); process.exit(2); });
