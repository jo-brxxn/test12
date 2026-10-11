// ── KEIN FLIESSTEXT: KURZ, KNAPP, STRUKTURIERT (Dauerregel 2026-10-11) ───
// Nutzer 2026-10-11: "nirgendswo ein Fliesstext immer nur in kurz und knapp
// die Infos uebersichtlich vlt manches fett geschrieben manches kursiv oder
// manches in bias Farbe. So will ich das auch die ganze Webseite immer
// funktioniert halt das als Regel fest ich sie Uebersichtlichkeit und
// schnelle datenverfuegbarkeit und nicht in einem Text suchen".
// Geprueft: alle Tabs, die Asset-Seite und JEDES ⓘ-Fenster der wichtigsten
// Seiten. Ein Block (Element ohne Block-Kinder) ist Fliesstext, wenn er
//   - zwei oder mehr Saetze hat und mindestens 22 Woerter, oder
//   - als ein einziger Satz 40 Woerter oder mehr lang ist.
// Ausgenommen: Tabellen, Eingabefelder, Nutzer-Notizen, Nachrichten-
// Schlagzeilen (fremde Texte), die temporaere Design-Vorschau.
// Loesung im Code: kurzHtml()/kurzDom() (Satz = Punkt, Zahlen fett, Klammern
// kursiv), faktenFenster() (Etikett | Wert), hwZeile() (Titel · Kurzangabe).
//   node check/fliesstext.js [--gegenprobe]   (Gegenprobe: ein Absatz mit
//   drei Saetzen in ein ⓘ-Fenster gesetzt -> muss rot werden)
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = [];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); } catch (e) {} });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });
  const scan = ort => p.evaluate(ort => {
    const out = [];
    const AUS = 'script,style,svg,table,textarea,input,select,.vp,.hl-row,.news-card,.note-body,.res-note,.aqn-n,.nt-item-tx,.res-body,.hl-title,.ni-body';
    [...document.querySelectorAll('body *')].forEach(e => {
      if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return;
      if (e.closest(AUS)) return;
      const kids = [...e.children].filter(k => ['block', 'flex', 'grid', 'list-item', 'table', 'inline-flex'].includes(getComputedStyle(k).display));
      if (kids.length) return;
      const t = (e.innerText || '').replace(/\s+/g, ' ').trim();
      if (t.length < 80) return;
      const w = t.split(' ').length, s = (t.replace(/\b(e\.g|i\.e|vs|approx|etc|incl|ca)\./gi, '$1').match(/[.!?](\s|$)/g) || []).length;
      if ((s >= 2 && w >= 22) || w >= 40) out.push(`${ort}: ${w} Woerter/${s} Saetze in .${String(e.className || e.tagName).slice(0, 28)} - "${t.slice(0, 70)}…"`);
    });
    return out;
  }, ort);
  const alle = [];
  const tabs = await p.evaluate(() => TAB_ORDER.slice());
  for (const t of tabs) { await p.evaluate(t => showTab(t), t); await p.waitForTimeout(450); alle.push(...await scan('Tab ' + t)); }
  await p.evaluate(() => gotoSym('EUR')); await p.waitForTimeout(1200); alle.push(...await scan('Asset EUR'));
  let fenster = 0;
  const INFO = '.info-b,.rinfo,.ci-btn';
  for (const ort of ['dash', 'A:EUR', 'cot', 'sent', 'seas', 'trends', 'carry', 'pairs', 'cal', 'rate', 'fx', 'mx', 'watch', 'news', 'data']) {
    await p.evaluate(o => { if (o.startsWith('A:')) gotoSym(o.slice(2)); else showTab(o); }, ort); await p.waitForTimeout(500);
    const n = await p.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent && !e.closest('.ov')).length, INFO);
    for (let i = 0; i < Math.min(n, 30); i++) {
      const ok = await p.evaluate(([sel, i]) => { const e = [...document.querySelectorAll(sel)].filter(e => e.offsetParent && !e.closest('.ov'))[i]; if (!e) return false; e.click(); return true; }, [INFO, i]);
      if (!ok) continue; await p.waitForTimeout(180); fenster++;
      if (GEGENPROBE && fenster === 1) await p.evaluate(() => { const m = [...document.querySelectorAll('.ov')].find(m => getComputedStyle(m).display !== 'none'); const b = m && m.querySelector('.modal'); if (b) b.insertAdjacentHTML('beforeend', '<p>This is a long explanation written as prose. It has several sentences that one has to read through. Nobody wants to search in it for the one value they need.</p>'); });
      const r = await p.evaluate(() => [...document.querySelectorAll('.ov')].filter(m => getComputedStyle(m).display !== 'none').map(m => m.id));
      if (r.length) alle.push(...(await scan(`ⓘ ${ort}#${i}`)));
      await p.evaluate(() => document.querySelectorAll('.ov').forEach(m => { if (getComputedStyle(m).display !== 'none' && m.id) try { closeM(m.id); } catch (e) {} }));
    }
  }
  // Hilfe-Fenster (Kopfzeile "Help") - die laengsten Texte der App
  await p.evaluate(() => openM('mHelp')); await p.waitForTimeout(300); fenster++;
  alle.push(...await scan('Help'));
  await p.evaluate(() => closeM('mHelp'));
  await b.close();
  const uniq = [...new Map(alle.map(x => [x.split(': ').slice(1).join(': '), x])).values()];
  if (GEGENPROBE) {
    const ok = uniq.some(x => /This is a long explanation/.test(x));
    console.log(ok ? 'fliesstext --gegenprobe: ok (eingesetzter Absatz wird gemeldet)' : 'fliesstext --gegenprobe: FEHLER - nicht gemeldet');
    process.exit(ok ? 0 : 1);
  }
  if (perr.length) uniq.push('JS: ' + perr[0]);
  if (uniq.length) { console.log(`fliesstext: ${uniq.length} Fundstelle(n)\n  ` + uniq.slice(0, 40).join('\n  ')); process.exit(1); }
  console.log(`fliesstext: ok (${tabs.length} Tabs, Asset-Seite, ${fenster} ⓘ-Fenster: kein Absatz, nur Punkte/Fakten)`);
})().catch(e => { console.log('fliesstext: ABBRUCH ' + e.message); process.exit(1); });
