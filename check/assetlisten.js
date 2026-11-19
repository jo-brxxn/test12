// ── JEDES ASSET IN JEDER KURS-LISTE, IN USD (seit 2026-11-17, VERSION-CHECK-746) ──
// Nutzer 2026-11-17: "immer wenn du Preise fuer Assets hinzufuegst die usd Kurse benutzen also
// solusd und xauusd ueberpruef das ueberall". Beim Pruefen gefunden: Copper/Natural Gas (734) und
// Solana (745) fehlten im Kerzen-Nachtrag backfill-ohlc.yml (2 bzw. 1 von 40 Tagen mit Kerze,
// BTC 40/40) - eine Liste, an die beim Hinzufuegen niemand dachte. Statisch geprueft:
//  A) jedes Nicht-FX-Asset (ohne Aktien/Renditen) steht in JEDER Kursliste: Live (TradingView),
//     3J-Tageskurse, 4h-Trend, Saisonalitaet (Pflichtliste + Quelle), Kerzen-Nachtrag
//  B) USD-Kurse: Krypto live <BOERSE>:<COIN>USD (kein USDT), Historie <COIN>-USD; Retail <X>USD
// --gegenprobe: SOL aus dem Kerzen-Nachtrag entfernt -> A rot.
const fs = require('fs'); const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const GP = process.argv.includes('--gegenprobe');
const main = R('js/main.js'), wf = R('.github/workflows/update-ff-calendar.yml');
let bf = R('.github/workflows/backfill-ohlc.yml');
if (GP) bf = bf.replace(',"SOL",', ',');
const F = [];
const kat = (main.match(/const SB_CATS=\[([\s\S]*?)\n\];/) || [])[1] || '';
const ids = [...kat.matchAll(/\{l:'([^']+)',ids:\[([^\]]*)\]/g)].filter(m => !/^(FX|Stocks|Yields)$/.test(m[1]))
  .flatMap(m => [...m[2].matchAll(/'([A-Z0-9]+)'/g)].map(x => x[1]));
if (ids.length < 8) F.push('Testaufbau: SB_CATS nicht gelesen (' + ids.join(',') + ')');
const liste = (txt, re) => { const m = txt.match(re); return m ? m[0] : ''; };
// Begruendete Luecken (Quelle gemessen, nicht vergessen): je Liste {Asset: Grund}.
// 768: Eisenerz - Sonde tools/neue-assets-sonde.mjs: Yahoo TIO=F liefert keine Stundenkurse -> kein 4H-Trend.
const AUSNAHME = { '4h-Trend (IDS)': { IRONORE: 'Yahoo TIO=F ohne Stundenkurse (Sonde 768)' } };
const L = {
  'Live (TradingView MAP)': [...wf.matchAll(/"[A-Z_]+:[A-Z0-9!]+":\{id:"([A-Z0-9]+)"/g)].map(m => m[1]).join(' '),
  '3J-Tageskurse (MAPS)': liste(wf, /MAPS="[^"]*"/),
  '4h-Trend (IDS)': liste(wf, /const IDS=\["USD"[^\]]*,\.\.\.AKT\];/),   // seit 766 mit den Aktien (...AKT)
  'Saisonalitaet (Pflichtliste)': liste(wf, /const alle=\[[^\]]*\]/),
  'Saisonalitaet (Quelle)': liste(wf, /declare -A PROXY=\( \[GOLD\]=GLD[^)]*\)/),
  'Kerzen-Nachtrag (backfill-ohlc IDS)': liste(bf, /const IDS=\[[^\]]*\]/),
  'Kerzen-Nachtrag (backfill-ohlc Yahoo)': liste(bf, /for PAIR in [^;]*;/),
};
Object.entries(L).forEach(([n, t]) => {
  if (!t) { F.push(`A: Liste "${n}" nicht gefunden`); return; }
  const fehlt = ids.filter(id => !new RegExp(`(^|[^A-Z0-9])${id}([^A-Z0-9]|$)`).test(t)).filter(id => !(AUSNAHME[n] && AUSNAHME[n][id]));
  if (fehlt.length) F.push(`A: ${n} ohne ${fehlt.join(', ')}`);
});
// C (768): jedes Asset der Seitenleiste hat ein eigenes Symbol. Gefunden beim Anlegen von Nikkei/Russell:
// AI_MARKEN allein reicht nicht, assetIconHtml verlangt AI_SYMBOLS oder AI_INDEX_ACCENT - sonst leeres Symbol.
{
  let kon = R('js/constants.js');
  if (GP) kon = kon.replace(/RUSSELL: '#5FC08A', /, '');
  const symb = (kon.match(/export const AI_SYMBOLS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const hatSym = new Set([...symb.matchAll(/\n  ([A-Z0-9]+): [`']/g)].map(m => m[1]));
  const akz = new Set([...((kon.match(/export const AI_INDEX_ACCENT = \{([^}]*)\}/) || [])[1] || '').matchAll(/([A-Z0-9]+):/g)].map(m => m[1]));
  if (hatSym.size < 8) F.push('Testaufbau: AI_SYMBOLS nicht gelesen');
  ids.forEach(id => { if (!hatSym.has(id) && !akz.has(id)) F.push(`C: ${id} ohne Symbol (weder AI_SYMBOLS noch AI_INDEX_ACCENT) - zeigt ein leeres Kaestchen`); });
}
// B
const krypto = ((kat.match(/\{l:'Crypto',ids:\[([^\]]*)\]/) || [])[1] || '').match(/[A-Z0-9]+/g) || [];
krypto.forEach(id => {
  const tv = [...wf.matchAll(new RegExp(`"([A-Z_]+:[A-Z0-9]+)":\\{id:"${id}"`, 'g'))].map(m => m[1]);
  if (!tv.length || tv.some(t => !new RegExp(`:${id}USD$`).test(t))) F.push(`B: ${id} live nicht als ${id}USD (${tv.join(',') || 'fehlt'})`);
  const y = (L['3J-Tageskurse (MAPS)'].match(new RegExp(`${id}:(\\S+)`)) || [])[1];
  if (y !== `${id}-USD`) F.push(`B: ${id} Historie "${y}" statt ${id}-USD`);
});
const nonfx = (wf.match(/const NONFX=\[([^\n]*)\];/) || [])[1] || '';
[...nonfx.matchAll(/\["([A-Z0-9]+)"/g)].map(m => m[1]).filter(s => /^(X[A-Z]{2}|BTC|SOL|ETH)/.test(s)).forEach(s => { if (!/USD$/.test(s)) F.push(`B: Retail-Symbol ${s} nicht in USD`); });
if (GP) { const ok = F.some(f => /^A: Kerzen-Nachtrag.*SOL/.test(f)) && F.some(f => /^C: RUSSELL/.test(f)); console.log(ok ? 'assetlisten --gegenprobe: ok (fehlendes SOL im Kerzen-Nachtrag gemeldet)' : 'assetlisten --gegenprobe: FEHLER\n  ' + F.join('\n  ')); process.exit(ok ? 0 : 1); }
if (F.length) { console.log('assetlisten: ' + F.length + ' Befund(e)\n  ' + F.join('\n  ')); process.exit(1); }
console.log(`assetlisten: ok (${ids.length} Assets in ${Object.keys(L).length} Kurslisten, Krypto ${krypto.join('/')} in USD, Retail in USD)`);
