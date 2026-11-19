// ── NEWS: START NUR 30 H, ARCHIV BEI BEDARF (seit 2026-11-19, VERSION-CHECK-767) ──
// Nutzer 2026-11-19: "Du kannst bestimmt noch andere Sachen in externe Ordner verschieben die erst bei
// Bedarf geladen werden und nicht in den Score gehen". Gemessen vorher: news_data.json 488 KB beim Start,
// das Dashboard zeigt im Standard ("day") nur 24 h. Der Workflow teilt jetzt (news_data.json = 30 h mit
// Feld "ab", news_archiv.json = alles). Hier wird die Aufteilung aus der echten Datei nachgestellt:
//  A) Dashboard (Standard day): news_archiv.json wird NICHT geladen
//  B) Dashboard Woche: Archiv laedt, die Karte zaehlt genau so viele Schlagzeilen wie der volle Bestand
//  C) News-Tab "all stored": alle Schlagzeilen des Archivs
//  D) Asset-Seite (USD): Anzahl der News-Karte = voller Bestand; Kalendertag vor "ab" zaehlt richtig
// --gegenprobe: newsArchivFuer tut nichts -> B/C/D rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const fs = require('fs'), path = require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = [];
  // Voller Bestand: das Archiv, wenn es schon da ist, sonst die (noch ungeteilte) news_data.json
  const roh = p => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8')); } catch (e) { return null; } };
  const voll = roh('news_archiv.json') || roh('news_data.json');
  if (!voll || !Array.isArray(voll.headlines) || voll.headlines.length < 50) { console.log('newsarchiv: ABBRUCH - kein News-Bestand'); process.exit(1); }
  const ab = new Date(Date.now() - 30 * 3600e3).toISOString();
  const start = { ...voll, ab, gesamt: voll.headlines.length, headlines: voll.headlines.filter(h => Date.parse(h.d) >= Date.parse(ab)) };
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1194, height: 834 }, serviceWorkers: 'block' });
  await ctx.route(/\/news_data\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(start) }));
  await ctx.route(/\/news_archiv\.json/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(voll) }));
  if (GP) await ctx.route(/\/js\/data-feeds\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('function newsArchivFuer(seite){if(!newsVollstaendig())', 'function newsArchivFuer(seite){if(false)'); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  const geladen = []; p.on('request', q => { if (/news_archiv\.json/.test(q.url())) geladen.push(Date.now()); });
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p); await p.waitForTimeout(4000);
  await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  // A
  await p.evaluate(() => { showTab('dash'); setNewsRange('day'); }); await p.waitForTimeout(1500);
  if (geladen.length) F.push(`A: Dashboard (day) laedt news_archiv.json (${geladen.length}x)`);
  // B
  const sollWoche = voll.headlines.filter(h => Date.parse(h.d) >= Date.now() - 7 * 864e5).length;
  // die News-Karte ist nicht auf jedem Dashboard - ihr Pfad (newsPool Woche) loest das Nachladen aus
  await p.evaluate(() => { setNewsRange('week'); newsPool('week', false, 'ALL', false); }); await p.waitForTimeout(3000);
  const istWoche = await p.evaluate(() => newsPool('week', false, 'ALL', false).length);
  if (Math.abs(istWoche - sollWoche) > 2) F.push(`B: Woche zeigt ${istWoche} Schlagzeilen, voller Bestand ${sollWoche}`);
  await p.evaluate(() => setNewsRange('day'));
  // C
  await p.evaluate(() => { showTab('news'); setNewsTabRange('MAX'); }); await p.waitForTimeout(2500);
  const istAlle = await p.evaluate(async () => { const m = await import('/js/data-feeds.js'); return (m.NEWS_DATA && m.NEWS_DATA.headlines || []).length; });
  if (istAlle !== voll.headlines.length) F.push(`C: News-Tab kennt ${istAlle} von ${voll.headlines.length} Schlagzeilen`);
  // D
  await p.evaluate(() => gotoSym('USD')); await p.waitForTimeout(2500);
  const sollUsd = voll.headlines.filter(h => Array.isArray(h.a) && h.a.includes('USD')).length;
  const istUsd = await p.evaluate(() => newsForAsset('USD').length);
  if (istUsd !== sollUsd) F.push(`D: Asset-Seite USD zaehlt ${istUsd} statt ${sollUsd}`);
  const alt = voll.headlines.filter(h => Date.parse(h.d) < Date.parse(ab) - 2 * 864e5 && Array.isArray(h.a) && h.a.includes('USD'))[0];
  if (alt) {
    const tag = String(alt.d).slice(0, 10);
    const soll = voll.headlines.filter(h => String(h.d).slice(0, 10) === tag && Array.isArray(h.a) && h.a.includes('USD')).length;
    const ist = await p.evaluate(t => evtNewsCount({ date: t, currencies: 'USD' }), tag);
    if (ist !== soll) F.push(`D: Kalendertag ${tag} USD zaehlt ${ist} statt ${soll}`);
  }
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^[BCD]: /.test(f)); console.log(ok ? 'newsarchiv --gegenprobe: ok (ohne Nachladen fehlende Schlagzeilen gemeldet)' : 'newsarchiv --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('newsarchiv: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`newsarchiv: ok (Start ${start.headlines.length} von ${voll.headlines.length} Schlagzeilen, Archiv nur bei Woche/News-Tab/Asset-Seite, Zahlen wie mit vollem Bestand)`);
})().catch(e => { console.log('newsarchiv: ABBRUCH ' + e.message); process.exit(1); });
