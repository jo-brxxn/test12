'use strict';
// ══ WELTKUGEL ZEICHNEN (ohne Seitenzugriff) ════════════════════════════════
// Nutzer 2026-11-06 (Ziel): "dass sich die Weltkugel ohne neu zu laden perfekt
// dreht ohne zu haengen". GEMESSEN: solange irgendetwas im Dokument der Seite
// sich je Bild aendert (SVG-Attribute, Marker-transform, Canvas im Hauptthread),
// setzt der Browser je Bild die Ebenen der GANZEN Dashboard-Seite neu zusammen
// - bei 4x gedrosselter CPU 34 statt 60 Bildern/s; ohne den Rest des
// Dashboards waren es 60. Deshalb zeichnet diese Datei Land, Raster, Marker,
// Ortungs-Ringe und Beschriftungen auf zwei Canvas-Flaechen, die einem Web
// Worker gehoeren (OffscreenCanvas, js/globe-worker.js): dessen Bilder gehen
// direkt an den Compositor, der Hauptthread aendert je Bild nichts.
// Dieselben Funktionen nutzt js/globe.js als Rueckfall im Hauptthread, wenn
// ein Geraet kein OffscreenCanvas kann. KEIN document/window hier.
//
// o = {size, dpr, lat0, landfarbe, meer, schrift, rasterFarbe}
// Ringe: [[lat,lon], ...] je Polygon. Marker: [{id,lat,lon,col,label,i}].

const MIN_PX = 0.6;
// Kuesten einmal je Kugelgroesse vereinfachen (Douglas-Peucker): hoechstens
// KUESTE_PX Bildpunkte Abweichung in der Kugelmitte, zum Rand hin weniger.
// GEMESSEN 2026-11-07 (WebKit, Pixeldichte 2, Kugel 318 px): je Bild 4.000
// Pfadpunkte -> 2.060; spaete Bilder (> 20 ms) liefen mit der Punktzahl
// (4.000: 4,3 %, 1.800: 1,9 %, ohne Land 0,6 %); im Bildvergleich bis 1,2 px
// kein Unterschied. Fest statt je Bild: ein groesseres MIN_PX liesse die Kueste
// flimmern (welche Punkte wegfallen, wechselt mit jedem Winkel).
const KUESTE_PX = 1.0;
const BOGEN_GEGEN = true;   // Randbogen-Richtung (siehe ring())
const RAND_TOL = 1e-3;      // rad - Ein-/Austritt am Rand gelten darunter als gleich
const SQ = 4.2, SI = 0.55, SW = SQ - 2 * SI;     // Raster wie das fruehere SVG-<pattern>
const EU = ['GBP', 'EUR', 'CHF'];

// Douglas-Peucker auf [lat, lon]-Punkten; geschlossener Ring wird am vom Start
// entferntesten Punkt geteilt (sonst fielen Anfang = Ende zusammen).
function dpLinie(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const y1 = pts[a][0], x1 = pts[a][1], y2 = pts[b][0], x2 = pts[b][1], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) { const d = L ? Math.abs(dy * pts[i][1] - dx * pts[i][0] + x2 * y1 - y2 * x1) / L : Math.hypot(pts[i][1] - x1, pts[i][0] - y1); if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function dpRing(r, eps) {
  let k = 0, md = -1;
  for (let i = 0; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > md) { md = d; k = i; } }
  return [...dpLinie(r.slice(0, k + 1), eps).slice(0, -1), ...dpLinie(r.slice(k), eps)];
}
// Kreuzt sich der Ring selbst? (Kanten, die sich echt schneiden)
export function kreuztSich(r) {
  const n = r.length, o = (p, q, s) => Math.sign((q[1] - p[1]) * (s[0] - p[0]) - (q[0] - p[0]) * (s[1] - p[1]));
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = r[j], d = r[(j + 1) % n];
      if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
    }
  }
  return false;
}
// GEMESSEN 2026-11-07: Douglas-Peucker machte 7 Ringe selbstkreuzend (Sri Lanka
// 21 -> 6 Punkte, Ueberschlag an der Nordspitze) - dort ist die Umlaufrichtung
// nicht eindeutig und der Randbogen (ring()) lief einmal ganz herum: die Kugel
// war 3-4 Bilder lang voll Land. Dann feiner vereinfachen, notfalls roh.
export function kuesteVereinfachen(r, eps) {
  if (r.length < 8) return r;
  let v = dpRing(r, eps);
  if (!kreuztSich(v)) return v;
  if (kreuztSich(r)) return v;   // schon die Quelle kreuzt sich - nichts gewonnen
  for (let e = eps / 2; e > eps / 20; e /= 2) { v = dpRing(r, e); if (!kreuztSich(v)) return v; }
  return r;
}

// Ring gegen den Uhrzeigersinn (Laenge = x, Breite = y; Inneres links) - die
// Kugel-Projektion spiegelt nicht, der Bogen am Rand (ring()) braucht das.
export function gegenUhr(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][1] * r[i][0] - r[i][1] * r[j][0];
  return a < 0 ? r.slice().reverse() : r;
}

function neueFlaeche(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;   // Rueckfall Hauptthread
}

// EINE Zeichenflaeche (seit 2026-11-07): Meer, Land, Raster, Randschatten,
// Marker - gemessen in WebKit (Safari-Engine, Pixeldichte 2): zwei Flaechen +
// zwei feste Ebenen 47-50 Bilder/s, p95 39 ms; eine Flaeche 57-59, p95 26-28.
// Jede Ebene ueber/unter einer Flaeche, die sich je Bild aendert, muss der
// Compositor mit zusammensetzen.
export function erstelleZeichner(cv, o) {
  const dpr = o.dpr, size = o.size, R = size / 2 - 26, cx = size / 2, cy = size / 2;
  const sL = Math.sin(o.lat0), cL = Math.cos(o.lat0);
  cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
  const lc = cv.getContext('2d'), mc = lc;
  // Randschatten einmal vorberechnet (Land blendet ab 70 % des Radius ins Meer
  // aus - ersetzt die frueher feste Ebene .globe-rand); seit 2026-11-07 in die
  // Land-Textur eingebacken (siehe landFuellung).
  const rand = neueFlaeche(Math.round(size * dpr), Math.round(size * dpr)), rc = rand.getContext('2d');
  rc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rg = rc.createRadialGradient(cx, cy, R * 0.7, cx, cy, R); rg.addColorStop(0, `rgba(${o.randRgb || '11,36,69'},0)`); rg.addColorStop(1, `rgba(${o.randRgb || '11,36,69'},1)`);   // Farbschema (globe.js GLOBE_PALETTEN)
  rc.fillStyle = rg; rc.beginPath(); rc.arc(cx, cy, R, 0, Math.PI * 2); rc.fill();
  // Land-Textur = Landfarbe mit eingebackenem Randschatten (2026-11-07): je
  // Bild fuellt der Land-Pfad direkt mit ihr. Der Schatten hat Meeresfarbe -
  // ueber dem Meer aenderte er nichts. GEMESSEN (Pixelvergleich, Pixeldichte 2):
  // innen hoechstens 3 von 255 Stufen Rundung, an der aeussersten Randkante 435
  // Pixel bis 19 Stufen. Je Bild eine Kopie ueber die ganze Flaeche weniger:
  // WebKit Bilder >= 25 ms 26 -> 11. Das Raster steckt seit 2026-11-08 NICHT
  // mehr in der Textur (stand dort fest zum Bildschirm) - siehe rasterMalen().
  const textur = neueFlaeche(Math.round(size * dpr), Math.round(size * dpr)), tc = textur.getContext('2d');
  tc.fillStyle = o.landfarbe; tc.fillRect(0, 0, textur.width, textur.height);
  tc.drawImage(rand, 0, 0);
  const landFuellung = lc.createPattern(textur, 'no-repeat');
  const randRing = new Path2D(); randRing.arc(cx, cy, R, 0, Math.PI * 2); randRing.arc(cx, cy, R - 1, 0, Math.PI * 2, true);
  try { landFuellung.setTransform(new DOMMatrix().scale(1 / dpr)); } catch (e) {}

  let ringe = [], pre = [], marker = [];
  let X = new Float64Array(0), Y = new Float64Array(0), V = new Uint8Array(0);
  const vorrechnen = r => { const a = new Float64Array(r.length * 4); for (let i = 0; i < r.length; i++) { const f = r[i][0] * Math.PI / 180, l = r[i][1] * Math.PI / 180; a[4 * i] = Math.sin(f); a[4 * i + 1] = Math.cos(f); a[4 * i + 2] = Math.sin(l); a[4 * i + 3] = Math.cos(l); } return a; };
  const cosc = (lat, lon, lon0) => { const f = lat * Math.PI / 180, l = (lon - lon0) * Math.PI / 180; return sL * Math.sin(f) + cL * Math.cos(f) * Math.cos(l); };
  const proj = (lat, lon, lon0) => { const f = lat * Math.PI / 180, l = (lon - lon0) * Math.PI / 180; return { x: R * Math.cos(f) * Math.sin(l), y: -R * (cL * Math.sin(f) - sL * Math.cos(f) * Math.cos(l)), vis: (sL * Math.sin(f) + cL * Math.cos(f) * Math.cos(l)) > 0 }; };
  // Horizont-Schnittpunkt (Bisektion, wie globeHorizonPoint in globe.js)
  const horizont = (a, b, lon0) => {
    const p0 = cosc(a[0], a[1], lon0) > 0; let t0 = 0, t1 = 1;
    for (let i = 0; i < 20; i++) { const tm = (t0 + t1) / 2; if ((cosc(a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm, lon0) > 0) === p0) t0 = tm; else t1 = tm; }
    const tm = (t0 + t1) / 2; return proj(a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm, lon0);
  };
  function ring(k, lon0, p) {
    const pts = ringe[k], a = pre[k], n = pts.length;
    if (X.length < n) { X = new Float64Array(n); Y = new Float64Array(n); V = new Uint8Array(n); }
    const l0 = lon0 * Math.PI / 180, s0 = Math.sin(l0), c0 = Math.cos(l0);
    for (let i = 0; i < n; i++) {
      const sf = a[4 * i], cf = a[4 * i + 1], sl = a[4 * i + 2], cl = a[4 * i + 3];
      const sinl = sl * c0 - cl * s0, cosl = cl * c0 + sl * s0;
      X[i] = R * cf * sinl; Y[i] = -R * (cL * sf - sL * cf * cosl); V[i] = (sL * sf + cL * cf * cosl) > 0 ? 1 : 0;
    }
    // Verdeckte Strecken am Kugelrand entlang statt als Sehne (2026-11-07):
    // GEMESSEN - die feine Landkarte hat Afrika+Eurasien als EIN Polygon; die
    // Sehne vom Austritts- zum Eintrittspunkt fuellte je nach Winkel 9-15 % der
    // Kugel falsch (heller/dunkler Keil, der beim Drehen auf- und zuklappt).
    // Jetzt wie d3-geo: sichtbare Teilstuecke sammeln, dann jedes Austritts-
    // ende ueber den Rand mit dem NAECHSTEN Eintritt entlang des Randes
    // verbinden (nicht dem naechsten in Laufreihenfolge - die Arktiskueste
    // taucht mehrfach ab und auf). Alle Ringe laufen gleich herum (gegenUhr),
    // deshalb immer dieselbe Bogenrichtung.
    let lx = 1e9, ly = 1e9;
    const lin = (x, y) => { p.lineTo(cx + x, cy + y); lx = x; ly = y; };
    let h0 = -1, v0 = false;
    for (let i = 0; i < n; i++) { if (V[i]) v0 = true; else if (h0 < 0) h0 = i; }
    if (!v0) return;   // ganz hinter dem Horizont
    if (h0 < 0) {   // ganz sichtbar
      p.moveTo(cx + X[0], cy + Y[0]); lx = X[0]; ly = Y[0];
      for (let i = 1; i < n; i++) if (Math.abs(X[i] - lx) >= MIN_PX || Math.abs(Y[i] - ly) >= MIN_PX) lin(X[i], Y[i]);
      return;
    }
    const seg = []; let cur = null;
    for (let s = 0; s < n; s++) {   // ab einem verdeckten Punkt: jedes Stueck beginnt mit Eintritt
      const i = (h0 + s) % n, j = (i + 1) % n;
      if (!V[i] && V[j]) { const h = horizont(pts[i], pts[j], lon0); cur = { hin: h, ain: Math.atan2(h.y, h.x), a: j, b: j }; }
      else if (V[i] && V[j]) cur.b = j;
      else if (V[i]) { const h = horizont(pts[i], pts[j], lon0); cur.hout = h; cur.aout = Math.atan2(h.y, h.x); seg.push(cur); cur = null; }
    }
    if (o.randSehne) {   // nur Gegenprobe check/kugelland.js: alter Weg (Sehne zum naechsten Eintritt in Laufreihenfolge)
      seg.forEach((g, q) => { const nx = seg[(q + 1) % seg.length]; if (!q) p.moveTo(cx + g.hin.x, cy + g.hin.y); else p.lineTo(cx + g.hin.x, cy + g.hin.y); for (let i = g.a; ; i = (i + 1) % n) { p.lineTo(cx + X[i], cy + Y[i]); if (i === g.b) break; } p.lineTo(cx + g.hout.x, cy + g.hout.y); });
      return;
    }
    const zu = new Uint8Array(seg.length), Z = 2 * Math.PI;
    for (let st = 0; st < seg.length; st++) {
      if (zu[st]) continue;
      let c = st; p.moveTo(cx + seg[st].hin.x, cy + seg[st].hin.y); lx = seg[st].hin.x; ly = seg[st].hin.y;
      for (let sicher = 0; sicher <= seg.length; sicher++) {
        const g = seg[c]; zu[c] = 1;
        for (let i = g.a; ; i = (i + 1) % n) { if (Math.abs(X[i] - lx) >= MIN_PX || Math.abs(Y[i] - ly) >= MIN_PX) lin(X[i], Y[i]); if (i === g.b) break; }
        lin(g.hout.x, g.hout.y);
        let best = st, bd = 1e9;
        // Ein-/Austritte naeher als RAND_TOL gelten als derselbe Punkt - sonst
        // entschied Rundungsrauschen (Insel vor Alaska: 4 Uebergaenge bei
        // -1,098 rad) zwischen 0 und einem Vollkreis (Kugel ganz gefuellt).
        for (let q = 0; q < seg.length; q++) { if (zu[q] && q !== st) continue; let d = (BOGEN_GEGEN ? g.aout - seg[q].ain : seg[q].ain - g.aout) % Z; if (d < 0) d += Z; if (d > Z - RAND_TOL) d = 0; if (d < bd) { bd = d; best = q; } }
        if (bd < RAND_TOL) lin(seg[best].hin.x, seg[best].hin.y);
        else { p.arc(cx, cy, R, g.aout, seg[best].ain, BOGEN_GEGEN); lx = seg[best].hin.x; ly = seg[best].hin.y; }
        if (best === st) break;
        c = best;
      }
    }
    // kein closePath(): fill() schliesst selbst - closePath kostete 2,3 ms je Bild
  }
  function landMalen(lon0) {
    lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    lc.clearRect(0, 0, size, size);
    lc.beginPath(); lc.arc(cx, cy, R, 0, Math.PI * 2); lc.fillStyle = o.meer; lc.fill();   // Meer (frueher feste Ebene .globe-meer)
    const p = new Path2D();
    for (let k = 0; k < ringe.length; k++) ring(k, lon0, p);
    lc.fillStyle = landFuellung; lc.fill(p);
    rasterMalen(lon0);
    // Kugelrand: der fruehere Schatten deckte die geglaettete Kante ein zweites
    // Mal - ein 1-px-Ring in Meeresfarbe gibt denselben Rand (dort war das Land
    // durch den Schatten schon zu ~97 % Meeresfarbe)
    lc.fillStyle = o.meer; lc.fill(randRing);
  }
  // ── RASTER FEST AUF DER KUGEL (Nutzer 2026-11-08: "dieses Raster das man
  // sieht mach das fest auf die Weltkugel drauf") ──
  // Vorher ein Bildschirm-Muster in der Land-Textur: das Land drehte unter
  // einem stehenden Gitter durch. Jetzt liegen die Vierecke auf der
  // Kugeloberflaeche - in der Kugelmitte dieselben Masse wie vorher (SQ
  // Abstand, SW Kante, 0,4 px Strich): Breitenreihen im Abstand SQ, je Reihe so
  // viele Vierecke, wie auf den Breitenkreis passen (keins reicht ueber 180
  // Grad). An der Kueste wird der Umriss jedes Vierecks EINMAL beim Aufbau
  // zugeschnitten (je Kante 4 Teilstuecke, Mitte gegen dieselben vereinfachten
  // Kuesten, die gezeichnet werden - Fehler hoechstens 1/8 Kante = 0,4 px):
  // UK, Japan, Neuseeland, Mittelamerika behalten ihr Raster bis zur Kueste.
  //
  // ZWEI ZEICHENWEGE, je nach Browser-Engine (o.rasterWeg, gesetzt in
  // js/globe.js globeRasterWeg) - GEMESSEN 2026-11-08, Pixeldichte 2, je Bild,
  // Muster vorher: WebKit 3 ms / Chromium 1,7 ms:
  //   'pfad'  (Chromium, Firefox): ~2.000 sichtbare Vierecke als Strich-Pfad -
  //           Chromium 2,5-2,9 ms; WebKit aber 10-13 ms (zahlt je kleiner Form;
  //           strokeRect 9-11, gefuellt 7-8), WebKit-Dashboard 54 statt 60/s.
  //   'atlas' (WebKit = Safari/iPad): je Reihe bis zu STUECK Vierecke als ein
  //           Stueck EINMAL in einen festen Bildatlas; je Bild jedes sichtbare
  //           Stueck mit seiner Lage auf der Kugel gestempelt (drawImage, affin
  //           aus den projizierten Enden + Nordrichtung) - WebKit 5 ms im
  //           OpenGL- wie im CPU-Raster (Striche dort 8-13), Dashboard 60-63/s;
  //           Chromium ohne Grafikkarte aber 7 ms (rechnet
  //           jedes gestempelte Bild Pixel fuer Pixel um).
  // Verworfen: Striche selbst in einen Pixelpuffer + putImageData (WebKit-
  // Dashboard 49-52/s - das Hochladen je Bild; als CPU-Flaeche stuerzt WPE
  // WebKit ab); Zuschnitt je Bild (Chromium clip() 23 ms, source-atop 5 ms);
  // closePath() je Viereck (+2 ms).
  // Umriss als Teilstuecke in (u, v), u = Ost, v = Nord, je -1..1; Lauf
  // oben (v=1) nach Westen, links nach Sueden, unten nach Osten, rechts nach Norden.
  const ECKE = [[1, 1], [-1, 1], [-1, -1], [1, -1], [1, 1]], TEILE = 4, STUECK = 8, STF = 15;
  const ATLAS = o.rasterWeg === 'atlas';
  let ST = new Float64Array(0), SN = 0, RQ = 0, atlas = null;   // je Stueck STF Werte (siehe unten)
  let RS = new Float64Array(0), RU = [];   // Weg 'pfad': je Viereck sin/cos Breite, sin/cos Laenge; RU: null = ganz, sonst Laeufe [u,v,...]
  function rasterBauen() {
    const d = SQ / R, h = SW / 2 / R, G = 180 / Math.PI;
    const schnitt = y => {   // Laengen, an denen Kuesten den Breitenkreis y (Grad) kreuzen
      const xs = [];
      for (const r of ringe) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[j], b = r[i]; if ((a[0] <= y) !== (b[0] <= y)) xs.push(a[1] + (y - a[0]) / (b[0] - a[0]) * (b[1] - a[1])); }
      return xs.sort((p, q) => p - q);
    };
    // Punkt auf Land: ungerade viele Kreuzungen links davon (Ringe sind reine
    // Aussenringe ohne Ueberlappung - gerade/ungerade = Vereinigung)
    const aufLand = (xs, x) => { let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; } return (lo & 1) === 1; };
    const VS = [];   // v der Teilstueck-Mitten auf den senkrechten Kanten + Ober-/Unterkante
    for (let t = 0; t < TEILE; t++) VS.push(1 - (t + 0.5) * 2 / TEILE);
    VS.push(1, -1);
    const pkt = q => { const e = Math.floor(q / TEILE) % 4, w = (q % TEILE) / TEILE; return [ECKE[e][0] + (ECKE[e + 1][0] - ECKE[e][0]) * w, ECKE[e][1] + (ECKE[e + 1][1] - ECKE[e][1]) * w]; };
    const stuecke = [], J = Math.floor((Math.PI / 2 - h) / d), S = [], U = [];
    RQ = 0;
    for (let j = -J; j <= J; j++) {
      const f = j * d, cf = Math.cos(f), n = Math.floor(2 * Math.PI * cf / d);
      if (n < 1) continue;
      const xs = new Map(VS.map(v => [Math.round(v * 1e3), schnitt((f + v * h) * G)])), dl = 2 * Math.PI / n, hw = h / cf * G;
      let cur = null;
      for (let k = 0; k < n; k++) {
        const x = (-Math.PI + (k + 0.5) * dl) * G;
        // Teilstueck q (0..4*TEILE-1) auf Land? Mitte in (u, v) -> Breite/Laenge
        const an = [];
        for (let e = 0; e < 4; e++) for (let t = 0; t < TEILE; t++) {
          const w = (t + 0.5) / TEILE, u = ECKE[e][0] + (ECKE[e + 1][0] - ECKE[e][0]) * w, v = ECKE[e][1] + (ECKE[e + 1][1] - ECKE[e][1]) * w;
          an.push(aufLand(xs.get(Math.round(v * 1e3)), x + u * hw));
        }
        const zahl = an.filter(Boolean).length;
        if (!zahl) { cur = null; continue; }
        let laeufe = null;
        if (zahl < an.length) {   // Laeufe: zusammenhaengende Teilstuecke auf Land, ab einem Stueck im Meer
          const N = an.length, st = an.indexOf(false); let lf = null; laeufe = [];
          for (let s2 = 1; s2 <= N; s2++) {
            const q = (st + s2) % N;
            if (an[q]) { if (!lf) lf = [...pkt(q)]; lf.push(...pkt(q + 1)); }
            else if (lf) { laeufe.push(lf); lf = null; }
          }
          if (lf) laeufe.push(lf);
        }
        RQ++;
        if (!ATLAS) { const l = -Math.PI + (k + 0.5) * dl; S.push(Math.sin(f), cf, Math.sin(l), Math.cos(l)); U.push(laeufe); continue; }
        if (cur && cur.q.length < STUECK) { cur.q.push(laeufe); cur.k1 = k; }
        else { cur = { f, cf, dl, k0: k, k1: k, q: [laeufe] }; stuecke.push(cur); }
      }
    }
    RS = Float64Array.from(S); RU = U;
    if (!ATLAS) return;
    // Atlas: Regale (Hoehe eines Vierecks), Stuecke mit 2 px Abstand (Filter
    // greift sonst ins Nachbarstueck); 1 Atlas-Pixel = 1 Geraetepixel in der Kugelmitte
    const a = SW / 2 * dpr, lw = 0.4 * dpr, RD = 2, hoehe = Math.ceil(2 * a + lw) + 2 * RD;
    let AW = 1024; while (AW < 8192 && stuecke.length * hoehe * 60 * dpr > AW * AW) AW *= 2;
    let ax = 0, ay = 0;
    stuecke.forEach(s2 => {
      s2.sp = R * s2.dl * s2.cf * dpr;   // Abstand der Vierecke im Atlas (= auf dem Bildschirm in der Kugelmitte)
      s2.w = Math.ceil((s2.q.length - 1) * s2.sp + 2 * a + lw) + 2 * RD;
      if (ax + s2.w > AW) { ax = 0; ay += hoehe; }
      s2.sx = ax; s2.sy = ay; ax += s2.w;
    });
    const AH = Math.max(1, ay + hoehe);
    atlas = neueFlaeche(AW, AH);
    const g = atlas.getContext('2d'), pf = new Path2D();
    ST = new Float64Array(stuecke.length * STF); SN = stuecke.length;
    stuecke.forEach((s2, i) => {
      const m = s2.q.length, l0 = -Math.PI + (s2.k0 + 0.5) * s2.dl, l1 = -Math.PI + (s2.k1 + 0.5) * s2.dl, lm = (l0 + l1) / 2;
      const ox = RD + lw / 2 + a + (m - 1) * s2.sp / 2, oy = hoehe / 2;
      s2.q.forEach((lf, q) => {
        const x = s2.sx + ox + (q - (m - 1) / 2) * s2.sp, y = s2.sy + oy;
        const zuege = lf || [[1, 1, -1, 1, -1, -1, 1, -1, 1, 1]];
        for (const L of zuege) { pf.moveTo(x + L[0] * a, y - L[1] * a); for (let k = 2; k < L.length; k += 2) pf.lineTo(x + L[k] * a, y - L[k + 1] * a); }
      });
      ST.set([Math.sin(s2.f), s2.cf, Math.sin(l0), Math.cos(l0), Math.sin(l1), Math.cos(l1), Math.sin(lm), Math.cos(lm), (m - 1) * s2.sp, s2.sx, s2.sy, s2.w, hoehe, ox, oy], i * STF);
    });
    g.strokeStyle = o.rasterFarbe; g.lineWidth = lw; g.lineJoin = 'miter'; g.stroke(pf);
  }
  // Weg 'pfad': je Viereck Mitte projizieren, Ecken ueber Ost/Nord (zum Rand
  // hin verkuerzt wie das Land); Randschatten in 6 Deckkraft-Stufen, je ein Strich-Pfad.
  const STUFEN = [1, 0.9, 0.7, 0.5, 0.3, 0.2];
  function pfadMalen(lon0) {
    const n = RS.length / 4; if (!n) return;
    const l0 = lon0 * Math.PI / 180, s0 = Math.sin(l0), c0 = Math.cos(l0), a = SW / 2, R2 = R * R;
    const pf = STUFEN.map(() => new Path2D());
    for (let i = 0; i < n; i++) {
      const sf = RS[4 * i], cf = RS[4 * i + 1], sl = RS[4 * i + 2], cl = RS[4 * i + 3];
      const sinl = sl * c0 - cl * s0, cosl = cl * c0 + sl * s0;
      if (sL * sf + cL * cf * cosl < 0.05) continue;   // hinter dem Horizont bzw. ganz am Rand
      const X = R * cf * sinl, Y = -R * (cL * sf - sL * cf * cosl);
      const rr = Math.sqrt((X * X + Y * Y) / R2), sch = rr <= 0.7 ? 0 : (rr - 0.7) / 0.3;
      if (sch > 0.85) continue;   // aeusserster Rand (ab 95,5 % des Radius): 30 % der sichtbaren Vierecke, Raster dort < 15 % sichtbar
      const p = pf[sch <= 0 ? 0 : Math.min(5, 1 + Math.floor(sch * 5))];
      const ex = a * cosl, ey = -a * sL * sinl, nx = -a * sf * sinl, ny = -a * (cL * cf + sL * sf * cosl);
      const x = cx + X, y = cy + Y, lf = RU[i];
      // kein closePath(): kostete hier 2 ms je Bild (Chromium, 1.500 Vierecke)
      if (!lf) { p.moveTo(x + ex + nx, y + ey + ny); p.lineTo(x - ex + nx, y - ey + ny); p.lineTo(x - ex - nx, y - ey - ny); p.lineTo(x + ex - nx, y + ey - ny); p.lineTo(x + ex + nx, y + ey + ny); continue; }
      for (const L of lf) {
        p.moveTo(x + L[0] * ex + L[1] * nx, y + L[0] * ey + L[1] * ny);
        for (let q = 2; q < L.length; q += 2) p.lineTo(x + L[q] * ex + L[q + 1] * nx, y + L[q] * ey + L[q + 1] * ny);
      }
    }
    lc.strokeStyle = o.rasterFarbe; lc.lineWidth = 0.4;
    for (let b = 0; b < pf.length; b++) { lc.globalAlpha = STUFEN[b]; lc.stroke(pf[b]); }
    lc.globalAlpha = 1;
  }
  // Weg 'atlas', je Bild: Enden und Mitte jedes Stuecks projizieren; Abbildung Atlas ->
  // Bildschirm: Ost = Sehne zwischen den Enden, Sued = Suedrichtung der Kugel in
  // der Mitte, Ursprung zwischen Mitte und Sehnenmitte (Fehler hoechstens die
  // halbe Bogenhoehe, am Kugelrand ~0,5 px). Randschatten wie vorher (ab 70 %
  // des Radius zum Rand hin aus) als Deckkraft je Stueck. Stuecke, deren Ende
  // hinter dem Horizont liegt, fallen weg (dort ist das Raster ohnehin ausgeblendet).
  function rasterMalen(lon0) {
    if (o.rasterStehend) lon0 = 0;   // nur Gegenprobe check/kugelland.js: Raster steht still, Land dreht darunter
    if (!ATLAS) { pfadMalen(lon0); return; }
    if (!SN) return;
    const l0 = lon0 * Math.PI / 180, s0 = Math.sin(l0), c0 = Math.cos(l0), R2 = R * R, D = dpr;
    for (let i = 0, b = 0; i < SN; i++, b += STF) {
      const sf = ST[b], cf = ST[b + 1];
      const sa = ST[b + 2] * c0 - ST[b + 3] * s0, ca = ST[b + 3] * c0 + ST[b + 2] * s0;
      if (sL * sf + cL * cf * ca < 0.05) continue;
      const se = ST[b + 4] * c0 - ST[b + 5] * s0, ce = ST[b + 5] * c0 + ST[b + 4] * s0;
      if (sL * sf + cL * cf * ce < 0.05) continue;
      const sm = ST[b + 6] * c0 - ST[b + 7] * s0, cm = ST[b + 7] * c0 + ST[b + 6] * s0;
      const Xm = R * cf * sm, Ym = -R * (cL * sf - sL * cf * cm);
      const rr = Math.sqrt((Xm * Xm + Ym * Ym) / R2), al = rr <= 0.7 ? 1 : 1 - (rr - 0.7) / 0.3;
      if (al < 0.15) continue;   // aeusserster Rand (ab 95,5 % des Radius): 30 % der sichtbaren Vierecke, Raster dort < 15 % sichtbar
      const Xa = R * cf * sa, Ya = -R * (cL * sf - sL * cf * ca), Xe = R * cf * se, Ye = -R * (cL * sf - sL * cf * ce), L = ST[b + 8];
      const mxx = L > 0 ? (Xe - Xa) * D / L : cm, mxy = L > 0 ? (Ye - Ya) * D / L : -sL * sm;
      lc.globalAlpha = al;
      lc.setTransform(mxx, mxy, sf * sm, cL * cf + sL * sf * cm, (cx + (Xm + (Xa + Xe) / 2) / 2) * D, (cy + (Ym + (Ya + Ye) / 2) / 2) * D);
      lc.drawImage(atlas, ST[b + 9], ST[b + 10], ST[b + 11], ST[b + 12], -ST[b + 13], -ST[b + 14], ST[b + 11], ST[b + 12]);
    }
    lc.globalAlpha = 1; lc.setTransform(D, 0, 0, D, 0, 0);
  }
  // Radar-Keil (+-26 Grad, Radius R, 4,5 s je Umlauf) um die Jet-Position -
  // seit 2026-11-07 hier statt als eigene, staendig drehende Ebene (WebKit,
  // Pixeldichte 2: ohne die drehende Ebene p95 30 -> 22 ms).
  function radarMalen(t, vx, vy) {
    const w = (t % 4500) / 4500 * Math.PI * 2, b = 26 * Math.PI / 180;
    const x = vx == null ? cx : vx, y = vy == null ? cy : vy;
    lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = lc.createLinearGradient(x + R * Math.cos(w - b), y + R * Math.sin(w - b), x + R * Math.cos(w + b), y + R * Math.sin(w + b));
    g.addColorStop(0, `rgba(${o.radarRgb || '126,224,255'},0)`); g.addColorStop(1, `rgba(${o.radarRgb || '126,224,255'},${o.radarA || .4})`);
    lc.save(); lc.globalCompositeOperation = o.radarModus || 'screen';
    lc.beginPath(); lc.moveTo(x, y); lc.arc(x, y, R, w - b, w + b); lc.closePath(); lc.fillStyle = g; lc.fill();
    lc.restore();
  }
  // Marker + Ortungs-Ring + Beschriftung. Beschriftungs-Lage wie bisher:
  // GBP/EUR/CHF je Bild nach Bildschirmlage links/rechts/darunter, die
  // uebrigen mit Kollisions-Staffelung nach oben.
  function markerMalen(lon0, t, anim) {
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vis = [];
    marker.forEach(m => { const q = proj(m.lat, m.lon, lon0); if (q.vis) vis.push({ m, x: cx + q.x, y: cy + q.y }); });
    const eu = vis.filter(v => EU.includes(v.m.id)), fest = {};
    if (eu.length >= 2) {
      const s = [...eu].sort((a, b) => a.x - b.x);
      fest[s[0].m.id] = { dx: -11, dy: 3, a: 'right' };
      fest[s[s.length - 1].m.id] = { dx: 11, dy: 3, a: 'left' };
      if (s.length === 3) fest[s[1].m.id] = { dx: 0, dy: 23, a: 'center' };
    }
    mc.font = '800 11px ' + o.schrift;
    mc.lineJoin = 'round';
    const platz = [];
    vis.forEach(v => {
      const { m, x, y } = v;
      if (anim) {   // Ring: r 5 -> 15, Deckkraft .8 -> 0 in 2,2 s (wie die fruehere CSS-Animation)
        const ph = (((t / 1000) - m.i % 4 * 0.55) % 2.2 + 2.2) % 2.2 / 2.2, e = 1 - Math.pow(1 - ph, 2);
        mc.globalAlpha = 0.8 * (1 - e); mc.strokeStyle = m.col; mc.lineWidth = 1.3;
        mc.beginPath(); mc.arc(x, y, 5 + 10 * e, 0, Math.PI * 2); mc.stroke(); mc.globalAlpha = 1;
      }
      mc.beginPath(); mc.arc(x, y, 4.5, 0, Math.PI * 2); mc.fillStyle = m.col; mc.fill();
      mc.lineWidth = 1; mc.strokeStyle = o.punktRand || '#04101c'; mc.stroke();
      let lx, ly, al;
      const f = fest[m.id];
      if (f) { lx = x + f.dx; ly = y + f.dy; al = f.a; }
      else {
        const halfW = 15 + m.label.length * 2.6; let off = -8, k = true;
        while (k) { k = false; for (const q of platz) if (Math.abs(x - q.x) < halfW + q.halfW && Math.abs((y + off) - q.ly) < 13) { off -= 12; k = true; break; } }
        platz.push({ x, ly: y + off, halfW }); lx = x; ly = y + off; al = 'center';
      }
      mc.textAlign = al; mc.textBaseline = 'alphabetic';
      mc.lineWidth = 2.5; mc.strokeStyle = o.schriftRand || '#04101c'; mc.strokeText(m.label, lx, ly);
      mc.fillStyle = m.col; mc.fillText(m.label, lx, ly);
    });
  }
  return {
    land(r) { const eps = o.kuesteRoh ? 0 : KUESTE_PX / (R * Math.PI / 180); ringe = (r || []).map(x => gegenUhr(kuesteVereinfachen(x, eps))).filter(x => x.length >= 3); pre = ringe.map(vorrechnen); rasterBauen(); },
    punkte() { return ringe.reduce((n, x) => n + x.length, 0); },
    raster() { return RQ; },
    meta(m) { marker = m || []; },
    bild(lon0, t, anim, vx, vy) { landMalen(lon0); if (anim) radarMalen(t, vx, vy); markerMalen(lon0, t, anim); },
  };
}
