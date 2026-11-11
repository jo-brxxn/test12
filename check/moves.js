const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: PRICE-KARTE "BIGGEST MOVES" ═════════════════════════════════
// Nutzer 2026-11-10: "auf einen Blick ... warum die sich in der Vergangenheit
// bewegt haben". Spalte links: Next up | Biggest moves.
//   A) hoechstens 8 Zeilen, nach Betrag absteigend, jede Bewegung aus den
//      Tages-Schlusskursen unabhaengig nachgerechnet
//   B) Tipp waehlt den Tag - auch einen OHNE Release -, die Tageskarte nennt
//      S&P 500 und die Rendite
//   C) ✕ fuehrt zurueck in die Liste (nicht nach Next up)
// Gegenprobe --gegenprobe: Zeilen ausgeblendet -> rot.
const {chromium}=require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
(async()=>{
  const b=await chromium.launch();const F=[];
  for(const [w,h,id] of [[1366,900,'USD'],[1180,820,'GOLD'],[390,844,'EUR']]){
    const p=await b.newPage({viewport:{width:w,height:h}});const err=[];p.on('pageerror',e=>err.push(e.message));
    await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
    await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'networkidle'});
    await p.evaluate(()=>{const l=document.getElementById('lockScreen');if(l)l.remove();document.querySelectorAll('.ov').forEach(o=>o.style.display='none');});
    await wartenBisDatenDa(p);
    await p.evaluate(id=>gotoSym(id),id);await p.waitForTimeout(1800);
    if(GP)await p.addStyleTag({content:'.pk-mv{display:none!important}'});
    const o=w+'px '+id;
    if(!(await p.$('.pk-modus'))){F.push(o+' A: kein Umschalter Next up | Biggest moves');await p.close();continue;}
    await p.evaluate(()=>pkModusSetzen('moves'));await p.waitForTimeout(400);
    const r=await p.evaluate(id=>{
      const zeilen=[...document.querySelectorAll('.pk-col .pk-mv')].filter(e=>e.offsetParent).map(e=>({txt:e.innerText.replace(/\s+/g,' '),v:parseFloat((e.querySelector('.pk-mv-v')||{}).textContent),k:(e.getAttribute('onclick').match(/'([^']+)'/)||[])[1],ohne:/No tracked release/.test(e.innerText)}));
      const k=tagesKerzen(preisReiheAnzeige(id)||[],id)||[],soll={};k.forEach((x,i)=>{if(i&&k[i-1].c)soll[x.d]=(x.c/k[i-1].c-1)*100;});
      return{zeilen,soll,woche:/Week of/.test((document.querySelector('.pk-mv')||{}).innerText||'')};},id);
    if(!r.zeilen.length){F.push(o+' A: keine Zeile');await p.close();continue;}
    if(r.zeilen.length>8)F.push(o+' A: '+r.zeilen.length+' Zeilen (hoechstens 8)');
    for(let i=1;i<r.zeilen.length;i++)if(Math.abs(r.zeilen[i].v)>Math.abs(r.zeilen[i-1].v)+0.005)F.push(o+' A: nicht nach Betrag sortiert ('+r.zeilen[i-1].v+' vor '+r.zeilen[i].v+')');
    if(!r.woche)r.zeilen.forEach(z=>{const s=r.soll[z.k];if(s==null||Math.abs(s-z.v)>0.006)F.push(o+' A: '+z.k+' zeigt '+z.v+' %, nachgerechnet '+(s==null?'-':s.toFixed(2)));});
    const ziel=r.zeilen.find(z=>z.ohne)||r.zeilen[0];
    await p.evaluate(k=>pkMoveWaehle(k),ziel.k);await p.waitForTimeout(500);
    const t=await p.evaluate(()=>({txt:(document.querySelector('.pk-col')||{}).innerText||'',sel:!!document.querySelector('.pk-lage.sel'),x:!!document.querySelector('.pk-col .pk-x')}));
    if(!/Day|Week/.test(t.txt)||!t.x)F.push(o+' B: Tipp auf '+ziel.k+' oeffnet keine Tageskarte');
    if(id!=='SP500'&&!/S&P 500/.test(t.txt))F.push(o+' B: Tageskarte ohne S&P 500');
    if(!/ bp/.test(t.txt))F.push(o+' B: Tageskarte ohne Rendite');
    await p.evaluate(()=>pkWaehle(null));await p.waitForTimeout(400);
    if(!(await p.evaluate(()=>!!document.querySelector('.pk-col .pk-mv'))))F.push(o+' C: nach ✕ nicht zurueck in Biggest moves');
    if(err.length)F.push(o+' JS-Fehler: '+err[0]);
    await p.close();
  }
  await b.close();
  if(GP){const ok=F.some(f=>/A: keine Zeile/.test(f));console.log(ok?'moves --gegenprobe: ok (ausgeblendete Zeilen = gemeldet)':'moves --gegenprobe: FEHLER - nicht gemeldet\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('moves: '+F.length+' Befund(e)\n  '+F.join('\n  '));process.exit(1);}
  console.log('moves: ok (Biggest moves auf USD/GOLD/EUR: sortiert, nachgerechnet, Tag ohne Release waehlbar, S&P + Rendite, zurueck in die Liste)');
})();
