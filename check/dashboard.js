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
    // Laender-Umrisse der 1D-Kacheln laden (country_shapes.json, asynchron)
    await p.evaluate(async()=>{try{const m=await import('/js/kachelbild.js');await new Promise(r=>{m.kachelFormenLaden(r);setTimeout(r,5000);});renderDash();}catch(e){}});
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
      // Texte in Kennzahl-Karten und Market-overview-Kacheln bleiben drin (2026-11-07:
      // Handy 390 px - "notifications" 102 px in 77-px-Karte, Kachel-Score und
      // Veraenderung 116-126 px in 105 px, von overflow:hidden still abgeschnitten).
      // Kennzahl-Symbol >= 40 px (Nutzer: "die Logos zu klein, die Karten zu leer").
      document.querySelectorAll('.dx-stat,.dx-mkt').forEach(k=>{const kr=k.getBoundingClientRect();if(!kr.width)return;const cs=getComputedStyle(k),rechts=kr.right-parseFloat(cs.paddingRight)+1,links=kr.left+parseFloat(cs.paddingLeft)-1;
        k.querySelectorAll('.dx-stat-l,.dx-stat-n,.dx-mkt-n,.dx-mkt-p,.dx-mkt-c').forEach(e=>{const rg=document.createRange();rg.selectNodeContents(e);const r=rg.getBoundingClientRect();if(r.width&&(r.right>rechts||r.left<links))out.push(`Text "${e.textContent.trim().slice(0,24)}" ragt ${Math.round(Math.max(r.right-rechts,links-r.left))}px aus ${k.classList.contains('dx-stat')?'Kennzahl-Karte':'Kachel'}`);});
        const ic=k.querySelector('.dx-stat-ic');if(ic&&ic.getBoundingClientRect().width<40)out.push(`Kennzahl-Symbol nur ${Math.round(ic.getBoundingClientRect().width)}px (min 40)`);});
      // Listen-Fenster der Kennzahlen: nie seitlich scrollbar (Inhalt 560 px in 538-px-Fenster)
      ['dashMeldungenFenster','dashPositionenFenster'].forEach(f=>{try{window[f]();const md=document.querySelector('#mCardInfo .modal');
        if(md&&md.scrollWidth>md.clientWidth+1)out.push(f+': Fenster seitlich '+(md.scrollWidth-md.clientWidth)+'px ueberlaufend');closeM('mCardInfo');}catch(e){out.push(f+': '+e.message);}});
      // Market overview: Chart = gewaehltes Intervall (Nutzer 2026-11-06: Linie
      // aenderte sich beim Wechsel nicht - 1D/1W/1M hatten alle 31 Punkte).
      // 1D = Bild statt Linie (seit 2026-11-07), danach je Kachel strikt mehr
      // Punkte je laengerem Fenster.
      if(innerWidth===1440&&typeof dashMktWinSetzen==='function'){
        const pkt=()=>[...document.querySelectorAll('#dbMarket .dx-mkt')].map(t=>{const pf=t.querySelector('.dx-spark path:last-child');return t.querySelector('.dx-kb')?'B':pf?pf.getAttribute('d').split('L').length:0;});
        const W={};['1D','1W','1M','3M','1Y'].forEach(w=>{dashMktWinSetzen(w);W[w]=pkt();});
        if(W['1D'].some(x=>x!=='B'))out.push('Market overview 1D: nicht ueberall ein Bild ('+W['1D'].join(',')+')');
        // 1D-Bild = Laender-Umriss (Nutzer-Wahl 2026-11-08 "Outline"): Paar = 2
        // Umrisse (Basis, Quote), Index = 1, Gold/Silber = Symbol; sichtbar, in
        // der Kachel; kein Auswahl-Schalter mehr.
        dashMktWinSetzen('1D');
        if(document.querySelector('#dbMarket .dx-kb-wahl'))out.push('1D-Bild: Auswahl-Schalter noch da (Wahl getroffen: Outline)');
        document.querySelectorAll('#dbMarket .dx-mkt').forEach(t=>{
          const n=(t.querySelector('.dx-mkt-n')||t).textContent.trim(),paar=/^[A-Z]{3}\/[A-Z]{3}/.test(n),land=paar||/S&P|Nasdaq|DAX/.test(n);
          const b=[...t.querySelectorAll('.dx-kb-u')],soll=paar?2:land?1:0;
          if(!soll){if(!t.querySelector('.dx-kb-ic svg,.dx-kb-ic img,.dx-kb-ic .aicon'))out.push(`1D-Bild: ${n} ohne Symbol`);return;}
          if(b.length!==soll)out.push(`1D-Bild: ${n} zeigt ${b.length} statt ${soll} Umriss(e)`);
          const tr=t.getBoundingClientRect();
          b.forEach(e=>{const r=e.getBoundingClientRect();if(r.width<20||r.height<20)out.push(`1D-Bild: ${n} nur ${Math.round(r.width)}x${Math.round(r.height)} px`);
            if(r.left<tr.left-1||r.right>tr.right+1||r.bottom>tr.bottom+1)out.push(`1D-Bild: ${n} ragt aus der Kachel`);
            const pa=e.querySelector('path');if(!(pa&&pa.getAttribute('d')))out.push(`1D-Bild: ${n} ohne Umriss`);});
        });
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
      // Von der Watchlist entfernen (Nutzer 2026-11-07): Watchlist-Kachel hat ein x,
      // es liegt oben, entfernt den Eintrag und oeffnet NICHT die Kachel.
      if(innerWidth===1440&&typeof watchEntfernen==='function'){
        if(!isWatched('GBP/CAD'))toggleWatch('GBP/CAD');
        const t=[...document.querySelectorAll('#dbMarket .dx-mkt')].find(e=>e.querySelector('.dx-mkt-weg')&&/GBP\/CAD/.test(e.textContent));
        if(!t)out.push('Watchlist-Kachel GBP/CAD ohne Entfernen-Knopf');
        else{const x=t.querySelector('.dx-mkt-weg'),r=x.getBoundingClientRect();x.scrollIntoView({block:'center'});const r2=x.getBoundingClientRect(),o=document.elementFromPoint(r2.left+r2.width/2,r2.top+r2.height/2);
          if(!o||!o.closest('.dx-mkt-weg'))out.push('Entfernen-Knopf verdeckt von '+(o?o.tagName.toLowerCase():'nichts'));
          if(r.width<27||r.height<27)out.push('Entfernen-Knopf nur '+Math.round(r.width)+'x'+Math.round(r.height)+' px (min 28)');
          x.click();
          if(isWatched('GBP/CAD'))out.push('x auf der Watchlist-Kachel entfernt GBP/CAD nicht');
          if(curPage!=='dash')out.push('x oeffnet die Kachel ('+curPage+') statt nur zu entfernen');
          if(curPage!=='dash')showTab('dash');}
        const std=[...document.querySelectorAll('#dbMarket .dx-mkt')].filter(e=>!e.classList.contains('dx-mkt-wl')&&e.querySelector('.dx-mkt-weg'));
        if(std.length)out.push(std.length+' Standard-Kachel(n) mit Entfernen-Knopf (stehen nicht auf der Watchlist)');
      }
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
