// ══ DATA-KONTROLLMENUE: VIER ENTWUERFE (TEMPORAER, Nutzer 2026-11-01) ═════════
// Nutzer (iPad-Screenshot Data · Prices, Leiste eingekreist): "das sind die
// ganzen Einstellungen bau mal ein richtiges kontrollmenue entwirf dafuer mal
// ein Design weil aktuell weis man nicht ob die Knoepfe zusammengehoeren oder
// getrennt ich will mehr Uebersicht entwirf mal paar Designs und das naechste
// Mal wenn ich die App oeffne sag ich dir welches du bauen sollst".
// Gemessen am Screenshot (657): Ansicht (5), Layout (2), Diagrammart (2) in
// EINER Zeile, alle im selben Knopfstil, ohne Abstand oder Etikett zwischen
// den Gruppen; die Skala (Low -> high | Common) erscheint nur bei One chart
// und schiebt dann alles weiter; der Zeitfilter bricht in eine zweite Zeile.
//   A = Gruppen mit Etikett       B = Reiter + Werkzeugleiste
//   C = Reiter + Display-Menue    D = Seitenleiste (Kontrollspalte)
// Jede Option ist eine bedienbare Attrappe (eigener Zustand, aendert nichts
// an der App).
// ⚠ Nach der Entscheidung KOMPLETT entfernen: diese Datei, der Import und der
// Aufruf in js/main.js.
// Nicht in automatisierten Laeufen (navigator.webdriver) - sonst laege das
// Fenster ueber jeder Seite, die ein Waechter anklickt. Id fdOv: die Waechter
// raeumen ein Fenster mit dieser Id ohnehin weg. Erzwingen fuer eine
// Sichtpruefung: ?kontrolldemo in der Adresse.

const KD_CSS = `
.kd-ov{position:fixed;inset:0;z-index:9800;background:rgba(10,16,30,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 16px}
.kd-box{width:min(1060px,100%);background:var(--bg1);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--shadow-pop);color:var(--t1)}
.kd-hd{position:sticky;top:-24px;z-index:3;display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--bd);background:var(--bg1);border-radius:14px 14px 0 0}
.kd-hd-t{font:800 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0)}
.kd-hd-s{color:var(--t2);font-size:var(--fs-sm)}
.kd-hd .btn{margin-left:auto;height:34px}
.kd-opt{padding:16px 18px 20px;border-bottom:1px solid var(--bd)}
.kd-opt:last-child{border-bottom:0}
.kd-ot{font:800 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0);margin-bottom:6px}
.kd-ot b{color:var(--blue)}
.kd-pkt{margin:0 0 12px;padding-left:18px;font-size:var(--fs-sm);line-height:1.55;color:var(--t1)}
.kd-pkt i{color:var(--t2)}
/* Attrappe der Data-Seite */
.kd-mock{position:relative;background:var(--bg0);border:1px solid var(--bd);border-radius:12px;padding:14px 16px 16px}
.kd-kopf{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}
.kd-kopf-t{font:800 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0)}
.kd-kopf-s{font-size:var(--fs-xs);color:var(--t2);margin-top:2px}
.kd-kopf .btn{margin-left:auto;height:34px;display:inline-flex;align-items:center;gap:6px}
.kd-charts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.kd-chart{height:64px;border:1px solid var(--bd);border-radius:10px;background:var(--bg2);display:flex;align-items:flex-start;padding:8px 10px;font:700 var(--fs-xs)/1 var(--ff-text);color:var(--t1)}
/* Bausteine */
.kd-cap{font-size:var(--fs-2xs);letter-spacing:1.4px;text-transform:uppercase;color:var(--t2);font-weight:700}
.kd-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--bd2);border-radius:9px;background:var(--bg2)}
.kd-seg button{height:28px;padding:0 11px;border:0;border-radius:7px;background:transparent;color:var(--t2);font:600 var(--fs-xs)/1 var(--ff-text);cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.kd-seg button.on{background:var(--ui-act);color:var(--ui-act-fg)}
.kd-seg button:disabled{opacity:.38;cursor:not-allowed}
.kd-seg.aus{opacity:.45}
.kd-grp{display:flex;flex-direction:column;gap:5px}
.kd-chip{height:28px;display:inline-flex;align-items:center;gap:6px;padding:0 10px;border-radius:7px;background:var(--ui-act);color:var(--ui-act-fg);font:600 var(--fs-xs)/1 var(--ff-text)}
.kd-chip b{font-weight:800;cursor:pointer}
.kd-ic{display:inline-flex;align-items:center;justify-content:center;width:34px;height:28px;border-radius:7px;border:1px solid var(--bd2);background:var(--bg2);color:var(--t2)}
/* A: Gruppen mit Etikett */
.kd-a{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 18px}
.kd-a .kd-rechts{margin-left:auto}
/* B: Reiter + Werkzeugleiste */
.kd-tabs{display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--bd);margin-bottom:10px;flex-wrap:wrap}
.kd-tabs .kd-rechts{margin-left:auto;display:inline-flex;align-items:center;gap:7px;padding-bottom:6px}
.kd-tabs>button{height:40px;padding:0 12px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--t2);font:700 var(--fs-sm)/1 var(--ff-text);cursor:pointer;white-space:nowrap;margin-bottom:-1px}
.kd-tabs>button.on{color:var(--t0);border-bottom-color:var(--ui-act)}
.kd-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:6px 8px;border:1px solid var(--bd);border-radius:11px;background:var(--bg1)}
.kd-bar .kd-in{display:inline-flex;align-items:center;gap:7px}
.kd-div{width:1px;height:24px;background:var(--bd2)}
.kd-bar .kd-rechts{margin-left:auto;display:inline-flex;align-items:center;gap:7px}
/* C: Display-Menue */
.kd-c-zeile{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}
.kd-c-zeile .kd-rechts{margin-left:auto;display:inline-flex;align-items:center;gap:7px}
.kd-disp{height:34px;display:inline-flex;align-items:center;gap:8px;padding:0 12px;border-radius:9px;border:1px solid var(--bd2);background:var(--bg2);color:var(--t1);font:600 var(--fs-xs)/1 var(--ff-text);cursor:pointer}
.kd-disp.on{border-color:var(--ui-act)}
.kd-disp em{font-style:normal;color:var(--t2)}
.kd-anker{position:relative;display:inline-flex}
.kd-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:2;width:420px;max-width:calc(100vw - 56px);background:var(--bg2);border:1px solid var(--bd);border-radius:12px;box-shadow:var(--shadow-pop);padding:6px 0}
.kd-sek{padding:8px 14px}
.kd-sek+.kd-sek{border-top:1px solid var(--bd)}
.kd-kacheln{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}
.kd-kachel{min-height:40px;display:flex;align-items:center;gap:9px;padding:6px 10px;border:1px solid var(--bd2);border-radius:9px;background:var(--bg1);color:var(--t1);cursor:pointer;text-align:left;font:600 var(--fs-xs)/1.25 var(--ff-text)}
.kd-kachel small{display:block;font-weight:500;color:var(--t2);font-size:var(--fs-2xs)}
.kd-kachel.on{border-color:var(--ui-act);background:rgba(var(--blue-rgb),.08)}
.kd-kachel:disabled{opacity:.4;cursor:not-allowed}
.kd-mini{flex:0 0 auto;width:26px;height:18px;display:grid;gap:2px}
.kd-mini i{display:block;border-radius:2px;background:var(--t3)}
/* D: Seitenleiste */
.kd-d{display:grid;grid-template-columns:230px 1fr;gap:14px;align-items:start}
.kd-side{border:1px solid var(--bd);border-radius:12px;background:var(--bg1);padding:6px 0}
.kd-side .kd-sek{padding:9px 12px}
.kd-liste{display:flex;flex-direction:column;gap:2px;margin-top:6px}
.kd-liste button{height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--t1);font:600 var(--fs-sm)/1 var(--ff-text);cursor:pointer;text-align:left}
.kd-liste button.on{background:var(--ui-act);color:var(--ui-act-fg)}
.kd-side .kd-seg{display:flex;margin-top:6px}
.kd-side .kd-seg button{flex:1;justify-content:center}
.kd-zeitraster{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px}
.kd-zeitraster button{height:28px;border:1px solid var(--bd2);border-radius:7px;background:var(--bg2);color:var(--t2);font:600 var(--fs-xs)/1 var(--ff-text);cursor:pointer}
.kd-zeitraster button.on{background:var(--ui-act);border-color:var(--ui-act);color:var(--ui-act-fg)}
.kd-d .kd-charts{grid-template-columns:repeat(2,1fr);margin-top:0}
.kd-d .kd-chart{height:96px}
@media (max-width:760px){.kd-ov{padding:8px}.kd-d{grid-template-columns:1fr}.kd-charts{grid-template-columns:1fr 1fr}.kd-a .kd-rechts,.kd-bar .kd-rechts,.kd-c-zeile .kd-rechts{margin-left:0}}
`;

const MODI = [['assets', 'By asset'], ['inds', 'By indicator'], ['vs', 'Asset vs asset'], ['preis', 'Prices'], ['alle', 'Compare all']];
const LAYOUT = [['eins', 'One chart'], ['neben', 'Side by side']];
const SKALA = [['band', 'Low → high', 'each line 0–100'], ['bruch', 'Common', 'real prices, axis breaks']];
const ZEIT = ['3M', '6M', '1Y', '3Y', 'Max', 'Custom'];
const PANELS = ['OIL · WTI Oil', 'USD Basket', 'CAD Basket', 'NZD Basket', 'AUD Basket', 'EUR Basket'];
const ic = (n, s) => { try { return window.icn ? window.icn(n, s || 14) : ''; } catch (e) { return ''; } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// je Option ein eigener Zustand (Startbild = Screenshot des Nutzers)
const st = {};
['A', 'B', 'C', 'D'].forEach(o => { st[o] = { mode: 'preis', layout: 'neben', skala: 'band', typ: 'line', zeit: 'Custom', menu: false }; });

const btn = (o, k, v, on, txt, extra) => `<button data-kd="${o}" data-k="${k}" data-v="${v}" class="${on ? 'on' : ''}"${extra || ''}>${txt}</button>`;
const seg = (o, k, liste, akt, aus) => `<span class="kd-seg${aus ? ' aus' : ''}" role="group">${liste.map(([v, l]) => btn(o, k, v, akt === v, esc(l), aus ? ' disabled' : '')).join('')}</span>`;
const typSeg = (o, s, aus) => `<span class="kd-seg${aus ? ' aus' : ''}" role="group">${btn(o, 'typ', 'candle', s.typ === 'candle', ic('candles', 14) + 'Candles', aus ? ' disabled' : '')}${btn(o, 'typ', 'line', s.typ === 'line', ic('line', 14) + 'Line', aus ? ' disabled' : '')}</span>`;
const zeitSeg = (o, s) => `${s.zeit === 'Custom' ? `<span class="kd-chip">Feb 10 – Oct 30 <b data-kd="${o}" data-k="zeit" data-v="1Y">×</b></span>` : ''}<span class="kd-ic">${ic('scissors', 15)}</span><span class="kd-seg" role="group">${ZEIT.map(z => btn(o, 'zeit', z, s.zeit === z, z)).join('')}</span>`;
const preisModus = s => s.mode === 'preis';
const typAn = s => s.mode === 'preis' || s.mode === 'alle';
function kopf(s) {
  const f = s.mode === 'preis' ? 'Prices <b>6/6</b>' : s.mode === 'alle' ? '＋ Add <b>6/8</b>' : s.mode === 'inds' ? 'Indicators <b>4/8</b>' : 'Assets <b>4/8</b>';
  return `<div class="kd-kopf"><div><div class="kd-kopf-t">Data</div><div class="kd-kopf-s">${esc(MODI.find(m => m[0] === s.mode)[1])}</div></div><button class="btn" tabindex="-1">${ic('filter', 13)}<span>${f}</span></button></div>`;
}
const charts = (s, n) => `<div class="kd-charts">${(s.mode === 'preis' && s.layout === 'eins' ? ['Price comparison'] : PANELS).slice(0, n || 6).map(t => `<div class="kd-chart">${esc(t)}</div>`).join('')}</div>`;

function optA() {
  const o = 'A', s = st[o];
  return `${kopf(s)}<div class="kd-a">
    <div class="kd-grp"><span class="kd-cap">View</span>${seg(o, 'mode', MODI, s.mode)}</div>
    <div class="kd-grp"><span class="kd-cap">Layout</span>${seg(o, 'layout', LAYOUT, s.layout, !preisModus(s))}</div>
    <div class="kd-grp"><span class="kd-cap">Scale</span>${seg(o, 'skala', SKALA, s.skala, !preisModus(s) || s.layout !== 'eins')}</div>
    <div class="kd-grp"><span class="kd-cap">Chart</span>${typSeg(o, s, !typAn(s))}</div>
    <div class="kd-grp kd-rechts"><span class="kd-cap">Time range</span><span style="display:inline-flex;gap:6px;align-items:center">${zeitSeg(o, s)}</span></div>
  </div>${charts(s, 3)}`;
}
function optB() {
  const o = 'B', s = st[o];
  const tabs = `<div class="kd-tabs" role="tablist">${MODI.map(([v, l]) => btn(o, 'mode', v, s.mode === v, esc(l))).join('')}<span class="kd-rechts">${zeitSeg(o, s)}</span></div>`;
  const teile = [];
  if (preisModus(s)) {
    teile.push(`<span class="kd-in"><span class="kd-cap">Layout</span>${seg(o, 'layout', LAYOUT, s.layout)}</span>`);
    teile.push(`<span class="kd-in"><span class="kd-cap">Scale</span>${seg(o, 'skala', SKALA, s.skala, s.layout !== 'eins')}</span>`);
  }
  if (typAn(s)) teile.push(`<span class="kd-in"><span class="kd-cap">Chart</span>${typSeg(o, s)}</span>`);
  return `${kopf(s)}${tabs}${teile.length ? `<div class="kd-bar">${teile.join('<span class="kd-div"></span>')}</div>` : ''}${charts(s, 3)}`;
}
function optC() {
  const o = 'C', s = st[o];
  const tabs = `<div class="kd-tabs" role="tablist">${MODI.map(([v, l]) => btn(o, 'mode', v, s.mode === v, esc(l))).join('')}</div>`;
  const zus = [preisModus(s) ? LAYOUT.find(x => x[0] === s.layout)[1] : null, preisModus(s) && s.layout === 'eins' ? SKALA.find(x => x[0] === s.skala)[1] : null, typAn(s) ? (s.typ === 'candle' ? 'Candles' : 'Line') : null].filter(Boolean);
  const disp = zus.length ? `<button class="kd-disp${s.menu ? ' on' : ''}" data-kd="C" data-k="menu" data-v="x">${ic('gear', 14)}<span>Display</span><em>${esc(zus.join(' · '))}</em><span aria-hidden="true">▾</span></button>` : '';
  const mini = v => v === 'eins' ? '<span class="kd-mini" style="grid-template-columns:1fr"><i></i></span>' : '<span class="kd-mini" style="grid-template-columns:1fr 1fr"><i></i><i></i></span>';
  const kachel = (k, v, l, sub, on, aus, vorne) => `<button class="kd-kachel${on ? ' on' : ''}" data-kd="C" data-k="${k}" data-v="${v}"${aus ? ' disabled' : ''}>${vorne || ''}<span>${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
  const menu = s.menu && zus.length ? `<div class="kd-menu">
      ${preisModus(s) ? `<div class="kd-sek"><span class="kd-cap">Layout</span><div class="kd-kacheln">${LAYOUT.map(([v, l]) => kachel('layout', v, l, v === 'eins' ? 'all prices in one chart' : 'one chart per price', s.layout === v, false, mini(v))).join('')}</div></div>
      <div class="kd-sek"><span class="kd-cap">Scale${s.layout !== 'eins' ? ' · only in one chart' : ''}</span><div class="kd-kacheln">${SKALA.map(([v, l, sub]) => kachel('skala', v, l, sub, s.skala === v, s.layout !== 'eins')).join('')}</div></div>` : ''}
      ${typAn(s) ? `<div class="kd-sek"><span class="kd-cap">Chart</span><div class="kd-kacheln">${kachel('typ', 'candle', 'Candles', 'one per trading day', s.typ === 'candle', false, ic('candles', 16))}${kachel('typ', 'line', 'Line', 'daily closes', s.typ === 'line', false, ic('line', 16))}</div></div>` : ''}
    </div>` : '';
  return `${kopf(s)}${tabs}<div class="kd-c-zeile"><span class="kd-anker">${disp}${menu}</span><span class="kd-rechts">${zeitSeg(o, s)}</span></div>${charts(s, 3)}`;
}
function optD() {
  const o = 'D', s = st[o];
  const f = s.mode === 'preis' ? 'Prices 6/6' : s.mode === 'alle' ? '＋ Add 6/8' : s.mode === 'inds' ? 'Indicators 4/8' : 'Assets 4/8';
  const side = `<div class="kd-side">
    <div class="kd-sek"><span class="kd-cap">View</span><div class="kd-liste">${MODI.map(([v, l]) => btn(o, 'mode', v, s.mode === v, `<span>${esc(l)}</span>`)).join('')}</div></div>
    <div class="kd-sek"><span class="kd-cap">Selection</span><div style="margin-top:6px"><button class="btn" tabindex="-1" style="height:34px;width:100%;display:flex;align-items:center;gap:6px;justify-content:center">${ic('filter', 13)}${esc(f)}</button></div></div>
    ${preisModus(s) ? `<div class="kd-sek"><span class="kd-cap">Layout</span>${seg(o, 'layout', LAYOUT, s.layout)}</div>` : ''}
    ${preisModus(s) && s.layout === 'eins' ? `<div class="kd-sek"><span class="kd-cap">Scale</span>${seg(o, 'skala', SKALA, s.skala)}</div>` : ''}
    ${typAn(s) ? `<div class="kd-sek"><span class="kd-cap">Chart</span>${typSeg(o, s)}</div>` : ''}
    <div class="kd-sek"><span class="kd-cap">Time range</span><div class="kd-zeitraster">${ZEIT.map(z => `<button data-kd="${o}" data-k="zeit" data-v="${z}" class="${s.zeit === z ? 'on' : ''}">${z}</button>`).join('')}</div>${s.zeit === 'Custom' ? `<div style="margin-top:6px"><span class="kd-chip">Feb 10 – Oct 30 <b data-kd="${o}" data-k="zeit" data-v="1Y">×</b></span></div>` : ''}</div>
  </div>`;
  return `<div class="kd-kopf"><div><div class="kd-kopf-t">Data</div><div class="kd-kopf-s">${esc(MODI.find(m => m[0] === s.mode)[1])}</div></div></div><div class="kd-d">${side}<div>${charts(s, 4)}</div></div>`;
}

const OPTS = [
  ['A', 'Labelled groups', ['Every group in its own bordered segment with a <b>caption</b>: View · Layout · Scale · Chart · Time range', 'Everything visible at once, <b>no extra tap</b>', '<i>Many buttons side by side - wraps into 2–3 rows on the iPad in portrait</i>'], optA],
  ['B', 'Tabs + toolbar', ['<b>View as tabs</b> under the title, <b>time range</b> on the same line (applies to every view)', 'Below <b>one toolbar</b>: only the settings of this view, divided by lines', '<i>Clear hierarchy; the toolbar changes with the view, none for views without settings</i>'], optB],
  ['C', 'Tabs + Display menu', ['View as tabs, then <b>one "Display" button</b> with the current choice as summary', 'Tap opens a <b>control menu</b>: Layout · Scale · Chart as tiles with a short explanation', '<i>Fewest buttons on screen; changing a setting = one extra tap</i>'], optC],
  ['D', 'Side panel', ['<b>Control column</b> left of the charts: View, Selection, Layout, Scale, Chart, Time range - top to bottom', 'Like a pro charting tool; charts get the full height', '<i>Costs ~230 px width; on the phone the column moves above the charts</i>'], optD],
];

function kdZeichnen() {
  const box = document.querySelector('#fdOv .kd-box'); if (!box) return;
  box.querySelectorAll('.kd-opt').forEach(el => { const o = OPTS.find(x => x[0] === el.dataset.o); el.querySelector('.kd-mock').innerHTML = o[3](); });
}
function kdKlick(e) {
  const b = e.target.closest('[data-kd]'); if (!b || b.disabled) return;
  const s = st[b.dataset.kd], k = b.dataset.k, v = b.dataset.v;
  if (k === 'menu') s.menu = !s.menu;
  else { s[k] = v; if (k === 'mode' && v !== 'preis' && v !== 'alle') s.menu = false; }
  kdZeichnen();
}
function kdZu() {
  const ov = document.getElementById('fdOv'); if (ov) ov.remove();
  try { sessionStorage.setItem('fxpro_kd_zu', '1'); } catch (e) {}
}
function kdAuf() {
  if (document.getElementById('fdOv')) return;
  if (!document.getElementById('kdCss')) { const s = document.createElement('style'); s.id = 'kdCss'; s.textContent = KD_CSS; document.head.appendChild(s); }
  const ov = document.createElement('div');
  ov.id = 'fdOv'; ov.className = 'kd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Data controls - designs');
  ov.innerHTML = `<div class="kd-box">
    <div class="kd-hd"><div><div class="kd-hd-t">Data controls · 4 designs</div><div class="kd-hd-s">Try each one - tell Claude which to build (A, B, C or D)</div></div><button class="btn" data-kd-zu="1">Close</button></div>
    ${OPTS.map(([o, t, pkt]) => `<div class="kd-opt" data-o="${o}"><div class="kd-ot"><b>Option ${o}</b> · ${esc(t)}</div><ul class="kd-pkt">${pkt.map(x => `<li>${x}</li>`).join('')}</ul><div class="kd-mock"></div></div>`).join('')}
  </div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-kd-zu]')) { kdZu(); return; } kdKlick(e); });
  document.body.appendChild(ov);
  kdZeichnen();
}
export function kontrollDemoStarten() {
  const erzwingen = /[?&]kontrolldemo\b/.test(location.search);
  if (!erzwingen) {
    if (navigator.webdriver) return;
    try { if (sessionStorage.getItem('fxpro_kd_zu') === '1') return; } catch (e) {}
  }
  // erst wenn Sperrbildschirm und Intro weg sind - nie darueber
  const frei = id => { const e = document.getElementById(id); return !e || getComputedStyle(e).display === 'none' || !e.offsetParent && getComputedStyle(e).position !== 'fixed'; };
  let n = 0;
  const warte = () => { if (frei('lockScreen') && frei('introOv')) kdAuf(); else if (++n < 1200) setTimeout(warte, 500); };
  setTimeout(warte, erzwingen ? 300 : 1500);
}
