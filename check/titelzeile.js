// ── KARTENTITEL EINER REIHE AUF EINER LINIE (seit 2026-11-16, VERSION-CHECK-733) ──
// Nutzer 2026-11-15 (Foto CHF): "History muss auf die gleiche Hoehe wie die Ueberschriften
// links daneben und rechts". Gemessen: History-Titel 6-7 px hoeher als Pinned notes und
// November, weil der Kartenkopf ohne Knopf 21 px hoch war, mit Knopf 34 px. Regel seitdem:
// jeder Kartenkopf min. 34 px (--h-m), Titel darin mittig.
// Prueft fuer Asset-Seiten (EUR, NVDA) und Dashboard bei 1366/1180/1024 px: in jeder Reihe
// nebeneinanderstehender Karten liegen die Titel-Texte (17 px, fett) hoechstens 2 px auseinander.
// --gegenprobe: Mindesthoehe der Koepfe aus -> rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const b = await chromium.launch(); const F = []; let reihen = 0;
  for (const [W, H] of [[1366, 1024], [1180, 820], [1024, 768]]) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    if (GP) await p.addStyleTag({ content: '.ab-tile-hd,.abc-hd{min-height:0!important}' });
    for (const ziel of ['EUR', 'NVDA', 'dash']) {
      await p.evaluate(z => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.ov,.mov,.mov2').forEach(m => { m.style.display = 'none'; }); if (z === 'dash') showTab('dash'); else gotoSym(z); }, ziel);
      await p.waitForTimeout(1800);
      const r = await p.evaluate(z => {
        const reihen = z === 'dash' ? [...document.querySelectorAll('#dashWidgets [class^="dx-r"]')] : [...document.querySelectorAll('#detail .ab-orow')];
        const titelTop = card => { const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const el = n.parentElement; if (!n.textContent.trim() || !el || el.closest('button')) continue; const cs = getComputedStyle(el); if (parseFloat(cs.fontSize) >= 16.5 && parseFloat(cs.fontSize) <= 18 && +cs.fontWeight >= 700) { const rg = document.createRange(); rg.selectNodeContents(n); const rr = rg.getBoundingClientRect(); if (rr.height) return { t: n.textContent.trim().slice(0, 20), y: rr.top }; } } return null; };
        return reihen.map(rw => { const karten = [...rw.children].filter(c => c.getBoundingClientRect().height > 80); const tops = karten.map(titelTop).filter(Boolean);
          const zeilen = {}; karten.forEach((c, i) => { const y = Math.round(c.getBoundingClientRect().top / 20); (zeilen[y] = zeilen[y] || []).push(i); });
          return Object.values(zeilen).filter(g => g.length > 1).map(g => g.map(i => titelTop(karten[i])).filter(Boolean)).filter(g => g.length > 1); }).flat();
      }, ziel);
      r.forEach(g => { reihen++; const ys = g.map(x => x.y), d = Math.max(...ys) - Math.min(...ys); if (d > 2) F.push(`${W}px ${ziel}: Titel nicht auf einer Linie (${d.toFixed(1)} px): ${g.map(x => x.t + ' y' + Math.round(x.y)).join(' | ')}`); });
    }
    await p.close();
  }
  await b.close();
  if (GP) { const ok = F.length > 0; console.log(ok ? 'titelzeile --gegenprobe: ok (' + F.length + ' Befund(e))' : 'titelzeile --gegenprobe: FEHLER (nichts gemeldet)'); process.exit(ok ? 0 : 1); }
  if (!reihen) { console.log('titelzeile: keine Reihen gefunden - Pruefung untauglich'); process.exit(1); }
  if (F.length) { console.log('titelzeile: ' + F.length + ' Befund(e)\n  ' + F.slice(0, 20).join('\n  ')); process.exit(1); }
  console.log(`titelzeile: ok (${reihen} Kartenreihen auf EUR, NVDA und Dashboard bei 1366/1180/1024 px, Titel je Reihe auf einer Linie)`);
})().catch(e => { console.log('titelzeile: ABBRUCH ' + e.message); process.exit(1); });
