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
const pctL=v=>(v*100).toFixed(3)+'%';   // Lage im Chart (left/top)
let pkSel=null;            // {a:Asset, k:Tag oder Wochenanfang}
let pkAdd=false;           // Hinzufuegen-Modus
let pkModus='next';        // Spalte ohne Auswahl: 'next' (Next up) | 'moves' (Biggest moves)
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
    // datumArt "ref" (Geldmenge der Zentralbanken, tools/geldmenge.mjs): die
    // Historie traegt das Monatsende des Bezugsmonats, nicht den Release - dort
    // stuende der Pfeil am falschen Tag. Nur der juengste Wert hat ein echtes
    // Release-Datum.
    const nurJuengster=!!(f&&f.datumArt==='ref'&&f.date&&f.actual!=null);
    const roh=nurJuengster?[[String(f.date).slice(0,10),String(f.actual),f.forecast==null?'':String(f.forecast)]]
      :f&&Array.isArray(f.historyFull)&&f.historyFull.length?f.historyFull.map(h=>[String(h[0]).slice(0,10),h[1]==null?'':String(h[1]),h[2]==null?'':String(h[2])])
      :(ind.chartHist||[]).map(p=>[String(p[0]).slice(0,10),p[1]==null?'':fmtIndVal(p[1],''),p[2]==null?'':fmtIndVal(p[2],'')]);
    roh.forEach((h,i)=>{
      if(!h[0]||h[1]===''||gesehen.has(h[0]))return;
      gesehen.add(h[0]);
      const ev={name:ind.name,actual:h[1],forecast:h[2],previous:i>0?roh[i-1][1]:(nurJuengster&&f.previous!=null?String(f.previous):'')};
      add(h[0],{n:nm,b:base,a:h[1],f:h[2],p:ev.previous,col:actualColor(ev,id)});
    });
    // Heute schon im Kalender, im Feed noch nicht (der Feed laeuft stuendlich).
    if(!m.nurTermin)(calEvts||[]).forEach(ev=>{
      if(!ev||!ev.actual||!ev.date||gesehen.has(ev.date))return;
      if(!evtMatchesSym(ev,ccy)||!m(ev.name,ccy))return;
      gesehen.add(ev.date);
      add(ev.date,{n:nm,b:base,a:ev.actual,f:ev.forecast||'',p:ev.previous||'',col:actualColor({name:ind.name,actual:ev.actual,forecast:ev.forecast,previous:ev.previous},id)});
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
// ── EREIGNIS-BAND UNTER DEM CHART (2026-11-11) ──────────────────────────
// Nutzer (nach drei Entwuerfen A/B/C, VERSION-CHECK-713): "ich will ein anderes
// band. Der nutzen soll ja sein das ich besser weis was in der Vergangenheit
// war worauf der Markt da reagiert hat. Ich will ein Band mit drei Farben eine
// fuer jede Kategorie also Inflation Arbeitsmarkt und Wirtschaftswachstum. Fuer
// Inflation nur bei cpis dann ppis und pce und bei Labour ... nur fuer nfp und
// unemployment rate und fuer Wirtschaft ... nur gdp und pmis. Und noch eine
// Farbe fuer die interest rate und ... eine eigene Farbe ... wo ich Ereignisse
// hinzufuegen kann. Und wenn man auf einen Teil des Bands klickt soll man sehen
// was da passiert ist."
// Ein Streifen am unteren Chartrand: je Tag (bei Wochen-Pfeilen je Woche) ein
// Feld, wenn dort eine der Reihen veroeffentlicht wurde oder eine eigene
// Markierung steht. Mehrere Kategorien am selben Tag teilen sich das Feld.
// Tipp = derselbe Tag wie beim Pfeil (pkMoveWaehle): Tageskarte mit Releases,
// Bewegung, S&P 500 und Rendite. Eigene Ereignisse = "+ Mark" (Notiz mit pm).
const PK_BAND_KAT=[
  ['infl','Inflation','var(--a-infl)',['CPI','CPI (Headline)','Core CPI','PPI','Core PPI','PCE','Core PCE']],
  ['lab','Labour market','var(--a-lab)',['NFP / Employment Change','Unemployment Rate']],
  ['grow','Growth','var(--tb-grow)',['GDP Growth QoQ','Manufacturing PMI','Services PMI']],
  ['rate','Interest rate','var(--a-rate)',['Central Bank Rate']],
  ['own','Own events','var(--tb-own)',[]]];
const _pkBandVon=new Map();PK_BAND_KAT.forEach(k=>k[3].forEach(b=>_pkBandVon.set(b,k[0])));
// ⚠ Seit 2026-11-15 AUS (Nutzer: "Dieser Balken unten ist bloed und muss weg"). Die Funktion
// bleibt fuer die Historie, liefert aber nichts mehr; Legende ebenso. check/moves.js D prueft das.
const PK_BAND_AN=false;
function pkBandHtml(id,api,tage,B,woche){
  if(!PK_BAND_AN||tage.length<2)return'';
  const dx=tage.length>1?api.x(1)-api.x(0):0.02;
  let h='';
  B.forEach(b=>{
    const kat=new Set();
    b.ev.forEach(e=>{const k=_pkBandVon.get(e.b);if(k)kat.add(k);});
    if(b.eig.length)kat.add('own');
    if(!kat.size||b.i1<0)return;
    const liste=PK_BAND_KAT.filter(k=>kat.has(k[0]));
    const x0=api.x(b.i0)-dx/2,x1=api.x(b.i1)+dx/2;
    const namen=liste.map(k=>k[1]).join(' · ');
    h+=`<button type="button" class="pk-tb-f${pkSel&&pkSel.a===id&&pkSel.k===b.k?' on':''}" data-b="${escH(b.k)}" data-kat="${liste.map(k=>k[0]).join(' ')}" style="left:${(x0*100).toFixed(3)}%;width:${(Math.max(dx,x1-x0)*100).toFixed(3)}%" onclick="pkMoveWaehle('${escJH(b.k)}')" title="${escH((woche?'Week of ':'')+tagKurz(tage[b.i0])+' · '+namen)}" aria-label="${escH((woche?'Week of ':'')+tagKurz(tage[b.i0])+': '+namen)}">${liste.map(k=>`<i style="background:${k[2]}"></i>`).join('')}</button>`;
  });
  return`<span class="pk-tb">${h}</span>`;
}
function pkBandLegende(){
  if(!PK_BAND_AN)return'';
  return`<span class="pk-tb-leg">${PK_BAND_KAT.map(k=>`<span class="pk-tb-lg"><i style="background:${k[2]}"></i>${k[1]}</span>`).join('')}</span>`;
}
// ── Eigene Notizen als Flagge im Chart (B1, Nutzerwahl 2026-11-15: "in den Chart reinschreiben
// ... zB bei nvidia ceo affairs, he resigns as ceo"). Gestrichelte Linie ueber die ganze Hoehe,
// oben eine Flagge mit Datum + Titel + erster Zeile, Farbe = Bias der Notiz. Nah beieinander
// liegende Flaggen weichen in eine zweite/dritte Reihe aus; rechts klappen sie nach links.
// Eigene Notizen als Callout (seit 739, vorher Flagge B1): Punkt auf der Kerzenmitte, Linie,
// Kasten mit Rahmen in Bias-Farbe. Kasten an Datum pm.bd (+ Versatz pm.bo) und Preis pm.bp;
// alte Notizen ohne Ort: rechts oberhalb der Kerze. Tipp auf den Kasten = Notiz-Fenster.
function pkFlaggenHtml(id,api,tage,B){
  const liste=[];
  B.forEach(b=>{if(!b.eig.length||b.i1<0)return;b.eig.forEach(nt=>liste.push({nt,b}));});
  if(!liste.length)return'';
  let lin='',dots='',boxen='';
  const ym=d=>api.ym?api.ym(d):api.y(d),kl=(v,a,z)=>Math.max(a,Math.min(z,v));
  liste.forEach(({nt,b},n)=>{
    const pm=nt.pm||{};
    let i=naechsterTag(tage,pm.d);if(i<0)return;
    const ax=api.x(i),ay=ym(tage[i]);if(ay==null)return;
    let bx,by;
    const bi=pm.bd?naechsterTag(tage,pm.bd):-1;
    if(bi>=0)bx=api.x(bi)+(+pm.bo||0);
    else if(pm.bd&&tage.length)bx=pm.bd<tage[0]?0.04:0.96;
    else bx=ax>0.7?ax-0.12:ax+0.12;
    if(pm.bp!=null&&api.yv)by=api.yv(+pm.bp);else if(pm.by!=null)by=+pm.by;else by=ay-0.22-(n%3)*0.1;
    bx=kl(bx,0.03,0.97);by=kl(by,0.06,0.94);
    const txt=String(nt.title||'').trim()||'Note',tip=tagKurz(tage[i])+' · '+txt+(nt.body?' · '+String(nt.body).replace(/\s+/g,' ').slice(0,60):'');
    lin+=`<line x1="${(ax*100).toFixed(3)}" y1="${(ay*100).toFixed(3)}" x2="${(bx*100).toFixed(3)}" y2="${(by*100).toFixed(3)}" vector-effect="non-scaling-stroke"/>`;
    dots+=`<span class="pk-nt-dot" style="left:${pctL(ax)};top:${pctL(ay)}" aria-hidden="true"></span>`;
    boxen+=`<button type="button" class="pk-nt${bx>0.8?' re':bx<0.2?' li':''}" data-nt="${escH(nt.id)}" style="left:${pctL(bx)};top:${pctL(by)};--c:${bcol(nt.bias)}" title="${escH(tip)}" onclick="event.stopPropagation();pkNotizAuf('${escJH(nt.id)}')">${escH(txt)}</button>`;
  });
  return`<svg class="pk-nt-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lin}</svg>${dots}${boxen}`;
}
// Spaeter tippen: das Notiz-Fenster (Text, Bias, Loeschen - mit Nachfrage bei Ungespeichertem)
function pkNotizAuf(nid){try{if(typeof window.openResNote==='function')window.openResNote(nid);}catch(e){alert('The note could not be opened: '+(e&&e.message||e));}}
function pkLageHtml(id,api){
  const lid='pk'+(++_pkSeq),tage=api.tage||[];
  if(tage.length<2)return'';
  const woche=api.breite/tage.length<PK_WOCHE_PX;
  const B=pkEimer(id,tage,woche);
  _pkReg[lid]={a:id,tage,x:api.x,y:api.y,ym:api.ym,yv:api.yv,pv:api.pv,B,woche};
  // Alte Lagen abraeumen (gleiche Idee wie chvAufraeumen)
  Object.keys(_pkReg).forEach(k=>{if(k!==lid&&+k.slice(2)<_pkSeq-6)delete _pkReg[k];});
  // ⚠ Release-Pfeile ENTFERNT (Nutzer 2026-11-16: "die Marker komplett entfernst aus der
  // Preiskarte ... wenn man ueber den Preis drueber hovert oder mit dem Finger drueber geht
  // ... dass dann links in dem Kasten die Nachrichten von genau diesem Tag drinne stehen").
  // Die Ebene bleibt: sie traegt die Tages-Eimer (pkEimer) fuer Hover/Finger, das Band
  // ueber dem gewaehlten Tag und die eigenen Notizen.
  return`<div class="pk-lage${pkSel&&pkSel.a===id?' sel':''}" data-pk="${lid}"><span class="pk-band" aria-hidden="true"></span>${pkBandHtml(id,api,tage,B,woche)}${pkFlaggenHtml(id,api,tage,B)}<span class="pk-tipp" aria-hidden="true">Tap a day</span></div>`;
}

function pkKnopfBreite(breite,n,woche){const px=(breite||600)/Math.max(1,n)*(woche?5:1);return Math.max(8,Math.min(22,Math.floor(px-1)));}
function pkBreiteSetzen(){
  const el=pkLage();if(!el)return;const L=_pkReg[el.dataset.pk];if(!L)return;
  const w=el.offsetWidth;if(w>0)el.style.setProperty('--pk-w',pkKnopfBreite(w,L.tage.length,L.woche)+'px');
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
// ── BIGGEST MOVES (2026-11-11) ──────────────────────────────────────────
// Nutzer 2026-11-10: "was fuer eine Loesung gibt es bei den Assets auf einen
// Blick zu haben warum die sich in der Vergangenheit bewegt haben". Die Pfeile
// zeigen nur Datentage, und jeden muss man einzeln antippen. Hier: die
// groessten Bewegungen im SICHTBAREN Zeitraum (je Tag, bei Wochen-Pfeilen je
// Woche) als Liste - je Zeile die Bewegung und was an dem Tag veroeffentlicht
// wurde; Tipp waehlt den Tag (auch ohne Release), die Tageskarte nennt dazu
// S&P 500 und die Rendite. ⚠ Gleichzeitigkeit, keine Ursache: die Liste sagt,
// was an dem Tag war - "Why" behauptet nur eine eigene Markierung.
const PK_MOVES_N=8;
const PK_RENDITE={USD:'USYIELD',EUR:'DEYIELD',GBP:'GBYIELD',CHF:'CHYIELD',JPY:'JPYIELD',CAD:'CAYIELD',AUD:'AUYIELD',NZD:'NZYIELD'};
function pkBewegungen(id,L){
  if(!L||!L.tage||!L.tage.length)return[];
  const k=pkSchluesse(id);if(k.length<2)return[];
  const idx=new Map(k.map((x,i)=>[x.d,i])),G=new Map();
  L.tage.forEach((d,i)=>{const key=L.woche?wocheVon(d):d;let g=G.get(key);if(!g){g={k:key,i0:i,i1:i,d0:d,d1:d};G.set(key,g);}g.i1=i;g.d1=d;});
  const out=[];
  G.forEach(g=>{const a=idx.get(g.d0),e=idx.get(g.d1);if(a==null||e==null||a<1)return;const vor=k[a-1].c;if(!vor)return;
    out.push(Object.assign(g,{v:k[e].c/vor-1,b:L.B.get(g.k)||null}));});
  return out.filter(x=>isFinite(x.v)&&x.v!==0).sort((x,y)=>Math.abs(y.v)-Math.abs(x.v)).slice(0,PK_MOVES_N);
}
// Was am selben Tag sonst lief: S&P 500 und die eigene Rendite (verknuepfte
// Waehrung; Nicht-FX = USD). Nur wo beide Schlusskurse da sind.
function pkUmfeld(id,d0,d1){
  const out=[];
  if(id!=='SP500'){const b=pkBewegung('SP500',d0,d1);if(b.tag!=null)out.push(['S&P 500',pct(b.tag),b.tag]);}
  const ry=PK_RENDITE[macroCcyFor(id)]||'USYIELD';
  if(ry!==id){const k=pkSchluesse(ry),i0=naechsterTag(k.map(x=>x.d),d0);
    if(i0>0&&k[i0].d===d0){let i1=i0;while(i1+1<k.length&&k[i1+1].d<=d1)i1++;const bp=(k[i1].c-k[i0-1].c)*100;
      if(isFinite(bp)){const nm=(syms.find(x=>x.id===ry)||{}).name||ry;out.push([nm,(bp>0?'+':'')+bp.toFixed(1)+' bp',bp]);}}}
  return out;
}
// Event-Liste der Price-Karte scrollt erst nach einem Tipp (762, Nutzer 2026-11-18: "mach das man
// erst auf die Events klicken muss bevor man sie scrollen kann"); Tipp daneben sperrt wieder.
document.addEventListener('pointerdown',e=>{
  const col=e.target&&e.target.closest?e.target.closest('.pk-col'):null;
  document.querySelectorAll('.pk-col.pk-scroll').forEach(c=>{if(c!==col)c.classList.remove('pk-scroll');});
  if(col)col.classList.add('pk-scroll');
},true);
function pkModusSetzen(m){pkModus=m==='moves'?'moves':'next';pkSel=null;pkHover=null;pkMarkiere();pkSpalteNeu();}
// ── Fahren ueber den Chart (Nutzer 2026-11-15: "wenn man ueber den Chart hovert das links in
// dem Kasten die News Events von dem Tag stehen"). Nur Maus (auf Touch waehlt der Tipp den Tag).
// Tage ohne Release bekommen einen leeren Eimer wie in pkMoveWaehle - die Karte zeigt dann
// die Tagesbewegung und "no releases". Verlassen = zurueck zu Next up / Biggest moves.
let pkHover=null;
function pkEimerFuer(L,k){
  if(!L.B.has(k)){let i0=1e9,i1=-1;L.tage.forEach((d,i)=>{if((L.woche?wocheVon(d):d)===k){i0=Math.min(i0,i);i1=Math.max(i1,i);}});if(i1<0)return false;L.B.set(k,{k,ev:[],eig:[],i0,i1,g:0,s:0,n:0,bias:'neu'});}
  return true;
}
function pkHoverSetzen(a,k){
  if((pkHover&&pkHover.a)===a&&(pkHover&&pkHover.k)===k)return;
  if(!a&&!pkHover)return;
  pkHover=a&&k?{a,k}:null;
  if(!pkSel)pkSpalteNeu();
}
function pkTagAn(e){
  const lage=pkLage();if(!lage)return null;const L=_pkReg[lage.dataset.pk];if(!L||!L.tage.length)return null;
  const r=lage.getBoundingClientRect();if(!r.width)return null;const f=(e.clientX-r.left)/r.width;
  if(f<0||f>1)return null;
  let bi=0,bd=1e9;for(let i=0;i<L.tage.length;i++){const d=Math.abs(L.x(i)-f);if(d<bd){bd=d;bi=i;}}
  const k=L.woche?wocheVon(L.tage[bi]):L.tage[bi];
  return pkEimerFuer(L,k)?{L,k}:null;
}
// Maus: Fahren zeigt den Tag. Finger: Ziehen ueber den Chart zeigt den Tag (touch-action
// pan-y: waagrecht = Tag, senkrecht = Seite scrollen), Loslassen laesst ihn stehen.
function pkHoverAnbinden(){
  const el=pkLage();if(!el||el.__hov)return;el.__hov=1;
  const box=el.closest('.ab-pk-chart')||el.parentElement;
  // ⚠ Finger: Spalte folgt touchmove, NICHT pointermove (2026-11-22, VERSION-CHECK-789).
  // Gemessen: Wischen mit kurzem senkrechten Anteil -> der Browser uebernimmt die Geste,
  // schickt pointercancel und danach keine pointermove mehr (2 statt 12), touchmove laeuft
  // weiter. Der Tooltip (chartHoverWrap) haengt an touchmove und lief bis Sep 17, die
  // Spalte blieb bei "Week of Mon, Jun 1" stehen. Beide jetzt aus derselben Quelle.
  const finger=cx=>{
    if(pkAdd)return;
    const t=pkTagAn({clientX:cx});if(!t)return;
    pkHover=null;if(!(pkSel&&pkSel.k===t.k))pkWaehle(t.k,true);
  };
  box.addEventListener('pointermove',e=>{
    if(pkAdd||e.pointerType!=='mouse')return;
    const t=pkTagAn(e);
    pkHoverSetzen(t?t.L.a:null,t?t.k:null);
  });
  box.addEventListener('touchstart',e=>{const t=e.touches[0];if(t)finger(t.clientX);},{passive:true});
  box.addEventListener('touchmove',e=>{const t=e.touches[0];if(t)finger(t.clientX);},{passive:true});
  box.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')pkHoverSetzen(null);});
}
function pkMoveWaehle(k){
  const c=getSym();if(!c)return;
  const lid=Object.keys(_pkReg).filter(x=>_pkReg[x].a===c.id).pop(),L=lid?_pkReg[lid]:null;if(!L)return;
  if(!L.B.has(k)){   // Tag ohne Release: leerer Eimer, damit Band und Tageskarte greifen
    let i0=1e9,i1=-1;L.tage.forEach((d,i)=>{if((L.woche?wocheVon(d):d)===k){i0=Math.min(i0,i);i1=Math.max(i1,i);}});
    if(i1<0)return;
    L.B.set(k,{k,ev:[],eig:[],i0,i1,g:0,s:0,n:0,bias:'neu'});
  }
  pkWaehle(k);
}
function pkSpalteHtml(id){
  if(pkForm&&pkForm.a===id&&pkForm.spalte)return'';
  const lid=Object.keys(_pkReg).filter(k=>_pkReg[k].a===id).pop(),L=lid?_pkReg[lid]:null;
  // Fahren ueber den Chart zeigt den Tag (pkHover), eine Auswahl per Tipp hat Vorrang.
  const selK=pkSel&&pkSel.a===id?pkSel.k:(pkHover&&pkHover.a===id?pkHover.k:null);
  const b=selK&&L?L.B.get(selK):null;
  // 762: "Biggest moves" entfernt (Nutzer 2026-11-18: "entfern die biggest movers") - nur noch Next up
  const tabs=`<span class="pk-col-t">Next up</span>`;
  if(!b){
    const l=pkKommend(id);
    return`<div class="pk-col-hd">${tabs}${l.length?`<span class="pk-pill">${l.length}</span>`:''}</div>
      <div class="pk-list">${l.length?l.map(ev=>karteHtml({n:ev.name,a:ev.actual,f:ev.forecast,p:ev.previous,col:''},wann(ev.d,ev.time))).join(''):`<div class="pk-leer">Nothing ${calHighOnly?'high-impact ':''}scheduled in the published window.</div>`}</div>`;
  }
  const d0=L.tage[b.i0],d1=L.tage[b.i1],bw=pkBewegung(id,d0,d1);
  const f=v=>`<b style="color:${v>0?BC.bull:v<0?BC.bear:'var(--t1)'}">${pct(v)}</b>`;
  const titel=L.woche?`Week of ${tagKurz(b.k)}`:tagJahr(d0);
  const ev=b.ev.slice().sort((x,y)=>x.d.localeCompare(y.d));
  return`<div class="pk-col-hd"><span class="pk-col-t">${escH(titel)}</span>${ev.length?`<span class="pk-pill">${ev.length}</span>`:''}<button type="button" class="pk-x" onclick="pkWaehle(null)" title="Back to next up" aria-label="Back to next up">✕</button></div>
    ${/* Prozent-Chips (Week/Next 5D/Umfeld/Zaehler) entfernt - Nutzer 2026-11-17 */''}
    <div class="pk-list">${ev.length||b.eig.length?'':`<div class="pk-leer">No releases ${L.woche?'this week':'on this day'}</div>`}${ev.map(e=>karteHtml(e,L.woche?escH(tagKurz(e.d)):'')).join('')}${b.eig.map(n=>`<div class="pk-ev pk-ev-eig" style="--c:${bcol(n.bias)}"><div class="pk-ev-o"><span class="pk-mine">Mine</span><span class="pk-ev-n">${escH(n.title||'')}</span><button type="button" class="pk-del" onclick="pkEigenWeg('${escJH(n.id)}')" title="Delete this mark" aria-label="Delete this mark">✕</button></div><div class="pk-ev-u"><span style="color:${bcol(n.bias)};font-weight:800">${(BIAS.find(z=>z[0]===n.bias)||BIAS[1])[1]}</span>${L.woche?`<span>${escH(tagKurz(n.pm.d))}</span>`:''}</div></div>`).join('')}
</div>`;
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
function pkWaehle(k,still){
  const c=getSym();if(!c)return;
  const neu=k?{a:c.id,k:String(k)}:null;
  if(!neu&&!pkSel)return;
  if(neu&&pkSel&&pkSel.a===neu.a&&pkSel.k===neu.k)return;
  const rein=!!neu;pkSel=neu;pkForm=null;pkPopZu();
  pkMarkiere();pkSpalteNeu(still?undefined:rein);
}
// Pfeile ein/aus (Einstellung, synchronisiert - pkMarkenUmschalten in main.js)
function pkMarkenSchalter(){
  try{pkMarkenUmschalten();}catch(e){alert('The setting could not be saved: '+(e&&e.message||e));}
}
// ══ NOTIZ IN DEN CHART SCHREIBEN (Nutzer 2026-11-16, VERSION-CHECK-739) ══════
// "auf ... Plus, Mark ... drueckt ... dann kommt ein Punkt in die Mitte des Charts, den man
// bewegen kann. Auf die Mitte einer Kerze immer verschiebt er sich. Dann drueckt man darauf
// als Bestaetigung ... dann ... zieht sich eine Linie raus und dann waehlt man einen zweiten
// Ort und dann oeffnet sich ein Textfeld wo man auswaehlt bullish bearish und den Inhalt
// reinschreibt ... Umrandungsfarbe ... Bias Farbe. Dann drueckt man auf Done ... Wenn man
// spaeter nochmal auf das Textfeld klickt, oeffnet sich ein Fenster, wo man es bearbeiten
// kann und loeschen kann." Vorlage: Screenshot (TradingView-Callout: Punkt auf der Kerze,
// duenne Linie, abgerundeter Kasten).
// Ablauf in pkForm.phase: 'punkt' (ziehen, rastet auf der Kerzenmitte ein; Tipp = bestaetigen)
// -> 'linie' (Linie folgt Maus/Finger; Tipp = Ort des Kastens) -> 'text' (Kasten mit
// Bullish|Bearish, Text, Done). Gespeichert: Notiz mit pm:{a,d,bd,bp} - der Kasten haengt an
// Datum bd und Preis bp und wandert mit Zeitraum/Zoom mit. Spaeter: Tipp auf den Kasten oeffnet
// das Notiz-Fenster (Bearbeiten, Bias, Loeschen).
function pkL(){const el=pkLage();return el?_pkReg[el.dataset.pk]:null;}
function pkNaechster(L,fx){let bi=0,bd=1e9;for(let i=0;i<L.tage.length;i++){const d=Math.abs(L.x(i)-fx);if(d<bd){bd=d;bi=i;}}return bi;}
function pkMitte(L,d){const v=L.ym?L.ym(d):L.y(d);return v==null?null:v;}
function pkAddUmschalten(){if(pkForm)pkMarkAbbruch();else pkFormAuf(null);}
function pkKnopf(an){
  const k=pkKarte();if(!k)return;
  k.classList.toggle('pk-add',an);
  const b=k.querySelector('.pk-add-btn');if(b){b.classList.toggle('on',an);b.setAttribute('aria-pressed',String(an));b.innerHTML=an?'✕ Cancel':'＋ Mark';}
}
// Start: Punkt in der Mitte des Charts (oder am uebergebenen Tag)
function pkFormAuf(d){
  const c=getSym(),L=pkL();if(!c||!L)return;
  const i=d?Math.max(0,naechsterTag(L.tage,d)):pkNaechster(L,0.5);
  pkForm={a:c.id,phase:'punkt',i,d:L.tage[i],fx:null,fy:null,t:'',b:'neu'};
  pkAdd=true;pkHover=null;pkKnopf(true);pkPopZeichnen();
}
function pkMarkAbbruch(){pkForm=null;pkAdd=false;pkPopZu();pkKnopf(false);}
function pkPopZu(){const el=pkLage();if(el)el.querySelectorAll('.pk-mk').forEach(x=>x.remove());const p=document.getElementById('pkPop');if(p)p.remove();}
function pkPopZeichnen(){
  pkPopZu();
  const el=pkLage(),L=pkL(),f=pkForm;if(!el||!L||!f)return;
  const i=Math.max(0,Math.min(L.tage.length-1,f.i));f.d=L.tage[i];
  const ax=L.x(i),ay=pkMitte(L,f.d);if(ay==null)return;
  const w=document.createElement('div');w.className='pk-mk';
  let h=`<svg class="pk-nt-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${f.fx!=null?`<line x1="${ax*100}" y1="${ay*100}" x2="${f.fx*100}" y2="${f.fy*100}" vector-effect="non-scaling-stroke"/>`:''}</svg>`;
  h+=`<span class="pk-nt-dot pk-mk-dot${f.phase==='punkt'?' zieh':''}" id="pkMkDot" style="left:${pctL(ax)};top:${pctL(ay)}" role="button" tabindex="0" aria-label="Candle ${escH(tagKurz(f.d))} - tap to confirm" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pkPunktOk();}"></span>`;
  // Nutzer 2026-11-16: "den Punkt von ueberall bewegen ohne das ich meinen Finger auf dem
  // Punkt habe ... das platzieren des Textes muss fluessiger sein und beweglich in alle
  // Richtungen" -> Ziehen irgendwo im Chart bewegt Punkt bzw. Kasten mit (pkGeste).
  if(f.phase==='punkt')h+=`<span class="pk-mk-hint"><span>Drag anywhere · snaps to candles</span><button type="button" class="pk-mk-weiter" onclick="pkPunktOk()">Next</button></span>`;
  if(f.phase==='linie'){
    h+=`<span class="pk-nt pk-mk-box" id="pkMkBox" style="left:${pctL(f.fx)};top:${pctL(f.fy)}">Your note</span>`;
    h+=`<span class="pk-mk-hint"><span>Drag anywhere to place the note</span><button type="button" class="pk-mk-weiter" onclick="pkLinieOk()">Write note</button></span>`;
  }
  w.innerHTML=h;el.appendChild(w);
  if(f.phase==='text'){
    const p=document.createElement('div');p.id='pkPop';p.className='pk-nt pk-nt-ed';p.setAttribute('role','dialog');p.setAttribute('aria-label','New note');
    p.style.cssText=`left:${pctL(f.fx)};top:${pctL(f.fy)};--c:${bcol(f.b)}`;
    p.innerHTML=`<div class="pk-ed-r"><span class="pk-ed-d">${escH(tagKurz(f.d))}</span>
      <span class="pk-ed-sw" role="group" aria-label="Bias">${[['bull','Bullish'],['bear','Bearish']].map(([b,l])=>`<button type="button" class="pk-rund${f.b===b?' on':''}" data-b="${b}" style="--c:${bcol(b)}" onclick="pkFormBias('${b}',this)" aria-pressed="${f.b===b}">${l}</button>`).join('')}</span></div>
      <textarea class="pk-in" id="pkIn" rows="2" maxlength="160" placeholder="What happened" oninput="pkFormText(this.value)" onkeydown="if(event.key==='Escape')pkFormZu()">${escH(f.t)}</textarea>
      <div class="pk-ed-r"><button type="button" class="btn pk-ab" onclick="pkFormZu()">Cancel</button><button type="button" class="btn pk-ok" onclick="pkSpeichern()">Done</button></div>`;
    el.appendChild(p);
    // im Chart halten (Kasten ~ 230 px): Mitte auf den Tipp, an den Raendern eingerueckt
    const lr={width:el.offsetWidth,height:el.offsetHeight},pw=p.offsetWidth,ph=p.offsetHeight;   // Seiten-Pixel (Zoom-fest, 751)
    const lx=Math.max(pw/2+4,Math.min(lr.width-pw/2-4,f.fx*lr.width)),ly=Math.max(ph/2+4,Math.min(lr.height-ph/2-4,f.fy*lr.height));
    p.style.left=lx+'px';p.style.top=ly+'px';
    setTimeout(()=>{const inp=document.getElementById('pkIn');if(inp)inp.focus();},40);
  }
}
// ── Geste beim Markieren (seit 740): Ziehen IRGENDWO im Chart ─────────────────
// Phase 'punkt': der Punkt wandert relativ zur Fingerbewegung mit und rastet auf der
// Kerzenmitte ein (der Finger verdeckt ihn nicht). Tipp auf den Punkt / "Next" = weiter,
// Tipp daneben = Punkt springt auf diese Kerze.
// Phase 'linie': der Vorschau-Kasten wandert frei in alle Richtungen mit (kein Einrasten,
// je Bild einmal gezeichnet). Tipp auf den Kasten / "Write note" = Text, Tipp daneben =
// Kasten springt dorthin. Waehrend des Markierens scrollt die Seite nicht (touch-action:none).
function pkPunktOk(){if(!pkForm||pkForm.phase!=='punkt')return;
  const L=pkL();if(!L)return;const ax=L.x(pkForm.i),ay=pkMitte(L,pkForm.d)||0.5;
  pkForm.phase='linie';pkForm.fx=Math.max(0.08,Math.min(0.92,ax+(ax>0.65?-0.18:0.18)));pkForm.fy=Math.max(0.1,Math.min(0.9,ay<0.32?ay+0.22:ay-0.22));
  pkPopZeichnen();}
function pkLinieOk(){if(!pkForm||pkForm.phase!=='linie')return;pkForm.phase='text';pkPopZeichnen();}
const pkKl=(v,a,z)=>Math.max(a,Math.min(z,v));
function pkMarkDom(){
  const el=pkLage(),L=pkL(),f=pkForm;if(!el||!L||!f)return;
  const ax=L.x(f.i),ay=pkMitte(L,f.d);if(ay==null)return;
  const dot=document.getElementById('pkMkDot');if(dot){dot.style.left=pctL(ax);dot.style.top=pctL(ay);dot.setAttribute('aria-label','Candle '+tagKurz(f.d)+' - tap to confirm');}
  if(f.phase==='linie'){
    const bx=document.getElementById('pkMkBox');if(bx){bx.style.left=pctL(f.fx);bx.style.top=pctL(f.fy);}
    const sv=el.querySelector('.pk-mk svg');if(sv)sv.innerHTML=`<line x1="${ax*100}" y1="${ay*100}" x2="${f.fx*100}" y2="${f.fy*100}" vector-effect="non-scaling-stroke"/>`;
  }
}
let _pkG=null,_pkRaf=0;
document.addEventListener('pointerdown',e=>{
  const f=pkForm;if(!f||(f.phase!=='punkt'&&f.phase!=='linie'))return;
  const t=e.target;if(!t||!t.closest||!t.closest('.ab-ptile.pk .pk-chart')||t.closest('#pkPop,.pk-mk-hint'))return;
  const el=pkLage(),L=pkL();if(!el||!L)return;
  const r=el.getBoundingClientRect();if(!r.width)return;
  e.preventDefault();
  _pkG={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height,l:r.left,o:r.top,fx0:f.phase==='punkt'?L.x(f.i):f.fx,fy0:f.fy,
    aufPunkt:!!t.closest('#pkMkDot'),aufKasten:!!t.closest('#pkMkBox'),bewegt:false};
},true);
document.addEventListener('pointermove',e=>{
  const g=_pkG,f=pkForm;if(!g||!f||e.pointerId!==g.id)return;
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(!g.bewegt&&Math.abs(dx)+Math.abs(dy)<6)return;
  g.bewegt=true;e.preventDefault();
  const L=pkL();if(!L)return;
  if(f.phase==='punkt'){const i=pkNaechster(L,g.fx0+dx/g.w);if(i!==f.i&&pkMitte(L,L.tage[i])!=null){f.i=i;f.d=L.tage[i];}}
  else{f.fx=pkKl(g.fx0+dx/g.w,0.02,0.98);f.fy=pkKl(g.fy0+dy/g.h,0.04,0.96);}
  if(!_pkRaf)_pkRaf=requestAnimationFrame(()=>{_pkRaf=0;pkMarkDom();});
},{passive:false});
const pkGesteEnde=e=>{
  const g=_pkG,f=pkForm;if(!g||e.pointerId!==g.id)return;_pkG=null;if(!f||g.bewegt)return;
  // Tipp ohne Ziehen
  const L=pkL();if(!L)return;
  if(f.phase==='punkt'){if(g.aufPunkt){pkPunktOk();return;}f.i=pkNaechster(L,(e.clientX-g.l)/g.w);f.d=L.tage[f.i];pkMarkDom();return;}
  if(f.phase==='linie'){if(g.aufKasten){pkLinieOk();return;}f.fx=pkKl((e.clientX-g.l)/g.w,0.02,0.98);f.fy=pkKl((e.clientY-g.o)/g.h,0.04,0.96);pkMarkDom();}
};
document.addEventListener('pointerup',pkGesteEnde,true);
document.addEventListener('pointercancel',()=>{_pkG=null;},true);
function pkFormText(v){if(pkForm)pkForm.t=v;}
function pkFormBias(b,btn){
  if(!pkForm)return;pkForm.b=pkForm.b===b?'neu':b;
  const p=document.getElementById('pkPop');if(!p)return;
  p.style.setProperty('--c',bcol(pkForm.b));
  p.querySelectorAll('.pk-rund').forEach(x=>{const on=x.dataset.b===pkForm.b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});
}
function pkFormZu(){pkMarkAbbruch();}
// Speichern: eine normale Notiz mit pm (siehe Kopf). Kein Schreibpfad ohne
// try/catch mit sichtbarer Meldung (Regel 6) - scheitert es, bleibt der
// Kasten mit dem Getippten offen.
function pkSpeichern(){
  const f=pkForm;if(!f||f.phase!=='text')return;
  const inp=document.getElementById('pkIn');if(inp)f.t=inp.value;
  const t=String(f.t||'').trim();
  if(!t){if(inp){inp.focus();try{inp.animate([{translate:'-4px 0'},{translate:'4px 0'},{translate:'0 0'}],{duration:220});}catch(e){}}return;}
  try{
    const L=pkL();
    const pm={a:f.a,d:f.d};
    if(L){const bi=pkNaechster(L,f.fx);pm.bd=L.tage[bi];pm.bo=+(f.fx-L.x(bi)).toFixed(4);if(L.pv){const v=L.pv(f.fy);if(isFinite(v))pm.bp=+v.toPrecision(7);}if(pm.bp==null)pm.by=+f.fy.toFixed(4);}
    pushU();
    const now=new Date().toISOString(),id=uid();
    research.notes.push({id,fids:[],title:t,body:'',tags:['chart'],fav:false,pin:false,arch:false,ts:now,up:now,bias:f.b,evt:null,asset:'',pm});
    save();
    pkForm=null;pkAdd=false;pkPopZu();pkKnopf(false);
    // kein automatisch gewaehlter Tag danach (Nutzer-Foto 2026-11-16: grauer Streifen eingekreist)
    pkSel=null;
    pkNeu=id;
    if(typeof window.renderDetail==='function')window.renderDetail();
  }catch(e){alert('The note could not be saved: '+(e&&e.message||e));}
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
  if(pkForm&&L){
    // ⚠ Erst pruefen, dann stoppen: ein stopPropagation in dieser Capture-Phase schluckte
    // sonst die Klicks IM Kasten (Bullish/Bearish/Done wirkten nicht - gemessen 2026-11-16).
    if(t.closest('#pkPop,.pk-mk-hint'))return;
    e.stopPropagation();   // Punkt/Kasten bewegt die Geste (pointerdown/-move/-up), kein Tag-Waehlen
    return;
  }
  if(t.closest('.pk-nt,.pk-nt-dot'))return;
  // Tipp/Klick auf einen Tag haelt ihn fest; derselbe Tag nochmal = zurueck zu Next up
  const tg=L?pkTagAn(e):null;
  // Maus: kein Festhalten (Nutzer 2026-11-17: "nur dieses Preisschildstab da bewegen und wenn der
  // nicht da ist ... dann werden die zukuenftigen Events angezeigt") - Fahren zeigt den Tag,
  // Verlassen zeigt Next up. Finger: Tipp haelt den Tag (es gibt kein Fahren).
  if(e.pointerType==='mouse'&&tg)return;
  if(tg&&!(pkSel&&pkSel.a===tg.L.a&&pkSel.k===tg.k&&e.pointerType!=='touch'&&!e.__pkFinger)){pkWaehle(tg.k);return;}
  if(pkSel)pkWaehle(null);
},true);
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(pkForm){pkFormZu();return;}
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
    ph.innerHTML=preisChartHtml(keys,W,H,{typ:'linie',skala:pkVglSkala,fenster:{von:f.max?null:f.von,bis:f.bis},weg:'pkVglWeg',fest:['p:'+c.id],zoom:'ab',kopf:10,lage:api=>pkLageHtml(c.id,api)});
    try{attachChartHovers(ph);}catch(e){}
    ph.removeAttribute('data-pk-vgl');
  }
  pkBreiteSetzen();
  pkMarkiere();
  pkHoverAnbinden();
  // Ein Neuaufbau (Feed-Update) ersetzt die Karte - ein offenes Popover kommt
  // mit dem schon Getippten (pkForm.t) wieder.
  if(pkForm&&pkForm.a===c.id){pkKnopf(true);pkPopZeichnen();}
  // Im Vergleich entsteht die Pfeil-Ebene erst hier - die Spalte danach neu.
  const col=k.querySelector('.pk-col');if(col&&(ph||!col.innerHTML.trim()))col.innerHTML=pkSpalteHtml(c.id);
  if(pkNeu){
    const el=pkLage(),p=el&&el.querySelector(`.pk-nt[data-nt="${pkNeu}"]`);
    if(p&&p.animate)try{p.animate([{scale:'.85',opacity:0},{scale:'1',opacity:1}],{duration:320,easing:'cubic-bezier(.3,1.5,.5,1)'});}catch(e){}
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
function pkZustand(){return{sel:pkSel,hover:pkHover,add:pkAdd,form:pkForm,vgl:JSON.parse(JSON.stringify(pkVgl)),skala:pkVglSkala};}

export {pkBandLegende,pkLageHtml,pkSpalteHtml,pkNachAufbau,pkVergleichAktiv,pkVglListe,pkVglSkalaWert,pkReleases,pkEimer,PFEIL,pkAddAktiv};
function pkAddAktiv(){return pkAdd;}
// Inline-Handler (onclick) brauchen die Funktionen am window.
Object.assign(window,{pkWaehle,pkMarkenSchalter,pkAddUmschalten,pkFormAuf,pkPunktOk,pkLinieOk,pkNotizAuf,pkFormText,pkFormBias,pkFormZu,pkSpeichern,pkEigenWeg,
  pkModusSetzen,pkMoveWaehle,pkBewegungen,pkVglAuf,pkVglAsset,pkVglGruppe,pkVglUmschalten,pkVglWeg,pkVglSkalaSetzen,pkZustand,pkReleases});
