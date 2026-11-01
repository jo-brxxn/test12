// ══ PRICE-KARTE NEU: DREI ENTWUERFE (TEMPORAER, Nutzer 2026-11-01) ════════════
// Nutzer (mit TradingView-Screenshot, roter Pfeil ueber einer Kerze):
// "Entfern den Button preischart oben in der Leiste. Dann will ich das die
// Karte Price die volle Breite einnimmt und die Kalender Karte rechts neben
// die history Karte kommt ... Im Chart sollen die stellen markiert sein wo
// neue Fundamentale Daten herausgekommen sind ... je nach dem ob die News gut
// oder schlecht waren soll der Pfeil auch eine Farbe haben ... Klickt man auf
// den Pfeil soll links am Rand neben dem Chart ... eine kleine Spalte sein wo
// die naechsten zukunftsevents stehen. Die wird dann fuer die Zeit wo man den
// Pfeil markiert hat leer gemacht und da stehen dann die Ereignisse drinne die
// an dem Tag waren. Wenn man ins nichts klickt ... kommen wieder
// zukunftsevents ... unter dem Event stehen actual - forecast ... previous ...
// Und im Chart selber soll es die Funktion geben selber so Pfeile
// hinzuzufuegen ... erst die Stelle auswaehlen und dann kommt ein Fenster wo
// man sagt was und ob es halt gut oder schlecht oder neutral war ... fuehr das
// erstmal grafisch aus und gib mir ein paar Optionen ... Fokus auf Uebersicht
// ... auch Animationen verwenden da wo sich etwas wechselt".
//   A = Seitenliste + Zeiger-Pfeile + Fenster
//   B = Karten + Stecknadeln + Tagesband + Popover an der Kerze
//   C = Inspektor + Richtungs-Symbole + Bewegungsspur (Auffaelligkeiten)
// ECHTE Daten (Regel 4): Kerzen aus preisReiheAnzeige/tagesKerzen, Releases
// aus priceEventsByDay (Farbe = actualColor, dieselbe wie im Kalender), Next
// up aus getSymEventsAll. Eigene Pfeile leben hier nur im Speicher.
// ⚠ Nach der Entscheidung KOMPLETT entfernen: diese Datei, der Import und der
// Aufruf in js/main.js.
// Nicht unter navigator.webdriver (Waechter); Id fdOv raeumen die Waechter
// ohnehin weg. Erzwingen: ?preisdemo in der Adresse.
import { BC } from './constants.js';

const CSS = `
.pd-ov{position:fixed;inset:0;z-index:9800;background:rgba(10,16,30,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 16px;animation:pdFade .25s ease-out}
@keyframes pdFade{from{opacity:0}to{opacity:1}}
.pd-box{width:min(1240px,100%);background:var(--bg1);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--shadow-pop);color:var(--t1);animation:pdRein .35s cubic-bezier(.2,.8,.3,1)}
@keyframes pdRein{from{translate:0 14px;opacity:0}to{translate:0 0;opacity:1}}
.pd-hd{position:sticky;top:-24px;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 18px;border-bottom:1px solid var(--bd);background:var(--bg1);border-radius:14px 14px 0 0}
.pd-hd-t{font:800 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0)}
.pd-hd-s{color:var(--t2);font-size:var(--fs-sm)}
.pd-hd-r{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pd-hd .btn{height:34px}
.pd-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--bd2);border-radius:9px;background:var(--bg2)}
.pd-seg button{height:28px;min-width:40px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--t2);font:700 var(--fs-xs)/1 var(--ff-text);cursor:pointer;transition:background .18s,color .18s}
.pd-seg button.on{background:var(--ui-act);color:var(--ui-act-fg)}
.pd-sek{padding:16px 18px 20px;border-bottom:1px solid var(--bd)}
.pd-sek:last-child{border-bottom:0}
.pd-ot{font:800 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0);margin-bottom:6px}
.pd-ot b{color:var(--blue)}
.pd-pkt{margin:0 0 12px;padding-left:18px;font-size:var(--fs-sm);line-height:1.55;color:var(--t1)}
.pd-pkt i{color:var(--t2)}
/* Seitenaufbau-Schema */
.pd-lay{display:grid;gap:6px;max-width:760px}
.pd-lay-r{display:grid;gap:6px;grid-template-columns:1fr}
.pd-lay-r.drei{grid-template-columns:repeat(3,1fr)}
.pd-blk{height:30px;border:1px solid var(--bd2);border-radius:8px;background:var(--bg2);display:flex;align-items:center;padding:0 10px;font:700 var(--fs-xs)/1 var(--ff-text);color:var(--t1);gap:8px}
.pd-blk.gross{height:64px;border-color:var(--ui-act);background:rgba(var(--ui-act-rgb),.07);color:var(--t0)}
.pd-blk.neu{border-color:var(--ui-act)}
.pd-blk.leise{color:var(--t2);font-weight:600;border-style:dashed}
.pd-blk em{font-style:normal;font-weight:600;color:var(--t2)}
.pd-kopfz{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}
.pd-kopfz span{height:28px;display:inline-flex;align-items:center;padding:0 10px;border-radius:7px;border:1px solid var(--bd2);background:var(--bg2);font:700 var(--fs-xs)/1 var(--ff-text);color:var(--t1)}
.pd-kopfz span.weg{text-decoration:line-through;color:var(--red);border-color:rgba(220,36,48,.4);background:rgba(220,36,48,.06)}
/* Karte */
.pd-card{container-type:inline-size;position:relative;background:var(--bg1);border:1px solid var(--bd);border-radius:14px;padding:14px 16px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.pd-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}
.pd-tt{font:700 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0)}
.pd-ts{font-size:var(--fs-xs);color:var(--t2);font-weight:600}
.pd-chg{height:24px;display:inline-flex;align-items:center;padding:0 8px;border-radius:7px;font:800 var(--fs-xs)/1 var(--ff-num)}
.pd-tr{margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pd-disp{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:8px;border:1px solid var(--bd2);background:var(--bg2);color:var(--t1);font:600 var(--fs-xs)/1 var(--ff-text)}
.pd-disp em{font-style:normal;color:var(--t2)}
.pd-add{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 11px;border-radius:8px;border:1px solid var(--ui-act);background:var(--bg1);color:var(--t0);font:700 var(--fs-xs)/1 var(--ff-text);cursor:pointer;transition:background .2s,color .2s}
.pd-add.on{background:var(--ui-act);color:var(--ui-act-fg)}
.pd-body{display:grid;grid-template-columns:268px minmax(0,1fr);gap:14px;align-items:stretch}
@container (max-width:720px){.pd-body{grid-template-columns:minmax(0,1fr)}.pd-col{order:2;max-height:none!important}}
/* Spalte */
.pd-col{display:flex;flex-direction:column;min-height:0;border:1px solid var(--bd);border-radius:12px;background:var(--bg0);overflow:hidden}
.pd-col-hd{display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 12px;border-bottom:1px solid var(--bd)}
.pd-col-t{font:800 var(--fs-sm)/1.2 var(--ff-text);color:var(--t0)}
.pd-pill{height:20px;min-width:20px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;border-radius:10px;background:var(--bg2);border:1px solid var(--bd2);font:800 var(--fs-2xs)/1 var(--ff-num);color:var(--t1)}
.pd-x{margin-left:auto;width:28px;height:28px;border-radius:8px;border:1px solid var(--bd2);background:var(--bg1);color:var(--t1);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font:700 13px/1 var(--ff-text)}
.pd-list{flex:1 1 auto;overflow-y:auto;padding:6px}
.pd-ev{padding:8px 8px 9px;border-radius:9px}
.pd-ev+.pd-ev{border-top:1px solid var(--bd)}
.pd-ev-top{display:flex;align-items:baseline;gap:8px}
.pd-when{flex:0 0 auto;font:700 var(--fs-2xs)/1.2 var(--ff-num);color:var(--t2)}
.pd-name{font:700 var(--fs-xs)/1.3 var(--ff-text);color:var(--t0)}
.pd-afp{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:4px;padding-left:0;font-size:var(--fs-2xs);color:var(--t2)}
.pd-afp b{font:800 var(--fs-2xs)/1.2 var(--ff-num);color:var(--t1);margin-left:3px}
.pd-afp b.g{color:${BC.bull}}.pd-afp b.s{color:${BC.bear}}
.pd-leer{padding:14px 10px;color:var(--t2);font-size:var(--fs-xs)}
.pd-mine{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:5px;font:800 10px/1 var(--ff-text);letter-spacing:.4px;text-transform:uppercase;color:var(--ui-act-fg);background:var(--ui-act)}
.pd-del{margin-left:auto;border:0;background:transparent;color:var(--t2);cursor:pointer;font:700 13px/1 var(--ff-text);padding:2px 4px}
/* B: Karten */
.pd-b .pd-ev{border:1px solid var(--bd);border-left:4px solid var(--c,var(--bd2));background:var(--bg1);margin-bottom:6px}
.pd-b .pd-ev+.pd-ev{border-top:1px solid var(--bd)}
.pd-b .pd-ev-top{justify-content:space-between}
.pd-b .pd-akt{font:800 var(--fs-md)/1 var(--ff-num);color:var(--c,var(--t1))}
.pd-b .pd-afp{padding-left:0}
.pd-stat{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;border-bottom:1px solid var(--bd)}
.pd-stat span{height:24px;display:inline-flex;align-items:center;gap:4px;padding:0 8px;border-radius:7px;background:var(--bg2);border:1px solid var(--bd2);font:700 var(--fs-2xs)/1 var(--ff-text);color:var(--t2)}
.pd-stat b{font:800 var(--fs-2xs)/1 var(--ff-num)}
/* C: Gruppen */
.pd-grp{margin:4px 2px 2px;padding:6px 8px 4px;font:800 10px/1 var(--ff-text);letter-spacing:1.2px;text-transform:uppercase;color:var(--t2);display:flex;align-items:center;gap:6px}
.pd-grp i{width:8px;height:8px;border-radius:2px;background:var(--c)}
.pd-feld{display:flex;flex-direction:column;gap:6px;padding:10px 12px}
.pd-feld label{font:800 10px/1 var(--ff-text);letter-spacing:1.2px;text-transform:uppercase;color:var(--t2)}
.pd-in{height:34px;border:1px solid var(--bd2);border-radius:8px;background:var(--bg1);color:var(--t0);padding:0 10px;font:600 var(--fs-sm)/1 var(--ff-text);width:100%;box-sizing:border-box}
.pd-in:focus{outline:2px solid rgba(var(--ui-act-rgb),.35);border-color:var(--ui-act)}
.pd-bias{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.pd-bias button{height:40px;border-radius:9px;border:1px solid var(--bd2);background:var(--bg1);color:var(--t1);font:700 var(--fs-xs)/1 var(--ff-text);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:border-color .18s,background .18s,transform .18s}
.pd-bias button i{width:10px;height:10px;border-radius:50%;background:var(--c)}
.pd-bias button.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);transform:translateY(-1px)}
.pd-fuss{display:flex;justify-content:flex-end;gap:8px;padding:10px 12px;border-top:1px solid var(--bd)}
.pd-fuss .btn{height:34px}
.pd-ok{background:var(--ui-act)!important;border-color:var(--ui-act)!important;color:var(--ui-act-fg)!important}
/* Chart */
.pd-chart{position:relative;min-width:0;user-select:none;-webkit-user-select:none}
.pd-svg{display:block;width:100%;overflow:visible;animation:pdChart .28s ease-out}
@keyframes pdChart{from{opacity:.25}to{opacity:1}}
.pd-svg text{font:600 11px var(--ff-num);fill:var(--t2)}
.pd-grid{stroke:var(--bd);stroke-width:1}
.pd-mk{cursor:pointer;transition:opacity .22s,scale .28s cubic-bezier(.3,1.6,.5,1);transform-box:fill-box;transform-origin:50% 100%}
.pd-mk text{font:800 10px var(--ff-num);fill:var(--t1)}
.pd-svg.sel .pd-mk:not(.on){opacity:.3}
.pd-mk.on{scale:1.3}
.pd-mk:hover{scale:1.15}.pd-mk.on:hover{scale:1.3}
.pd-mk.neu{animation:pdDrop .55s cubic-bezier(.3,1.7,.5,1)}
@keyframes pdDrop{from{translate:0 -30px;opacity:0}to{translate:0 0;opacity:1}}
.pd-guide{stroke:var(--t1);stroke-width:1;stroke-dasharray:3 3;opacity:0;transition:opacity .2s}
.pd-band{fill:rgba(var(--ui-act-rgb),.08);opacity:0;transition:opacity .22s}
.pd-guide.an,.pd-band.an{opacity:1}
.pd-chart.add{cursor:crosshair}
.pd-ghost{opacity:0;pointer-events:none;transition:opacity .12s}
.pd-chart.add .pd-ghost.an{opacity:.55}
.pd-tipp{position:absolute;left:8px;top:6px;z-index:2;height:26px;display:none;align-items:center;gap:6px;padding:0 10px;border-radius:13px;background:var(--ui-act);color:var(--ui-act-fg);font:700 var(--fs-xs)/1 var(--ff-text);box-shadow:0 2px 8px rgba(16,24,40,.18)}
.pd-chart.add .pd-tipp{display:inline-flex;animation:pdPuls 1.6s ease-in-out infinite}
@keyframes pdPuls{0%,100%{opacity:1}50%{opacity:.72}}
.pd-ring{fill:var(--bg1);stroke:var(--t0);stroke-width:1.5;cursor:pointer}
.pd-lane-l{font:700 10px var(--ff-text)!important;letter-spacing:1px;text-transform:uppercase}
/* A: Fenster in der Karte */
.pd-modal{position:absolute;inset:0;z-index:5;border-radius:14px;background:rgba(10,16,30,.32);display:flex;align-items:center;justify-content:center;animation:pdFade .18s ease-out}
.pd-mbox{width:min(380px,calc(100% - 32px));background:var(--bg1);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--shadow-pop);animation:pdPop .26s cubic-bezier(.3,1.4,.5,1)}
@keyframes pdPop{from{scale:.94;opacity:0}to{scale:1;opacity:1}}
.pd-mhd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--bd)}
.pd-mhd b{font:800 var(--fs-md)/1.2 var(--ff-text);color:var(--t0)}
/* B: Popover an der Kerze */
.pd-pop{position:absolute;z-index:5;width:286px;background:var(--bg1);border:1px solid var(--bd);border-radius:12px;box-shadow:var(--shadow-pop);padding:10px;animation:pdPop .24s cubic-bezier(.3,1.4,.5,1);transform-origin:var(--ox,50%) 100%}
.pd-pop::after{content:'';position:absolute;bottom:-7px;left:var(--ox,50%);width:12px;height:12px;margin-left:-6px;background:var(--bg1);border-right:1px solid var(--bd);border-bottom:1px solid var(--bd);rotate:45deg}
.pd-pop-r{display:flex;align-items:center;gap:6px;margin-top:8px}
.pd-rund{width:34px;height:34px;border-radius:50%;border:2px solid transparent;background:var(--bg2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:border-color .18s,scale .2s}
.pd-rund i{width:14px;height:14px;border-radius:50%;background:var(--c)}
.pd-rund.on{border-color:var(--c);scale:1.08}
.pd-pop-r .btn{margin-left:auto;height:34px}
@media (max-width:760px){.pd-ov{padding:8px}.pd-sek{padding:14px 12px 16px}.pd-card{padding:12px}}
`;

const W = window;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RANGES = [['3M', 66], ['6M', 130], ['1Y', 260]];
const BIAS = [['bull', 'Bullish', BC.bull], ['neu', 'Neutral', BC.neu], ['bear', 'Bearish', BC.bear]];
const bcol = b => b === 'bull' ? BC.bull : b === 'bear' ? BC.bear : BC.neu;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dObj = d => new Date(d + 'T12:00:00');
const tagKurz = d => { const t = dObj(d); return `${WT[t.getDay()]}, ${MON[t.getMonth()]} ${t.getDate()}`; };
const achseD = d => { const t = dObj(d); return `${MON[t.getMonth()]} ${t.getDate()}`; };
const heute = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const pct = v => (v > 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
function wocheVon(d) { const t = dObj(d); t.setDate(t.getDate() - (t.getDay() + 6) % 7); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
function fmtP(v, ref) { const a = Math.abs(ref || v); return v.toFixed(a >= 1000 ? 1 : a >= 10 ? 2 : 4); }

const S = { id: null, eigene: [], neu: null, opt: {} };
['A', 'B', 'C'].forEach(o => { S.opt[o] = { range: '3M', sel: null, add: false, form: null, w: 900 }; });

// ── Daten ────────────────────────────────────────────────────────────────
const _cache = {};
function daten(o) {
  const s = S.opt[o];
  const ck = `${S.id}|${s.range}|${(s.w - 68) / RANGES.find(r => r[0] === s.range)[1] < 9}|${S.eigene.length}|${S.eigene.map(m => m.d + m.b).join()}`;
  if (_cache[o] && _cache[o].ck === ck) return _cache[o].D;
  const tage = RANGES.find(r => r[0] === s.range)[1];
  // Woche statt Tag, sobald eine Kerze schmaler als 9 px wird (Handy schon
  // bei 3M, iPad ab 6M) - sonst ueberlappen die Pfeile.
  const woche = (s.w - PAD.l - PAD.r) / tage < 9;
  let k = [];
  try { k = (W.tagesKerzen(W.preisReiheAnzeige(S.id) || [], S.id) || []).slice(-tage); } catch (e) { k = []; }
  const key = d => woche ? wocheVon(d) : d;
  const B = new Map();
  const bucket = kk => { if (!B.has(kk)) B.set(kk, { key: kk, evs: [], eig: [], i0: 1e9, i1: -1 }); return B.get(kk); };
  k.forEach((c, i) => { c.chg = i ? c.c / k[i - 1].c - 1 : c.c / c.o - 1; c.key = key(c.d); });
  const idx = d => { let lo = 0, hi = k.length - 1; if (!k.length || d < k[0].d || d > k[hi].d) return -1; while (lo < hi) { const m = (lo + hi) >> 1; if (k[m].d < d) lo = m + 1; else hi = m; } return lo; };
  let ev = {};
  try { ev = W.priceEventsByDay(S.id) || {}; } catch (e) { ev = {}; }
  Object.keys(ev).forEach(d => { const i = idx(d); if (i < 0) return; const b = bucket(k[i].key); ev[d].forEach(e => b.evs.push(Object.assign({ d }, e))); });
  S.eigene.forEach(m => { const i = idx(m.d); if (i < 0) return; bucket(k[i].key).eig.push(m); });
  k.forEach((c, i) => { const b = B.get(c.key); if (b) { b.i0 = Math.min(b.i0, i); b.i1 = Math.max(b.i1, i); } });
  B.forEach(b => {
    const g = b.evs.filter(e => e.col === 'act-good').length, s2 = b.evs.filter(e => e.col === 'act-bad').length;
    b.g = g; b.s = s2; b.n = b.evs.length - g - s2;
    b.bias = g > s2 ? 'bull' : s2 > g ? 'bear' : 'neu';
  });
  // Auffaelligkeiten (C): Tagesbewegung > 2 Standardabweichungen
  const ch = k.map(c => c.chg), mu = ch.reduce((a, v) => a + v, 0) / (ch.length || 1);
  const sd = Math.sqrt(ch.reduce((a, v) => a + (v - mu) * (v - mu), 0) / (ch.length || 1)) || 1e-9;
  k.forEach(c => { c.z = (c.chg - mu) / sd; });
  const D = { k, B, woche, sd };
  _cache[o] = { ck, D };
  return D;
}
// Eimer eines Tages/einer Woche - auch ohne Release (Ring = grosse Bewegung
// ohne Daten), dann leer aus den Kerzen gebaut.
function eimer(D, key) {
  if (!key) return null;
  if (D.B.has(key)) return D.B.get(key);
  let i0 = -1, i1 = -1; D.k.forEach((c, i) => { if (c.key === key) { if (i0 < 0) i0 = i; i1 = i; } });
  return i0 < 0 ? null : { key, evs: [], eig: [], i0, i1, g: 0, s: 0, n: 0, bias: 'neu' };
}
function kommend() {
  const h = heute();
  let l = [];
  try { l = (W.getSymEventsAll(S.id) || []).filter(e => e && e.date >= h && !e.actual && String(e.impact || '').toLowerCase() === 'high'); } catch (e) { l = []; }
  return l.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 8);
}
function wann(e) {
  const h = heute(), t = dObj(e.date), n = Math.round((t - dObj(h)) / 864e5);
  const tag = n === 0 ? 'Today' : n === 1 ? 'Tmrw' : WT[t.getDay()] + ' ' + t.getDate();
  return `${tag}${e.time ? ' ' + e.time : ''}`;
}
const afp = (e, cls) => !(e.actual || e.forecast || e.previous) ? '' : `<div class="pd-afp"><span>Actual<b class="${cls || ''}">${esc(e.actual || '–')}</b></span><span>Forecast<b>${esc(e.forecast || '–')}</b></span><span>Previous<b>${esc(e.previous || '–')}</b></span></div>`;
const gs = col => col === 'act-good' ? 'g' : col === 'act-bad' ? 's' : '';

// ── Chart ────────────────────────────────────────────────────────────────
const PAD = { l: 6, r: 62, t: 48, b: 22 };
function form(o, b, x, y, hohl, n) {
  const c = bcol(b);
  const f = hohl ? `fill="var(--bg1)" stroke="${c}" stroke-width="1.6"` : `fill="${c}"`;
  if (o === 'A') { // Zeiger wie im Screenshot: Schaft + Spitze nach unten
    const p = `M${x - 2.5},${y - 15} h5 v7 h4.5 L${x},${y} L${x - 7},${y - 8} h4.5 z`;
    return { svg: `<path d="${p}" ${f} stroke-linejoin="round"/>${n > 1 ? `<text x="${x}" y="${y - 19}" text-anchor="middle">${n}</text>` : ''}`, h: n > 1 ? 30 : 17 };
  }
  if (o === 'B') { // Stecknadel: Stiel + Kopf, groesser bei mehreren Releases
    const r = n > 1 ? 7.5 : 5.5;
    return { svg: `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 11}" stroke="${c}" stroke-width="1.5"/><circle cx="${x}" cy="${y - 11 - r}" r="${r}" ${f}/>${n > 1 ? `<text x="${x}" y="${y - 11 - r + 3.5}" text-anchor="middle" style="fill:${hohl ? c : '#fff'};font-size:10px">${n}</text>` : ''}`, h: 13 + 2 * r };
  }
  // C: Richtungssymbol
  const p = b === 'bull' ? `M${x},${y - 10} L${x + 5.5},${y - 1} L${x - 5.5},${y - 1} z` : b === 'bear' ? `M${x - 5.5},${y - 10} L${x + 5.5},${y - 10} L${x},${y - 1} z` : `M${x},${y - 10} L${x + 4.5},${y - 5.5} L${x},${y - 1} L${x - 4.5},${y - 5.5} z`;
  return { svg: `<path d="${p}" ${f} stroke-linejoin="round"/>`, h: 11 };
}
function markerSvg(o, b, x, y) {
  let teile = '', yy = y, oben = y;
  if (b.evs.length) {
    if (o === 'C') { // je vorkommender Richtung ein Symbol, gestapelt
      [['bull', b.g], ['bear', b.s], ['neu', b.n]].filter(z => z[1]).forEach(([bi]) => { const f = form(o, bi, x, yy, false, 1); teile += f.svg; yy -= f.h; });
    } else { const f = form(o, b.bias, x, yy, false, b.evs.length); teile += f.svg; yy -= f.h + 2; }
  }
  b.eig.forEach(m => { const f = form(o, m.b, x, yy, true, 1); teile += f.svg; yy -= f.h + 2; });
  oben = yy;
  const tip = b.evs.map(e => e.name).concat(b.eig.map(m => 'Mine: ' + m.t)).join(' · ');
  const neu = S.neu && b.eig.some(m => m === S.neu);
  return `<g class="pd-mk${neu ? ' neu' : ''}" data-b="${esc(b.key)}"><title>${esc(tip)}</title><rect x="${x - 12}" y="${oben - 4}" width="24" height="${y - oben + 8}" fill="transparent"/>${teile}</g>`;
}
function chartSvg(o, D, w) {
  const k = D.k, n = k.length;
  if (n < 2) return `<div class="pd-leer">No price history for this asset yet.</div>`;
  const H = o === 'C' ? 280 : 320, LANE = o === 'C' ? 64 : 0;
  const pw = w - PAD.l - PAD.r, slot = pw / n, bw = Math.max(1.4, Math.min(11, slot * .64));
  const xc = i => PAD.l + slot * (i + .5);
  let lo = Infinity, hi = -Infinity; k.forEach(c => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
  const sp = (hi - lo) || hi * .01 || 1; lo -= sp * .04; hi += sp * .04;
  const ph = H - PAD.t - PAD.b, y = v => PAD.t + (hi - v) / (hi - lo) * ph;
  let s = `<svg class="pd-svg" viewBox="0 0 ${w} ${H + LANE}" width="${w}" height="${H + LANE}" data-slot="${slot}">`;
  s += `<rect class="pd-bg" x="0" y="0" width="${w}" height="${H + LANE}" fill="transparent"/>`;
  for (let t = 0; t <= 4; t++) { const v = lo + (hi - lo) * (t + .5) / 5, yy = y(v); s += `<line class="pd-grid" x1="${PAD.l}" x2="${w - PAD.r + 4}" y1="${yy}" y2="${yy}"/><text x="${w - PAD.r + 8}" y="${yy + 4}">${fmtP(v, hi)}</text>`; }
  [0, .25, .5, .75, 1].forEach((f, j) => { const i = Math.min(n - 1, Math.round(f * (n - 1))); s += `<text x="${xc(i)}" y="${H - 5}" text-anchor="${j === 0 ? 'start' : j === 4 ? 'end' : 'middle'}">${achseD(k[i].d)}</text>`; });
  s += `<rect class="pd-band" x="0" y="${PAD.t - 40}" width="0" height="${H - PAD.t - PAD.b + 40 + LANE}" rx="6"/><line class="pd-guide" x1="0" x2="0" y1="${PAD.t - 40}" y2="${H - PAD.b + LANE}"/>`;
  k.forEach((c, i) => {
    const x = xc(i), up = c.c >= c.o, col = up ? BC.bull : 'var(--t0)';
    s += `<line x1="${x}" x2="${x}" y1="${y(c.h)}" y2="${y(c.l)}" stroke="${col}" stroke-width="1"/>`;
    const y1 = y(Math.max(c.o, c.c)), y2 = y(Math.min(c.o, c.c));
    s += `<rect x="${x - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(1, y2 - y1)}" fill="${col}"/>`;
  });
  // letzter Kurs
  const last = k[n - 1].c, yl = y(last);
  s += `<line x1="${PAD.l}" x2="${w - PAD.r + 4}" y1="${yl}" y2="${yl}" stroke="${BC.bull}" stroke-dasharray="1 3"/><rect x="${w - PAD.r + 4}" y="${yl - 9}" width="${PAD.r - 4}" height="18" rx="4" fill="${BC.bull}"/><text x="${w - PAD.r + 8}" y="${yl + 4}" style="fill:#fff;font-weight:800">${fmtP(last, hi)}</text>`;
  // Bewegungsspur (C)
  if (LANE) {
    const mid = H + LANE / 2 + 4, mx = Math.max(...k.map(c => Math.abs(c.chg))) || 1, hh = LANE / 2 - 8;
    s += `<text class="pd-lane-l" x="${PAD.l}" y="${H + 8}">Daily move</text><line class="pd-grid" x1="${PAD.l}" x2="${w - PAD.r + 4}" y1="${mid}" y2="${mid}"/>`;
    k.forEach((c, i) => {
      const hgt = Math.abs(c.chg) / mx * hh, auff = Math.abs(c.z) > 2;
      s += `<rect x="${xc(i) - bw / 2}" y="${c.chg >= 0 ? mid - hgt : mid}" width="${bw}" height="${Math.max(.8, hgt)}" fill="${c.chg >= 0 ? BC.bull : BC.bear}" opacity="${auff ? 1 : .32}"/>`;
      const b = D.B.get(c.key);
      if (auff && !(b && (b.evs.length || b.eig.length))) s += `<circle class="pd-ring" data-b="${esc(c.key)}" data-ring="1" cx="${xc(i)}" cy="${c.chg >= 0 ? mid - hgt - 7 : mid + hgt + 7}" r="4.5"><title>Big move, no tracked release</title></circle>`;
    });
  }
  // Marker
  D.B.forEach(b => {
    if (!b.evs.length && !b.eig.length) return;
    let x = 0, yy = Infinity; for (let i = b.i0; i <= b.i1; i++) { x += xc(i); yy = Math.min(yy, y(k[i].h)); }
    x /= (b.i1 - b.i0 + 1);
    s += markerSvg(o, b, x, yy - 4);
  });
  // Geist im Hinzufuegen-Modus
  s += `<g class="pd-ghost">${form(o, 'neu', 0, 0, true, 1).svg}</g>`;
  s += `</svg><span class="pd-tipp">Tap a day</span>`;
  return s;
}

// ── Spalte ───────────────────────────────────────────────────────────────
function tagStat(D, b) {
  const k = D.k, i0 = b.i0, i1 = b.i1;
  const vor = i0 > 0 ? k[i0 - 1].c : k[i0].o, tag = k[i1].c / vor - 1;
  const n5 = Math.min(k.length - 1, i1 + 5), nach = n5 > i1 ? k[n5].c / k[i1].c - 1 : null;
  return { tag, nach };
}
const statHtml = (D, b) => { const t = tagStat(D, b); const f = v => `<b style="color:${v > 0 ? BC.bull : v < 0 ? BC.bear : 'var(--t1)'}">${pct(v)}</b>`; return `<div class="pd-stat"><span>${D.woche ? 'Week' : 'Day'} ${f(t.tag)}</span>${t.nach != null ? `<span>Next 5D ${f(t.nach)}</span>` : ''}${b.evs.length ? `<span><b style="color:${BC.bull}">▲${b.g}</b><b style="color:${BC.bear}">▼${b.s}</b><b>◆${b.n}</b></span>` : ''}</div>`; };
function eigenZeile(o, m) {
  return `<div class="pd-ev" style="--c:${bcol(m.b)}"><div class="pd-ev-top"><span class="pd-mine">Mine</span><span class="pd-name">${esc(m.t)}</span><button class="pd-del" data-pd="${o}" data-k="del" data-v="${S.eigene.indexOf(m)}" title="Delete">✕</button></div><div class="pd-afp" style="padding-left:0"><span style="color:${bcol(m.b)};font-weight:800">${BIAS.find(z => z[0] === m.b)[1]}</span></div></div>`;
}
function evZeile(o, e, tag) {
  if (o === 'B') return `<div class="pd-ev" style="--c:${e.col === 'act-good' ? BC.bull : e.col === 'act-bad' ? BC.bear : 'var(--bd2)'}"><div class="pd-ev-top"><span class="pd-name">${esc(e.name)}</span><span class="pd-akt">${esc(e.actual || '–')}</span></div><div class="pd-afp">${tag ? `<span>${esc(tag)}</span>` : ''}<span>Forecast<b>${esc(e.forecast || '–')}</b></span><span>Previous<b>${esc(e.previous || '–')}</b></span></div></div>`;
  return `<div class="pd-ev"><div class="pd-ev-top">${tag ? `<span class="pd-when">${esc(tag)}</span>` : ''}<span class="pd-name">${esc(e.name)}</span></div>${afp(e, gs(e.col))}</div>`;
}
function spalteHtml(o, D) {
  const s = S.opt[o];
  if (s.form && o === 'C') return formHtml(o, true);
  const b = eimer(D, s.sel);
  if (!s.sel) {
    const l = kommend();
    let liste;
    if (!l.length) liste = `<div class="pd-leer">Nothing high-impact scheduled.</div>`;
    else if (o === 'C') { let tg = ''; liste = l.map(e => { const k = e.date === tg ? '' : `<div class="pd-grp">${esc(e.date === heute() ? 'Today' : tagKurz(e.date))}</div>`; tg = e.date; return k + evZeile(o, e, e.time || ''); }).join(''); }
    else liste = l.map(e => evZeile(o, e, wann(e))).join('');
    return `<div class="pd-col-hd"><span class="pd-col-t">Next up</span><span class="pd-pill">${l.length}</span></div><div class="pd-list">${liste}</div>`;
  }
  const titel = D.woche ? `Week of ${achseD(s.sel)}` : tagKurz(s.sel);
  const kopf = `<div class="pd-col-hd"><span class="pd-col-t">${esc(titel)}</span>${b && b.evs.length ? `<span class="pd-pill">${b.evs.length}</span>` : ''}<button class="pd-x" data-pd="${o}" data-k="sel" data-v="" title="Back to next up">✕</button></div>`;
  if (!b) return kopf;
  const stat = o === 'A' ? '' : statHtml(D, b);
  let liste = '';
  if (o === 'C' && b.evs.length) {
    liste = [['act-good', 'Bullish', BC.bull], ['act-bad', 'Bearish', BC.bear], ['', 'Neutral', BC.neu]].map(([c, l, f]) => { const ev = b.evs.filter(e => (e.col || '') === c); return ev.length ? `<div class="pd-grp" style="--c:${f}"><i></i>${l} · ${ev.length}</div>${ev.map(e => evZeile(o, e, D.woche ? achseD(e.d) : '')).join('')}` : ''; }).join('');
  } else liste = b.evs.map(e => evZeile(o, e, D.woche ? tagKurz(e.d) : '')).join('');
  liste += b.eig.map(m => eigenZeile(o, m)).join('');
  if (!b.evs.length && !b.eig.length) liste = `<div class="pd-leer"><b>No tracked release</b><br>Big move without data.</div><div class="pd-feld"><button class="btn" data-pd="${o}" data-k="formAn" data-v="${esc(D.k[b.i1].d)}" style="height:34px">＋ Mark this day</button></div>`;
  return kopf + stat + `<div class="pd-list">${liste}</div>`;
}
function formHtml(o, spalte) {
  const f = S.opt[o].form;
  const bias = o === 'B'
    ? BIAS.map(([b, l, c]) => `<button class="pd-rund${f.b === b ? ' on' : ''}" style="--c:${c}" data-pd="${o}" data-k="fb" data-v="${b}" title="${l}"><i></i></button>`).join('')
    : `<div class="pd-bias">${BIAS.map(([b, l, c]) => `<button class="${f.b === b ? 'on' : ''}" style="--c:${c}" data-pd="${o}" data-k="fb" data-v="${b}"><i></i>${l}</button>`).join('')}</div>`;
  const inp = `<input class="pd-in" data-pd-in="${o}" maxlength="80" placeholder="What happened" value="${esc(f.t)}">`;
  if (o === 'B') return `<div style="font:800 var(--fs-xs)/1 var(--ff-text);color:var(--t0)">New mark · ${esc(tagKurz(f.d))}</div><div style="margin-top:8px">${inp}</div><div class="pd-pop-r">${bias}<button class="btn pd-ok" data-pd="${o}" data-k="save" data-v="">Save</button></div>`;
  const felder = `<div class="pd-feld"><label>What</label>${inp}</div><div class="pd-feld" style="padding-top:0"><label>Effect</label>${bias}</div><div class="pd-fuss"><button class="btn" data-pd="${o}" data-k="formZu" data-v="">Cancel</button><button class="btn pd-ok" data-pd="${o}" data-k="save" data-v="">Save</button></div>`;
  if (spalte) return `<div class="pd-col-hd"><span class="pd-col-t">New mark · ${esc(tagKurz(f.d))}</span><button class="pd-x" data-pd="${o}" data-k="formZu" data-v="" title="Cancel">✕</button></div>${felder}`;
  return `<div class="pd-mbox"><div class="pd-mhd"><b>New mark</b><span class="pd-pill" style="height:22px">${esc(tagKurz(f.d))}</span></div>${felder}</div>`;
}

// ── Karte ────────────────────────────────────────────────────────────────
function karteHtml(o) {
  const s = S.opt[o], D = daten(o), k = D.k;
  const sym = (W.syms || []).find(x => x.id === S.id) || {};
  const ch = k.length > 1 ? k[k.length - 1].c / k[0].o - 1 : 0;
  const unter = (W.KORB_NAME && W.KORB_NAME[S.id]) || sym.full || sym.name || S.id;
  return `<div class="pd-card${o === 'B' ? ' pd-b' : ''}" data-karte="${o}">
    <div class="pd-top"><div><div class="pd-tt">Price</div><div class="pd-ts">${esc(unter)}</div></div>
      <span class="pd-chg" style="color:${ch >= 0 ? BC.bull : BC.bear};background:${ch >= 0 ? 'rgba(11,95,204,.08)' : 'rgba(220,36,48,.08)'}">${pct(ch)}</span>
      <div class="pd-tr"><span class="pd-disp">Display <em>Candles · EMA 1D</em> ▾</span>
        <span class="pd-seg">${RANGES.map(([r]) => `<button class="${s.range === r ? 'on' : ''}" data-pd="${o}" data-k="range" data-v="${r}">${r}</button>`).join('')}</span>
        <button class="pd-add${s.add ? ' on' : ''}" data-pd="${o}" data-k="add" data-v="">${s.add ? '✕ Cancel' : '＋ Mark'}</button></div></div>
    <div class="pd-body"><div class="pd-col" style="max-height:${o === 'C' ? 344 : 320}px">${spalteHtml(o, D)}</div><div class="pd-chart${s.add ? ' add' : ''}"></div></div>
    ${s.form && o === 'A' ? `<div class="pd-modal" data-pd="${o}" data-k="modalBg" data-v="">${formHtml(o)}</div>` : ''}
    ${s.form && o === 'B' ? `<div class="pd-pop">${formHtml(o)}</div>` : ''}
  </div>`;
}
function zeichneChart(o) {
  const karte = document.querySelector(`#fdOv [data-karte="${o}"]`); if (!karte) return;
  const el = karte.querySelector('.pd-chart'), w = Math.max(280, Math.round(el.clientWidth)), s = S.opt[o];
  const vorher = daten(o).woche; s.w = w;
  const D = daten(o);
  el.innerHTML = chartSvg(o, D, w);
  if (D.woche !== vorher) { s.sel = null; zeichneSpalte(o, false); }
  markiere(o);
  popPosition(o);
}
function markiere(o) {
  const karte = document.querySelector(`#fdOv [data-karte="${o}"]`); if (!karte) return;
  const s = S.opt[o], svg = karte.querySelector('.pd-svg'); if (!svg) return;
  const D = daten(o), b = eimer(D, s.sel);
  svg.classList.toggle('sel', !!b);
  svg.querySelectorAll('.pd-mk').forEach(g => g.classList.toggle('on', !!b && g.dataset.b === s.sel));
  const slot = +svg.dataset.slot, guide = svg.querySelector('.pd-guide'), band = svg.querySelector('.pd-band');
  if (b) {
    const x0 = PAD.l + slot * b.i0, x1 = PAD.l + slot * (b.i1 + 1), xm = (x0 + x1) / 2;
    if (o === 'A') { guide.setAttribute('x1', xm); guide.setAttribute('x2', xm); guide.classList.add('an'); band.classList.remove('an'); }
    else { band.setAttribute('x', x0 - 2); band.setAttribute('width', Math.max(8, x1 - x0 + 4)); band.classList.add('an'); guide.classList.remove('an'); }
  } else { guide.classList.remove('an'); band.classList.remove('an'); }
}
// Spalte tauschen mit Animation je Option: A von unten einblenden, B seitlich
// schieben, C Zeilen gestaffelt.
function zeichneSpalte(o, rein) {
  const karte = document.querySelector(`#fdOv [data-karte="${o}"]`); if (!karte) return;
  const col = karte.querySelector('.pd-col');
  col.innerHTML = spalteHtml(o, daten(o));
  const kids = [...col.children];
  if (o === 'A') kids.forEach(k => k.animate([{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' }));
  else if (o === 'B') kids.forEach(k => k.animate([{ opacity: 0, translate: `${rein ? 18 : -18}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' }));
  else { kids.slice(0, 2).forEach(k => k.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 })); col.querySelectorAll('.pd-list > *, .pd-feld').forEach((k, i) => k.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 220, delay: Math.min(i, 10) * 28, easing: 'ease-out', fill: 'backwards' })); }
  const inp = col.querySelector('[data-pd-in]'); if (inp) setTimeout(() => inp.focus(), 60);
}
function zeichneKarte(o) {
  const sek = document.querySelector(`#fdOv .pd-sek[data-o="${o}"] .pd-mock`); if (!sek) return;
  sek.innerHTML = karteHtml(o);
  zeichneChart(o);
  const inp = sek.querySelector('.pd-modal [data-pd-in], .pd-pop [data-pd-in]'); if (inp) setTimeout(() => inp.focus(), 60);
}
function popPosition(o) {
  if (o !== 'B' || !S.opt.B.form) return;
  const karte = document.querySelector('#fdOv [data-karte="B"]'), pop = karte && karte.querySelector('.pd-pop'); if (!pop) return;
  const D = daten('B'), svg = karte.querySelector('.pd-svg'), chart = karte.querySelector('.pd-chart');
  const i = D.k.findIndex(c => c.d === S.opt.B.form.d); if (i < 0 || !svg) return;
  const kr = karte.getBoundingClientRect(), cr = chart.getBoundingClientRect(), slot = +svg.dataset.slot;
  const x = cr.left - kr.left + PAD.l + slot * (i + .5);
  const lo = Math.min(...D.k.map(c => c.l)), hi = Math.max(...D.k.map(c => c.h)), sp = hi - lo;
  const yH = cr.top - kr.top + PAD.t + ((hi + sp * .04) - D.k[i].h) / ((hi + sp * .04) - (lo - sp * .04)) * (320 - PAD.t - PAD.b);
  const bw = 286, links = Math.max(8, Math.min(kr.width - bw - 8, x - bw / 2));
  pop.style.left = links + 'px'; pop.style.top = Math.max(8, yH - pop.offsetHeight - 14) + 'px';
  pop.style.setProperty('--ox', Math.max(16, Math.min(bw - 16, x - links)) + 'px');
}

// ── Bedienung ────────────────────────────────────────────────────────────
function tagAusX(o, svg, clientX) {
  const r = svg.getBoundingClientRect(), slot = +svg.dataset.slot, D = daten(o);
  const i = Math.max(0, Math.min(D.k.length - 1, Math.floor((clientX - r.left - PAD.l) / slot)));
  return { i, c: D.k[i] };
}
function klick(e) {
  const t = e.target;
  // Asset wechseln
  const as = t.closest('[data-pd-asset]');
  if (as) { S.id = as.dataset.pdAsset; ['A', 'B', 'C'].forEach(o => { Object.assign(S.opt[o], { sel: null, form: null, add: false }); }); alleZeichnen(); return; }
  const btn = t.closest('[data-pd]');
  if (btn) {
    const o = btn.dataset.pd, k = btn.dataset.k, v = btn.dataset.v, s = S.opt[o];
    if (k === 'range') { s.range = v; s.sel = null; zeichneKarte(o); return; }
    if (k === 'add') { s.add = !s.add; s.form = null; s.sel = null; zeichneKarte(o); return; }
    if (k === 'sel') { s.sel = null; markiere(o); zeichneSpalte(o, false); return; }
    if (k === 'fb') { s.form.b = v; if (o === 'B') { btn.parentElement.querySelectorAll('.pd-rund').forEach(x => x.classList.toggle('on', x === btn)); } else btn.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === btn)); return; }
    if (k === 'formZu' || (k === 'modalBg' && t === btn)) { s.form = null; if (o === 'C') zeichneSpalte(o, false); else zeichneKarte(o); return; }
    if (k === 'formAn') { s.form = { d: v, t: '', b: 'neu' }; s.add = false; if (o === 'C') zeichneSpalte(o, true); else zeichneKarte(o); return; }
    if (k === 'save') {
      const f = s.form; if (!f) return;
      const inp = document.querySelector(`#fdOv [data-pd-in="${o}"]`); f.t = (inp ? inp.value : f.t).trim();
      if (!f.t) { if (inp) { inp.focus(); inp.animate([{ translate: '-4px 0' }, { translate: '4px 0' }, { translate: '0 0' }], { duration: 220 }); } return; }
      const m = { d: f.d, t: f.t, b: f.b }; S.eigene.push(m); S.neu = m;
      ['A', 'B', 'C'].forEach(x => { delete _cache[x]; });
      s.form = null; s.add = false;
      const D = daten(o), c = D.k.find(z => z.d === m.d); s.sel = c ? c.key : null;
      ['A', 'B', 'C'].forEach(x => x === o ? zeichneKarte(x) : zeichneChart(x));
      zeichneSpalte(o, true); S.neu = null; return;
    }
    if (k === 'del') { S.eigene.splice(+v, 1); ['A', 'B', 'C'].forEach(x => { delete _cache[x]; zeichneChart(x); }); zeichneSpalte(o, false); return; }
    return;
  }
  // Im Chart
  const chart = t.closest('.pd-chart'); if (!chart) return;
  const karte = chart.closest('[data-karte]'), o = karte.dataset.karte, s = S.opt[o], svg = chart.querySelector('.pd-svg'); if (!svg) return;
  if (s.add) {
    const { c } = tagAusX(o, svg, e.clientX);
    s.form = { d: c.d, t: '', b: 'neu' }; s.add = false;
    if (o === 'C') { chart.classList.remove('add'); karte.querySelector('.pd-add').classList.remove('on'); karte.querySelector('.pd-add').textContent = '＋ Mark'; zeichneSpalte(o, true); }
    else zeichneKarte(o);
    return;
  }
  const mk = t.closest('.pd-mk, .pd-ring');
  const neu = mk ? mk.dataset.b : null;
  if (neu === s.sel) return;
  const rein = !!neu;
  s.sel = neu; s.form = null;
  markiere(o); zeichneSpalte(o, rein);
}
function bewegen(e) {
  const chart = e.target.closest && e.target.closest('.pd-chart.add');
  document.querySelectorAll('#fdOv .pd-ghost.an').forEach(g => { if (!chart || !chart.contains(g)) g.classList.remove('an'); });
  if (!chart) return;
  const karte = chart.closest('[data-karte]'), o = karte.dataset.karte, svg = chart.querySelector('.pd-svg'); if (!svg) return;
  const { i, c } = tagAusX(o, svg, e.clientX), D = daten(o), slot = +svg.dataset.slot;
  const lo = Math.min(...D.k.map(z => z.l)), hi = Math.max(...D.k.map(z => z.h)), sp = hi - lo, H = o === 'C' ? 280 : 320;
  const yH = PAD.t + ((hi + sp * .04) - c.h) / ((hi + sp * .04) - (lo - sp * .04)) * (H - PAD.t - PAD.b);
  const g = svg.querySelector('.pd-ghost'); g.setAttribute('transform', `translate(${PAD.l + slot * (i + .5)},${yH - 4})`); g.classList.add('an');
}
function eingabe(e) { const i = e.target.closest && e.target.closest('[data-pd-in]'); if (!i) return; const f = S.opt[i.dataset.pdIn].form; if (f) f.t = i.value; }
function taste(e) {
  if (e.key === 'Enter') { const i = e.target.closest && e.target.closest('[data-pd-in]'); if (i) { const b = document.querySelector(`#fdOv [data-pd="${i.dataset.pdIn}"][data-k="save"]`); if (b) b.click(); } }
  if (e.key === 'Escape') { const o = ['A', 'B', 'C'].find(x => S.opt[x].form || S.opt[x].add); if (o) { S.opt[o].form = null; S.opt[o].add = false; zeichneKarte(o); } }
}

// ── Fenster ──────────────────────────────────────────────────────────────
const OPTS = [
  ['A', 'Side list', ['Column left: <b>Next up</b> ↔ releases of the tapped day, each with <b>Actual · Forecast · Previous</b>', 'Markers: <b>arrow</b> pointing at the candle (like your screenshot), one per day, <b>number</b> = releases that day', 'Own mark: <b>＋ Mark</b> → tap a day → <b>window</b> with what + Bullish / Neutral / Bearish', '<i>Closest to your description; tapped day gets a dashed guide line</i>']],
  ['B', 'Cards + day band', ['Column: <b>one card per release</b>, Actual big, colour edge = bias', 'Markers: <b>pins</b>, bigger head = more releases; tapped day gets a <b>band</b> + <b>day move</b> and <b>next 5 days</b>', 'Own mark: <b>＋ Mark</b> → tap → small <b>popover at the candle</b>, three colour dots', '<i>Most visual; cards need more height per release</i>']],
  ['C', 'Inspector + move lane', ['Column: day summary (move, ▲ ▼ ◆ tally), releases <b>grouped</b> Bullish / Bearish / Neutral; Next up grouped by day', 'Markers: <b>direction</b> ▲ bullish · ▼ bearish · ◆ neutral, one per direction - mixed days show both', '<b>Daily move</b> lane under the chart: big moves (> 2σ) solid, <b>ring = big move without any tracked release</b> → tap → mark it', 'Own mark: <b>＋ Mark</b> → tap → form <b>inside the column</b>']],
];
function alleZeichnen() {
  const box = document.querySelector('#fdOv .pd-box'); if (!box) return;
  box.querySelectorAll('[data-pd-asset]').forEach(b => b.classList.toggle('on', b.dataset.pdAsset === S.id));
  ['A', 'B', 'C'].forEach(zeichneKarte);
}
function zu() {
  const ov = document.getElementById('fdOv'); if (ov) ov.remove();
  window.removeEventListener('resize', _rs);
  try { sessionStorage.setItem('fxpro_pd_zu', '1'); } catch (e) {}
}
let _rt = 0;
const _rs = () => { clearTimeout(_rt); _rt = setTimeout(() => ['A', 'B', 'C'].forEach(zeichneChart), 120); };
function auf() {
  if (document.getElementById('fdOv')) return;
  const ids = ['EUR', 'GBP', 'USD', 'OIL', 'GOLD'].filter(i => (W.syms || []).some(s => s.id === i));
  const cur = (W.getSym && W.getSym()) || {};
  S.id = ids.includes(cur.id) ? cur.id : ids.includes('OIL') ? 'OIL' : ids[0];
  if (!S.id) return;
  if (!document.getElementById('pdCss')) { const s = document.createElement('style'); s.id = 'pdCss'; s.textContent = CSS; document.head.appendChild(s); }
  const ov = document.createElement('div');
  ov.id = 'fdOv'; ov.className = 'pd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Price card - designs');
  ov.innerHTML = `<div class="pd-box">
    <div class="pd-hd"><div><div class="pd-hd-t">Asset page · Price card · 3 designs</div><div class="pd-hd-s">Real prices and releases · tap markers, tap empty space, try ＋ Mark · own marks are not saved here</div></div>
      <div class="pd-hd-r"><span class="pd-seg">${ids.map(i => `<button data-pd-asset="${i}">${i}</button>`).join('')}</span><button class="btn" data-pd-zu="1">Close</button></div></div>
    <div class="pd-sek"><div class="pd-ot"><b>New page layout</b> · same for every option</div>
      <ul class="pd-pkt"><li><b>Price chart</b> button gone - its job moves into the Price card</li><li>Marker colour = Actual vs Forecast, <b>same as the calendar</b>: blue bullish · red bearish · grey neutral; several releases on one day → <b>majority</b></li><li>One marker <b>per day</b>; <b>per week</b> once candles get narrow (phone, 6M+)</li><li>Phone: column moves <b>under the chart</b></li></ul>
      <div class="pd-kopfz"><span class="weg">Price chart</span><span>History</span><span>Backtester</span><span>Data quality</span></div>
      <div class="pd-lay"><div class="pd-lay-r"><div class="pd-blk gross">Price <em>full width · releases in the chart · column with next up / day</em></div></div>
        <div class="pd-lay-r drei"><div class="pd-blk">Pinned notes</div><div class="pd-blk">History</div><div class="pd-blk neu">Calendar <em>moved here</em></div></div>
        <div class="pd-lay-r"><div class="pd-blk">Quick links</div></div><div class="pd-lay-r"><div class="pd-blk">Central bank</div></div>
        <div class="pd-lay-r"><div class="pd-blk leise">Macro · Positioning · Context — unchanged</div></div></div></div>
    ${OPTS.map(([o, t, pkt]) => `<div class="pd-sek" data-o="${o}"><div class="pd-ot"><b>Option ${o}</b> · ${esc(t)}</div><ul class="pd-pkt">${pkt.map(x => `<li>${x}</li>`).join('')}</ul><div class="pd-mock"></div></div>`).join('')}
  </div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-pd-zu]')) { zu(); return; } klick(e); });
  ov.addEventListener('pointermove', bewegen);
  ov.addEventListener('input', eingabe);
  ov.addEventListener('keydown', taste);
  document.body.appendChild(ov);
  window.addEventListener('resize', _rs);
  alleZeichnen();
}
export function preisDemoStarten() {
  const erzwingen = /[?&]preisdemo\b/.test(location.search);
  if (!erzwingen) {
    if (navigator.webdriver) return;
    try { if (sessionStorage.getItem('fxpro_pd_zu') === '1') return; } catch (e) {}
  }
  // erst wenn Sperrbildschirm und Intro weg sind und Kurse + Releases da sind
  const frei = id => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none' || !e.offsetParent && getComputedStyle(e).position !== 'fixed'; };
  const datenDa = () => { try { return (W.preisReiheAnzeige('USD') || []).length > 60 && Object.keys(W.priceEventsByDay('USD') || {}).length > 20; } catch (e) { return false; } };
  let n = 0;
  const warte = () => { if (frei('lockScreen') && frei('introOv') && datenDa()) auf(); else if (++n < 1200) setTimeout(warte, 500); };
  setTimeout(warte, erzwingen ? 300 : 1500);
}
