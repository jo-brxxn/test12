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
// o = {size, dpr, lat0, landfarbe, schrift, rasterFarbe}
// Ringe: [[lat,lon], ...] je Polygon. Marker: [{id,lat,lon,col,label,i}].

const MIN_PX = 0.6;
const SQ = 4.2, SI = 0.55, SW = SQ - 2 * SI;     // Raster wie das fruehere SVG-<pattern>
const EU = ['GBP', 'EUR', 'CHF'];

function neueFlaeche(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;   // Rueckfall Hauptthread
}

export function erstelleZeichner(landCv, markerCv, o) {
  const dpr = o.dpr, size = o.size, R = size / 2 - 26, cx = size / 2, cy = size / 2;
  const sL = Math.sin(o.lat0), cL = Math.cos(o.lat0);
  [landCv, markerCv].forEach(c => { c.width = Math.round(size * dpr); c.height = Math.round(size * dpr); });
  const lc = landCv.getContext('2d'), mc = markerCv.getContext('2d');
  // Musterkachel direkt in Geraetepixeln: 5x5 Vierecke = 21 px je dpr-Einheit
  // (ganzzahlig fuer dpr 1 und 2), Grund in Landfarbe -> EIN Malvorgang je Bild.
  const N = 5, kachel = neueFlaeche(Math.round(SQ * N * dpr), Math.round(SQ * N * dpr));
  const kc = kachel.getContext('2d');
  kc.fillStyle = o.landfarbe; kc.fillRect(0, 0, kachel.width, kachel.height);
  kc.strokeStyle = o.rasterFarbe; kc.lineWidth = 0.4 * dpr;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) kc.strokeRect((i * SQ + SI) * dpr, (j * SQ + SI) * dpr, SW * dpr, SW * dpr);
  const muster = lc.createPattern(kachel, 'repeat');
  try { muster.setTransform(new DOMMatrix().scale(1 / dpr)); } catch (e) {}

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
    let lx = 1e9, ly = 1e9, offen = false;
    const add = (x, y) => { if (offen) p.lineTo(cx + x, cy + y); else { p.moveTo(cx + x, cy + y); offen = true; } lx = x; ly = y; };
    for (let i = 0; i < n; i++) {
      const j = i + 1 < n ? i + 1 : 0, w = V[i] !== V[j];
      if (V[i] && (w || Math.abs(X[i] - lx) >= MIN_PX || Math.abs(Y[i] - ly) >= MIN_PX)) add(X[i], Y[i]);
      if (w) { const h = horizont(pts[i], pts[j], lon0); add(h.x, h.y); }
    }
    // kein closePath(): fill() schliesst selbst - closePath kostete 2,3 ms je Bild
  }
  function landMalen(lon0) {
    lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    lc.clearRect(0, 0, size, size);
    const p = new Path2D();
    for (let k = 0; k < ringe.length; k++) ring(k, lon0, p);
    lc.fillStyle = muster; lc.fill(p);
  }
  // Marker + Ortungs-Ring + Beschriftung. Beschriftungs-Lage wie bisher:
  // GBP/EUR/CHF je Bild nach Bildschirmlage links/rechts/darunter, die
  // uebrigen mit Kollisions-Staffelung nach oben.
  function markerMalen(lon0, t, anim) {
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.clearRect(0, 0, size, size);
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
      mc.lineWidth = 1; mc.strokeStyle = '#04101c'; mc.stroke();
      let lx, ly, al;
      const f = fest[m.id];
      if (f) { lx = x + f.dx; ly = y + f.dy; al = f.a; }
      else {
        const halfW = 15 + m.label.length * 2.6; let off = -8, k = true;
        while (k) { k = false; for (const q of platz) if (Math.abs(x - q.x) < halfW + q.halfW && Math.abs((y + off) - q.ly) < 13) { off -= 12; k = true; break; } }
        platz.push({ x, ly: y + off, halfW }); lx = x; ly = y + off; al = 'center';
      }
      mc.textAlign = al; mc.textBaseline = 'alphabetic';
      mc.lineWidth = 2.5; mc.strokeStyle = '#04101c'; mc.strokeText(m.label, lx, ly);
      mc.fillStyle = m.col; mc.fillText(m.label, lx, ly);
    });
  }
  return {
    land(r) { ringe = r || []; pre = ringe.map(vorrechnen); },
    meta(m) { marker = m || []; },
    bild(lon0, t, anim) { landMalen(lon0); markerMalen(lon0, t, anim); },
  };
}
