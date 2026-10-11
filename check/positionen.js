// ── COT UND RETAIL: NEUE DARSTELLUNG, GLEICHE DATEN ─────────────────────
// Nutzer 2026-10-11: "Ich will fuer retail Sentiment und cot eine neue
// Darstellung der Daten haben. Es sollen die Daten gleich bleiben aber anders
// dargestellt" - per Rueckfrage gewaehlt (VERSION-CHECK-598):
//   COT    seit 2026-10-11 abends "Version 4": gespiegelte Balken (Long
//          oben, Short unten) + Fusszeile Long/Short/w/w (Asset-Karte +
//          Verlaufschart im COT-Tab); die Liste im COT-Tab bleibt 50-%-Zeile
//   Retail "Abweichung von 50 %" (Asset-Karte + Sentiment-Tab; die
//          Asset-Liste im COT-Tab nimmt dieselbe Zeile)
// Geprueft wird, dass die Darstellung DIESELBEN Zahlen zeigt und geometrisch
// stimmt:
//   A) COT-Karte: Fusszeile Long % = cotMetrics().longPct, je Bericht ein
//      Long-Balken ueber und ein Short-Balken unter der Mittellinie.
//   B) Jede Abweichungs-Zeile (Karte, COT-Tab, Sentiment-Tab): der Balken
//      liegt zwischen 50 % und der Quote (px-genau auf der Spur), die
//      Schwellen-Striche liegen bei ab und 100-ab, der
//      Text nennt die Mehrheitsseite mit der richtigen Zahl.
//   C) Retail-Zeilen tragen die Broker-Quote unveraendert (= Feed).
//   D) COT-Tab-Verlauf (EUR): je Bericht Long ueber / Short unter der Mitte.
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
    if (gp) { const st = document.createElement('style'); st.textContent = '.pd-bar{left:0!important}'; document.head.appendChild(st); window.__cotGp = 1; } }, GEGENPROBE);
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
      const foot = (k.querySelector('.ab-foot b') || {}).textContent || null;
      const rects = svg ? [...svg.querySelectorAll('rect')] : [], mitte = svg ? +svg.viewBox.baseVal.height / 2 : 0;
      const oben = rects.filter(r => Math.abs(+r.getAttribute('y') + +r.getAttribute('height') - mitte) < 0.2).length;
      const unten = rects.filter(r => Math.abs(+r.getAttribute('y') - mitte) < 0.2).length;
      return { fehlt: false, m: m && m.longPct, n: S0(cid), kopf: foot, oben, unten };
      function S0(cid) { const s = COT_DATA.symbols[cid]; return s && Array.isArray(s.history) ? s.history.filter(e => e && (+e.long + +e.short) > 0).length : 0; }
    }, id);
    if (a.fehlt) fail('A COT-KARTE', `${id}: keine COT-Karte`);
    else if (a.m != null) {
      if (!a.kopf || Math.abs(parseFloat(a.kopf) - a.m) > 0.051) fail('A COT-KARTE', `${id}: Fusszeile Long "${a.kopf}", Daten ${a.m.toFixed(1)}%`);
      if (a.oben !== a.n || a.unten !== a.n) fail('A COT-KARTE', `${id}: ${a.oben} Long-Balken ueber / ${a.unten} Short-Balken unter der Mitte, ${a.n} Berichte`);
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
    const r = [...s.querySelectorAll('rect:not(.cot-hit)')]; const ys = r.map(x => +x.getAttribute('y')); const mitte = ys.length ? Math.max(...ys) : 0;
    return { n: s.querySelectorAll('rect.cot-hit').length, unten: r.filter(x => Math.abs(+x.getAttribute('y') - mitte) < 0.2).length, oben: r.filter(x => Math.abs(+x.getAttribute('y') + +x.getAttribute('height') - mitte) < 0.3).length }; });
  if (!d) fail('D COT-TAB', 'kein Verlaufschart fuer EUR');
  else if (d.oben !== d.n || d.unten !== d.n) fail('D COT-TAB', `${d.oben} Long oben / ${d.unten} Short unten bei ${d.n} Berichten`);
  await p.evaluate(() => pickCotFilter(null));
  // B) Sentiment-Tab
  await p.evaluate(() => { showTab('sent'); setSentSub('retail'); try { setSentSym(null); } catch (e) {} }); await p.waitForTimeout(1200);
  r = await zeilenPruefen(p, '#sentBody .pd-list', ab.ret, 'Sentiment-Tab');
  r.out.slice(0, 6).forEach(x => fail('B ZEILE', x)); zeilen += r.n;
  if (r.n < 10) fail('B ZEILE', `Sentiment-Tab: nur ${r.n} Zeilen`);
  if (perr.length) fail('JS', perr[0]);
  await b.close();

  if (GEGENPROBE) {
    const ok = F.some(x => x.startsWith('B '));
    console.log(ok ? 'positionen --gegenprobe: ok (Balken ab 0 statt 50 % werden gemeldet)' : 'positionen --gegenprobe: FEHLER - nicht gemeldet\n  ' + F.join('\n  '));
    process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`positionen: ${F.length} Befund(e)\n  ` + F.slice(0, 30).join('\n  ')); process.exit(1); }
  console.log(`positionen: ok (COT als gespiegelte Balken in Karte und Tab, ${zeilen} Abweichungs-Zeilen in Karten, COT- und Sentiment-Tab: Balken von 50 % bis zur Quote, Schwellen ${ab.cot}/${ab.ret} %, Retail = Feed)`);
})().catch(e => { console.log('positionen: ABBRUCH ' + e.message); process.exit(1); });
