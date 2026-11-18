// ── HOVER-INFO IMMER IM VORDERGRUND, DIREKT UEBER DEM PUNKT, NIE ABGESCHNITTEN (seit 2026-11-18, VERSION-CHECK-761) ──
// Nutzer 2026-11-18 (iPad-Foto Data, Compare all, CAD): "Die Infos sollen immer im Vordergrund aber auch
// immer ueber dem was der Chart oder Tabelle oder Grafik zeigt stehen" (Rueckfrage: direkt ueber dem Punkt).
// Foto: Core CPI - Datumszeile der Box unter der Panel-Kopfzeile verschwunden (vom Panel abgeschnitten).
// Je Chart, Maus an 9 Stellen (bei hohen Werten liegt der Punkt nah am oberen Rand):
//  A) die Box liegt ganz im Fenster und KEIN Vorfahr mit overflow != visible schneidet sie ab
//  B) die Box liegt in der obersten Ebene (Kind von <body>, position fixed) - nichts kann sie verdecken
//  C) der Punkt bleibt frei: Box-Unterkante ueber dem Punkt (oder, wenn oben kein Platz, Oberkante darunter)
// Seiten: Data (Compare all, 4 CAD-Panels, 6Y) 1194x834 + 390x844, Asset-Seite USD 1194x834.
// --gegenprobe: alte Box im Chart (position absolute im Panel) -> A/B rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
(async () => {
  const F = []; let gemessen = 0;
  const b = await chromium.launch();
  for (const [W, H, seite] of [[1194, 834, 'data'], [390, 844, 'data'], [1194, 834, 'usd'], [1194, 834, 'cot']]) {
    const o = `${W}px ${seite}`;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text();
      t = t.replace("if(tip){tip.innerHTML=best.tip;tip.style.display='none';chvTipZeigen(w,best.tip,rr.left+px*(rr.width/r.width),rr.top+py*(rr.height/r.height));}   // Inhalt bleibt auch im Chart (Wächter lesen ihn), sichtbar ist die schwebende Box", "if(tip){tip.innerHTML=best.tip;tip.style.display='';const tw=tip.offsetWidth||120;tip.style.left=Math.max(tw/2+2,Math.min(r.width-tw/2-2,px))+'px';tip.style.top=Math.max(4,py)+'px';}");
      r.fulfill({ response: res, body: t }); });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) { } });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
    await p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
    if (seite === 'data') await p.evaluate(() => { showTab('data'); dataAlle = [{ a: 'CAD', k: 'i:Central Bank Rate' }, { a: 'CAD', k: 'i:CPI (Headline)' }, { a: 'CAD', k: 'i:Core CPI' }, { a: 'CAD', k: 'i:Unemployment Rate' }]; setDataMode('alle'); try { setDataRange(72); } catch (e) { } });
    else if (seite === 'cot') await p.evaluate(() => { showTab('cot'); pickCotFilter('EUR'); });
    else await p.evaluate(() => gotoSym('USD'));
    await p.waitForTimeout(3000);
    if (seite === 'cot') {
      const hs = await p.evaluate(() => { const l = [...document.querySelectorAll('#cotHistWrap .cot-hit')]; if (!l.length) return 0; l[Math.floor(l.length / 2)].scrollIntoView({ block: 'center' }); return l.length; });
      if (!hs) F.push(`${o}: Testaufbau - kein COT-Verlauf`);
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const pt = await p.evaluate(f => { const l = [...document.querySelectorAll('#cotHistWrap .cot-hit')]; const e = l[Math.floor((l.length - 1) * f)]; e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, f);
        await p.waitForTimeout(150); await p.mouse.move(pt[0] - 3, pt[1]); await p.mouse.move(pt[0], pt[1]); await p.waitForTimeout(150);
        const m = await p.evaluate(() => { const t = [...document.querySelectorAll('body>.chv-float.cot-tip')].find(e => getComputedStyle(e).display !== 'none') || document.getElementById('cotHoverTip'); if (!t || getComputedStyle(t).display === 'none') return null;
          const q = t.getBoundingClientRect(), out = [], dot = document.getElementById('cotHoverDot'), d = dot && dot.getBoundingClientRect();
          for (let a = t.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue; const c = a.getBoundingClientRect(); if (q.top < c.top - 0.5 || q.bottom > c.bottom + 0.5 || q.left < c.left - 0.5 || q.right > c.right + 0.5) { out.push('A abgeschnitten'); break; } }
          if (!(t.parentElement === document.body && getComputedStyle(t).position === 'fixed')) out.push('B nicht in der obersten Ebene');
          if (d) { const py = d.top + d.height / 2; if (!(q.bottom <= py - 3 || q.top >= py + 3)) out.push('C verdeckt den Punkt'); }
          return out; });
        if (m === null) { F.push(`${o} @${f}: keine Info-Box`); continue; } gemessen++;
        m.forEach(x => F.push(`${o} @${f}: ${x}`));
      }
      err.forEach(e => F.push(o + ' JS-Fehler: ' + e)); await ctx.close(); continue;
    }
    const n = await p.evaluate(() => { const l = [...document.querySelectorAll('.chv')].filter(x => x.offsetParent).filter(x => { const r = x.getBoundingClientRect(); return r.width > 120 && r.height > 60; }); l.forEach((x, i) => x.dataset.ht = i); return l.length; });
    if (n < 2) F.push(`${o}: Testaufbau - nur ${n} Charts`);
    for (let i = 0; i < Math.min(n, 6); i++) {
      await p.evaluate(i => document.querySelector(`.chv[data-ht="${i}"]`).scrollIntoView({ block: 'center' }), i); await p.waitForTimeout(150);
      for (const fx of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
        const r = await p.evaluate(i => { const q = document.querySelector(`.chv[data-ht="${i}"]`).getBoundingClientRect(); return [q.x, q.y, q.width, q.height]; }, i);
        await p.mouse.move(r[0] + r[2] * fx, r[1] + r[3] * 0.5); await p.waitForTimeout(90);
        const m = await p.evaluate(i => {
          const w = document.querySelector(`.chv[data-ht="${i}"]`);
          const kand = [w.querySelector('.chv-tip'), w.__tipFloat].filter(e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
          const t = kand[0]; if (!t) return null;
          const dot = w.querySelector('.chv-dot'); const d = dot && getComputedStyle(dot).display !== 'none' ? dot.getBoundingClientRect() : null;
          const q = t.getBoundingClientRect(); const out = [];
          if (q.left < -0.5 || q.top < -0.5 || q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5) out.push('A ragt aus dem Fenster');
          for (let a = t.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue; const c = a.getBoundingClientRect(); if (q.top < c.top - 0.5 || q.bottom > c.bottom + 0.5 || q.left < c.left - 0.5 || q.right > c.right + 0.5) { out.push('A abgeschnitten von ' + String(a.className || a.id).slice(0, 24)); break; } }
          if (!(t.parentElement === document.body && getComputedStyle(t).position === 'fixed')) out.push('B nicht in der obersten Ebene');
          if (d) { const py = d.top + d.height / 2; if (!(q.bottom <= py - 3 || q.top >= py + 3)) out.push('C verdeckt den Punkt'); }
          return out;
        }, i);
        if (m === null) continue; gemessen++;
        m.forEach(x => F.push(`${o} Chart ${i} @${fx}: ${x}`));
      }
    }
    err.forEach(e => F.push(o + ' JS-Fehler: ' + e));
    await ctx.close();
  }
  await b.close();
  const uniq = [...new Set(F.map(f => f.replace(/ @0\.\d/, '')))];
  if (gemessen < 30) uniq.push(`Testaufbau: nur ${gemessen} Hover-Positionen gemessen`);
  if (GP) { const ok = uniq.some(f => / A abgeschnitten| B nicht/.test(f)); console.log(ok ? 'hovertip --gegenprobe: ok (alte Box abgeschnitten/nicht vorne)' : 'hovertip --gegenprobe: FEHLER\n  ' + uniq.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (uniq.length) { console.log('hovertip: ' + uniq.length + ' Befund(e)\n  ' + uniq.slice(0, 15).join('\n  ')); process.exit(1); }
  console.log(`hovertip: ok (${gemessen} Hover-Positionen: Box ganz sichtbar, oberste Ebene, Punkt frei - Data 1194/390, Asset-Seite, COT-Verlauf)`);
})().catch(e => { console.log('hovertip: ABBRUCH ' + e.message); process.exit(1); });
