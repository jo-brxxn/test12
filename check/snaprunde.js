const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: DER EIGENE STAND LAESST SICH WIEDER EINSPIELEN ═════════════
// Anlass 2026-11-12 (VERSION-CHECK-716): beim Loeschen der Makro-Charts blieb
// in applySnap() ein Aufruf makroAnsichtSetzen() stehen. Die Seite lief ohne
// Fehler - applySnap laeuft nur beim Cloud-Abgleich, bei Undo/Redo und beim
// Uebernehmen aus einem anderen Tab. Gemessen (check/altgeraet.js D): JEDER
// Cloud-Abgleich warf "makroAnsichtSetzen is not defined", der Fehler wurde
// still geschluckt, der Cloud-Stand stand halb uebernommen da und die offene
// Eingabe des Geraets war weg.
// Fehlerklasse: ein Pfad, der nur bei Sync/Undo/Tab-Wechsel laeuft, ruft
// einen Namen, den es nicht mehr gibt - kein Laden der Seite findet ihn.
// Geprueft:
//   A) applySnap(snap())    - Cloud-Weg und Undo/Redo
//   B) adoptExternalState() - Stand aus einem anderen Tab
//   C) loadState()          - Start
//   D) applySnap ist ab dem zweiten Durchlauf unveraendernd (einmalige
//      Migrationen eines frischen Stands im ersten Durchlauf erlaubt)
// Gegenprobe --gegenprobe: in applySnap wird ein unbekannter Aufruf
// eingeschleust (ausgeliefertes main.js umgeschrieben) -> A rot.
const {chromium}=require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({serviceWorkers:'block'});
  if(GP)await ctx.route(/\/js\/main\.js/,async r=>{const res=await r.fetch();let t=await res.text();t=t.replace(/function applySnap\(s\)\{/,'function applySnap(s){gpGibtEsNicht();');r.fulfill({response:res,body:t});});
  const p=await ctx.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
  await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
  await p.goto('http://127.0.0.1:'+PORT+'/index.html');await wartenBisDatenDa(p);
  const F=await p.evaluate(()=>{
    const F=[];const ohneZeit=s=>{const o=JSON.parse(s);delete o.savedAt;delete o.appVer;return JSON.stringify(o);};
    // Erster Durchlauf darf einmalige Migrationen eines frischen Stands
    // nachholen (z.B. research._noteSchemaV 1 -> 2); ab dem zweiten muss der
    // Stand gleich bleiben.
    try{applySnap(snap());}catch(e){F.push('A applySnap(snap()) wirft: '+e.message);}
    const vor=ohneZeit(snap());
    try{applySnap(snap());}catch(e){if(!F.length)F.push('A applySnap(snap()) wirft: '+e.message);}
    if(!F.length&&ohneZeit(snap())!==vor)F.push('D applySnap aendert den eigenen Stand');
    try{flushAndSave();localStorage.setItem('fxpro_updated',new Date(Date.now()+1000).toISOString());adoptExternalState();}catch(e){F.push('B adoptExternalState wirft: '+e.message);}
    try{loadState();}catch(e){F.push('C loadState wirft: '+e.message);}
    return F;});
  err.forEach(e=>F.push('JS-Fehler: '+e));
  await b.close();
  if(GP){const ok=F.some(f=>/^A /.test(f));console.log(ok?'snaprunde --gegenprobe: ok (unbekannter Aufruf in applySnap gemeldet)':'snaprunde --gegenprobe: FEHLER - nicht gemeldet\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('snaprunde: '+F.length+' Befund(e)\n  '+F.join('\n  '));process.exit(1);}
  console.log('snaprunde: ok (applySnap, adoptExternalState und loadState spielen den eigenen Stand fehlerfrei und unveraendert ein)');
})().catch(e=>{console.log('snaprunde: ABBRUCH '+e.message);process.exit(1);});
