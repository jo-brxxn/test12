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
//   B) Notiz wie bei Pinned notes (seit 2026-10-27): "＋ New note…" oeffnet
//      das volle Notizfenster mit Bank-Zeile, ohne Places/Pinned; nach Save
//      steht sie in der Karte (.ab-nt-Zeile), in research.notes mit cb
//      {b,s,m=letzte Sitzung}, im gespeicherten Stand (localStorage) und nach
//      dem NEULADEN wieder in der Karte
//   C) Regel der Asset-Verknuepfung: dieselbe USD-Notiz ist auf GOLD in der
//      Inflations-Saeule (inverse) umgekehrt gefaerbt, in Economy (same)
//      nicht; eine auf GOLD eingegebene Notiz wird in USD-Sicht gespeichert
//   D) Banner (rote oberste Stufe): steht ohne Notiz der aktuellen Sitzung,
//      weg nach der ersten Notiz; ✕ haelt ueber das Neuladen (zbQuittung im
//      Speicher); Karte mit und ohne gleich hoch
//   E) Snapshot-Runde (snap -> applySnap): cb-Feld bleibt
//   F) Fenster in Asset-Sicht: die USD-Notiz (bullish) oeffnet auf GOLD mit
//      Bearish, unveraendert gespeichert bleibt sie bullish; ▲▼ sortiert
//   G) Loeschen ueber das Fenster = Papierkorb
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
    n: [...x.querySelectorAll('.ab-nt')].map(n => ({ tx: (n.querySelector('.ab-nt-ti') || {}).textContent, farbe: getComputedStyle(n).borderLeftColor })) }));
  return { name: (k.querySelector('.zb-name') || {}).textContent, flagge: !!k.querySelector('.zb-tafel use'), banner: !!k.querySelector('.zb-banner'),
    archiv: +(((k.querySelector('.zb-arch b') || {}).textContent) || 0), saeulen: s, ohne: !!k.querySelector('.zb-nolink') };
});
async function neueNotiz(p, saeule, titel, bias) {
  await p.click(`#zbKarte .zb-s:nth-child(${saeule}) .ab-nt-neu`);
  await p.waitForTimeout(250);
  const f = await p.evaluate(() => { const z = document.getElementById('resNZb'), pl = document.getElementById('resNPlacesBox'), pin = document.getElementById('resNPinRow'), m = document.getElementById('mResNote');
    const sicht = e => !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
    return { offen: sicht(m), zeile: sicht(z) ? z.textContent : '', places: sicht(pl), pin: sicht(pin), kopf: (document.getElementById('resNKopf') || {}).textContent }; });
  await p.fill('#resNTitle', titel);
  await p.click({ bull: '#resNBiasBull', neu: '#resNBiasNeu', bear: '#resNBiasBear' }[bias]);
  await p.click('#mResNote .m-btns .btn.g'); await p.waitForTimeout(400);
  return f;
}
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
    if (k.saeulen.map(x => x.t).join('|') !== 'Inflation|Labour market|Economy|General') rot('A SAEULEN', `${id}: ${k.saeulen.map(x => x.t).join('|')}`);
  }
  if (!F.length) gruen(`${Object.keys(namen).length} Assets: Name, Flagge, vier Saeulen`);

  // A2: Aufteilung und Bauform (Nutzer 2026-10-27). Seit 642: die vier
  // Knoepfe als Zeile UEBER der Karte, Karte volle Breite, Knopftext mittig;
  // Dachspitze auf Hoehe der Titelmitte ("die Spitze des Dachs auf der
  // gleichen Hoehe wie der Kartentitel"), kein Kopf-Element liegt auf dem
  // Dach; Kapitelle ohne Luecke am Architrav ("Saeulen und das Dach muessen
  // verbunden sein", 641), benachbarte Voluten beruehren sich nicht.
  const fa = F.length;
  const bau = await p.evaluate(() => { const B = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const k = B('#zbKarte'), q = B('.ab-qrow'), a = B('.zb-architrav'), g = B('#zbKarte .zb-giebel'), t = B('#zbKarte .ab-tile-t');
    const kap = [...document.querySelectorAll('#zbKarte .zb-kap')].map(e => e.getBoundingClientRect());
    const v = [...document.querySelectorAll('#zbKarte .zb-vol')].map(e => e.getBoundingClientRect()); const ab = []; for (let i = 1; i + 1 < v.length; i += 2) ab.push(Math.round(v[i + 1].left - v[i].right));
    const mitte = [...document.querySelectorAll('.ab-qrow .aql')].map(b => { const r = b.getBoundingClientRect(), kids = [...b.children].map(c => c.getBoundingClientRect()).filter(c => c.width);
      return Math.round(Math.abs((kids[0].left - r.left) - (r.right - kids[kids.length - 1].right))); });
    let frei = null;
    if (g) { const cx = g.left + g.width / 2, yDach = x => g.top + g.height * (3 + 117 * Math.min(1, Math.abs(x - cx) / (g.width / 2))) / 120;
      frei = Math.min(...[...document.querySelectorAll('#zbKarte>.ab-tile-hd>*')].map(e => e.getBoundingClientRect()).filter(r => r.width).map(r => yDach(Math.min(Math.max(cx, r.left), r.right)) - r.bottom)); }
    return { ueber: !!(k && q && q.bottom <= k.top + 1), breit: k && q ? Math.round(q.width - k.width) : null, mitte, spitze: g && t ? Math.round(g.top + g.height * 3 / 120 - (t.top + t.height / 2)) : null, frei: frei === null ? null : Math.round(frei),
      luecke: a ? kap.map(r => Math.round(r.top - a.bottom)) : null, voluten: ab }; });
  if (!bau.ueber) rot('A2 KNOEPFE', 'Knopfzeile steht nicht ueber der Karte');
  if (bau.breit === null || Math.abs(bau.breit) > 2) rot('A2 BREITE', `Karte ${bau.breit} px schmaler als die Knopfzeile (soll volle Breite)`);
  if (!bau.mitte.length || bau.mitte.some(x => x > 2)) rot('A2 KNOPFTEXT', `Inhalt nicht mittig: links/rechts-Differenz ${bau.mitte.join('/')} px`);
  if (bau.spitze === null || Math.abs(bau.spitze) > 2) rot('A2 DACHSPITZE', `Dachspitze ${bau.spitze} px neben der Titelmitte`);
  if (bau.frei === null || bau.frei < 4) rot('A2 KOPF', `Kopf-Element liegt auf dem Dach (Abstand ${bau.frei} px)`);
  if (!bau.luecke) rot('A2 ARCHITRAV', 'kein .zb-architrav - Saeulen haengen nicht am Dach');
  else if (bau.luecke.some(x => Math.abs(x) > 1)) rot('A2 VERBUNDEN', `Luecke Architrav -> Kapitell ${bau.luecke.join('/')} px`);
  if (bau.voluten.some(x => x < 4)) rot('A2 VOLUTEN', `Abstand benachbarter Voluten ${bau.voluten.join('/')} px (< 4 = sie stossen aneinander)`);
  // A3 (seit 644, vierte Saeule General): bei 1180 px (iPad quer) sind die
  // Saeulen 228 px schmal; GOLD hat inverse-Chips -> zweizeilige Koepfe. Alle
  // Titel und Farblinien einer Reihe auf gleicher Hoehe (subgrid), kein Schaft
  // breiter als seine Saeule (eine auto-Spalte schob die Volute 5 px in die
  // Nachbarsaeule), Karte so hoch wie auf EUR (ohne Chips).
  await p.setViewportSize({ width: 1180, height: 900 });
  const mess3 = id => p.evaluate(async i => { gotoSym(i); await new Promise(r => setTimeout(r, 600));
    const s = [...document.querySelectorAll('#zbKarte .zb-s')];
    return { h: Math.round(document.getElementById('zbKarte').getBoundingClientRect().height), chips: document.querySelectorAll('#zbKarte .zb-s-inv').length,
      titel: [...new Set(s.map(x => Math.round(x.querySelector('.zb-s-t').getBoundingClientRect().top)))], linie: [...new Set(s.map(x => Math.round(x.querySelector('.zb-s-hd').getBoundingClientRect().bottom)))],
      breiter: s.filter(x => x.querySelector('.zb-schaft').getBoundingClientRect().right > x.getBoundingClientRect().right + 1).map(x => x.querySelector('.zb-s-t').textContent) }; }, id);
  const g3 = await mess3('GOLD'), e3 = await mess3('EUR');
  // schmalste Breite mit vier Saeulen nebeneinander (192 px): dort lief der Schaft ueber
  await p.setViewportSize({ width: 1024, height: 900 });
  const g4 = await mess3('GOLD');
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);
  if (g4.breiter.length) rot('A3 SCHAFT', `GOLD 1024 px: Schaft breiter als die Saeule bei ${g4.breiter.join(', ')}`);
  if (g4.titel.length > 1 || g4.linie.length > 1) rot('A3 KOPF', `GOLD 1024 px: Titel auf ${g4.titel.join('/')} px, Farblinien auf ${g4.linie.join('/')} px`);
  if (!g3.chips) rot('A3 TESTAUFBAU', 'GOLD ohne inverse-Chip - Kopfhoehe nicht pruefbar');
  if (g3.titel.length > 1 || g3.linie.length > 1) rot('A3 KOPF', `GOLD 1180 px: Titel auf ${g3.titel.join('/')} px, Farblinien auf ${g3.linie.join('/')} px - nicht auf einer Hoehe`);
  if (g3.breiter.length) rot('A3 SCHAFT', `GOLD 1180 px: Schaft breiter als die Saeule bei ${g3.breiter.join(', ')}`);
  if (Math.abs(g3.h - e3.h) > 1) rot('A3 HOEHE', `Karte GOLD ${g3.h} px, EUR ${e3.h} px (1180 px) - soll gleich hoch sein`);
  if (F.length === fa) gruen(`Knoepfe ueber der Karte, volle Breite, Text mittig; Dachspitze ${bau.spitze} px zur Titelmitte, Kopf ${bau.frei} px ueber dem Dach; Kapitelle am Architrav, Voluten ${bau.voluten.join('/')} px auseinander; 1180 px GOLD: Koepfe auf einer Linie, Karte ${g3.h} = EUR ${e3.h} px`);

  // ── B + D ──
  console.log('B) Speichern + Neuladen, D) Banner');
  await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(300);
  let k = await karte(p);
  const vorher = k.saeulen[0].n.length;
  const bannerVorher = k.banner;
  const TX = 'Prueftext Inflation ' + Date.now();
  const fen = await neueNotiz(p, 1, TX, 'bull');
  if (!fen.offen) rot('B FENSTER', '"＋ New note…" oeffnet das Notizfenster nicht');
  if (!/Federal Reserve/.test(fen.zeile) || !/Inflation/.test(fen.zeile)) rot('B KONTEXT', `Bank-Zeile im Fenster: "${fen.zeile}"`);
  if (fen.kopf !== 'Central bank note') rot('B KOPF', `Fenstertitel "${fen.kopf}" - "Archive" heisst auf der Karte die Sitzungsliste`);
  if (fen.places || fen.pin) rot('B FENSTER', `Places ${fen.places}, Pinned ${fen.pin} sichtbar - bei einer Bank-Notiz ohne Wirkung`);
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
    // Erinnerung = rote oberste Stufe (seit 642): die Karte ist mit und ohne
    // gleich hoch, sie steht unten im Gebaeude statt ueber dem Dach
    const hMit = await p.evaluate(() => ({ h: document.getElementById('zbKarte').getBoundingClientRect().height, stufe: !!document.querySelector('#zbKarte .zb-stufen .zb-banner') }));
    await p.click('#zbKarte .zb-banner-x'); await p.waitForTimeout(400);
    const hOhne = await p.evaluate(() => document.getElementById('zbKarte').getBoundingClientRect().height);
    if (!hMit.stufe) rot('D STUFE', 'Erinnerung steht nicht in den Stufen des Gebaeudes');
    if (Math.abs(hMit.h - hOhne) > 1) rot('D HOEHE', `Karte mit Erinnerung ${Math.round(hMit.h)} px, ohne ${Math.round(hOhne)} px`);
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
  // General folgt der Regel der Zins-Karte (Interest Rates: GOLD inverse)
  if (!k.saeulen[3] || !k.saeulen[3].inv) rot('C REGEL', 'General auf GOLD nicht als inverse markiert (Regel Interest Rates)');
  const TX2 = 'Gold bullish Inflation ' + Date.now();
  await neueNotiz(p, 1, TX2, 'bull');
  const n2 = await p.evaluate(tx => (research.notes || []).find(n => n.title === tx) || null, TX2);
  if (!n2 || n2.bias !== 'bear') rot('C SPEICHERSICHT', `auf GOLD bullish eingegeben -> gespeichert ${n2 && n2.bias} (erwartet bear in USD-Sicht)`);
  if (!F.some(f => /^C /.test(f))) gruen('USD bullish = GOLD bearish (Inflation), General inverse wie Interest Rates, Economy unveraendert, Eingabe auf GOLD in USD-Sicht gespeichert');

  // ── E ──
  console.log('E) Snapshot-Runde');
  const e = await p.evaluate(tx => { applySnap(snap()); const n = (research.notes || []).find(x => x.title === tx); return n && n.cb ? n.cb.b + '/' + n.cb.s + '/' + n.cb.m : null; }, TX);
  if (!e) rot('E SNAPSHOT', 'cb-Feld nach snap -> applySnap weg'); else gruen('cb bleibt ueber snap -> applySnap (' + e + ')');

  // ── F ── Fenster in Asset-Sicht + Sortieren
  console.log('F) Fenster in Asset-Sicht, Sortieren');
  await p.evaluate(() => gotoSym('GOLD')); await p.waitForTimeout(300);
  const f = await p.evaluate(async tx => {
    const n = research.notes.find(x => x.title === tx); if (!n) return { fehlt: true };
    openResNote(n.id); await new Promise(r => setTimeout(r, 200));
    const an = ['Bull', 'Neu', 'Bear'].find(b => document.getElementById('resNBias' + b).classList.contains('on'));
    saveResNote(); await new Promise(r => setTimeout(r, 300));
    return { an, danach: research.notes.find(x => x.id === n.id).bias };
  }, TX);
  if (f.fehlt) rot('F NOTIZ', 'USD-Notiz nicht gefunden');
  else { if (f.an !== 'Bear') rot('F SICHT', `USD bullish oeffnet auf GOLD mit ${f.an} (erwartet Bear)`); if (f.danach !== 'bull') rot('F RUECKWEG', `unveraendert gespeichert -> ${f.danach} (erwartet bull)`); }
  await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(300);
  const TX3 = 'Zweite Notiz ' + Date.now();
  await neueNotiz(p, 1, TX3, 'neu');
  let r1 = (await karte(p)).saeulen[0].n.map(n => n.tx);
  const pos = r1.indexOf(TX3);
  await p.evaluate(tx => { const n = research.notes.find(x => x.title === tx); zbVerschieben(n.id, 1); }, TX3); await p.waitForTimeout(300);
  const r2 = (await karte(p)).saeulen[0].n.map(n => n.tx);
  if (pos !== 0) rot('F NEU OBEN', `neue Notiz an Stelle ${pos + 1} (wie Pinned notes oben erwartet)`);
  else if (r2.indexOf(TX3) !== 1) rot('F SORTIEREN', `▼ verschiebt nicht: ${r2.join(' | ')}`);
  if (!F.some(x => /^F /.test(x))) gruen('USD bullish = Bearish im GOLD-Fenster, unveraendert gespeichert bleibt bullish; neu = oben, ▼ verschiebt');

  // ── G ──
  console.log('G) Loeschen = Papierkorb');
  await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(300);
  p.on('dialog', d => d.accept());
  const g = await p.evaluate(async tx2 => {
    const n = research.notes.find(x => x.title === tx2); if (!n) return 'fehlt';
    openResNote(n.id); await new Promise(r => setTimeout(r, 150));
    delResNote(); await new Promise(r => setTimeout(r, 250));
    const weg = !research.notes.some(x => x.id === n.id), korb = (research.trash || []).some(t => t.data && t.data.id === n.id);
    return weg && korb ? 'ok' : `weg ${weg}, Papierkorb ${korb}`;
  }, TX3);
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
