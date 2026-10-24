# Performance — Dauerregeln

Anlass: Nutzer 2026-10-03, *„Die Webseite hat Performance Probleme also es
ruckelt manchmal und Animationen und so sind einfach nicht clean und es hakt
und braucht teilweise länger zu laden"*. Messwerte und Verlauf:
`docs/CHANGELOG.md`, VERSION-CHECK-587. Geprüft von `check/performance.js`
(zählt, statt Zeiten zu stoppen — Zeiten schwanken mit der Last, Zählwerte
nicht).

## 1. Endlos-Animationen bewegen nur `transform`/`opacity`

`box-shadow`, `background-position`, `filter`, Größen, Farben … malen in
JEDEM Bild neu. Ein einziger box-shadow-Puls (COT-Hinweiskarte) kostete auf
dem Dashboard 608 ms Paint je 4 s Leerlauf. Gleicher Look geht fast immer
GPU-freundlich:
- Schatten-Puls → zweiter Schatten auf `::after`, dessen `opacity` pulst.
- Ring aus `box-shadow`-spread → Scheibe auf `::after`, `transform:scale` + `opacity`.
- wandernde Streifen per `background-position` → Streifenfläche auf `::before`
  (um eine Periode höher, Eltern `overflow:hidden`), `transform:translateY`.
Ausnahmen nur mit Grund in `ERLAUBT_MALEND` (`check/performance.js` S).
⚠ Innerhalb eines Inline-SVG wird nie auf der GPU animiert — auch
`transform` auf einem SVG-Kind malt das SVG neu. Deshalb sparsam.

## 2. Viele gleichartige Elemente nie einzeln animieren

Trend-Punkte, Balken, Listenzeilen: EINE Animation auf der Gruppe (`<g>`,
Container), nicht eine pro Element mit Versatz. 3292 Punkt-Animationen auf
Trends = 2,1 s PrePaint und ~250 ms je Bild, solange sie liefen.
Grenze im Wächter: 400 gleichzeitige Animationen je Seite.

## 3. Einblendungen enden mit `fill-mode: backwards`

Wenn der Endzustand der natürliche ist (opacity 1, keine Verschiebung), nicht
`both`/`forwards` — eine fertige Animation mit `both` bleibt als Effekt am
Element hängen. Nur wo der Endwert vom Normalzustand abweicht (z. B.
`.tr-halo-fade` endet bei .7), bleibt `both`.

## 4. Ticker schreiben Text, nie Element-HTML

Was sich jede Sekunde oder jedes Bild ändert (Uhr, Countdown, Globus-
Beschriftung, Zähler): Gerüst EINMAL bauen, danach nur `textContent`
bestehender Elemente — und nur, wenn sich der Text wirklich ändert. Ein
`innerHTML` mit Elementen ist eine Element-Mutation und weckt die
Seiten-Beobachter (`kartenIconsNachtragen`, `infoKnoepfeEinordnen`,
`kopfTitelEinpassen`, `lgAlleKarten`), die dann die ganze Seite vermessen.
Reine Textwechsel filtern sie seit 2026-10-03 heraus (`nurTextMutation`).

## 5. Eine Seite wird EINMAL aufgebaut

Zustand (z. B. `selId`) VOR `showTab` setzen, statt `showTab` die alte Seite
zeichnen zu lassen und danach die neue (`gotoSym`, `sbClick`). Nachladende
Daten, die nur eine Karte betreffen, tauschen nur diese Karte
(`calpNeuZeichnen` → Kalenderkarte), nicht `renderDetail`.

## 6. Erst alles messen, dann alles schreiben

Abwechselnd lesen (`getBoundingClientRect`, `getComputedStyle` auf
Layout-Werte, `offsetWidth`) und schreiben erzwingt nach jedem Schreiben ein
neues Layout. Schleifen messen zuerst alle Elemente, dann setzen sie alle
(`lgAlleKarten`). Billige Prüfungen VOR teuren Lesungen (`tagName` vor
`getComputedStyle`, `infoKnoepfeEinordnen`). Probier-Schleifen halbieren
statt Stufe für Stufe (`kopfTitelEinpassen`).

## 7. Pro Bild nichts neu rechnen, was sich nicht pro Bild ändert

Globus: Scores der Labels höchstens einmal je Sekunde, feste
Winkelfunktionen der Küstenpunkte einmal je Ring (`globeRingPre`).
Score-Zwischenwerte, die für alle Indikatoren eines Assets gleich sind,
einmal je Asset und Datenstand (`mktMovesFor`).

## 8. Dauerbewegung = Filmstreifen, nie Live-Animation in geteilten Vorlagen

Nutzer 2026-10-03 auf die Frage, ob die Asset-Animationen kürzer laufen
sollen: *„Das kann nicht sein dann baust du das falsch die Animationen werden
nur ganz am Anfang einmal geladen dann nur wiederholt das ist nicht
anspruchsvoll. Bau das besser"*. Gemessen bestätigt: Die Animationen liefen
live in den GETEILTEN Vorlagen (`#aiDefs`, SMIL-Welle + CSS in `<symbol>`s),
auch für unsichtbare Symbole — selbst mit allen Symbolen ausgeblendet 557 ms
je 4 s, mit einem sichtbaren Symbol 1439 ms (Paint/PrePaint/Layerize/Layout
über die ganze Seite in jedem Bild).

Regel: Eine Dauerbewegung wird EINMAL als Filmstreifen vorberechnet
(`aiFilm`, 30 Bilder/s, aus denselben Formeln/Keyframes) und per
`transform` + `steps()` abgespielt — Arbeit pro Bild: null auf dem
Hauptthread. Alle Filme laufen auf der gemeinsamen Uhr (negative
`animation-delay` aus `performance.now()`), ein Neuzeichnen setzt sie nicht
zurück. Filme werden im Leerlauf gebaut (`aiFilmeNachziehen`), nie im
Render-Pfad (5 ms je Film). Nachher: Asset-Seite und Dashboard 0 %
Hauptthread im Leerlauf (vorher 28 %/33 %), Wisch bei 4× Drossel Median
17 ms je Bild (vorher 50). Geprüft: `check/performance.js` E,
`check/symbole.js` A/B.

⚠ Nicht in WebKit gemessen (Download in der Cloud-Umgebung gesperrt) — die
iPad-Prüfung steht beim Nutzer aus (Stand 2026-10-03).

## 9. Nichts zeichnen, was man nicht sieht — und Register räumen sich selbst auf

(Prüfdurchgang 2026-10-16, gemessen.)
- **Overview-Kugel:** neu gezeichnet wird nur, wenn sich die Oberfläche seit
  dem letzten Bild um ≥ 0,5 px bewegt hätte (Normaltempo 0,35 px je Bild →
  jedes zweite Bild); Boost/Schub/Ziehen weiter jedes Bild, der Radar-Strahl
  immer. Küstenpunkte < 0,6 px Abstand werden ausgelassen, `Math.round`
  statt `toFixed`. Aus dem Bild gescrollt → gar nicht. Leerlauf vorher
  ~1.760 ms je 5 s, danach ~1.180 (Rest: HUD-Animationen und Muster-Ebenen,
  GPU). `check/performance.js` G.
- **Register mit Zähler-IDs** (`_chvReg` der Chart-Tooltips) löschen
  Einträge, deren Element nicht mehr im Dokument steht. Vorher +3,5 MB je 40
  Seitenwechsel, unbegrenzt. `check/performance.js` F. Neue Register dieser
  Art brauchen dasselbe (oder eine Obergrenze wie `HW_DET`/`JR_DET`).
- **Kugel ruht im Leerlauf** (2026-10-17): nach `GLOBE_RUHE_MS` (60 s) ohne
  Eingabe läuft die Drehung in ~2 s aus, Endlos-Animationen der Kugel
  pausieren (`.globe-ruht`). Jede Maus-/Tipp-/Tasten-/Scroll-Eingabe weckt sie
  sofort. Gemessen: Overview-Leerlauf **1.206 → 125 ms je 5 s** (inkl.
  Auslaufen). Billiger ZEICHNEN ging nicht: Canvas gemessen **5–10× teurer**,
  gröbere Küste nur −13 %. `check/performance.js` H.
- **Küstenpfad als Ganzzahlen** (2026-10-17): Koordinaten in Zehntel-Pixeln,
  Pfad unter `scale(.1)`, Viereck-Muster dazu unter `patternTransform=scale(10)`.
  Ganzzahl → Text ist ~3,5× schneller als Kommazahl → Text, Pfad 14 % kürzer.
  Pixelvergleich alt/neu: 5 von 490.000 Pixeln (dpr 1) bzw. 24 von 1.960.000
  (dpr 2) verschieden, max. 1/255. Drehende Kugel **1.168 → 860 ms je 5 s
  (−27 %)**. `check/performance.js` G prüft Ganzzahlen + beide Transforms.
- **Merker statt Neurechnen** auch für `indCycleIsGuess` (Array-Identität
  von `chartHist`): Score-Kette beim Laden 366 → 210 ms.


## Teil-Aufbau statt ganzer Seite (seit 2026-10-24, VERSION-CHECK-623)

*Anlass:* Nutzer *„Mach es maximal schnell“* (Makro-Analyse). Gemessen CPU 4x: jeder Makro-Klick 0,9–1,9 s bis zum Bild.

- **Eine Bedienung, die nur einen Bereich ändert, baut nur diesen Bereich neu.** Makro: `makroReiheNeu()` (`[data-mkreihe]`) statt `renderDetail()` — der volle Aufbau kostete 595–717 ms, das Zeichnen 84–137 ms.
- **Nie zweimal zeichnen:** der Nachlauf im nächsten Bild zeichnet nur, was fehlt (`makroZeichnenFehlende`).
- **Zwischenspeicher je Datenstand:** leeren bei jedem vollen Aufbau (jede Datenänderung), behalten bei Teil-Aufbauten.
- **Nachbearbeitung je Karte, nie die ganze Seite:** Logo-Freiraum (`lgKartenPlanen`) misst nur Karten mit eigener Mutation oder ResizeObserver-Meldung. Vorher 742 ms je 12 Bedienungen.
- **Reine Ansichts-Zustände speichern gebündelt** (`saveSoon`): jedes `save()` rechnet Score-Historie + Journal neu (~170 ms bei CPU 4x).
- **Hover höchstens einmal je Bild**, nächster Punkt per binärer Suche.
- Wächter: `check/makro.js` H (0 volle Aufbauten, genau 1x zeichnen je Bedienung, Gegenprobe = alter Weg).
