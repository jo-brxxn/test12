'use strict';
// ══ MAKRO-CHARTS + ANALYSE-EINSTUFUNGEN JE MAKRO-KARTE ═════════════════════
// Nutzer-Auftrag 2026-10-20, woertlich: "Das Ziel ist es damit Makro Sentiment
// zu tracken und es uebersichtlich darzustellen ich will also nicht nur im
// Score haben actual vs forecast sondern auch ist Inflation ueber Target und
// den Trend usw aber ich will das auch sehen koennen. Ich will also zu den
// Rubriken da wo die drei makrokarten sind will ich einen Schalter haben zum
// wechseln also wenn ich Wechsel soll da drei grosser Chart auftauchen in
// denen ich dann alle Indikatoren rein machen kann ... Und dann will ich
// auswaehlen koennen Beschreibungen dafuer damit man seine Analyse festhalten
// kann also Sachen wie Inflation nicht unter Kontrolle oder unter Target und
// die dann auch wieder unterteilt in ueber Target im Target oder unterm
// Target".
//
// Nutzerwahl per Rueckfrage (2026-10-20):
//   Skalierung   - gestapelte Spuren: gemeinsame Zeitachse, je Indikator eine
//                  eigene Spur mit eigener Achse, echte Werte, nichts umgerechnet
//   Einstufung   - die App schlaegt aus echten Daten vor, der Nutzer bestaetigt
//                  oder ueberschreibt; Abweichung von den Daten wird markiert
//   Extras       - Ziel-/Normal-Linien, Ueberraschungs-Balken (Actual minus
//                  Forecast), Einstufungs-Verlauf, naechster Termin
//   Umfang       - alle Makro-Karten mit Indikatoren (Interest Rates ist heute
//                  bei jedem Asset leer - Leitzins und Renditen stehen in der
//                  Inflation-Karte; bekommt sie Indikatoren, hat sie den
//                  Schalter automatisch)
//
// ⚠ NUR ANZEIGE. Nichts hier veraendert den Score. Die Vorschlaege lesen
// dieselben Rechnungen wie die Niveau-Zeilen des Scores (nivAlle, Modell 22+),
// damit Vorschlag und Score nie zwei verschiedene Wahrheiten erzaehlen
// (Dual-Source-Lehre). Fehlt eine Reihe oder ist sie veraltet, gibt es KEINEN
// Vorschlag (CLAUDE.md Regel 4: nie schaetzen) - die Zeile sagt "no data".
//
// Speicher:
//   mkAnsicht    'charts' | null        EIN Schalter fuer alle Makro-Karten,
//                                       in der Reihen-Ueberschrift "Macro"
//                                       (snap-Feld mkAnsicht -> Undo + Sync)
//   rub.mkInds   [Indikator-IDs]        gezeigte Spuren       (in snap -> Sync)
//   rub.mkRange  12|36|60|120|'MAX'     Zeitraum              (in snap -> Sync)
//   researchAnalysis[waehrung][karte].tags  {dim: wert}   Einstufung
//   researchAnalysis[waehrung][karte].hist  [{d,k,v}]     Verlauf je Aenderung
// Die Einstufung haengt an der WAEHRUNG, nicht am Asset: Gold, Nasdaq und USD
// zeigen in der Inflation-Karte dieselbe US-Inflation - eine Einstufung "US
// inflation above target" ist eine Aussage ueber die Wirtschaft, nicht ueber
// das Asset. researchAnalysis laeuft ueber snap()/applySnap() und damit ueber
// den Cloud-Sync (docs/state-sync.md, Punkt 1).
import {escH,escJH,getSym,pushU,save,renderDetail,stripPeriodSuffix,indName,isNonFx,macroCcyFor,
  indChartSeries,fmtIndVal,achsenTicks,INFL_ZIEL,nivAlle,nivEintrag,nivReihe,indNextTermin,indNextExpected,
  researchAnalysis,chartLeisteHtml,markUserEditTs} from './main.js';
import {todayStr,fmtDayHdr,parseNumLike,actualColor,LOWER_IS_BETTER_RE} from './calendar.js';
import {BC} from './constants.js';

const MK_RUBS=['Inflation','Interest Rates','Labour Market','Economic Growth'];
// ⚠ EIN Schalter fuer die ganze Makro-Reihe, nicht je Karte (Nutzer: "zu den
// Rubriken da wo die drei makrokarten sind will ich einen Schalter haben ...
// soll da drei grosser Chart auftauchen"). Gemessen 2026-10-20: im Raster
// nebeneinander war jede Karte bei 1180 px nur 344 px breit - kein "grosser
// Chart". Im Charts-Modus nimmt deshalb jede Makro-Karte die volle Zeile.
let mkAnsicht=null;
function makroGross(){return mkAnsicht==='charts';}
function makroAnsichtSetzen(v){mkAnsicht=v==='charts'?'charts':null;}
function makroAnsichtWert(){return mkAnsicht;}
const MK_RANGES=[[12,'1Y'],[36,'3Y'],[60,'5Y'],[120,'10Y'],['MAX','Max']];
const MK_RANGE_DEF=36;
const MK_DEF_SPUREN=3;
const MK_HIST_MAX=400;
// Offizielle Zielbaender (Punktziel = untere = obere Grenze). Die Mitte ist
// INFL_ZIEL (main.js) - dieselbe Zahl, die der Score benutzt.
const MK_ZIELBAND={USD:[2,2],EUR:[2,2],GBP:[2,2],JPY:[2,2],CHF:[0,2],CAD:[1,3],AUD:[2,3],NZD:[1,3]};
const MK_INFL_BASES=['CPI (Headline)','Core CPI','PCE','Core PCE','CPI'];
const MK_PMI_RE=/\bPMI\b|\bISM\b/i;

// ── Einstufungen: Dimensionen je Karte ────────────────────────────────────
// Jede Option traegt einen Ton (bull/bear/neu) fuer die Farbe im Verlauf -
// derselbe Sinn wie im Score: Inflation ueber Ziel = Notenbank bleibt straff =
// fuer die Waehrung bullish (siehe nivRegelText 'infl').
const MK_DIMS={
  'Inflation':[
    {k:'level',lbl:'Level vs target',opts:[['above','Above target','bull'],['at','At target','neu'],['below','Below target','bear']]},
    {k:'trend',lbl:'Trend',opts:[['rising','Rising','bull'],['stable','Stable','neu'],['falling','Falling','bear']]},
    {k:'control',lbl:'Control',opts:[['in','Under control','neu'],['out','Not under control','bull']]},
    {k:'policy',lbl:'Central bank',opts:[['hiking','Hiking','bull'],['hold','On hold','neu'],['cutting','Cutting','bear']]}
  ],
  'Interest Rates':[
    {k:'policy',lbl:'Central bank',opts:[['hiking','Hiking','bull'],['hold','On hold','neu'],['cutting','Cutting','bear']]}
  ],
  'Labour Market':[
    {k:'tight',lbl:'Tightness',opts:[['tight','Tight','bull'],['balanced','Balanced','neu'],['loose','Loose','bear']]},
    {k:'trend',lbl:'Trend',opts:[['improving','Improving','bull'],['stable','Stable','neu'],['weakening','Weakening','bear']]},
    {k:'wages',lbl:'Wages',opts:[['hot','Hot','bull'],['normal','Normal','neu'],['cool','Cool','bear']]}
  ],
  'Economic Growth':[
    {k:'momentum',lbl:'Momentum',opts:[['expanding','Expanding','bull'],['stalling','Stalling','neu'],['contracting','Contracting','bear']]},
    {k:'conf',lbl:'Confidence',opts:[['rising','Rising','bull'],['stable','Stable','neu'],['falling','Falling','bear']]}
  ]
};
// Schwellen der Vorschlaege - bewusst dieselben Stufen, ab denen der Score
// die Niveau-Zeile ueberhaupt zaehlt (NIV.*.stufen, kleinste Stufe).
const MK_SCHWELLE={level:0.5,trend:0.3,tight:0.5,labT:0.2,wages:0.75,conf:2,policy:0.05};
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
function mkAnalyse(ccy,rubName,anlegen){
  if(!ccy)return null;
  if(!researchAnalysis[ccy]){if(!anlegen)return null;researchAnalysis[ccy]={};}
  if(!researchAnalysis[ccy][rubName]){if(!anlegen)return null;researchAnalysis[ccy][rubName]={bias:null,text:''};}
  const a=researchAnalysis[ccy][rubName];
  if(anlegen){if(!a.tags||typeof a.tags!=='object')a.tags={};if(!Array.isArray(a.hist))a.hist=[];}
  return a;
}

// ── Vorschlaege aus echten Daten ──────────────────────────────────────────
// Rueckgabe je Dimension: {v, info, titel} oder null (dann "no data").
function mkLetzterWert(ccy,base,maxTage){
  const e=nivEintrag(ccy,base);if(!e)return null;
  const v=parseNumLike(e.actual);if(v==null||!e.date)return null;
  if((tagMs(todayStr())-tagMs(e.date))/864e5>maxTage)return null;
  return{v,datum:String(e.date).slice(0,10)};
}
function mkVorschlaege(ccy,rubName){
  const out={};
  const n=(nivAlle()||{})[ccy]||{};
  const s=MK_SCHWELLE;
  if(rubName==='Inflation'){
    if(n.infl){const g=n.infl.x;out.level={v:g>s.level?'above':g<-s.level?'below':'at',info:n.infl.act+' vs target',titel:n.infl.mass};}
    if(n.inflT){const d=n.inflT.x;out.trend={v:d>=s.trend?'rising':d<=-s.trend?'falling':'stable',info:n.inflT.act+' in 3 months',titel:n.inflT.mass};}
    if(out.level&&out.trend){
      const L=out.level.v,T=out.trend.v;
      // Nicht unter Kontrolle: ueber dem Ziel und nicht fallend - oder unter
      // dem Ziel und nicht steigend (Deflationsseite). Sonst unter Kontrolle.
      const raus=(L==='above'&&T!=='falling')||(L==='below'&&T!=='rising');
      out.control={v:raus?'out':'in',info:(L==='at'?'at target':L+' target')+' · '+T,titel:'Rule: not under control = above target and not falling, or below target and not rising. Otherwise under control.'};
    }
  }
  if(rubName==='Inflation'||rubName==='Interest Rates'){
    const r=nivReihe(nivEintrag(ccy,'Central Bank Rate'));
    if(r.length>=2){
      const [dL,vL]=r[r.length-1];
      // Letzte echte Aenderung suchen; liegt sie innerhalb von 180 Tagen,
      // zaehlt ihre Richtung, sonst "on hold".
      let ab=null;for(let i=r.length-1;i>0;i--){if(Math.abs(r[i][1]-r[i-1][1])>=s.policy){ab={d:r[i][0],dx:r[i][1]-r[i-1][1]};break;}}
      const frisch=ab&&(tagMs(todayStr())-tagMs(ab.d))/864e5<=180;
      out.policy={v:frisch?(ab.dx>0?'hiking':'cutting'):'hold',info:frisch?`${ab.dx>0?'+':''}${Math.round(ab.dx*100)} bp on ${fmtDayHdr(ab.d)}`:`${fmtIndVal(vL,'%')} unchanged since ${ab?fmtDayHdr(ab.d):fmtDayHdr(r[0][0])}`,titel:'Rule: the last rate change within 180 days sets the direction; none in 180 days = on hold. Latest reading '+dL+'.'};
    }
  }
  if(rubName==='Labour Market'){
    if(n.lab){const z=n.lab.x;out.tight={v:z>=s.tight?'tight':z<=-s.tight?'loose':'balanced',info:n.lab.act+' vs 10y normal',titel:n.lab.mass};}
    if(n.labT){const x=n.labT.x;out.trend={v:x>=s.labT?'improving':x<=-s.labT?'weakening':'stable',info:'unemployment '+n.labT.act+' in 3 months',titel:n.labT.mass};}
    if(n.wage){const z=n.wage.x;out.wages={v:z>=s.wages?'hot':z<=-s.wages?'cool':'normal',info:n.wage.act+' vs 10y normal',titel:n.wage.mass};}
  }
  if(rubName==='Economic Growth'){
    const pm=['Manufacturing PMI','Services PMI'].map(b=>mkLetzterWert(ccy,b,75)).filter(Boolean);
    if(pm.length){const m=pm.reduce((a,x)=>a+x.v,0)/pm.length;
      out.momentum={v:m>51?'expanding':m<49?'contracting':'stalling',info:`PMI ${m.toFixed(1)}`,titel:'Rule: average of the latest manufacturing and services PMI (released within 75 days). Above 51 expanding, below 49 contracting, otherwise stalling.'};}
    else{const g=mkLetzterWert(ccy,'GDP Growth QoQ',200);
      if(g)out.momentum={v:g.v>0.3?'expanding':g.v<0?'contracting':'stalling',info:`GDP ${g.v>0?'+':''}${g.v}% q/q`,titel:'Rule (no fresh PMI): latest GDP q/q above 0.3% expanding, below 0% contracting, otherwise stalling. Released '+g.datum+'.'};}
    if(n.confT){const x=n.confT.x;out.conf={v:x>=s.conf?'rising':x<=-s.conf?'falling':'stable',info:n.confT.act+' in 3 months',titel:n.confT.mass};}
  }
  return out;
}
function mkOpt(dim,v){return dim.opts.find(o=>o[0]===v)||null;}

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

// ── HTML der Karte ────────────────────────────────────────────────────────
function makroIstCharts(rub){const s=getSym();return makroGross()&&mkEligible(rub)&&!!s&&mkVerfuegbar(rub,s.id).length>0;}
// Schalter in der Reihen-Ueberschrift "Macro" - nur, wenn mindestens eine
// Makro-Karte des Assets eine Reihe hat.
function makroSchalterHtml(sym){
  if(!sym||!(sym.rubrics||[]).some(r=>mkEligible(r)&&mkVerfuegbar(r,sym.id).length))return'';
  const ch=makroGross();
  return`<span class="ctyp mk-sw" role="group" aria-label="Macro view">${[['table','Table'],['charts','Charts']].map(([v,l])=>
    `<button class="ind-hist-range-btn${(v==='charts')===ch?' on':''}" onclick="makroSicht('${v}')" title="${v==='charts'?'Show every macro card as a large chart: all indicators stacked on one time axis':'Show the indicator tables'}">${l}</button>`).join('')}</span>`;
}
// Werkzeugzeile der Karte im Charts-Modus: rechts der Zeitraum.
function makroLeisteHtml(rub,ri){
  if(!makroIstCharts(rub))return'';
  const R=rub.mkRange!=null?rub.mkRange:MK_RANGE_DEF;
  const rg=`<div class="ind-hist-range-bar">${MK_RANGES.map(([v,l])=>`<button class="ind-hist-range-btn${String(v)===String(R)?' on':''}" onclick="makroRange(${ri},'${v}')">${l}</button>`).join('')}</div>`;
  return chartLeisteHtml('',rg);
}
function makroChartsHtml(rub,ri){
  const sym=getSym();if(!sym)return'';
  const da=mkVerfuegbar(rub,sym.id),gew=mkGewaehlt(rub,sym.id);
  const chips=`<div class="mk-chips" role="group" aria-label="Indicators shown">${da.map(i=>{const on=gew.includes(i);
    return`<button class="cmp-chip mk-chip${on?' on':''}" onclick="makroSpur(${ri},'${escJH(i.id)}')" aria-pressed="${on}" title="${on?'Hide':'Show'} ${escH(indName(i))}">${escH(indName(i))}</button>`;}).join('')}</div>`;
  // Zeichnen erst, wenn die Karte im Dokument steht (echte Pixelbreite).
  try{requestAnimationFrame(()=>makroZeichnenAlle());}catch(e){}
  return`<div class="mk-wrap">
    <div class="mk-l">${makroAnalyseHtml(rub,ri,sym)}</div>
    <div class="mk-r">
      ${chips}
      <div class="mk-chart" data-ri="${ri}">${gew.length?'':'<div class="mk-leer">Pick at least one indicator above.</div>'}</div>
      <div class="mk-read" aria-live="polite"></div>
    </div>
  </div>`;
}
function makroAnalyseHtml(rub,ri,sym){
  const dims=MK_DIMS[rub.name];if(!dims)return'';
  const ccy=mkCcy(sym);if(!ccy)return'';
  const vor=mkVorschlaege(ccy,rub.name);
  const an=mkAnalyse(ccy,rub.name,false);
  const tags=(an&&an.tags)||{};
  const zeilen=dims.map(dim=>{
    const v=vor[dim.k],mein=tags[dim.k]||null;
    const abw=mein&&v&&mein!==v.v;
    const opts=dim.opts.map(([w,l])=>{
      const cls=(mein===w?' on':'')+(v&&v.v===w?' mk-vs':'');
      return`<button class="cmp-chip mk-an-o${cls}" onclick="makroEinstufen(${ri},'${dim.k}','${w}')" aria-pressed="${mein===w}" title="${escH(l)}${v&&v.v===w?' — suggested by the data':''}${mein===w?' — your call (tap again to clear)':''}">${escH(l)}</button>`;
    }).join('');
    const daten=v?`<span class="mk-an-d" title="${escH(v.titel||'')}"><span class="mk-an-dl">Data</span> <b>${escH((mkOpt(dim,v.v)||[,''])[1])}</b> <i>${escH(v.info)}</i>${abw?' <span class="mk-an-abw" title="Your call differs from what the data shows">≠ data</span>':''}</span>`
      :`<span class="mk-an-d mk-an-nd" title="The series is missing, too short or stale — nothing is suggested from it."><span class="mk-an-dl">Data</span> <i>no data</i></span>`;
    return`<div class="mk-an-row"><span class="mk-an-lbl">${escH(dim.lbl)}</span><span class="mk-an-opts">${opts}</span>${daten}</div>`;
  }).join('');
  const geteilt=isNonFx(sym.id)?`<span class="mk-an-meta"><i>${escH(ccy)} economy · shared with every ${escH(ccy)}-linked asset</i></span>`:'';
  return`<div class="mk-an"><div class="mk-an-hd"><span class="mk-an-t">Analysis</span>${geteilt}<span class="mk-an-meta"><i>Not part of the score</i></span></div>${zeilen}</div>`;
}

// ── Aktionen (window-Bruecke unten) ───────────────────────────────────────
function mkRub(ri){const s=getSym();return s&&s.rubrics?s.rubrics[ri]:null;}
function makroSicht(v){
  try{makroAnsichtSetzen(v);save();renderDetail();}
  catch(e){console.error(e);alert('Could not switch the view: '+(e&&e.message||e));}
}
function makroRange(ri,v){
  try{const r=mkRub(ri);if(!r)return;r.mkRange=v==='MAX'?'MAX':+v;save();renderDetail();}
  catch(e){console.error(e);alert('Could not change the range: '+(e&&e.message||e));}
}
function makroSpur(ri,indId){
  try{
    const r=mkRub(ri),s=getSym();if(!r||!s)return;
    const ist=mkGewaehlt(r,s.id).map(i=>i.id);
    r.mkInds=ist.includes(indId)?ist.filter(x=>x!==indId):ist.concat(indId);
    // Reihenfolge wie in der Karte, nicht in der Klickreihenfolge.
    const ord=(r.indicators||[]).map(i=>i.id);r.mkInds.sort((a,b)=>ord.indexOf(a)-ord.indexOf(b));
    save();renderDetail();
  }catch(e){console.error(e);alert('Could not change the chart: '+(e&&e.message||e));}
}
function makroEinstufen(ri,k,v){
  try{
    const r=mkRub(ri),s=getSym();if(!r||!s)return;
    const dims=MK_DIMS[r.name]||[],dim=dims.find(d=>d.k===k);if(!dim||!mkOpt(dim,v))return;
    const ccy=mkCcy(s);if(!ccy)return;
    pushU();
    const an=mkAnalyse(ccy,r.name,true);
    const neu=an.tags[k]===v?null:v;   // erneuter Klick nimmt die Einstufung zurueck
    if(neu)an.tags[k]=neu;else delete an.tags[k];
    // Verlauf: je Tag und Dimension EIN Eintrag (der letzte des Tages gilt).
    const heute=todayStr();
    an.hist=an.hist.filter(h=>!(h.d===heute&&h.k===k));
    const vorher=an.hist.filter(h=>h.k===k).slice(-1)[0];
    if(!vorher||vorher.v!==(neu||''))an.hist.push({d:heute,k,v:neu||''});
    if(an.hist.length>MK_HIST_MAX)an.hist=an.hist.slice(-MK_HIST_MAX);
    try{markUserEditTs();}catch(e){}
    save();renderDetail();
  }catch(e){console.error(e);alert('Could not save the analysis: '+(e&&e.message||e));}
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
const mkFarbe=t=>t==='bull'?BC.bull:t==='bear'?BC.bear:'var(--t3)';
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
  const padL=schmal?40:48,padR=schmal?8:12;
  const PH=schmal?92:118,SH=20,KOPF=20,LUECKE=16,ACHSE=22;
  const heute=tagMs(todayStr());
  const spuren=gew.map(ind=>{const s=mkSerie(ind,sym.id);return{ind,pts:s.pts,unit:s.unit,next:mkNaechster(sym,ind)};});
  // Gemeinsame Zeitachse: vom Fensterbeginn bis zum spaetesten naechsten Termin.
  const alle=spuren.flatMap(s=>s.pts);alle.sort((a,b)=>a[0].localeCompare(b[0]));
  const x0=Math.max(mkVon(R,alle),alle.length?tagMs(alle[0][0]):heute);
  const x1=Math.max(heute,...spuren.map(s=>s.next?tagMs(s.next.d):0),...alle.map(p=>tagMs(p[0])));
  const span=Math.max(864e5,x1-x0);
  const xOf=t=>padL+(t-x0)/span*(W-padL-padR);
  // Einstufungs-Verlauf: je Dimension mit Eintraegen eine schmale Bahn oben.
  const an=mkAnalyse(ccy,rub.name,false),dims=MK_DIMS[rub.name]||[];
  const bahnen=dims.filter(d=>an&&Array.isArray(an.hist)&&an.hist.some(h=>h.k===d.k));
  const BAHN=13,bahnH=bahnen.length?bahnen.length*(BAHN+3)+14:0;
  let y=bahnH,svg='';
  const fs='font-size:var(--fs-2xs);fill:var(--t2)',fsB='font-size:var(--fs-xs);font-weight:700;fill:var(--t0)';
  if(bahnen.length){
    svg+=`<text x="${padL}" y="10" style="${fs}">Your calls</text>`;
    bahnen.forEach((d,bi)=>{
      const yy=14+bi*(BAHN+3);
      const h=an.hist.filter(e=>e.k===d.k).sort((a,b)=>a.d.localeCompare(b.d));
      svg+=`<text x="${padL-4}" y="${yy+BAHN-3}" text-anchor="end" style="${fs}">${escH(d.lbl.split(' ')[0])}</text>`;
      h.forEach((e,i)=>{
        if(!e.v)return;
        const a=Math.max(x0,tagMs(e.d)),b=i+1<h.length?tagMs(h[i+1].d):heute+864e5;
        if(b<=x0)return;
        const o=mkOpt(d,e.v);if(!o)return;
        const xa=xOf(a),xb=Math.max(xa+3,xOf(Math.min(b,x1)));
        svg+=`<rect x="${xa.toFixed(1)}" y="${yy}" width="${(xb-xa).toFixed(1)}" height="${BAHN}" rx="3" fill="${mkFarbe(o[2])}" fill-opacity=".22" stroke="${mkFarbe(o[2])}" stroke-opacity=".5"><title>${escH(d.lbl)}: ${escH(o[1])} since ${escH(fmtDayHdr(e.d))}</title></rect>`;
        if(xb-xa>o[1].length*6.2+8)svg+=`<text x="${(xa+5).toFixed(1)}" y="${yy+BAHN-3}" style="font-size:var(--fs-2xs);font-weight:700;fill:var(--t1)">${escH(o[1])}</text>`;
      });
    });
  }
  const hover=[];
  spuren.forEach(sp=>{
    const vis=sp.pts.filter(p=>tagMs(p[0])>=x0);
    const use=vis.length>=1?vis:sp.pts.slice(-2);
    const ref=mkReferenz(sp.ind,ccy,sp.pts);
    // Nur echte Ueberraschungen: Actual = Forecast zeichnete sonst je Release einen
    // Mini-Strich, die Nulllinie sah gestrichelt aus (gesehen 2026-10-20).
    const sur=use.filter(p=>p[2]!=null&&Math.abs(p[1]-p[2])>1e-9).map(p=>({d:p[0],s:p[1]-p[2],ton:mkTon(sp.ind,p[1],p[2],sym.id)}));
    const mitSur=sur.length>0;
    const werte=[];use.forEach(p=>{werte.push(p[1]);if(p[2]!=null)werte.push(p[2]);});
    if(ref){werte.push(ref.lo,ref.hi);}
    if(sp.next&&sp.next.fc!=null)werte.push(sp.next.fc);
    let lo=Math.min(...werte),hi=Math.max(...werte);
    const pad=(hi-lo)*0.1||Math.abs(hi||1)*0.05||1;lo-=pad;hi+=pad;
    const yTop=y+KOPF,yBot=yTop+PH;
    const yOf=v=>yTop+(1-(v-lo)/(hi-lo))*PH;
    const letzt=sp.pts[sp.pts.length-1];
    // Kopf: Name | letzter Wert | Datum
    svg+=`<text x="${padL}" y="${y+14}" style="${fsB}">${escH(indName(sp.ind))}<tspan dx="8" style="font-weight:800;fill:var(--blue)">${escH(fmtIndVal(letzt[1],sp.unit||''))}</tspan><tspan dx="6" style="font-weight:400;font-style:italic;fill:var(--t2)">${escH(fmtDayHdr(letzt[0]))}</tspan></text>`;
    // Gitter + Achse
    achsenTicks(lo,hi,schmal?3:4).forEach(t=>{const yy=yOf(t);if(yy<yTop-1||yy>yBot+1)return;
      svg+=`<line x1="${padL}" x2="${W-padR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="var(--bd)" stroke-width="1"/><text x="${padL-6}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" style="${fs}">${escH(fmtIndVal(t,''))}</text>`;});
    // Ziel-/Normal-Linie
    if(ref){
      if(ref.hi>ref.lo)svg+=`<rect x="${padL}" y="${yOf(ref.hi).toFixed(1)}" width="${W-padL-padR}" height="${(yOf(ref.lo)-yOf(ref.hi)).toFixed(1)}" fill="var(--t3)" fill-opacity=".12"/>`;
      svg+=`<line x1="${padL}" x2="${W-padR}" y1="${yOf(ref.mid).toFixed(1)}" y2="${yOf(ref.mid).toFixed(1)}" stroke="var(--t2)" stroke-width="1.2" stroke-dasharray="5 4"/>`;
      svg+=`<text x="${W-padR-4}" y="${(yOf(ref.hi)-4).toFixed(1)}" text-anchor="end" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">${escH(ref.lbl)}</text>`;
    }
    // Actual-Linie + Punkte, Forecast als hohle Punkte
    let d='';use.forEach((p,i)=>{d+=(i?'L':'M')+xOf(tagMs(p[0])).toFixed(1)+' '+yOf(p[1]).toFixed(1);});
    svg+=`<path d="${d}" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`;
    const r=use.length>80?1.4:2.4;
    use.forEach(p=>{const xx=xOf(tagMs(p[0]));
      if(p[2]!=null)svg+=`<circle cx="${xx.toFixed(1)}" cy="${yOf(p[2]).toFixed(1)}" r="${r+0.6}" fill="none" stroke="var(--t1)" stroke-width="1"/>`;
      svg+=`<circle cx="${xx.toFixed(1)}" cy="${yOf(p[1]).toFixed(1)}" r="${r}" fill="var(--blue)"/>`;});
    // Naechster Termin
    if(sp.next){
      const xn=xOf(tagMs(sp.next.d));
      svg+=`<line x1="${xn.toFixed(1)}" x2="${xn.toFixed(1)}" y1="${yTop}" y2="${yBot}" stroke="var(--t1)" stroke-width="1.2" stroke-dasharray="${sp.next.sicher?'4 3':'2 4'}"/>`;
      svg+=`<text x="${(xn-4).toFixed(1)}" y="${yTop+11}" text-anchor="end" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">${sp.next.sicher?'Next':'~Next'} ${escH(fmtDayHdr(sp.next.d))}</text>`;
      if(sp.next.fc!=null){const yf=yOf(sp.next.fc);svg+=`<path d="M${xn.toFixed(1)} ${(yf-4.5).toFixed(1)} L${(xn+4.5).toFixed(1)} ${yf.toFixed(1)} L${xn.toFixed(1)} ${(yf+4.5).toFixed(1)} L${(xn-4.5).toFixed(1)} ${yf.toFixed(1)} Z" fill="var(--bg1)" stroke="var(--t0)" stroke-width="1.3"><title>Forecast ${escH(fmtIndVal(sp.next.fc,''))}</title></path>`;}
    }
    let yNext=yBot;
    // Ueberraschungs-Balken (Actual minus Forecast)
    if(mitSur){
      const ys=yBot+6,mid=ys+SH/2,mx=Math.max(...sur.map(o=>Math.abs(o.s)))||1;
      svg+=`<line x1="${padL}" x2="${W-padR}" y1="${mid}" y2="${mid}" stroke="var(--bd)" stroke-width="1"/><text x="${padL-6}" y="${mid+3.5}" text-anchor="end" style="${fs}">Surp.</text>`;
      const bw=Math.max(1.5,Math.min(7,(W-padL-padR)/Math.max(1,use.length)*0.6));
      sur.forEach(o=>{const xx=xOf(tagMs(o.d)),h=Math.abs(o.s)/mx*(SH/2-1);
        svg+=`<rect x="${(xx-bw/2).toFixed(1)}" y="${(o.s>=0?mid-h:mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.8,h).toFixed(1)}" fill="${mkFarbe(o.ton)}" fill-opacity=".85"/>`;});
      yNext=ys+SH;
    }
    hover.push({name:indName(sp.ind),unit:sp.unit||'',pts:use,yTop,yBot:yNext});
    y=yNext+LUECKE;
  });
  // Gemeinsame Zeitachse unten
  const H=y+ACHSE-LUECKE+4;
  const jahre=(x1-x0)/(365.25*864e5);
  const ticks=[];const t=new Date(x0);t.setUTCDate(1);
  const schritt=jahre>6?24:jahre>3?12:jahre>1.5?6:3;
  t.setUTCMonth(Math.ceil(t.getUTCMonth()/schritt)*schritt);
  while(t.getTime()<=x1){ticks.push(t.getTime());t.setUTCMonth(t.getUTCMonth()+schritt);}
  const ya=H-8;
  let letzteX=-1e9;
  ticks.forEach(tt=>{const xx=xOf(tt);if(xx<padL-1||xx>W-padR+1||xx-letzteX<58)return;letzteX=xx;
    const dd=new Date(tt),lbl=dd.toLocaleString('en-US',{month:'short',timeZone:'UTC'})+' '+String(dd.getUTCFullYear()).slice(2);
    svg+=`<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${bahnH}" y2="${H-ACHSE+2}" stroke="var(--bd)" stroke-width="1" stroke-dasharray="1 3"/><text x="${xx.toFixed(1)}" y="${ya}" text-anchor="middle" style="${fs}">${lbl}</text>`;});
  const xh=xOf(heute);
  svg+=`<line x1="${xh.toFixed(1)}" x2="${xh.toFixed(1)}" y1="${bahnH}" y2="${H-ACHSE+2}" stroke="var(--t2)" stroke-width="1"/><text x="${xh.toFixed(1)}" y="${ya}" text-anchor="middle" style="${fs};font-weight:700;paint-order:stroke;stroke:var(--bg1);stroke-width:3px">Today</text>`;
  svg+=`<line class="mk-cur" x1="0" x2="0" y1="${bahnH}" y2="${H-ACHSE+2}" stroke="var(--t0)" stroke-width="1" style="display:none"/>`;
  box.innerHTML=`<svg class="mk-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escH(rub.name)} indicators over time" onpointermove="makroHover(event,this)" onpointerdown="makroHover(event,this)" onpointerleave="makroHoverAus(this)">${svg}</svg>`;
  box.__mk={x0,span,padL,padR,W,hover};
}
function makroHover(ev,svgEl){
  try{
    const box=svgEl.closest('.mk-chart');const m=box&&box.__mk;if(!m)return;
    const rc=svgEl.getBoundingClientRect();const px=(ev.clientX-rc.left)*(m.W/rc.width);
    if(px<m.padL||px>m.W-m.padR)return;
    const t=m.x0+(px-m.padL)/(m.W-m.padL-m.padR)*m.span;
    const cur=svgEl.querySelector('.mk-cur');if(cur){cur.setAttribute('x1',px.toFixed(1));cur.setAttribute('x2',px.toFixed(1));cur.style.display='';}
    const zeilen=m.hover.map(h=>{let best=null,bd=Infinity;h.pts.forEach(p=>{const dd=Math.abs(tagMs(p[0])-t);if(dd<bd){bd=dd;best=p;}});
      if(!best)return'';
      return`<span class="mk-read-z"><b>${escH(h.name)}</b> ${escH(fmtIndVal(best[1],h.unit))}${best[2]!=null?` <i>fc ${escH(fmtIndVal(best[2],h.unit))}</i>`:''} <i>${escH(fmtDayHdr(best[0]))}</i></span>`;}).join('');
    const rd=box.parentElement&&box.parentElement.querySelector('.mk-read');if(rd)rd.innerHTML=zeilen;
  }catch(e){}
}
function makroHoverAus(svgEl){try{const c=svgEl.querySelector('.mk-cur');if(c)c.style.display='none';}catch(e){}}
let _mkRz=0;
try{window.addEventListener('resize',()=>{clearTimeout(_mkRz);_mkRz=setTimeout(()=>makroZeichnenAlle(),150);});}catch(e){}

export {MK_RUBS,MK_DIMS,MK_ZIELBAND,makroIstCharts,makroLeisteHtml,makroChartsHtml,makroSchalterHtml,makroGross,makroAnsichtSetzen,makroAnsichtWert,makroZeichnenAlle,mkVorschlaege,mkReferenz,mkCcy};
if(typeof window!=='undefined')Object.assign(window,{makroSicht,makroGross,makroRange,makroSpur,makroEinstufen,makroHover,makroHoverAus,makroZeichnenAlle,mkVorschlaege,mkReferenz,MK_DIMS,MK_ZIELBAND,
  // nur fuer check/makro.js (Spurkopf gegen die echte Reihe)
  fmtIndVal});
