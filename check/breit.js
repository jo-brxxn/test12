const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: GROSSE BILDSCHIRME - JEDE SEITE FUELLT DIE BREITE ══════════
// Nutzer 2026-11-09 (Fotos vom PC, Asset-Seite USD): "Beheb den Bug das sich
// das nicht am pc nach rechts weiterverlaengert". GEMESSEN 2560 px: die
// Kompakt-Regel "ab 1500 px 4 Spalten" (body.dense-mode .ab-cards>.ab-orow)
// war spezifischer als die eigenen Spaltenzahlen der Zeilen (.ab-prow 1,
// .ab-orow3 3) - Price bekam 603 von 2440 px, neben dem Kalender stand eine
// leere vierte Spalte. Unter 1500 px (iPad) griff die Regel nicht, deshalb hat
// kein Waechter (die liefen bis 1440 bzw. nur auf dem Dashboard) es gesehen.
// Prueft bei 1600/1920/2560 px auf allen Seiten (+ Asset-Seite FX und Gold):
//   A) kein Raster mit einer Spalte, in der nichts steht (>= 120 px breit)
//   B) die Karten reichen bis an den rechten Rand des Inhaltsbereichs (<= 60 px)
//   C) alle Seiten im selben Massstab wie das Dashboard (2026-11-10)
// Gegenprobe --gegenprobe: die alte Kompakt-Regel wieder eingespielt -> rot.
const {chromium}=require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935;
const GP=process.argv.includes('--gegenprobe');
const TABS=['dash','cur:USD','cur:GOLD','mx','trends','cot','sent','seas','data','rate','news','carry','pairs','watch','journal','cal','notes'];
const KARTEN='.dw,.dx-card,.cot-card,.rub-card,.tr-card,.ov-card,.pov-card,.aaii-kpi,.edge-verdict,.rterm-card,.wt-card,.ab-tile,.ab-ptile,.ab-ntile,.ab-ktile,.abc-cal,.card';
(async()=>{
  const b=await chromium.launch();
  const F=[];
  for(const [w,h] of [[1600,900],[1920,1080],[2560,1440]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
    await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'networkidle'});
    await p.evaluate(()=>{const l=document.getElementById('lockScreen');if(l)l.remove();document.querySelectorAll('.ov').forEach(o=>o.style.display='none');});
    await wartenBisDatenDa(p);
    await p.evaluate(()=>{document.querySelectorAll('.mov,.mov2').forEach(m=>m.style.display='none');try{['EUR/USD','GBP/USD','USD/JPY'].forEach(n=>toggleWatch(n));}catch(e){}});
    if(GP)await p.addStyleTag({content:'#pageArea>.pc:not(#pgDash),#pageArea>.body{zoom:1!important}'});
    if(GP)await p.addStyleTag({content:'@media(min-width:1500px){body.dense-mode .ab-cards>.ab-orow{grid-template-columns:repeat(4,minmax(0,1fr))}}'});
    for(const t of TABS){
      const [tab,sym]=t.split(':');
      await p.evaluate(([tab,sym])=>{try{if(sym)gotoSym(sym);else showTab(tab);}catch(e){}},[tab,sym]);
      await p.waitForTimeout(tab==='dash'||sym?1500:600);
      const r=await p.evaluate(({t,KARTEN})=>{
        const out=[],pa=document.getElementById('pageArea');if(!pa)return['kein #pageArea'];
        const sichtbar=e=>{if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return false;const q=e.getBoundingClientRect();return q.width>0&&q.height>0;};
        // A) Rasterspalten ohne Inhalt
        pa.querySelectorAll('*').forEach(g=>{
          const cs=getComputedStyle(g);if(cs.display!=='grid'&&cs.display!=='inline-grid')return;if(!sichtbar(g))return;
          const sp=cs.gridTemplateColumns.split(' ').map(parseFloat).filter(x=>x>0);if(sp.length<2)return;
          const G=g.getBoundingClientRect(),gap=parseFloat(cs.columnGap)||0;let x=G.left+parseFloat(cs.paddingLeft||0)+parseFloat(cs.borderLeftWidth||0);
          const spuren=sp.map(wd=>{const s=[x,x+wd];x+=wd+gap;return s;});
          const kinder=[...g.children].filter(c=>{const s=getComputedStyle(c);return s.position!=='absolute'&&s.position!=='fixed'&&sichtbar(c);});
          if(!kinder.length)return;
          // 2026-11-11: die Seite waechst mit (--pg-zoom) - die 120 px gelten im Massstab der Seite,
          // sonst wird eine Ausrichtungsspalte der History-Zeile (117 px, bei 2560 px 193 px) zum Befund.
          const zf=parseFloat(getComputedStyle(pa.querySelector(':scope > *')||pa).zoom)||parseFloat(getComputedStyle(g.closest('#pageArea>*')||pa).zoom)||1;
          const leer=spuren.filter(([a,e])=>e-a>=120*zf&&!kinder.some(c=>{const q=c.getBoundingClientRect();return Math.min(q.right,e)-Math.max(q.left,a)>(e-a)*0.5;}));
          if(leer.length){const n=(g.id?'#'+g.id:'')+(typeof g.className==='string'&&g.className?'.'+g.className.trim().split(/\s+/).slice(0,2).join('.'):g.tagName.toLowerCase());
            out.push(`${t}: Raster ${n} hat ${leer.length} leere Spalte(n) von ${sp.length} (${Math.round(leer[0][1]-leer[0][0])} px breit)`);}
        });
        // B) rechter Rand
        const pcs=getComputedStyle(pa),PR=pa.getBoundingClientRect(),innenR=PR.right-parseFloat(pcs.paddingRight||0);
        const k=[...pa.querySelectorAll(KARTEN)].filter(sichtbar).filter(e=>e.getBoundingClientRect().top<innerHeight);
        if(k.length){const rechts=Math.max(...k.map(e=>e.getBoundingClientRect().right));if(innenR-rechts>60)out.push(`${t}: Karten enden ${Math.round(innenR-rechts)} px vor dem rechten Rand`);}
        return out;
      },{t,KARTEN});
      r.forEach(x=>F.push(w+'x'+h+' '+x));
    }
    // C) 2026-11-10 ("alles gleich vergroessert auch am pc"): jede Seite traegt
    //    denselben Massstab wie das Dashboard (Breite / 1480), Fenster ebenso.
    const z=await p.evaluate(()=>{showTab('dash');const d=parseFloat(getComputedStyle(document.getElementById('dashWidgets')).zoom)||1;
      const o={dash:d,seiten:{}};['mx','cot','cal','journal'].forEach(t=>{showTab(t);const pg=[...document.getElementById('pageArea').children].find(c=>c.offsetParent);o.seiten[t]=parseFloat(getComputedStyle(pg).zoom)||1;});
      gotoSym('USD');const pg=[...document.getElementById('pageArea').children].find(c=>c.offsetParent);o.seiten.cur=parseFloat(getComputedStyle(pg).zoom)||1;return o;});
    if(w>=1900&&z.dash<1.02)F.push(w+'x'+h+' C MASSSTAB: Dashboard waechst nicht ('+z.dash+')');
    Object.entries(z.seiten).forEach(([t,v])=>{if(Math.abs(v-z.dash)>0.02)F.push(w+'x'+h+' C MASSSTAB: '+t+' '+v.toFixed(2)+' statt '+z.dash.toFixed(2)+' (Dashboard)');});
    await p.close();
  }
  await b.close();
  if(GP){const ok=F.some(f=>/C MASSSTAB: cur/.test(f))&&F.some(f=>/cur:USD: Raster \.ab-orow\.ab-prow hat 3 leere/.test(f))&&F.some(f=>/cur:USD: Raster \.ab-orow\.ab-orow3 hat 1 leere/.test(f));
    console.log(ok?'breit --gegenprobe: ok (alte Kompakt-Regel = leere Spalten in Price- und Dreierzeile)':'breit --gegenprobe: FEHLER - nicht gemeldet\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('breit: '+F.length+' Befund(e)\n  '+F.join('\n  '));process.exit(1);}
  console.log('breit: ok ('+TABS.length+' Seiten x 1600/1920/2560 px: keine leeren Rasterspalten, Karten bis an den rechten Rand)');
})();
