// ── DATA: SPEICHERPLAETZE ("Saved") ──────────────────────────────────
//
// Nutzer 2026-11-22: "das wenn man Sachen vergleicht das ganze speichert
// sodass man nicht immer alles neu auswaehlen muss sondern es wie eine
// gespeicherte sitzposition im Auto hat". Rueckfrage: nur Speicherplaetze,
// alle fuenf Ansichten, ein Knopf; Platz mit EINEM Asset fuer ein anderes
// Asset ladbar.
// Prueft:
//   A) Speichern im Menue -> Platz mit Ansicht, Auswahl, Zeitraum
//   B) Laden stellt genau diesen Stand wieder her (nach Umstellen)
//   C) "for"-Auswahl: dieselben Charts fuer ein anderes Asset; was dort fehlt,
//      wird genannt statt erfunden (GOLD hat keine 2Y-Rendite)
//   D) Neuladen: Platz noch da (snap/applySnap)
//   E) Zwei Geraete: Abgleich je Platz, Loeschen gewinnt bei Gleichstand
//   F) Loeschen -> Papierkorb -> Wiederherstellen
//   node check/dataslots.js [--gegenprobe]  (dataSlots fehlt im Speicherstand -> D rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const ok = []; const fail = (t, x) => F.push(`${t}: ${x}`);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  p.on('dialog', d => d.accept());
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  if (GEGENPROBE) await p.addInitScript(() => { const o = JSON.stringify; JSON.stringify = function (v, ...r) { if (v && typeof v === 'object' && 'dataSlots' in v && 'econThesen' in v) { v = Object.assign({}, v); delete v.dataSlots; } return o.call(this, v, ...r); }; });
  const vorbereiten = async () => { await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); showTab('data'); }); await p.waitForTimeout(400); };
  await p.goto(URL); await wartenBisDatenDa(p); await vorbereiten();

  // A
  await p.evaluate(() => { setDataMode('alle'); dataAlle = []; toggleDataAlle('USD', 'p:USD'); toggleDataAlle('USD', 'i:CPI (Headline)'); toggleDataAlle('USD', 'b2:USD'); setDataRange(36); });
  const soll = await p.evaluate(() => JSON.stringify(dsStand()));
  await p.click('#dsKnopf'); await p.click('#dsMenu .ds-save'); await p.fill('#dsName', 'Check set'); await p.click('#dsMenu .ds-ok'); await p.waitForTimeout(200);
  const n = await p.evaluate(() => dsLebend().length);
  if (n !== 1) fail('A', `${n} Plaetze nach Speichern statt 1`); else ok.push('A Speichern');
  // B
  await p.evaluate(() => { dsZu(); setDataMode('preis'); setDataRange(6); });
  await p.click('#dsKnopf'); await p.click('#dsMenu .ds-laden'); await p.waitForTimeout(300);
  const ist = await p.evaluate(() => JSON.stringify(dsStand()));
  if (ist !== soll) fail('B', `geladen ${ist} statt ${soll}`); else ok.push('B Laden');
  // C
  await p.evaluate(() => { const s = document.querySelector('#dsMenu .ds-fuer select'); s.value = 'GOLD'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ al: dataAlle.map(x => x.a + ' ' + x.k), m: (document.querySelector('#dsMenu .ds-meld') || {}).textContent || '' }));
  if (c.al.join('|') !== 'GOLD p:GOLD|GOLD i:CPI (Headline)') fail('C', `fuer GOLD: ${c.al.join('|')}`);
  else if (!/not available for GOLD: 2Y yield/.test(c.m)) fail('C', `fehlender 2Y nicht genannt: "${c.m}"`); else ok.push('C anderes Asset');
  // D
  await p.waitForTimeout(900); await p.reload(); await wartenBisDatenDa(p); await vorbereiten();
  const d = await p.evaluate(() => dsLebend().map(id => dataSlots[id].n));
  if (d.join() !== 'Check set') fail('D', `nach Neuladen: [${d.join(', ')}]`); else ok.push('D Neuladen');
  // E
  const e = await p.evaluate(() => {
    const T = Date.now();
    const a = { x: { n: 'A', t: T, m: 'inds', r: 12, s: { a: 'USD', il: ['CPI (Headline)'] } }, y: { n: 'Y', t: T - 5, m: 'preis', r: 12, s: { pl: ['p:USD'] } } };
    const b = { x: { del: 1, t: T }, y: { n: 'Y2', t: T - 3, m: 'preis', r: 12, s: { pl: ['p:EUR'] } }, z: { n: 'Z', t: T - 7, m: 'alle', r: 12, s: { al: [{ a: 'USD', k: 'p:USD' }] } } };
    const o = dataSlotsVereinen(a, b); return [!!o.x.del, o.y.n, !!o.z].join(',');
  });
  if (e !== 'true,Y2,true') fail('E', `Abgleich ${e} statt true,Y2,true`); else ok.push('E Abgleich');
  // F
  await p.click('#dsKnopf'); await p.waitForTimeout(200);
  if (await p.$('#dsMenu .ds-ic[aria-label="Delete"]')) { await p.click('#dsMenu .ds-ic[aria-label="Delete"]'); await p.waitForTimeout(200); }
  const tr = await p.evaluate(() => (research.trash || []).filter(t => t.kind === 'dslot').map(t => t.id));
  if (!tr.length) fail('F', 'nicht im Papierkorb');
  else { await p.evaluate(id => restoreTrashItem(id), tr[0]); const z = await p.evaluate(() => dsLebend().length); if (z !== 1) fail('F', 'Wiederherstellen ohne Platz'); else ok.push('F Papierkorb'); }
  if (perr.length) fail('Seitenfehler', perr.slice(0, 3).join(' | '));
  await b.close();
  ok.forEach(x => console.log('  ✓ ' + x));
  if (F.length) { F.forEach(x => console.log('  ✗ ' + x)); console.log('[dataslots] ROT'); process.exit(1); }
  console.log('[dataslots] ok (Speichern, Laden, anderes Asset, Neuladen, Abgleich, Papierkorb)');
})().catch(e => { console.error(e); process.exit(1); });
