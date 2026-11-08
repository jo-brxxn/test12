// ══ BILD STATT TAGESKERZE IN DEN 1D-KACHELN (Dashboard "Market overview") ══
// Nutzer 2026-11-07: "bei den Assets wenn da ein Tag ausgewaehlt ist will ich
// nicht die eine Kerze sondern ein Bild von dem Land also der Umriss davon so
// gib mir da 3 Moeglichkeiten ... Auch so ein Bild wie die Kugel oder halt das
// fx Analyse pro logo". Drei Varianten gebaut (Umriss, kleine Kugel, Logo);
// Nutzer-Wahl 2026-11-08: "Ich will die Option outline" -> nur der Umriss.
// Paar: Basis + Quote; Basis in der Farbe der Tagesveraenderung, Quote neutral.
// Assets ohne Land (Gold, Silber, Oel, Krypto) zeigen ihr eigenes Symbol gross
// - es gibt kein Land, das man zeigen koennte.
// Umrisse: country_shapes.json (tools/laender-umrisse.mjs, Natural Earth).
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

// HTML fuer den Bildbereich einer 1D-Kachel.
//   laender: aus kachelLaender(); farbe: CSS-Farbe der Tagesveraenderung;
//   icon: Symbol-HTML fuer Assets ohne Land
export function kachelBildHtml(laender, farbe, icon) {
  if (!laender.length) return `<div class="dx-kb dx-kb-ic">${icon || ''}</div>`;
  if (!FORM) return `<div class="dx-kb"></div>`;   // Umrisse laden noch (wenige Millisekunden)
  return `<div class="dx-kb">${laender.map((k, i) => (i ? '<span class="dx-kb-tr">/</span>' : '') + umrissSvg(k, i ? 'var(--t3)' : farbe, !i)).join('')}</div>`;
}
