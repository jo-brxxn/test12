// ══ HOCHGERECHNETE WERTE IN DEN FEED (feed_zusatz.json) ═══════════════════
// Nutzer 2026-11-10: "trag bei usd fuer cpi und core cpi einen geschaetzten fc
// und actual ein den du aus veroeffentlichen Werten heute hochrechnest. Weil
// es wurde kein y/y herausgegeben nur m/m das soll auch voll in den Score
// zaehlen". ⚠ Bewusste AUSNAHME von Regel 4 (nie schaetzen) - deshalb:
//   - jeder Eintrag steht mit seiner Rechnung in feed_zusatz.json
//   - er traegt est:true (die App zeigt "EST" an der Zeile)
//   - er gilt nur, solange der Feed keinen JUENGEREN echten Release fuehrt;
//     ein echter Wert am selben Tag gewinnt ebenfalls
// Laeuft im Workflow nach dem Indikator-Schritt.   node tools/feed-zusatz.mjs
import fs from 'node:fs';
const z = JSON.parse(fs.readFileSync('feed_zusatz.json', 'utf8'));
const out = JSON.parse(fs.readFileSync('ind_data.json', 'utf8'));
let n = 0;
for (const e of z.eintraege || []) {
  const g = out[e.ccy]; if (!g) { console.log(`[zusatz] ${e.ccy} fehlt im Feed`); continue; }
  const cur = g[e.ind];
  if (cur && !cur.est && cur.date && cur.date >= e.date) { console.log(`[zusatz] ${e.ccy} ${e.ind}: echter Release ${cur.date} (${cur.actual}) - Schaetzung entfaellt`); continue; }
  const basis = cur && cur.est ? cur._vorEst : cur;      // der letzte ECHTE Stand
  const hf = (basis && Array.isArray(basis.historyFull) ? basis.historyFull : []).filter(h => h && h[0] < e.date);
  const hi = (basis && Array.isArray(basis.history) ? basis.history : []).filter(h => h && h[0] < e.date);
  g[e.ind] = {
    actual: e.actual, forecast: e.forecast, previous: basis ? basis.actual : null, date: e.date, event: e.event, period: basis ? basis.period : null,
    source: 'est', est: true, estNote: e.note || '',
    history: hi.concat([[e.date, e.actual]]).slice(-4), historyFull: hf.concat([[e.date, e.actual, e.forecast]]),
    _vorEst: basis ? Object.assign({}, basis, { _vorEst: undefined }) : null,
  };
  n++; console.log(`[zusatz] ${e.ccy} ${e.ind} = ${e.actual} (Prognose ${e.forecast}, ${e.date}, hochgerechnet)`);
}
fs.writeFileSync('ind_data.json', JSON.stringify(out));
console.log(`[zusatz] ${n} hochgerechnete(r) Wert(e) geschrieben`);
