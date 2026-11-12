const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: MACRO-ZEILE DER ASSET-SEITE - DATA AN ORT UND STELLE ════════
// Nutzer 2026-11-11: "entfern den Charts Umschalter bei den Assets bei macro
// und mach stattdessen dort direkt einen data Umschalter hin mit dem man
// Sachen vergleichen kann direkt dort also das sich sozusagen dort die data
// Seite komplett gleich ist nur halt an den Ort".
// (Bis 2026-11-12 pruefte diese Datei die Charts-Ansicht mit Reiter-Karte -
//  die gibt es nicht mehr.)
//   A) genau EIN Schalter "Data" rechts in der MACRO-Zeile (neben "Sectors");
//      aus = drei Tabellen-Karten, auch wenn frueher "charts" gespeichert war
//   B) an = die EINE Data-Seite (#dataBody) haengt in der Macro-Reihe: Reiter
//      der Data-Seite, mindestens ein Chart des offenen Assets, volle Breite
//   C) Vergleichen dort: zweites Asset -> zwei Felder
//   D) Seite Data oeffnen -> #dataBody ist wieder in #pgData, Inhalt da;
//      zurueck zum Asset -> wieder in der Macro-Reihe; aus -> drei Karten
//   E) Asset wechseln bei offenem Schalter -> Data zeigt das neue Asset
// Gegenprobe --gegenprobe: das Einhaengen unterbunden -> rot.
const {chromium}=require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
(async()=>{
  const b=await chromium.launch();const F=[];
  for(const [w,h] of [[1180,820],[390,844]]){
    const p=await b.newPage({viewport:{width:w,height:h}});const err=[];p.on('pageerror',e=>err.push(e.message));
    await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
    await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'networkidle'});
    await p.evaluate(()=>{const l=document.getElementById('lockScreen');if(l)l.remove();document.querySelectorAll('.ov').forEach(o=>o.style.display='none');});
    await wartenBisDatenDa(p);
    const o=w+'px';
    const lage=()=>p.evaluate(()=>{const d=document.getElementById('dataBody'),slot=document.querySelector('#detail .mk-data-slot'),reihe=document.querySelector('#detail .ab-rtitel-x');
      const sw=[...document.querySelectorAll('#detail .ab-rtitel .mk-rsw')];
      return{sw:sw.length,lbl:sw[0]?sw[0].querySelector('.mk-rsw-l').textContent.trim():'',an:sw[0]?sw[0].querySelector('input').checked:null,
        ort:d.parentElement.id||d.parentElement.className,imSlot:!!(slot&&slot.contains(d)),
        karten:document.querySelectorAll('#detail [data-mkreihe] .rub-card').length,
        reiterKarte:!!document.querySelector('#detail #mkTabKarte, #detail .mk-tk'),
        panels:d.querySelectorAll('.data-panel').length,charts:d.querySelectorAll('.data-pc svg').length,reiter:[...d.querySelectorAll('.data-head button, .data-head [role=tab]')].map(x=>x.textContent.trim()).filter(Boolean).slice(0,5).join('|'),
        assets:dataAssets.join(','),breit:slot&&reihe?Math.round(slot.getBoundingClientRect().width/reihe.getBoundingClientRect().width*100):0,ueber:document.documentElement.scrollWidth-innerWidth};});
    // A) aus - auch mit altem gespeicherten "charts"
    await p.evaluate(()=>{gotoSym('USD');try{makroSicht('charts');}catch(e){}});await p.waitForTimeout(1200);
    let L=await lage();
    if(L.sw!==1||L.lbl!=='Data')F.push(`${o} A: MACRO-Zeile mit ${L.sw} Schalter(n) "${L.lbl}" statt genau einem "Data"`);
    if(L.reiterKarte)F.push(o+' A: die alte Charts-Reiter-Karte wird noch gezeigt');
    if(L.karten!==3)F.push(`${o} A: ${L.karten} Makro-Karten statt 3 (Schalter aus)`);
    // B) an
    if(GP)await p.evaluate(()=>{window.makroDatenEinhaengenAus=true;});
    await p.evaluate(gp=>{const i=document.querySelector('#detail .mk-rsw input');if(gp){const s=document.createElement('style');s.textContent='';document.head.appendChild(s);}i.click();},GP);
    await p.waitForTimeout(1300);
    if(GP)await p.evaluate(()=>makroDatenZurueck());
    L=await lage();
    if(!L.an)F.push(o+' B: Schalter steht nach dem Tipp nicht auf an');
    if(!L.imSlot)F.push(o+' B: die Data-Seite haengt nicht in der Macro-Reihe (steht in '+L.ort+')');
    else{
      if(!L.charts)F.push(o+' B: kein Chart in der eingehaengten Data-Seite');
      if(L.assets!=='USD')F.push(o+' B: Data zeigt '+L.assets+' statt des offenen Assets USD');
      if(!/By asset/.test(L.reiter))F.push(o+' B: Reiter der Data-Seite fehlen ('+L.reiter+')');
      if(L.breit<90)F.push(o+' B: Data-Feld nur '+L.breit+' % der Reihe');
      if(L.karten)F.push(o+' B: daneben stehen noch '+L.karten+' Tabellen-Karten');
    }
    if(L.ueber>1)F.push(o+' B: Seite laeuft '+L.ueber+' px ueber');
    // C) vergleichen
    await p.evaluate(()=>{dataAssets.push('EUR');renderDataTab();});await p.waitForTimeout(700);
    L=await lage();if(L.imSlot&&L.panels!==2)F.push(o+' C: '+L.panels+' Felder nach dem zweiten Asset statt 2');
    // D) Data-Seite und zurueck
    await p.evaluate(()=>showTab('data'));await p.waitForTimeout(800);
    L=await lage();if(L.ort!=='pgData'||!L.charts)F.push(o+' D: auf der Data-Seite steht #dataBody in '+L.ort+' mit '+L.charts+' Charts');
    await p.evaluate(()=>gotoSym('USD'));await p.waitForTimeout(1300);
    if(GP)await p.evaluate(()=>makroDatenZurueck());
    L=await lage();if(!L.imSlot)F.push(o+' D: zurueck auf dem Asset haengt Data nicht wieder in der Macro-Reihe');
    // E) Asset wechseln
    await p.evaluate(()=>gotoSym('GOLD'));await p.waitForTimeout(1300);
    L=await lage();if(!GP&&!L.imSlot)F.push(o+' E: nach dem Asset-Wechsel haengt Data nicht in der Macro-Reihe');
    await p.evaluate(()=>{const i=document.querySelector('#detail .mk-rsw input');if(i&&i.checked)i.click();});await p.waitForTimeout(900);
    L=await lage();if(L.karten!==3||L.ort!=='pgData')F.push(`${o} D: nach dem Ausschalten ${L.karten} Karten, #dataBody in ${L.ort}`);
    if(err.length)F.push(o+' JS-Fehler: '+err[0]);
    await p.close();
  }
  await b.close();
  if(GP){const ok=F.some(f=>/B: die Data-Seite haengt nicht/.test(f));console.log(ok?'makro --gegenprobe: ok (nicht eingehaengt = gemeldet)':'makro --gegenprobe: FEHLER - nicht gemeldet\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('makro: '+F.length+' Befund(e)\n  '+F.join('\n  '));process.exit(1);}
  console.log('makro: ok (ein Schalter Data in der MACRO-Zeile; an = die Data-Seite an Ort und Stelle mit Vergleich, Data-Seite selbst unveraendert, aus = drei Karten)');
})();
