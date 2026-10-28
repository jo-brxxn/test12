// ══ WAECHTER: GELOESCHTES BLEIBT GELOESCHT ═══════════════════════════════
//
// Nutzer 2026-10-28: "Fast immer nach fast jeder Aenderung die du machst ist
// es so das wenn man Sachen umschaltet oder loescht das sie wenige Sekunden
// spaeter einfach wieder erscheinen oder zurueckspringen zB wenn ich eine
// Notiz in der Bank Karte loesche kommt sie direkt wieder zurueck".
//
// GEMESSEN vorher (zwei Geraete, nachgestellte Cloud): Bank-Notiz auf Geraet
// A geloescht -> nach dem naechsten Abgleich (A pusht, findet die Cloud
// veraendert, zieht sie) stand sie auf A sofort wieder da, und A lud sie
// selbst wieder hoch. Ursache: Notizen, Ordner und Papierkorb wurden bei
// jedem passiven Abgleich (Cloud, anderer Tab, Speichern gegen die Platte)
// VEREINIGT - ohne Loesch-Marker. Jede Kopie irgendwo (Cloud, zweites
// Geraet, zweiter Tab) brachte eine Loeschung zurueck; der korrekte
// Drei-Wege-Abgleich wurde danach von der Vereinigung wieder ueberstimmt.
// Nach jeder Auslieferung laedt jedes offene Geraet neu und gleicht ab -
// deshalb "nach fast jeder Aenderung".
//
// Geprueft:
//   A) ZWEI GERAETE: auf A Bank-Notiz loeschen, Notiz im Notizfenster
//      loeschen, Ordner loeschen, Papierkorb-Eintrag wiederherstellen und
//      endgueltig loeschen; danach Undo eines Anlegens und eines Loeschens.
//      Nach mehreren Abgleich-Runden (B zieht, B pusht automatisch, B hat
//      eine eigene Eingabe, A und B ziehen) muss auf A, auf B UND in der
//      Cloud genau der gewollte Stand stehen. Unangetastete Notizen bleiben
//      (kein falsches Loeschen).
//   B) ZWEI TABS, EIN GERAET: Loeschen in Tab 1, Tab 2 speichert danach
//      eine eigene Eingabe -> die Notiz bleibt in beiden Tabs und auf der
//      Platte weg.
//   C) ZEITSTEMPEL: jede Aenderung an einer Notiz/einem Ordner bekommt
//      beim Speichern einen neuen Stempel (up), auch wenn die
//      Bearbeitungsfunktion ihn vergisst (z. B. Reihenfolge per Pfeil) -
//      sonst gewinnt beim Abgleich die aeltere Fassung.
//   D) STATISCH: die Vereinigungen (mergeResearchNotes/-Folders/-Trash)
//      laufen nur ueber researchVereinen(), also immer mit Loesch-Markern.
// Gegenproben (muessen ROT werden):
//   --gegenprobe          Loesch-Marker wirkungslos      -> A und B rot
//   --gegenprobe-stempel  kein Nachstempeln beim Speichern -> C rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_STEMPEL = process.argv.includes('--gegenprobe-stempel');
const FAKE = 'https://geloescht-cloud.invalid';
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE_FILTER = 'function ohneGeloeschte(liste,p,g){';
const MARKE_STEMPEL = 'else if(a&&s&&gelStempel(x)===a.up&&s!==a.s){';

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);
const warte = ms => new Promise(r => setTimeout(r, ms));

// ── D) statisch ─────────────────────────────────────────────────────────
console.log('D) Vereinigungen nur mit Loesch-Markern');
{
  const ohneKommentar = MAIN.replace(/\/\/[^\n]*/g, '');
  const def = /function researchVereinen\(/.test(ohneKommentar);
  if (!def) rot('researchVereinen() fehlt');
  const m = ohneKommentar.match(/function researchVereinen\([^)]*\)\{[\s\S]*?\n\}/);
  const koerper = m ? m[0] : '';
  const aufrufe = [];
  ohneKommentar.split('\n').forEach((z, i) => {
    if (/merge(ResearchNotes|ResearchFolders|ResearchTrash)\(/.test(z) && !/^function merge/.test(z.trim()) && !koerper.includes(z)) aufrufe.push(i + 1);
  });
  if (aufrufe.length) rot('Vereinigung ohne Loesch-Marker (ausserhalb researchVereinen), Zeilen: ' + aufrufe.join(', '));
  else if (def) gruen('mergeResearchNotes/-Folders/-Trash nur in researchVereinen()');
  if (def && !/ohneGeloeschte\(/.test(koerper)) rot('researchVereinen() filtert nicht nach Loesch-Markern');
  if ((GP && !MAIN.includes(MARKE_FILTER)) || (GP_STEMPEL && !MAIN.includes(MARKE_STEMPEL))) rot('Gegenprobe: Marke im Code nicht gefunden');
}

(async () => {
  const b = await chromium.launch();
  const perr = [];
  const cloud = { data: null, updated_at: '2026-10-28T08:00:00.000Z' };
  const HIER = new globalThis.URL(URL).origin;
  let main = MAIN;
  if (GP) main = main.replace(MARKE_FILTER, MARKE_FILTER + 'return liste;');
  if (GP_STEMPEL) main = main.replace(MARKE_STEMPEL, 'else if(false){');

  async function kontext(mitCloud) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    // Hermetisch wie zurueck.js: keine Daten-Abrufe ins Internet.
    await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (GP || GP_STEMPEL) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
    if (mitCloud) await ctx.route(FAKE + '/**', async route => {
      const r = route.request(), u = r.url();
      if (r.method() === 'POST') { const body = JSON.parse(r.postData())[0]; cloud.data = body.data; cloud.updated_at = body.updated_at; return route.fulfill({ status: 201, body: '' }); }
      if (/select=updated_at/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ updated_at: cloud.updated_at }] : []) });
      if (/select=data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ data: cloud.data, updated_at: cloud.updated_at }] : []) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await ctx.addInitScript(([FAKE, mit]) => {
      try {
        localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0');
        if (mit && !localStorage.getItem('fxpro_cloud_cfg')) localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'W', url: FAKE, key: 'k', syncId: 'w' }));
      } catch (e) {}
    }, [FAKE, mitCloud]);
    return ctx;
  }
  async function seite(ctx, name) {
    const p = await ctx.newPage();
    p.on('dialog', d => d.accept().catch(() => {}));
    p.on('pageerror', e => perr.push(name + ': ' + String(e)));
    await p.goto(URL); await wartenBisDatenDa(p);
    await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
    return p;
  }
  // Stand eines Geraets: Notiz-Ids, Ordner-Ids, Papierkorb (Notiz-Id je Eintrag)
  const stand = p => p.evaluate(() => ({
    notes: (research.notes || []).filter(n => n && !n.seed).map(n => n.id),
    folders: (researchFolders || []).map(f => f.id),
    trash: (research.trash || []).map(t => t.data && t.data.id)
  }));
  const standAus = d => ({
    notes: ((d && d.research && d.research.notes) || []).map(n => n.id),
    folders: ((d && d.researchFolders) || []).map(f => f.id),
    trash: ((d && d.research && d.research.trash) || []).map(t => t.data && t.data.id)
  });
  function pruefe(wo, s, soll) {
    const f = [];
    (soll.da || []).forEach(id => { if (!s.notes.includes(id)) f.push(id + ' fehlt'); });
    (soll.weg || []).forEach(id => { if (s.notes.includes(id)) f.push(id + ' ist wieder da'); });
    (soll.ordnerWeg || []).forEach(id => { if (s.folders.includes(id)) f.push('Ordner ' + id + ' ist wieder da'); });
    (soll.imMuell || []).forEach(id => { if (!s.trash.includes(id)) f.push(id + ' fehlt im Papierkorb'); });
    (soll.nichtImMuell || []).forEach(id => { if (s.trash.includes(id)) f.push(id + ' steht wieder im Papierkorb'); });
    if (f.length) rot(wo + ': ' + f.join(' · ')); else gruen(wo + ': wie gewollt');
  }
  // Realistischer Ablauf nach einer Aktion auf A: A pusht (und gleicht ab),
  // B kommt zurueck in den Vordergrund, B laedt nach einem Datenupdate
  // automatisch hoch, B hat eine eigene Eingabe an anderer Stelle (Drei-Wege-
  // Abgleich), dann ziehen A und B noch einmal.
  let quittung = 1;
  async function runde(A, B) {
    await warte(3500);
    await B.evaluate(() => cloudSyncNow()); await warte(1500);
    await B.evaluate(() => { localStorage.setItem('fxpro_updated', new Date().toISOString()); cloudAutoSync(); }); await warte(3500);
    await B.evaluate(t => { pushU(); widgets[widgets.length - 1].title = t; save(); }, 'WAECHTER Widget ' + (quittung++)); await warte(3500);
    await A.evaluate(() => cloudSyncNow()); await warte(2000);
    await B.evaluate(() => cloudSyncNow()); await warte(2000);
  }
  const notiz = (id, extra) => Object.assign({ id, title: 'WAECHTER ' + id, body: 'x', tags: [], fids: [], asset: 'USD', bias: 'neu', fav: false, pin: false, arch: false, ts: new Date().toISOString(), up: new Date().toISOString() }, extra || {});

  // ── A) zwei Geraete ───────────────────────────────────────────────────
  console.log('A) Zwei Geraete, nachgestellte Cloud');
  const ctxA = await kontext(true), ctxB = await kontext(true);
  const A = await seite(ctxA, 'A');
  await A.evaluate(([liste]) => {
    pushU();
    researchFolders.push({ id: 'lwf1', name: 'WAECHTER Ordner', parentId: null });
    liste.forEach(n => research.notes.push(n));
    save();
  }, [[
    notiz('lwzb1', { title: 'Fed: sticky services', cb: { b: 'USD', s: 'infl', m: '2026-10-29' }, fids: [] }),
    notiz('lwn1'), notiz('lwk1'), notiz('lwk2'), notiz('lwr1'), notiz('lwp1'),
    notiz('lwf1n', { fids: ['lwf1'], asset: '' })
  ]]);
  await warte(300);
  await A.evaluate(() => { resNoteToTrash('lwr1'); resNoteToTrash('lwp1'); });
  await warte(3500);
  const B = await seite(ctxB, 'B'); await warte(2500);
  const vorB = await stand(B);
  if (!['lwzb1', 'lwn1', 'lwk1', 'lwf1n'].every(id => vorB.notes.includes(id)) || !vorB.folders.includes('lwf1') || !vorB.trash.includes('lwr1')) rot('Testaufbau: B hat den Startstand nicht (' + JSON.stringify(vorB.notes.filter(x => /^lw/.test(x))) + ')');

  // Runde 1: Loeschen, Wiederherstellen, endgueltig Loeschen auf A
  await A.evaluate(() => {
    resNoteToTrash('lwzb1');                                   // Bank-Karte -> Notiz -> Delete
    openResNote('lwn1'); delResNote();                         // Notizfenster -> Delete
    researchDelFolder('lwf1');                                 // Ordner samt elternloser Notiz
    const r = (research.trash || []).find(t => t.data && t.data.id === 'lwr1'); if (r) restoreTrashItem(r.id);
    const p = (research.trash || []).find(t => t.data && t.data.id === 'lwp1'); if (p) permaDeleteTrashItem(p.id);
    try { closeM('mTrash'); } catch (e) {}
  });
  await runde(A, B);
  const soll1 = { da: ['lwk1', 'lwk2', 'lwr1'], weg: ['lwzb1', 'lwn1', 'lwf1n'], ordnerWeg: ['lwf1'], imMuell: ['lwzb1', 'lwn1', 'lwf1n'], nichtImMuell: ['lwr1', 'lwp1'] };
  pruefe('Loeschen/Wiederherstellen · Geraet A', await stand(A), soll1);
  pruefe('Loeschen/Wiederherstellen · Geraet B', await stand(B), soll1);
  pruefe('Loeschen/Wiederherstellen · Cloud', standAus(cloud.data), soll1);

  // Runde 2: Undo eines Anlegens und eines Loeschens auf A
  await A.evaluate(n => { pushU(); research.notes.push(n); save(); }, notiz('lwu1'));
  await warte(3500); await B.evaluate(() => cloudSyncNow()); await warte(1500);
  const undo1 = await A.evaluate(() => { doUndo(); return (research.notes || []).some(n => n.id === 'lwu1'); });
  if (undo1) rot('Testaufbau: Undo hat das Anlegen nicht zurueckgenommen');
  await runde(A, B);
  await A.evaluate(() => resNoteToTrash('lwk2'));
  await warte(3500); await B.evaluate(() => cloudSyncNow()); await warte(1500);
  const undo2 = await A.evaluate(() => { doUndo(); return (research.notes || []).some(n => n.id === 'lwk2'); });
  if (!undo2) rot('Testaufbau: Undo hat das Loeschen nicht zurueckgenommen');
  await runde(A, B);
  const soll2 = { da: ['lwk1', 'lwk2', 'lwr1'], weg: ['lwu1', 'lwzb1', 'lwn1', 'lwf1n'], ordnerWeg: ['lwf1'], nichtImMuell: ['lwk2', 'lwr1', 'lwp1'] };
  pruefe('Undo · Geraet A', await stand(A), soll2);
  pruefe('Undo · Geraet B', await stand(B), soll2);
  pruefe('Undo · Cloud', standAus(cloud.data), soll2);
  await ctxA.close(); await ctxB.close();

  // ── B) zwei Tabs, ein Geraet ──────────────────────────────────────────
  console.log('B) Zwei Tabs, ein Geraet (ohne Cloud)');
  const ctxT = await kontext(false);
  const T1 = await seite(ctxT, 'T1'), T2 = await seite(ctxT, 'T2');
  await T1.evaluate(n => { pushU(); research.notes.push(n); save(); }, notiz('lwt1', { cb: { b: 'EUR', s: 'lab', m: '2026-10-30' }, fids: [] }));
  await warte(1500);
  if (!(await stand(T2)).notes.includes('lwt1')) rot('Testaufbau: Tab 2 hat die neue Notiz nicht uebernommen');
  await T1.evaluate(() => resNoteToTrash('lwt1'));
  await warte(3500);
  await T2.evaluate(() => { pushU(); widgets[widgets.length - 1].title = 'WAECHTER Tab 2'; save(); });
  await warte(3500);
  await T1.evaluate(() => save()); await warte(500);
  const platte = await T1.evaluate(() => JSON.parse(localStorage.getItem(SK) || 'null'));
  const sollT = { weg: ['lwt1'], imMuell: ['lwt1'] };
  pruefe('Tab 1', await stand(T1), sollT);
  pruefe('Tab 2', await stand(T2), sollT);
  pruefe('Platte', standAus(platte), sollT);
  await ctxT.close();

  // ── C) Zeitstempel ────────────────────────────────────────────────────
  console.log('C) Jede Aenderung bekommt einen neuen Zeitstempel');
  const ctxC = await kontext(false);
  const C = await seite(ctxC, 'C');
  const c = await C.evaluate(async n => {
    pushU(); research.notes.push(n); researchFolders.push({ id: 'lwcf', name: 'WAECHTER C', parentId: null }); save();
    snap();
    const x = research.notes.find(v => v.id === n.id), f = researchFolders.find(v => v.id === 'lwcf');
    const up0 = x.up, fup0 = f.up;
    snap();
    const ruhig = x.up === up0 && f.up === fup0;
    await new Promise(r => setTimeout(r, 5));
    x.ord = 7; f.name = 'WAECHTER C2';           // wie abNoteMove/Umbenennen: ohne eigenen Stempel
    snap();
    return { ruhig, notiz: x.up !== up0 && String(x.up) > String(up0), ordner: f.up !== fup0 && !!f.up };
  }, notiz('lwc1', { up: '2026-01-01T00:00:00.000Z' }));
  if (!c.ruhig) rot('Stempel aendert sich ohne Aenderung'); else gruen('ohne Aenderung bleibt der Stempel');
  if (!c.notiz) rot('Notiz geaendert (Reihenfolge), Stempel nicht erneuert'); else gruen('Notiz geaendert -> neuer Stempel');
  if (!c.ordner) rot('Ordner umbenannt, Stempel nicht gesetzt'); else gruen('Ordner geaendert -> neuer Stempel');
  await ctxC.close();

  await b.close();
  if (perr.length) { rot('JS-Fehler: ' + perr.slice(0, 3).join(' | ')); }
  const gp = GP || GP_STEMPEL;
  console.log(fehler ? `\n✗ geloescht: ${fehler} Befund(e)` : '\n✓ geloescht: Geloeschtes bleibt geloescht');
  if (gp) console.log(fehler ? '(Gegenprobe wie erwartet rot)' : '⚠ Gegenprobe NICHT rot - Waechter wirkungslos');
  process.exit(gp ? (fehler ? 0 : 1) : (fehler ? 1 : 0));
})().catch(e => { console.error(e); process.exit(1); });
