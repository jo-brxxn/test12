// ══ BILD STATT TAGESKERZE IN DEN 1D-KACHELN (Dashboard "Market overview") ══
// Nutzer 2026-11-07: "bei den Assets wenn da ein Tag ausgewaehlt ist will ich
// nicht die eine Kerze sondern ein Bild von dem Land also der Umriss davon so
// gib mir da 3 Moeglichkeiten ... Auch so ein Bild wie die Kugel oder halt das
// fx Analyse pro logo". Drei Varianten zur Auswahl (Schalter in der Karte,
// nur fuer diese Sitzung, bis der Nutzer gewaehlt hat):
//   'umriss' = Laender-Umriss (Paar: Basis + Quote; Basis in der Farbe der
//              Tagesveraenderung, Quote neutral)
//   'kugel'  = kleine Kugel, auf das Land gedreht, Land hervorgehoben + Punkt
//   'logo'   = FX-Analyst-Pro-Logo
// Assets ohne Land (Gold, Silber, Oel, Krypto) zeigen in 'umriss'/'kugel' ihr
// eigenes Symbol gross - es gibt kein Land, das man zeigen koennte.
// Umrisse: country_shapes.json (tools/laender-umrisse.mjs, Natural Earth).
import { GLOBE_LAND } from './globe.js';

let FORM = null, _laedt = false;
const _wartende = [];
export function kachelFormenLaden(fertig) {
  if (FORM) { if (fertig) fertig(); return; }
  if (fertig) _wartende.push(fertig);
  if (_laedt) return;
  _laedt = true;
  fetch('country_shapes.json', { cache: 'force-cache' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(j => { if (!j || !j.laender || !j.laender.USD) throw new Error('unbrauchbarer Inhalt'); FORM = j.laender; _wartende.splice(0).forEach(f => f()); })
    .catch(e => { console.log('[kachelbild] Laender-Umrisse nicht geladen (' + (e && e.message || e) + ')'); });
}
export const kachelFormenDa = () => !!FORM;

// Welche Laender gehoeren zu einer Kachel? FX-Paar: beide Waehrungsraeume;
// Index: sein Land; sonst keins.
const ASSET_LAND = { SP500: 'USD', NAS: 'USD', DAX: 'DE' };
export function kachelLaender(n, assetId) {
  const fx = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'];
  const t = String(n || '').split('/');
  if (t.length === 2 && fx.includes(t[0]) && fx.includes(t[1])) return t;
  return ASSET_LAND[assetId] ? [ASSET_LAND[assetId]] : [];
}

// ── Umriss als SVG (Flaechentreue lokal: Laenge x cos(mittlere Breite)) ──
const _umrissCache = new Map();
function umrissPfad(k) {
  if (_umrissCache.has(k)) return _umrissCache.get(k);
  const f = FORM && FORM[k]; if (!f) return null;
  const c = Math.cos(f.mitte[0] * Math.PI / 180);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ringe = f.ringe.map(r => r.map(([la, lo]) => { const x = lo * c, y = -la; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; return [x, y]; }));
  const s = 100 / Math.max(x1 - x0, y1 - y0);   // laengere Seite = 100 Einheiten
  const d = ringe.map(r => 'M' + r.map(([x, y]) => ((x - x0) * s).toFixed(1) + ' ' + ((y - y0) * s).toFixed(1)).join('L') + 'Z').join('');
  const out = { d, w: (x1 - x0) * s, h: (y1 - y0) * s };
  _umrissCache.set(k, out);
  return out;
}
function umrissSvg(k, farbe, stark) {
  const u = umrissPfad(k); if (!u) return '';
  const p = 4, w = u.w + 2 * p, h = u.h + 2 * p;
  return `<svg class="dx-kb-u" viewBox="${-p} ${-p} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" style="aspect-ratio:${(w / h).toFixed(3)}" aria-hidden="true"><path d="${u.d}" fill="${farbe}" fill-opacity="${stark ? .3 : .14}" stroke="${farbe}" stroke-width="${stark ? 1.6 : 1.2}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

// ── Kleine Kugel: einmal je Land auf ein Canvas gezeichnet, als Bild gemerkt ──
const GLOBUS_MEER = '#0e2c55', GLOBUS_LAND = '#3474b4', GLOBUS_HELL = '#9fd8ff';
const _kugelCache = new Map();
function kugelBild(k, px) {
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3), key = k + '|' + px + '|' + dpr;
  if (_kugelCache.has(key)) return _kugelCache.get(key);
  const f = FORM && FORM[k]; if (!f) return null;
  const cv = document.createElement('canvas'); cv.width = cv.height = Math.round(px * dpr);
  const g = cv.getContext('2d'); if (!g) return null;
  g.scale(dpr, dpr);
  const R = px / 2 - 1, cx = px / 2, cy = px / 2;
  const f0 = f.mitte[0] * Math.PI / 180, l0 = f.mitte[1] * Math.PI / 180, sf0 = Math.sin(f0), cf0 = Math.cos(f0);
  // Orthografisch wie die grosse Kugel (js/globe-zeichnen.js): nur sichtbare
  // Punkte + Schnittpunkt mit dem Horizont an jedem Wechsel. GEMESSEN: Punkte
  // hinter dem Horizont auf den Rand zu legen ergab Keile quer ueber die Kugel
  // (NZD-Ansicht ganz zugedeckt).
  const cosc = (la, lo) => { const f1 = la * Math.PI / 180, dl = lo * Math.PI / 180 - l0; return sf0 * Math.sin(f1) + cf0 * Math.cos(f1) * Math.cos(dl); };
  const proj = (la, lo) => {
    const f1 = la * Math.PI / 180, dl = lo * Math.PI / 180 - l0, cf = Math.cos(f1);
    return [cx + R * cf * Math.sin(dl), cy - R * (cf0 * Math.sin(f1) - sf0 * cf * Math.cos(dl))];
  };
  const horizont = (a, b) => { let t0 = 0, t1 = 1; const va = cosc(a[0], a[1]) > 0; for (let i = 0; i < 16; i++) { const t = (t0 + t1) / 2; if ((cosc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) > 0) === va) t0 = t; else t1 = t; } const t = (t0 + t1) / 2; return proj(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); };
  const flaeche = (ringe, farbe, rand) => {
    g.beginPath();
    ringe.forEach(r => { let offen = false; const add = ([x, y]) => { if (offen) g.lineTo(x, y); else { g.moveTo(x, y); offen = true; } };
      for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], va = cosc(a[0], a[1]) > 0; if (va) add(proj(a[0], a[1])); if (va !== (cosc(b[0], b[1]) > 0)) add(horizont(a, b)); }
      if (offen) g.closePath(); });
    g.fillStyle = farbe; g.fill();
    if (rand) { g.strokeStyle = rand; g.lineWidth = .8; g.stroke(); }
  };
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = GLOBUS_MEER; g.fill(); g.clip();
  flaeche(GLOBE_LAND, GLOBUS_LAND);
  flaeche(f.ringe, GLOBUS_HELL, 'rgba(255,255,255,.9)');
  // Licht von links oben + Rand
  const lg = g.createRadialGradient(cx - R * .45, cy - R * .5, R * .1, cx, cy, R * 1.05);
  lg.addColorStop(0, 'rgba(255,255,255,.14)'); lg.addColorStop(.65, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.22)');
  g.fillStyle = lg; g.fillRect(0, 0, px, px);
  g.restore();
  // Ring um kleine Laender (Schweiz: ~2 px auf der Kugel, sonst unsichtbar)
  const [mx, my] = proj(f.mitte[0], f.mitte[1]);
  const xs = f.ringe.flat().map(p => p[1]), gross = Math.max(...xs) - Math.min(...xs) > 12;
  if (!gross) { g.beginPath(); g.arc(mx, my, px * .1, 0, Math.PI * 2); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke(); }
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.strokeStyle = 'rgba(143,208,255,.55)'; g.lineWidth = 1; g.stroke();
  let url = null; try { url = cv.toDataURL('image/png'); } catch (e) { url = null; }
  if (url) _kugelCache.set(key, url);
  return url;
}

// HTML fuer den Bildbereich einer 1D-Kachel.
//   art: 'umriss' | 'kugel' | 'logo'; laender: aus kachelLaender();
//   farbe: CSS-Farbe der Tagesveraenderung; icon: Symbol-HTML fuer Assets ohne Land
export function kachelBildHtml(art, laender, farbe, icon) {
  if (art === 'logo') return `<div class="dx-kb dx-kb-logo">${window.fxLogoSvg ? window.fxLogoSvg('') : ''}</div>`;
  if (!laender.length) return `<div class="dx-kb dx-kb-ic">${icon || ''}</div>`;
  if (!FORM) return `<div class="dx-kb"></div>`;   // Umrisse laden noch (wenige Millisekunden)
  if (art === 'kugel') {
    const bilder = laender.map(k => kugelBild(k, 52)).filter(Boolean);
    return `<div class="dx-kb dx-kb-k">${bilder.map((u, i) => (i ? '<span class="dx-kb-tr">/</span>' : '') + `<img src="${u}" width="52" height="52" alt="" draggable="false">`).join('')}</div>`;
  }
  return `<div class="dx-kb">${laender.map((k, i) => (i ? '<span class="dx-kb-tr">/</span>' : '') + umrissSvg(k, i ? 'var(--t3)' : farbe, !i)).join('')}</div>`;
}
