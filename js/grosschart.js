'use strict';
// ══ GROSSER PREISCHART (Nutzer 2026-11-27, VERSION-CHECK-825) ════════════════
// Nutzer: "unten rechts Open Preischart ... dann oeffnet sich das Fenster und der Preischart ist da
// einfach nochmal groesser dargestellt. Also praktisch wie Trading View ... schoener gemacht mit der
// Skala ... komplett interaktiv ... Ich brauche ... die ganzen Analyse-Sachen [nicht] ... ueberleg dir
// noch ein paar Sachen ... Bau die direkt ein. Mach Vorschlag 1 bis 5 ... in dem kleinen Preischart ...
// nicht mehr die Marker ... die sollen nur noch in dem grossen Chart drin sein, damit man die dort
// besser anordnen kann".
// Canvas statt des gestreckten Karten-SVGs (240x100, preserveAspectRatio none): scharfe Achsen, freies
// Zoomen/Verschieben. DIESELBEN Daten wie die Karte: tagesKerzen(preisReiheAnzeige), EMA 1D/4H samt
// Neutralband (abTrendOverlayDaten, Schalter der Karte), Gameplan-Linien (gpNiveaus), eigene Marker =
// research.notes mit pm (wie bisher, nur jetzt hier gezeichnet und verschoben).
// Bedienung: Ziehen = verschieben, Rad/zwei Finger = zoomen, Preisachse ziehen = strecken, Doppeltipp = zurueck.
// Vorschlaege (Nutzer entscheidet spaeter, was bleibt):
//   V1 Legende wie TradingView (O/H/L/C, Veraenderung, EMA-Werte) unter dem Fadenkreuz
//   V2 letzter Kurs: gestrichelte Linie + Preisschild an der Achse
//   V3 Release-Tage als Striche an der Zeitachse (Beat/Miss-Farbe), Releases des Tages in der Legende
//   V4 Log-Skala + "Auto" (Preisachse zurueck)
//   V5 Tastatur (<- -> Kerze, + - Zoom, Pos1 letzter Kurs) + Bild speichern (PNG)

let H = null;
export function gcHelfer(h) { H = h; }

const AX_R = 72, AX_B = 30, REL_H = 6;
const RANGES = [['3M', 63], ['6M', 126], ['1Y', 252], ['3Y', 756], ['MAX', Infinity]];
const S = { id: null, kz: [], ov: [], niv: [], rel: {}, notes: [], i0: 0, i1: 0, manY: false, yLo: 0, yHi: 1, log: false,
  hov: -1, hy: null, w: 0, h: 0, dpr: 1, mark: null, start: null, archivN: 0, einheit: '' };
const el = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
const kl = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Daten ────────────────────────────────────────────────────────────────────
function laden() {
  const id = S.id;
  const roh = H.preisReiheAnzeige(id) || [];
  S.kz = H.tagesKerzen(roh, id) || [];
  const lin = String(H.abTrendLinien() || '').split(',').filter(Boolean);
  try { S.ov = H.abTrendOverlayDaten(id, S.kz, lin) || []; } catch (e) { S.ov = []; }
  S.ovIdx = S.ov.map(o => { const m = new Map(o.pkte.map(p => [p.d, p])); return { k: o.k, m }; });
  try { S.niv = H.gpNiveaus(id) || []; } catch (e) { S.niv = []; }
  try { S.rel = H.pkReleases(id) || {}; } catch (e) { S.rel = {}; }
  S.notes = H.resNotes().filter(n => n && n.pm && n.pm.a === id && n.pm.d);
  S.idx = new Map(S.kz.map((c, i) => [c.d, i]));
  S.einheit = H.YIELD_CCY[id] ? '%' : '';
}
function naechster(d) {
  if (S.idx.has(d)) return S.idx.get(d);
  let lo = 0, hi = S.kz.length - 1; if (hi < 0) return -1;
  if (d <= S.kz[0].d) return 0; if (d >= S.kz[hi].d) return hi;
  while (lo < hi) { const m = (lo + hi) >> 1; if (S.kz[m].d < d) lo = m + 1; else hi = m; }
  return lo;
}

// ── Oeffnen ──────────────────────────────────────────────────────────────────
export function gcAuf(id) {
  S.id = id; S.manY = false; S.log = false; S.hov = -1; S.mark = null;
  try { if (!H.FX.includes(id)) H.kerzenArchivBei(id, null); } catch (e) { }
  laden();
  const tage = H.abChartTage();   // Zeitraum der Karte als Start
  bereich(tage == null ? Infinity : Math.round(tage * (S.kz.length > 2 && H.kerzenWochenende(id) ? 1 : 5 / 7)));
  const c = H.syms().find(s => s.id === id);
  el('gcTitel').textContent = (H.FX.includes(id) ? H.korbName(id) : (c ? c.name : id)) + ' · Price';
  H.openM('mPreisGross');
  knoepfe();
  requestAnimationFrame(() => { groesse(); zeichnen(); });
  // Aelteres Kerzen-Archiv kommt nach - einmal nachladen, ohne die Ansicht zu verschieben
  let n = 0; const t = setInterval(() => { n++; const alt = S.kz.length; if (!offen()) { clearInterval(t); return; } laden(); if (S.kz.length !== alt) { const d = S.kz.length - alt; S.i0 += d; S.i1 += d; zeichnen(); } if (n > 8) clearInterval(t); }, 1000);
}
function offen() { const o = el('mPreisGross'); return o && o.style.display !== 'none'; }
function bereich(nKerzen) {
  const n = S.kz.length; if (!n) return;
  const k = Math.min(n, isFinite(nKerzen) ? nKerzen : n);
  S.i1 = n - 1 + Math.max(2, k * 0.04); S.i0 = S.i1 - k - Math.max(2, k * 0.04) + 1;
  S.start = { i0: S.i0, i1: S.i1 }; S.manY = false;
}
export function gcBereich(r) { const x = RANGES.find(z => z[0] === r); if (!x) return; bereich(x[1]); S.aktiv = r; knoepfe(); zeichnen(); }
export function gcLog() { S.log = !S.log; S.manY = false; knoepfe(); zeichnen(); }
export function gcAuto() { S.manY = false; zeichnen(); }
function knoepfe() {
  document.querySelectorAll('#gcLeiste [data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === S.aktiv));
  const lg = el('gcLogBtn'); if (lg) { lg.classList.toggle('on', S.log); lg.setAttribute('aria-pressed', String(S.log)); }
  const mk = el('gcMarkBtn'); if (mk) { mk.classList.toggle('on', !!S.mark); mk.textContent = S.mark ? '✕ Cancel' : '＋ Mark'; }
}

// ── Geometrie ────────────────────────────────────────────────────────────────
function groesse() {
  const f = el('gcFlaeche'), cv = el('gcCanvas'); if (!f || !cv) return;
  S.dpr = window.devicePixelRatio || 1; S.w = f.clientWidth; S.h = f.clientHeight;
  cv.width = Math.round(S.w * S.dpr); cv.height = Math.round(S.h * S.dpr);
  cv.style.width = S.w + 'px'; cv.style.height = S.h + 'px';
}
const pw = () => Math.max(50, S.w - AX_R), ph = () => Math.max(50, S.h - AX_B);
const slot = () => pw() / Math.max(1e-6, S.i1 - S.i0);
const xOf = i => (i - S.i0 + 0.5) * slot();
const iOf = x => x / slot() + S.i0 - 0.5;
const tv = v => S.log ? Math.log(Math.max(v, 1e-9)) : v;
const vt = t => S.log ? Math.exp(t) : t;
const yOf = v => 8 + (1 - (tv(v) - tv(S.yLo)) / ((tv(S.yHi) - tv(S.yLo)) || 1)) * (ph() - 16);
const vOf = y => vt(tv(S.yLo) + (1 - (y - 8) / (ph() - 16)) * ((tv(S.yHi) - tv(S.yLo)) || 1));
function autoY() {
  if (S.manY) return;
  const a = Math.max(0, Math.floor(S.i0)), b = Math.min(S.kz.length - 1, Math.ceil(S.i1));
  let lo = Infinity, hi = -Infinity;
  for (let i = a; i <= b; i++) { const c = S.kz[i]; if (!c) continue; lo = Math.min(lo, c.l); hi = Math.max(hi, c.h);
    S.ovIdx.forEach(o => { const p = o.m.get(c.d); if (p) { lo = Math.min(lo, p.ema - p.band); hi = Math.max(hi, p.ema + p.band); } }); }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (S.log) { lo = Math.max(lo, 1e-6); const r = Math.log(hi / lo) || 0.02; S.yLo = lo / Math.exp(r * 0.06); S.yHi = hi * Math.exp(r * 0.06); }
  else { const r = (hi - lo) || Math.abs(hi) * 0.02 || 1; S.yLo = lo - r * 0.06; S.yHi = hi + r * 0.06; }
}
function schritt(span, n) { const roh = span / n, p = Math.pow(10, Math.floor(Math.log10(roh))), f = roh / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
const zahl = v => { const a = Math.abs(v); return a >= 10000 ? v.toFixed(0) : a >= 100 ? v.toFixed(2) : a >= 1 ? v.toFixed(3) : v.toFixed(4); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Zeichnen ─────────────────────────────────────────────────────────────────
let _raf = 0;
function zeichnen() { if (_raf) return; _raf = requestAnimationFrame(() => { _raf = 0; zeichnenJetzt(); }); }
function zeichnenJetzt(ctxFremd) {
  const cv = el('gcCanvas'); if (!cv || !S.kz.length) return;
  const ctx = ctxFremd || cv.getContext('2d'), W = S.w, Hh = S.h, PW = pw(), PH = ph();
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  autoY();
  const C = { bg: css('--bg2'), t2: css('--t2'), t3: css('--t3'), bd: css('--bd'), up: css('--cndl-up'), dn: css('--cndl-dn'), t0: css('--t0'), act: css('--ui-act') };
  const font = s => `${s}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, Hh);
  // Raster + Preisachse
  // Runde Werte auch auf der Log-Skala (dort nur ungleich weit auseinander)
  const pr = schritt(S.yHi - S.yLo, Math.max(3, PH / 60)), ticks = [];
  for (let v = Math.ceil(S.yLo / pr) * pr; v <= S.yHi; v += pr) ticks.push(v);
  ctx.strokeStyle = C.bd; ctx.lineWidth = 1; ctx.globalAlpha = 0.55;
  ticks.forEach(v => { const y = Math.round(yOf(v)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); });
  // Zeitachse: Monats-/Jahreswechsel, bei engem Zoom Tage
  const a = Math.max(0, Math.floor(S.i0)), b = Math.min(S.kz.length - 1, Math.ceil(S.i1)), sl = slot();
  const zeit = []; let letztX = -1e9;
  for (let i = a; i <= b; i++) {
    const d = S.kz[i].d, p = i > 0 ? S.kz[i - 1].d : '';
    const neuJ = d.slice(0, 4) !== p.slice(0, 4), neuM = d.slice(0, 7) !== p.slice(0, 7);
    const x = xOf(i); if (x < 0 || x > PW) continue;
    let t = null;
    if (sl > 18) t = neuM ? MON[+d.slice(5, 7) - 1] + (neuJ ? ' ' + d.slice(0, 4) : '') : (+d.slice(8, 10)) + '';
    else if (neuJ) t = d.slice(0, 4); else if (neuM && sl > 1.2) t = MON[+d.slice(5, 7) - 1];
    if (t && x - letztX > 64) { zeit.push([x, t, neuJ]); letztX = x; }
  }
  zeit.forEach(([x]) => { ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, PH); ctx.stroke(); });
  ctx.globalAlpha = 1;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PW, PH); ctx.clip();
  // EMA-Band + Schattierung (wie die Karte: Bias-Ton 11 %)
  S.ov.forEach(o => {
    const pts = o.pkte.map(p => ({ i: S.idx.get(p.d), p })).filter(q => q.i != null && q.i >= a - 1 && q.i <= b + 1);
    if (pts.length < 2) return;
    ctx.fillStyle = C.t3; ctx.globalAlpha = 0.08; ctx.beginPath();
    pts.forEach((q, j) => { const x = xOf(q.i), y = yOf(q.p.ema + q.p.band); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let j = pts.length - 1; j >= 0; j--) { const q = pts[j]; ctx.lineTo(xOf(q.i), yOf(q.p.ema - q.p.band)); }
    ctx.fill(); ctx.globalAlpha = 0.11;
    pts.forEach(q => { if (!q.p.pkt) return; ctx.fillStyle = q.p.pkt > 0 ? H.BC.bull : H.BC.bear; const y1 = yOf(q.p.c), y2 = yOf(q.p.ema); ctx.fillRect(xOf(q.i) - sl / 2, Math.min(y1, y2), sl, Math.abs(y1 - y2)); });
    ctx.globalAlpha = 1; ctx.strokeStyle = o.k === 'd' ? '#7172AC' : '#8E5BE0'; ctx.lineWidth = 1.5; ctx.beginPath();
    pts.forEach((q, j) => { const x = xOf(q.i), y = yOf(q.p.ema); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  });
  // Kerzen / Linie (Einstellung der Karte)
  const linie = H.pxChartTyp() === 'line', bw = Math.max(1, Math.min(sl * (sl < 3 ? 0.9 : 0.72), 24));
  if (linie) { ctx.strokeStyle = H.BC.bull; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = a; i <= b; i++) { const x = xOf(i), y = yOf(S.kz[i].c); i > a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  else for (let i = a; i <= b; i++) {
    const c = S.kz[i], x = xOf(i), col = c.c >= c.o ? C.up : C.dn;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
    if (c.ohlc !== false && c.h != null) { ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, yOf(c.h)); ctx.lineTo(Math.round(x) + 0.5, yOf(c.l)); ctx.stroke(); }
    const yo = yOf(c.o), yc = yOf(c.c); ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)));
  }
  // Gameplan-Linien
  S.niv.forEach(nv => { const y = Math.round(yOf(nv.v)) + 0.5; ctx.strokeStyle = nv.col; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); ctx.setLineDash([]); });
  // V2: letzter Kurs
  const last = S.kz[S.kz.length - 1], lastCol = last.c >= last.o ? H.BC.bull : H.BC.bear;
  { const y = Math.round(yOf(last.c)) + 0.5; ctx.strokeStyle = lastCol; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); ctx.setLineDash([]); }
  // V3: Release-Tage an der Unterkante
  for (let i = a; i <= b; i++) { const r = S.rel[S.kz[i].d]; if (!r || !r.length) continue; const x = xOf(i);
    const farbe = (r.find(e => /blue|green|bull/i.test(e.col)) || r.find(e => /red|bear/i.test(e.col)) || r[0]).col;
    ctx.fillStyle = farbe && farbe.startsWith('var(') ? css(farbe.slice(4, -1)) : farbe || C.t3; ctx.fillRect(x - Math.max(1, Math.min(3, sl * 0.3)), PH - REL_H, Math.max(2, Math.min(6, sl * 0.6)), REL_H); }
  // Fadenkreuz
  if (S.hov >= 0 && S.hy != null && !ctxFremd) {
    ctx.strokeStyle = C.t3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; const x = Math.round(xOf(S.hov)) + 0.5, y = Math.round(S.hy) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PH); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  // Achsen
  ctx.fillStyle = C.bg; ctx.fillRect(PW, 0, AX_R, Hh); ctx.fillRect(0, PH, W, AX_B);
  ctx.strokeStyle = C.bd; ctx.beginPath(); ctx.moveTo(PW + 0.5, 0); ctx.lineTo(PW + 0.5, PH); ctx.moveTo(0, PH + 0.5); ctx.lineTo(PW, PH + 0.5); ctx.stroke();
  ctx.fillStyle = C.t3; ctx.font = font(11); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  // Keine Achsenzahl unter einem Preisschild (letzter Kurs, Gameplan, Fadenkreuz)
  const schilder = [yOf(S.kz[S.kz.length - 1].c), ...S.niv.map(nv => yOf(nv.v))].concat(S.hov >= 0 && S.hy != null && !ctxFremd ? [S.hy] : []);
  ticks.forEach(v => { const y = yOf(v); if (y > 8 && y < PH - 6 && !schilder.some(q => Math.abs(q - y) < 15)) ctx.fillText(zahl(v), PW + 8, y); });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Etiketten nicht am Rand und nicht unter dem Datum des Fadenkreuzes
  const hx = S.hov >= 0 && S.hy != null && !ctxFremd ? xOf(S.hov) : null;
  zeit.forEach(([x, t, j]) => { if (x < 22 || x > PW - 16 || (hx != null && Math.abs(x - hx) < 62)) return; ctx.font = j ? `700 ${font(11)}` : font(11); ctx.fillStyle = j ? C.t0 : C.t3; ctx.fillText(t, x, PH + AX_B / 2); });
  const schild = (y, txt, bg, fg) => { ctx.font = `700 ${font(11)}`; const hh = 20; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PW + 2, y - hh / 2, AX_R - 4, hh, 4) : ctx.rect(PW + 2, y - hh / 2, AX_R - 4, hh); ctx.fill(); ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.fillText(txt, PW + 7, y); };
  S.niv.forEach(nv => { const y = yOf(nv.v); if (y > 0 && y < PH) schild(y, zahl(nv.v), nv.col, '#fff'); });
  { const y = yOf(last.c); if (y > 0 && y < PH) schild(y, zahl(last.c), lastCol, '#fff'); }
  if (S.hov >= 0 && S.hy != null && !ctxFremd) {
    schild(S.hy, zahl(vOf(S.hy)), C.act, '#fff');
    const d = S.kz[S.hov] && S.kz[S.hov].d; if (d) { const x = xOf(S.hov), t = `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}`;
      ctx.font = `700 ${font(11)}`; const w = ctx.measureText(t).width + 14; ctx.fillStyle = C.act; ctx.fillRect(kl(x - w / 2, 0, PW - w), PH + 4, w, AX_B - 8); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, kl(x, w / 2, PW - w / 2), PH + AX_B / 2); }
  }
  if (!ctxFremd) { legende(); marker(); }
}

// V1: Legende
function legende() {
  const L = el('gcLeg'); if (!L) return;
  const i = S.hov >= 0 ? S.hov : S.kz.length - 1, c = S.kz[i]; if (!c) { L.innerHTML = ''; return; }
  const e = H.escH, f = v => e(zahl(v) + S.einheit), d = c.c - c.o, pc = c.o ? d / c.o * 100 : 0;
  const col = d >= 0 ? H.BC.bull : H.BC.bear;
  const ema = S.ovIdx.map(o => { const p = o.m.get(c.d); return p ? `<span class="gc-l-ema gc-l-${o.k}">EMA ${o.k === 'd' ? '1D' : '4H'} <b>${f(p.ema)}</b></span>` : ''; }).join('');
  const rel = (S.rel[c.d] || []).slice(0, 4).map(r => `<span class="gc-l-rel"><i style="background:${r.col}"></i>${e(r.n)} <b>${e(r.a)}</b>${r.f ? ` <em>fc ${e(r.f)}</em>` : ''}</span>`).join('');
  L.innerHTML = `<div class="gc-l-z"><b class="gc-l-d">${e(c.d)}</b>${c.ohlc !== false ? `<span>O <b style="color:${col}">${f(c.o)}</b></span><span>H <b style="color:${col}">${f(c.h)}</b></span><span>L <b style="color:${col}">${f(c.l)}</b></span>` : `<span>Prev <b>${f(c.o)}</b></span>`}<span>C <b style="color:${col}">${f(c.c)}</b></span><span style="color:${col}"><b>${d >= 0 ? '+' : ''}${e(zahl(d))}</b> (${pc >= 0 ? '+' : ''}${pc.toFixed(2)}%)</span></div>${ema ? `<div class="gc-l-z">${ema}</div>` : ''}${rel ? `<div class="gc-l-z gc-l-rels">${rel}</div>` : ''}`;
}

// ── Marker (eigene Notizen mit pm), nur hier ────────────────────────────────
function marker() {
  const M = el('gcMarker'); if (!M) return;
  // Ebene nur ueber der Chartflaeche: Kaesten ragen nie in die Achsen (dort greift sonst das Strecken nicht)
  M.style.right = AX_R + 'px'; M.style.bottom = AX_B + 'px';
  const e = H.escH, PW = pw(), PH = ph();
  let svg = '', h = '';
  S.notes.forEach(n => {
    const ai = naechster(n.pm.d); if (ai < 0) return;
    const c = S.kz[ai], ax = xOf(ai), ay = yOf((c.o + c.c) / 2);
    const bi = n.pm.bd ? naechster(n.pm.bd) : ai;
    const bx = xOf(bi), by = n.pm.bp != null ? yOf(+n.pm.bp) : ay - 60;
    if ((ax < -40 || ax > PW + 40) && (bx < -40 || bx > PW + 40)) return;
    const col = n.bias === 'bull' ? H.BC.bull : n.bias === 'bear' ? H.BC.bear : H.BC.neu;
    svg += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="1.3"/>`;
    h += `<span class="gc-dot" style="left:${ax}px;top:${ay}px;--c:${col}"></span><button type="button" class="gc-nt" data-nt="${e(n.id)}" style="left:${kl(bx, 4, PW - 4)}px;top:${kl(by, 4, PH - 4)}px;--c:${col}" title="Drag to move · tap to edit">${e(String(n.title || 'Note'))}</button>`;
  });
  if (S.mark && S.mark.d) { const ai = naechster(S.mark.d), c = S.kz[ai]; h += `<span class="gc-dot gc-dot-neu" style="left:${xOf(ai)}px;top:${yOf((c.o + c.c) / 2)}px"></span>`; }
  M.innerHTML = `<svg class="gc-mk-svg" width="${PW}" height="${PH}">${svg}</svg>${h}${S.mark ? `<span class="gc-hint">${S.mark.d ? 'Tap where the label goes' : 'Tap a candle to mark'} · Esc cancels</span>` : ''}`;
}
export function gcMark() { S.mark = S.mark ? null : { d: null }; knoepfe(); marker(); }
function markKlick(x, y) {
  if (!S.mark) return false;
  const i = kl(Math.round(iOf(x)), 0, S.kz.length - 1);
  if (!S.mark.d) { S.mark.d = S.kz[i].d; marker(); return true; }
  S.mark.bd = S.kz[i].d; S.mark.bp = +vOf(y).toPrecision(7);
  const t = el('gcMarkTi'); t.value = ''; S.markBias = 'neu'; markBiasZeigen();
  H.openM('mGcMark'); H.guardArm('mGcMark'); setTimeout(() => { try { t.focus(); } catch (e) { } }, 60);
  return true;
}
// Fuer check/eingaben.js: Marker-Fenster direkt fuer die letzte Kerze oeffnen (wie zwei Tipps in den Chart).
export function gcMarkPruef() { if (!S.kz.length) return; const c = S.kz[S.kz.length - 1]; S.mark = { d: c.d }; markKlick(xOf(S.kz.length - 1), yOf(c.c)); }
export function gcMarkBias(b) { S.markBias = S.markBias === b ? 'neu' : b; markBiasZeigen(); }
function markBiasZeigen() { document.querySelectorAll('#mGcMark [data-b]').forEach(x => x.classList.toggle('on', x.dataset.b === S.markBias)); }
export function gcMarkZustand() { return S.markBias || 'neu'; }
export function gcMarkSpeichern() {
  const t = el('gcMarkTi').value.trim(); if (!t) { alert('Please enter a text.'); return; }
  const m = S.mark; if (!m || !m.d) { H.closeM('mGcMark'); return; }
  try {
    H.pushU();
    const now = new Date().toISOString(), id = H.uid();
    H.research().notes.push({ id, fids: [], title: t, body: '', tags: ['chart'], fav: false, pin: false, arch: false, ts: now, up: now, bias: S.markBias || 'neu', evt: null, asset: '', pm: { a: S.id, d: m.d, bd: m.bd, bo: 0, bp: m.bp } });
    H.save();
  } catch (e) { alert('The note could not be saved: ' + (e && e.message || e)); return; }
  S.mark = null; H.guardArm('mGcMark'); H.closeM('mGcMark'); laden(); knoepfe(); zeichnen();
}
function markerVerschieben(nid, x, y) {
  const n = H.resNotes().find(q => q && q.id === nid && q.pm); if (!n) return;
  try {
    const i = kl(Math.round(iOf(x)), 0, S.kz.length - 1), pm = Object.assign({}, n.pm);
    pm.bd = S.kz[i].d; pm.bo = 0; pm.bp = +vOf(y).toPrecision(7); delete pm.by;
    H.pushU(); n.pm = pm; n.up = new Date().toISOString(); H.save();
  } catch (e) { alert('The note could not be moved: ' + (e && e.message || e)); }
  laden(); zeichnen();
}

// ── Bedienung ────────────────────────────────────────────────────────────────
const zeiger = new Map(); let G = null;
function zoomUm(fx, f) {
  const n = S.kz.length, ix = iOf(fx), span = kl((S.i1 - S.i0) * f, 8, Math.max(20, n * 1.3));
  const r = (ix - S.i0) / (S.i1 - S.i0); S.i0 = ix - r * span; S.i1 = S.i0 + span; begrenzen(); S.aktiv = null; knoepfe();
}
function begrenzen() { const n = S.kz.length, span = S.i1 - S.i0; if (S.i1 > n - 1 + span * 0.5) { S.i1 = n - 1 + span * 0.5; S.i0 = S.i1 - span; } if (S.i0 < -span * 0.5) { S.i0 = -span * 0.5; S.i1 = S.i0 + span; } }
function lokal(e) { const r = el('gcFlaeche').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function hoverSetzen(p) { if (p.x < 0 || p.x > pw() || p.y < 0 || p.y > ph()) { S.hov = -1; S.hy = null; } else { S.hov = kl(Math.round(iOf(p.x)), 0, S.kz.length - 1); S.hy = p.y; } }
function anbinden() {
  const f = el('gcFlaeche'); if (!f || f.dataset.an) return; f.dataset.an = '1';
  f.addEventListener('pointerdown', e => {
    const nt = e.target.closest && e.target.closest('.gc-nt');
    const p = lokal(e); zeiger.set(e.pointerId, p);
    try { f.setPointerCapture(e.pointerId); } catch (x) { }
    if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; G = { art: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 }; return; }
    G = { art: nt ? 'nt' : p.x > pw() ? 'achse' : 'pan', x: p.x, y: p.y, i0: S.i0, i1: S.i1, lo: S.yLo, hi: S.yHi, nid: nt && nt.dataset.nt, weit: false };
  });
  f.addEventListener('pointermove', e => {
    const p = lokal(e);
    if (zeiger.has(e.pointerId)) zeiger.set(e.pointerId, p);
    if (G && G.art === 'pinch' && zeiger.size === 2) { const [a, b] = [...zeiger.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 10) { zoomUm(G.mx, G.d / d); G.d = d; zeichnen(); } return; }
    if (G) {
      const dx = p.x - G.x, dy = p.y - G.y; if (Math.abs(dx) + Math.abs(dy) > 5) G.weit = true;
      if (G.art === 'pan' && G.weit && !S.mark) { const sh = dx / (pw() / (G.i1 - G.i0)); S.i0 = G.i0 - sh; S.i1 = G.i1 - sh; begrenzen(); S.aktiv = null; knoepfe(); hoverSetzen(p); zeichnen(); return; }
      if (G.art === 'achse' && G.weit) { const f2 = Math.exp(dy * 0.006), m = (G.lo + G.hi) / 2, r = (G.hi - G.lo) / 2 * f2; S.manY = true; S.yLo = m - r; S.yHi = m + r; zeichnen(); return; }
      if (G.art === 'nt' && G.weit) { const b = f.querySelector(`.gc-nt[data-nt="${CSS.escape(G.nid)}"]`); if (b) { b.style.left = kl(p.x, 4, pw() - 4) + 'px'; b.style.top = kl(p.y, 4, ph() - 4) + 'px'; } return; }
    }
    hoverSetzen(p); zeichnen();
  });
  const ende = e => {
    const p = lokal(e); zeiger.delete(e.pointerId);
    if (G && G.art === 'nt') { if (G.weit) markerVerschieben(G.nid, kl(p.x, 4, pw() - 4), kl(p.y, 4, ph() - 4)); else { try { H.openResNote(G.nid); } catch (x) { alert('The note could not be opened.'); } } }
    else if (G && G.art === 'pan' && !G.weit) markKlick(p.x, p.y);
    if (!zeiger.size) G = null;
  };
  f.addEventListener('pointerup', ende); f.addEventListener('pointercancel', e => { zeiger.delete(e.pointerId); G = null; });
  f.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !G) { S.hov = -1; S.hy = null; zeichnen(); } });
  f.addEventListener('wheel', e => {
    e.preventDefault(); const p = lokal(e);
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const d = (e.deltaX || e.deltaY) / slot(); S.i0 += d; S.i1 += d; begrenzen(); }
    else zoomUm(p.x, Math.exp(e.deltaY * 0.0015));
    hoverSetzen(p); zeichnen();
  }, { passive: false });
  f.addEventListener('dblclick', () => { if (S.start) { S.i0 = S.start.i0; S.i1 = S.start.i1; } S.manY = false; zeichnen(); });
  new ResizeObserver(() => { if (offen()) { groesse(); zeichnen(); } }).observe(f);
  // V5: Tastatur
  document.addEventListener('keydown', e => {
    if (!offen() || (el('mGcMark') && el('mGcMark').style.display !== 'none') || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    const n = S.kz.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (S.hov < 0) S.hov = n - 1; S.hov = kl(S.hov + (e.key === 'ArrowLeft' ? -1 : 1), 0, n - 1); const c = S.kz[S.hov]; S.hy = yOf(c.c); if (xOf(S.hov) < 0 || xOf(S.hov) > pw()) { const sp = S.i1 - S.i0; S.i0 = S.hov - sp / 2; S.i1 = S.i0 + sp; begrenzen(); } zeichnen(); }
    else if (e.key === '+' || e.key === '=') { zoomUm(pw() / 2, 0.8); zeichnen(); }
    else if (e.key === '-') { zoomUm(pw() / 2, 1.25); zeichnen(); }
    else if (e.key === 'Home') { const sp = S.i1 - S.i0; S.i1 = n - 1 + sp * 0.04; S.i0 = S.i1 - sp; zeichnen(); }
    else if (e.key === 'Escape' && S.mark) { e.stopPropagation(); S.mark = null; knoepfe(); marker(); }
  }, true);
}
// V5: Bild speichern (mit Markern als Kaesten)
export function gcBild() {
  try {
    const cv = el('gcCanvas'), out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
    const ctx = out.getContext('2d'); zeichnenJetzt(ctx);
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.font = `600 12px ${getComputedStyle(document.body).fontFamily}`;
    el('gcFlaeche').querySelectorAll('.gc-nt').forEach(b => { const x = parseFloat(b.style.left), y = parseFloat(b.style.top), w = ctx.measureText(b.textContent).width + 16;
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 12, w, 24); ctx.strokeStyle = getComputedStyle(b).getPropertyValue('--c'); ctx.strokeRect(x, y - 12, w, 24); ctx.fillStyle = '#141B2E'; ctx.textBaseline = 'middle'; ctx.fillText(b.textContent, x + 8, y); });
    const a = document.createElement('a'); a.href = out.toDataURL('image/png'); a.download = `${S.id}-${S.kz[S.kz.length - 1].d}.png`; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { alert('The image could not be saved: ' + (e && e.message || e)); }
}
export function gcStart() { anbinden(); }
export function gcZustand() { return { id: S.id, i0: S.i0, i1: S.i1, n: S.kz.length, lo: S.yLo, hi: S.yHi, log: S.log, hov: S.hov, mark: S.mark, notes: S.notes.length }; }
Object.assign(window, { gcMarkPruef, gcAuf, gcBereich, gcLog, gcAuto, gcMark, gcMarkBias, gcMarkSpeichern, gcBild, gcZustand });
