// ══ WAECHTER: "RATE PROBABILITIES" AUF DER ASSET-SEITE = LINK DER BANK ═══════
//
// Nutzer 2026-09-06: "wenn man den quicklink in den Assets nutzt soll man
// Direkt auf die richte Internet Seite kommen. Bei nzd und chf kommt ein
// Fenster das sagt das es das nicht gibt". Erneut 2026-10-31: "ich will das
// wenn man in Assets auf Rate probabilities klickt nicht mehr zu der
// Kategorie kommt sondern direkt den link der Bank damit oeffnet".
//
// GEMESSEN 2026-10-31: USD, EUR, CHF, GOLD -> Kategorie, kein Link. Beim Umbau
// der Schnellzugriffe zur Zeile (2026-09-14) war der Direkt-Link verloren
// gegangen - drei Funktionen bauten dieselben Knoepfe je fuer sich.
//
// Geprueft (echter Klick auf den Knopf der Schnellzugriffszeile):
//   - jede Waehrung mit Seite + ein an USD gekoppeltes Asset (GOLD): genau
//     dieser Link (rateWatchUrl) wird geoeffnet, die Seite bleibt die Asset-Seite
//   - Waehrung ohne Seite (CHF): Hinweisfenster statt Navigation
//   - der Go-to der Central-bank-Karte fuehrt weiter in die KATEGORIE
// Gegenprobe --gegenprobe: Knopf wieder ueber assetQuickGo('rate') -> rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE = "  if(tab==='rate'){\n    const bank=RATE_WATCH_BANK";

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if (GP && !MAIN.includes(MARKE)) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(u => u.origin !== HIER, r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  if (GP) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: MAIN.replace(MARKE, "  if(false){\n    const bank=RATE_WATCH_BANK") }));
  const p = await ctx.newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); } catch (e) {} window.__geoeffnet = []; window.open = u => { window.__geoeffnet.push(u); return {}; }; });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));

  console.log('Schnellzugriff "Rate Probabilities" auf der Asset-Seite');
  const ids = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD', 'GOLD'];
  for (const id of ids) {
    const soll = await p.evaluate(id => { gotoSym(id); window.__geoeffnet.length = 0; return rateWatchUrl(id); }, id);
    await p.waitForTimeout(400);
    const k = p.locator('#detail .ab-qzeile .aql', { hasText: 'Rate Probabilities' });
    if (!(await k.count())) { rot(`${id}: kein Knopf "Rate Probabilities" in der Schnellzugriffszeile`); continue; }
    await k.first().click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ seite: curPage, links: window.__geoeffnet.slice(), fenster: (() => { const m = document.getElementById('mRwNone'); return !!m && getComputedStyle(m).display !== 'none'; })() }));
    await p.evaluate(() => { try { closeM('mRwNone'); } catch (e) {} });
    if (r.seite !== 'cur') rot(`${id}: Klick fuehrt auf die Seite "${r.seite}" statt den Link zu oeffnen`);
    else if (soll && (r.links.length !== 1 || r.links[0] !== soll)) rot(`${id}: geoeffnet ${JSON.stringify(r.links)}, erwartet ${soll}`);
    else if (!soll && !r.fenster) rot(`${id}: keine Seite fuer diese Bank, aber kein Hinweisfenster`);
    else gruen(`${id}: ${soll ? soll.replace(/^https?:\/\//, '').slice(0, 48) : 'Hinweisfenster (keine Seite)'}`);
  }

  console.log('Go-to der Central-bank-Karte bleibt die Kategorie');
  await p.evaluate(() => { gotoSym('USD'); }); await p.waitForTimeout(500);
  const g = p.locator('#zbKarte .ab-goto-b');
  if (!(await g.count())) rot('Central-bank-Karte ohne Go-to');
  else { await g.first().click(); await p.waitForTimeout(500); const s = await p.evaluate(() => curPage); if (s !== 'rate') rot(`Go-to der Karte fuehrt auf "${s}" statt in die Kategorie Rate Probabilities`); else gruen('Go to Rate Probabilities -> Kategorie'); }

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ ratelink: ${fehler} Befund(e)` : '\n✓ ratelink: Schnellzugriff oeffnet den Link der Bank, Karten-Go-to die Kategorie');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
