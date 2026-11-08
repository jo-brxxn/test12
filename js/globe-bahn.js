// ══ BAHN DER WELTKUGEL: Drehwinkel als Zeitfunktion ═══════════════════════
// Hauptthread UND Kugel-Worker rechnen den Winkel aus DERSELBEN Formel und
// derselben Uhr (performance.timeOrigin + performance.now()). Der Hauptthread
// schickt eine neue Bahn nur, wenn sich die Bewegung aendert (Loslassen,
// Normaltempo erreicht, Fingerbewegung) - nie mehr "Stand je Bild".
// GEMESSEN 2026-11-08 (Nutzer: "ruckelt und hakt manchmal wenn man sie schnell
// dreht"): Schwung nach dem Loslassen kam als Stand je Hauptthread-Bild, der
// Worker rechnete hoechstens 50 ms hoch. Chromium mit belegtem Hauptthread:
// 22-27 Rueckwaerts-Schritte je Wisch, Spitzen bis 6.400 Grad/s; WebKit:
// Stillstand-Aufhol-Folgen (-166, 0, 0, 0, -596 Grad/s).
//
// Bahn-Typen (Winkel in Grad, Zeit in ms, Tempo in Grad/ms):
//   lin     : lon0 + v * d                                  (Normaltempo, Schub)
//   abkling : lon0 + a*d + (v0 - a) * tau * (1 - e^(-d/tau)) (Schwung klingt auf a ab)
//   ziel    : lon0                                          (Finger zieht - Worker folgt geglaettet)
// d = Zeit seit t0. kappe (nur Gegenprobe check/performance.js): d hoechstens kappe ms.

export function bahnWinkel(b, T) {
  let d = Math.max(0, T - b.t0);
  if (b.kappe) d = Math.min(d, b.kappe);
  let lon = b.lon0;
  if (b.typ === 'lin') lon += b.v * d;
  else if (b.typ === 'abkling') lon += b.a * d + (b.v0 - b.a) * b.tau * (1 - Math.exp(-d / b.tau));
  return ((lon % 360) + 360) % 360;
}

export function bahnTempo(b, T) {
  const d = Math.max(0, T - b.t0);
  if (b.typ === 'lin') return b.v;
  if (b.typ === 'abkling') return b.a + (b.v0 - b.a) * Math.exp(-d / b.tau);
  return 0;
}

// kuerzester Weg von a nach b in Grad (-180..180]
export const kurz = (a, b) => ((b - a) % 360 + 540) % 360 - 180;
