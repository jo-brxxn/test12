// ── EIGENE SYMBOLE FUER INDIZES UND AKTIEN (seit 2026-11-15, VERSION-CHECK-728) ──
// Nutzer 2026-11-15 (iPad-Foto der Bias-Liste: bei allen Aktien ein leeres dunkles
// Kaestchen): "Ich will zu jedem indice und jeder Aktie ein eigenes das zur Firma passt".
//  A) Jede der 16 IDs (SP500, NAS, DAX + 13 Aktien) hat im Symbol-Block ein EIGENES Bild
//     (alle 16 verschieden, keins ist die alte gemeinsame Index-Karte mit ai-tick)
//  B) Auf dem Dashboard (Bias scores, Filter Stocks) zeigt jede Aktie ihr Symbol: <use> auf
//     #ai-<ID>, sichtbar (Breite > 0)
//  C) Einfarbige Fassung (assetGlyphHtml) existiert fuer alle 16
// --gegenprobe: eigene Symbole abgeschaltet (alte Index-Karte) -> A muss rot werden.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT = process.env.PORT || 8935, GP = process.argv.includes('--gegenprobe');
const IDS = ['SP500', 'NAS', 'DAX', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL', 'AMD', 'INTC', 'PLTR', 'CRWV'];
(async () => {
  const b = await chromium.launch(); const F = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  if (GP) await ctx.route(/\/js\/main\.js/, async r => { const res = await r.fetch(); let t = await res.text(); t = t.replace('${AI_MARKEN[id] || aiIndex(AI_INDEX_ACCENT[id])}', '${aiIndex(AI_INDEX_ACCENT[id])}'); r.fulfill({ response: res, body: t }); });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); localStorage.setItem('fxpro_dash_bias_kat', 'stock'); } catch (e) { } });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['lockScreen', 'introOv'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); document.querySelectorAll('.mov,.mov2,.ov').forEach(m => { m.style.display = 'none'; }); showTab('dash'); });
  await p.waitForTimeout(1500);
  const R = await p.evaluate(ids => {
    const sym = Object.fromEntries(ids.map(id => { const s = document.getElementById('ai-' + id); return [id, s ? s.innerHTML : null]; }));
    // B: alle Aktien-Zeilen aufklappen, dann Symbole messen
    document.querySelectorAll('#dbBias .dbv-mehr').forEach(k => { if (/Show all/.test(k.textContent)) k.click(); });
    const dash = [...document.querySelectorAll('#dbBias .db-bias[data-id]')].map(z => { const u = z.querySelector('use'), sv = u && u.closest('svg'); return { id: z.dataset.id, href: u ? u.getAttribute('href') : null, w: sv ? Math.round(sv.getBoundingClientRect().width) : 0 }; });
    const mono = ids.filter(id => !/<svg/.test(assetGlyphHtml(id, 17) || ''));
    return { sym, dash, mono };
  }, IDS);
  const inhalte = IDS.map(id => R.sym[id]);
  IDS.forEach(id => { const h = R.sym[id]; if (!h) F.push('A: kein Symbol #ai-' + id); else if (/ai-tick/.test(h)) F.push('A: ' + id + ' hat noch die alte Index-Karte'); });
  if (new Set(inhalte).size !== IDS.length) F.push('A: nicht alle 16 Symbole verschieden (' + new Set(inhalte).size + ')');
  const aktien = R.dash.filter(d => IDS.includes(d.id));
  if (aktien.length < 13) F.push('B: nur ' + aktien.length + ' Aktien in Bias scores (Filter Stocks)');
  aktien.forEach(d => { if (d.href !== '#ai-' + d.id || !(d.w > 0)) F.push(`B: ${d.id} Symbol ${d.href} Breite ${d.w}`); });
  if (R.mono.length) F.push('C: ohne einfarbige Fassung: ' + R.mono.join(', '));
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /alte Index-Karte/.test(f)); console.log(ok ? 'markenicons --gegenprobe: ok (alte Karte gemeldet)' : 'markenicons --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('markenicons: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log('markenicons: ok (16 eigene, verschiedene Symbole, alle 13 Aktien im Dashboard mit ihrem Symbol, einfarbige Fassung)');
})().catch(e => { console.log('markenicons: ABBRUCH ' + e.message); process.exit(1); });
