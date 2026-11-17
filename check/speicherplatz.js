// ── SPEICHERPLATZ AUF DEM IPAD: ABGLEICH-BASIS NUR ALS UNTERSCHIED (seit 2026-11-17, VERSION-CHECK-754) ──
// Nutzer-Screenshot iPad 2026-11-17: "Local storage is full - your last changes were NOT saved
// ... 2574 KB". GEMESSEN (iPad-Kontingent 5 MB = 2560 K Zeichen nachgestellt, frisches Geraet
// mit Sync): 2401 K belegt - fxpro_v1 948 K + fxpro_sync_basis 1096 K (1:1-Kopie des Stands,
// dazu String-in-JSON mit escapten Anfuehrungszeichen). ~150 K eigene Daten -> rote Leiste.
// Geprueft (iPad-Kontingent nachgestellt, Cloud gestellt):
//  A) frisches Geraet mit Sync, nach Abgleich: Basis <= 2 K Zeichen, alles zusammen <= 1700 K
//  B) offene Eingaben (Push kommt nicht durch), Neuladen: Basis liegt als Unterschied da,
//     ist klein (< 40 K) und wird beim Start exakt wiederhergestellt (gleich der Basis vorher)
//  C) Rundweg im Browser fuer 12 Arten von Abweichung (Notiz neu/geloescht/geaendert,
//     Reihenfolge, Widget-Titel, Asset-Feld, Kalender ersetzt ...): basisVonPlatte == Basis
// --gegenprobe: Basis wieder als volle Kopie -> A rot.
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs'), path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const FAKE = 'https://speicherplatz-cloud.invalid', LIMIT = 2621440;
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE = "schreibeMitPlatz('fxpro_sync_basis',wert)";
const F = [];
(async () => {
  if (!MAIN.includes(MARKE)) { console.log('speicherplatz: Marke im Code nicht gefunden'); process.exit(1); }
  const main = GP ? MAIN.replace(MARKE, "schreibeMitPlatz('fxpro_sync_basis',JSON.stringify({seen,s}))") : null;
  const b = await chromium.launch();
  const cloud = { data: null, updated_at: '2026-11-17T08:00:00.000Z' }; let netzWeg = false;
  const HIER = new globalThis.URL(URL).origin;
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
  await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
  if (main) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
  await ctx.route(FAKE + '/**', async route => {
    const r = route.request(), u = r.url();
    if (netzWeg) return route.abort();
    if (r.method() === 'POST') { const body = JSON.parse(r.postData())[0]; cloud.data = body.data; cloud.updated_at = body.updated_at; return route.fulfill({ status: 201, body: '' }); }
    if (/select=updated_at/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ updated_at: cloud.updated_at }] : []) });
    if (/select=data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ data: cloud.data, updated_at: cloud.updated_at }] : []) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await ctx.addInitScript(([F0, LIMIT]) => {
    try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); if (!localStorage.getItem('fxpro_cloud_cfg')) localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'S', url: F0, key: 'k', syncId: 's' })); } catch (e) { }
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { let n = 0; for (let i = 0; i < this.length; i++) { const kk = this.key(i); n += kk.length + (this.getItem(kk) || '').length; } if (n + String(k).length + String(v).length > LIMIT) throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); };
  }, [FAKE, LIMIT]);
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(String(e))); p.on('dialog', d => d.accept().catch(() => { }));
  const weg = () => p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  await p.goto(URL); await wartenBisDatenDa(p); await weg(); await p.waitForTimeout(3500);
  await p.evaluate(() => cloudSyncNow()); await p.waitForTimeout(3000);
  const platz = () => p.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } return { ges: Math.round(n / 1024), basis: Math.round((localStorage.getItem('fxpro_sync_basis') || '').length / 1024), roh: localStorage.getItem('fxpro_sync_basis') || '' }; });
  // A
  const A = await platz();
  if (!A.roh) F.push('A: keine Basis auf der Platte nach dem Abgleich');
  if (A.basis > 2) F.push(`A: Basis ${A.basis} K Zeichen (erlaubt 2 K) - volle Kopie des Stands`);
  if (A.ges > 1700) F.push(`A: ${A.ges} K Zeichen belegt (erlaubt 1700 K von 2560 K)`);
  // B
  netzWeg = true;
  await p.evaluate(() => { pushU(); widgets[0].title = 'SPEICHERPLATZ offen'; const now = new Date().toISOString(); research.notes.push({ id: 'spl1', fids: [], title: 'offen', body: 'x', tags: [], fav: false, pin: true, arch: false, ts: now, up: now, bias: 'neu', evt: null, asset: 'USD' }); save(); });
  await p.waitForTimeout(3000);
  const vorher = await p.evaluate(() => _syncBasis);
  const Bp = await platz();
  let form = ''; try { const o = JSON.parse(Bp.roh); form = o.d ? 'd' : o.gleich ? 'gleich' : o.o ? 'o' : o.s ? 's' : '?'; } catch (e) { form = 'kaputt'; }
  if (form !== 'd') F.push(`B: Basis bei offenen Eingaben nicht als Unterschied (Form ${form}, ${Bp.basis} K)`);
  else if (Bp.basis > 40) F.push(`B: Unterschied ${Bp.basis} K Zeichen (erlaubt 40 K)`);
  await p.reload(); await wartenBisDatenDa(p); await weg(); await p.waitForTimeout(800);
  const nachher = await p.evaluate(() => basisVonPlatte(localStorage.getItem('fxpro_cloud_seen')));
  if (!nachher) F.push('B: Basis nach dem Neuladen nicht lesbar');
  else if (JSON.stringify(JSON.parse(nachher)) !== JSON.stringify(JSON.parse(vorher))) F.push('B: Basis nach dem Neuladen weicht von der Basis vorher ab');
  netzWeg = false; await p.waitForTimeout(4000);
  // C
  const C = await p.evaluate(() => {
    const out = [], seen = 'spl-test';
    const art = [
      o => { o.research.notes.push({ id: 'cneu', title: 'neu', body: 'b', up: '1' }); },
      o => { o.research.notes.splice(0, 1); },
      o => { if (o.research.notes[0]) o.research.notes[0].body = 'geaendert'; },
      o => { o.research.notes.reverse(); },
      o => { o.widgets[0].title = 'T'; },
      o => { o.widgets.reverse(); },
      o => { o.syms[0].bias = 'bear'; },
      o => { delete o.syms[0].rubrics[0].summary; },
      o => { o.calEvts = o.calEvts.map(e => Object.assign({}, e, { id: e.id + 'x' })); },
      o => { o.calEvts = []; },
      o => { o.neuesFeld = { a: [1, 2, 3] }; },
      o => { o.pairs = (o.pairs || []).slice(1); },
    ];
    const v1 = localStorage.getItem('fxpro_v1');
    art.forEach((f, i) => {
      const o = JSON.parse(v1); f(o); const ziel = JSON.stringify(o);
      basisSetzen(ziel, seen);
      const r = basisVonPlatte(seen);
      const form = (() => { try { const x = JSON.parse(localStorage.getItem('fxpro_sync_basis')); return x.d ? 'd' : x.gleich ? 'gleich' : x.o ? 'o' : 's'; } catch (e) { return '?'; } })();
      if (!r || JSON.stringify(JSON.parse(r)) !== ziel) out.push(`Art ${i}: Rundweg falsch (${form})`);
    });
    return out;
  });
  C.forEach(c => F.push('C: ' + c));
  err.forEach(e => F.push('JS-Fehler: ' + e));
  await b.close();
  if (GP) { const ok = F.some(f => /^A: Basis/.test(f)); console.log(ok ? 'speicherplatz --gegenprobe: ok (volle Basis gemeldet)' : 'speicherplatz --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('speicherplatz: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`speicherplatz: ok (iPad mit Sync ${A.ges} K von 2560 K Zeichen, Basis ${A.basis} K; offene Eingaben: Unterschied ${Bp.basis} K, nach Neuladen exakt; Rundweg 12 Abweichungsarten)`);
})().catch(e => { console.log('speicherplatz: ABBRUCH ' + e.message); process.exit(1); });
