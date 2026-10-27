// ── SAISONALITAET: Monatszuordnung im Workflow ──────────────────────────
// Gefunden 2026-10-27 (Nutzer: "Probier auch seasonality fuer NZD zu
// finden"): NZD und DAX fehlten seit dem 25.10. in seasonality_data.json.
// Der Schritt "Fetch seasonality" legte den HEUTIGEN UTC-Versatz der Boerse
// (meta.gmtoffset) auf alle 15 Jahre Monats-Bars. Yahoo stempelt einen
// Monat auf Mitternacht der Boersenzeit - im Sommer also 23:00 UTC (London)
// bzw. 22:00 UTC (Berlin) des Vormonats. Seit dem Ende der Sommerzeit
// fielen damit alle Sommermonate in den Vormonat; per Sonde gemessen:
// NZDUSD=X, ^GDAXI und alle 28 FX-Paare mit Monaten von 1 und 30 Jahren
// statt 15-16 -> Asset verworfen, und weil die Datei neu geschrieben wurde,
// verschwand es still (samt Saisonalitaets-Zeile im Score).
// Dieser Waechter laesst den ECHTEN Node-Block des Schritts mit kuenstlichen
// Monats-Bars laufen (Mitternacht London/Berlin/New York, je Bar in der
// damals gueltigen Sommer-/Winterzeit, heutiger Versatz = Winterzeit):
//   A) jedes Asset hat 12 Monate mit je >= 8 Jahren;
//   B) das eingebaute Muster kommt im richtigen Monat an (Juli +1 %, Januar -1 %);
//   C) ein Asset, dessen Abruf scheitert, behaelt seinen letzten Stand;
//      eines, das nicht mehr in der Proxy-Liste steht, faellt weg.
//   node check/saisonfeed.js [--gegenprobe]   (alte gmtoffset-Zuordnung -> rot)
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const GEGENPROBE = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const y = fs.readFileSync(path.join(ROOT, '.github/workflows/update-ff-calendar.yml'), 'utf8');
const i = y.indexOf('const YEARS=15');
const a = y.lastIndexOf("node -e '\n", i), b = y.indexOf("\n          '\n", i);
let code = (i < 0 || a < 0 || b < 0) ? null : y.slice(a + 9, b);
if (!code) fail('WORKFLOW', 'Node-Block des Schritts "Fetch seasonality" (const YEARS=15) nicht gefunden');
if (code && GEGENPROBE) code = code.replace('const mon=monatVon(ts[i]);', 'const mon=new Date((ts[i]+((r.meta&&r.meta.gmtoffset)||0))*1000).getUTCMonth()+1;');
if (code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saisonfeed-'));
  // Mitternacht Ortszeit am 1. des Monats als UTC-Sekunden
  const mitternacht = (jahr, mon, tz) => {
    const utc = Date.UTC(jahr, mon - 1, 1);
    for (const off of [-14, -12, -11, -10, -9, -8, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]) {
      const t = utc - off * 3600e3;
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(t));
      const g = k => +p.find(x => x.type === k).value;
      if (g('year') === jahr && g('month') === mon && g('day') === 1 && g('hour') === 0) return t / 1000;
    }
    throw new Error('keine Mitternacht ' + tz);
  };
  const jetzt = new Date();
  const ASSETS = { LON: 'Europe/London', BER: 'Europe/Berlin', NYC: 'America/New_York', AKL: 'Pacific/Auckland', UTCX: 'UTC' };
  const meta = [];
  Object.entries(ASSETS).forEach(([id, tz]) => {
    const ts = [], close = [];
    let c = 100;
    for (let j = jetzt.getUTCFullYear() - 20; j <= jetzt.getUTCFullYear(); j++) for (let m = 1; m <= 12; m++) {
      if (j === jetzt.getUTCFullYear() && m > jetzt.getUTCMonth() + 1) break;
      // Monats-Return: Juli +1 %, Januar -1 %, sonst 0 - die Bar des Monats
      // traegt den Schlusskurs DIESES Monats
      c = c * (m === 7 ? 1.01 : m === 1 ? 0.99 : 1);
      ts.push(mitternacht(j, m, tz)); close.push(+c.toFixed(6));
    }
    // heutiger Versatz (meta.gmtoffset) - genau das, was die alte Zuordnung auf alle Bars legte
    const off = (() => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(jetzt).find(x => x.type === 'timeZoneName').value; const m = /GMT([+-]\d+)?(?::(\d+))?/.exec(p); return m && m[1] ? (+m[1]) * 3600 + Math.sign(+m[1]) * (+(m[2] || 0)) * 60 : 0; })();
    fs.writeFileSync(path.join(dir, `seas_${id}.json`), JSON.stringify({ chart: { result: [{ meta: { gmtoffset: off, exchangeTimezoneName: tz, dataGranularity: '1mo' }, timestamp: ts, indicators: { quote: [{ close }] } }] } }));
    meta.push(`${id} SYM_${id}`);
  });
  fs.writeFileSync(path.join(dir, 'seas_meta.txt'), meta.join('\n') + '\n');
  // Vor-Stand: WEG (Abruf scheitert heute, steht in der Proxy-Liste) und ALT (nicht mehr in der Liste)
  const zwoelf = Array.from({ length: 12 }, (_, k) => [k + 1, 0.1, 50, 15]);
  fs.writeFileSync(path.join(dir, 'seasonality_data.json'), JSON.stringify({ updated: '2026-01-01', assets: { WEG: { proxy: 'X', inv: 0, months: zwoelf }, ALT: { proxy: 'Y', inv: 0, months: zwoelf } } }));
  fs.writeFileSync(path.join(dir, 'seas.js'), code);
  const r = cp.spawnSync(process.execPath, ['seas.js'], { cwd: dir, env: Object.assign({}, process.env, { SEAS_ALLE: Object.keys(ASSETS).join(' ') + ' WEG' }), encoding: 'utf8' });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(path.join(dir, 'seasonality_data.json'), 'utf8')); } catch (e) { fail('LAUF', String(r.stderr || e.message).slice(0, 300)); }
  fs.rmSync(dir, { recursive: true, force: true });
  if (out) {
    Object.keys(ASSETS).forEach(id => {
      const A = out.assets[id];
      if (!A) { fail('MONATE', `${id} (${ASSETS[id]}) fehlt in der Datei - Ausgabe: ${(r.stdout.match(/seasonality.*$/m) || [''])[0].slice(0, 200)}`); return; }
      const kurz = A.months.filter(m => m[3] < 8).map(m => m[0] + ':' + m[3]);
      if (A.months.length !== 12 || kurz.length) fail('MONATE', `${id}: ${A.months.length} Monate, zu wenig Jahre ${kurz.join(' ')}`);
      const mon = k => (A.months.find(m => m[0] === k) || [])[1];
      if (Math.abs(mon(7) - 1) > 0.01 || Math.abs(mon(1) + 1) > 0.01 || Math.abs(mon(6)) > 0.01) fail('MONAT FALSCH', `${id}: Juli ${mon(7)} %, Januar ${mon(1)} %, Juni ${mon(6)} % - erwartet +1 / -1 / 0`);
    });
    if (!out.assets.WEG) fail('LETZTER STAND', 'WEG (Abruf gescheitert, in der Proxy-Liste) fehlt - er muss seinen letzten Stand behalten');
    if (out.assets.ALT) fail('LETZTER STAND', 'ALT steht nicht mehr in der Proxy-Liste und darf nicht mitgeschleppt werden');
  }
}
if (GEGENPROBE) {
  const ok = F.some(x => x.startsWith('MONATE') || x.startsWith('MONAT FALSCH'));
  console.log(ok ? 'saisonfeed --gegenprobe: ok (alte gmtoffset-Zuordnung wird gemeldet: ' + F.filter(x => /^MONAT/.test(x)).length + ' Befunde)' : 'saisonfeed --gegenprobe: FEHLER - nicht gemeldet\n  ' + F.join('\n  '));
  process.exit(ok ? 0 : 1);
}
if (F.length) { console.log(`saisonfeed: ${F.length} Befund(e)\n  ` + F.join('\n  ')); process.exit(1); }
console.log('saisonfeed: ok (Saisonalitaet: Monatszuordnung in Boersenzeit fuer London/Berlin/New York/Auckland/UTC, Muster im richtigen Monat, gescheiterter Abruf behaelt letzten Stand)');
