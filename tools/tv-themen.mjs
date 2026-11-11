// ══ SONDE: WELCHE REIHEN FUEHRT TRADINGVIEW ZU DEN FEHLENDEN THEMEN? ══════════
// Bestandsaufnahme 2026-11-10: im Feed fehlen Handels-/Leistungsbilanz,
// Industrieproduktion/Auftraege, Immobilien (ausser NZD) und Loehne bei EUR und
// CHF. Bevor eine Reihe in die App kommt, muss belegt sein, dass die Quelle sie
// fuehrt (Regel 4) - und der Nutzer waehlt aus. Die Sonde listet je Waehrung die
// Titel der letzten 400 Tage: Anzahl, Abstand, Wichtigkeit, Anteil mit Prognose,
// letzter Wert. Schreibt NICHTS.   node tools/tv-themen.mjs
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TV2CCY = { US: 'USD', EU: 'EUR', DE: 'EUR', GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF' };
const TAG = 864e5, jetzt = Date.now(), iso = t => new Date(t).toISOString();
async function hole(von, bis) {
  const url = `https://economic-calendar.tradingview.com/events?from=${iso(jetzt - von * TAG)}&to=${iso(jetzt - bis * TAG)}&countries=${Object.keys(TV2CCY).join(',')}`;
  for (let v = 0; v < 3; v++) { try { const r = await fetch(url, { headers: { 'User-Agent': UA, Origin: 'https://www.tradingview.com' } }); const j = await r.json(); const a = Array.isArray(j) ? j : (j && Array.isArray(j.result) ? j.result : null); if (a) return a; } catch (e) { } await new Promise(r => setTimeout(r, 1200)); }
  return [];
}
const alle = new Map();
for (let k = 0; k < 20; k++) { (await hole(20 * (k + 1), 20 * k)).forEach(e => alle.set(e.id || e.country + e.title + e.date, e)); await new Promise(r => setTimeout(r, 400)); }
const U = [...alle.values()].filter(e => e.actual != null && e.actual !== '');
console.log('Termine mit Wert in 400 Tagen:', U.length);
const THEMEN = [
  ['Handels- und Leistungsbilanz', /trade balance|balance of trade|current account|exports|imports/i, /price|yoy|mom|qoq|non-eu|auto|oil|gas|crude|goods trade balance non/i],
  ['Industrie und Auftraege', /industrial production|manufacturing production|factory orders|durable goods|industrial output|machinery orders|manufacturing sales/i, /price/i],
  ['Immobilien', /house price|housing starts|building permits|home sales|building approvals|home loans|mortgage approvals|nationwide|halifax|rightmove|housing price/i, /mba/i],
  ['Loehne', /wage|earnings|labou?r cost|compensation/i, null],
];
const wert = e => String(e.actual) + (e.unit === '%' ? '%' : (e.scale || ''));
for (const [name, rx, aus] of THEMEN) {
  console.log('\n[' + name + ']  Waehrung(Land) Titel | n | Tage zwischen Terminen | Wichtigkeit | mit Prognose | letzter Termin Wert');
  const g = {};
  U.forEach(e => { const c = TV2CCY[e.country]; if (!c) return; const t = e.title || ''; if (!rx.test(t) || (aus && aus.test(t))) return; (g[c + '(' + e.country + ') ' + t] = g[c + '(' + e.country + ') ' + t] || []).push(e); });
  Object.keys(g).sort().forEach(k => { const L = g[k].sort((a, b) => a.date < b.date ? -1 : 1); if (L.length < 3) return; const l = L[L.length - 1];
    const abst = Math.round((Date.parse(l.date) - Date.parse(L[0].date)) / TAG / (L.length - 1)), fc = L.filter(e => e.forecast != null && e.forecast !== '').length;
    console.log('  ' + k + ' | ' + L.length + ' | ' + abst + ' | ' + (l.importance == null ? '?' : l.importance) + ' | ' + fc + '/' + L.length + ' | ' + l.date.slice(0, 10) + ' ' + wert(l)); });
}
