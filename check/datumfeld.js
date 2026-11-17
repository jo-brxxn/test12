// ── DATUM-/ZEIT-FELDER RAGEN NICHT UEBER IHRE SPALTE (seit 2026-11-17, VERSION-CHECK-741) ──
// Nutzer-Foto 2026-11-17 (iPad): im Fenster "New trade" ragte "Open time" ueber den
// Fensterrand. iOS Safari gibt <input type=date|time> eine eigene Mindestbreite, die
// width:100% in einer minmax(0,1fr)-Spalte ueberstimmt. Chromium zeigt den Fehler nicht
// (bei 6 Breiten gemessen: 0 px ueber) - deshalb statisch:
//  A) es gibt eine globale Regel fuer input[type=date] UND input[type=time] mit
//     min-width:0, max-width:100% und appearance:none (sonst greift die Mindestbreite)
//  B) kein Datum-/Zeit-Feld setzt per style= eine feste Mindestbreite
// --gegenprobe: Regel entfernt -> A rot.
const fs = require('fs'); const path = require('path');
const GP = process.argv.includes('--gegenprobe');
let html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
if (GP) html = html.replace(/input\[type=date\],input\[type=time\][^{]*\{[^}]*\}/, '');
const F = [];
const regeln = [...html.matchAll(/([^{}]*input\[type=date\][^{}]*)\{([^}]*)\}/g)].filter(m => /input\[type=time\]/.test(m[1]) && !/::/.test(m[1]));
const ok = regeln.some(m => /min-width:0/.test(m[2]) && /max-width:100%/.test(m[2]) && /(^|;)\s*appearance:none/.test(m[2]));
if (!ok) F.push('A: keine globale Regel input[type=date],input[type=time]{appearance:none;min-width:0;max-width:100%} - auf iPad ragen die Felder ueber ihre Spalte');
const js = fs.readdirSync(path.join(__dirname, '..', 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
[...(html + js).matchAll(/<input[^>]*type=["']?(date|time)["']?[^>]*>/g)].forEach(m => { if (/style=["'][^"']*min-width:\s*[1-9]/.test(m[0])) F.push('B: Feld mit fester Mindestbreite: ' + m[0].slice(0, 90)); });
if (GP) { const r = F.some(f => /^A:/.test(f)); console.log(r ? 'datumfeld --gegenprobe: ok (fehlende Regel gemeldet)' : 'datumfeld --gegenprobe: FEHLER'); process.exit(r ? 0 : 1); }
if (F.length) { console.log('datumfeld: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
console.log('datumfeld: ok (Datum-/Zeit-Felder: appearance:none, min-width:0, max-width:100%)');
