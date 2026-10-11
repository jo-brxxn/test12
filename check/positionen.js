// ── COT UND RETAIL: NEUE DARSTELLUNG, GLEICHE DATEN ─────────────────────
// Nutzer 2026-10-11: "Ich will fuer retail Sentiment und cot eine neue
// Darstellung der Daten haben. Es sollen die Daten gleich bleiben aber anders
// dargestellt" - per Rueckfrage gewaehlt (VERSION-CHECK-598):
//   COT    "Linie mit Score-Zonen" (Asset-Karte + Verlaufschart im COT-Tab)
//   Retail "Abweichung von 50 %" (Asset-Karte + Sentiment-Tab; die
//          Asset-Liste im COT-Tab nimmt dieselbe Zeile)
// Geprueft wird, dass die Darstellung DIESELBEN Zahlen zeigt und geometrisch
// stimmt:
//   A) COT-Karte: Kopfzahl = cotMetrics().longPct, zwei getoente Zonen, keine
//      Kontrakt-Balken mehr, Endpunkt sichtbar.
//   B) Jede Abweichungs-Zeile (Karte, COT-Tab, Sentiment-Tab): der Balken
//      liegt zwischen 50 % und der Quote (px-genau auf der Spur), die
//      Schwellen-Striche liegen bei ab und 100-ab, der
//      Text nennt die Mehrheitsseite mit der richtigen Zahl.
//   C) Retail-Zeilen tragen die Broker-Quote unveraendert (= Feed).
//   D) COT-Tab-Verlauf (EUR): Zonen + Linie, keine Kontrakt-Balken.
//   node check/positionen.js [--gegenprobe]
//   (Gegenprobe: Balken ab 0 statt ab 50 %, Zonen entfernt -> B und A rot)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);

const zeilenPruefen = (p, wurzelSel, ab, ort) => p.evaluate(([wurzelSel, ab, ort]) => {
  const out = []; let n = 0;
  const w = document.querySelector(wurzelSel); if (!w) return { n, out: [`${ort}: ${wurzelSel} fehlt`] };
  w.querySelectorAll('.pd-row:not(.pd-hd)').forEach(z => {
    if (!z.offsetParent) return; n++;
    const L = +z.dataset.lang, K = +z.dataset.kurz, name = (z.querySelector('.pd-n') || {}).textContent.trim();
    if (!(L >= 0 && L <= 100) || Math.abs(L + K - 100) > 0.01) { out.push(`${ort} ${name}: long ${L} + short ${K} != 100`); return; }
    const t = z.querySelector('.pd-track').getBoundingClientRect(), b = z.querySelector('.pd-bar').getBoundingClientRect();
    const xp = q => t.left + t.width * q / 100;
    const soll0 = xp(Math.min(L, 50)), soll1 = xp(Math.max(L, 50));
    if (Math.abs(b.left - soll0) > 1.5 || Math.abs(b.right - soll1) > 1.5) out.push(`${ort} ${name}: Balken ${Math.round(b.left - t.left)}-${Math.round(b.right - t.left)}px, soll ${Math.round(soll0 - t.left)}-${Math.round(soll1 - t.left)}px (50 % bis ${L} %)`);
    const th = [...z.querySelectorAll('.pd-th')].map(e => Math.round((e.getBoundingClientRect().left - t.left) / t.width * 100)).sort((a, b) => a - b);
    if (th.join(',') !== [100 - ab, ab].join(',')) out.push(`${ort} ${name}: Schwellen bei ${th.join('/')} %, soll ${100 - ab}/${ab}`);
    const mid = z.querySelector('.pd-mid').getBoundingClientRect();
    if (Math.abs(mid.left + mid.width / 2 - xp(50)) > 1) out.push(`${ort} ${name}: Mittellinie nicht bei 50 %`);
    const v = z.querySelector('.pd-v').textContent.replace(/\s+/g, ' ').trim();
    const sollTxt = L >= 50 ? 'long' : 'short', sollZahl = L >= 50 ? L : K;
    const m = v.match(/^([\d.]+)% (long|short)$/);
    if (!m || m[2] !== sollTxt || Math.abs(+m[1] - sollZahl) > 0.51) out.push(`${ort} ${name}: Text "${v}", soll ${Math.round(sollZahl)}% ${sollTxt}`);
  });
  return { n, out };
}, [wurzelSel, ab, ort]);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(gp => { ['introOv', 'lockScreen'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    if (gp) { const st = document.createElement('style'); st.textContent = '.pd-bar{left:0!important}.pos-zone{display:none}'; document.head.appendChild(st); } }, GEGENPROBE);
  // Schwellen aus dem Quelltext (Modul-Konstanten haengen nicht an window)
  const quelle = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'main.js'), 'utf8');
  const ab = { cot: +(quelle.match(/COT_NETZ_AB=(\d+)/) || [])[1], ret: +(quelle.match(/RETAIL_AB=(\d+)/) || [])[1] };
  if (!ab.cot || !ab.ret) fail('SCHWELLEN', 'COT_NETZ_AB / RETAIL_AB nicht in js/main.js gefunden');
  let zeilen = 0;

  for (const id of ['EUR', 'USD', 'JPY', 'GOLD']) {
    await p.evaluate(x => gotoSym(x), id); await p.waitForTimeout(700);
    // A) COT-Karte
    const a = await p.evaluate(id => {
      const k = [...document.querySelectorAll('#detail .ab-tile')].find(t => /COT Positioning/.test(t.textContent));
      if (!k) return { fehlt: true };
      const cid = abCotId(id); const m = cid && COT_DATA && COT_DATA.symbols[cid] ? cotMetrics(COT_DATA.symbols[cid]) : null;
      const svg = k.querySelector('svg.ab-chart');
      return { fehlt: false, m: m && m.longPct, kopf: (k.querySelector('.pos-wert') || {}).textContent || null,
        zonen: svg ? [...svg.querySelectorAll('.pos-zone')].filter(r => getComputedStyle(r).display !== 'none' && +r.getAttribute('height') > 0).length : 0,
        rects: svg ? svg.querySelectorAll('rect:not(.pos-zone)').length : 0, linie: svg ? svg.querySelectorAll('polyline').length : 0,
        ende: !!k.querySelector('.pos-ende') };
    }, id);
    if (a.fehlt) fail('A COT-KARTE', `${id}: keine COT-Karte`);
    else if (a.m != null) {
      if (!a.kopf || Math.abs(parseFloat(a.kopf) - a.m) > 0.051) fail('A COT-KARTE', `${id}: Kopfzahl "${a.kopf}", Daten ${a.m.toFixed(1)}%`);
      if (a.zonen !== 2) fail('A COT-KARTE', `${id}: ${a.zonen} Score-Zonen im Chart (soll 2)`);
      if (a.rects) fail('A COT-KARTE', `${id}: ${a.rects} Kontrakt-Balken im Chart - die neue Darstellung ist eine Linie`);
      if (a.linie !== 1 || !a.ende) fail('A COT-KARTE', `${id}: Linie ${a.linie}, Endpunkt ${a.ende}`);
    }
    // B/C) Retail-Karte
    const sel = '#detail .ab-tile .pd-list';
    const roh = await p.evaluate(() => { const r = {}; ((window.SENTIMENT_DATA || {}).retail || []).forEach(x => { if (x && x.sym) r[String(x.sym).toUpperCase()] = Math.round(+x.long); }); return r; });
    const r = await zeilenPruefen(p, sel, ab.ret, `Retail-Karte ${id}`);
    r.out.forEach(x => fail('B ZEILE', x)); zeilen += r.n;
    const c = await p.evaluate(() => [...document.querySelectorAll('#detail .ab-tile .pd-list .pd-row:not(.pd-hd)')].map(z => [(z.querySelector('.pd-n').textContent || '').replace('/', '').trim().toUpperCase(), +z.dataset.lang]));
    c.forEach(([s, L]) => { if (roh[s] == null) fail('C RETAIL', `${id} ${s}: nicht im Feed`); else if (roh[s] !== L) fail('C RETAIL', `${id} ${s}: Zeile ${L}%, Feed ${roh[s]}% - die Zeile zeigt die Broker-Quote ungedreht`); });
  }
  // B) COT-Tab-Liste + D) Verlauf
  await p.evaluate(() => { showTab('cot'); pickCotFilter(null); }); await p.waitForTimeout(1200);
  let r = await zeilenPruefen(p, '#cotBody .cot-bars', ab.cot, 'COT-Tab');
  r.out.slice(0, 6).forEach(x => fail('B ZEILE', x)); zeilen += r.n;
  if (r.n < 8) fail('B ZEILE', `COT-Tab: nur ${r.n} Zeilen`);
  await p.evaluate(() => pickCotFilter('EUR')); await p.waitForTimeout(1500);
  const d = await p.evaluate(() => { const s = document.querySelector('#cotHistWrap svg'); if (!s) return null;
    return { zonen: [...s.querySelectorAll('.pos-zone')].filter(r => getComputedStyle(r).display !== 'none').length, balken: s.querySelectorAll('rect:not(.pos-zone):not(.cot-hit)').length, linie: s.querySelectorAll('polyline').length }; });
  if (!d) fail('D COT-TAB', 'kein Verlaufschart fuer EUR');
  else { if (d.zonen !== 2) fail('D COT-TAB', `${d.zonen} Score-Zonen (soll 2)`); if (d.balken) fail('D COT-TAB', `${d.balken} Kontrakt-Balken`); if (d.linie !== 1) fail('D COT-TAB', `${d.linie} Linien`); }
  await p.evaluate(() => pickCotFilter(null));
  // B) Sentiment-Tab
  await p.evaluate(() => { showTab('sent'); setSentSub('retail'); try { setSentSym(null); } catch (e) {} }); await p.waitForTimeout(1200);
  r = await zeilenPruefen(p, '#sentBody .pd-list', ab.ret, 'Sentiment-Tab');
  r.out.slice(0, 6).forEach(x => fail('B ZEILE', x)); zeilen += r.n;
  if (r.n < 10) fail('B ZEILE', `Sentiment-Tab: nur ${r.n} Zeilen`);
  if (perr.length) fail('JS', perr[0]);
  await b.close();

  if (GEGENPROBE) {
    const ok = F.some(x => x.startsWith('B ')) && F.some(x => x.startsWith('A ')) && F.some(x => x.startsWith('D '));
    console.log(ok ? 'positionen --gegenprobe: ok (Balken ab 0 statt 50 % und fehlende Zonen werden gemeldet)' : 'positionen --gegenprobe: FEHLER - nicht gemeldet\n  ' + F.join('\n  '));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`positionen: ${F.length} Befund(e)\n  ` + F.slice(0, 30).join('\n  ')); process.exit(1); }
  console.log(`positionen: ok (COT als Linie mit Score-Zonen in Karte und Tab, ${zeilen} Abweichungs-Zeilen in Karten, COT- und Sentiment-Tab: Balken von 50 % bis zur Quote, Schwellen ${ab.cot}/${ab.ret} %, Retail = Feed)`);
})().catch(e => { console.log('positionen: ABBRUCH ' + e.message); process.exit(1); });
