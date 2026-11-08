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
//   C) Raster fest auf der Kugel (Nutzer 2026-11-08: "dieses Raster das man
//      sieht mach das fest auf die Weltkugel drauf"): Ausschnitt in der Sahara
//      bei zwei Winkeln, die das Land um 6 px verschieben - um 6 px versetzt
//      verglichen muss er gleich aussehen (<= 8 Stufen im Mittel; mitdrehend
//      gemessen 3,6-4,7 Stufen Kantenglaettung, stehend 14,2-17,9), fuer beide
//      Zeichenwege (pfad = Chromium/Firefox, atlas = WebKit) (vorher stand das Raster und das
//      Land drehte darunter durch); dazu muss Raster zu sehen sein
//      (Helligkeits-Streuung im Ausschnitt), auch auf schmalen Inseln (Japan).
// Gegenprobe --gegenprobe: alter Weg (Sehne) -> rot.
// Gegenprobe --gegenprobe-raster: Raster steht still -> C rot.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const GP = process.argv.includes('--gegenprobe'), GPR = process.argv.includes('--gegenprobe-raster');
const ROOT = path.join(__dirname, '..');
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const port = srv.address().port, F = [];
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(`http://127.0.0.1:${port}/globe_land.json`);
  const r = await p.evaluate(async ([gp, gpr]) => {
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
    // C) Raster haengt am Land: Mitte (Breite 18, Laenge 20 = Sahara) bei
    // Winkel A, dann so weit gedreht, dass derselbe Ort 6 px links liegt
    const C = {};
    for (const weg of ['pfad', 'atlas']) {   // beide Zeichenwege (Chromium/Firefox | WebKit)
    const D = 2, cv2 = document.createElement('canvas');
    const z2 = m.erstelleZeichner(cv2, { size, dpr: D, lat0: LAT0, landfarbe: '#5b8fd0', rasterFarbe: 'rgba(255,255,255,.55)', schrift: 'sans-serif', meer: '#dce9f7', randRgb: '199,214,233', rasterStehend: gpr, rasterWeg: weg });
    z2.land(roh); z2.meta([]);
    const g2 = cv2.getContext('2d'), V = 6, H = 20;
    const fleck = (lon0, dx) => { z2.bild(lon0, 0, false, null, null); const x0 = Math.round((size / 2 - dx) * D) - H, y0 = Math.round(size / 2 * D) - H; return g2.getImageData(x0, y0, 2 * H, 2 * H).data; };
    const dl = Math.asin(V / (R * Math.cos(LAT0))) * 180 / Math.PI;
    const fa = fleck(20, 0), fb = fleck(20 + dl, V);
    let diff = 0, sum = 0, sum2 = 0, n2 = 0;
    for (let i = 0; i < fa.length; i += 4) { diff += (Math.abs(fa[i] - fb[i]) + Math.abs(fa[i + 1] - fb[i + 1]) + Math.abs(fa[i + 2] - fb[i + 2])) / 3; const L = (fa[i] + fa[i + 1] + fa[i + 2]) / 3; sum += L; sum2 += L * L; n2++; }
    const streu = Math.sqrt(sum2 / n2 - (sum / n2) ** 2);
    // Raster auf schmalen Inseln: Honshu (Breite 36-37, Laenge 138-140) in der Kugelmitte
    z2.bild(139, 0, false, null, null);
    const pj = (la, lo) => { const f = la * Math.PI / 180, l = (lo - 139) * Math.PI / 180; return [size / 2 + R * Math.cos(f) * Math.sin(l), size / 2 - R * (Math.cos(LAT0) * Math.sin(f) - Math.sin(LAT0) * Math.cos(f) * Math.cos(l))]; };
    const [jx, jy] = pj(36.3, 138.6), jd = g2.getImageData(Math.round(jx * D) - 6, Math.round(jy * D) - 6, 12, 12).data;
    let hellJ = 0; for (let i = 0; i < jd.length; i += 4) if (jd[i] + jd[i + 1] + jd[i + 2] > 3 * 150) hellJ++;   // Rasterlinien heller als Land (#5b8fd0)
    C[weg] = { diff: diff / n2, streu, hellJ, raster: z2.raster ? z2.raster() : 0 };
    }
    return { maxS, wo, B, C };
  }, [GP, GPR]).catch(e => ({ fehler: String(e) }));
  await b.close(); srv.close();
  if (r.fehler) { console.log('kugelland: Pruefung abgebrochen - ' + r.fehler); process.exit(1); }
  if (r.maxS > 3) F.push(`A: Landanteil springt um ${r.maxS.toFixed(1)} % zwischen zwei 0,5-Grad-Bildern (bei ${r.wo} Grad) - Keil/Vollkreis am Kugelrand`);
  const schlecht = r.B.filter(x => x.pz > 5);   // Kantenrauschen <= 2,3 %, Keile 8,7-15 %
  if (schlecht.length) F.push(`B: ${schlecht.length} von 24 Winkeln falsch gefuellt (${schlecht.slice(0, 4).map(x => x.lon0 + ' Grad ' + x.pz.toFixed(1) + ' %').join(', ')})`);
  for (const [weg, c] of Object.entries(r.C)) {
    if (c.streu < 8) F.push(`C (${weg}): kein Raster auf dem Land zu sehen (Helligkeits-Streuung ${c.streu.toFixed(1)})`);
    else if (c.diff > 8) F.push(`C (${weg}): Raster dreht nicht mit dem Land - Ausschnitt nach 6 px Drehung im Mittel ${c.diff.toFixed(1)} Stufen anders (Raster steht still?)`);
    if (c.hellJ < 3) F.push(`C (${weg}): kein Raster auf Honshu (${c.hellJ} helle Pixel) - Kuesten-Vierecke fehlen`);
  }
  if (GPR) { const ok = F.filter(f => f.startsWith('C (')).length === 2; console.log(ok ? 'kugelland --gegenprobe-raster: ok (stehendes Raster wird gemeldet: ' + F.filter(f => f.startsWith('C (')).join(' / ') + ')' : 'kugelland --gegenprobe-raster: FEHLER - nicht gemeldet (C ' + JSON.stringify(r.C) + ')'); process.exit(ok ? 0 : 1); }
  if (GP) { const ok = F.length > 0; console.log(ok ? 'kugelland --gegenprobe: ok (Sehne am Rand wird gemeldet: ' + F.join(' / ').slice(0, 160) + ')' : 'kugelland --gegenprobe: FEHLER - nicht gemeldet'); process.exit(ok ? 0 : 1); }
  if (F.length) { console.log('kugelland: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
  console.log(`kugelland: ok (720 Winkel, groesster Sprung ${r.maxS.toFixed(2)} %; 24 Winkel gegen Rueckprojektion, max ${Math.max(...r.B.map(x => x.pz)).toFixed(1)} % falsch; Raster dreht mit: ${Object.entries(r.C).map(([w, c]) => w + ' ' + c.diff.toFixed(1) + ' Stufen Abweichung, Streuung ' + c.streu.toFixed(1) + ', Honshu ' + c.hellJ + ' Rasterpixel').join(' | ')}, ${r.C.pfad.raster} Vierecke)`);
});
