// ══ WAECHTER: VOLLER SPEICHER (iPad) LAESST NICHTS ZURUECKSPRINGEN ═══════
//
// Nutzer 2026-10-28: "wenn man Sachen umschaltet ... das sie wenige Sekunden
// spaeter einfach wieder ... zurueckspringen" - zweite, von den
// Loesch-Markern (check/geloescht.js) unabhaengige Ursache.
//
// GEMESSEN (iPad-Kontingent nachgestellt: 5 MB = ~2,6 Mio. Zeichen, der alte
// Wert zaehlt beim Ueberschreiben mit): schon ein frisches Profil belegt
// 4,67 Mio. Zeichen, davon 3,23 Mio. die 5 lokalen Sicherungen (je ein voller
// Stand). Auf dem iPad passte die Abgleich-Basis (646 K) nach dem ersten
// Abgleich nicht mehr hinein und wurde geloescht. Neuladen mit offener
// Eingabe (Tab von iOS verworfen, Neuladen nach einer Auslieferung) ->
// Upload OHNE Abgleich -> die Umstellung des anderen Geraets war weg, auch
// dort ("B-spaeter" -> "Risk Sentiment"). Ohne Kontingent: alles blieb.
//
// Geprueft:
//   A) nach mehreren Abgleichen steht die Basis auf der Platte, das
//      Score-Journal wurde dafuer nicht geopfert
//   B) offene Eingabe auf dem iPad, Push kommt nicht mehr durch, das andere
//      Geraet stellt woanders um, iPad laedt neu -> beide Umstellungen
//      bleiben auf beiden Geraeten und in der Cloud
// Gegenprobe --gegenprobe: Basis wieder mit rohem setItem -> rot
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const fs = require('fs');
const path = require('path');
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const FAKE = 'https://speichervoll-cloud.invalid';
const LIMIT = 2621440;   // 5 MB in UTF-16
const MAIN = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8');
const MARKE = "schreibeMitPlatz('fxpro_sync_basis',JSON.stringify({seen,s}))";

let fehler = 0;
const rot = m => { console.log('  ✗ ' + m); fehler++; };
const gruen = m => console.log('  ✓ ' + m);

(async () => {
  if (GP && !MAIN.includes(MARKE)) { rot('Gegenprobe: Marke im Code nicht gefunden'); process.exit(1); }
  const b = await chromium.launch();
  const perr = [];
  const cloud = { data: null, updated_at: '2026-10-28T08:00:00.000Z' };
  const HIER = new globalThis.URL(URL).origin;
  const main = GP ? MAIN.replace(MARKE, "(localStorage.setItem('fxpro_sync_basis',JSON.stringify({seen,s})),true)") : null;
  let netzWeg = false;
  async function geraet(name, ipad) {
    const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await ctx.route(u => u.origin !== HIER && !u.href.startsWith(FAKE), r => ['fetch', 'xhr'].includes(r.request().resourceType()) ? r.abort() : r.fallback());
    if (main) await ctx.route(u => u.origin === HIER && /\/js\/main\.js$/.test(u.pathname), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: main }));
    await ctx.route(FAKE + '/**', async route => {
      const r = route.request(), u = r.url();
      if (ipad && netzWeg) return route.abort();
      if (r.method() === 'POST') { const body = JSON.parse(r.postData())[0]; cloud.data = body.data; cloud.updated_at = body.updated_at; return route.fulfill({ status: 201, body: '' }); }
      if (/select=updated_at/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ updated_at: cloud.updated_at }] : []) });
      if (/select=data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cloud.data ? [{ data: cloud.data, updated_at: cloud.updated_at }] : []) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await ctx.addInitScript(([F, ipad, LIMIT]) => {
      try {
        localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0');
        if (!localStorage.getItem('fxpro_cloud_cfg')) localStorage.setItem('fxpro_cloud_cfg', JSON.stringify({ username: 'S', url: F, key: 'k', syncId: 's' }));
      } catch (e) {}
      if (!ipad) return;
      // WebKit-Kontingent: alle Schluessel + Werte, der alte Wert des
      // geschriebenen Schluessels zaehlt beim Pruefen noch mit.
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        let n = 0; for (let i = 0; i < this.length; i++) { const kk = this.key(i); n += kk.length + (this.getItem(kk) || '').length; }
        if (n + String(k).length + String(v).length > LIMIT) throw new DOMException('quota', 'QuotaExceededError');
        return orig.call(this, k, v);
      };
    }, [FAKE, ipad, LIMIT]);
    const p = await ctx.newPage();
    p.on('dialog', d => d.accept().catch(() => {}));
    p.on('pageerror', e => perr.push(name + ': ' + String(e)));
    return p;
  }
  const weg = p => p.evaluate(() => ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }));
  const start = async p => { await p.goto(URL); await wartenBisDatenDa(p); await weg(p); await p.waitForTimeout(3000); };
  const titel = p => p.evaluate(() => widgets.slice(0, 3).map(w => w.title));

  const B = await geraet('B', false); await start(B);
  const A = await geraet('A', true); await start(A);

  console.log('A) Basis auf der Platte trotz vollem Speicher');
  for (let i = 0; i < 3; i++) {
    await B.evaluate(i => { pushU(); widgets[0].title = 'WAECHTER B ' + i; save(); }, i); await B.waitForTimeout(3000);
    await A.evaluate(() => cloudSyncNow()); await A.waitForTimeout(2500);
  }
  const st = await A.evaluate(() => ({ basis: !!localStorage.getItem('fxpro_sync_basis'), journal: localStorage.getItem('fxpro_scorejournal') != null, kChars: Math.round([...Array(localStorage.length)].map((_, i) => localStorage.key(i)).reduce((n, k) => n + k.length + localStorage.getItem(k).length, 0) / 1024) }));
  if (!st.basis) rot(`Basis nach 3 Abgleichen nicht auf der Platte (${st.kChars} K Zeichen belegt)`); else gruen(`Basis auf der Platte (${st.kChars} K Zeichen belegt)`);
  if (!st.journal) rot('Score-Journal wurde fuer Platz geopfert'); else gruen('Score-Journal unangetastet');

  console.log('B) Neuladen mit offener Eingabe, anderes Geraet stellt woanders um');
  netzWeg = true;   // Push kommt nicht mehr durch (Tab wird verworfen)
  await A.evaluate(() => { pushU(); widgets[1].title = 'WAECHTER A offen'; save(); });
  await A.waitForTimeout(2500);
  netzWeg = false;
  await B.evaluate(() => { pushU(); widgets[2].title = 'WAECHTER B spaeter'; save(); }); await B.waitForTimeout(3000);
  await A.reload(); await wartenBisDatenDa(A); await weg(A); await A.waitForTimeout(5000);
  await B.evaluate(() => cloudSyncNow()); await B.waitForTimeout(2500);
  const soll = ['WAECHTER B 2', 'WAECHTER A offen', 'WAECHTER B spaeter'];
  const pr = (wo, t) => { const f = soll.filter((x, i) => t[i] !== x); if (f.length) rot(`${wo}: ${t.join(' | ')} (fehlt: ${f.join(', ')})`); else gruen(`${wo}: beide Umstellungen da`); };
  pr('iPad', await titel(A));
  pr('anderes Geraet', await titel(B));
  pr('Cloud', (cloud.data.widgets || []).slice(0, 3).map(w => w.title));

  await b.close();
  if (perr.length) rot('JS-Fehler: ' + perr.slice(0, 3).join(' | '));
  if (GP) { console.log(fehler ? `\nGegenprobe ok: ${fehler} Befund(e), wie erwartet rot.` : '\nGegenprobe FEHLGESCHLAGEN: Waechter bleibt gruen.'); process.exit(fehler ? 0 : 1); }
  console.log(fehler ? `\n✗ speichervoll: ${fehler} Befund(e)` : '\n✓ speichervoll: voller Speicher laesst nichts zurueckspringen');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
