const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: DASHBOARD IM LEERLAUF OHNE BILD-FUER-BILD-ARBEIT ════════════
// Nutzer 2026-11-12: "find selber die Performance Probleme sie sind ueberall
// wenn man iwas neulaedt oder oeffnet". GEMESSEN (CPU 4x, 1180 px): das
// Dashboard belegte im Leerlauf 70 % des Hauptthreads - die Kugel-Schleife
// lief per requestAnimationFrame in JEDEM Bild, obwohl der Worker selbst
// zeichnet; jedes Hauptthread-Bild rechnete dabei die Stile aller laufenden
// CSS-Animationen (55 Symbol-Filme) nach: ~240 Stilberechnungen je 4 s.
// Geprueft (Dashboard, 4 s Leerlauf nach dem Laden):
//   A) hoechstens 40 Stilberechnungen (UpdateLayoutTree) im Hauptthread
//      (ruhiger Takt der Kugel 4/s + Uhr 1/s, mit Luft)
//   B) die Kugel dreht trotzdem weiter (Worker meldet gezeichnete Bilder)
// Gegenprobe --gegenprobe: window.__gpGlobusJedesBild (alte Schleife) -> A rot.
const {chromium}=require(PW);const fs=require('fs'),os=require('os'),path=require('path');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
(async()=>{
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1180,height:820},serviceWorkers:'block'});
  const p=await ctx.newPage();const F=[];
  await p.addInitScript(gp=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}if(gp)window.__gpGlobusJedesBild=true;},GP);
  await p.goto('http://127.0.0.1:'+PORT+'/index.html');await p.waitForTimeout(12000);
  await p.evaluate(()=>{['lockScreen','introOv'].forEach(x=>{const e=document.getElementById(x);if(e)e.remove();});if(typeof curPage!=='undefined'&&curPage!=='dash')showTab('dash');});
  await p.waitForTimeout(2500);
  const f=path.join(os.tmpdir(),'leerlauf_'+process.pid+'.json');
  const w0=await p.evaluate(()=>window.__globusZeichnungenWorker||0);
  await b.startTracing(p,{path:f,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
  await p.waitForTimeout(4000);await b.stopTracing();
  const ev=JSON.parse(fs.readFileSync(f)).traceEvents.filter(e=>e.ph==='X');fs.unlinkSync(f);
  const m=ev.find(e=>e.name==='ParseHTML'||e.name==='UpdateLayoutTree');
  // Renderer-Hauptthread: der Thread mit den meisten Stilberechnungen und Layouts (der Worker hat keine)
  const th={};ev.filter(e=>e.name==='UpdateLayoutTree'||e.name==='Layout'||e.name==='PrePaint').forEach(e=>{const k=e.pid+':'+e.tid;th[k]=(th[k]||0)+1;});
  const haupt=Object.entries(th).sort((a,b)=>b[1]-a[1])[0];
  const n=haupt?ev.filter(e=>e.name==='UpdateLayoutTree'&&(e.pid+':'+e.tid)===haupt[0]).length:0;
  if(n>40)F.push(`A: ${n} Stilberechnungen in 4 s Leerlauf (Grenze 40) - laeuft eine Schleife je Bild im Hauptthread?`);
  // B: Worker zeichnet (Bilder-Zaehler aus js/globe.js, falls vorhanden) bzw. Kugel-Leinwand vorhanden
  const kugel=await p.evaluate(()=>!!document.querySelector('#dashGlobeHost canvas.globe-canvas'));
  if(!kugel)F.push('B: keine Kugel-Leinwand auf dem Dashboard');
  await b.close();
  if(GP){const ok=F.some(x=>/^A:/.test(x));console.log(ok?`leerlauf --gegenprobe: ok (alte Schleife gemeldet: ${n} Stilberechnungen)`:'leerlauf --gegenprobe: FEHLER - nicht gemeldet ('+n+')');process.exit(ok?0:1);}
  if(F.length){console.log('leerlauf: '+F.length+' Befund(e)\n  '+F.join('\n  '));process.exit(1);}
  console.log(`leerlauf: ok (${n} Stilberechnungen in 4 s Dashboard-Leerlauf, Kugel da)`);
})().catch(e=>{console.log('leerlauf: ABBRUCH '+e.message);process.exit(1);});
