// ══ LEICHTES FEDERN AM SCROLL-ENDE ═══════════════════════════════════════════
//
// Nutzer 2026-11-01: "Im Filter und generell wenn man scrollt dann bounct das
// ja am Ende immer so zurueck das finde ich gut mach das ueberall wo man
// scrollen kann" - per Rueckfrage: "Senkrecht und seitlich aber in Tabellen
// nur ganz wenig und generell nur ganz wenig das es nicht so verspielt
// aussieht", Wahl "Eigenes leichtes Federn".
//
// Warum eigenes Federn: das iOS-Gummiband hat keine einstellbare Staerke
// (overscroll-behavior kennt nur an/aus). Deshalb bleibt das native Federn
// AUS (*{overscroll-behavior:none} in index.html - "feste Tabellen",
// 2026-09-25: keine Weitergabe an die Seite) und dieses Modul verschiebt am
// Rand den SICHTBAREN Inhalt des Scrollbereichs ein paar Pixel und laesst ihn
// zurueckschnellen:
//   - beim Ziehen ueber den Rand (Finger) - Auslenkung mit abnehmendem Zuwachs,
//     gedeckelt;
//   - beim Auslaufen eines Wischs, der an den Rand stoesst (kurzer Kick).
// Deckel: Seite (.pc/.detail) 14 px, Listen/Tabellen/Fenster 8 px, seitlich
// 6 px. Nur Touch - Mausrad/Trackpad am PC federn nicht.
// Bewegt wird die CSS-Eigenschaft `translate` (nicht `transform`): sie
// addiert sich zu einem vorhandenen transform, ueberschreibt es nicht, und
// laeuft wie transform auf der Grafikebene (docs/performance.md).
// Geprueft von check/federn.js.

export const FEDER_MAX = { seite: 14, innen: 8, x: 6 };
const WEICH = 90;          // px Zug bis ~63 % des Deckels
const ZURUECK = 'translate .28s cubic-bezier(.2,.8,.3,1)';

const istSeite = el => el.classList && (el.classList.contains('pc') || el.classList.contains('detail'));
const deckel = (el, achse) => achse === 'x' ? FEDER_MAX.x : (istSeite(el) ? FEDER_MAX.seite : FEDER_MAX.innen);

// Innerster Bereich, der in dieser Achse wirklich scrollen kann.
function scrollt(el, achse) {
  if (!(el instanceof Element) || /^(TEXTAREA|INPUT|SELECT)$/.test(el.tagName)) return false;
  const cs = getComputedStyle(el), ov = achse === 'y' ? cs.overflowY : cs.overflowX;
  if (!/(auto|scroll)/.test(ov)) return false;
  return achse === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}
function finde(start, achse) {
  for (let e = start; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (scrollt(e, achse)) return e;
  return null;
}
// Nur die gerade sichtbaren Kinder bewegen (lange Listen: wenige statt aller).
function sichtbareKinder(el) {
  const r = el.getBoundingClientRect(), out = [];
  for (const k of el.children) {
    const q = k.getBoundingClientRect();
    if (!q.width && !q.height) continue;
    if (q.bottom > r.top - 20 && q.top < r.bottom + 20 && q.right > r.left - 20 && q.left < r.right + 20) out.push(k);
    if (out.length >= 120) break;
  }
  return out;
}
const pos = (el, achse) => achse === 'y' ? el.scrollTop : el.scrollLeft;
const maxPos = (el, achse) => achse === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
const wert = (achse, px) => achse === 'y' ? `0 ${px.toFixed(1)}px` : `${px.toFixed(1)}px 0`;

let ber = null;            // laufende Beruehrung
let letzteBeruehrung = 0;  // Ende der letzten Beruehrung (Kick nur nach Touch)
const kickBereit = new WeakMap();   // el -> {y:true,x:true}: Kick erlaubt, bis der Rand wieder verlassen wurde
const letzterStand = new WeakMap(); // el -> {y,x,t}

function setzen(b, px) {
  b.disp = px;
  b.kinder.forEach(k => { k.style.transition = 'none'; k.style.translate = wert(b.achse, px); });
}
function loslassen(b) {
  if (!b || !b.kinder || !b.disp) return;
  b.kinder.forEach((k, i) => {
    k.style.transition = ZURUECK; k.style.translate = b.alt[i] || '';
    setTimeout(() => { if (k.style.transition === ZURUECK) k.style.transition = b.altT[i] || ''; }, 320);
  });
}
function kick(el, achse, richtung, staerke) {
  const max = deckel(el, achse), px = Math.max(2, Math.min(max, staerke)) * richtung;
  const k = sichtbareKinder(el);
  k.forEach(x => { try { x.animate([{ translate: wert(achse, 0) }, { translate: wert(achse, px), offset: .3 }, { translate: wert(achse, 0) }], { duration: 320, easing: 'ease-out' }); } catch (e) {} });
}

export function federnAn() {
  if (window.__federnAn) return; window.__federnAn = true;
  document.addEventListener('touchstart', e => {
    if (ber) loslassen(ber);
    ber = e.touches.length === 1 ? { x0: e.touches[0].clientX, y0: e.touches[0].clientY, ziel: e.target, achse: null, ueber: 0, disp: 0 } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', e => {
    const b = ber; if (!b || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (!b.achse) {
      const dx = t.clientX - b.x0, dy = t.clientY - b.y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      b.achse = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      b.el = finde(b.ziel, b.achse);
      b.letzt = b.achse === 'y' ? t.clientY : t.clientX;
      if (!b.el) { b.aus = true; return; }
      b.max = deckel(b.el, b.achse);
    }
    if (b.aus) return;
    const jetzt = b.achse === 'y' ? t.clientY : t.clientX, delta = jetzt - b.letzt; b.letzt = jetzt;
    const p = pos(b.el, b.achse), m = maxPos(b.el, b.achse);
    // Finger zieht ueber den Anfang (delta > 0) bzw. ueber das Ende (delta < 0)
    if (b.ueber > 0 || (p <= 0 && delta > 0)) b.ueber = Math.max(0, b.ueber + delta);
    else if (b.ueber < 0 || (p >= m - 1 && delta < 0)) b.ueber = Math.min(0, b.ueber + delta);
    if (!b.ueber && !b.disp) return;
    if (!b.kinder) { b.kinder = sichtbareKinder(b.el); b.alt = b.kinder.map(k => k.style.translate); b.altT = b.kinder.map(k => k.style.transition); }
    const px = Math.sign(b.ueber) * b.max * (1 - Math.exp(-Math.abs(b.ueber) / WEICH));
    setzen(b, px);
  }, { capture: true, passive: true });
  const ende = () => { if (ber) { loslassen(ber); ber = null; } letzteBeruehrung = Date.now(); };
  document.addEventListener('touchend', ende, { capture: true, passive: true });
  document.addEventListener('touchcancel', ende, { capture: true, passive: true });
  // Auslaufen eines Wischs, der an den Rand stoesst: kurzer Kick. Nur kurz
  // nach einer Beruehrung - das Mausrad am PC federt nicht.
  document.addEventListener('scroll', e => {
    const el = e.target; if (!(el instanceof Element)) return;
    const jetzt = performance.now(), alt = letzterStand.get(el), st = { y: el.scrollTop, x: el.scrollLeft, t: jetzt };
    letzterStand.set(el, st);
    if (!alt || ber || Date.now() - letzteBeruehrung > 2500) return;
    const dt = Math.max(1, jetzt - alt.t);
    for (const achse of ['y', 'x']) {
      const p = st[achse], v = (p - alt[achse]) / dt, m = maxPos(el, achse);
      const bereit = kickBereit.get(el) || {};
      const amRand = p <= 0 || p >= m - 1;
      if (!amRand) { bereit[achse] = true; kickBereit.set(el, bereit); continue; }
      if (bereit[achse] === false || Math.abs(v) < 0.4 || !scrollt(el, achse)) continue;
      bereit[achse] = false; kickBereit.set(el, bereit);
      kick(el, achse, p <= 0 ? 1 : -1, Math.abs(v) * 6);
    }
  }, { capture: true, passive: true });
}
