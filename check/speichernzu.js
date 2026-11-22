// ── SPEICHERN SCHLIESST DAS FENSTER (Nutzer-Regel 2026-11-22, VERSION-CHECK-803) ──
// Nutzer: "wenn man bei so Fenstern auf speichern drueckt soll es dann auch direkt sich schliessen.
// Setz das auch bei den anderen Fenstern um". Statisch: jeder Knopf in einer Fenster-Knopfleiste
// (.m-btns in index.html), dessen Text mit Save/Create/Add/Close trade beginnt, ruft eine Funktion, deren
// Koerper das Fenster schliesst (closeM/closeMGuarded/ein bekannter Schliess-Helfer).
// Gegenprobe (--gegenprobe): saveCloudCfg ohne closeM -> rot.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), GP = process.argv.includes('--gegenprobe');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let js = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n');
if (GP) js = js.replace("  closeM('mCloud');\n  // manual:true", "  // manual:true");
const SCHLIESST = /closeM\(|closeMGuarded\(|tjFensterZu\(|\.close\(\)/;
const F = [], gesehen = [];
for (const leiste of html.match(/<div class="m-btns"[\s\S]*?<\/div>/g) || []) {
  for (const m of leiste.matchAll(/<button[^>]*onclick="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)) {
    const text = m[2].replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();
    if (!/^(Save|Create|Add|Close trade)/i.test(text)) continue;
    const oc = m[1];
    if (SCHLIESST.test(oc)) { gesehen.push(text); continue; }
    const fn = (oc.match(/^\s*([A-Za-z_$][\w$]*)\(/) || [])[1];
    if (!fn) { F.push(`"${text}": Handler nicht lesbar (${oc})`); continue; }
    const i = js.indexOf('function ' + fn + '(');
    if (i < 0) { F.push(`"${text}": Funktion ${fn} nicht gefunden`); continue; }
    const e = js.indexOf('\n}', i), koerper = js.slice(i, e < 0 ? i + 4000 : e);
    if (!SCHLIESST.test(koerper)) F.push(`"${text}" (${fn}) schliesst das Fenster nicht`);
    else gesehen.push(text);
  }
}
if (GP) { const ok = F.some(f => /saveCloudCfg/.test(f)); console.log(ok ? 'speichernzu --gegenprobe: ok (Settings ohne closeM rot)' : 'speichernzu --gegenprobe: FEHLER'); process.exit(ok ? 0 : 1); }
if (F.length) { console.log(`speichernzu: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
console.log(`speichernzu: ok (${gesehen.length} Speichern-Knoepfe schliessen ihr Fenster)`);
