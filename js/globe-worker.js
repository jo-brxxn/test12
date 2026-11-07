'use strict';
// Web Worker der Weltkugel (2026-11-06, siehe Kopf von js/globe-zeichnen.js):
// besitzt die Canvas-Flaeche der Kugel (OffscreenCanvas). Der
// Hauptthread aendert je Bild nichts am Dokument - die Seite muss nicht neu
// zusammengesetzt werden.
//
// EIGENER BILDTAKT (requestAnimationFrame im Worker): der Hauptthread schickt
// je Bild nur seinen Zustand (Winkel, Geschwindigkeit, Zeitpunkt); der Worker
// zeichnet in seinem Takt und rechnet die Drehung bis "jetzt" weiter. Ist der
// Hauptthread kurz belegt (Uhr in der Kopfzeile, Feed-Aufbau), dreht die Kugel
// trotzdem ohne Aussetzer weiter. Ohne Worker-rAF: Zeichnen auf Zuruf mit
// Flusskontrolle ('fertig' -> naechstes Bild).
import { erstelleZeichner } from './globe-zeichnen.js';

const RAF = typeof self.requestAnimationFrame === 'function';
const jetzt = () => performance.timeOrigin + performance.now();
let z = null, stand = null, seg = null, laeuft = false, n = 0, letzt = 0, luecken = [], winkel = [];

function schleife() {
  if (!laeuft) return;
  const quelle = seg || stand;
  if (z && quelle) {
    const t = performance.now();
    let lon;
    // Normalbetrieb: Winkel exakt aus der Zeitformel (kein Zurueckspringen,
    // unabhaengig davon, wie beschaeftigt der Hauptthread ist).
    const T = jetzt();   // EIN Zeitpunkt fuer Winkel und Aufzeichnung
    if (seg) lon = seg.lon0 + seg.v * (T - seg.t0);
    // Ziehen/Schwung/Boost: letzter Stand, hoechstens 50 ms weitergerechnet
    else lon = stand.lon + stand.vel * Math.min(Math.max(0, T - stand.t), 50);
    lon = (lon % 360 + 360) % 360;
    z.bild(lon, t, quelle.anim, quelle.vx, quelle.vy);
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
  else if (d.typ === 'start') { if (RAF && !laeuft) { laeuft = true; letzt = 0; self.requestAnimationFrame(schleife); } }
  else if (d.typ === 'stop') laeuft = false;
  else if (d.typ === 'zustand') { stand = d; seg = null; }
  else if (d.typ === 'seg') { seg = d; stand = null; }
  else if (d.typ === 'bild') { z.bild(d.lon, d.t, d.anim, d.vx, d.vy); self.postMessage({ typ: 'fertig' }); }
};
