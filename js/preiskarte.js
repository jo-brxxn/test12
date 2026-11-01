// ══ PRICE-KARTE: RELEASE-PFEILE, SPALTE, EIGENE PFEILE, VERGLEICH ════════════
//
// Nutzer 2026-11-01 (mit TradingView-Screenshot, roter Pfeil ueber einer Kerze):
// "Im Chart sollen die stellen markiert sein wo neue Fundamentale Daten
// herausgekommen sind ... ueber der Kerze oder Linie ... je nach dem ob die
// News gut oder schlecht waren soll der Pfeil auch eine Farbe haben ...
// Klickt man auf den Pfeil soll links ... eine kleine Spalte sein wo die
// naechsten zukunftsevents stehen. Die wird dann ... leer gemacht und da
// stehen dann die Ereignisse drinne die an dem Tag waren. Wenn man ins nichts
// klickt ... kommen wieder zukunftsevents ... actual - forecast ... previous
// ... selber so Pfeile hinzufuegen ... erst die Stelle auswaehlen und dann
// kommt ein Fenster wo man sagt was und ob es halt gut oder schlecht oder
// neutral war". Aus drei Entwuerfen (VERSION-CHECK-663) gewaehlt: "Option b
// nur eine Aenderung mit Pfeilen statt Punkten und mach einen Button die
// Markierungen aus dem Chart auszublenden und mach es so wie bei data bei
// compare all das man einen grossen Filter hat und bis zu 2 Assets in den
// Chart hinzufuegen kann wenn das passiert soll der Chart automatisch zu
// Linien werden sonst bei nur einem Asset als Kerze".
//
// Bausteine (alle hier):
//   - pkReleases(id): je Tag die Releases der GETRACKTEN Indikatoren des
//     Assets (Zeilen mit Kalender-Muster), Werte aus der Feed-Historie,
//     Farbe = actualColor (dieselbe wie im Kalender, inkl. Asset-Regel)
//   - pkLageHtml(): die Pfeil-Ebene ueber dem Chart. HTML statt SVG, weil der
//     Kerzenchart per preserveAspectRatio="none" gestreckt wird - ein Pfeil
//     im SVG waere verzerrt. Je Tag (bei < 9 px je Kerze je Woche) EIN Pfeil
//     in der Mehrheits-Farbe, Zahl = Releases; eigene Pfeile hohl darueber.
//   - pkSpalteHtml(): links neben dem Chart Next up (wie die Kalender-Karte)
//     oder - nach Tipp auf einen Pfeil - die Releases dieses Tages als Karten
//     (Actual gross, Forecast, Previous), Tages- und 5-Tage-Bewegung.
//   - Eigene Pfeile = Eintraege in research.notes mit pm:{a:Asset,d:Tag}
//     (wie die Zentralbank-Notizen mit cb) - Abgleich nach id, Loesch-Marker
//     und Papierkorb gelten damit unveraendert (docs/state-sync.md).
//   - Vergleich: bis zu 2 Kurse dazu (Gruppen-Fenster wie Data · Compare all);
//     dann zeichnet preisChartHtml alle als Linien, sonst Kerzen.
// Geprueft von check/preiskarte.js.
import {BC} from './constants.js';
import {escH,escJH,icn,syms,research,resNotes,trashResNote,pushU,save,uid,todayStr,
  calEvts,evtMatchesSym,IND_EVENT_MATCHERS,stripPeriodSuffix,macroCcyFor,calHighOnly,
  indName,fmtIndVal,feedEntryFor,preisReiheAnzeige,tagesKerzen,attachChartHovers,
  abCalNachTag,dataAlleAssetGruppen,dataAlleItems,pickerAnkern,preisChartHtml,abFenster,
  pkMarkenAn,pkMarkenUmschalten,getSym,curPage} from './main.js';
import {actualColor,isEvtPast,evtImpact,countdownHtml} from './calendar.js';
import {IND_DATA_FEED} from './data-feeds.js';

// ── Zustand (Sitzung) ────────────────────────────────────────────────────
// Bewusst nur Sitzung (docs/state-sync.md "Bewusst NICHT synchronisiert"):
// gewaehlter Tag, Hinzufuegen-Modus, Vergleichs-Auswahl und ihre Skala - wie
// die Auswahl in Data. Synchronisiert: pkMarkenAn (main.js) und die eigenen
// Pfeile (research.notes).
let pkSel=null;            // {a:Asset, k:Tag oder Wochenanfang}
let pkAdd=false;           // Hinzufuegen-Modus
let pkForm=null;           // {a,d,t,b} offenes Popover
const pkVgl={};            // {Asset:[Kurs-Schluessel]}
let pkVglSkala='band';     // 'band' (0-100 je Linie) | 'bruch' (echte Kurse)
const PK_VGL_MAX=2;
const PK_WOCHE_PX=9;       // darunter je Woche ein Pfeil (Handy schon bei 3M)
const _pkReg={};           // Lage-Id -> {a,tage,x0,dx,y:{Tag:Anteil},eimer}
let _pkSeq=0;

// ── Releases je Tag ──────────────────────────────────────────────────────
const _relMerk=new Map();
function pkReleases(id){
  const sym=syms.find(s=>s.id===id);
  if(!sym)return{};
  const ccy=macroCcyFor(id),feed=IND_DATA_FEED&&ccy?IND_DATA_FEED[ccy]:null;
  const schl=id+'|'+(calEvts||[]).length+'|'+(feed?Object.keys(feed).length:0)+'|'+(sym.rubrics||[]).reduce((s,r)=>s+(r.indicators||[]).reduce((t,i)=>t+((i.chartHist||[]).length),0),0);
  const m0=_relMerk.get(id);if(m0&&m0.schl===schl)return m0.map;
  const map={};
  const add=(d,o)=>{(map[d]=map[d]||[]).push(o);};
  (sym.rubrics||[]).forEach(rub=>(rub.indicators||[]).forEach(ind=>{
    const base=stripPeriodSuffix(ind.name).base,m=IND_EVENT_MATCHERS[base];
    if(!m)return;                       // kein Release (Renditen, COT, Trend ...)
    const nm=indName(ind),gesehen=new Set();
    // Werte wie im Kalender: die Feed-Historie als Text ("194K", "3-0-6");
    // nur ohne Feed die Zahlen der Chart-Historie.
    const f=feed?feedEntryFor(feed,ind.name):null;
    const roh=f&&Array.isArray(f.historyFull)&&f.historyFull.length?f.historyFull.map(h=>[String(h[0]).slice(0,10),h[1]==null?'':String(h[1]),h[2]==null?'':String(h[2])])
      :(ind.chartHist||[]).map(p=>[String(p[0]).slice(0,10),p[1]==null?'':fmtIndVal(p[1],''),p[2]==null?'':fmtIndVal(p[2],'')]);
    roh.forEach((h,i)=>{
      if(!h[0]||h[1]===''||gesehen.has(h[0]))return;
      gesehen.add(h[0]);
      const ev={name:ind.name,actual:h[1],forecast:h[2],previous:i>0?roh[i-1][1]:''};
      add(h[0],{n:nm,a:h[1],f:h[2],p:ev.previous,col:actualColor(ev,id)});
    });
    // Heute schon im Kalender, im Feed noch nicht (der Feed laeuft stuendlich).
    if(!m.nurTermin)(calEvts||[]).forEach(ev=>{
      if(!ev||!ev.actual||!ev.date||gesehen.has(ev.date))return;
      if(!evtMatchesSym(ev,ccy)||!m(ev.name,ccy))return;
      gesehen.add(ev.date);
      add(ev.date,{n:nm,a:ev.actual,f:ev.forecast||'',p:ev.previous||'',col:actualColor({name:ind.name,actual:ev.actual,forecast:ev.forecast,previous:ev.previous},id)});
    });
  }));
  _relMerk.set(id,{schl,map});
  return map;
}
// Eigene Pfeile: research.notes mit pm (siehe Kopf).
function pkEigene(id){return resNotes().filter(n=>n&&n.pm&&n.pm.a===id&&n.pm.d);}

// ── Tage, Eimer, Bewegung ────────────────────────────────────────────────
function wocheVon(d){const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()-(t.getUTCDay()+6)%7);return t.toISOString().slice(0,10);}
function naechsterTag(tage,d){let lo=0,hi=tage.length-1;if(!tage.length||d<tage[0]||d>tage[hi])return -1;while(lo<hi){const m=(lo+hi)>>1;if(tage[m]<d)lo=m+1;else hi=m;}return lo;}
// Eimer: je Tag (bzw. Woche) Releases + eigene Pfeile, i0/i1 = Index der Tage.
function pkEimer(id,tage,woche){
  const rel=pkReleases(id),eig=pkEigene(id),B=new Map();
  const key=d=>woche?wocheVon(d):d;
  const eimer=k=>{if(!B.has(k))B.set(k,{k,ev:[],eig:[],i0:1e9,i1:-1});return B.get(k);};
  Object.keys(rel).forEach(d=>{const i=naechsterTag(tage,d);if(i<0)return;eimer(key(tage[i])).ev.push(...rel[d].map(e=>Object.assign({d},e)));});
  eig.forEach(n=>{const i=naechsterTag(tage,n.pm.d);if(i<0)return;eimer(key(tage[i])).eig.push(n);});
  tage.forEach((d,i)=>{const b=B.get(key(d));if(b){b.i0=Math.min(b.i0,i);b.i1=Math.max(b.i1,i);}});
  B.forEach(b=>{
    b.g=b.ev.filter(e=>e.col==='act-good').length;b.s=b.ev.filter(e=>e.col==='act-bad').length;b.n=b.ev.length-b.g-b.s;
    b.bias=b.g>b.s?'bull':b.s>b.g?'bear':'neu';
  });
  return B;
}
const _schlMerk=new Map();
function pkSchluesse(id){
  const r=preisReiheAnzeige(id)||[],schl=r.length+'|'+(r.length?r[r.length-1][0]+r[r.length-1][1]:'');
  const m0=_schlMerk.get(id);if(m0&&m0.schl===schl)return m0.k;
  let k=[];try{k=tagesKerzen(r,id)||[];}catch(e){k=[];}
  _schlMerk.set(id,{schl,k});return k;
}
function pkBewegung(id,d0,d1){
  const k=pkSchluesse(id),i0=naechsterTag(k.map(x=>x.d),d0);
  if(i0<0)return{tag:null,nach:null};
  let i1=i0;while(i1+1<k.length&&k[i1+1].d<=d1)i1++;
  const vor=i0>0?k[i0-1].c:k[i0].o,tag=vor?k[i1].c/vor-1:null;
  const j=Math.min(k.length-1,i1+5),nach=j>i1&&k[i1].c?k[j].c/k[i1].c-1:null;
  return{tag,nach};
}
const bcol=b=>b==='bull'?BC.bull:b==='bear'?BC.bear:BC.neu;
const BIAS=[['bull','Bullish'],['neu','Neutral'],['bear','Bearish']];
const pct=v=>v==null||!isFinite(v)?'–':(v>0?'+':'')+(v*100).toFixed(2)+'%';
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],WT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const tagKurz=d=>{const t=new Date(d+'T12:00:00Z');return`${WT[t.getUTCDay()]}, ${MON[t.getUTCMonth()]} ${t.getUTCDate()}`;};
const tagJahr=d=>tagKurz(d)+', '+String(d).slice(2,4);

// ── Pfeil-Ebene ──────────────────────────────────────────────────────────
// api: {tage, x:(i)=>Anteil 0..1, y:(Tag)=>Anteil 0..1 (Oberkante) oder null
// (kein Kurs an dem Tag - z. B. der erste Tag des Fensters: eine Kerze braucht
// den Vortagesschluss), breite:px}
const PFEIL='<svg class="pk-pfeil" viewBox="0 0 14 17" aria-hidden="true"><path d="M4.5 .8h5v6.6h3.7L7 16.2.8 7.4h3.7z"/></svg>';
function pkLageHtml(id,api){
  const lid='pk'+(++_pkSeq),tage=api.tage||[];
  if(tage.length<2)return'';
  const woche=api.breite/tage.length<PK_WOCHE_PX;
  const B=pkEimer(id,tage,woche);
  _pkReg[lid]={a:id,tage,x:api.x,y:api.y,B,woche};
  // Alte Lagen abraeumen (gleiche Idee wie chvAufraeumen)
  Object.keys(_pkReg).forEach(k=>{if(k!==lid&&+k.slice(2)<_pkSeq-6)delete _pkReg[k];});
  if(!pkMarkenAn)return`<div class="pk-lage pk-aus" data-pk="${lid}"></div>`;
  // Knopfbreite = Abstand zweier Pfeile minus 1 px, hoechstens 22 px - sonst
  // ueberdecken sich Nachbartage (gemessen 2026-11-01, check/designregeln.js F:
  // 1180 px = ~12 px je Tag, Knopf 22 px). Nach dem Aufbau mit der echten
  // Breite nachgezogen (pkBreiteSetzen).
  const kw=pkKnopfBreite(api.breite,tage.length,woche);
  let h='';
  B.forEach(b=>{
    if(!b.ev.length&&!b.eig.length)return;
    // gemessen 2026-11-01: ohne diese Pruefung schwebte der Pfeil des ersten
    // Fenstertags mitten im Chart (Tag ohne Kerze -> y 0,5)
    let x=0,y=Infinity,n=0;for(let i=b.i0;i<=b.i1;i++){const yy=api.y(tage[i]);if(yy==null)continue;x+=api.x(i);y=Math.min(y,yy);n++;}
    if(!n)return;
    x/=n;
    const tip=b.ev.map(e=>e.n).concat(b.eig.map(n=>'Mine: '+(n.title||''))).join(' · ');
    const teile=(b.eig.map(n=>`<span class="pk-pf-i pk-eig" style="--c:${bcol(n.bias)}">${PFEIL}</span>`).join(''))
      +(b.ev.length?`${b.ev.length>1?`<i class="pk-n">${b.ev.length}</i>`:''}<span class="pk-pf-i" style="--c:${bcol(b.bias)}">${PFEIL}</span>`:'');
    h+=`<button type="button" class="pk-pf${pkSel&&pkSel.a===id&&pkSel.k===b.k?' on':''}" data-b="${escH(b.k)}" style="left:${(x*100).toFixed(3)}%;top:${(y*100).toFixed(3)}%" title="${escH(tagKurz(tage[b.i0])+' · '+tip)}" aria-label="${escH((woche?'Week of ':'')+tagKurz(tage[b.i0])+': '+tip)}">${teile}</button>`;
  });
  return`<div class="pk-lage${pkSel&&pkSel.a===id?' sel':''}" data-pk="${lid}" style="--pk-w:${kw}px"><span class="pk-band" aria-hidden="true"></span>${h}<span class="pk-tipp" aria-hidden="true">Tap a day</span></div>`;
}

function pkKnopfBreite(breite,n,woche){const px=(breite||600)/Math.max(1,n)*(woche?5:1);return Math.max(8,Math.min(22,Math.floor(px-1)));}
function pkBreiteSetzen(){
  const el=pkLage();if(!el)return;const L=_pkReg[el.dataset.pk];if(!L)return;
  const w=el.getBoundingClientRect().width;if(w>0)el.style.setProperty('--pk-w',pkKnopfBreite(w,L.tage.length,L.woche)+'px');
}
// ── Spalte ───────────────────────────────────────────────────────────────
function pkKommend(id){
  const proTag=abCalNachTag(id),heute=todayStr(),out=[];
  const sicht=ev=>!calHighOnly||evtImpact(ev)==='high';
  Object.keys(proTag).sort().filter(d=>d>=heute).forEach(d=>{
    (proTag[d]||[]).filter(sicht).slice().sort((a,b)=>String(a.time||'').localeCompare(String(b.time||''))).forEach(ev=>{if(out.length<8&&!isEvtPast(ev))out.push(Object.assign({d},ev));});
  });
  return out;
}
// Countdown wie ueberall (countdownHtml, Nutzer-Regel 2026-09-14: "1d" statt "Tomorrow")
function wann(d,zeit){return countdownHtml(d)+(zeit&&/^\d/.test(zeit)?' · '+escH(zeit):'');}
const wert=v=>v!=null&&v!==''?escH(String(v)):'–';
// untenHtml: fertiges Markup (Countdown) oder Text (escH beim Aufrufer)
function karteHtml(e,untenHtml){
  const c=e.col==='act-good'?BC.bull:e.col==='act-bad'?BC.bear:'';
  return`<div class="pk-ev"${c?` style="--c:${c}"`:''}><div class="pk-ev-o"><span class="pk-ev-n">${escH(e.n)}</span><b class="pk-ev-a">${wert(e.a)}</b></div><div class="pk-ev-u">${untenHtml?`<span>${untenHtml}</span>`:''}<span>Forecast <b>${wert(e.f)}</b></span><span>Previous <b>${wert(e.p)}</b></span></div></div>`;
}
function pkSpalteHtml(id){
  if(pkForm&&pkForm.a===id&&pkForm.spalte)return'';
  const lid=Object.keys(_pkReg).filter(k=>_pkReg[k].a===id).pop(),L=lid?_pkReg[lid]:null;
  const b=pkSel&&pkSel.a===id&&L?L.B.get(pkSel.k):null;
  if(!b){
    const l=pkKommend(id);
    return`<div class="pk-col-hd"><span class="pk-col-t">Next up</span>${l.length?`<span class="pk-pill">${l.length}</span>`:''}</div>
      <div class="pk-list">${l.length?l.map(ev=>karteHtml({n:ev.name,a:ev.actual,f:ev.forecast,p:ev.previous,col:''},wann(ev.d,ev.time))).join(''):`<div class="pk-leer">Nothing ${calHighOnly?'high-impact ':''}scheduled in the published window.</div>`}</div>`;
  }
  const d0=L.tage[b.i0],d1=L.tage[b.i1],bw=pkBewegung(id,d0,d1);
  const f=v=>`<b style="color:${v>0?BC.bull:v<0?BC.bear:'var(--t1)'}">${pct(v)}</b>`;
  const titel=L.woche?`Week of ${tagKurz(b.k)}`:tagJahr(d0);
  const ev=b.ev.slice().sort((x,y)=>x.d.localeCompare(y.d));
  return`<div class="pk-col-hd"><span class="pk-col-t">${escH(titel)}</span>${ev.length?`<span class="pk-pill">${ev.length}</span>`:''}<button type="button" class="pk-x" onclick="pkWaehle(null)" title="Back to next up" aria-label="Back to next up">✕</button></div>
    <div class="pk-stat"><span>${L.woche?'Week':'Day'} ${f(bw.tag)}</span>${bw.nach!=null?`<span>Next 5D ${f(bw.nach)}</span>`:''}${ev.length?`<span><b style="color:${BC.bull}">▲${b.g}</b> <b style="color:${BC.bear}">▼${b.s}</b> <b>◆${b.n}</b></span>`:''}</div>
    <div class="pk-list">${ev.map(e=>karteHtml(e,L.woche?escH(tagKurz(e.d)):'')).join('')}${b.eig.map(n=>`<div class="pk-ev pk-ev-eig" style="--c:${bcol(n.bias)}"><div class="pk-ev-o"><span class="pk-mine">Mine</span><span class="pk-ev-n">${escH(n.title||'')}</span><button type="button" class="pk-del" onclick="pkEigenWeg('${escJH(n.id)}')" title="Delete this mark" aria-label="Delete this mark">✕</button></div><div class="pk-ev-u"><span style="color:${bcol(n.bias)};font-weight:800">${(BIAS.find(z=>z[0]===n.bias)||BIAS[1])[1]}</span>${L.woche?`<span>${escH(tagKurz(n.pm.d))}</span>`:''}</div></div>`).join('')}
      <button type="button" class="pk-neu" onclick="pkFormAuf('${escJH(d1)}')">＋ Mark this day</button></div>`;
}

// ── Bedienung ────────────────────────────────────────────────────────────
function pkKarte(){return document.querySelector('#detail .ab-ptile.pk');}
function pkLage(){const k=pkKarte();return k?k.querySelector('.pk-lage'):null;}
// Spalte tauschen, rein = von rechts (Tag), raus = von links (Next up)
function pkSpalteNeu(rein){
  const k=pkKarte(),c=getSym();if(!k||!c)return;
  const col=k.querySelector('.pk-col');if(!col)return;
  col.innerHTML=pkSpalteHtml(c.id);
  if(rein!==undefined&&col.animate)[...col.children].forEach(x=>{try{x.animate([{opacity:0,translate:`${rein?16:-16}px 0`},{opacity:1,translate:'0 0'}],{duration:240,easing:'cubic-bezier(.2,.8,.3,1)'});}catch(e){}});
}
// Auswahl in der Ebene: Pfeil gross, Rest blass, Band ueber den Tag(en)
function pkMarkiere(){
  const el=pkLage();if(!el)return;
  const L=_pkReg[el.dataset.pk];if(!L)return;
  const b=pkSel&&pkSel.a===L.a?L.B.get(pkSel.k):null;
  el.classList.toggle('sel',!!b);
  el.querySelectorAll('.pk-pf').forEach(p=>p.classList.toggle('on',!!b&&p.dataset.b===b.k));
  const band=el.querySelector('.pk-band');
  if(band&&b){
    const dx=L.tage.length>1?L.x(1)-L.x(0):0.02,x0=L.x(b.i0)-dx/2,x1=L.x(b.i1)+dx/2;
    band.style.left=(x0*100).toFixed(3)+'%';band.style.width=(Math.max(dx,x1-x0)*100).toFixed(3)+'%';
  }
}
function pkWaehle(k){
  const c=getSym();if(!c)return;
  const neu=k?{a:c.id,k:String(k)}:null;
  if(!neu&&!pkSel)return;
  if(neu&&pkSel&&pkSel.a===neu.a&&pkSel.k===neu.k)return;
  const rein=!!neu;pkSel=neu;pkForm=null;pkPopZu();
  pkMarkiere();pkSpalteNeu(rein);
}
// Pfeile ein/aus (Einstellung, synchronisiert - pkMarkenUmschalten in main.js)
function pkMarkenSchalter(){
  try{pkMarkenUmschalten();}catch(e){alert('The setting could not be saved: '+(e&&e.message||e));}
}
function pkAddUmschalten(){
  pkAdd=!pkAdd;pkForm=null;pkPopZu();
  const k=pkKarte();if(!k)return;
  k.classList.toggle('pk-add',pkAdd);
  const b=k.querySelector('.pk-add-btn');if(b){b.classList.toggle('on',pkAdd);b.setAttribute('aria-pressed',String(pkAdd));b.innerHTML=pkAdd?'✕ Cancel':'＋ Mark';}
}
// ── Popover fuer einen eigenen Pfeil (an der Kerze) ──
function pkFormAuf(d){
  const c=getSym();if(!c)return;
  pkForm={a:c.id,d,t:'',b:'neu'};pkAdd=false;
  const k=pkKarte();if(k){k.classList.remove('pk-add');const b=k.querySelector('.pk-add-btn');if(b){b.classList.remove('on');b.innerHTML='＋ Mark';}}
  pkPopZeichnen();
}
function pkPopZu(){const p=document.getElementById('pkPop');if(p)p.remove();}
function pkPopZeichnen(){
  pkPopZu();
  const k=pkKarte(),el=pkLage();if(!k||!el||!pkForm)return;
  const L=_pkReg[el.dataset.pk];if(!L)return;
  const i=naechsterTag(L.tage,pkForm.d);
  const p=document.createElement('div');p.id='pkPop';p.className='pk-pop';p.setAttribute('role','dialog');p.setAttribute('aria-label','New mark');
  p.innerHTML=`<div class="pk-pop-t">New mark · ${escH(tagJahr(pkForm.d))}</div>
    <input class="pk-in" id="pkIn" maxlength="80" placeholder="What happened" value="${escH(pkForm.t)}" oninput="pkFormText(this.value)" onkeydown="if(event.key==='Enter')pkSpeichern();if(event.key==='Escape')pkFormZu()">
    <div class="pk-pop-r">${BIAS.map(([b,l])=>`<button type="button" class="pk-rund${pkForm.b===b?' on':''}" style="--c:${bcol(b)}" onclick="pkFormBias('${b}',this)" title="${l}" aria-label="${l}" aria-pressed="${pkForm.b===b}">${PFEIL}</button>`).join('')}
      <button type="button" class="btn pk-ab" onclick="pkFormZu()">Cancel</button><button type="button" class="btn pk-ok" onclick="pkSpeichern()">Save</button></div>`;
  k.appendChild(p);
  // an die Kerze: ueber dem Tag, in der Karte gehalten
  const kr=k.getBoundingClientRect(),lr=el.getBoundingClientRect();
  const yy=i>=0?L.y(L.tage[i]):null,x=lr.left-kr.left+(i>=0?L.x(i):0.5)*lr.width,y=lr.top-kr.top+(yy==null?0.3:yy)*lr.height;
  const w=p.offsetWidth||290,links=Math.max(8,Math.min(kr.width-w-8,x-w/2));
  p.style.left=links+'px';
  const oben=y-p.offsetHeight-22;
  p.style.top=Math.max(8,oben)+'px';
  p.classList.toggle('unten',oben<8);
  p.style.setProperty('--ox',Math.max(18,Math.min(w-18,x-links))+'px');
  setTimeout(()=>{const inp=document.getElementById('pkIn');if(inp)inp.focus();},40);
}
function pkFormText(v){if(pkForm)pkForm.t=v;}
function pkFormBias(b,btn){if(!pkForm)return;pkForm.b=b;const r=btn&&btn.parentElement;if(r)r.querySelectorAll('.pk-rund').forEach(x=>{const on=x===btn;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});}
function pkFormZu(){pkForm=null;pkPopZu();}
// Speichern: eine normale Notiz mit pm (siehe Kopf). Kein Schreibpfad ohne
// try/catch mit sichtbarer Meldung (Regel 6) - scheitert es, bleibt das
// Popover mit dem Getippten offen.
function pkSpeichern(){
  const f=pkForm;if(!f)return;
  const inp=document.getElementById('pkIn');if(inp)f.t=inp.value;
  const t=String(f.t||'').trim();
  if(!t){if(inp){inp.focus();try{inp.animate([{translate:'-4px 0'},{translate:'4px 0'},{translate:'0 0'}],{duration:220});}catch(e){}}return;}
  try{
    pushU();
    const now=new Date().toISOString(),id=uid();
    research.notes.push({id,fids:[],title:t,body:'',tags:['chart'],fav:false,pin:false,arch:false,ts:now,up:now,bias:f.b,evt:null,asset:'',pm:{a:f.a,d:f.d}});
    save();
    pkForm=null;pkPopZu();
    const L=pkLage()&&_pkReg[pkLage().dataset.pk];
    pkSel={a:f.a,k:L&&L.woche?wocheVon(f.d):f.d};
    pkNeu=id;
    if(typeof window.renderDetail==='function')window.renderDetail();
  }catch(e){alert('The mark could not be saved: '+(e&&e.message||e));}
}
let pkNeu=null;   // gerade angelegt -> faellt einmal ins Bild
function pkEigenWeg(nid){
  const n=resNotes().find(x=>x&&x.id===nid&&x.pm);if(!n)return;
  // Wie resNoteToTrash: in den Papierkorb (30 Tage wiederherstellbar) UND aus
  // der Liste - trashResNote allein entfernt nichts. Den Loesch-Marker setzt
  // snap() (geloeschtFesthalten), damit kein anderes Geraet sie zurueckbringt.
  try{pushU();trashResNote(n);research.notes=resNotes().filter(x=>x.id!==nid);save();}
  catch(e){alert('The mark could not be deleted: '+(e&&e.message||e));return;}
  if(typeof window.renderDetail==='function')window.renderDetail();
}
// Klicks im Chart: Pfeil = waehlen, Leere = zurueck zu Next up,
// im Hinzufuegen-Modus = Tag waehlen.
document.addEventListener('click',e=>{
  const t=e.target;if(!t||!t.closest)return;
  const lage=t.closest('.pk-chart');if(!lage)return;
  if(t.closest('.pk-pop,.pv-lg'))return;
  const el=lage.querySelector('.pk-lage'),L=el&&_pkReg[el.dataset.pk];
  if(pkAdd&&L){
    const r=el.getBoundingClientRect(),fx=(e.clientX-r.left)/r.width;
    let best=0,bd=Infinity;L.tage.forEach((d,i)=>{const dd=Math.abs(L.x(i)-fx);if(dd<bd){bd=dd;best=i;}});
    pkFormAuf(L.tage[best]);return;
  }
  const pf=t.closest('.pk-pf');
  if(pf){e.stopPropagation();pkWaehle(pf.dataset.b);return;}
  if(pkSel)pkWaehle(null);
},true);
// Geist-Pfeil im Hinzufuegen-Modus
document.addEventListener('pointermove',e=>{
  if(!pkAdd)return;
  const t=e.target,ch=t&&t.closest&&t.closest('.pk-chart');
  const k=pkKarte();if(!k)return;
  let g=k.querySelector('.pk-geist');
  if(!ch){if(g)g.style.display='none';return;}
  const el=ch.querySelector('.pk-lage'),L=el&&_pkReg[el.dataset.pk];if(!L)return;
  const r=el.getBoundingClientRect(),fx=(e.clientX-r.left)/r.width;
  let best=0,bd=Infinity;L.tage.forEach((d,i)=>{const dd=Math.abs(L.x(i)-fx);if(dd<bd){bd=dd;best=i;}});
  if(!g){g=document.createElement('span');g.className='pk-geist';g.innerHTML=PFEIL;el.appendChild(g);}
  const gy=L.y(L.tage[best]);g.style.display=gy==null?'none':'';g.style.left=(L.x(best)*100)+'%';g.style.top=((gy==null?0:gy)*100)+'%';
},{passive:true});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(pkForm){pkFormZu();return;}
  if(pkAdd){pkAddUmschalten();return;}
  if(pkSel&&curPage==='cur'&&!document.querySelector('.modal-overlay[style*="flex"]'))pkWaehle(null);
});

// ── Vergleich: bis zu 2 Kurse dazu ───────────────────────────────────────
// Gruppen-Fenster wie Data · Compare all (dataAlleAssetGruppen), aber nur
// Kurse: Preis, 2Y/10Y-Rendite, FX-Paare, VIX - keine Indikatoren.
let _pkVglOffen=false,_pkVglAsset=null,_pkVglGruppe=null;
function pkVglListe(id){return pkVgl[id]||(pkVgl[id]=[]);}
function pkVglItems(a,id){
  return dataAlleItems(a).map(g=>({name:g.name,l:g.l.filter(x=>!/^i:/.test(x.k)&&x.k!=='p:'+id)})).filter(g=>g.l.length);
}
function _pkVglDaneben(e){const t=e.target;if(t&&t.closest&&t.closest('#pkVglPicker,#pkVglBtn'))return;pkVglZu();}
function pkVglZu(){
  _pkVglOffen=false;document.removeEventListener('pointerdown',_pkVglDaneben,true);
  const el=document.getElementById('pkVglPicker');if(el)el.remove();
  const b=document.getElementById('pkVglBtn');if(b)b.classList.remove('on');
}
function pkVglAuf(){
  if(_pkVglOffen){pkVglZu();return;}
  const c=getSym();if(!c)return;
  _pkVglOffen=true;
  if(!_pkVglAsset){const g=dataAlleAssetGruppen().find(x=>x.ids.includes(c.id));_pkVglAsset=g?(g.ids.find(x=>x!==c.id)||g.ids[0]):'USD';}
  pkVglZeichnen();
  setTimeout(()=>{if(_pkVglOffen)document.addEventListener('pointerdown',_pkVglDaneben,true);},0);
}
function pkVglAsset(a){_pkVglAsset=a;pkVglZeichnen();}
function pkVglGruppe(name){const g=dataAlleAssetGruppen().find(x=>x.name===name);if(!g)return;_pkVglGruppe=name;if(!g.ids.includes(_pkVglAsset))_pkVglAsset=g.ids[0];pkVglZeichnen();}
function pkVglUmschalten(k){
  const c=getSym();if(!c)return;
  const l=pkVglListe(c.id),i=l.indexOf(k);
  if(i>=0)l.splice(i,1);else if(l.length<PK_VGL_MAX)l.push(k);else return;
  pkSel=null;
  if(typeof window.renderDetail==='function')window.renderDetail();
  if(l.length>=PK_VGL_MAX)pkVglZu();else if(_pkVglOffen)setTimeout(pkVglZeichnen,0);
}
function pkVglWeg(k){const c=getSym();if(!c)return;const l=pkVglListe(c.id),i=l.indexOf(k);if(i<0)return;l.splice(i,1);pkSel=null;if(typeof window.renderDetail==='function')window.renderDetail();}
function pkVglSkalaSetzen(v){pkVglSkala=v==='bruch'?'bruch':'band';if(typeof window.renderDetail==='function')window.renderDetail();}
function pkVglZeichnen(){
  if(!_pkVglOffen)return;
  const c=getSym(),btn=document.getElementById('pkVglBtn');if(!c||!btn){pkVglZu();return;}
  btn.classList.add('on');
  let el=document.getElementById('pkVglPicker');
  if(!el){el=document.createElement('div');el.id='pkVglPicker';el.className='data-picker';el.setAttribute('role','dialog');el.setAttribute('aria-label','Compare');document.body.appendChild(el);}
  const l=pkVglListe(c.id),voll=l.length>=PK_VGL_MAX,a=_pkVglAsset;
  const gruppen=dataAlleAssetGruppen().filter(g=>g.ids.some(x=>pkVglItems(x,c.id).length));
  let gr=gruppen.find(g=>g.name===_pkVglGruppe&&g.ids.includes(a))||gruppen.find(g=>g.ids.includes(a))||gruppen[0];
  if(!gr){el.innerHTML='<div class="cmp-filter-none">No prices to compare.</div>';pickerAnkern(el,btn,true);return;}
  _pkVglGruppe=gr.name;
  const ids=gr.ids.filter(x=>pkVglItems(x,c.id).length),aa=ids.includes(a)?a:ids[0];_pkVglAsset=aa;
  const zeile=`<div class="dap-reihe" role="group" aria-label="Asset group">${gruppen.map(g=>`<button class="ind-hist-range-btn${g===gr?' on':''}" onclick="pkVglGruppe('${escJH(g.name)}')">${escH(g.name)}</button>`).join('')}</div>`
    +(ids.length>1||(ids[0]!=='PAIRS'&&ids[0]!=='VIX')?`<div class="dap-reihe" role="group" aria-label="Asset">${ids.map(x=>`<button class="cmp-chip${x===aa?' on':''}" onclick="pkVglAsset('${escJH(x)}')">${escH(x)}</button>`).join('')}</div>`:'');
  const items=pkVglItems(aa,c.id).map(g=>`<div class="data-picker-grp"><span class="cmp-filter-lbl">${escH(g.name)}</span><div class="cmp-filter-grp">${g.l.map(x=>{
    const an=l.includes(x.k);
    return`<button class="cmp-chip${an?' on':''}"${!an&&voll?' disabled':''} onclick="pkVglUmschalten('${escJH(x.k)}')" title="${escH(x.t)}">${escH(x.t)}</button>`;
  }).join('')}</div></div>`).join('');
  el.innerHTML=`<div class="data-picker-hd"><span>Compare with · <b>${escH(aa==='PAIRS'?'FX pairs':aa)}</b></span><b>${l.length}/${PK_VGL_MAX}</b></div>
    <div class="dap-assets">${zeile}</div>
    <div class="data-picker-body">${items||'<div class="cmp-filter-none">No prices for this asset.</div>'}</div>
    <div class="data-picker-ft">group → asset above · up to ${PK_VGL_MAX} prices · then the chart switches to lines</div>`;
  pickerAnkern(el,btn,true);
}
// Nach jedem Aufbau der Asset-Seite: Vergleichs-Chart in echter Breite
// zeichnen (preisChartHtml braucht Pixel), Auswahl wiederherstellen, ein
// neuer eigener Pfeil faellt einmal ins Bild.
function pkNachAufbau(){
  const k=pkKarte(),c=getSym();if(!k||!c)return;
  const ph=k.querySelector('[data-pk-vgl]');
  if(ph){
    const keys=['p:'+c.id].concat(pkVglListe(c.id));
    const W=Math.max(240,Math.round(ph.clientWidth)),H=Math.max(240,Math.round(ph.clientHeight)||300);
    const f=abFenster();
    ph.innerHTML=preisChartHtml(keys,W,H,{typ:'linie',skala:pkVglSkala,fenster:{von:f.max?null:f.von,bis:f.bis},weg:'pkVglWeg',fest:['p:'+c.id],zoom:'ab',kopf:pkMarkenAn?30:10,lage:api=>pkLageHtml(c.id,api)});
    try{attachChartHovers(ph);}catch(e){}
    ph.removeAttribute('data-pk-vgl');
  }
  pkBreiteSetzen();
  pkMarkiere();
  // Ein Neuaufbau (Feed-Update) ersetzt die Karte - ein offenes Popover kommt
  // mit dem schon Getippten (pkForm.t) wieder.
  if(pkForm&&pkForm.a===c.id&&!document.getElementById('pkPop'))pkPopZeichnen();
  // Im Vergleich entsteht die Pfeil-Ebene erst hier - die Spalte danach neu.
  const col=k.querySelector('.pk-col');if(col&&(ph||!col.innerHTML.trim()))col.innerHTML=pkSpalteHtml(c.id);
  if(pkNeu){
    const el=pkLage(),p=el&&el.querySelector(`.pk-pf.on`);
    if(p&&p.animate)try{p.animate([{translate:'-50% -140%',opacity:0},{translate:'-50% -100%',opacity:1}],{duration:520,easing:'cubic-bezier(.3,1.7,.5,1)'});}catch(e){}
    pkNeu=null;
  }
}
let _pkRt=0;
window.addEventListener('resize',()=>{clearTimeout(_pkRt);_pkRt=setTimeout(()=>{
  const k=pkKarte(),c=getSym();if(!k||!c||!pkVglListe(c.id).length)return;
  if(typeof window.renderDetail==='function')window.renderDetail();
},180);});

function pkVergleichAktiv(id){return pkVglListe(id).length>0;}
function pkVglSkalaWert(){return pkVglSkala;}
function pkZustand(){return{sel:pkSel,add:pkAdd,form:pkForm,vgl:JSON.parse(JSON.stringify(pkVgl)),skala:pkVglSkala};}

export {pkLageHtml,pkSpalteHtml,pkNachAufbau,pkVergleichAktiv,pkVglListe,pkVglSkalaWert,pkReleases,pkEimer,PFEIL,pkAddAktiv};
function pkAddAktiv(){return pkAdd;}
// Inline-Handler (onclick) brauchen die Funktionen am window.
Object.assign(window,{pkWaehle,pkMarkenSchalter,pkAddUmschalten,pkFormAuf,pkFormText,pkFormBias,pkFormZu,pkSpeichern,pkEigenWeg,
  pkVglAuf,pkVglAsset,pkVglGruppe,pkVglUmschalten,pkVglWeg,pkVglSkalaSetzen,pkZustand,pkReleases});
