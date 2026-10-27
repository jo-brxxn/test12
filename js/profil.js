// ══ COUNTRY PROFILE (Nutzer 2026-10-25) ══════════════════════════════════
// Nutzer: "eine neue karte die sich von ganz links nach ganz rechts erstreckt
// ueber macro ... die info karte fuer das asset ... in drei spalten ganz links
// was zur zentralbank ... wann sie typisch erhoehen und wann sie senken und
// worauf dabei geschaut wird und dadrunter der aktuellste wert ... in der mitte
// die aufgliederung des bip und arbeitsmarkt ... rechts ... wovon es abhaengt
// also carry oder oel oder milchpreis usw und immer alles direkt mit
// indikatoren dadrunter ... leg fokus auf gutes aussehen" - "nenn die neue
// karte country profile und fueg sie erstmal nur bei fx ein".
//
// NUR ANZEIGE. Nichts hier schreibt in den Score.
// Drei Arten von Inhalt, bewusst getrennt:
//  1) feste Fakten (CP): Mandat, Reaktionsmuster, Abkommen, Historie - jede
//     Zahl darin traegt Quelle/Jahr oder ist ein Datum (Regel 4: nichts, was
//     still veraltet, ohne Stand). Schwellen sind Faustwerte aus den letzten
//     Zyklen und als "≈" markiert.
//  2) Live-Werte aus den vorhandenen Feeds (Leitzins, Inflation, Arbeitsmarkt,
//     Rohstoffe, 2Y-Abstand, Korb gegen S&P 500) - dieselben Quellen wie die
//     Karten darunter.
//  3) country_data.json (Workflow-Schritt "Fetch country profile data"):
//     Weltbank-BIP-Aufteilung, Euro-Spreads, SNB-Sichtguthaben, China-PMI,
//     BoE-Stimmen. Wird bei Bedarf geladen; fehlt sie, steht das da.
// Messwerte (t-Werte) stammen aus der Untersuchung 2016-2026, siehe
// docs/CHANGELOG.md VERSION-CHECK-632/633.
import {BC,FX} from './constants.js';
import {escH,icn,getSym,abInfoBtn,abGoToHtml,biasCss,indName,indZeilenWerte,indNextReleaseCell,stripPeriodSuffix,
  INFL_ZIEL,nivAlle,nivEintrag,nivReihe,DATA_BASE,FEED_TIMEOUT_MS,todayStr,
  COMMODITY_DATA,rohstoffReihe,rohstoffTrend,korbReihe,zinsdiffFuer,ROHSTOFF_KORB,
  indHistChart,indChartSeries,rohstoffTrendChartHtml,timeRangeBarHtml,timeRangeCustomHtml,TIME_RANGES,brushCustom,ROHSTOFF_NAME,
  attachChartHovers,openM,closeM,syms,indAsOfNextHtml,dataRaster,DATA_MIN_CHART_H,chartLeisteHtml,fmtDayHdr} from './main.js';
import {priceSeriesFor} from './data-feeds.js';
import {indScore} from './score.js';
import {fmtDayShort} from './calendar.js';

// ⚠ Als Funktion, nicht als Wert: der zirkulaere Import (main.js <-> profil.js)
// laesst escH beim Laden dieser Datei noch in der Todeszone - 'const h=escH'
// brach den ganzen Start ab ("Cannot access 'escH' before initialization").
const h=x=>escH(x);
// ── 1) FESTE FAKTEN ───────────────────────────────────────────────────────
// tempo: 'fast' | 'mid' | 'slow' | 'vslow'. Rohstoffe: [id, Richtung fuer die
// Waehrung (+ = steigender Preis hilft), Hinweis]. Score-Gewichte stehen in
// ROHSTOFF_KORB (main.js) und werden live gelesen, nicht hier abgeschrieben.
const CP={
  USD:{land:'United States',bank:'Federal Reserve',kurz:'Fed',ziel:['2%','PCE inflation + maximum employment'],
    tempo:['mid','Mixed','quick to cut when jobs weaken · slow to hike (2021 "transitory")'],
    folge:'Moves most on CPI (t 2.9) and services PMI (t 2.1) — payrolls ≈ 0 at the daily close',
    hebt:['Core PCE <b>above ~3%</b> for months','Inflation expectations rising'],
    senkt:['Unemployment <b>+0.5 pp</b> over its 12-month low (Sahm rule)','Payrolls 3-month average <b>below ~50k</b>'],
    schaut:['Core PCE','Payrolls','Unemployment','Wages','ISM services'],
    neutral:'~3.0–3.1% <i>(FOMC long-run median, Mar ’26)</i>',
    typisch:['<b>Reserve currency</b>: bid in global panics (<i>dollar smile</i>)','A Fed surprise moves every other currency'],
    abh:[['Trade','Exports only ~11% of GDP <i>(lowest in the G10)</i>'],['Energy','Net energy exporter since 2019'],['Fiscal','Large deficits · term-premium risk <i>(Apr ’25)</i>']],
    deals:['<b>USMCA</b> · review Jul ’26 not extended → yearly reviews','<b>IEEPA tariffs</b> struck down (Feb 20, 26) · replaced via Sec. 122/232/301','2025 deals: EU/Japan 15% · UK 10% · Switzerland 15%'],
    roh:[['OIL',1,'net exporter']]},
  EUR:{land:'Euro area',bank:'European Central Bank',kurz:'ECB',ziel:['2%','HICP inflation · symmetric, medium term'],
    tempo:['slow','Slow','consensus of 26 governors · hiked 4 months after the Fed in 2022'],
    folge:'Barely moves on single releases (most |t| < 1.5) — rates and energy move it',
    hebt:['Core HICP <b>above ~2.5–3%</b>','Wage growth <b>above ~3.5%</b> (ECB wage tracker)'],
    senkt:['Core inflation forecast <b>below 2%</b>','PMIs <b>below 50</b> for months'],
    schaut:['Core & services HICP','Negotiated wages','PMIs','Bond spreads (TPI)'],
    neutral:'~1.75–2.25% <i>(ECB staff estimates)</i>',
    typisch:['<b>Rate gap to the USD</b> drives EUR/USD','Spread stress (Italy, France) weakens the euro','Hiked into the oil shocks of 2008 and 2011 — and reversed'],
    abh:[['Energy','Imports most of its gas and oil · gas spikes weigh <i>(2022: parity)</i>'],['Industry','German exports: cars, machinery, chemicals'],['Spreads','Italy / France vs Bund = fragmentation risk']],
    deals:['<b>EU–US deal</b> Jul ’25: 15% tariff cap','EU–UK Trade and Cooperation Agreement (2021)','EU–Japan EPA (2019)'],
    roh:[['GAS',-1,'imports gas'],['OIL',-1,'imports oil']],
    laender:{DE:['Germany','Industry & exports · low debt · fiscal turn 2025 (defence, €500 bn infrastructure)','Energy-hungry industry · China competition · car tariffs'],
      FR:['France','Large services sector · nuclear power','High deficit & debt · unstable governments · rating cuts 2025'],
      IT:['Italy','Primary surplus · strong northern exporters · tourism','Debt among the EU highest · low growth · spread risk'],
      ES:['Spain','Fastest growth of the big four · tourism · cheap renewables','High (youth) unemployment'],
      NL:['Netherlands','Trade hub (Rotterdam) · large surpluses · low debt','Housing shortage · end of Groningen gas']}},
  GBP:{land:'United Kingdom',bank:'Bank of England',kurz:'BoE',ziel:['2%','CPI inflation'],
    tempo:['mid','Gradual','9 votes · 25 bp steps · the vote split is the early signal'],
    folge:'Reacts more to jobs data (t 1.4–1.9) than to CPI (headline t −1.4)',
    hebt:['Services CPI <b>above ~5%</b>','Private regular pay <b>above ~4.5–5%</b>'],
    senkt:['Services CPI <b>towards ~4%</b>','Pay growth <b>~3–3.5%</b>','Unemployment rising <b>towards ~5%</b>'],
    schaut:['Services CPI','Private regular pay','MPC vote split','Gilt market'],
    neutral:'~3–3.5% <i>(MPC members, 2025)</i>',
    typisch:['<b>Twin deficits</b>: needs foreign money → falls when gilts sell off <i>(2022, Jan ’25)</i>','Dissenting votes often lead the next move'],
    abh:[['Services','~80% of output · finance ~9%'],['External','Current account deficit · funded by foreign capital'],['Fiscal','Budget credibility moves gilts and sterling']],
    deals:['<b>Brexit TCA</b> (2021) · Windsor Framework (2023)','<b>US–UK deal</b> May ’25: 10% baseline','CPTPP since Dec ’24 · UK–India FTA (2025)'],
    roh:[['GAS',-1,'imports gas (UK prices track TTF)']]},
  JPY:{land:'Japan',bank:'Bank of Japan',kurz:'BoJ',ziel:['2%','inflation "stable and sustainable" with rising wages'],
    tempo:['vslow','Very slow','moves every few meetings · plans leak beforehand (Nikkei, Jiji)'],
    folge:'CPI beats did NOT lift the yen (t −2.0, 2016–21) — the BoJ did not react',
    hebt:['Spring wage round <b>≥ ~4–5%</b> <i>(2026: 5.01%)</i>','Core-core CPI <b>≥ 2%</b>','Weak yen lifting import prices'],
    senkt:['Market turmoil <i>(Aug ’24: paused)</i>','Political pressure'],senktLbl:'Pauses when',
    schaut:['Shunto wages','Tokyo CPI','Services prices','Yen level'],
    neutral:'~1–2.5% nominal <i>(BoJ estimate)</i>',
    typisch:['<b>Funding currency of the carry trade</b>: weak in calm markets, jumps when carry unwinds <i>(Aug 5, 24)</i>','<b>Interventions</b> come from the Ministry of Finance, not the BoJ'],
    eingriffe:['2022: at 145.9 and 151.9','2024: at 160.2 and 161.9','2026: above 160 in Apr/May (¥11.7 trn) · 30 Jul with the US at ~164'],
    abh:[['Energy','~90% imported · oil & LNG up = trade deficit'],['Rates abroad','US–Japan yield gap drives USD/JPY'],['Income','Investment income keeps the current account positive']],
    deals:['<b>US–Japan deal</b> Jul ’25: 15% tariffs, $550 bn investment pledge','CPTPP · RCEP · EU–Japan EPA'],
    roh:[['OIL',-1,'imports oil'],['LNG',-1,'imports LNG']]},
  CHF:{land:'Switzerland',bank:'Swiss National Bank',kurz:'SNB',ziel:['0–2%','CPI = price stability'],
    tempo:['fast','Fast','4 meetings a year · likes to surprise (2015, first G10 cut Mar ’24)'],
    folge:'Swiss data barely moves the franc — risk and the SNB do',
    hebt:['Inflation forecast <b>above 2%</b>'],
    senkt:['Forecast <b>below ~0.5%</b> with a strong franc → negative rates possible'],
    schaut:['CPI','Franc (EUR/CHF)','ECB'],
    neutral:'~0–1% <i>(estimates vary)</i>',
    typisch:['<b>Safe haven</b>: rises in crises','<b>SNB sells francs</b> (FX interventions) — sight deposits rise when it does','2011 floor 1.20 · removed Jan 15, 15: +20–30% in minutes'],
    abh:[['Pharma','> 50% of goods exports <i>(2025: CHF 152 bn of 287 bn)</i>'],['Gold','Refining hub: gold flows distort trade and GDP'],['Statistics','Read GDP sport-event adjusted (SECO)']],
    deals:['<b>US tariff</b> 39% → 15% (from Nov 14, 25)','EU Bilaterals I/II · new package agreed Dec ’24','FTA with China (2014)'],
    roh:[['GOLD',1,'gold refining & trade']]},
  CAD:{land:'Canada',bank:'Bank of Canada',kurz:'BoC',ziel:['2%','CPI · 1–3% band · core trim / median'],
    tempo:['fast','Fast','first G7 bank to cut in 2024 · 50 bp steps when needed'],
    folge:'Most rate-driven of the eight (2Y link 0.46) · jobs report counts',
    hebt:['Core measures <b>above ~3%</b>','Inflation expectations rising'],
    senkt:['Unemployment <b>above ~6.5–7%</b>','GDP shrinking'],
    schaut:['CPI-trim / median','Labour Force Survey','Housing','US economy'],
    neutral:'2.25–3.25% <i>(BoC range)</i>',
    typisch:['Mortgages reset every ~5 years: rate moves hit households fast','Inflation-target framework renewal due by end-2026'],
    abh:[['USA','~75% of exports go to the US'],['Energy','~¼ of goods exports · 63% of US crude imports <i>(2025)</i>'],['Households','Debt ~175% of disposable income']],
    deals:['<b>CUSMA / USMCA</b>: review Jul ’26 not extended → yearly reviews to 2036','<b>US 50% tariffs</b> on some goods (Sec. 338, 2026) · counter-tariffs','CETA (EU) · CPTPP'],
    roh:[['OIL',1,'exports oil']]},
  AUD:{land:'Australia',bank:'Reserve Bank of Australia',kurz:'RBA',ziel:['2–3%','CPI · aims for 2.5% · plus full employment'],
    tempo:['mid','Cautious','2023 peak only 4.35% · 2026: four hikes'],
    folge:'Data-driven: jumps on jobs (t 2.5) and CPI (t 1.9)',
    hebt:['Trimmed mean <b>above ~3%</b> (q/q > ~0.7)','Unemployment <b>below ~4.3%</b>'],
    senkt:['Trimmed mean back in the band','Unemployment <b>≥ ~4.5%</b>'],
    schaut:['Trimmed mean CPI','Unemployment','Wage price index','China'],
    neutral:'~3–3.75% <i>(estimates vary)</i>',
    typisch:['<b>Risk currency</b>: falls in global sell-offs','China proxy via iron ore'],
    abh:[['China','29% of exports <i>(DFAT 2025)</i>'],['Mining','Iron ore 18% · coal 10% · gas 9% · gold 9% of exports <i>(DFAT 2025)</i>']],
    deals:['<b>ChAFTA</b> with China (2015)','RCEP · CPTPP · AUKUS (2021)','China curbs 2020 (coal, barley, wine) · lifted 2023–24'],
    roh:[['IRON',1,'exports iron ore'],['COAL',1,'exports coal'],['GOLD',1,'exports gold'],['LNG',1,'exports LNG']],china:true},
  NZD:{land:'New Zealand',bank:'Reserve Bank of New Zealand',kurz:'RBNZ',ziel:['1–3%','CPI · aims for 2% · price stability only since end-2023'],
    tempo:['fast','Fast','first G10 hike in 2021 · cut in 50 bp steps 2024/25'],
    folge:'Strongest reaction to own data of all eight: CPI +58 bp (t 3.8)',
    hebt:['CPI <b>above 3%</b>','Non-tradables inflation high','Inflation expectations rising'],
    senkt:['Recession','Unemployment <b>~5%+</b>'],
    schaut:['CPI','Non-tradables','Expectations survey','House prices','Dairy'],
    neutral:'~2.5–3.5% <i>(RBNZ estimate)</i>',
    typisch:['Fast bank → <b>swings hard on data</b>','<b>Risk currency</b>, moves with the AUD'],
    abh:[['Dairy','~30% of goods exports · 22% of world dairy trade <i>(2025)</i>'],['China','Largest buyer · dairy tariff-free since Jan ’24'],['External','Large current account deficit → needs capital inflows']],
    deals:['<b>CER</b> with Australia (1983)','NZ–China FTA (2008, upgraded 2022)','CPTPP · NZ–UK (2023) · NZ–EU (2024)'],
    roh:[['DAIRY',1,'exports dairy']],china:true}
};
const TEMPO_TXT={fast:'Fast mover',mid:'Medium',slow:'Slow mover',vslow:'Very slow'};

// ── 3) country_data.json (bei Bedarf) ────────────────────────────────────
let CP_DATA=null,cpLaden=null,cpFehler=false;
function cpDatenHolen(){
  if(CP_DATA||cpLaden)return;
  const ac=typeof AbortController!=='undefined'?new AbortController():null;
  const t=ac?setTimeout(()=>ac.abort(),FEED_TIMEOUT_MS):null;
  cpLaden=fetch(DATA_BASE+'country_data.json?t='+Math.floor(Date.now()/3e5),ac?{signal:ac.signal,cache:'no-store'}:{cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(d=>{if(d&&typeof d==='object')CP_DATA=d;else cpFehler=true;})
    .catch(()=>{cpFehler=true;})
    .finally(()=>{if(t)clearTimeout(t);cpLaden=null;cpNeuZeichnen();});
}
function cpNeuZeichnen(){
  const el=document.getElementById('cpKarte'),s=getSym();
  if(!el||!s||!FX.includes(s.id))return;
  const t=document.createElement('template');t.innerHTML=countryProfileHtml(s);
  const neu=t.content.firstElementChild;if(neu)el.replaceWith(neu);
}

// ── Kleine Bausteine ──────────────────────────────────────────────────────
const fmt=(v,d)=>v==null||!isFinite(v)?'–':(+v).toFixed(d==null?1:d);
// Vorzeichen erst NACH dem Runden: -0.004 wurde sonst als "−0.00" gezeigt (CAD-Abstand 2026-10-25).
const vz=(v,d)=>{if(v==null||!isFinite(v))return'–';const t=Math.abs(v).toFixed(d==null?1:d);return(+t===0?'':v>0?'+':'−')+t;};
const leer=t=>`<div class="cp-leer">${t}</div>`;
// Gestreckte Linie ohne Text und ohne Kreise (Design-Regel C: gestreckte SVGs
// tragen keinen Text). Bezugslinie gestrichelt (Ziel = blau wie in den Makro-Charts).
// o.k: Schluessel im Chart-Fenster (cpfKatalog) - dann oeffnet ein Klick die
// Linie dort in voller Groesse (Nutzer 2026-10-25). Das Symbol oben rechts ist
// immer sichtbar (Touch: kein Hover-only, Design-Audit Runde 2).
function cpKlick(k,svg){
  if(!k)return svg;
  const a=`cpfOeffnen('${h(k)}')`;
  return`<div class="cp-spk" role="button" tabindex="0" onclick="${a}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${a}}" title="Open as a full chart">${svg}<span class="cp-spk-i" aria-hidden="true">${icn('expand',11)||''}</span></div>`;
}
function cpSpark(pts,o){
  o=o||{};
  const p=(pts||[]).filter(e=>e&&isFinite(e[1]));
  if(p.length<3)return'';
  const vs=p.map(e=>e[1]).concat(o.ref!=null?[o.ref]:[]);
  let lo=Math.min(...vs),hi=Math.max(...vs);if(hi===lo){hi+=1;lo-=1;}
  const pad=(hi-lo)*0.08;lo-=pad;hi+=pad;
  const X=i=>(i/(p.length-1)*100).toFixed(2),Y=v=>(30-(v-lo)/(hi-lo)*30).toFixed(2);
  const linie=p.map((e,i)=>`${X(i)},${Y(e[1])}`).join(' ');
  const ref=o.ref!=null?`<line x1="0" x2="100" y1="${Y(o.ref)}" y2="${Y(o.ref)}" class="cp-sp-ref${o.refZiel?' cp-sp-ziel':''}" vector-effect="non-scaling-stroke"/>`:'';
  return cpKlick(o.k,`<svg class="cp-sp" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">${ref}<polyline points="${linie}" fill="none" style="stroke:${o.col||'var(--ui-act)'}" vector-effect="non-scaling-stroke"/></svg>`);
}
function cpSparZeile(pts,o,von){
  const s=cpSpark(pts,o);if(!s)return'';
  const d0=pts[0]&&pts[0][0],d1=pts[pts.length-1]&&pts[pts.length-1][0];
  return`<div class="cp-spz">${s}<div class="cp-spz-a"><span>${d0?h(fmtDayShort(String(d0).slice(0,10))):''}</span>${o&&o.refLbl?`<span class="${o.refZiel?'cp-zl':''}">${o.refLbl}</span>`:''}<span>${d1?h(fmtDayShort(String(d1).slice(0,10))):''}</span></div></div>`;
}
// Staatsschulden: IWF WEO (Gesamtstaat, alle 13 Laender), sonst Eurostat, sonst Weltbank.
// [Jahr, % des BIP, Quelle] - die Weltbank-Reihe fehlte fuer Euroraum, DE,
// FR, IT, NL (erster Lauf 2026-10-25).
function cpSchuld(d,k){
  const i=d&&d.imf&&d.imf.debt&&d.imf.debt[k];if(i)return[i[0],i[1],'IMF'];
  // IWF blockte den Runner (403, Lauf 1369) - Eurostat fuer Euroraum + 5 Laender
  const e=d&&d.eurostat&&d.eurostat.debt&&d.eurostat.debt[k];if(e)return[e[0],e[1],'Eurostat'];
  const w=d&&d.wb&&d.wb.countries&&d.wb.countries[k]&&d.wb.countries[k]['GC.DOD.TOTL.GD.ZS'];return w?[w[0],w[1],'World Bank']:null;
}
function cpSchuldQuellen(d,keys){const q=[...new Set(keys.map(k=>(cpSchuld(d,k)||[])[2]).filter(Boolean))];return q.length?q.join(' / '):'–';}
const seit=(pts,tage)=>{if(!pts||!pts.length)return[];const ab=Date.parse(todayStr())-tage*864e5;return pts.filter(e=>Date.parse(String(e[0]).slice(0,10))>=ab);};
function cpInd(sym,base){
  for(const rub of (sym.rubrics||[]))for(const i of (rub.indicators||[]))if(i&&stripPeriodSuffix(i.name).base===base)return{ind:i,rub};
  return null;
}
// Indikator als kompakte Zeile: Name · ACT in Bias-Farbe · Score-Beitrag
function cpIndZeile(sym,base,lbl){
  const f=cpInd(sym,base);if(!f)return'';
  const {ind,rub}=f;let w=null;try{w=indZeilenWerte(ind,rub);}catch(e){w=null;}
  const act=w&&w.actTxt!=null&&w.actTxt!=='–'?String(w.actTxt).replace(/<[^>]*>/g,''):((ind.research||{}).actual||'–');
  let sc=0;try{sc=indScore(ind,rub);}catch(e){sc=0;}
  const col=ind.bias==='bull'||ind.bias==='sbull'?BC.bull:ind.bias==='bear'||ind.bias==='sbear'?BC.bear:'var(--t1)';
  return`<div class="cp-ind"><span class="cp-ind-n">${h(lbl||indName(ind))}</span><b style="color:${col}">${h(String(act))}</b>${sc?`<span class="cp-pkt" style="color:${sc>0?BC.bull:BC.bear}">${sc>0?'+':''}${sc}</span>`:'<span class="cp-pkt cp-pkt0">0</span>'}</div>`;
}
const kv=(l,v,x)=>`<div class="cp-kv"><span class="cp-l">${l}</span><span class="cp-v">${v}</span>${x?`<span class="cp-x">${x}</span>`:''}</div>`;
const sub=(t,x)=>`<div class="cp-sub">${t}${x?`<span class="cp-sub-x">${x}</span>`:''}</div>`;

// ── Live: Leitzins, letzte Aenderung ─────────────────────────────────────
function cpLeitzins(ccy){
  const r=nivReihe(nivEintrag(ccy,'Central Bank Rate'));
  if(!r.length)return null;
  const jetzt=r[r.length-1];let letzte=null;
  for(let i=r.length-1;i>0;i--){if(Math.abs(r[i][1]-r[i-1][1])>=0.05){letzte={d:r[i][0],bp:Math.round((r[i][1]-r[i-1][1])*100)};break;}}
  return{wert:jetzt[1],datum:jetzt[0],letzte,reihe:r};
}
// ── Live: Risiko-Rolle (Nutzer: "Nur Anzeige ... Hafen oder nicht") ──────
// Taegliche Korb-Rendite gegen die S&P-500-Rendite, letzte 250 gemeinsame
// Tage; t aus der Regression. |t| >= 2 = klare Rolle. Dazu der Stress-Stand:
// S&P-Schwankung (20 Tage) als Perzentil des letzten Jahres.
function cpRisiko(ccy){
  const k=korbReihe(ccy),sp=priceSeriesFor('SP500');
  if(!Array.isArray(k)||!Array.isArray(sp))return null;
  const kp=new Map(k.map(e=>[String(e[0]).slice(0,10),+e[1]])),spm=new Map(sp.map(e=>[String(e[0]).slice(0,10),+e[1]]));
  const tage=[...kp.keys()].filter(d=>spm.has(d)).sort();
  const x=[],y=[];
  for(let i=1;i<tage.length;i++){const a=tage[i-1],b=tage[i];const rx=Math.log(spm.get(b)/spm.get(a)),ry=Math.log(kp.get(b)/kp.get(a));if(isFinite(rx)&&isFinite(ry)){x.push(rx);y.push(ry);}}
  const n=Math.min(250,x.length);if(n<120)return null;
  const xs=x.slice(-n),ys=y.slice(-n),mx=xs.reduce((a,v)=>a+v,0)/n,my=ys.reduce((a,v)=>a+v,0)/n;
  let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(xs[i]-mx)**2;sxy+=(xs[i]-mx)*(ys[i]-my);}
  const b=sxy/sxx;let sr=0;for(let i=0;i<n;i++)sr+=(ys[i]-my-b*(xs[i]-mx))**2;
  const t=b/Math.sqrt(sr/(n-2)/sxx);
  // Stress: 20-Tage-Schwankung des S&P als Perzentil der letzten 252 Tage
  const sr2=sp.map(e=>+e[1]).filter(v=>v>0),ret=[];for(let i=1;i<sr2.length;i++)ret.push(Math.log(sr2[i]/sr2[i-1]));
  const vol=i=>{const w=ret.slice(i-19,i+1);return Math.sqrt(w.reduce((a,v)=>a+v*v,0)/w.length*252);};
  let pct=null;if(ret.length>280){const jetzt=vol(ret.length-1),hist=[];for(let i=ret.length-252;i<ret.length;i++)hist.push(vol(i));pct=Math.round(hist.filter(v=>v<=jetzt).length/hist.length*100);}
  return{beta:b,t,n,pct,rolle:t<=-2?'haven':t>=2?'risk':'none'};
}

// ── Spalte 1: Zentralbank ────────────────────────────────────────────────
function cpSpalteBank(sym,c,d){
  const lz=cpLeitzins(sym.id),niv=(nivAlle()||{})[sym.id]||{};
  const f=cpInd(sym,'Central Bank Rate');
  let next='';try{next=f?String(indNextReleaseCell(sym.id,f.ind)).replace(/<[^>]*>/g,'').trim():'';}catch(e){next='';}
  const infl=niv.infl;
  const cpiBase=sym.id==='USD'?'PCE':'CPI (Headline)';
  const cpiR=seit(nivReihe(nivEintrag(sym.id,cpiBase)),3*365);
  let h1=`<div class="cp-kopf">${icn('landmark',14)||''}<span>Central bank</span></div>
    <div class="cp-bank">${h(c.bank)} <span class="cp-kurz">${h(c.kurz)}</span></div>
    <div class="cp-ziel"><span class="cp-l">Target</span><b class="cp-zielz">${h(c.ziel[0])}</b><span class="cp-x">${h(c.ziel[1])}</span></div>
    <div class="cp-tempo cp-tempo-${c.tempo[0]}"><span class="cp-chip">${h(TEMPO_TXT[c.tempo[0]]||c.tempo[1])}</span><i>${h(c.tempo[2])}</i></div>
    <div class="cp-folge">→ ${c.folge}</div>`;
  h1+=sub('Now');
  h1+=kv('Policy rate',lz?`<b>${fmt(lz.wert,2)}%</b>`:'–',lz&&lz.letzte?`<span style="color:${lz.letzte.bp>0?BC.bull:BC.bear}">${lz.letzte.bp>0?'+':'−'}${Math.abs(lz.letzte.bp)} bp</span> <i>${h(fmtDayShort(lz.letzte.d))}</i>`:'');
  if(next)h1+=kv('Next decision',`<b>${h(next)}</b>`,'');
  if(infl)h1+=kv('Inflation vs target',`<b>${h(infl.act)}</b>`,`<i>${h(String(infl.mass||'').replace(/ vs target.*$/,''))}</i>`);
  h1+=cpSparZeile(cpiR,{k:'niv:'+cpiBase,ref:INFL_ZIEL[sym.id],refZiel:true,refLbl:/aims for/.test(c.ziel[1])?`aim ${INFL_ZIEL[sym.id]}%`:c.ziel[0].includes('–')?`mid of ${c.ziel[0]}`:`target ${INFL_ZIEL[sym.id]}%`},'');
  h1+=sub('Hikes when','≈ past cycles');
  h1+=`<ul class="cp-list cp-hebt">${c.hebt.map(x=>`<li><span class="cp-pf" style="color:${BC.bull}">▲</span><span>${x}</span></li>`).join('')}</ul>`;
  h1+=sub(c.senktLbl||'Cuts when','≈ past cycles');
  h1+=`<ul class="cp-list cp-senkt">${c.senkt.map(x=>`<li><span class="cp-pf" style="color:${BC.bear}">▼</span><span>${x}</span></li>`).join('')}</ul>`;
  h1+=sub('Watches');
  h1+=`<div class="cp-tags">${c.schaut.map(x=>`<span class="cp-tag">${h(x)}</span>`).join('')}</div>`;
  h1+=kv('Neutral rate',c.neutral,'');
  h1+=sub('Typical for the '+sym.id);
  h1+=`<ul class="cp-list cp-typ">${c.typisch.map(x=>`<li><span class="cp-pf">•</span><span>${x}</span></li>`).join('')}</ul>`;
  if(c.eingriffe){
    h1+=sub('MoF interventions','USD/JPY');
    const jp=priceSeriesFor('JPY'),last=Array.isArray(jp)&&jp.length?jp[jp.length-1]:null,usdjpy=last&&+last[1]>0?1/(+last[1]):null;
    if(usdjpy)h1+=kv('USD/JPY now',`<b>${fmt(usdjpy,1)}</b>`,`<i>${fmt((160/usdjpy-1)*100,1)}% to 160</i>`);
    h1+=`<ul class="cp-list cp-typ">${c.eingriffe.map(x=>`<li><span class="cp-pf">•</span><span>${h(x)}</span></li>`).join('')}</ul>`;
  }
  if(sym.id==='GBP'){
    const v=d&&d.boe&&Array.isArray(d.boe.votes)?d.boe.votes:[];
    if(v.length){const l=v[v.length-1];h1+=sub('Last MPC vote',h(fmtDayShort(l[0])));
      h1+=`<div class="cp-vote">${l[1]?`<span style="color:${BC.bull}"><b>${l[1]}</b> hike</span>`:''}<span><b>${l[2]}</b> hold</span>${l[3]?`<span style="color:${BC.bear}"><b>${l[3]}</b> cut</span>`:''}</div>`;}
  }
  return`<section class="cp-col cp-cb">${h1}</section>`;
}

// ── Spalte 2: Wirtschaft (BIP + Arbeitsmarkt) ────────────────────────────
const WB_LBL={'NE.CON.PRVT.ZS':'Consumption','NE.GDI.TOTL.ZS':'Investment','NE.CON.GOVT.ZS':'Government'};
function cpBip(sym,wb){
  if(!wb)return leer(cpFehler?'GDP split could not be loaded — World Bank data comes with the next data update.':'GDP split loads with the next data update (World Bank).');
  const g=k=>wb[k]?wb[k][1]:null,jahr=Math.max(...['NE.CON.PRVT.ZS','NE.GDI.TOTL.ZS','NE.CON.GOVT.ZS'].map(k=>wb[k]?wb[k][0]:0));
  const ko=g('NE.CON.PRVT.ZS'),inv=g('NE.GDI.TOTL.ZS'),st=g('NE.CON.GOVT.ZS'),ex=g('NE.EXP.GNFS.ZS'),im=g('NE.IMP.GNFS.ZS');
  if(ko==null||inv==null||st==null)return leer('World Bank has no full GDP split for this economy yet.');
  const nx=ex!=null&&im!=null?ex-im:null;
  const teile=[['ko','Consumption',ko],['inv','Investment',inv],['st','Government',st]];
  const summe=ko+inv+st+(nx!=null&&nx>0?nx:0);
  const bar=teile.map(([k,l,v])=>`<span class="cp-seg cp-seg-${k}" style="flex:${v}" title="${h(l)} ${fmt(v)}% of GDP"></span>`).join('')
    +(nx!=null&&nx>0?`<span class="cp-seg cp-seg-nx" style="flex:${nx}" title="Net exports ${fmt(nx)}% of GDP"></span>`:'');
  let o=`<div class="cp-bar" role="img" aria-label="GDP split">${bar}</div>`;
  // Je Baustein die passenden Indikatoren der App
  const zuord={ko:[['Retail Sales'],['Consumer Confidence']],inv:[['Manufacturing PMI'],['Ifo Business Climate','Ifo'],['ZEW Economic Sentiment','ZEW']],st:[]};
  teile.forEach(([k,l,v])=>{
    const inds=(zuord[k]||[]).map(([b,lb])=>cpIndZeile(sym,b,lb)).filter(Boolean).join('');
    o+=`<div class="cp-teil"><div class="cp-teil-k"><span class="cp-dot cp-seg-${k}"></span><span class="cp-teil-n">${l}</span><b>${fmt(v,0)}%</b></div>${inds?`<div class="cp-teil-i">${inds}</div>`:''}</div>`;
  });
  o+=`<div class="cp-teil"><div class="cp-teil-k"><span class="cp-dot cp-seg-nx"></span><span class="cp-teil-n">Trade</span><b>${nx!=null?vz(nx,0)+'%':'–'}</b><span class="cp-x"><i>exports ${fmt(ex,0)}% · imports ${fmt(im,0)}% of GDP</i></span></div>
    <div class="cp-teil-i">${cpIndZeile(sym,'Services PMI','Services PMI')}${wb['BN.CAB.XOKA.GD.ZS']?`<div class="cp-ind"><span class="cp-ind-n">Current account</span><b style="color:${wb['BN.CAB.XOKA.GD.ZS'][1]>=0?BC.bull:BC.bear}">${vz(wb['BN.CAB.XOKA.GD.ZS'][1])}% of GDP</b><span class="cp-pkt cp-pkt0">${wb['BN.CAB.XOKA.GD.ZS'][0]}</span></div>`:''}</div></div>`;
  const srv=g('NV.SRV.TOTL.ZS'),man=g('NV.IND.MANF.ZS'),agr=g('NV.AGR.TOTL.ZS');
  if(srv!=null||man!=null)o+=`<div class="cp-mini">${[srv!=null?`Services <b>${fmt(srv,0)}%</b>`:'',man!=null?`Manufacturing <b>${fmt(man,0)}%</b>`:'',agr!=null?`Farming <b>${fmt(agr,1)}%</b>`:''].filter(Boolean).join(' · ')} <i>of value added</i></div>`;
  o+=`<div class="cp-quelle">World Bank WDI · ${jahr}</div>`;
  return o;
}
function cpArbeit(sym){
  const niv=(nivAlle()||{})[sym.id]||{};
  let o='';
  const ur=seit(nivReihe(nivEintrag(sym.id,'Unemployment Rate')),5*365);
  o+=cpIndZeile(sym,'Unemployment Rate','Unemployment rate');
  if(niv.lab)o+=`<div class="cp-mini"><i>${h(niv.lab.mass)}</i></div>`;
  const med=niv.lab&&/median ([\d.]+)%/.exec(niv.lab.mass||'');
  o+=cpSparZeile(ur,{k:'niv:Unemployment Rate',ref:med?+med[1]:null,refLbl:med?`10y median ${med[1]}%`:''});
  o+=cpIndZeile(sym,'NFP / Employment Change','Employment change');
  o+=cpIndZeile(sym,'Avg Hourly Earnings','Wages');
  if(niv.wage)o+=`<div class="cp-mini"><i>${h(niv.wage.mass)}</i></div>`;
  o+=cpIndZeile(sym,'Unemployment Claims','Jobless claims');
  return o||leer('No labour data for this currency.');
}
function cpLaender(c,d){
  if(!c.laender)return'';
  const wb=d&&d.wb&&d.wb.countries,y10=(d&&d.y10)||{};
  const ez=wb&&wb.EUR&&wb.EUR['NY.GDP.MKTP.CD']?wb.EUR['NY.GDP.MKTP.CD'][1]:null;
  const de=y10.DE&&y10.DE.length?y10.DE[y10.DE.length-1][1]:null;
  const zeilen=Object.keys(c.laender).map(k=>{
    const [name,plus,minus]=c.laender[k],w=wb&&wb[k]||{};
    const anteil=ez&&w['NY.GDP.MKTP.CD']?w['NY.GDP.MKTP.CD'][1]/ez*100:null;
    const wachs=w['NY.GDP.MKTP.KD.ZG']?w['NY.GDP.MKTP.KD.ZG'][1]:null,sd=cpSchuld(d,k),schuld=sd?sd[1]:null;
    const r=y10[k]&&y10[k].length?y10[k][y10[k].length-1][1]:null,spread=k!=='DE'&&r!=null&&de!=null?Math.round((r-de)*100):null;
    return`<div class="cp-land">
      <div class="cp-land-k"><b>${h(name)}</b>${anteil!=null?`<span class="cp-land-a">${fmt(anteil,0)}% of euro area</span>`:''}</div>
      <div class="cp-land-z">${wachs!=null?`<span>Growth <b style="color:${wachs>=0?BC.bull:BC.bear}">${vz(wachs)}%</b></span>`:''}${schuld!=null?`<span>Debt <b>${fmt(schuld,0)}%</b></span>`:''}${spread!=null?`<span>10Y vs Bund <b>${spread>0?'+':''}${spread} bp</b></span>`:''}</div>
      <div class="cp-land-pm"><span class="cp-plus">+ ${h(plus)}</span><span class="cp-minus">− ${h(minus)}</span></div>
    </div>`;
  }).join('');
  return`<div class="cp-sep cp-sep-h" aria-hidden="true"></div><div class="cp-kopf cp-kopf-l"><span>Member states</span><span class="cp-kopf-x">what the euro is made of · share of output · growth · debt · 10Y vs Bund</span></div>`
    +`<div class="cp-laender">${zeilen}</div>${wb?`<div class="cp-quelle">World Bank WDI · debt: ${h(cpSchuldQuellen(d,Object.keys(c.laender)))} · 10Y yields: TradingView</div>`:''}`;
}
function cpSpalteWirtschaft(sym,c,d){
  const wb=d&&d.wb&&d.wb.countries&&d.wb.countries[sym.id];
  let o=`<div class="cp-kopf">${icn('chart',14)||''}<span>Economy</span><span class="cp-kopf-x">${h(c.land)}</span></div>`;
  o+=sub('GDP by spending');
  o+=cpBip(sym,wb);
  o+=sub('Growth');
  o+=cpIndZeile(sym,'GDP Growth QoQ','GDP q/q');
  const sd=cpSchuld(d,sym.id);
  if(wb&&wb['NY.GDP.MKTP.KD.ZG'])o+=`<div class="cp-mini">Real growth ${wb['NY.GDP.MKTP.KD.ZG'][0]}: <b style="color:${wb['NY.GDP.MKTP.KD.ZG'][1]>=0?BC.bull:BC.bear}">${vz(wb['NY.GDP.MKTP.KD.ZG'][1])}%</b>${sd?` · government debt <b>${fmt(sd[1],0)}%</b> of GDP <i>(${sd[2]} ${sd[0]})</i>`:''}</div>`;
  o+=sub('Labour market');
  o+=cpArbeit(sym);
  return`<section class="cp-col cp-eco">${o}</section>`;
}

// ── Spalte 3: wovon es abhaengt ──────────────────────────────────────────
const ROH_LBL={IRON:'Iron ore',COAL:'Coal',GOLD:'Gold',DAIRY:'Dairy (WMP futures)',OIL:'Crude oil (WTI)',GAS:'Gas (TTF)',LNG:'LNG (JKM)'};
function cpRohstoff(sym,id,richtung,hinweis){
  const it=COMMODITY_DATA&&COMMODITY_DATA.items&&COMMODITY_DATA.items[id];
  const korb=(ROHSTOFF_KORB[sym.id]||[]).find(x=>x[0]===id);
  const reihe=it?rohstoffReihe(id):[];
  const tr=it?rohstoffTrend(id):null,last=tr&&tr.last;
  let zustand='',col='var(--t2)';
  if(last&&last.seite){const gut=last.seite*richtung>0;col=gut?BC.bull:BC.bear;zustand=`${last.seite>0?'above':'below'} EMA20 · ${tr.tage}d`;}
  else if(last)zustand='inside the EMA20 band';
  else if(it)zustand=`building up (${reihe.length}/20 days)`;
  const pr=reihe.length?reihe[reihe.length-1][1]:null,m1=reihe.length>21?(reihe[reihe.length-1][1]/reihe[reihe.length-22][1]-1)*100:null;
  return`<div class="cp-roh">
    <div class="cp-roh-k"><b>${h(ROH_LBL[id]||id)}</b>${pr!=null?`<span class="cp-roh-p">${fmt(pr,pr>100?0:2)}</span>`:''}${m1!=null?`<span class="cp-roh-m" style="color:${m1*richtung>=0?BC.bull:BC.bear}">${vz(m1)}% 1M</span>`:''}
      <span class="cp-roh-s">${korb?`<span class="cp-insc">in score ×${Math.abs(korb[1])}</span>`:'<span class="cp-only">shown only</span>'}</span></div>
    <div class="cp-roh-z"><i>${h(hinweis)}</i>${zustand?` · <span style="color:${col}">${h(zustand)}</span>`:''}</div>
    ${!it?leer('No price feed yet — arrives with the next data update.'):cpSpark(seit(reihe,180),{col,k:'roh:'+id})}
  </div>`;
}
function cpSpalteAbh(sym,c,d){
  let o=`<div class="cp-kopf">${icn('link',14)||''}<span>What moves it</span></div>`;
  // Risiko-Rolle (gemessen)
  const r=cpRisiko(sym.id);
  o+=sub('Risk role','measured · vs S&P 500');
  if(r){
    const lbl=r.rolle==='haven'?'Safe haven':r.rolle==='risk'?'Risk-on currency':'No clear risk role';
    o+=`<div class="cp-rolle cp-rolle-${r.rolle}"><span class="cp-chip">${lbl}</span><i>daily moves vs the S&amp;P 500, last ${r.n} days · t ${vz(r.t)}</i></div>`;
    if(r.pct!=null){const st=r.pct>=90?['Panic',BC.bear]:r.pct>=80?['Stressed',BC.bear]:r.pct<=20?['Calm','var(--ui-act)']:['Normal','var(--t1)'];
      o+=kv('Market stress now',`<b style="color:${st[1]}">${st[0]}</b>`,`<i>S&amp;P 20-day volatility at the ${r.pct}th percentile of 1 year</i>`);}
    o+=`<div class="cp-mini"><i>Measured 2017–26: after panics risk currencies tended to recover within 1–2 weeks — shown only, not in the score.</i></div>`;
  }else o+=leer('Not enough price history to measure the risk role.');
  // Carry
  let z=null;try{z=zinsdiffFuer(sym.id);}catch(e){z=null;}
  o+=sub('Carry','2Y yield vs the other seven');
  if(z){
    const rolle=z.jetzt>=0.75?'High-yielder (carry target)':z.jetzt<=-0.75?'Funding currency':'Middle of the pack';
    o+=kv('Gap now',`<b style="color:${Math.abs(z.jetzt)<0.005?'var(--t1)':z.jetzt>0?BC.bull:BC.bear}">${vz(z.jetzt,2)} pp</b>`,`<i>${h(rolle)}</i>`);
    o+=kv('20-day change',`<b style="color:${z.bp>0?BC.bull:z.bp<0?BC.bear:'var(--t1)'}">${z.bp>0?'+':''}${z.bp} bp</b>`,`<i>counts in the score (2Y gap)</i>`);
  }else o+=leer('2Y yield history too short.');
  // Rohstoffe
  if(c.roh&&c.roh.length){o+=sub('Commodities','close vs EMA20');o+=c.roh.map(([id,ri,hw])=>cpRohstoff(sym,id,ri,hw)).join('');}
  // Laenderspezifisches aus country_data.json
  if(sym.id==='EUR'){
    o+=sub('Bond spreads','10Y vs Bund');
    const it=cpfSpreadReihe(d,'IT'),fr=cpfSpreadReihe(d,'FR');
    if(it.length||fr.length){
      [['Italy',it,'IT'],['France',fr,'FR']].forEach(([n,s,k])=>{if(!s.length)return;
        const tag=cpfSpreadReihe(d,k,true),l=s[s.length-1],v=tag.length>20?l[1]-tag[tag.length-21][1]:null;
        o+=kv(n,`<b>${l[1]} bp</b>`,v!=null?`<span style="color:${v>0?BC.bear:v<0?BC.bull:'var(--t2)'}">${v>0?'+':''}${v} bp in 20d</span>`:`<i>${tag.length?'daily from '+h(fmtDayShort(tag[0][0])):'monthly average'}</i>`);
        o+=cpSpark(seit(s,3*365),{col:'var(--ui-act)',k:'spread:'+k});});
    }else o+=leer('Spreads build up from the next data update (ECB · TradingView 10Y yields).');
  }
  if(sym.id==='CHF'){
    const s=d&&d.snb&&d.snb.series,g=s&&(s.GI||s.TG);o+=sub('SNB sight deposits','weekly');
    if(g&&g.length>1){const l=g[g.length-1],v4=g.length>4?l[1]-g[g.length-5][1]:null;
      o+=kv('Latest',`<b>${fmt(l[1]/1000,1)} bn CHF</b>`,`<i>${h(fmtDayShort(l[0]))}</i>`);
      if(v4!=null)o+=kv('4-week change',`<b style="color:${v4>0?BC.bear:v4<0?BC.bull:'var(--t1)'}">${vz(v4/1000,1)} bn</b>`,`<i>${v4>0?'rising = SNB may be selling francs':'no sign of franc selling'}</i>`);
      o+=cpSpark(g.slice(-52),{col:'var(--ui-act)',k:'snb'});
    }else o+=leer('SNB data arrives with the next data update.');
  }
  if(c.china){
    const p=d&&d.china&&d.china.pmi&&d.china.pmi.mfg;o+=sub('China','NBS manufacturing PMI');
    if(p&&p.length){const l=p[p.length-1],sp=l[2]!=null?l[1]-l[2]:null;
      o+=kv('Latest',`<b style="color:${l[1]>=50?BC.bull:BC.bear}">${fmt(l[1])}</b>`,`${sp!=null?`<span style="color:${sp>0?BC.bull:sp<0?BC.bear:'var(--t2)'}">${vz(sp)} vs forecast</span> · `:''}<i>${h(fmtDayShort(l[0]))}</i>`);
      o+=cpSparZeile(p.map(e=>[e[0],e[1]]),{ref:50,refLbl:'50',k:'cn'});
      o+=`<div class="cp-mini"><i>Tested: China PMI surprises do not forecast the ${sym.id} (t ≤ 1.2) — shown only.</i></div>`;
    }else o+=leer('China PMI arrives with the next data update.');
  }
  // Feste Abhaengigkeiten, Abkommen (Historie entfernt: Nutzer 2026-10-25)
  o+=sub('Depends on');
  o+=`<div class="cp-abh">${c.abh.map(([k,v])=>`<div class="cp-abh-z"><span class="cp-abh-k">${h(k)}</span><span>${v}</span></div>`).join('')}</div>`;
  o+=sub('Key deals');
  o+=`<ul class="cp-list cp-deals">${c.deals.map(x=>`<li><span class="cp-pf">§</span><span>${x}</span></li>`).join('')}</ul>`;
  return`<section class="cp-col cp-dep">${o}</section>`;
}

// ── 4) Chart-Fenster (Nutzer 2026-10-25) ─────────────────────────────────
// Woertlich: "die ganzen Charts die du da hast von Preisen usw ich will das
// die alle anklickbar sind und dann oeffnet sich ein Fenster mit dem Chart in
// normaler Groesse und man kann zeitintervall veraendern andere Charts
// hinzufuegen also so wie bei data". Per Rueckfrage: Linien bleiben in der
// Karte, Klick oeffnet das Fenster; hinzufuegen = alle Reihen der Karte + alle
// Indikatoren dieses Assets, bis 8; EIN Zeitfilter, EIN Cursor, die Schere
// gilt fuer alle Charts des Fensters (Ansicht 'cpfSetRange').
// Gezeichnet wird mit indHistChart/rohstoffTrendChartHtml - derselbe Chart wie
// auf der Data-Seite (Achsen, Tooltip, Schere), nichts neu erfunden.
// Zustand = Ansicht bis zum Neuladen, nicht synchronisiert (wie trendsFokus,
// docs/state-sync.md "Bewusst NICHT synchronisiert").
const CPF_MAX=8;
let cpfSymId=null,cpfListe=[],cpfRange=36,cpfVon=null,cpfBis=null,cpfPickAuf=false,cpfBrush=false;
const CPF_SPREAD={IT:'Italy',FR:'France',ES:'Spain',NL:'Netherlands'};
// Spread in bp: Monatsmittel der EZB (IRS) bis zum ersten Tageswert, danach
// die Tageswerte von TradingView. nurTag: nur die Tageswerte (20-Tage-Aenderung).
function cpfSpreadReihe(d,k,nurTag){
  const m=(d&&d.y10m&&d.y10m.series)||{},y=(d&&d.y10)||{};
  const diff=(a,b,f)=>{const B=new Map((b||[]).map(e=>[e[0],e[1]]));return(a||[]).filter(e=>B.has(e[0])).map(e=>[f(e[0]),Math.round((e[1]-B.get(e[0]))*100)]);};
  const tag=diff(y[k],y.DE,x=>x);
  if(nurTag)return tag;
  const erst=tag.length?tag[0][0]:'9999';
  return diff(m[k],m.DE,x=>x+'-15').filter(e=>e[0]<erst).concat(tag);
}
function cpfKatalog(sym){
  const c=CP[sym.id]||{},K='Country profile',out=[];
  const cpiBase=sym.id==='USD'?'PCE':'CPI (Headline)';
  out.push({k:'niv:'+cpiBase,n:(sym.id==='USD'?'PCE':'CPI')+' y/y',g:K,unit:'%',pts:()=>nivReihe(nivEintrag(sym.id,cpiBase))});
  out.push({k:'niv:Unemployment Rate',n:'Unemployment rate',g:K,unit:'%',pts:()=>nivReihe(nivEintrag(sym.id,'Unemployment Rate'))});
  const roh=(c.roh||[]).map(([id])=>id);
  roh.forEach(id=>out.push({k:'roh:'+id,n:ROH_LBL[id]||id,g:K,roh:id}));
  if(sym.id==='EUR')Object.keys(CPF_SPREAD).forEach(k=>out.push({k:'spread:'+k,n:CPF_SPREAD[k]+' 10Y vs Bund',g:K,unit:' bp',pts:()=>cpfSpreadReihe(CP_DATA,k)}));
  if(sym.id==='CHF')out.push({k:'snb',n:'SNB sight deposits (bn CHF)',g:K,unit:'',pts:()=>{const s=CP_DATA&&CP_DATA.snb&&CP_DATA.snb.series,g=(s&&(s.GI||s.TG))||[];return g.map(e=>[e[0],Math.round(e[1]/100)/10]);}});
  if(c.china)out.push({k:'cn',n:'China NBS manufacturing PMI',g:K,unit:'',pts:()=>((CP_DATA&&CP_DATA.china&&CP_DATA.china.pmi&&CP_DATA.china.pmi.mfg)||[]).map(e=>[e[0],e[1]])});
  // Alle Indikatoren dieses Assets, je Karte gruppiert. Ein Rohstoff, der
  // schon oben steht (AUD Eisenerz ...), kommt nicht ein zweites Mal.
  const rohNamen=roh.map(id=>ROHSTOFF_NAME[id]),gesehen=new Set();
  (sym.rubrics||[]).forEach(r=>(r.indicators||[]).forEach(i=>{
    const b=stripPeriodSuffix(i.name).base;
    if(!b||gesehen.has(b)||rohNamen.includes(i.name))return;gesehen.add(b);
    out.push({k:'ind:'+b,n:indName(i),g:r.name,ind:i});
  }));
  return out;
}
function cpfAnfang(e,sym){
  try{
    if(e.ind){const p=indChartSeries(e.ind,sym.id).pts;return p&&p.length?String(p[0][0]).slice(0,10):null;}
    if(e.roh){const r=rohstoffTrend(e.roh).r;return r&&r.length?r[0].d:null;}
    const p=e.pts();return p&&p.length?String(p[0][0]).slice(0,10):null;
  }catch(x){return null;}
}
function cpfChart(e,sym,W,H){
  const o={noToolbar:true,noLegend:true,group:'cpf',range:cpfRange,from:cpfVon,to:cpfBis,W,H,brKey:'cpfSetRange'};
  try{
    if(e.ind)return indHistChart(e.ind,sym.id,o);
    if(e.roh)return COMMODITY_DATA&&COMMODITY_DATA.items&&COMMODITY_DATA.items[e.roh]?rohstoffTrendChartHtml(e.roh,o,''):leer('No price feed yet — arrives with the next data update.');
    const pts=(e.pts()||[]).filter(p=>p&&isFinite(+p[1])).map(p=>[String(p[0]).slice(0,10),+p[1]]);
    if(pts.length<2)return leer('Not enough data yet — arrives with the next data update.');
    return indHistChart({id:'cpf-'+e.k,name:e.n,chartHist:pts,chartUnit:e.unit||'',research:{}},sym.id,Object.assign(o,{linie:true}));
  }catch(x){console.error('[cpf]',x);return leer('This chart could not be drawn.');}
}
function cpfSym(){return syms.find(x=>x.id===cpfSymId)||null;}
// Auswahl wie die Data-Seite (#dataIndPicker): Popover unter dem Knopf, Chips je
// Gruppe, jeder Tipp gilt sofort, schliesst bei 8 oder bei Tipp daneben.
function cpfPickerZu(){
  cpfPickAuf=false;
  document.removeEventListener('pointerdown',cpfPickerDaneben,true);
  const el=document.getElementById('cpfPicker');if(el)el.remove();
  const b=document.getElementById('cpfBtn');if(b)b.classList.remove('on');
}
function cpfPickerDaneben(e){const t=e.target;if(t&&t.closest&&t.closest('#cpfPicker,#cpfBtn'))return;cpfPickerZu();}
function cpfPickerZeichnen(sym,kat){
  if(!cpfPickAuf)return;
  const btn=document.getElementById('cpfBtn');if(!btn){cpfPickerZu();return;}
  btn.classList.add('on');
  let el=document.getElementById('cpfPicker');
  if(!el){el=document.createElement('div');el.id='cpfPicker';el.className='data-picker';document.body.appendChild(el);}
  const gr=[];kat.forEach((e,i)=>{let g=gr.find(x=>x.n===e.g);if(!g){g={n:e.g,it:[]};gr.push(g);}g.it.push([e,i]);});
  const voll=cpfListe.length>=CPF_MAX;
  el.innerHTML=`<div class="data-picker-hd"><span>Pick up to ${CPF_MAX} charts</span><b>${cpfListe.length}/${CPF_MAX}</b></div>
    <div class="data-picker-body">${gr.map(g=>`<div class="data-picker-grp"><span class="cmp-filter-lbl">${h(g.n)}</span><div class="cmp-filter-grp">${g.it.map(([e,i])=>{const an=cpfListe.includes(e.k);
      return`<button class="cmp-chip cpf-pick-i${an?' on':''}"${!an&&voll?' disabled':''} onclick="cpfUmschalten(${i})" aria-pressed="${an}" title="${h(e.n)}">${h(e.n)}</button>`;}).join('')}</div></div>`).join('')}</div>
    <div class="data-picker-ft">All of ${h(sym.name||sym.id)} · every tap is applied right away · closes at ${CPF_MAX} or when you tap outside</div>`;
  const r=btn.getBoundingClientRect();
  el.style.top=Math.round(r.bottom+6)+'px';
  el.style.right=Math.max(8,Math.round(window.innerWidth-r.right))+'px';
  el.style.maxHeight=Math.max(160,Math.round(window.innerHeight-r.bottom-24))+'px';
}
// Kopf je Panel wie Data: Name + Gruppe · Legende · As of/Next · ✕ · ⓘ
function cpfLegende(e,sym){
  if(e.ind){let fc=false;try{fc=(indChartSeries(e.ind,sym.id).pts||[]).some(p=>p[2]!=null);}catch(x){}
    return`<span class="data-lg"><span class="lg-act">■ Actual</span>${fc?'<span class="lg-fc">— Forecast</span>':''}</span>`;}
  if(e.roh)return`<span class="data-lg"><span class="lg-act">— Close</span><span style="color:#7172AC">— EMA20</span></span>`;
  return'';
}
function cpfStand(e,sym){
  if(e.ind){try{return indAsOfNextHtml(sym.id,e.ind);}catch(x){return'';}}
  let d=null;
  try{if(e.roh){const r=rohstoffTrend(e.roh).r;d=r&&r.length?r[r.length-1].d:null;}else{const p=e.pts();d=p&&p.length?String(p[p.length-1][0]).slice(0,10):null;}}catch(x){d=null;}
  return d?`<div class="px-asof"><span class="px-asof-lbl">As of</span> <b>${h(fmtDayHdr(d))}</b></div>`:'';
}
const cpfQuelle=e=>e.ind?'the same series as in the macro table of this asset':e.roh?'daily close with EMA20 and its neutral band, as in the score':e.k.indexOf('spread:')===0?'ECB monthly averages, then daily TradingView yields':e.k==='snb'?'SNB data portal, weekly':e.k==='cn'?'NBS via the calendar archive':'the indicator feed of this asset';
function cpfRender(){
  const body=document.getElementById('cpfBody'),sym=cpfSym();
  if(!body||!sym)return;
  const kat=cpfKatalog(sym),liste=cpfListe.map(k=>kat.find(e=>e.k===k)).filter(Boolean),N=CPF_MAX;
  let ab=null;liste.forEach(e=>{const a=cpfAnfang(e,sym);if(a&&(!ab||a<ab))ab=a;});
  // Kopf wie Data: Unterzeile + Auswahlknopf rechts, darunter der Zeitfilter rechts.
  const btn=`<button class="btn cpf-add-b" id="cpfBtn" onclick="cpfPicker()" aria-expanded="${cpfPickAuf}" title="Pick up to ${N} charts of this asset at once — every tap is applied right away">${icn('filter',13)||''}<span style="margin-left:5px">Charts</span> <b style="font-family:var(--ff-num)">${liste.length}/${N}</b></button>`;
  const zeit=liste.length?`<div class="ind-hist-toolbar data-range">${timeRangeBarHtml(cpfRange,'cpfSetRange',TIME_RANGES,ab)}${timeRangeCustomHtml(cpfRange,cpfVon,cpfBis,'cpfSetRange',ab)}</div>`:'';
  const kopf=`<div class="data-head cpf-head"><div class="data-row"><div class="data-tt"><div class="pg-sub">One asset · up to ${N} charts side by side · one time range</div></div><span class="data-row-r">${btn}</span>${abInfoBtn(sym.id+' · Charts',['Up to '+N+' charts of this asset side by side — the series of the Country profile and every indicator. The time range applies to all charts.','<b>Scissors:</b> tap it, then drag in any chart — the span applies to every chart in this window.'],'info-b ii-nach')}</div><div class="data-row2">${chartLeisteHtml('',zeit)}</div></div>`;
  const panels=liste.length?`<div class="data-grid cpf-grid">${liste.map((e,i)=>`<div class="cot-card data-panel cpf-panel"><div class="data-ph"><span class="data-pt">${h(e.n)}<span class="px-panel-sub">${h(e.g)}</span></span>${cpfLegende(e,sym)}${cpfStand(e,sym)}<span class="px-panel-ctrls"><button class="px-panel-chip" onclick="cpfWeg(${i})" title="Remove this panel" aria-label="Remove ${h(e.n)}">✕</button></span>${abInfoBtn(sym.id+' — '+e.n,['<b>Source:</b> '+cpfQuelle(e)+'.','<b>Time range and scissors</b> apply to every chart in this window.'],'info-b ii-nach')}</div><div class="data-pc cpf-pc" data-i="${i}"></div></div>`).join('')}</div>`
    :`<div class="cot-empty">Pick up to ${N} charts of ${h(sym.name||sym.id)} above to compare them side by side.</div>`;
  body.innerHTML=kopf+panels;
  cpfFuellen(body,liste,sym);
  try{attachChartHovers(body);}catch(x){}
  cpfPickerZeichnen(sym,kat);
}
// Raster wie Data (dataRaster): 1 = ganze Flaeche, 2 = untereinander, 3-4 = 2x2,
// 5-6 = 3x2, 7-8 = 4x2; schmale Fenster weniger Spalten. Die Zeilen teilen sich
// die freie Hoehe des Fensters; unter DATA_MIN_CHART_H wird gescrollt.
function cpfFuellen(body,liste,sym){
  const grid=body.querySelector('.data-grid');if(!grid)return;
  const n=liste.length,{c,r}=dataRaster(n,grid.clientWidth);
  const gap=parseFloat(getComputedStyle(grid).rowGap)||10;
  grid.style.gridTemplateColumns=`repeat(${c},minmax(0,1fr))`;
  const kopfH=(grid.querySelector('.data-ph')||{offsetHeight:40}).offsetHeight;
  const minZeile=DATA_MIN_CHART_H+kopfH+14,sichtbar=c===1?Math.min(r,2):r;
  const zeile=Math.max(minZeile,Math.floor((grid.clientHeight-gap*(sichtbar-1))/sichtbar));
  grid.style.gridAutoRows=zeile+'px';
  grid.querySelectorAll('.cpf-pc').forEach(box=>{
    const e=liste[+box.dataset.i];if(!e)return;
    const bs=getComputedStyle(box),px=k=>parseFloat(bs[k])||0;
    const w=box.clientWidth-px('paddingLeft')-px('paddingRight')-8;
    const zeichne=hh=>{box.innerHTML=cpfChart(e,sym,Math.max(200,w),Math.max(120,hh));};
    const h0=box.clientHeight-px('paddingTop')-px('paddingBottom');
    zeichne(h0);
    const ueber=box.scrollHeight-box.clientHeight;
    if(ueber>0)zeichne(h0-ueber);
  });
}
let _cpfRz=0;
try{window.addEventListener('resize',()=>{clearTimeout(_cpfRz);_cpfRz=setTimeout(()=>{const m=document.getElementById('mCpChart');if(m&&m.style.display!=='none')cpfRender();},150);});}catch(x){}
function cpfOeffnen(k){
  const s=getSym();if(!s||!FX.includes(s.id))return;
  if(!cpfBrush){brushCustom('cpfSetRange',()=>cpfRange);cpfBrush=true;}
  cpfPickerZu();cpfSymId=s.id;cpfListe=[k];
  const t=document.getElementById('mCpChartTitle');if(t)t.textContent=`${s.name||s.id} · Charts`;
  openM('mCpChart');
  cpfRender();
}
function cpfSetRange(v){cpfRange=(v==='MAX'||v==='CUSTOM')?v:+v;cpfRender();}
function cpfSetRangeCustom(f,t){cpfVon=f||null;cpfBis=t||null;cpfRender();}
function cpfPicker(){
  if(cpfPickAuf){cpfPickerZu();return;}
  cpfPickAuf=true;const sym=cpfSym();if(sym)cpfPickerZeichnen(sym,cpfKatalog(sym));
  setTimeout(()=>{if(cpfPickAuf)document.addEventListener('pointerdown',cpfPickerDaneben,true);},0);
}
function cpfUmschalten(i){
  const sym=cpfSym();if(!sym)return;const e=cpfKatalog(sym)[i];if(!e)return;
  const at=cpfListe.indexOf(e.k);
  if(at>=0)cpfListe.splice(at,1);else if(cpfListe.length<CPF_MAX)cpfListe.push(e.k);else return;
  cpfRender();
  if(cpfListe.length>=CPF_MAX)cpfPickerZu();
}
function cpfZu(){cpfPickerZu();closeM('mCpChart');}
function cpfWeg(i){cpfListe.splice(i,1);cpfRender();}

// ── Fenster ──────────────────────────────────────────────────────────────
// Seit 643 (Nutzer 2026-10-27) steht das Country profile nicht mehr auf der
// Asset-Seite, sondern oeffnet sich ueber den Knopf in der Schnellzugriffs-
// zeile in #mCountryProfile. Inhalt wie bisher, Kopf wie im Chart-Fenster:
// Unterzeile Land · Bank, rechts das ⓘ. Ohne "Go to Rate Probabilities" -
// derselbe Knopf steht direkt in der Zeile darunter, und ein Sprung aus dem
// Fenster heraus liesse es ueber der neuen Seite offen.
function cpFensterAuf(){
  const s=getSym();if(!s||!FX.includes(s.id)||!CP[s.id])return;
  const b=document.getElementById('cpFensterBody');if(!b)return;
  b.innerHTML=countryProfileHtml(s);
  openM('mCountryProfile');
}
function countryProfileHtml(sym){
  if(!sym||!FX.includes(sym.id)||!CP[sym.id])return'';
  const c=CP[sym.id];
  if(!CP_DATA&&!cpFehler)cpDatenHolen();
  const d=CP_DATA;
  const info=abInfoBtn('Country profile',[
    '<b>Left:</b> the central bank — target, how fast it moves, when it typically hikes or cuts (≈ rules of thumb from past cycles), the latest values.',
    '<b>Middle:</b> what the economy is made of (World Bank) and the labour market, with the matching indicators of this page.',
    '<b>Right:</b> what the currency depends on — measured risk role, carry, commodities, country data, deals.',
    '<b>Every line opens as a full chart</b> — change the time range, add more charts of this asset, pick a span with the scissors.',
    '<b>Score:</b> the card itself adds nothing. <i>in score</i> = the score already counts it · <i>shown only</i> = it does not. Coloured values follow the bias colours (<b style="color:'+BC.bull+'">bullish</b> / <b style="color:'+BC.bear+'">bearish</b>).'
  ],'info-b ii-nach');
  return`<div class="cp-card cp-fenster" id="cpKarte">
    <div class="data-head cp-fkopf"><div class="data-row"><div class="data-tt"><div class="pg-sub">${h(c.land)} · ${h(c.bank)}</div></div>${info}</div></div>
    <div class="cp-grid">${cpSpalteBank(sym,c,d)}<div class="cp-sep" aria-hidden="true"></div>${cpSpalteWirtschaft(sym,c,d)}<div class="cp-sep" aria-hidden="true"></div>${cpSpalteAbh(sym,c,d)}</div>
    ${cpLaender(c,d)}
  </div>`;
}

export {countryProfileHtml,CP};
// Inline-Handler (onclick) brauchen die Funktionen am window.
Object.assign(window,{cpFensterAuf,cpfOeffnen,cpfSetRange,cpfSetRangeCustom,cpfPicker,cpfUmschalten,cpfWeg,cpfZu});
