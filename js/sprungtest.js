// ── SPRUNG-REKORDER (Nutzer 2026-11-15) ────────────────────────────────────
// Nutzer: "generell gibt es den Bug das die App auf fruehere staende nach ein paar
// Sekunden zurueckspringt. Zb wenn ich scrolle buggt es aufeinmal wieder nach oben".
// In der Claude-Umgebung NICHT nachstellbar (gemessen 2026-11-15: Asset-Seite, Cloud-
// Nachbau, langsame Feeds, 7 Speicher-Aktionen je 17 s -> kein Sprung). Regel 8: erst
// messen, dann aendern. Deshalb zeichnet die App selbst auf:
//  - jeden Neuaufbau / Zustands-Wechsel (sprungLog('...') an den Stellen in main.js)
//  - jeden Scroll-Sprung > 200 px ohne eigene Eingabe in den 600 ms davor
// Anzeige nur mit #sprungtest hinter der Adresse (Leiste unten, Copy-Knopf).
// Kostet im Normalbetrieb nur einen Ring-Puffer mit 80 Eintraegen.
const PUFFER = [], MAX = 80;
let letzteEingabe = 0;
const zeit = () => { const d = new Date(); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
export function sprungLog(was, info) {
  try {
    PUFFER.push({ t: Date.now(), z: zeit(), was, info: info || '', seite: (window.curPage || '') });
    if (PUFFER.length > MAX) PUFFER.shift();
    if (anzeige) zeichnen();
  } catch (e) { }
}
let anzeige = null;
function zeichnen() {
  if (!anzeige) return;
  const zeilen = PUFFER.slice(-14).map(e => `<div${/^SPRUNG/.test(e.was) ? ' class="spt-rot"' : ''}><b>${e.z}</b> ${esc(e.was)} <i>${esc(e.info)}</i></div>`).join('');
  anzeige.querySelector('.spt-l').innerHTML = zeilen || '<i>Recording · scroll and use the app until it jumps</i>';
}
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function eingabe() { letzteEingabe = Date.now(); }
['pointerdown', 'touchstart', 'touchmove', 'wheel', 'keydown'].forEach(t => window.addEventListener(t, eingabe, { capture: true, passive: true }));
// Scroll-Spruenge: je Element den letzten Stand merken (capture faengt jeden Scroller)
const stand = new WeakMap();
document.addEventListener('scroll', ev => {
  const el = ev.target === document ? document.scrollingElement : ev.target; if (!el || el.nodeType !== 1) return;
  const neu = el.scrollTop, alt = stand.get(el); stand.set(el, neu);
  if (alt == null || Math.abs(neu - alt) < 200) return;
  if (Date.now() - letzteEingabe < 600) return;           // vom Nutzer
  const davor = PUFFER.filter(e => Date.now() - e.t < 3000 && !/^SPRUNG/.test(e.was)).map(e => e.was).slice(-4).join(' > ') || 'nothing recorded';
  sprungLog('SPRUNG', `${el.id || el.className || el.tagName} ${Math.round(alt)} -> ${Math.round(neu)} · before: ${davor}`);
}, { capture: true, passive: true });
export function sprungtestStart() {
  if (!/sprungtest/.test(location.hash)) return;
  anzeige = document.createElement('div');
  anzeige.id = 'sprungtest';
  anzeige.innerHTML = `<div class="spt-k"><b>Jump recorder</b><button type="button">Copy</button></div><div class="spt-l"></div>`;
  anzeige.querySelector('button').onclick = () => { try { navigator.clipboard.writeText(PUFFER.map(e => `${e.z} ${e.was} ${e.info}`).join('\n')); } catch (e) { } };
  document.body.appendChild(anzeige);
  zeichnen();
}
export function sprungPuffer() { return PUFFER.slice(); }
