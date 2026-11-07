// ══ WAECHTER: LAND DER WELTKUGEL STIMMT BEI JEDEM WINKEL ═══════════════════
//
// Nutzer-Fotos 2026-11-07 ("es ruckelt"): heller/dunkler Keil ueber dem Atlantik,
// der beim Drehen auf- und zuklappt. GEMESSEN: die feine Landkarte
// (globe_land.json) hat Afrika+Eurasien als EIN Polygon; verdeckte Strecken
// wurden als Sehne geschlossen -> 9-15 % der Kugel falsch, Spruenge bis 10,8 %
// zwischen zwei 0,1-Grad-Bildern. Dazu: vereinfachte, selbstkreuzende Ringe
// (Sri Lanka) fuellten 3-4 Bilder lang die ganze Kugel.
// Prueft mit dem echten Zeichner (js/globe-zeichnen.js), Kugel 318 px:
//   A) 720 Winkel (0,5 Grad): Landanteil springt zwischen Nachbarbildern <= 3 %
//   B) 24 Winkel gegen Rueckprojektion (Punkt-im-Polygon): <= 5 % falsch
//      (Kantenrauschen bis 2,3 %, die Keile lagen bei 8,7-15 %)
// Gegenprobe --gegenprobe: alter Weg (Sehne) -> rot.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const GP = process.argv.includes('--gegenprobe');
const ROOT = path.join(__dirname, '..');
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const port = srv.address().port, F = [];
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(`http://127.0.0.1:${port}/globe_land.json`);
  const r = await p.evaluate(async gp => {
    const roh = (await (await fetch('/globe_land.json')).json()).ringe;
    const m = await import('/js/globe-zeichnen.js');
    const LAT0 = 18 * Math.PI / 180, size = 318, R = size / 2 - 26;
    const cv = document.createElement('canvas');
    const z = m.erstelleZeichner(cv, { size, dpr: 1, lat0: LAT0, landfarbe: '#2d6ea8', rasterFarbe: 'rgba(126,196,255,.5)', schrift: 'sans-serif', meer: '#0b2445', randSehne: gp });
    z.land(roh); z.meta([]);
    const g = cv.getContext('2d');
    const anteil = () => { const d = g.getImageData(0, 0, size, size).data; let l = 0, n = 0; for (let i = 0; i < d.length; i += 16) { if (d[i + 3] < 200) continue; n++; if (d[i] + d[i + 1] + d[i + 2] > 210) l++; } return l / n * 100; };
    const A = []; for (let t = 0; t < 720; t++) { z.bild(t / 2 - 180, 0, false, null, null); A.push(anteil()); }
    let maxS = 0, wo = 0; for (let t = 0; t < 720; t++) { const s = Math.abs(A[(t + 1) % 720] - A[t]); if (s > maxS) { maxS = s; wo = t / 2 - 180; } }
    // B) Rueckprojektion gegen dieselben (vereinfachten) Ringe
    const eps = 1 / (R * Math.PI / 180), ringe = roh.map(x => m.kuesteVereinfachen(x, eps)).filter(x => x.length >= 3);
    const bb = ringe.map(r => { let a = 90, b = -90, c = 180, d = -180; r.forEach(([la, lo]) => { a = Math.min(a, la); b = Math.max(b, la); c = Math.min(c, lo); d = Math.max(d, lo); }); return [a, b, c, d]; });
    const inLand = (la, lo) => { for (let k = 0; k < ringe.length; k++) { const q = bb[k]; if (la < q[0] || la > q[1] || lo < q[2] || lo > q[3]) continue; const r = ringe[k]; let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [yi, xi] = r[i], [yj, xj] = r[j]; if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) c = !c; } if (c) return true; } return false; };
    const B = [];
    for (let lon0 = -180; lon0 < 180; lon0 += 15) {
      z.bild(lon0, 0, false, null, null); const d = g.getImageData(0, 0, size, size).data; let falsch = 0, n = 0;
      for (let gy = -0.8; gy <= 0.8; gy += 0.025) for (let gx = -0.8; gx <= 0.8; gx += 0.025) {
        const rho = Math.hypot(gx, gy); if (rho > 0.8) continue;
        const c = Math.asin(rho), yu = -gy, la = rho ? Math.asin(Math.cos(c) * Math.sin(LAT0) + yu * Math.sin(c) * Math.cos(LAT0) / rho) : LAT0;
        let lo = lon0 + (rho ? Math.atan2(gx * Math.sin(c), rho * Math.cos(LAT0) * Math.cos(c) - yu * Math.sin(LAT0) * Math.sin(c)) : 0) * 180 / Math.PI; lo = ((lo + 540) % 360) - 180;
        const q = (Math.round(size / 2 + gy * R) * size + Math.round(size / 2 + gx * R)) * 4;
        n++; if (inLand(la * 180 / Math.PI, lo) !== ((d[q] + d[q + 1] + d[q + 2]) / 3 > 70)) falsch++;
      }
      B.push({ lon0, pz: falsch / n * 100 });
    }
    return { maxS, wo, B };
  }, GP);
  await b.close(); srv.close();
  if (r.maxS > 3) F.push(`A: Landanteil springt um ${r.maxS.toFixed(1)} % zwischen zwei 0,5-Grad-Bildern (bei ${r.wo} Grad) - Keil/Vollkreis am Kugelrand`);
  const schlecht = r.B.filter(x => x.pz > 5);   // Kantenrauschen <= 2,3 %, Keile 8,7-15 %
  if (schlecht.length) F.push(`B: ${schlecht.length} von 24 Winkeln falsch gefuellt (${schlecht.slice(0, 4).map(x => x.lon0 + ' Grad ' + x.pz.toFixed(1) + ' %').join(', ')})`);
  if (GP) { const ok = F.length > 0; console.log(ok ? 'kugelland --gegenprobe: ok (Sehne am Rand wird gemeldet: ' + F.join(' / ').slice(0, 160) + ')' : 'kugelland --gegenprobe: FEHLER - nicht gemeldet'); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('kugelland: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`kugelland: ok (720 Winkel, groesster Sprung ${r.maxS.toFixed(2)} %; 24 Winkel gegen Rueckprojektion, max ${Math.max(...r.B.map(x => x.pz)).toFixed(1)} % falsch)`);
});
