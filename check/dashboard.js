const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
const URL=process.env.CHECK_URL||'http://127.0.0.1:8935/index.html';
// Waechter gegen ueberlappende Dashboard-Karten. Hintergrund: equalizeDash-
// Columns() setzt den Spalten eine gemeinsame Hoehe. Kann der Inhalt sie nicht
// einhalten, laeuft er in die untere Kartenreihe (Nutzer-Bugreport 2026-08-16).
// Exit 1 bei Kollision -> gehoert vor jeden Push.
const {chromium}=require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935;
const GEGENPROBE=process.argv.includes('--gegenprobe');
(async()=>{
  const b=await chromium.launch(); let fehler=[];
  for(const [w,h] of [[1920,1080],[1600,900],[1440,900],[1280,800],[1180,820],[1100,800],[900,900],[390,844]]){
    const p=await b.newPage({viewport:{width:w,height:h}});
    await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
    await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'networkidle'});
    await p.evaluate(()=>{['lockScreen'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});});
    await wartenBisDatenDa(p);
    await p.evaluate(()=>{document.querySelectorAll('.mov,.mov2').forEach(m=>m.style.display='none');showTab('dash');});
    await p.waitForTimeout(800);
    if(GEGENPROBE)await p.addStyleTag({content:'#dashWidgets .dw-t-txt{display:inline-block!important;width:7px!important;white-space:nowrap!important;overflow:visible!important}'});
    if(GEGENPROBE)await p.evaluate(()=>{const v=document.querySelector('#dashWidgets .db-bias-v');if(v)v.textContent='+99';});
    const r=await p.evaluate(()=>{
      const out=[];
      const alle=[...document.querySelectorAll('#dashWidgets .dw')].filter(c=>c.getBoundingClientRect().height>0);
      // Paarweise echte Ueberlappung zweier Karten
      for(let i=0;i<alle.length;i++)for(let j=i+1;j<alle.length;j++){
        const a=alle[i].getBoundingClientRect(),c=alle[j].getBoundingClientRect();
        const ov=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
        const oh=Math.min(a.right,c.right)-Math.max(a.left,c.left);
        if(ov>2&&oh>2){
          const nm=e=>(e.className.match(/dw-([a-z_0-9]+)/)||[])[1]||'?';
          out.push(nm(alle[i])+' ueberlappt '+nm(alle[j])+' um '+Math.round(ov)+'x'+Math.round(oh)+'px');
        }
      }
      // Inhalt, der aus seiner Zone laeuft
      ['left','center','right','right2'].forEach(z=>{
        const el=document.querySelector('.dash-zone-'+z);if(!el)return;
        const ue=el.scrollHeight-el.clientHeight;
        if(ue>2)out.push('Zone '+z+' laeuft um '+Math.round(ue)+'px ueber');
      });
      // ── Ueberlappender TEXT INNERHALB einer Karte ──────────────────────
      // Nutzer-Grundsatz: Elemente duerfen sich nie so ueberlappen, dass
      // etwas unlesbar wird. Die Pruefung oben sieht nur Karten gegeneinander.
      // Gefunden hat das den Fall .hl-side: der Kasten stand auf 88px, sein
      // Inhalt (Quelle UND Zeit nebeneinander) wurde 114px breit und ragte
      // bei align-items:flex-end nach LINKS ueber den Titel - 8px, auf jeder
      // Bildschirmbreite, monatelang unbemerkt.
      const sichtbar=e=>{
        const r=e.getBoundingClientRect();
        if(!(r.width>0&&r.height>0))return null;
        let n=e;
        while(n&&n!==document.body){
          const cs=getComputedStyle(n);
          if(cs.opacity==='0'||cs.visibility==='hidden'||cs.display==='none')return null;
          n=n.parentElement;
        }
        // ⚠ Durch einen scrollenden Vorfahren GECLIPPTE Teile sind nicht
        // sichtbar - ohne das meldet der Test jede Zeile, die unter dem
        // Fussbereich einer scrollbaren Liste weiterlaeuft.
        let a=e.parentElement;
        while(a&&a!==document.body){
          const cs=getComputedStyle(a);
          if(/auto|scroll|hidden/.test(cs.overflowY+cs.overflow)){
            const ar=a.getBoundingClientRect();
            if(r.bottom>ar.bottom-1||r.top<ar.top+1)return null;
          }
          a=a.parentElement;
        }
        return r;
      };
      document.querySelectorAll('#dashWidgets .dw').forEach(k=>{
        const txt=[];
        k.querySelectorAll('*').forEach(e=>{
          if(e.children.length)return;
          if(!(e.textContent||'').trim())return;
          if(e.closest('.lg-frei'))return;   // Logo im Freiraum: F und X ueberlappen gewollt (Schriftzug)
          const r=sichtbar(e);
          if(r)txt.push({e,r});
        });
        for(let i=0;i<txt.length;i++)for(let j=i+1;j<txt.length;j++){
          const a=txt[i].r,c=txt[j].r;
          const ux=Math.min(a.right,c.right)-Math.max(a.left,c.left);
          const uy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
          if(ux>2&&uy>2){
            const nm=(k.className.match(/dw-([a-z_0-9]+)/)||[])[1]||'?';
            out.push('Text in '+nm+': "'+txt[i].e.textContent.trim().slice(0,20)+
              '" ueberlappt "'+txt[j].e.textContent.trim().slice(0,20)+'" um '+Math.round(ux)+'px');
          }
        }
      });
      // ── Text, der SICHTBAR ueber sein eigenes Element hinauslaeuft ────
      // Der Rechteck-Vergleich oben findet das NICHT: das Element bleibt
      // klein, nur der Text ragt heraus. So war .wl-name auf 7px gequetscht,
      // waehrend "CAD/CHF" quer ueber die Prozentspalte lief - im Screenshot
      // sofort sichtbar, in jeder Kollisionsmessung unsichtbar.
      // Gemessen wird die TEXTBREITE selbst (Range-Rechtecke), nicht
      // scrollWidth: seit 2026-10-04 (Design-Audit D7) tragen kleine Knoepfe
      // (ⓘ, Glocke, Chips) eine unsichtbare ::after-Trefferflaeche, die in
      // scrollWidth mitzaehlt - mit scrollWidth meldete der Waechter jedes ⓘ
      // als "laeuft 8px ueber", obwohl kein Buchstabe uebersteht. Gegenprobe:
      // node check/dashboard.js --gegenprobe (Widget-Titel auf 7 px gequetscht).
      document.querySelectorAll('#dashWidgets .dw *').forEach(e=>{
        if(e.children.length)return;
        const t=(e.textContent||'').trim();if(!t)return;
        const cs=getComputedStyle(e);
        if(cs.overflow!=='visible'||cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;
        const rg=document.createRange();rg.selectNodeContents(e);
        const tr=[...rg.getClientRects()].filter(q=>q.width>0);if(!tr.length||!e.clientWidth)return;
        const er=e.getBoundingClientRect(),li=er.left+(parseFloat(cs.borderLeftWidth)||0),re=er.right-(parseFloat(cs.borderRightWidth)||0);
        const ue=Math.round(Math.max(0,...tr.map(q=>q.right-re),...tr.map(q=>li-q.left)));
        if(ue>2)
          out.push('"'+t.slice(0,18)+'" laeuft '+ue+'px ueber sein Element (nur '+e.clientWidth+'px breit)');
      });
      // ── Neuaufbau 2026-11-05: Sektionen + Bias-Kacheln ────────────────
      // Alle sieben Sektionen muessen da sein; jede Bias-Kachel zeigt exakt
      // symScoreCmp() ihres Assets (dieselbe Zahl wie Asset-Seite/Score-
      // Fenster), jedes Asset genau einmal, je Gruppe absteigend sortiert,
      // und der volle Name steht da (Regel "Namen nie gekuerzt").
      // Kopfreihe kompakt (Nutzer-iPad-Foto 2026-11-06: Statuszeile brach auf 3
      // Zeilen, Hero/Kacheln 190 px, Zahl 108 px unter dem Symbol)
      if(innerWidth>=1160){const h=document.getElementById('dbHero'),m=document.querySelector('.dx-hero-meta');
        if(h&&h.getBoundingClientRect().height>170)out.push('Hero '+Math.round(h.getBoundingClientRect().height)+'px hoch (max 170)');
        if(m&&m.getBoundingClientRect().height>30)out.push('Hero-Statuszeile bricht um ('+Math.round(m.getBoundingClientRect().height)+'px)');}
      // Listen-Fenster der Kennzahlen: nie seitlich scrollbar (Inhalt 560 px in 538-px-Fenster)
      ['dashMeldungenFenster','dashPositionenFenster'].forEach(f=>{try{window[f]();const md=document.querySelector('#mCardInfo .modal');
        if(md&&md.scrollWidth>md.clientWidth+1)out.push(f+': Fenster seitlich '+(md.scrollWidth-md.clientWidth)+'px ueberlaufend');closeM('mCardInfo');}catch(e){out.push(f+': '+e.message);}});
      // Market overview: Chart = gewaehltes Intervall (Nutzer 2026-11-06: Linie
      // aenderte sich beim Wechsel nicht - 1D/1W/1M hatten alle 31 Punkte).
      // 1D = Tageskerze, danach je Kachel strikt mehr Punkte je laengerem Fenster.
      if(innerWidth===1440&&typeof dashMktWinSetzen==='function'){
        const pkt=()=>[...document.querySelectorAll('#dbMarket .dx-mkt')].map(t=>{const pf=t.querySelector('.dx-spark path:last-child');return t.querySelector('.dx-kz')?'K':pf?pf.getAttribute('d').split('L').length:0;});
        const W={};['1D','1W','1M','3M','1Y'].forEach(w=>{dashMktWinSetzen(w);W[w]=pkt();});
        if(W['1D'].some(x=>x!=='K'))out.push('Market overview 1D: nicht ueberall Tageskerze ('+W['1D'].join(',')+')');
        W['1W'].forEach((_,i)=>{const r=['1W','1M','3M','1Y'].map(w=>W[w][i]);if(!(r[0]<r[1]&&r[1]<r[2]&&r[2]<r[3]))out.push('Market overview Kachel '+(i+1)+': Punkte je Intervall '+r.join('/')+' - Linie folgt dem Intervall nicht');});
        dashMktWinSetzen('1D');
      }
      // Kugel-Marker antippbar (2026-11-06): die Marker liegen auf einer Canvas-
      // Ebene; getroffen wird ueber die Projektion. An der Marker-Stelle muss
      // die Kugel selbst oben liegen (kein anderes Element darueber).
      {const sc=document.getElementById('pgDash'),sy=sc?sc.scrollTop:0,gk=document.getElementById('dbGlobe');if(gk)gk.scrollIntoView({block:'center'});   // Kugel ins Bild, sonst liefert elementFromPoint nichts
       const pos=(window.__globeMarkerPositionen&&window.__globeMarkerPositionen())||[];
       if(innerWidth>=760&&!pos.length)out.push('Kugel: keine sichtbaren Marker');
       pos.filter(m=>m.y>0&&m.y<innerHeight).slice(0,2).forEach(m=>{const t=document.elementFromPoint(m.x,m.y);if(!t||!t.closest('#dashGlobeHost'))out.push('Kugel-Marker '+m.id+' verdeckt von '+(t?t.tagName.toLowerCase()+'.'+(t.getAttribute('class')||''):'nichts'));});
       if(sc)sc.scrollTop=sy;}
      ['dbHero','dbMarket','dbGlobe','dbTrades','dbHeute','dbSent','dbInsight','dbBias','dbMover','dbPerf'].forEach(id=>{if(!document.getElementById(id))out.push('Sektion #'+id+' fehlt');});
      const tiles=[...document.querySelectorAll('#dashWidgets .db-bias')];
      const ids=tiles.map(t=>t.dataset.id);
      if(typeof syms!=='undefined'){
        syms.forEach(s=>{const n=ids.filter(x=>x===s.id).length;if(n!==1)out.push('Bias: '+s.id+' '+n+'x statt 1x');});
        tiles.forEach(t=>{const s=syms.find(x=>x.id===t.dataset.id);if(!s)return;
          const v=+t.querySelector('.db-bias-v').textContent.replace('+','');
          if(v!==symScoreCmp(s))out.push('Bias: '+s.id+' zeigt '+v+' statt '+symScoreCmp(s));
          const nm=t.querySelector('.db-bias-n').textContent.trim();if(nm!==s.name)out.push('Bias: Name "'+nm+'" statt "'+s.name+'"');});
        document.querySelectorAll('#dashWidgets .db-bias-grid').forEach(g=>{const v=[...g.querySelectorAll('.db-bias-v')].map(e=>+e.textContent.replace('+',''));
          for(let i=1;i<v.length;i++)if(v[i]>v[i-1]){out.push('Bias: Gruppe nicht absteigend sortiert');break;}});
      }
      return out;
    });
    if(r.length)fehler.push(w+'x'+h+': '+r.join(' | '));
    await p.close();
  }
  await b.close();
  if(GEGENPROBE){const ok=fehler.some(f=>/laeuft \d+px ueber sein Element/.test(f))&&fehler.some(f=>/Bias: \w+ zeigt 99/.test(f));console.log(ok?'dashboard --gegenprobe: ok (gequetschter Titel = Textueberlauf, verfaelschte Bias-Kachel = Abweichung)':'dashboard --gegenprobe: FEHLER - nicht gemeldet');process.exit(ok?0:1);}
  if(fehler.length){console.log('DASHBOARD-KOLLISIONEN:\n  '+fehler.join('\n  '));process.exit(1);}
  console.log('Dashboard ok: keine ueberlappenden Sektionen/Texte, 10 Sektionen, Bias-Kacheln = symScoreCmp, volle Namen (8 Breiten)');
})();
