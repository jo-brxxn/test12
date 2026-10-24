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
import {escH,escJH,getSym,saveSoon,renderDetail,stripPeriodSuffix,indName,isNonFx,macroCcyFor,
  indChartSeries,fmtIndVal,achsenTicks,INFL_ZIEL,indNextTermin,indNextExpected,
  chartLeisteHtml,markUserEditTs,indZeilenWerte,indNextReleaseCell,biasCss,abGoToHtml,icn,kartenIcon,
  syms,nivEintrag,nivReihe,preisReiheAnzeige,makroReiheNeu} from './main.js';
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
// Analyse-Werkzeuge (Nutzer 2026-10-24: "Veraender die Funktion zu einem
// richtigen Analyse Tool"; Rueckfrage: Laender-Vergleich, Statistik je Spur,
// Zinsentscheide als Marker, Kurs als eigene Spur - alle vier).
//   mkOpt.cmp    Waehrungen, deren gleicher Indikator mit in die Spur kommt (max. 3)
//   mkOpt.preis  Kurs des Assets als eigene Spur unter den Indikatoren
// Synct ueber snap (mkOpt) und steht in neueFelderBehalten().
const MK_CCYS=['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'];
const MK_CMP_MAX=3;
const MK_CMP_FARBEN=['var(--tf1)','var(--tf2)','var(--tf3)','var(--tf4)','var(--tf5)','var(--tf6)'];
let mkOpt={cmp:[],preis:true};
function makroOptSetzen(v){
  const o=v&&typeof v==='object'?v:{};
  mkOpt={cmp:Array.isArray(o.cmp)?o.cmp.filter((c,i,a)=>MK_CCYS.includes(c)&&a.indexOf(c)===i).slice(0,MK_CMP_MAX):[],preis:o.preis!==false};
}
function makroOptWert(){return{cmp:mkOpt.cmp.slice(),preis:mkOpt.preis};}
const MK_RANGES=[[12,'1Y'],[36,'3Y'],[60,'5Y'],[120,'10Y'],['MAX','Max']];
const MK_RANGE_DEF=36;
const MK_DEF_SPUREN=3;
// Gezogene Spanne je Karte (Zeitspanne per Ziehen, 2026-10-20) - eine ANSICHT
// bis zum Neuladen, wie die anderen gezogenen Spannen (siehe brushAnbinden).
const mkZoom={};
const mkZoomKey=ri=>{const s=getSym();return(s?s.id:'')+':'+ri;};
// Jede Makro-Bedienung tauscht nur die Makro-Reihe (makroReiheNeu, main.js) -
// gemessen kostete der Umweg ueber renderDetail 595-717 ms je Klick (CPU 4x).
function mkNeu(){if(window.__gpMakroVoll){renderDetail();return;}   // nur check/makro.js --gegenprobe
  try{makroReiheNeu();}catch(e){console.error('[makro]',e);renderDetail();}}
function mkBrushReg(ri){
  const key='mk:'+ri;
  if(window.brushReg)window.brushReg(key,{apply(von,bis){mkZoom[mkZoomKey(ri)]={von,bis};mkNeu();},reset(){delete mkZoom[mkZoomKey(ri)];mkNeu();}});
  return key;
}
// Offizielle Zielbaender (Punktziel = untere = obere Grenze). Die Mitte ist
// INFL_ZIEL (main.js) - dieselbe Zahl, die der Score benutzt.
const MK_ZIELBAND={USD:[2,2],EUR:[2,2],GBP:[2,2],JPY:[2,2],CHF:[0,2],CAD:[1,3],AUD:[2,3],NZD:[1,3]};
const MK_INFL_BASES=['CPI (Headline)','Core CPI','PCE','Core PCE','CPI'];
const MK_PMI_RE=/\bPMI\b|\bISM\b/i;
// Jedes Datum nur einmal parsen: dieselben Tage kommen in allen Reihen und bei
// jedem Zeichnen wieder (Profil 2026-10-24: tagMs/Date.parse 111 ms auf 12 Bedienungen).
const _mkTage=new Map();
const tagMs=d=>{const k=String(d).slice(0,10);let v=_mkTage.get(k);if(v===undefined){v=Date.parse(k+'T00:00:00Z');if(_mkTage.size>50000)_mkTage.clear();_mkTage.set(k,v);}return v;};

function mkCcy(sym){return sym?(isNonFx(sym.id)?macroCcyFor(sym.id):sym.id):null;}
function mkEligible(rub){return !!rub&&MK_RUBS.includes(rub.name);}
// Spuren mit mindestens zwei echten Punkten - dieselbe Reihe wie der
// aufgeklappte Indikator-Chart (indChartSeries), nie eine zweite Quelle.
// Zwischenspeicher fuer Reihen, Spurkoepfe, Kurs und Vergleich: je Aufbau der
// Makro-Reihe wurde dieselbe Reihe bis zu 4x gebaut, und jeder Reiterwechsel
// rechnete Kalender-Abgleich und Score der Spurkoepfe neu (Profil 2026-10-24).
// makroRenderStart(true) - bei JEDEM vollen Seitenaufbau, also nach jeder
// Datenaenderung (main.js abMakroReiheHtml) - leert alles; ein Teil-Aufbau
// (Reiter, Chip, Vergleich, Zeitraum) behaelt es. So kommt ein neuer Datenstand
// immer an, und eine reine Ansichtsaenderung rechnet nichts doppelt.
const _mkSerien=new Map(),_mkKoepfe=new Map(),_mkPreise=new Map(),_mkGegen=new Map(),_mkNext=new Map();
function makroRenderStart(voll){if(voll){_mkSerien.clear();_mkKoepfe.clear();_mkPreise.clear();_mkGegen.clear();_mkNext.clear();}}
function mkSerie(ind,symId){
  const k=symId+'|'+(ind&&(ind.id||ind.name));
  if(_mkSerien.has(k))return _mkSerien.get(k);
  const r=mkSerieRoh(ind,symId);_mkSerien.set(k,r);return r;
}
function mkSerieRoh(ind,symId){
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
function mkHatCharts(rub,sym){return mkEligible(rub)&&!!sym&&(rub.indicators||[]).some(i=>mkSerie(i,sym.id));}

// ── Referenzlinien je Indikator ───────────────────────────────────────────
function mkReferenz(ind,ccy,pts){
  const {base}=stripPeriodSuffix(ind.name);
  const yy=/y\/y/i.test(indName(ind));
  if(MK_INFL_BASES.includes(base)&&yy&&MK_ZIELBAND[ccy]){
    const [lo,hi]=MK_ZIELBAND[ccy];
    return{ziel:true,lo,hi,mid:INFL_ZIEL[ccy],lbl:lo===hi?`Target ${lo}%`:`Target ${lo}–${hi}%`};
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
  // Analyse-Werkzeuge: Vergleichswaehrungen + Kurs-Spur
  const eigen=mkCcy(sym);
  const cmpChips=MK_CCYS.filter(c=>c!==eigen).map(c=>{const on=mkOpt.cmp.includes(c);
    return`<button class="cmp-chip mk-cc${on?' on':''}" onclick="makroVergleich('${c}')" aria-pressed="${on}" title="${on?'Remove':'Add'} ${c}: the same indicator of the ${c} economy in every track${on?'':` (up to ${MK_CMP_MAX})`}"><span class="mk-cc-dot" style="background:${mkCmpFarbe(c,eigen)}"></span>${c}</button>`;}).join('');
  const werkzeuge=`<div class="mk-tools">
    <span class="mk-tools-l">Compare</span><span class="mk-tools-g" role="group" aria-label="Compare with">${cmpChips}</span>
    <span class="mk-tools-l">Show</span><span class="mk-tools-g"><button class="cmp-chip mk-px${mkOpt.preis?' on':''}" onclick="makroPreis()" aria-pressed="${mkOpt.preis}" title="Price of ${escH(sym.name||sym.id)} as its own track on the same time axis">Price</button></span>
  </div>`;
  // Zeichnen erst, wenn die Karte im Dokument steht (echte Pixelbreite);
  // renderDetail zeichnet zusaetzlich synchron (Scrollstand, 2026-10-20).
  try{requestAnimationFrame(()=>makroZeichnenFehlende());}catch(e){}
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
      ${werkzeuge}
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
  try{makroAnsichtSetzen(v);if(rubName)makroTabSetzen(rubName);markUserEditTs();saveSoon();mkNeu();}
  catch(e){console.error(e);alert('Could not switch the view: '+(e&&e.message||e));}
}
function makroTab(rubName){
  try{makroTabSetzen(rubName);markUserEditTs();saveSoon();mkNeu();}
  catch(e){console.error(e);alert('Could not switch the tab: '+(e&&e.message||e));}
}
function makroVergleich(c){
  try{
    if(!MK_CCYS.includes(c))return;
    const l=mkOpt.cmp.slice();const i=l.indexOf(c);
    if(i>=0)l.splice(i,1);else{l.push(c);if(l.length>MK_CMP_MAX)l.shift();}
    makroOptSetzen({cmp:l,preis:mkOpt.preis});markUserEditTs();saveSoon();mkNeu();
  }catch(e){console.error(e);alert('Could not change the comparison: '+(e&&e.message||e));}
}
function makroPreis(){
  try{makroOptSetzen({cmp:mkOpt.cmp,preis:!mkOpt.preis});markUserEditTs();saveSoon();mkNeu();}
  catch(e){console.error(e);alert('Could not change the price track: '+(e&&e.message||e));}
}
function makroRange(ri,v){
  try{const r=mkRub(ri);if(!r)return;delete mkZoom[mkZoomKey(ri)];r.mkRange=v==='MAX'?'MAX':+v;markUserEditTs();saveSoon();mkNeu();}
  catch(e){console.error(e);alert('Could not change the range: '+(e&&e.message||e));}
}
function makroSpur(ri,indId){
  try{
    const r=mkRub(ri),s=getSym();if(!r||!s)return;
    const ist=mkGewaehlt(r,s.id).map(i=>i.id);
    r.mkInds=ist.includes(indId)?ist.filter(x=>x!==indId):ist.concat(indId);
    // Reihenfolge wie in der Karte, nicht in der Klickreihenfolge.
    const ord=(r.indicators||[]).map(i=>i.id);r.mkInds.sort((a,b)=>ord.indexOf(a)-ord.indexOf(b));
    markUserEditTs();saveSoon();mkNeu();
  }catch(e){console.error(e);alert('Could not change the chart: '+(e&&e.message||e));}
}

// ── Zeichnen ──────────────────────────────────────────────────────────────
function mkVon(R,pts){
  if(R==='MAX')return pts.length?tagMs(pts[0][0]):tagMs(todayStr());
  const d=new Date(todayStr()+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-(+R||MK_RANGE_DEF));return d.getTime();
}
function mkNaechster(sym,ind){
  // Kalender-Abgleich je Indikator nur einmal je Datenstand (Profil: indNextTermin 228 ms auf 12 Bedienungen)
  const k=sym.id+'|'+ind.id;
  if(!_mkNext.has(k))_mkNext.set(k,mkNaechsterRoh(sym,ind));
  return _mkNext.get(k);
}
function mkNaechsterRoh(sym,ind){
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
  const k=sym.id+'|'+ind.id;
  if(!_mkKoepfe.has(k))_mkKoepfe.set(k,mkSpurKopfRoh(ind,rub,sym));
  return _mkKoepfe.get(k);
}
function mkSpurKopfRoh(ind,rub,sym){
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
// ── Analyse: Vergleich, Statistik, Zinsentscheide (2026-10-24) ─────────────
function mkCmpFarbe(c,eigen){const l=MK_CCYS.filter(x=>x!==eigen);return MK_CMP_FARBEN[Math.max(0,l.indexOf(c))%MK_CMP_FARBEN.length];}
// Gleicher Indikator einer anderen Waehrung: gleiche Karte, gleicher Name (sonst
// gleiche Basis). Kein Gegenstueck -> kein Strich, nie ein Ersatzwert.
function mkGegenstueck(ind,rubName,ccy){
  const k=ccy+'|'+rubName+'|'+ind.id;
  if(!_mkGegen.has(k))_mkGegen.set(k,mkGegenstueckRoh(ind,rubName,ccy));
  const g=_mkGegen.get(k);return g?{ind:g.ind,pts:g.pts,unit:g.unit}:null;
}
function mkGegenstueckRoh(ind,rubName,ccy){
  const s=(syms||[]).find(x=>x.id===ccy);if(!s)return null;
  const r=(s.rubrics||[]).find(x=>x.name===rubName);if(!r)return null;
  const nm=indName(ind),base=stripPeriodSuffix(ind.name).base,l=r.indicators||[];
  const i2=l.find(x=>indName(x)===nm)||l.find(x=>stripPeriodSuffix(x.name).base===base);
  if(!i2)return null;
  const se=mkSerie(i2,ccy);return se?{ind:i2,pts:se.pts,unit:se.unit}:null;
}
function mkZahl(v){return Math.abs(v)>=1e4?mkAchsWert(v):fmtIndVal(v,'');}
function mkDelta(d,unit){if(d==null||!isFinite(d))return'–';return(d>0?'+':d<0?'−':'±')+mkZahl(Math.abs(d))+(unit==='%'?'pp':(unit||''));}
// Letzter Punkt, der mindestens `monate` vor dem juengsten liegt (hoechstens
// 62 Tage davor - sonst gibt es keinen Vergleichswert, nichts wird geschaetzt).
function mkPunktVor(pts,monate){
  const l=pts[pts.length-1];const z=new Date(l[0]+'T00:00:00Z');z.setUTCMonth(z.getUTCMonth()-monate);const zt=z.getTime();
  let best=null;for(const p of pts){if(tagMs(p[0])<=zt)best=p;else break;}
  return best&&zt-tagMs(best[0])<=62*864e5?best:null;
}
function mkStatistik(sp,symId){
  const pts=sp.pts,l=pts[pts.length-1];
  const ch={};[3,6,12].forEach(m=>{const p=mkPunktVor(pts,m);ch[m]=p?l[1]-p[1]:null;});
  const ab=tagMs(todayStr())-10*365.25*864e5;const w=pts.filter(p=>tagMs(p[0])>=ab);
  let pct=null,z=null,hi=null,lo=null;
  if(w.length>=12){
    const v=w.map(p=>p[1]);pct=Math.round(v.filter(x=>x<=l[1]).length/v.length*100);
    const m=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-m)*(b-m),0)/v.length);
    z=sd>0?(l[1]-m)/sd:null;hi=w.reduce((a,b)=>b[1]>a[1]?b:a);lo=w.reduce((a,b)=>b[1]<a[1]?b:a);
  }
  // Treffer gegen den Forecast: "beat" = fuer die Waehrung besser als erwartet
  // (dieselbe Richtung wie die Ueberraschungs-Balken, mkTon/actualColor).
  const tons=pts.filter(p=>p[2]!=null).slice(-12).map(p=>mkTon(sp.ind,p[1],p[2],symId));
  let serie=0,serieTon=null;
  for(let i=tons.length-1;i>=0;i--){if(tons[i]==='neu')break;if(serieTon==null)serieTon=tons[i];if(tons[i]!==serieTon)break;serie++;}
  return{ch,pct,z,hi,lo,beat:tons.filter(t=>t==='bull').length,miss:tons.filter(t=>t==='bear').length,n:tons.length,serie,serieTon,u:sp.unit||''};
}
function mkStatHtml(st){
  const f=(l,v,t,stil)=>`<span class="mk-st"${t?` title="${escH(t)}"`:''}><i>${l}</i><b${stil?` style="${stil}"`:''}>${v}</b></span>`;
  let h=f('3M',escH(mkDelta(st.ch[3],st.u)),'Change vs the reading about 3 months earlier')+f('6M',escH(mkDelta(st.ch[6],st.u)),'Change vs the reading about 6 months earlier')+f('1Y',escH(mkDelta(st.ch[12],st.u)),'Change vs the reading about 12 months earlier');
  if(st.pct!=null){
    h+=f('10y pct',st.pct,"Share of the last 10 years' readings at or below the latest one");
    if(st.z!=null)h+=f('z',(st.z>=0?'+':'−')+Math.abs(st.z).toFixed(1),'Distance from the 10-year average in standard deviations');
    h+=f('10y range',escH(mkZahl(st.lo[1])+' – '+mkZahl(st.hi[1])),`Low ${st.lo[0]} · high ${st.hi[0]}`);
  }
  if(st.n){
    // Getrennt beat | miss | in line: "Beat 0/12" las sich beim Leitzins wie zwoelf
    // Verfehlungen, obwohl elf Entscheide genau auf dem Forecast lagen (2026-10-24).
    h+=f(`Last ${st.n} vs fc`,`${st.beat} beat · ${st.miss} miss · ${st.n-st.beat-st.miss} in line`,'Releases better / worse than forecast for the currency, or exactly on it');
    if(st.serie>=2)h+=f('Streak',`${st.serie}× ${st.serieTon==='bull'?'beat':'miss'}`,'Consecutive releases on the same side of the forecast',`color:${st.serieTon==='bull'?BC.bull:BC.bear}`);
  }
  return`<div class="mk-spur-stat">${h}</div>`;
}
function mkCmpHtml(sp){
  if(!sp.cmp.length&&!sp.cmpFehlt.length)return'';
  const l=sp.pts[sp.pts.length-1];
  return`<div class="mk-spur-cmp">${sp.cmp.map(c=>{const cl=c.pts[c.pts.length-1];
    return`<span class="mk-st" title="${escH(c.ccy)} ${escH(indName(c.ind))}: ${escH(fmtIndVal(cl[1],c.unit||''))} on ${escH(cl[0])} · gap = ${escH(sp.ccy)} minus ${escH(c.ccy)}, latest readings"><span class="mk-cc-dot" style="background:${c.farbe}"></span><i>${escH(c.ccy)}</i><b>${escH(fmtIndVal(cl[1],c.unit||''))}</b><i>Gap</i><b>${escH(mkDelta(l[1]-cl[1],sp.unit))}</b></span>`;}).join('')}${sp.cmpFehlt.length?`<span class="mk-st mk-st-nd"><i>No ${escH(sp.cmpFehlt.join(', '))} series for this indicator</i></span>`:''}</div>`;
}
// Zinsentscheide der eigenen Notenbank: jede Aenderung des Leitzinses (>= 5 bp)
// aus derselben Reihe, die der Score fuer "Central Bank Rate" liest.
function mkZinsentscheide(ccy){
  let r=[];try{r=nivReihe(nivEintrag(ccy,'Central Bank Rate'))||[];}catch(e){r=[];}
  const out=[];for(let i=1;i<r.length;i++){const dx=r[i][1]-r[i-1][1];if(Math.abs(dx)>=0.05)out.push({d:String(r[i][0]).slice(0,10),dx});}
  return out;
}
function mkZinsLinien(zins,x0,x1,xOf,yTop,H){
  let s='';zins.forEach(z=>{const t=tagMs(z.d);if(t<x0||t>x1)return;const xx=xOf(t).toFixed(1);
    s+=`<line class="mk-zins" x1="${xx}" x2="${xx}" y1="${yTop}" y2="${H-2}" stroke="${z.dx>0?BC.bull:BC.bear}" stroke-width="1.2" stroke-dasharray="3 3" stroke-opacity=".7"><title>Rate ${z.dx>0?'hike':'cut'} ${Math.round(z.dx*100)>0?'+':'−'}${Math.abs(Math.round(z.dx*100))} bp on ${z.d}</title></line>`;});
  return s;
}
function FX_KORB(sym){return!!sym&&MK_CCYS.includes(sym.id);}
function mkPreisPunkte(symId){
  if(!_mkPreise.has(symId))_mkPreise.set(symId,mkPreisPunkteRoh(symId));
  return _mkPreise.get(symId);
}
function mkPreisPunkteRoh(symId){
  let r=null;try{r=preisReiheAnzeige(symId);}catch(e){r=null;}
  return Array.isArray(r)?r.map(e=>[String(e[0]).slice(0,10),+e[1],null]).filter(p=>p[0]&&isFinite(p[1])&&p[1]>0):[];
}
// Nach dem Aufbau zeichnet der Aufrufer synchron (Scrollstand); der Nachlauf im
// naechsten Bild zeichnet nur noch, was dabei fehlte (verdeckt, Breite neu) -
// vorher wurde jeder Chart zweimal gezeichnet (gemessen 84-137 ms je Mal).
function makroZeichnenFehlende(){
  const tk=document.getElementById('mkTabKarte');if(!tk)return;
  tk.querySelectorAll('.mk-chart[data-ri]').forEach(box=>{const m=box.__mk;if(m&&m.W===Math.max(260,Math.floor(box.clientWidth))&&!window.__gpMakroVoll)return;
    try{makroZeichnen(box);}catch(e){console.error('[makro]',e);}});
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
  const spuren=gew.map(ind=>{const s=mkSerie(ind,sym.id);
    const cmp=[],cmpFehlt=[];
    mkOpt.cmp.filter(c=>c!==ccy).forEach(c=>{const g=mkGegenstueck(ind,rub.name,c);if(g)cmp.push(Object.assign(g,{ccy:c,farbe:mkCmpFarbe(c,ccy)}));else cmpFehlt.push(c);});
    return{ind,pts:s.pts,unit:s.unit,next:mkNaechster(sym,ind),cmp,cmpFehlt,ccy};});
  const zins=mkZinsentscheide(ccy);
  const preisPts=mkOpt.preis?mkPreisPunkte(sym.id):[];
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
    sp.cmp.forEach(c=>{c.use=c.pts.filter(p=>tagMs(p[0])>=x0&&tagMs(p[0])<=x1);c.use.forEach(p=>werte.push(p[1]));});
    if(sp.ref)werte.push(sp.ref.lo,sp.ref.hi);
    if(sp.next&&sp.next.fc!=null)werte.push(sp.next.fc);
    let lo=Math.min(...werte),hi=Math.max(...werte);
    const pad=(hi-lo)*0.1||Math.abs(hi||1)*0.05||1;sp.lo=lo-pad;sp.hi=hi+pad;
    sp.ticks=achsenTicks(sp.lo,sp.hi,schmal?3:4).filter(t=>t>=sp.lo&&t<=sp.hi);
  });
  // Kurs-Spur: dieselbe Zeitachse, eigene Werteachse
  let preis=null;
  if(preisPts.length){
    const use=preisPts.filter(p=>tagMs(p[0])>=x0&&tagMs(p[0])<=x1);
    if(use.length>=2){const v=use.map(p=>p[1]);let lo=Math.min(...v),hi=Math.max(...v);const pad=(hi-lo)*0.08||hi*0.02||1;
      preis={use,lo:lo-pad,hi:hi+pad};preis.ticks=achsenTicks(preis.lo,preis.hi,schmal?3:4).filter(t=>t>=preis.lo&&t<=preis.hi);}
  }
  const laengste=Math.max(5,...spuren.flatMap(sp=>sp.ticks.map(t=>mkAchsWert(t).length)),...(preis?preis.ticks.map(t=>mkAchsWert(t).length):[0]));
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
    // Ziel-/Normal-Linie. Das Inflationsziel ist eine waagerechte BLAUE
    // gestrichelte Linie (Nutzer 2026-10-21: "Mach das Target als waagerechte
    // blaue gestrichelte Linie"), bei Zielbaendern auf der Mitte (INFL_ZIEL),
    // das Band ganz blass blau dahinter. Median/50/0 bleiben grau - keine Ziele.
    if(ref){
      const zf=ref.ziel?'var(--blue)':'var(--t2)';
      if(ref.hi>ref.lo)svg+=`<rect x="${padL}" y="${yOf(ref.hi).toFixed(1)}" width="${W-padL-padR}" height="${(yOf(ref.lo)-yOf(ref.hi)).toFixed(1)}" fill="${ref.ziel?'var(--blue)':'var(--t3)'}" fill-opacity="${ref.ziel?'.07':'.12'}"/>`;
      svg+=`<line class="${ref.ziel?'mk-ziel':'mk-norm'}" x1="${padL}" x2="${W-padR}" y1="${yOf(ref.mid).toFixed(1)}" y2="${yOf(ref.mid).toFixed(1)}" stroke="${zf}" stroke-width="${ref.ziel?1.6:1.2}" stroke-dasharray="6 4"/>`;
      svg+=`<text x="${W-padR-4}" y="${(yOf(ref.hi)-4).toFixed(1)}" text-anchor="end" style="${fs};font-weight:700;${ref.ziel?'fill:var(--blue);':''}paint-order:stroke;stroke:var(--bg1);stroke-width:3px">${escH(ref.lbl)}</text>`;
    }
    // Heute
    svg+=`<line x1="${xh.toFixed(1)}" x2="${xh.toFixed(1)}" y1="${yTop}" y2="${H-2}" stroke="var(--t2)" stroke-width="1"/>`;
    svg+=mkZinsLinien(zins,x0,x1,xOf,yTop,H);
    // Vergleichswaehrungen: gleicher Indikator, eigene Farbe (Trends-Palette)
    sp.cmp.forEach(c=>{if(c.use.length<1)return;let dc='';c.use.forEach((p,i)=>{dc+=(i?'L':'M')+xOf(tagMs(p[0])).toFixed(1)+' '+yOf(p[1]).toFixed(1);});
      svg+=`<path class="mk-cmp-l" data-ccy="${c.ccy}" d="${dc}" fill="none" stroke="${c.farbe}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`;
      if(c.use.length<=80)c.use.forEach(p=>{svg+=`<circle cx="${xOf(tagMs(p[0])).toFixed(1)}" cy="${yOf(p[1]).toFixed(1)}" r="1.6" fill="${c.farbe}"/>`;});});
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
    sp.cmp.forEach(c=>hover.push({name:c.ccy,unit:c.unit||'',pts:c.use,farbe:c.farbe}));
    return`<div class="mk-spur">${mkSpurKopf(sp.ind,rub,sym)}${mkCmpHtml(sp)}${mkStatHtml(mkStatistik(sp,sym.id))}<svg class="mk-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escH(indName(sp.ind))} over time">${svg}</svg></div>`;
  });
  if(preis){
    const PHp=schmal?72:92,yTop=OBEN,yBot=yTop+PHp,H=yBot+6;
    const yOf=v=>yTop+(1-(v-preis.lo)/(preis.hi-preis.lo))*PHp;
    let svg='';
    ticks.forEach(tt=>{const xx=xOf(tt);svg+=`<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${yTop}" y2="${H-2}" stroke="var(--bd)" stroke-width="1" stroke-dasharray="1 3"/>`;});
    preis.ticks.forEach(t=>{const yy=yOf(t);svg+=`<line x1="${padL}" x2="${W-padR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="var(--bd)" stroke-width="1"/><text x="${padL-6}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" style="${fs}">${escH(mkAchsWert(t))}</text>`;});
    svg+=`<line x1="${xh.toFixed(1)}" x2="${xh.toFixed(1)}" y1="${yTop}" y2="${H-2}" stroke="var(--t2)" stroke-width="1"/>`;
    svg+=mkZinsLinien(zins,x0,x1,xOf,yTop,H);
    let d='';preis.use.forEach((p,i)=>{d+=(i?'L':'M')+xOf(tagMs(p[0])).toFixed(1)+' '+yOf(p[1]).toFixed(1);});
    svg+=`<path class="mk-preis-l" d="${d}" fill="none" stroke="var(--t0)" stroke-width="1.4" stroke-linejoin="round"/>`;
    svg+=`<line class="mk-cur" x1="0" x2="0" y1="${yTop}" y2="${H-2}" stroke="var(--t0)" stroke-width="1" style="display:none"/>`;
    const a=preis.use[0],z=preis.use[preis.use.length-1];
    const p1=mkPunktVor(preisPts,12);
    const pc=(v,b)=>{const x=(v/b-1)*100;return(x>0?'+':x<0?'−':'±')+Math.abs(x).toFixed(1)+'%';};
    const fx=FX_KORB(sym);
    const kopf=`<div class="mk-spur-kopf"><span class="mk-spur-name">${fx?`${escH(sym.id)} basket`:'Price'} · ${escH(sym.name||sym.id)}</span><span class="mk-kvs mk-kvs-p"><span class="mk-kv" title="Latest close ${escH(z[0])}"><i>Last</i><b>${escH(mkZahl(z[1]))}</b></span><span class="mk-kv" title="From ${escH(a[0])} to ${escH(z[0])}"><i>Shown</i><b>${escH(pc(z[1],a[1]))}</b></span><span class="mk-kv" title="Change over the last 12 months"><i>1Y</i><b>${p1?escH(pc(z[1],p1[1])):'–'}</b></span></span></div>`;
    hover.push({name:fx?`${sym.id} basket`:'Price',unit:'',pts:preis.use});
    bloecke.push(`<div class="mk-spur mk-spur-preis">${kopf}<svg class="mk-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price over time">${svg}</svg></div>`);
  }
  // Gemeinsame Zeitachse unten
  let ax='';
  ticks.forEach(tt=>{const xx=xOf(tt);const dd=new Date(tt),lbl=dd.toLocaleString('en-US',{month:'short',timeZone:'UTC'})+' '+String(dd.getUTCFullYear()).slice(2);
    ax+=`<text x="${xx.toFixed(1)}" y="15" text-anchor="middle" style="${fs}">${lbl}</text>`;});
  ax+=`<text x="${xh.toFixed(1)}" y="15" text-anchor="middle" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">Today</text>`;
  // Zinsentscheide: Beschriftung in einer eigenen Zeile unter den Monaten
  const zSicht=zins.filter(z=>{const t=tagMs(z.d);return t>=x0&&t<=x1;});
  let AH=ACHSE;
  if(zSicht.length){AH=ACHSE+16;let lx=-1e9;
    zSicht.forEach(z=>{const xx=xOf(tagMs(z.d));if(xx-lx<30)return;lx=xx;const bp=Math.round(z.dx*100);
      ax+=`<text class="mk-zins-t" x="${xx.toFixed(1)}" y="${ACHSE+10}" text-anchor="middle" style="font-size:var(--fs-2xs);font-weight:700;fill:${z.dx>0?BC.bull:BC.bear}">${bp>0?'+':'−'}${Math.abs(bp)}</text>`;});
    ax+=`<text x="${padL-6}" y="${ACHSE+10}" text-anchor="end" style="${fs}">bp</text>`;}
  box.innerHTML=`<div class="mk-spuren" onpointermove="makroHover(event,this)" onpointerdown="makroHover(event,this)" onpointerleave="makroHoverAus(this)">${bloecke.join('')}<svg class="mk-achse" width="${W}" height="${AH}" viewBox="0 0 ${W} ${AH}" aria-hidden="true">${ax}</svg></div>`;
  hover.forEach(h=>{h.ts=h.pts.map(p=>tagMs(p[0]));});
  box.__mk={x0,span,padL,padR,W,hover,cur:[...box.querySelectorAll('.mk-cur')],letzt:''};
  // Zeitspanne per Ziehen: Tagesanker ueber die Plotbreite.
  const nTage=Math.max(2,Math.round((x1-x0)/864e5)+1);
  box.dataset.br=mkBrushReg(ri);
  box.dataset.brLin=`${new Date(x0).toISOString().slice(0,10)}|${nTage}|${(padL/W).toFixed(4)}|${((W-padR)/W).toFixed(4)}`;
  try{window.brushAnbinden&&window.brushAnbinden(box.parentElement);}catch(e){}
}
// Hover hoechstens einmal je Bild (gemessen 13-15 ms je Bewegung bei CPU 4x,
// das Bildbudget ist 16 ms): die erste Bewegung sofort, weitere im selben Bild
// werden zusammengefasst. Naechster Punkt per binaerer Suche statt Durchlauf.
let _mkHovPlan=0,_mkHovNaechst=null;
function makroHover(ev,el){
  if(_mkHovPlan){_mkHovNaechst={x:ev.clientX,el};return;}
  mkHoverJetzt(ev.clientX,el);
  _mkHovPlan=requestAnimationFrame(()=>{_mkHovPlan=0;const n=_mkHovNaechst;_mkHovNaechst=null;if(n)mkHoverJetzt(n.x,n.el);});
}
function mkNaechsterIdx(ts,t){
  let lo=0,hi=ts.length-1;if(hi<0)return-1;
  while(lo<hi){const m=(lo+hi)>>1;if(ts[m]<t)lo=m+1;else hi=m;}
  return lo>0&&Math.abs(ts[lo-1]-t)<=Math.abs(ts[lo]-t)?lo-1:lo;
}
function mkHoverJetzt(clientX,el){
  try{
    const box=el.closest('.mk-chart');const m=box&&box.__mk;if(!m)return;
    const svg0=el.querySelector('svg.mk-svg');if(!svg0)return;
    const rc=svg0.getBoundingClientRect();const px=(clientX-rc.left)*(m.W/rc.width);
    if(px<m.padL||px>m.W-m.padR)return;
    const t=m.x0+(px-m.padL)/(m.W-m.padL-m.padR)*m.span;
    const pxs=px.toFixed(1);m.cur.forEach(c=>{c.setAttribute('x1',pxs);c.setAttribute('x2',pxs);c.style.display='';});
    const idx=m.hover.map(h=>mkNaechsterIdx(h.ts,t));
    const schl=idx.join(',');if(schl===m.letzt)return;m.letzt=schl;
    const zeilen=m.hover.map((h,hi)=>{const best=idx[hi]>=0?h.pts[idx[hi]]:null;
      if(!best)return'';
      return`<span class="mk-read-z">${h.farbe?`<span class="mk-cc-dot" style="background:${h.farbe}"></span>`:''}<b>${escH(h.name)}</b> ${escH(h.unit===''&&Math.abs(best[1])>=1e4?mkZahl(best[1]):fmtIndVal(best[1],h.unit))}${best[2]!=null?` <i>fc ${escH(fmtIndVal(best[2],h.unit))}</i>`:''} <i>${escH(fmtDayHdr(best[0]))}</i></span>`;}).join('');
    const karte=box.closest('.rub-card');const rd=karte&&karte.querySelector('.mk-read');if(rd)rd.innerHTML=zeilen;
  }catch(e){}
}
function makroHoverAus(el){try{const box=el.closest('.mk-chart');const m=box&&box.__mk;(m?m.cur:[...el.querySelectorAll('.mk-cur')]).forEach(c=>{c.style.display='none';});if(m)m.letzt='';}catch(e){}}
let _mkRz=0;
try{window.addEventListener('resize',()=>{clearTimeout(_mkRz);_mkRz=setTimeout(()=>makroZeichnenAlle(),150);});}catch(e){}

export {MK_RUBS,MK_ZIELBAND,makroKartenSchalterHtml,makroTabKarteHtml,makroGross,makroAnsichtSetzen,makroAnsichtWert,makroTabSetzen,makroTabWert,makroOptSetzen,makroOptWert,makroZeichnenAlle,makroRenderStart,mkReferenz,mkCcy};
if(typeof window!=='undefined')Object.assign(window,{makroSicht,makroTab,makroGross,makroRange,makroSpur,makroVergleich,makroPreis,makroHover,makroHoverAus,makroZeichnenAlle,mkReferenz,MK_ZIELBAND,makroTabWert,makroOptWert,
  // nur fuer check/makro.js (Statistik und Zinsentscheide unabhaengig nachrechnen)
  mkStatistik,mkZinsentscheide,
  // nur fuer check/makro.js (Spurkopf gegen die echte Reihe)
  fmtIndVal});
