'use strict';
// ══ MAKRO-CHARTS JE MAKRO-KARTE ════════════════════════════════════════════
// Nutzer-Auftrag 2026-10-20, woertlich: "Das Ziel ist es damit Makro Sentiment
// zu tracken und es uebersichtlich darzustellen ... ich will das auch sehen
// koennen. Ich will also zu den Rubriken da wo die drei makrokarten sind will
// ich einen Schalter haben zum wechseln also wenn ich Wechsel soll da drei
// grosser Chart auftauchen in denen ich dann alle Indikatoren rein machen kann".
//
// Umbau 2026-10-21 (Nutzer: "die Switch Funktion ist noch ziemlich blöd und hat
// viele Schwächen ... mach sie perfekt"), Nutzerwahl per Rueckfrage:
//   Schalter    - je Makro-Karte ("Table | Charts"); gemessen passt er NICHT in
//                 den Kartenkopf (frei bei 1024 px ~15 px, 390 px ~29 px, ein
//                 Schalter braucht ~110 px, Namen werden nie gekuerzt) - er steht
//                 deshalb in der ersten Zeile direkt unter dem Kopf.
//   Anordnung   - "Charts" ersetzt die drei Karten durch EINE breite Karte mit
//                 Reitern Inflation | Labour Market | Economic Growth; aktiv ist
//                 der Reiter der Karte, auf der geklickt wurde. "Table" im Kopf
//                 der breiten Karte fuehrt zurueck. Vorher: drei Karten volle
//                 Breite untereinander (iPad 786 px je Karte, Seite 3x so lang).
//   Einstufung  - "das ist nur zum analysieren also keine Einstufung": die
//                 Einstufungen (Above target, Rising, Hiking ...) sind entfernt,
//                 samt Vorschlaegen und Verlaufsbahn. Schon gespeicherte bleiben
//                 unangetastet im Speicher (researchAnalysis[ccy][karte].tags).
//   Zahlen      - "Ja aber alles muss abgetrennt und uebersichtlich sein das hat
//                 Prioritaet": jede Spur ist ein eigener, durch eine Linie
//                 getrennter Block mit Kopfzeile Act | Fc | Prev | Next | Score
//                 - dieselben Werte wie die Tabelle (indZeilenWerte, main.js).
// Bleibt aus dem ersten Wurf: gestapelte Spuren auf gemeinsamer Zeitachse mit
// echten Werten (indChartSeries), Ziel-/Normal-Linien, Ueberraschungs-Balken,
// naechster Termin, Zeitspanne per Ziehen bzw. Schere.
//
// ⚠ NUR ANZEIGE - nichts hier veraendert den Score.
//
// Speicher (alles ueber snap -> Undo + Sync, docs/state-sync.md):
//   mkAnsicht    'charts' | null   Charts an/aus (fuer alle Assets)
//   mkTab        Kartenname        aktiver Reiter
//   rub.mkInds   [Indikator-IDs]   gezeigte Spuren je Karte
//   rub.mkRange  12|36|60|120|'MAX' Zeitraum je Karte
// mkAnsicht/mkTab/mkInds/mkRange stehen in neueFelderBehalten() (main.js):
// eine noch offene aeltere App laesst sie beim Hochladen weg, das darf sie
// nicht loeschen.
import {escH,escJH,getSym,save,renderDetail,stripPeriodSuffix,indName,isNonFx,macroCcyFor,
  indChartSeries,fmtIndVal,achsenTicks,INFL_ZIEL,indNextTermin,indNextExpected,
  chartLeisteHtml,markUserEditTs,indZeilenWerte,indNextReleaseCell,biasCss,abGoToHtml,icn,kartenIcon} from './main.js';
import {indScore,fmtScNum,rubScore,glowClass} from './score.js';
import {todayStr,fmtDayHdr,parseNumLike,actualColor,LOWER_IS_BETTER_RE} from './calendar.js';
import {BC} from './constants.js';
import {ASSET_CARDS} from './assetlayout.js';

const MK_RUBS=['Inflation','Interest Rates','Labour Market','Economic Growth'];
let mkAnsicht=null,mkTab=null;
function makroGross(){return mkAnsicht==='charts';}
function makroAnsichtSetzen(v){mkAnsicht=v==='charts'?'charts':null;}
function makroAnsichtWert(){return mkAnsicht;}
function makroTabSetzen(v){mkTab=typeof v==='string'&&MK_RUBS.includes(v)?v:null;}
function makroTabWert(){return mkTab;}
const MK_RANGES=[[12,'1Y'],[36,'3Y'],[60,'5Y'],[120,'10Y'],['MAX','Max']];
const MK_RANGE_DEF=36;
const MK_DEF_SPUREN=3;
// Gezogene Spanne je Karte (Zeitspanne per Ziehen, 2026-10-20) - eine ANSICHT
// bis zum Neuladen, wie die anderen gezogenen Spannen (siehe brushAnbinden).
const mkZoom={};
const mkZoomKey=ri=>{const s=getSym();return(s?s.id:'')+':'+ri;};
function mkBrushReg(ri){
  const key='mk:'+ri;
  if(window.brushReg)window.brushReg(key,{apply(von,bis){mkZoom[mkZoomKey(ri)]={von,bis};renderDetail();},reset(){delete mkZoom[mkZoomKey(ri)];renderDetail();}});
  return key;
}
// Offizielle Zielbaender (Punktziel = untere = obere Grenze). Die Mitte ist
// INFL_ZIEL (main.js) - dieselbe Zahl, die der Score benutzt.
const MK_ZIELBAND={USD:[2,2],EUR:[2,2],GBP:[2,2],JPY:[2,2],CHF:[0,2],CAD:[1,3],AUD:[2,3],NZD:[1,3]};
const MK_INFL_BASES=['CPI (Headline)','Core CPI','PCE','Core PCE','CPI'];
const MK_PMI_RE=/\bPMI\b|\bISM\b/i;
const tagMs=d=>Date.parse(String(d).slice(0,10)+'T00:00:00Z');

function mkCcy(sym){return sym?(isNonFx(sym.id)?macroCcyFor(sym.id):sym.id):null;}
function mkEligible(rub){return !!rub&&MK_RUBS.includes(rub.name);}
// Spuren mit mindestens zwei echten Punkten - dieselbe Reihe wie der
// aufgeklappte Indikator-Chart (indChartSeries), nie eine zweite Quelle.
function mkSerie(ind,symId){
  let cs;try{cs=indChartSeries(ind,symId);}catch(e){return null;}
  const pts=(cs&&cs.pts||[]).map(p=>[String(p[0]).slice(0,10),+p[1],p[2]==null?null:+p[2]]).filter(p=>p[0]&&isFinite(p[1]));
  return pts.length>=2?{pts,unit:cs.unit}:null;
}
function mkVerfuegbar(rub,symId){return(rub.indicators||[]).filter(i=>mkSerie(i,symId));}
function mkGewaehlt(rub,symId){
  const da=mkVerfuegbar(rub,symId);
  if(Array.isArray(rub.mkInds)){const s=da.filter(i=>rub.mkInds.includes(i.id));if(s.length||rub.mkInds.length===0)return s;}
  return da.slice(0,MK_DEF_SPUREN);
}
function mkHatCharts(rub,sym){return mkEligible(rub)&&!!sym&&mkVerfuegbar(rub,sym.id).length>0;}

// ── Referenzlinien je Indikator ───────────────────────────────────────────
function mkReferenz(ind,ccy,pts){
  const {base}=stripPeriodSuffix(ind.name);
  const yy=/y\/y/i.test(indName(ind));
  if(MK_INFL_BASES.includes(base)&&yy&&MK_ZIELBAND[ccy]){
    const [lo,hi]=MK_ZIELBAND[ccy];
    return{lo,hi,mid:INFL_ZIEL[ccy],lbl:lo===hi?`Target ${lo}%`:`Target ${lo}–${hi}%`};
  }
  if(/vs Target|vs Normal|Trend \(3M\)|Yield Gap/.test(ind.name))return{lo:0,hi:0,mid:0,lbl:'0'};
  if(MK_PMI_RE.test(ind.name)||MK_PMI_RE.test(base))return{lo:50,hi:50,mid:50,lbl:'50 = no change'};
  if(base==='Unemployment Rate'||base==='Avg Hourly Earnings'){
    // Langjaehriges Normal = Median der letzten 10 Jahre der GEZEIGTEN Reihe
    // (dieselbe Idee wie nivRobust im Score, dort zusaetzlich robust skaliert).
    const ab=tagMs(todayStr())-10*365.25*864e5;
    const w=pts.filter(p=>tagMs(p[0])>=ab).map(p=>p[1]).sort((a,b)=>a-b);
    if(w.length>=12){const m=w.length%2?w[(w.length-1)/2]:(w[w.length/2-1]+w[w.length/2])/2;return{lo:m,hi:m,mid:m,lbl:`10y median ${fmtIndVal(m,'')}`};}
  }
  return null;
}

// ── Schalter ──────────────────────────────────────────────────────────────
function mkSchalter(aktiv,rubName){
  return`<span class="ctyp mk-sw" role="group" aria-label="Macro view">${[['table','Table','Show the indicator tables'],['charts','Charts','Show the macro cards as one large chart card with tabs: every indicator stacked on one time axis']].map(([v,l,t])=>
    `<button class="ind-hist-range-btn${v===aktiv?' on':''}" aria-pressed="${v===aktiv}" onclick="makroSicht('${v}'${v==='charts'&&rubName?`,'${escJH(rubName)}'`:''})" title="${t}">${l}</button>`).join('')}</span>`;
}
// Zeile direkt unter dem Kopf jeder Makro-Karte (Table-Ansicht).
function makroKartenSchalterHtml(rub){
  const s=getSym();
  if(!mkHatCharts(rub,s))return'';
  return`<div class="mk-kz">${mkSchalter('table',rub.name)}</div>`;
}

// ── Reiter-Karte (Charts-Ansicht) ─────────────────────────────────────────
// Liefert '' wenn keine Makro-Karte des Assets eine Reihe hat - dann zeichnet
// der Aufrufer wie bisher die Tabellen.
function makroTabKarteHtml(sym){
  if(!makroGross()||!sym)return'';
  const rubs=sym.rubrics||[];
  const reiter=ASSET_CARDS.map(n=>{const ri=rubs.findIndex(r=>r.name===n);return ri<0?null:{ri,rub:rubs[ri]};}).filter(x=>x&&mkHatCharts(x.rub,sym));
  if(!reiter.length)return'';
  const akt=reiter.find(x=>x.rub.name===mkTab)||reiter[0];
  const {ri,rub}=akt;
  const sc=rubScore(rub);
  const tabs=`<div class="mk-tabs" role="tablist" aria-label="Macro cards">${reiter.map(x=>{const on=x===akt;
    return`<button class="mk-tab${on?' on':''}" role="tab" aria-selected="${on}" onclick="makroTab('${escJH(x.rub.name)}')">${escH(x.rub.name)}</button>`;}).join('')}</div>`;
  const da=mkVerfuegbar(rub,sym.id),gew=mkGewaehlt(rub,sym.id);
  const chips=`<div class="mk-chips" role="group" aria-label="Indicators shown">${da.map(i=>{const on=gew.includes(i);
    return`<button class="cmp-chip mk-chip${on?' on':''}" onclick="makroSpur(${ri},'${escJH(i.id)}')" aria-pressed="${on}" title="${on?'Hide':'Show'} ${escH(indName(i))}">${escH(indName(i))}</button>`;}).join('')}</div>`;
  // Zeichnen erst, wenn die Karte im Dokument steht (echte Pixelbreite);
  // renderDetail zeichnet zusaetzlich synchron (Scrollstand, 2026-10-20).
  try{requestAnimationFrame(()=>makroZeichnenAlle());}catch(e){}
  return`<div class="rub-card mk-tk ${glowClass(rub.bias)}" id="mkTabKarte">
    <div class="rub-hdr mk-tk-hdr">
      ${/* Symbol des aktiven Reiters selbst setzen - sonst haengt
           kartenIconsNachtragen ein allgemeines davor, das am Handy allein in
           einer Zeile stand (gemessen 2026-10-21, 390 px). */''}
      <span class="k-ic" aria-hidden="true">${icn(kartenIcon(rub.name),18)}</span>
      ${tabs}
      <div class="mk-tk-ctl">
        <span class="rub-score" role="button" onclick="openScoreInfoRub('${escJH(sym.id)}','${escJH(rub.id)}')" style="cursor:pointer;color:${biasCss(rub.bias)};border-color:${biasCss(rub.bias)}" title="Card score of ${escH(rub.name)} - tap to see which indicators it is made of">${sc>0?'+':''}${sc}</span>
        ${mkSchalter('charts')}
        <button class="rinfo" onclick="openInfoM(${ri})" title="Info">i</button>
      </div>
    </div>
    <div class="rub-body">
      ${makroLeisteHtml(rub,ri)}
      ${chips}
      <div class="mk-read" aria-live="polite"></div>
      <div class="mk-chart" data-ri="${ri}">${gew.length?'':'<div class="mk-leer">Pick at least one indicator above.</div>'}</div>
    </div>
    ${abGoToHtml('data')}
  </div>`;
}
// Werkzeugzeile: rechts der Zeitraum (bzw. die gezogene Spanne mit ×).
function makroLeisteHtml(rub,ri){
  const R=rub.mkRange!=null?rub.mkRange:MK_RANGE_DEF;
  const z=mkZoom[mkZoomKey(ri)];
  const sch=window.brushSchereHtml?window.brushSchereHtml(mkBrushReg(ri)):'';
  if(z&&window.brushChipHtml)return chartLeisteHtml('',sch+window.brushChipHtml(mkBrushReg(ri),z.von,z.bis));
  const rg=`<div class="ind-hist-range-bar">${sch}${MK_RANGES.map(([v,l])=>`<button class="ind-hist-range-btn${String(v)===String(R)?' on':''}" onclick="makroRange(${ri},'${v}')">${l}</button>`).join('')}</div>`;
  return chartLeisteHtml('',rg);
}

// ── Aktionen (window-Bruecke unten) ───────────────────────────────────────
// ⚠ Jede speichernde Aktion markiert sich als Nutzer-Aenderung (markUserEditTs),
// sonst ersetzt der naechste Sync-Abgleich sie durch den fremden Stand -
// gefunden von check/zurueck.js B (2026-10-20, 42 unmarkierte Klicks).
function mkRub(ri){const s=getSym();return s&&s.rubrics?s.rubrics[ri]:null;}
function makroSicht(v,rubName){
  try{makroAnsichtSetzen(v);if(rubName)makroTabSetzen(rubName);markUserEditTs();save();renderDetail();}
  catch(e){console.error(e);alert('Could not switch the view: '+(e&&e.message||e));}
}
function makroTab(rubName){
  try{makroTabSetzen(rubName);markUserEditTs();save();renderDetail();}
  catch(e){console.error(e);alert('Could not switch the tab: '+(e&&e.message||e));}
}
function makroRange(ri,v){
  try{const r=mkRub(ri);if(!r)return;delete mkZoom[mkZoomKey(ri)];r.mkRange=v==='MAX'?'MAX':+v;markUserEditTs();save();renderDetail();}
  catch(e){console.error(e);alert('Could not change the range: '+(e&&e.message||e));}
}
function makroSpur(ri,indId){
  try{
    const r=mkRub(ri),s=getSym();if(!r||!s)return;
    const ist=mkGewaehlt(r,s.id).map(i=>i.id);
    r.mkInds=ist.includes(indId)?ist.filter(x=>x!==indId):ist.concat(indId);
    // Reihenfolge wie in der Karte, nicht in der Klickreihenfolge.
    const ord=(r.indicators||[]).map(i=>i.id);r.mkInds.sort((a,b)=>ord.indexOf(a)-ord.indexOf(b));
    markUserEditTs();save();renderDetail();
  }catch(e){console.error(e);alert('Could not change the chart: '+(e&&e.message||e));}
}

// ── Zeichnen ──────────────────────────────────────────────────────────────
function mkVon(R,pts){
  if(R==='MAX')return pts.length?tagMs(pts[0][0]):tagMs(todayStr());
  const d=new Date(todayStr()+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-(+R||MK_RANGE_DEF));return d.getTime();
}
function mkNaechster(sym,ind){
  try{const nt=indNextTermin(sym.id,ind);if(nt&&nt.ev&&nt.ev.date){const f=parseNumLike(nt.ev.forecast);return{d:String(nt.ev.date).slice(0,10),fc:f,sicher:true};}}catch(e){}
  try{const x=indNextExpected(ind);if(x)return{d:x,fc:null,sicher:false};}catch(e){}
  return null;
}
function mkTon(ind,a,f,symId){
  if(f==null)return'neu';
  try{const c=actualColor({name:indName(ind),actual:String(a),forecast:String(f)},symId);return c==='act-good'?'bull':c==='act-bad'?'bear':'neu';}
  catch(e){const lb=LOWER_IS_BETTER_RE.test(ind.name||'');return a===f?'neu':((lb?a<f:a>f)?'bull':'bear');}
}
// Achsenwerte kompakt (200K statt 200,000): am Handy war die Beschriftung links
// abgeschnitten (gemessen 2026-10-21, 390 px: "00,000").
function mkAchsWert(v){
  const a=Math.abs(v);
  if(a>=1e6)return+(v/1e6).toFixed(a>=1e7?0:1)+'M';
  if(a>=1e4)return+(v/1e3).toFixed(0)+'K';
  return fmtIndVal(v,'');
}
const mkFarbe=t=>t==='bull'?BC.bull:t==='bear'?BC.bear:'var(--t3)';
// Kopfzeile einer Spur: Name, dann je Wert ein eigenes, beschriftetes Feld -
// dieselben Werte und Farben wie die Tabellenzeile (indZeilenWerte).
function mkSpurKopf(ind,rub,sym){
  let w;try{w=indZeilenWerte(ind,rub);}catch(e){w={actTxt:'–',actCls:'',fcTxt:'–',prevTxt:'–',prevCls:''};}
  let next='–';try{next=indNextReleaseCell(sym.id,ind)||'–';}catch(e){}
  let sc=null;try{sc=indScore(ind,rub);}catch(e){}
  const scTxt=sc==null?'–':fmtScNum(sc);
  const scFarbe=sc>0?BC.bull:sc<0?BC.bear:'var(--t2)';
  const feld=(lbl,html,cls,title)=>`<span class="mk-kv${cls?' '+cls:''}"${title?` title="${escH(title)}"`:''}><i>${lbl}</i><b>${html}</b></span>`;
  return`<div class="mk-spur-kopf">
    <span class="mk-spur-name">${escH(indName(ind))}</span>
    <span class="mk-kvs">${feld('Act',escH(w.actTxt),w.actCls,'Actual — the released value')}${feld('Fc',escH(w.fcTxt),'','Forecast — what the market expected')}${feld('Prev',escH(w.prevTxt),w.prevCls,'Previous — the value before this release')}${feld('Next',next,'mk-kv-next','Next release — days until it; ~N = expected from the release rhythm')}${`<span class="mk-kv mk-kv-sc" title="Points this indicator adds to the card score"><i>Score</i><b style="color:${scFarbe}">${escH(scTxt)}</b></span>`}</span>
  </div>`;
}
function makroZeichnenAlle(){
  document.querySelectorAll('.mk-chart[data-ri]').forEach(box=>{try{makroZeichnen(box);}catch(e){console.error('[makro]',e);box.innerHTML='<div class="mk-leer">Chart could not be drawn: '+escH(e&&e.message||String(e))+'</div>';}});
}
function makroZeichnen(box){
  const sym=getSym();if(!sym)return;
  const ri=+box.dataset.ri,rub=sym.rubrics&&sym.rubrics[ri];if(!rub)return;
  const gew=mkGewaehlt(rub,sym.id);if(!gew.length)return;
  const W=Math.max(260,Math.floor(box.clientWidth));if(!box.clientWidth)return;   // versteckt: nicht messen
  const ccy=mkCcy(sym),R=rub.mkRange!=null?rub.mkRange:MK_RANGE_DEF;
  const schmal=W<520;
  const padR=schmal?8:12;
  const SH=20,OBEN=8,ACHSE=24;
  const heute=tagMs(todayStr());
  const spuren=gew.map(ind=>{const s=mkSerie(ind,sym.id);return{ind,pts:s.pts,unit:s.unit,next:mkNaechster(sym,ind)};});
  // Gemeinsame Zeitachse: vom Fensterbeginn bis zum spaetesten naechsten Termin.
  const alle=spuren.flatMap(s=>s.pts);alle.sort((a,b)=>a[0].localeCompare(b[0]));
  const zoom=mkZoom[mkZoomKey(ri)];
  const x0=zoom?tagMs(zoom.von):Math.max(mkVon(R,alle),alle.length?tagMs(alle[0][0]):heute);
  const x1=zoom?tagMs(zoom.bis):Math.max(heute,...spuren.map(s=>s.next?tagMs(s.next.d):0),...alle.map(p=>tagMs(p[0])));
  // Erster Durchgang: Wertebereich und Achsenwerte je Spur - der linke Rand
  // richtet sich nach der laengsten Beschriftung, fuer alle Spuren gleich
  // (sonst fluchten die Zeitachsen nicht).
  const PHx=schmal?92:118;
  spuren.forEach(sp=>{
    const vis=sp.pts.filter(p=>tagMs(p[0])>=x0&&tagMs(p[0])<=x1);
    sp.use=vis.length>=1?vis:sp.pts.slice(-2);
    sp.ref=mkReferenz(sp.ind,ccy,sp.pts);
    const werte=[];sp.use.forEach(p=>{werte.push(p[1]);if(p[2]!=null)werte.push(p[2]);});
    if(sp.ref)werte.push(sp.ref.lo,sp.ref.hi);
    if(sp.next&&sp.next.fc!=null)werte.push(sp.next.fc);
    let lo=Math.min(...werte),hi=Math.max(...werte);
    const pad=(hi-lo)*0.1||Math.abs(hi||1)*0.05||1;sp.lo=lo-pad;sp.hi=hi+pad;
    sp.ticks=achsenTicks(sp.lo,sp.hi,schmal?3:4).filter(t=>t>=sp.lo&&t<=sp.hi);
  });
  const laengste=Math.max(5,...spuren.flatMap(sp=>sp.ticks.map(t=>mkAchsWert(t).length)));
  const padL=Math.round(Math.max(schmal?34:42,laengste*6.4+10));
  const span=Math.max(864e5,x1-x0);
  const xOf=t=>padL+(t-x0)/span*(W-padL-padR);
  const fs='font-size:var(--fs-2xs);fill:var(--t2)';
  // Monats-Ticks einmal fuer alle Spuren (gleiche x-Positionen = Raster fluchtet)
  const jahre=(x1-x0)/(365.25*864e5);
  const ticks=[];{const t=new Date(x0);t.setUTCDate(1);
    const schritt=jahre>6?24:jahre>3?12:jahre>1.5?6:3;
    t.setUTCMonth(Math.ceil(t.getUTCMonth()/schritt)*schritt);
    let letzteX=-1e9;
    while(t.getTime()<=x1){const xx=xOf(t.getTime());if(xx>=padL-1&&xx<=W-padR+1&&xx-letzteX>=58){ticks.push(t.getTime());letzteX=xx;}t.setUTCMonth(t.getUTCMonth()+schritt);}}
  const xh=xOf(heute);
  const hover=[];
  const bloecke=spuren.map(sp=>{
    const use=sp.use,ref=sp.ref,lo=sp.lo,hi=sp.hi;
    // Nur echte Ueberraschungen: Actual = Forecast zeichnete sonst je Release einen
    // Mini-Strich, die Nulllinie sah gestrichelt aus (gesehen 2026-10-20).
    const sur=use.filter(p=>p[2]!=null&&Math.abs(p[1]-p[2])>1e-9).map(p=>({d:p[0],s:p[1]-p[2],ton:mkTon(sp.ind,p[1],p[2],sym.id)}));
    const yTop=OBEN,yBot=yTop+PHx;
    const yOf=v=>yTop+(1-(v-lo)/(hi-lo))*PHx;
    const H=(sur.length?yBot+6+SH:yBot)+6;
    let svg='';
    ticks.forEach(tt=>{const xx=xOf(tt);svg+=`<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${yTop}" y2="${H-2}" stroke="var(--bd)" stroke-width="1" stroke-dasharray="1 3"/>`;});
    // Gitter + Achse
    sp.ticks.forEach(t=>{const yy=yOf(t);if(yy<yTop-1||yy>yBot+1)return;
      svg+=`<line x1="${padL}" x2="${W-padR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="var(--bd)" stroke-width="1"/><text x="${padL-6}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" style="${fs}">${escH(mkAchsWert(t))}</text>`;});
    // Ziel-/Normal-Linie
    if(ref){
      if(ref.hi>ref.lo)svg+=`<rect x="${padL}" y="${yOf(ref.hi).toFixed(1)}" width="${W-padL-padR}" height="${(yOf(ref.lo)-yOf(ref.hi)).toFixed(1)}" fill="var(--t3)" fill-opacity=".12"/>`;
      svg+=`<line x1="${padL}" x2="${W-padR}" y1="${yOf(ref.mid).toFixed(1)}" y2="${yOf(ref.mid).toFixed(1)}" stroke="var(--t2)" stroke-width="1.2" stroke-dasharray="5 4"/>`;
      svg+=`<text x="${W-padR-4}" y="${(yOf(ref.hi)-4).toFixed(1)}" text-anchor="end" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">${escH(ref.lbl)}</text>`;
    }
    // Heute
    svg+=`<line x1="${xh.toFixed(1)}" x2="${xh.toFixed(1)}" y1="${yTop}" y2="${H-2}" stroke="var(--t2)" stroke-width="1"/>`;
    // Actual-Linie + Punkte, Forecast als hohle Punkte
    let d='';use.forEach((p,i)=>{d+=(i?'L':'M')+xOf(tagMs(p[0])).toFixed(1)+' '+yOf(p[1]).toFixed(1);});
    svg+=`<path d="${d}" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    const r=use.length>80?1.4:2.4;
    use.forEach(p=>{const xx=xOf(tagMs(p[0]));
      if(p[2]!=null)svg+=`<circle cx="${xx.toFixed(1)}" cy="${yOf(p[2]).toFixed(1)}" r="${r+0.6}" fill="none" stroke="var(--t1)" stroke-width="1"/>`;
      svg+=`<circle cx="${xx.toFixed(1)}" cy="${yOf(p[1]).toFixed(1)}" r="${r}" fill="var(--blue)"/>`;});
    // Naechster Termin
    if(sp.next&&tagMs(sp.next.d)<=x1){
      const xn=xOf(tagMs(sp.next.d));
      svg+=`<line x1="${xn.toFixed(1)}" x2="${xn.toFixed(1)}" y1="${yTop}" y2="${yBot}" stroke="var(--t1)" stroke-width="1.2" stroke-dasharray="${sp.next.sicher?'4 3':'2 4'}"/>`;
      svg+=`<text x="${(xn-4).toFixed(1)}" y="${yTop+11}" text-anchor="end" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">${sp.next.sicher?'Next':'~Next'} ${escH(fmtDayHdr(sp.next.d))}</text>`;
      if(sp.next.fc!=null){const yf=yOf(sp.next.fc);svg+=`<path d="M${xn.toFixed(1)} ${(yf-4.5).toFixed(1)} L${(xn+4.5).toFixed(1)} ${yf.toFixed(1)} L${xn.toFixed(1)} ${(yf+4.5).toFixed(1)} L${(xn-4.5).toFixed(1)} ${yf.toFixed(1)} Z" fill="var(--bg1)" stroke="var(--t0)" stroke-width="1.3"><title>Forecast ${escH(fmtIndVal(sp.next.fc,''))}</title></path>`;}
    }
    // Ueberraschungs-Balken (Actual minus Forecast)
    if(sur.length){
      const ys=yBot+6,mid=ys+SH/2,mx=Math.max(...sur.map(o=>Math.abs(o.s)))||1;
      svg+=`<line x1="${padL}" x2="${W-padR}" y1="${mid}" y2="${mid}" stroke="var(--bd)" stroke-width="1"/><text x="${padL-6}" y="${mid+3.5}" text-anchor="end" style="${fs}">Surp.</text>`;
      const bw=Math.max(1.5,Math.min(7,(W-padL-padR)/Math.max(1,use.length)*0.6));
      sur.forEach(o=>{const xx=xOf(tagMs(o.d)),h=Math.abs(o.s)/mx*(SH/2-1);
        svg+=`<rect x="${(xx-bw/2).toFixed(1)}" y="${(o.s>=0?mid-h:mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.8,h).toFixed(1)}" fill="${mkFarbe(o.ton)}" fill-opacity=".85"/>`;});
    }
    svg+=`<line class="mk-cur" x1="0" x2="0" y1="${yTop}" y2="${H-2}" stroke="var(--t0)" stroke-width="1" style="display:none"/>`;
    hover.push({name:indName(sp.ind),unit:sp.unit||'',pts:use});
    return`<div class="mk-spur">${mkSpurKopf(sp.ind,rub,sym)}<svg class="mk-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escH(indName(sp.ind))} over time">${svg}</svg></div>`;
  });
  // Gemeinsame Zeitachse unten
  let ax='';
  ticks.forEach(tt=>{const xx=xOf(tt);const dd=new Date(tt),lbl=dd.toLocaleString('en-US',{month:'short',timeZone:'UTC'})+' '+String(dd.getUTCFullYear()).slice(2);
    ax+=`<text x="${xx.toFixed(1)}" y="15" text-anchor="middle" style="${fs}">${lbl}</text>`;});
  ax+=`<text x="${xh.toFixed(1)}" y="15" text-anchor="middle" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">Today</text>`;
  box.innerHTML=`<div class="mk-spuren" onpointermove="makroHover(event,this)" onpointerdown="makroHover(event,this)" onpointerleave="makroHoverAus(this)">${bloecke.join('')}<svg class="mk-achse" width="${W}" height="${ACHSE}" viewBox="0 0 ${W} ${ACHSE}" aria-hidden="true">${ax}</svg></div>`;
  box.__mk={x0,span,padL,padR,W,hover};
  // Zeitspanne per Ziehen: Tagesanker ueber die Plotbreite.
  const nTage=Math.max(2,Math.round((x1-x0)/864e5)+1);
  box.dataset.br=mkBrushReg(ri);
  box.dataset.brLin=`${new Date(x0).toISOString().slice(0,10)}|${nTage}|${(padL/W).toFixed(4)}|${((W-padR)/W).toFixed(4)}`;
  try{window.brushAnbinden&&window.brushAnbinden(box.parentElement);}catch(e){}
}
function makroHover(ev,el){
  try{
    const box=el.closest('.mk-chart');const m=box&&box.__mk;if(!m)return;
    const svg0=el.querySelector('svg.mk-svg');if(!svg0)return;
    const rc=svg0.getBoundingClientRect();const px=(ev.clientX-rc.left)*(m.W/rc.width);
    if(px<m.padL||px>m.W-m.padR)return;
    const t=m.x0+(px-m.padL)/(m.W-m.padL-m.padR)*m.span;
    el.querySelectorAll('.mk-cur').forEach(c=>{c.setAttribute('x1',px.toFixed(1));c.setAttribute('x2',px.toFixed(1));c.style.display='';});
    const zeilen=m.hover.map(h=>{let best=null,bd=Infinity;h.pts.forEach(p=>{const dd=Math.abs(tagMs(p[0])-t);if(dd<bd){bd=dd;best=p;}});
      if(!best)return'';
      return`<span class="mk-read-z"><b>${escH(h.name)}</b> ${escH(fmtIndVal(best[1],h.unit))}${best[2]!=null?` <i>fc ${escH(fmtIndVal(best[2],h.unit))}</i>`:''} <i>${escH(fmtDayHdr(best[0]))}</i></span>`;}).join('');
    const karte=box.closest('.rub-card');const rd=karte&&karte.querySelector('.mk-read');if(rd)rd.innerHTML=zeilen;
  }catch(e){}
}
function makroHoverAus(el){try{el.querySelectorAll('.mk-cur').forEach(c=>{c.style.display='none';});}catch(e){}}
let _mkRz=0;
try{window.addEventListener('resize',()=>{clearTimeout(_mkRz);_mkRz=setTimeout(()=>makroZeichnenAlle(),150);});}catch(e){}

export {MK_RUBS,MK_ZIELBAND,makroKartenSchalterHtml,makroTabKarteHtml,makroGross,makroAnsichtSetzen,makroAnsichtWert,makroTabSetzen,makroTabWert,makroZeichnenAlle,mkReferenz,mkCcy};
if(typeof window!=='undefined')Object.assign(window,{makroSicht,makroTab,makroGross,makroRange,makroSpur,makroHover,makroHoverAus,makroZeichnenAlle,mkReferenz,MK_ZIELBAND,makroTabWert,
  // nur fuer check/makro.js (Spurkopf gegen die echte Reihe)
  fmtIndVal});
