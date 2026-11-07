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
let z = null, stand = null, laeuft = false, n = 0, letzt = 0, luecken = [];

function schleife() {
  if (!laeuft) return;
  if (z && stand) {
    // hoechstens 300 ms weiterrechnen - danach steht die Kugel, bis der
    // Hauptthread wieder meldet (z. B. Seite gewechselt)
    const dt = Math.min(Math.max(0, jetzt() - stand.t), 300);
    const t = performance.now();
    z.bild(((stand.lon + stand.vel * dt) % 360 + 360) % 360, t, stand.anim, stand.vx, stand.vy);
    if (letzt) luecken.push(Math.round((t - letzt) * 10) / 10);   // Bildabstaende fuer check/performance.js
    letzt = t;
    if (++n % 15 === 0) { self.postMessage({ typ: 'gezeichnet', n: 15, luecken }); luecken = []; }
  }
  self.requestAnimationFrame(schleife);
}

self.onmessage = e => {
  const d = e.data;
  if (d.typ === 'init') { z = erstelleZeichner(d.land, d.o); self.postMessage({ typ: 'bereit', raf: RAF }); return; }
  if (!z) return;
  if (d.typ === 'ringe') z.land(d.ringe);
  else if (d.typ === 'meta') z.meta(d.marker);
  else if (d.typ === 'start') { if (RAF && !laeuft) { laeuft = true; letzt = 0; self.requestAnimationFrame(schleife); } }
  else if (d.typ === 'stop') laeuft = false;
  else if (d.typ === 'zustand') stand = d;
  else if (d.typ === 'bild') { z.bild(d.lon, d.t, d.anim, d.vx, d.vy); self.postMessage({ typ: 'fertig' }); }
};
