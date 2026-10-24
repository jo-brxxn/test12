'use strict';
// ══ TRADING JOURNAL ════════════════════════════════════════════════════
// Nutzer-Wunsch 2026-10-24: "ein neues Fenster ... das Journal heisst. Man
// soll da in einer schoenen grossen Kalender Uebersicht trades eintragen
// koennen die man genommen hat. Es soll angezeigt werden welches Asset
// welche Richtung und wie viel Profit. Wenn man draufklickt kommen alle
// anderen wichtigen Daten. Je nach win oder loss auch dann in bias Farbe."
//
// Umbau am selben Tag ("Ich will ein deutlich hochwertigeres Design"), per
// Rueckfrage festgelegt: TradeZella-Stil - Kennzahl-Kacheln (Net P/L, Win
// rate als Halbkreis, Profit factor, Avg win : loss, Win-Streak-Flamme),
// Equity-Kurve des Monats, Kalender mit grosser Tagessumme + Trade-Zeilen,
// Wochensumme rechts, Wochenende schmal. Detail-Fenster mit Kopf, Kacheln,
// Preisleiste SL-Entry-Exit-TP und Kurs-Chart. Im Editor ein Kurs-Chart mit
// Positions-Werkzeug wie auf TradingView ("dann kann ich da stoploss und
// takeprofit rausziehen"), Hit TP / Hit SL fuer den Exit, Live-R:R.
//
// ⚠ NICHT verwechseln mit dem Score-Journal (js/journal.js, Schluessel
// fxpro_scorejournal) - das protokolliert Score-Aenderungen, dieses Modul
// eigene Trades. Eigener Schluessel, eigenes Sync-Feld (tradeJournal).
//
// SYNC (CLAUDE.md Regel 1, Muster docs/state-sync.md): liegt ausserhalb von
// snap() (Undo soll keinen Trade zuruecknehmen) und waechst auf mehreren
// Geraeten UNABHAENGIG - deshalb Merge statt Overwrite, wie bei scoreHist:
// Vereinigung nach id, bei Kollision gewinnt der zuletzt bearbeitete (up).
// Geloeschte Trades bleiben als Grabstein (del:true) stehen, sonst brachte
// der naechste Merge sie vom anderen Geraet zurueck.
//
// NIE GESCHAETZT (CLAUDE.md Regel 4): P/L traegt der Nutzer selbst ein. Das
// R-Vielfache entsteht nur aus Entry + Stop + Exit. Der Kurs-Chart zeigt nur
// echte Tageskerzen; ohne Reihe steht dort eine Meldung statt eines Charts.
// Einzige Vorgabe des Werkzeugs: beim ersten Tipp liegen SL/TP 1 bzw. 2
// ATR14 (aus echten Hoch/Tief) neben dem Entry - sichtbar in den Feldern,
// zum Verschieben gedacht, kein Wert, der still im Hintergrund entsteht.
import {escH,escJH,openM,closeM,uid,cloudAutoSync,markLsUpdatedSeen,markPrefEdit,curPage,syms,pairs,
  icn,achsenTicks,chartHoverWrap,attachChartHovers,tagesKerzen,ladeLogoHtml} from './main.js';
import {PRICE_DATA_FEED,priceSeriesFor,pairPriceSeries,autoFetchPriceData} from './data-feeds.js';
import {fmtDayHdr,fmtDayShort} from './calendar.js';
import {FX,BC} from './constants.js';

const TRADES_KEY='fxpro_trades';
let trades=(()=>{try{const v=JSON.parse(localStorage.getItem(TRADES_KEY)||'[]');return Array.isArray(v)?v.filter(tjGueltig):[];}catch(e){return[];}})();
// Angezeigter Monat 'YYYY-MM' - bewusst NICHT synchronisiert (Ansichtswahl
// wie abCalSicht): die Seite startet immer im aktuellen Monat.
let tjMonat=null;
let _tjEdit=null;     // id des Trades im Editor, null = neuer Trade
let _tjView=null;     // id des Trades im Detail-Fenster
let _tjTag=null;      // Datum im Tages-Fenster

function tjGueltig(t){return t&&typeof t==='object'&&typeof t.id==='string'&&t.id;}
function tjAktiv(){return trades.filter(t=>!t.del);}

// ── Merge (zwei Geraete, disjunkte Eintraege) ─────────────────────────
function mergeTrades(base,override){
  const m=new Map();
  (Array.isArray(base)?base:[]).filter(tjGueltig).forEach(t=>m.set(t.id,t));
  (Array.isArray(override)?override:[]).filter(tjGueltig).forEach(t=>{
    const a=m.get(t.id);
    if(!a||String(t.up||'')>=String(a.up||''))m.set(t.id,t);
  });
  return[...m.values()];
}
// Cloud-Pull und Import: nie ueberschreiben, immer vereinigen.
function tjUebernehmen(remote){
  if(!Array.isArray(remote))return;
  const vorher=JSON.stringify(trades);
  trades=mergeTrades(trades,remote);
  if(JSON.stringify(trades)===vorher)return;
  try{localStorage.setItem(TRADES_KEY,JSON.stringify(trades));}catch(e){}
  if(curPage==='journal')renderJournal();
}
function tjSpeichern(){
  try{
    localStorage.setItem(TRADES_KEY,JSON.stringify(trades));
    localStorage.setItem('fxpro_updated',new Date().toISOString());
    markLsUpdatedSeen();markPrefEdit();cloudAutoSync();
    return true;
  }catch(e){alert('The trade could not be saved: '+(e&&e.message||e));return false;}
}

// ── Formate ───────────────────────────────────────────────────────────
const TJ_MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const TJ_WT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const TJ_WT2=['Mo','Tu','We','Th','Fr','Sa','Su'];   // Handy-Kopf (Spalten 23-40 px)
function tjPad(n){return String(n).padStart(2,'0');}
function tjHeute(){const d=new Date();return`${d.getFullYear()}-${tjPad(d.getMonth()+1)}-${tjPad(d.getDate())}`;}
// Monat mit Jahr zweistellig (Datumsregel docs/design-system.md).
function tjMonTitel(y,m){return`${TJ_MON[m-1]} '${String(y).slice(2)}`;}
function tjNum(v){if(v===''||v==null)return null;const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:null;}
function tjGeld(n){
  if(n==null||!isFinite(n))return'–';
  const s=Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return(n>0?'+':n<0?'−':'')+s;
}
// Kompakt fuer schmale Zellen (Handy, Wochenende): +1.3k / −310. Die volle
// Zahl steht in der Tabelle und im Detail-Fenster.
function tjKurz(n){
  if(n==null||!isFinite(n))return'–';
  const a=Math.abs(n),v=a>=1000?(a/1000).toFixed(a>=10000?0:1)+'k':String(Math.round(a));
  return(n>0?'+':n<0?'−':'')+v;
}
function tjKlasse(t){return t.pnl>0?'win':t.pnl<0?'loss':'be';}
function tjErgebnis(t){return t.pnl>0?'Win':t.pnl<0?'Loss':'Break-even';}
function tjFarbe(n){return n>0?'var(--bias-bull)':n<0?'var(--bias-bear)':'var(--bias-neu)';}
function tjSeite(dir){return dir==='short'?'Short':'Long';}
function tjSeiteHtml(dir){return`<span class="tj-side ${dir==='short'?'short':'long'}">${tjSeite(dir)}</span>`;}
// Preis-Genauigkeit nach Groessenordnung: FX 5, JPY/Silber 3, Indizes/Gold 2.
function tjDez(v){const a=Math.abs(v);return a>=1000?2:a>=20?3:5;}
function tjPreis(v){return v==null||!isFinite(v)?'–':(+v).toFixed(tjDez(v));}
// R-Vielfaches nur aus echten Eingaben (Entry, Stop, Exit) - sonst null.
function tjR(t){
  const e=tjNum(t.entry),s=tjNum(t.sl),x=tjNum(t.exit);
  if(e==null||s==null||x==null||e===s)return null;
  const risiko=t.dir==='short'?s-e:e-s;
  if(!(risiko>0))return null;
  return(t.dir==='short'?e-x:x-e)/risiko;
}
// Geplantes Chance-Risiko aus Entry/Stop/Ziel.
function tjRRPlan(t){
  const e=tjNum(t.entry),s=tjNum(t.sl),p=tjNum(t.tp);
  if(e==null||s==null||p==null)return null;
  const ri=t.dir==='short'?s-e:e-s,re=t.dir==='short'?e-p:p-e;
  return ri>0&&re>0?re/ri:null;
}
function tjRText(r){return r==null?'–':`${r>0?'+':r<0?'−':''}${Math.abs(r).toFixed(2)}R`;}

// ── Kennzahlen ───────────────────────────────────────────────────────
function tjChrono(list){
  return list.slice().sort((a,b)=>(String(a.d)+(a.t||'')).localeCompare(String(b.d)+(b.t||''))||String(a.up||'').localeCompare(String(b.up||'')));
}
function tjStats(list){
  const w=list.filter(t=>t.pnl>0),l=list.filter(t=>t.pnl<0);
  const gw=w.reduce((s,t)=>s+t.pnl,0),gl=-l.reduce((s,t)=>s+t.pnl,0);
  return{n:list.length,wins:w.length,losses:l.length,be:list.length-w.length-l.length,net:gw-gl,gw,gl,
    quote:w.length+l.length?w.length/(w.length+l.length):null,
    pf:gl>0?gw/gl:null,avgW:w.length?gw/w.length:null,avgL:l.length?gl/l.length:null};
}
// Serie ueber ALLE Trades in zeitlicher Reihenfolge. Break-even bricht sie
// nicht ab (kein Verlust), zaehlt aber auch nicht mit.
function tjStreak(){
  let cur=0,best=0;
  tjChrono(tjAktiv()).forEach(t=>{if(t.pnl>0){cur++;if(cur>best)best=cur;}else if(t.pnl<0)cur=0;});
  return{cur,best};
}

// ── Kurse zum Asset ──────────────────────────────────────────────────
// Freitext -> Feed-Reihe. Nur echte Reihen aus price_data.json; was nicht
// zuzuordnen ist, bekommt keinen Chart (Meldung statt Schaetzung).
const TJ_ALIAS={XAU:'GOLD',XAUUSD:'GOLD',GOLD:'GOLD',XAG:'SILVER',XAGUSD:'SILVER',SILVER:'SILVER',
  BTC:'BTC',BTCUSD:'BTC',BITCOIN:'BTC',NAS:'NAS',NAS100:'NAS',NASDAQ:'NAS',US100:'NAS',NDX:'NAS',
  SP500:'SP500',US500:'SP500',SPX:'SP500',SPX500:'SP500','S&P500':'SP500',
  DAX:'DAX',GER40:'DAX',DE40:'DAX',GER30:'DAX',DAX40:'DAX',OIL:'OIL',USOIL:'OIL',WTI:'OIL',XTIUSD:'OIL'};
// USD/xxx aus der xxx-Reihe: Kehrwert, Hoch und Tief tauschen die Rolle
// (Kerzen-Regel 4, docs/design-system.md).
function tjKehr(e){
  if(!e||!e[1])return null;
  const c=1/e[1],o=Number(e[2]),h=Number(e[3]),l=Number(e[4]);
  if(isFinite(o)&&isFinite(h)&&isFinite(l)&&o&&h&&l)return[e[0],c,1/o,1/l,1/h];
  return[e[0],c];
}
function tjReihe(asset){
  const roh=String(asset||'').toUpperCase().replace(/\s+/g,'');
  if(!roh)return null;
  const ali=TJ_ALIAS[roh.replace('/','')];
  if(ali){const s=priceSeriesFor(ali);return s?{s,id:ali}:null;}
  const m=/^([A-Z]{3})\/?([A-Z]{3})$/.exec(roh);
  if(m&&FX.includes(m[1])&&FX.includes(m[2])&&m[1]!==m[2]){
    const b=m[1],q=m[2];
    if(q==='USD'){const s=priceSeriesFor(b);return s?{s,id:b}:null;}
    if(b==='USD'){const s=priceSeriesFor(q);return s?{s:s.map(tjKehr).filter(Boolean),id:q}:null;}
    const s=pairPriceSeries(b,q);return s?{s,id:b}:null;
  }
  const s=priceSeriesFor(roh);return s?{s,id:roh}:null;
}
let _tjLaedt=false;
function tjPreiseLaden(){if(_tjLaedt)return;_tjLaedt=true;try{autoFetchPriceData();}catch(e){}}

// ── Seite ─────────────────────────────────────────────────────────────
function tjMonatSetzen(delta){
  const[y,m]=(tjMonat||tjHeute().slice(0,7)).split('-').map(Number);
  const d=new Date(y,m-1+delta,1);
  tjMonat=`${d.getFullYear()}-${tjPad(d.getMonth()+1)}`;
  renderJournal();
}
function tjMonatHeute(){tjMonat=tjHeute().slice(0,7);renderJournal();}

function tjGaugeSvg(st){
  const r=46,cx=60,cy=56,L=Math.PI*r,bogen=`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`;
  const q=st.quote;
  const grund=q==null?'rgba(var(--t3-rgb),.2)':st.losses?'var(--bias-bear)':'rgba(var(--t3-rgb),.2)';
  return`<svg class="tj-gauge" width="120" height="64" viewBox="0 0 120 64" aria-hidden="true">
    <path d="${bogen}" fill="none" stroke="${grund}" stroke-width="10" stroke-linecap="round"/>
    ${q?`<path d="${bogen}" fill="none" stroke="var(--bias-bull)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(q*L).toFixed(1)} ${(L+20).toFixed(1)}"/>`:''}
    <text x="60" y="54" text-anchor="middle" class="tj-gauge-t">${q==null?'–':Math.round(q*100)+'%'}</text>
  </svg>`;
}
function tjSplit(a,b){
  const s=(a||0)+(b||0);
  if(!(s>0))return'<div class="tj-split leer"></div>';
  return`<div class="tj-split"><span class="w" style="width:${(a/s*100).toFixed(1)}%"></span><span class="l" style="width:${(b/s*100).toFixed(1)}%"></span></div>`;
}
function tjKachel(lbl,inhalt,sub,cls){
  return`<div class="tj-kachel${cls?' '+cls:''}"><div class="tj-kl">${lbl}</div><div class="tj-ki">${inhalt}</div>${sub?`<div class="tj-ksub">${sub}</div>`:''}</div>`;
}
function tjKachelnHtml(st,sk,y,m){
  const b=v=>`<b style="color:var(--bias-bull)">${v}</b>`,r=v=>`<b style="color:var(--bias-bear)">${v}</b>`;
  const net=tjKachel('Net P/L',`<div class="tj-kv tj-kv-xl" style="color:${tjFarbe(st.net)}">${st.n?tjGeld(st.net):'–'}</div>`,
    `<b>${st.n}</b> trade${st.n===1?'':'s'} · <i>${tjMonTitel(y,m)}</i>`,'net');
  const quote=tjKachel('Win rate',tjGaugeSvg(st),
    st.n?`${b(st.wins)} W · ${r(st.losses)} L${st.be?` · <b>${st.be}</b> BE`:''}`:'<i>No trades yet</i>','quote');
  const pfWert=st.pf!=null?st.pf.toFixed(2):st.gw>0?'No losses':'–';
  const pf=tjKachel('Profit factor',`<div class="tj-kv" style="color:${st.pf==null?(st.gw>0?'var(--bias-bull)':'var(--t3)'):st.pf>=1?'var(--bias-bull)':'var(--bias-bear)'}">${pfWert}</div>${tjSplit(st.gw,st.gl)}`,
    st.n?`${b(tjGeld(st.gw))} won · ${r(tjGeld(-st.gl))} lost`:'<i>Won ÷ lost</i>');
  const ratio=st.avgW!=null&&st.avgL!=null?st.avgW/st.avgL:null;
  const avg=tjKachel('Avg win : loss',`<div class="tj-kv" style="color:${ratio==null?'var(--t3)':ratio>=1?'var(--bias-bull)':'var(--bias-bear)'}">${ratio==null?'–':ratio.toFixed(2)}</div>${tjSplit(st.avgW,st.avgL)}`,
    `${st.avgW!=null?b(tjGeld(st.avgW)):'<b>–</b>'} | ${st.avgL!=null?r(tjGeld(-st.avgL)):'<b>–</b>'}`);
  const streak=tjKachel('Win streak',`<div class="tj-flamme${sk.cur?' an':''}" title="${sk.cur?sk.cur+' winning trade'+(sk.cur===1?'':'s')+' in a row':'No winning streak right now'}">${icn('flame',30)}<b class="tj-kv">${sk.cur}</b></div>`,
    `Best <b>${sk.best}</b> · <i>all trades</i>`,'streak');
  return`<div class="tj-kacheln">${net}${quote}${pf}${avg}${streak}</div>`;
}

// Equity-Kurve: aufsummierter P/L je Handelstag des Monats. In echter
// Groesse gebaut (Breite vorher gemessen, Regel C), Y-Achse links.
function tjEquityHtml(list,y,m,W){
  const H=W<520?176:214,pl=56,pr=16,pt=12,pb=26,pw=W-pl-pr,ph=H-pt-pb;
  const tage=new Date(y,m,0).getDate();
  const proTag={};list.forEach(t=>{proTag[t.d]=(proTag[t.d]||0)+(t.pnl||0);});
  let kum=0;const pk=[{tag:0,v:0,d:null}];
  Object.keys(proTag).sort().forEach(ds=>{kum+=proTag[ds];pk.push({tag:+ds.slice(8),v:kum,d:ds,dv:proTag[ds]});});
  let lo=Math.min(0,...pk.map(p=>p.v)),hi=Math.max(0,...pk.map(p=>p.v));
  if(lo===hi){hi+=1;lo-=1;}
  const ticks=achsenTicks(lo,hi,4);lo=Math.min(lo,ticks[0]);hi=Math.max(hi,ticks[ticks.length-1]);
  const X=tag=>pl+(tag/tage)*pw,Y=v=>pt+(1-(v-lo)/(hi-lo))*ph,y0=Y(0);
  const id='tjEq'+(++_tjSvgSeq);
  let s=`<svg class="tj-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity curve">`;
  s+=`<defs><clipPath id="${id}o"><rect x="${pl}" y="${pt}" width="${pw}" height="${Math.max(0,y0-pt).toFixed(1)}"/></clipPath><clipPath id="${id}u"><rect x="${pl}" y="${y0.toFixed(1)}" width="${pw}" height="${Math.max(0,pt+ph-y0).toFixed(1)}"/></clipPath></defs>`;
  ticks.forEach(t=>{const yy=Y(t).toFixed(1);
    s+=`<line x1="${pl}" x2="${pl+pw}" y1="${yy}" y2="${yy}" class="${t===0?'tj-null':'tj-gitter'}"/><text x="${pl-8}" y="${(+yy+4).toFixed(1)}" text-anchor="end" class="y-lbl">${tjKurz(t).replace('+','')}</text>`;});
  const mm=tjPad(m);let letzte=-1e9;
  [1,8,15,22,tage].forEach(tg=>{const x=X(tg);if(x-letzte<70&&tg!==tage)return;if(tg===tage&&x-letzte<70)return;letzte=x;
    s+=`<text x="${x.toFixed(1)}" y="${H-7}" text-anchor="${tg===tage?'end':'middle'}" class="x-lbl">${escH(fmtDayShort(`${y}-${mm}-${tjPad(tg)}`))}</text>`;});
  const P=pk.map(p=>[X(p.tag),Y(p.v)]);
  const linie=P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const flaeche=`${linie} L ${P[P.length-1][0].toFixed(1)} ${y0.toFixed(1)} L ${P[0][0].toFixed(1)} ${y0.toFixed(1)} Z`;
  s+=`<path d="${flaeche}" class="tj-fl-o" clip-path="url(#${id}o)"/><path d="${flaeche}" class="tj-fl-u" clip-path="url(#${id}u)"/>`;
  s+=`<path d="${linie}" class="tj-li-o" clip-path="url(#${id}o)"/><path d="${linie}" class="tj-li-u" clip-path="url(#${id}u)"/>`;
  const pts=[];
  pk.forEach((p,i)=>{if(!p.d)return;const[x,yy]=P[i];
    s+=`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="3" class="${p.v>=0?'tj-pk-o':'tj-pk-u'}"/>`;
    pts.push({fx:x/W,fy:yy/H,t:p.d,col:p.v>=0?BC.bull:BC.bear,
      tip:`<b>${escH(fmtDayHdr(p.d))}</b><br>Day <b style="color:${tjFarbe(p.dv)}">${tjGeld(p.dv)}</b> · Total <b style="color:${tjFarbe(p.v)}">${tjGeld(p.v)}</b>`});});
  s+='</svg>';
  return chartHoverWrap(s,pts);
}
let _tjSvgSeq=0;
function tjEquityZeichnen(){
  const box=document.getElementById('tjEqBox');if(!box)return;
  const W=Math.max(200,box.clientWidth||0);
  const[y,m]=tjMonat.split('-').map(Number);
  const list=tjAktiv().filter(t=>String(t.d||'').slice(0,7)===tjMonat);
  if(!list.length){box.innerHTML='<div class="tj-eq-leer"><i>No trades in this month yet</i></div>';return;}
  box.innerHTML=tjEquityHtml(list,y,m,W);
  attachChartHovers(box);
}
function tjDrawdown(list){
  let kum=0,peak=0,dd=0;
  const proTag={};list.forEach(t=>{proTag[t.d]=(proTag[t.d]||0)+(t.pnl||0);});
  Object.keys(proTag).sort().forEach(ds=>{kum+=proTag[ds];if(kum>peak)peak=kum;if(kum-peak<dd)dd=kum-peak;});
  return dd;
}

function tjZeileHtml(t){
  return`<button class="tj-zl ${tjKlasse(t)}" onclick="event.stopPropagation();tjZeigen('${escJH(t.id)}')" title="${escH(t.a)} · ${tjSeite(t.dir)} · ${tjGeld(t.pnl)}"><span class="tj-za">${escH(t.a)}</span>${tjSeiteHtml(t.dir)}<b class="tj-zp">${tjGeld(t.pnl)}</b></button>`;
}
function tjKalenderHtml(y,m,proTag){
  const erster=new Date(y,m-1,1),tage=new Date(y,m,0).getDate(),vorlauf=(erster.getDay()+6)%7,heute=tjHeute();
  const felder=[];for(let i=0;i<vorlauf;i++)felder.push(null);
  for(let d=1;d<=tage;d++)felder.push(`${y}-${tjPad(m)}-${tjPad(d)}`);
  while(felder.length%7)felder.push(null);
  let html=`<div class="tj-kal"><div class="tj-kal-kopf">${TJ_WT.map((w,i)=>`<div class="${i>4?'we':''}"><span class="lang">${w}</span><span class="kurz">${TJ_WT2[i]}</span></div>`).join('')}<div class="wo">Week</div></div>`;
  for(let w=0;w<felder.length/7;w++){
    const woche=felder.slice(w*7,w*7+7);let wl=[];
    html+='<div class="tj-kal-reihe">';
    woche.forEach((ds,i)=>{
      if(!ds){html+=`<div class="tj-tag tj-leer${i>4?' we':''}"></div>`;return;}
      const l=proTag[ds]||[];wl=wl.concat(l);
      const summe=l.reduce((s,t)=>s+(t.pnl||0),0),n=l.length;
      const ton=!n?'':summe>0?' plus':summe<0?' minus':' null';
      const kopf=`<div class="tj-tk"><span class="tj-tn">${+ds.slice(8)}</span>${n&&i<5?`<span class="tj-tc">${n} trade${n>1?'s':''}</span>`:''}</div>`;
      const summeHtml=n?`<b class="tj-ts" style="color:${tjFarbe(summe)}">${tjGeld(summe)}</b><b class="tj-tsk" style="color:${tjFarbe(summe)}">${tjKurz(summe)}</b>`:'';
      html+=`<div class="tj-tag${i>4?' we':''}${ton}${ds===heute?' heute':''}" role="button" tabindex="0" onclick="tjTagKlick('${ds}')" title="${escH(fmtDayHdr(ds))}${n?` · ${n} trade${n>1?'s':''}`:' · add a trade'}">${kopf}${summeHtml}${n&&i<5?`<div class="tj-zeilen">${l.map(tjZeileHtml).join('')}</div>`:''}</div>`;
    });
    const st=tjStats(wl),ton=!st.n?'':st.net>0?' plus':st.net<0?' minus':' null';
    html+=`<div class="tj-woche${ton}"><div class="tj-wl">Week ${w+1}</div>${st.n?`<b class="tj-wp" style="color:${tjFarbe(st.net)}">${tjGeld(st.net)}</b><b class="tj-wpk" style="color:${tjFarbe(st.net)}">${tjKurz(st.net)}</b><div class="tj-wn">${st.n} trade${st.n>1?'s':''}</div>${st.quote!=null?`<div class="tj-wq">Win <b>${Math.round(st.quote*100)}%</b></div>`:''}`:'<div class="tj-wn">–</div>'}</div>`;
    html+='</div>';
  }
  return html+'</div>';
}

function renderJournal(){
  const el=document.getElementById('journalBody');if(!el)return;
  if(!tjMonat)tjMonat=tjHeute().slice(0,7);
  const[y,m]=tjMonat.split('-').map(Number);
  const imMonat=tjChrono(tjAktiv().filter(t=>String(t.d||'').slice(0,7)===tjMonat));
  const proTag={};imMonat.forEach(t=>{(proTag[t.d]=proTag[t.d]||[]).push(t);});
  const st=tjStats(imMonat),sk=tjStreak(),dd=tjDrawdown(imMonat);

  const leiste=`<div class="tj-leiste">
    <div class="tj-nav">
      <button class="btn tj-navb" onclick="tjMonatSetzen(-1)" title="Previous month" aria-label="Previous month">${icn('chevronLeft',16)}</button>
      <div class="tj-monat">${tjMonTitel(y,m)}</div>
      <button class="btn tj-navb" onclick="tjMonatSetzen(1)" title="Next month" aria-label="Next month">${icn('chevronRight',16)}</button>
      <button class="btn tj-heute" onclick="tjMonatHeute()" title="Back to the current month">Today</button>
    </div>
  </div>`;
  const eq=`<div class="tj-card tj-eq">
    <div class="tj-kh"><div class="tj-kt">Equity curve</div><div class="tj-kh-r">
      <span>Net <b style="color:${tjFarbe(st.net)}">${st.n?tjGeld(st.net):'–'}</b></span>
      <span>Max drawdown <b style="color:${dd<0?'var(--bias-bear)':'var(--t2)'}">${st.n?tjGeld(dd):'–'}</b></span></div></div>
    <div id="tjEqBox" class="tj-eq-box"></div>
  </div>`;
  const kal=`<div class="tj-card">
    <div class="tj-kh"><div class="tj-kt">Calendar</div><div class="tj-kh-r"><i>Tap a day to add a trade · tap a trade for all details</i></div></div>
    ${tjKalenderHtml(y,m,proTag)}
  </div>`;
  const neueste=imMonat.slice().reverse();
  const liste=`<div class="tj-card">
    <div class="tj-kh"><div class="tj-kt">Trades · ${tjMonTitel(y,m)}</div></div>
    ${neueste.length?`<div class="tj-tab-wrap"><table class="tj-tab"><thead><tr><th class="c-d">Date</th><th>Asset</th><th class="c-s">Side</th><th class="c-set">Setup</th><th class="r c-r">R</th><th class="r c-p">P/L</th></tr></thead><tbody>
      ${neueste.map(t=>`<tr class="${tjKlasse(t)}" onclick="tjZeigen('${escJH(t.id)}')" title="Show all details"><td class="c-d">${escH(fmtDayShort(t.d))}${t.t?` <i>${escH(t.t)}</i>`:''}</td><td class="c-a"><b>${escH(t.a)}</b><span class="c-a-s">${tjSeiteHtml(t.dir)}</span></td><td class="c-s">${tjSeiteHtml(t.dir)}</td><td class="c-set">${t.setup?escH(t.setup):'<i>–</i>'}</td><td class="r c-r">${(()=>{const r=tjR(t);return r==null?'–':`<span style="color:${tjFarbe(r)}">${tjRText(r)}</span>`;})()}</td><td class="r c-p"><b style="color:${tjFarbe(t.pnl)}">${tjGeld(t.pnl)}</b></td></tr>`).join('')}
    </tbody></table></div>`:`<div class="tj-leertext"><i>No trades in this month yet</i><button class="btn g" onclick="tjNeu()">＋ Add trade</button></div>`}
  </div>`;
  el.innerHTML=leiste+tjKachelnHtml(st,sk,y,m)+eq+kal+liste;
  tjEquityZeichnen();
  tjOffeneChartsAuffrischen();
}

// Tipp auf einen Tag: am PC (Wochentag) neuer Trade - die Trades haben ihre
// eigenen Zeilen. Kompakte Zellen (Handy, Wochenende) zeigen keine Zeilen,
// dort oeffnet ein Tag mit Trades das Tages-Fenster.
function tjTagKlick(ds){
  const l=tjAktiv().filter(t=>t.d===ds);
  const wt=(new Date(ds+'T00:00:00').getDay()+6)%7;
  const kompakt=wt>4||(window.matchMedia&&window.matchMedia('(max-width:760px)').matches);
  if(l.length&&kompakt)tjTagFenster(ds);else tjNeu(ds);
}
function tjTagFenster(ds){
  _tjTag=ds;
  const l=tjChrono(tjAktiv().filter(t=>t.d===ds)),st=tjStats(l);
  document.getElementById('tjdTitle').textContent=fmtDayHdr(ds);
  document.getElementById('tjdBody').innerHTML=`<div class="tjd-sum"><span><b>${st.n}</b> trade${st.n===1?'':'s'}</span><b style="color:${tjFarbe(st.net)}">${tjGeld(st.net)}</b></div>
    <div class="tjd-liste">${l.map(t=>`<button class="tjd-z ${tjKlasse(t)}" onclick="tjTagZuTrade('${escJH(t.id)}')"><span class="tjd-a"><b>${escH(t.a)}</b>${tjSeiteHtml(t.dir)}${t.t?`<i>${escH(t.t)}</i>`:''}</span><b style="color:${tjFarbe(t.pnl)}">${tjGeld(t.pnl)}</b></button>`).join('')}</div>`;
  openM('mTradeDay');
}
function tjTagZuTrade(id){closeM('mTradeDay');tjZeigen(id);}
function tjTagNeu(){const ds=_tjTag;closeM('mTradeDay');tjNeu(ds);}

// ── Kurs-Chart mit Positions-Werkzeug ─────────────────────────────────
// Ein Baustein fuer Editor (ziehbar) und Detail-Fenster (nur Anzeige).
// Tageskerzen nach den Kerzen-Regeln (tagesKerzen: kein Wochenende ausser
// Krypto, Koerper close-to-close, Docht nur aus echtem Hoch/Tief), Achse
// rechts (Preis-Chart), Breite vor dem Bauen gemessen.
const TJ_CH={};
const TJ_FELD={entry:'tjEntry',sl:'tjSl',tp:'tjTp',exit:'tjExit'};
function tjEbenen(boxId){
  const st=TJ_CH[boxId];if(!st)return{};
  if(!st.edit)return st.lv||{};
  const o={};Object.keys(TJ_FELD).forEach(k=>{const e=document.getElementById(TJ_FELD[k]);o[k]=e?tjNum(e.value):null;});
  return o;
}
function tjChartBauen(boxId,opt){
  const box=document.getElementById(boxId);if(!box||!box.clientWidth)return;
  // Im Editor so hoch wie die Feldspalte daneben (sonst bleibt unter dem Chart Leerraum).
  const W=Math.max(200,box.clientWidth),H=W<520?260:opt.edit?430:320;
  const r=tjReihe(opt.asset);
  const leer=(titel,sub)=>{TJ_CH[boxId]=null;box.innerHTML=`<div class="tj-ch-leer" style="height:${H}px"><b>${titel}</b><i>${sub}</i></div>`;};
  if(!r){
    if(!PRICE_DATA_FEED){box.innerHTML=`<div class="tj-ch-leer" style="height:${H}px">${ladeLogoHtml('Loading prices')}</div>`;tjPreiseLaden();return;}
    if(!String(opt.asset||'').trim())return leer('Pick an asset','The daily chart appears here');
    return leer(`No price data for ${escH(opt.asset)}`,opt.edit?'Enter entry, stop and target in the fields':'Levels are shown in the bar above');
  }
  const k=tagesKerzen(r.s,r.id);
  if(k.length<5)return leer(`No price data for ${escH(opt.asset)}`,'Not enough daily candles in the feed');
  const pl=6,pr=66,pt=10,pb=24,pw=W-pl-pr,ph=H-pt-pb;
  const n=Math.max(20,Math.min(110,Math.floor(pw/7)));
  const datum=opt.datum&&/^\d{4}-\d{2}-\d{2}$/.test(opt.datum)?opt.datum:k[k.length-1].d;
  let iDat=-1;k.forEach((c,i)=>{if(c.d<=datum)iDat=i;});
  if(iDat<0)iDat=0;
  const iEnde=Math.min(k.length-1,iDat+(opt.edit?5:10)),iStart=Math.max(0,iEnde-n+1);
  const kk=k.slice(iStart,iEnde+1),slot=pw/kk.length;
  // ATR14 aus echten Hoch/Tief bis zum Trade-Tag - nur fuer die erste Lage des Werkzeugs.
  const atrK=k.slice(Math.max(0,iDat-13),iDat+1).filter(c=>c.ohlc);
  const atr=atrK.length>=5?atrK.reduce((s,c)=>s+(c.h-c.l),0)/atrK.length:null;
  const st={edit:!!opt.edit,lv:opt.lv||{},dir:opt.dir,pl,pr,pt,pb,pw,ph,W,H,kk,atr,datum,asset:opt.asset};
  TJ_CH[boxId]=st;
  tjSkala(boxId);
  let svg=`<svg class="tj-svg tj-ch-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily chart ${escH(opt.asset)}">`;
  svg+=`<g id="${boxId}-achse">${tjAchseSvg(boxId)}</g>`;
  const step=Math.max(1,Math.ceil(78/slot));
  for(let i=kk.length-1;i>=0;i-=step){const x=pl+(i+.5)*slot;if(x<pl+30)break;
    svg+=`<text x="${x.toFixed(1)}" y="${H-7}" text-anchor="middle" class="x-lbl">${escH(fmtDayShort(kk[i].d))}</text>`;}
  const iD=kk.findIndex(c=>c.d===datum);
  if(iD>=0){const x=pl+(iD+.5)*slot;svg+=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${pt}" y2="${pt+ph}" class="tj-tagmarke"/>`;}
  svg+=`<g id="${boxId}-kerzen">${tjKerzenSvg(boxId)}</g><g id="${boxId}-tool"></g></svg>`;
  const pts=kk.map((c,i)=>({fx:(pl+(i+.5)*slot)/W,fy:st.y(c.c)/H,t:c.d,col:'var(--t2)',
    tip:`<b>${escH(fmtDayHdr(c.d))}</b><br>Close <b>${tjPreis(c.c)}</b>${c.ohlc?` · H ${tjPreis(c.h)} · L ${tjPreis(c.l)}`:''}`}));
  box.innerHTML=`<div class="tj-ch${st.edit?' edit':''}" style="height:${H}px">${chartHoverWrap(svg,pts)}<div class="tj-ch-hd" id="${boxId}-hd"></div></div>`;
  attachChartHovers(box);
  if(st.edit){
    const flaeche=box.querySelector('.tj-ch');
    flaeche.addEventListener('click',ev=>{if(ev.target.closest('.tj-hd'))return;tjPlatzieren(boxId,ev);});
  }
  tjToolZeichnen(boxId);
}
// Skala aus Kerzen + Ebenen; wird nach dem Ziehen neu gesetzt, damit eine
// gezogene Linie nie aus dem Bild laeuft.
function tjSkala(boxId){
  const st=TJ_CH[boxId];if(!st)return;
  let hi=Math.max(...st.kk.map(c=>c.h)),lo=Math.min(...st.kk.map(c=>c.l));
  const lv=tjEbenen(boxId);Object.values(lv).forEach(v=>{if(v!=null&&isFinite(v)){hi=Math.max(hi,v);lo=Math.min(lo,v);}});
  const pad=(hi-lo)*0.07||Math.abs(hi)*0.01||1;hi+=pad;lo-=pad;
  st.lo=lo;st.hi=hi;st.dez=tjDez((hi+lo)/2);
  st.y=v=>st.pt+(1-(v-st.lo)/(st.hi-st.lo))*st.ph;
  st.v=yy=>st.lo+(1-(yy-st.pt)/st.ph)*(st.hi-st.lo);
}
function tjAchseSvg(boxId){
  const st=TJ_CH[boxId];let s='';
  achsenTicks(st.lo,st.hi,5).forEach(t=>{const yy=st.y(t);if(yy<st.pt-1||yy>st.pt+st.ph+1)return;
    s+=`<line x1="${st.pl}" x2="${st.pl+st.pw}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="tj-gitter"/><text x="${st.pl+st.pw+6}" y="${(yy+4).toFixed(1)}" class="y-lbl">${(+t).toFixed(Math.max(0,tjDez(t)-1))}</text>`;});
  return s;
}
function tjKerzenSvg(boxId){
  const st=TJ_CH[boxId],slot=st.pw/st.kk.length,bw=Math.max(1,Math.min(9,slot*0.62));
  return st.kk.map((c,i)=>{
    const x=st.pl+(i+.5)*slot,auf=c.c>=c.o,col=auf?'var(--cndl-up)':'var(--cndl-dn)';
    const y1=st.y(Math.max(c.o,c.c)),y2=st.y(Math.min(c.o,c.c));
    return(c.ohlc?`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${st.y(c.h).toFixed(1)}" y2="${st.y(c.l).toFixed(1)}" stroke="${col}" stroke-width="1"/>`:'')+
      `<rect x="${(x-bw/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,y2-y1).toFixed(1)}" fill="${col}"/>`;
  }).join('');
}
function tjNeuSkalieren(boxId){
  const st=TJ_CH[boxId];if(!st)return;
  tjSkala(boxId);
  const a=document.getElementById(boxId+'-achse'),k=document.getElementById(boxId+'-kerzen');
  if(a)a.innerHTML=tjAchseSvg(boxId);if(k)k.innerHTML=tjKerzenSvg(boxId);
  tjToolZeichnen(boxId);
}
function tjToolZeichnen(boxId){
  const st=TJ_CH[boxId];if(!st)return;
  const g=document.getElementById(boxId+'-tool'),hd=document.getElementById(boxId+'-hd');if(!g||!hd)return;
  const lv=tjEbenen(boxId),dir=st.edit?(document.getElementById('tjDir')||{}).value:st.dir;
  const x1=st.pl,w=st.pw,yv=v=>Math.max(st.pt,Math.min(st.pt+st.ph,st.y(v)));
  const ok=v=>v!=null&&isFinite(v);
  let s='';
  const zone=(a,b,cls)=>{const ya=yv(a),yb=yv(b);return`<rect x="${x1}" y="${Math.min(ya,yb).toFixed(1)}" width="${w}" height="${Math.abs(ya-yb).toFixed(1)}" class="${cls}"/>`;};
  if(ok(lv.entry)&&ok(lv.tp))s+=zone(lv.entry,lv.tp,'tj-z-tp');
  if(ok(lv.entry)&&ok(lv.sl))s+=zone(lv.entry,lv.sl,'tj-z-sl');
  ['sl','tp','entry','exit'].forEach(k=>{if(ok(lv[k])){const yy=yv(lv[k]).toFixed(1);s+=`<line x1="${x1}" x2="${x1+w}" y1="${yy}" y2="${yy}" class="tj-l-${k}"/>`;}});
  g.innerHTML=s;
  const t={entry:lv.entry,sl:lv.sl,exit:lv.exit,dir};
  const label={entry:'Entry',sl:'SL',tp:'TP',exit:'Exit'};
  const zusatz=k=>{
    if(k==='tp'){const r=tjRRPlan({entry:lv.entry,sl:lv.sl,tp:lv.tp,dir});return r!=null?` · ${r.toFixed(2)}R`:'';}
    if(k==='exit'){const r=tjR(t);return r!=null?` · ${tjRText(r)}`:'';}
    return'';
  };
  const da=Object.keys(TJ_FELD).filter(k=>ok(lv[k]));
  hd.querySelectorAll('.tj-hd').forEach(e=>{if(!da.includes(e.dataset.k))e.remove();});
  // Beschriftungen nicht uebereinander: von oben nach unten mindestens 22 px Abstand.
  const lage=da.map(k=>({k,y:yv(lv[k])})).sort((a,b)=>a.y-b.y);
  for(let i=1;i<lage.length;i++)if(lage[i].y-lage[i-1].y<22)lage[i].y=lage[i-1].y+22;
  lage.forEach(({k,y})=>{
    let e=hd.querySelector(`.tj-hd[data-k="${k}"]`);
    const zieh=st.edit&&k!=='exit';
    if(!e){
      e=document.createElement('div');e.className=`tj-hd k-${k}${zieh?' zieh':''}`;e.dataset.k=k;
      if(zieh){e.setAttribute('role','slider');e.setAttribute('aria-label',`Drag ${label[k]}`);e.tabIndex=0;
        e.addEventListener('pointerdown',ev=>tjZiehStart(ev,boxId,k));}
      hd.appendChild(e);
    }
    e.style.top=Math.min(y,st.pt+st.ph+10).toFixed(1)+'px';
    e.innerHTML=`${zieh?'<span class="tj-hd-griff"></span>':''}${label[k]} <b>${tjPreis(lv[k])}</b>${zusatz(k)}`;
  });
  if(st.edit)tjRRZeigen();
}
function tjZiehStart(ev,boxId,k){
  const st=TJ_CH[boxId];if(!st)return;
  ev.preventDefault();ev.stopPropagation();
  const el=ev.currentTarget;try{el.setPointerCapture(ev.pointerId);}catch(e){}
  const svg=document.querySelector(`#${boxId} svg.tj-ch-svg`);if(!svg)return;
  const oben=svg.getBoundingClientRect().top;
  el.classList.add('aktiv');
  const feld=document.getElementById(TJ_FELD[k]);
  const zieh=e=>{
    const yy=Math.max(st.pt,Math.min(st.pt+st.ph,e.clientY-oben));
    if(feld)feld.value=st.v(yy).toFixed(st.dez);
    tjToolZeichnen(boxId);
  };
  const los=()=>{
    el.classList.remove('aktiv');
    el.removeEventListener('pointermove',zieh);el.removeEventListener('pointerup',los);el.removeEventListener('pointercancel',los);
    tjNeuSkalieren(boxId);
  };
  el.addEventListener('pointermove',zieh);el.addEventListener('pointerup',los);el.addEventListener('pointercancel',los);
}
// Erster Tipp in den Chart: Entry an diese Stelle, SL 1 ATR14 und TP 2 ATR14
// daneben (ohne ATR: 8 % der sichtbaren Spanne). Fehlen nur SL/TP, ergaenzt
// der Tipp diese um den vorhandenen Entry.
function tjPlatzieren(boxId,ev){
  const st=TJ_CH[boxId];if(!st)return;
  const lv=tjEbenen(boxId);
  if(lv.entry!=null&&lv.sl!=null&&lv.tp!=null)return;
  const svg=document.querySelector(`#${boxId} svg.tj-ch-svg`);if(!svg)return;
  const yy=Math.max(st.pt,Math.min(st.pt+st.ph,ev.clientY-svg.getBoundingClientRect().top));
  const e=lv.entry!=null?lv.entry:st.v(yy);
  const d=st.atr||(st.hi-st.lo)*0.08,kurz=(document.getElementById('tjDir')||{}).value==='short';
  const setz=(k,v)=>{const f=document.getElementById(TJ_FELD[k]);if(f&&!String(f.value).trim())f.value=v.toFixed(st.dez);};
  setz('entry',e);setz('sl',kurz?e+d:e-d);setz('tp',kurz?e-2*d:e+2*d);
  tjNeuSkalieren(boxId);
}
function tjRRZeigen(){
  const el=document.getElementById('tjRR');if(!el)return;
  const lv=tjEbenen('tjChart');const g=k=>{const e=document.getElementById(TJ_FELD[k]);return e?tjNum(e.value):null;};
  const e=lv.entry!=null?lv.entry:g('entry'),sl=lv.sl!=null?lv.sl:g('sl'),tp=lv.tp!=null?lv.tp:g('tp'),x=lv.exit!=null?lv.exit:g('exit');
  const dir=(document.getElementById('tjDir')||{}).value;
  const teile=[];const dz=v=>v.toFixed(tjDez(e||v));
  if(e!=null&&sl!=null)teile.push(`Risk <b>${dz(Math.abs(e-sl))}</b>`);
  if(e!=null&&tp!=null)teile.push(`Reward <b>${dz(Math.abs(tp-e))}</b>`);
  const rr=tjRRPlan({entry:e,sl,tp,dir});if(rr!=null)teile.push(`Planned R:R <b>1 : ${rr.toFixed(2)}</b>`);
  const r=tjR({entry:e,sl,exit:x,dir});if(r!=null)teile.push(`Result <b style="color:${tjFarbe(r)}">${tjRText(r)}</b>`);
  const warn=[];
  if(e!=null&&sl!=null&&(dir==='short'?sl<=e:sl>=e))warn.push(`Stop is ${dir==='short'?'below':'above'} entry for a ${tjSeite(dir).toLowerCase()}`);
  if(e!=null&&tp!=null&&(dir==='short'?tp>=e:tp<=e))warn.push(`Target is ${dir==='short'?'above':'below'} entry for a ${tjSeite(dir).toLowerCase()}`);
  el.innerHTML=(teile.length?teile.join('<span class="tj-sep">·</span>'):'<i>Tap the chart to place the position · then drag Entry, SL and TP</i>')+
    warn.map(w=>`<span class="tj-warn">${escH(w)}</span>`).join('');
}
function tjEdChart(){
  const a=document.getElementById('tjAsset'),d=document.getElementById('tjDate');
  const t=document.getElementById('tjChTitel');if(t)t.textContent=(a&&a.value.trim())||'Price chart';
  tjChartBauen('tjChart',{asset:a?a.value:'',datum:d?d.value:'',edit:true});
  tjRRZeigen();
}
let _tjEdT=0;
// Ebenen-Felder: nur neu skalieren (schnell). Asset/Datum: Chart neu bauen.
function tjEdEingabe(neuBauen){clearTimeout(_tjEdT);_tjEdT=setTimeout(()=>{if(TJ_CH.tjChart&&!neuBauen)tjNeuSkalieren('tjChart');else tjEdChart();},neuBauen?250:90);}
function tjRichtung(dir){
  const h=document.getElementById('tjDir');if(!h)return;
  const alt=h.value;h.value=dir==='short'?'short':'long';
  document.querySelectorAll('#mTrade .tj-seg-b').forEach(b=>{const on=b.dataset.dir===h.value;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  // Werkzeug spiegeln, wenn SL/TP noch fuer die andere Seite liegen.
  if(alt&&alt!==h.value){
    const g=k=>tjNum((document.getElementById(TJ_FELD[k])||{}).value);
    const e=g('entry'),sl=g('sl'),tp=g('tp');
    const falsch=e!=null&&((sl!=null&&(h.value==='short'?sl<e:sl>e))||(tp!=null&&(h.value==='short'?tp>e:tp<e)));
    if(falsch){const dz=tjDez(e);
      if(sl!=null)document.getElementById('tjSl').value=(2*e-sl).toFixed(dz);
      if(tp!=null)document.getElementById('tjTp').value=(2*e-tp).toFixed(dz);}
  }
  if(TJ_CH.tjChart)tjNeuSkalieren('tjChart');else tjRRZeigen();
}
// "takeprofit und exit sind oft gleich" (Nutzer 2026-10-24): ein Tipp
// uebernimmt TP bzw. SL als Exit.
function tjExitAuf(k){
  const q=document.getElementById(TJ_FELD[k]),x=document.getElementById('tjExit');
  if(!q||!x)return;
  if(!String(q.value).trim()){const err=document.getElementById('tjErr');if(err){err.textContent=`Set the ${k==='tp'?'take profit':'stop loss'} first`;err.hidden=false;}return;}
  x.value=q.value;
  if(TJ_CH.tjChart)tjNeuSkalieren('tjChart');else tjRRZeigen();
}
function tjOffeneChartsAuffrischen(){
  const offen=id=>{const e=document.getElementById(id);return e&&e.style.display!=='none'&&e.style.display!=='';};
  if(offen('mTrade'))tjEdChart();
  if(offen('mTradeView')&&_tjView){const t=trades.find(x=>x.id===_tjView);if(t)tjDetailChart(t);}
}

// ── Detail-Fenster ───────────────────────────────────────────────────
function tjPreisleisteHtml(t){
  const e=tjNum(t.entry),sl=tjNum(t.sl),tp=tjNum(t.tp),x=tjNum(t.exit);
  if(e==null||(sl==null&&tp==null))return'';
  const werte=[e,sl,tp,x].filter(v=>v!=null);
  const lo=Math.min(...werte),hi=Math.max(...werte),sp=hi-lo||1;
  // Risiko links, Chance rechts - bei Short faellt der Kurs nach rechts.
  const pos=v=>(t.dir==='short'?(hi-v)/sp:(v-lo)/sp)*100;
  const zone=(a,b,cls)=>a==null||b==null?'':`<span class="tjp-zone ${cls}" style="left:${Math.min(pos(a),pos(b)).toFixed(2)}%;width:${Math.abs(pos(a)-pos(b)).toFixed(2)}%"></span>`;
  const marken=[['sl','SL',sl],['entry','Entry',e],['exit','Exit',x],['tp','TP',tp]].filter(m=>m[2]!=null).sort((a,b)=>pos(a[2])-pos(b[2]));
  let letzt=-99,unten=false;
  const mk=marken.map(([k,l,v])=>{const p=pos(v);unten=p-letzt<16?!unten:false;letzt=p;
    return`<span class="tjp-mk k-${k}${unten?' unten':''}${p<10?' li':p>90?' re':''}" style="left:${p.toFixed(2)}%"><span class="tjp-pkt"></span><span class="tjp-lbl">${l} <b>${tjPreis(v)}</b></span></span>`;}).join('');
  return`<div class="tjp"><div class="tjp-bahn">${zone(sl,e,'risk')}${zone(e,tp,'reward')}${mk}</div></div>`;
}
function tjZeigen(id){
  const t=trades.find(x=>x.id===id&&!x.del);if(!t)return;
  _tjView=id;
  const r=tjR(t),rr=tjRRPlan(t);
  const kacheln=[
    ['R multiple',r==null?null:`<b style="color:${tjFarbe(r)}">${tjRText(r)}</b>`],
    ['Planned R:R',rr==null?null:`<b>1 : ${rr.toFixed(2)}</b>`],
    ['Size',t.size?`<b>${escH(String(t.size))}</b>`:null],
    ['Setup',t.setup?`<b>${escH(t.setup)}</b>`:null],
  ].filter(k=>k[1]);
  document.getElementById('tjvTitle').textContent='Trade details';
  document.getElementById('tjvBody').innerHTML=`
    <div class="tjv-kopf ${tjKlasse(t)}">
      <div class="tjv-kl"><div class="tjv-asset">${escH(t.a)} ${tjSeiteHtml(t.dir)}</div><div class="tjv-datum">${escH(fmtDayHdr(t.d))}${t.t?` · <i>${escH(t.t)}</i>`:''}</div></div>
      <div class="tjv-kr"><div class="tjv-erg">${tjErgebnis(t)}</div><b class="tjv-pnl" style="color:${tjFarbe(t.pnl)}">${tjGeld(t.pnl)}</b></div>
    </div>
    ${kacheln.length?`<div class="tjv-kacheln">${kacheln.map(([l,v])=>`<div class="tjv-k"><div class="tj-kl">${l}</div><div class="tjv-kv">${v}</div></div>`).join('')}</div>`:''}
    ${tjPreisleisteHtml(t)}
    <div class="tjv-ch-kopf"><b>${escH(t.a)}</b> <i>daily · trade day marked</i></div>
    <div id="tjvChart" class="tjv-chart"></div>
    ${t.notes?`<div class="tjv-notiz"><div class="tj-kl">Notes</div><i>${escH(t.notes)}</i></div>`:''}`;
  openM('mTradeView');
  requestAnimationFrame(()=>tjDetailChart(t));
}
function tjDetailChart(t){
  tjChartBauen('tjvChart',{asset:t.a,datum:t.d,dir:t.dir,edit:false,
    lv:{entry:tjNum(t.entry),sl:tjNum(t.sl),tp:tjNum(t.tp),exit:tjNum(t.exit)}});
}
function tjBearbeiten(){const id=_tjView;closeM('mTradeView');if(id)tjNeu(null,id);}
function tjLoeschen(){
  const t=trades.find(x=>x.id===_tjView);if(!t)return;
  if(!confirm(`Delete this trade?\n${t.a} · ${tjGeld(t.pnl)}`))return;
  const alt={...t};
  // Grabstein statt Entfernen - sonst holt der Merge ihn vom anderen Geraet zurueck.
  Object.keys(t).forEach(k=>{if(k!=='id')delete t[k];});
  t.del=true;t.up=new Date().toISOString();
  if(!tjSpeichern()){Object.keys(t).forEach(k=>{if(k!=='id')delete t[k];});Object.assign(t,alt);return;}
  closeM('mTradeView');renderJournal();
}

// ── Editor ───────────────────────────────────────────────────────────
const TJ_FELDER=['tjDate','tjTime','tjAsset','tjDir','tjPnl','tjEntry','tjExit','tjSl','tjTp','tjSize','tjSetup','tjNotes'];
const TJ_SCHLUESSEL=['d','t','a','dir','pnl','entry','exit','sl','tp','size','setup','notes'];
function tjAssetVorschlaege(){
  const s=new Set();
  tjAktiv().forEach(t=>t.a&&s.add(t.a));
  (pairs||[]).forEach(p=>p&&p.name&&s.add(p.name));
  (syms||[]).forEach(x=>x&&x.id&&s.add(x.id));
  return[...s].sort((a,b)=>a.localeCompare(b));
}
function tjNeu(datum,id){
  const t=id?trades.find(x=>x.id===id&&!x.del):null;
  _tjEdit=t?t.id:null;
  document.getElementById('tjFormTitle').textContent=t?'Edit trade':'New trade';
  const dl=document.getElementById('tjAssetList');
  if(dl)dl.innerHTML=tjAssetVorschlaege().map(a=>`<option value="${escH(a)}"></option>`).join('');
  TJ_FELDER.forEach((f,i)=>{
    const e=document.getElementById(f);if(!e)return;
    const k=TJ_SCHLUESSEL[i];
    let v=t?t[k]:'';
    if(!t&&k==='d')v=datum||tjHeute();
    if(!t&&k==='dir')v='long';
    e.value=v==null?'':String(v);
  });
  const h=document.getElementById('tjDir');
  document.querySelectorAll('#mTrade .tj-seg-b').forEach(b=>{const on=b.dataset.dir===(h&&h.value||'long');b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  const err=document.getElementById('tjErr');if(err){err.textContent='';err.hidden=true;}
  delete TJ_CH.tjChart;const c=document.getElementById('tjChart');if(c)c.innerHTML='';
  openM('mTrade');
  requestAnimationFrame(tjEdChart);
}
function tjFormSpeichern(){
  const v={};TJ_FELDER.forEach((f,i)=>{const e=document.getElementById(f);v[TJ_SCHLUESSEL[i]]=e?String(e.value||'').trim():'';});
  const fehl=[];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.d))fehl.push('Date');
  if(!v.a)fehl.push('Asset');
  const pnl=tjNum(v.pnl);if(pnl==null)fehl.push('P/L');
  const err=document.getElementById('tjErr');
  if(fehl.length){if(err){err.textContent='Missing: '+fehl.join(' · ');err.hidden=false;}return false;}
  const neu={...v,dir:v.dir==='short'?'short':'long',pnl,up:new Date().toISOString()};
  const alt=_tjEdit?trades.find(x=>x.id===_tjEdit):null;
  const sicherung=alt?{...alt}:null;
  if(alt)Object.assign(alt,neu);else trades.push({id:uid(),...neu});
  if(!tjSpeichern()){
    if(alt){Object.keys(alt).forEach(k=>delete alt[k]);Object.assign(alt,sicherung);}else trades.pop();
    if(err){err.textContent='Not saved - storage is full or blocked';err.hidden=false;}
    return false;
  }
  tjMonat=v.d.slice(0,7);
  closeM('mTrade');renderJournal();
  return true;
}
// Fuer MODAL_GUARD_TABELLE (js/main.js) - Nachfrage bei ungespeicherten Eingaben.
const TJ_GUARD={felder:TJ_FELDER,save:()=>tjFormSpeichern(),was:'This trade'};

// Groessenaenderung: Equity-Kurve und offene Charts in echter Breite neu bauen.
if(typeof window!=='undefined'){
  let _tjRs=0;
  window.addEventListener('resize',()=>{clearTimeout(_tjRs);_tjRs=setTimeout(()=>{
    if(curPage==='journal'&&tjMonat)tjEquityZeichnen();
    tjOffeneChartsAuffrischen();},160);});
}

export {trades,TRADES_KEY,mergeTrades,tjUebernehmen,renderJournal,tjNeu,tjZeigen,tjFormSpeichern,TJ_GUARD,tjR,tjReihe};
if(typeof window!=='undefined'){
  Object.assign(window,{renderJournal,tjNeu,tjZeigen,tjBearbeiten,tjLoeschen,tjFormSpeichern,tjMonatSetzen,tjMonatHeute,
    mergeTrades,tjUebernehmen,tjR,tjReihe,tjTagKlick,tjTagFenster,tjTagZuTrade,tjTagNeu,tjRichtung,tjExitAuf,tjEdEingabe,tjStreak,tjStats});
  Object.defineProperty(window,'trades',{get:()=>trades,configurable:true});
}
