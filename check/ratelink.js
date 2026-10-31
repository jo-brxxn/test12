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
//   - ECHTES window.open (keine Attrappe, seit 2026-10-31): der Tab geht auf,
//     es erscheint KEINE "blocked"-Meldung, der neue Tab hat kein opener;
//     ein simulierter Pop-up-Blocker zeigt "Link blocked" mit dem Link.
//     Anlass: mit window.open(...,'noopener') kam IMMER null zurueck -> die
//     Meldung stand nach dem Zurueckkommen da, obwohl der Link aufging
//     (Nutzer-Screenshot). Die Attrappe von vorher hat das nicht sehen koennen.
// Gegenproben: --gegenprobe (Knopf wieder ueber assetQuickGo('rate')),
//   --gegenprobe-noopener (wieder window.open mit 'noopener') -> rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const GP_NO = process.argv.includes('--gegenprobe-noopener');
const MARKE_NO = "try{w=window.open(url,'_blank');}catch(e){w=null;}";
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE = "  if(tab==='rate'){\n    const bank=RATE_WATCH_BANK";

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if ((GP && !MAIN.includes(MARKE)) || (GP_NO && !MAIN.includes(MARKE_NO))) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: 'block' });
  // Fremde Seiten (die Bank-Links) bekommen eine leere Seite - geprueft wird,
  // DASS und WOHIN der Tab aufgeht, nicht der Inhalt der Bank-Seite.
  await ctx.route(u => u.origin !== HIER, r => r.request().resourceType() === 'document' ? r.fulfill({ status: 200, contentType: 'text/html', body: '<title>bank</title>' }) : (['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback()));
  let main = MAIN;
  if (GP) main = main.replace(MARKE, "  if(false){\n    const bank=RATE_WATCH_BANK");
  if (GP_NO) main = main.replace(MARKE_NO, "try{w=window.open(url,'_blank','noopener');}catch(e){w=null;}");
  if (GP || GP_NO) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
  const p = await ctx.newPage();
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); } catch (e) {} });
  const tabs = []; ctx.on('page', t => { if (t !== p) tabs.push(t); });
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => ['introOv', 'lockScreen', 'fdOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));

  console.log('Schnellzugriff "Rate Probabilities" auf der Asset-Seite');
  const ids = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD', 'GOLD'];
  for (const id of ids) {
    const soll = await p.evaluate(id => { gotoSym(id); return rateWatchUrl(id); }, id);
    tabs.length = 0;
    await p.waitForTimeout(400);
    const k = p.locator('#detail .ab-qzeile .aql', { hasText: 'Rate Probabilities' });
    if (!(await k.count())) { rot(`${id}: kein Knopf "Rate Probabilities" in der Schnellzugriffszeile`); continue; }
    await k.first().click(); await p.waitForTimeout(soll ? 900 : 300);
    const r = await p.evaluate(() => ({ seite: curPage, fenster: (() => { const m = document.getElementById('mRwNone'); return !!m && getComputedStyle(m).display !== 'none'; })(), titel: ((document.querySelector('#mRwNone h3') || {}).textContent || '') }));
    const links = tabs.map(t => t.url());
    let opener = null; if (tabs[0]) { try { opener = await tabs[0].evaluate(() => window.opener === null); } catch (e) { opener = 'unbekannt'; } }
    for (const t of tabs) await t.close().catch(() => {});
    await p.evaluate(() => { try { closeM('mRwNone'); } catch (e) {} });
    if (r.seite !== 'cur') rot(`${id}: Klick fuehrt auf die Seite "${r.seite}" statt den Link zu oeffnen`);
    else if (soll && (links.length !== 1 || links[0] !== soll)) rot(`${id}: geoeffnet ${JSON.stringify(links)}, erwartet ${soll}`);
    else if (soll && r.fenster) rot(`${id}: Tab ist offen, aber die App meldet trotzdem "${r.titel}" (falscher Blockier-Alarm)`);
    else if (soll && opener !== true) rot(`${id}: neuer Tab haelt noch eine Verbindung zur App (window.opener = ${opener})`);
    else if (!soll && !r.fenster) rot(`${id}: keine Seite fuer diese Bank, aber kein Hinweisfenster`);
    else gruen(`${id}: ${soll ? soll.replace(/^https?:\/\//, '').slice(0, 44) + ' · keine Meldung · opener getrennt' : 'Hinweisfenster (keine Seite)'}`);
  }

  console.log('Pop-up-Blocker: sichtbare Meldung mit dem Link');
  await p.evaluate(() => { gotoSym('EUR'); window.__echtesOpen = window.open; window.open = () => null; }); await p.waitForTimeout(400);
  await p.locator('#detail .ab-qzeile .aql', { hasText: 'Rate Probabilities' }).first().click(); await p.waitForTimeout(300);
  const bl = await p.evaluate(() => { const m = document.getElementById('mRwNone'); const r = { an: !!m && getComputedStyle(m).display !== 'none', titel: (document.querySelector('#mRwNone h3') || {}).textContent || '', link: !!document.querySelector('#mRwNoneTxt a[href]') }; window.open = window.__echtesOpen; try { closeM('mRwNone'); } catch (e) {} return r; });
  if (!bl.an || bl.titel !== 'Link blocked' || !bl.link) rot(`blockierter Tab: Meldung ${bl.an ? 'da' : 'fehlt'}, Titel "${bl.titel}", Link ${bl.link ? 'da' : 'fehlt'}`);
  else gruen('blockierter Tab: "Link blocked" mit dem Link zum Selbst-Oeffnen');

  console.log('Go-to der Central-bank-Karte bleibt die Kategorie');
  await p.evaluate(() => { gotoSym('USD'); }); await p.waitForTimeout(500);
  const g = p.locator('#zbKarte .ab-goto-b');
  if (!(await g.count())) rot('Central-bank-Karte ohne Go-to');
  else { await g.first().click(); await p.waitForTimeout(500); const s = await p.evaluate(() => curPage); if (s !== 'rate') rot(`Go-to der Karte fuehrt auf "${s}" statt in die Kategorie Rate Probabilities`); else gruen('Go to Rate Probabilities -> Kategorie'); }

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP || GP_NO) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ ratelink: ${fehler} Befund(e)` : '\n✓ ratelink: Schnellzugriff oeffnet den Link der Bank, Karten-Go-to die Kategorie');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
