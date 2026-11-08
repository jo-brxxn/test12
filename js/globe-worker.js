'use strict';
// Web Worker der Weltkugel (2026-11-06, siehe Kopf von js/globe-zeichnen.js):
// besitzt die Canvas-Flaeche der Kugel (OffscreenCanvas). Der
// Hauptthread aendert je Bild nichts am Dokument - die Seite muss nicht neu
// zusammengesetzt werden.
//
// EIGENER BILDTAKT (requestAnimationFrame im Worker). Seit 2026-11-08 kommt
// JEDE Bewegung als Bahn (js/globe-bahn.js): Normaltempo, Schwung nach dem
// Loslassen, Ziehen. Der Worker rechnet den Winkel je Bild selbst aus der Bahn
// und seiner Uhr - egal wie beschaeftigt der Hauptthread ist (vorher: Stand je
// Hauptthread-Bild, hoechstens 50 ms hochgerechnet -> Stillstand und
// Ruecksprung beim schnellen Drehen).
//   ziel  : der Finger zieht - der Worker folgt dem Zielwinkel geglaettet
//           (ZIEL_MS), statt in Stufen des Eingabetakts zu springen.
//   Wechsel zwischen Bahnen (Loslassen, Normaltempo erreicht): der Abstand
//   zwischen gezeigtem Winkel und neuer Bahn klingt in UEBERGANG_MS aus - kein
//   Sprung, nie rueckwaerts gegen die Bewegung.
// Ohne Worker-rAF: Zeichnen auf Zuruf mit Flusskontrolle ('fertig' -> naechstes Bild).
import { erstelleZeichner } from './globe-zeichnen.js';
import { bahnWinkel, kurz } from './globe-bahn.js';

const RAF = typeof self.requestAnimationFrame === 'function';
const ZIEL_MS = 30, UEBERGANG_MS = 120;
const jetzt = () => performance.timeOrigin + performance.now();
const norm = x => (x % 360 + 360) % 360;
let z = null, bahn = null, laeuft = false, n = 0, letzt = 0, luecken = [], winkel = [];
let anim = true, vx = null, vy = null, gezeigt = null, versatz = 0, versatzT = 0, zuletztT = 0;

function winkelJetzt(T) {
  if (bahn.typ === 'ziel') {
    const k = gezeigt == null || !zuletztT ? 1 : 1 - Math.exp(-(T - zuletztT) / ZIEL_MS);
    gezeigt = gezeigt == null ? bahn.lon0 : norm(gezeigt + kurz(gezeigt, bahn.lon0) * k);
  } else {
    let lon = bahnWinkel(bahn, T);
    if (versatz) { const f = Math.exp(-(T - versatzT) / UEBERGANG_MS); lon = norm(lon + versatz * f); if (f < 0.002) versatz = 0; }
    gezeigt = lon;
  }
  zuletztT = T;
  return gezeigt;
}

function schleife() {
  if (!laeuft) return;
  if (z && bahn) {
    const t = performance.now(), T = jetzt();   // EIN Zeitpunkt fuer Winkel und Aufzeichnung
    const lon = winkelJetzt(T);
    z.bild(lon, t, anim, vx, vy);
    winkel.push([Math.round(T * 100) / 100, Math.round(lon * 10000) / 10000]);   // fuer check/performance.js + webkitkugel.js: gleichmaessige Drehung
    if (letzt) luecken.push(Math.round((t - letzt) * 10) / 10);   // Bildabstaende fuer check/performance.js
    letzt = t;
    if (++n % 15 === 0) { self.postMessage({ typ: 'gezeichnet', n: 15, luecken, winkel }); luecken = []; winkel = []; }
  }
  self.requestAnimationFrame(schleife);
}

self.onmessage = e => {
  const d = e.data;
  if (d.typ === 'init') { z = erstelleZeichner(d.land, d.o); self.postMessage({ typ: 'bereit', raf: RAF }); return; }
  if (!z) return;
  if (d.typ === 'ringe') { z.land(d.ringe); self.postMessage({ typ: 'kueste', punkte: z.punkte() }); }   // Punktzahl fuer check/performance.js
  else if (d.typ === 'meta') z.meta(d.marker);
  else if (d.typ === 'start') { if (RAF && !laeuft) { laeuft = true; letzt = 0; zuletztT = 0; self.requestAnimationFrame(schleife); } }
  else if (d.typ === 'stop') laeuft = false;
  else if (d.typ === 'bahn') {
    const neu = d.bahn;
    anim = d.anim; vx = d.vx; vy = d.vy;
    // Uebergang: vom gezeigten Winkel weich auf die neue Bahn (nicht bei 'ziel' -
    // dort folgt die Glaettung ohnehin; nicht ueber 45 Grad - dann war es ein Neustart)
    if (gezeigt != null && neu.typ !== 'ziel' && !neu.ohneUebergang && (!bahn || bahn !== neu)) {
      const T = jetzt(), v = kurz(bahnWinkel(neu, T), gezeigt);
      versatz = Math.abs(v) < 45 ? v : 0; versatzT = T;
    } else if (neu.typ !== 'ziel') versatz = 0;
    bahn = neu;
  }
  else if (d.typ === 'bild') { z.bild(d.lon, d.t, d.anim, d.vx, d.vy); self.postMessage({ typ: 'fertig' }); }
};
