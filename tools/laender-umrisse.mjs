// Laender-Umrisse fuer die 1D-Kacheln der Dashboard-"Market overview"
// (Nutzer 2026-11-07: "bei den Assets wenn da ein Tag ausgewaehlt ist will ich
// nicht die eine Kerze sondern ein Bild von dem Land also der Umriss davon").
//
// Quelle: Natural Earth Admin 0 (1:50m) ueber das npm-Paket world-atlas@2.0.2
// (TopoJSON, ISO-3166-Zifferncodes) - dieselbe Quelle wie globe_land.json,
// public domain. EUR = Vereinigung aller Euro-Laender (ohne innere Grenzen),
// nur der europaeische Teil (Frankreichs Ueberseegebiete, Kanaren etc. fallen
// heraus). USD = die zusammenhaengenden 48 Staaten (Alaska/Hawaii wuerden den
// Umriss auf Briefmarkengroesse schrumpfen).
//
// Aufruf (einmalig, Ergebnis country_shapes.json wird eingecheckt):
//   npm i --prefix <ordner> world-atlas@2.0.2 topojson-client@3.1.0
//   NODE_PATH=<ordner>/node_modules node tools/laender-umrisse.mjs <ordner>/node_modules
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const nm = process.argv[2];
if (!nm) { console.error('Pfad zu node_modules (mit world-atlas, topojson-client) angeben'); process.exit(1); }
const req = createRequire(path.join(path.resolve(nm), 'x.js'));
const topo = req('topojson-client');
const welt = JSON.parse(fs.readFileSync(path.join(nm, 'world-atlas/countries-50m.json'), 'utf8'));
const geos = welt.objects.countries.geometries;

// Euro-Raum Stand 2026 (21 Laender; Bulgarien seit 2026-01-01)
const EURO = ['040', '056', '100', '191', '196', '233', '246', '250', '276', '300', '372', '380', '428', '440', '442', '470', '528', '620', '703', '705', '724'];
const ZIEL = {
  USD: { ids: ['840'], box: [-130, 24, -66, 50] },
  EUR: { ids: EURO, box: [-25, 34, 45, 72] },
  GBP: { ids: ['826'] },
  JPY: { ids: ['392'] },
  CHF: { ids: ['756'] },
  CAD: { ids: ['124'] },
  AUD: { ids: ['036'], box: [110, -45, 155, -9] },
  NZD: { ids: ['554'], box: [165, -48, 179.9, -33] },
  DE:  { ids: ['276'] },   // DAX
};

// Ring-Flaeche (Grad^2, nur zum Sortieren/Aussieben)
const flaeche = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
// Douglas-Peucker (geschlossener Ring: an seinem entferntesten Punkt teilen,
// sonst fallen Anfang = Ende zusammen und der Ring schrumpft auf 2 Punkte)
function dpRing(r, eps) {
  let k = 0, md = -1; r.forEach((p, i) => { const d = Math.hypot(p[0] - r[0][0], p[1] - r[0][1]); if (d > md) { md = d; k = i; } });
  return [...dp(r.slice(0, k + 1), eps).slice(0, -1), ...dp(r.slice(k), eps)];
}
function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const aus = { quelle: 'Natural Earth Admin 0 1:50m via world-atlas@2.0.2 (public domain)', aufbereitung: 'Aussenringe, EUR vereinigt, Douglas-Peucker eps 0,5 % der Ausdehnung, Inseln ab 1 % der groessten Flaeche, Format [lat, lon]', laender: {} };
for (const [k, z] of Object.entries(ZIEL)) {
  const sel = geos.filter(g => z.ids.includes(String(g.id).padStart(3, '0')));
  if (new Set(sel.map(g => g.id)).size !== z.ids.length) throw new Error(`${k}: ${sel.length} von ${z.ids.length} Laendern gefunden`);
  const geo = topo.merge(welt, sel);   // eine MultiPolygon-Flaeche ohne innere Grenzen
  let ringe = geo.coordinates.map(poly => poly[0]);   // nur Aussenringe
  if (z.box) { const [x0, y0, x1, y1] = z.box; ringe = ringe.filter(r => r.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)); }
  const amax = Math.max(...ringe.map(flaeche));
  // Toleranz relativ zur Ausdehnung (0,5 %): die Kachel zeigt jedes Land gleich gross
  const xs = ringe.flat().map(p => p[0]), ys = ringe.flat().map(p => p[1]);
  const eps = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.005;
  ringe = ringe.filter(r => flaeche(r) >= amax * 0.01).map(r => dpRing(r, eps)).filter(r => r.length >= 4);
  // Schwerpunkt (flaechengewichtet ueber die Ringe) fuer die Kugel-Ansicht
  let sx = 0, sy = 0, sa = 0;
  ringe.forEach(r => { const a = flaeche(r); const cx = r.reduce((s, p) => s + p[0], 0) / r.length, cy = r.reduce((s, p) => s + p[1], 0) / r.length; sx += cx * a; sy += cy * a; sa += a; });
  aus.laender[k] = {
    mitte: [Math.round(sy / sa * 100) / 100, Math.round(sx / sa * 100) / 100],
    ringe: ringe.map(r => r.map(([x, y]) => [Math.round(y * 1000) / 1000, Math.round(x * 1000) / 1000])),
  };
  console.log(k.padEnd(4), String(ringe.length).padStart(3), 'Ringe', String(ringe.reduce((n, r) => n + r.length, 0)).padStart(5), 'Punkte', 'Mitte', aus.laender[k].mitte.join(', '));
}
fs.writeFileSync('country_shapes.json', JSON.stringify(aus));
console.log('country_shapes.json', (fs.statSync('country_shapes.json').size / 1024).toFixed(1), 'KB');
