// ══ AKTIEN: stock_data.json (2026-11-13) ═════════════════════════════════
// Nutzer: "neue Kategorie stocks ... nvidia, amd, Intel, Apple, Google ...
// mach auch neue Karten zu wichtigen Indikatoren also ich kenne zB PE".
// Quellen (geprueft mit tools/aktien-sonde.mjs auf dem Runner, 2026-11-13):
//   Yahoo quoteSummary  - aktueller Stand: Bewertung, Margen, Wachstum, ROE,
//                          Verschuldung, Analysten, Kursziele, naechste Zahlen
//   SEC EDGAR           - Quartalszahlen aus den Pflichtmeldungen (10-Q/10-K):
//                          Umsatz, Gewinn, EPS, Cashflow -> Historie und
//                          3-Jahres-Durchschnitt ("vs own history")
//   Yahoo chart (1wk)   - Wochenkurse fuer P/E-, P/S-, P/FCF-Verlauf
// Nur Anzeige, kein Score-Teil. Nichts geschaetzt: fehlt ein Wert, fehlt er.
// Keine Vorausschau: ein Quartal zaehlt erst ab seinem Meldedatum (filed).
//   node tools/aktien.mjs            schreibt stock_data.json
//   node tools/aktien.mjs --pruefen  schreibt nichts, druckt eine Uebersicht
import fs from 'node:fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SEC_UA='FXAnalystPro research tool';   // ohne persoenliche Angaben (Datenschutz)
export const AKTIEN={NVDA:{cik:1045810},AMD:{cik:2488},INTC:{cik:50863},AAPL:{cik:320193},GOOGL:{cik:1652044}};
const PRUEFEN=process.argv.includes('--pruefen');
const TAG=864e5;
const warte=ms=>new Promise(r=>setTimeout(r,ms));
async function holeJson(url,headers,versuche=3){
  for(let i=0;i<versuche;i++){try{const r=await fetch(url,{headers});if(r.ok)return await r.json();}catch(e){}await warte(1200*(i+1));}
  return null;
}
const raw=x=>x&&typeof x==='object'&&'raw' in x?x.raw:(typeof x==='number'?x:null);
const r2=(v,n=2)=>v==null||!isFinite(v)?null:Math.round(v*10**n)/10**n;
const pct=v=>v==null?null:r2(v*100,1);

// ── Yahoo: Cookie + Crumb ────────────────────────────────────────────────
async function yahooSitzung(){
  const r0=await fetch('https://fc.yahoo.com',{headers:{'User-Agent':UA},redirect:'manual'}).catch(()=>null);
  const ck=r0?(r0.headers.getSetCookie?r0.headers.getSetCookie():[r0.headers.get('set-cookie')]).filter(Boolean).map(c=>c.split(';')[0]).join('; '):'';
  const cr=await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb',{headers:{'User-Agent':UA,Cookie:ck}}).then(r=>r.text()).catch(()=>'');
  return{H:{'User-Agent':UA,Cookie:ck,Accept:'application/json'},cr};
}
async function yahooStand(t,Y){
  const MOD='assetProfile,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,calendarEvents,majorHoldersBreakdown,netSharePurchaseActivity';
  const d=await holeJson(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=${MOD}&crumb=${encodeURIComponent(Y.cr)}`,Y.H);
  const q=d&&d.quoteSummary&&d.quoteSummary.result&&d.quoteSummary.result[0];
  if(!q)return null;
  const sd=q.summaryDetail||{},ks=q.defaultKeyStatistics||{},fd=q.financialData||{},ap=q.assetProfile||{};
  const rt=((q.recommendationTrend||{}).trend||[]).find(x=>x.period==='0m')||null;
  const ne=(((q.calendarEvents||{}).earnings||{}).earningsDate||[]).map(x=>x&&x.fmt).filter(Boolean);
  return{
    sector:ap.sector||null,industry:ap.industry||null,mitarbeiter:raw(ap.fullTimeEmployees),
    kurs:raw(fd.currentPrice),mcap:raw(sd.marketCap),
    fpe:r2(raw(sd.forwardPE)??raw(ks.forwardPE)),tpe:r2(raw(sd.trailingPE)),peg:r2(raw(ks.pegRatio)),
    ps:r2(raw(sd.priceToSalesTrailing12Months)),pb:r2(raw(ks.priceToBook)),evEbitda:r2(raw(ks.enterpriseToEbitda)),
    revG:pct(raw(fd.revenueGrowth)),epsG:pct(raw(fd.earningsGrowth)),
    gm:pct(raw(fd.grossMargins)),om:pct(raw(fd.operatingMargins)),nm:pct(raw(fd.profitMargins)),
    roe:pct(raw(fd.returnOnEquity)),de:raw(fd.debtToEquity)!=null?r2(raw(fd.debtToEquity)/100):null,
    divY:pct(raw(sd.dividendYield)),beta:r2(raw(sd.beta)),
    ana:{sb:rt?rt.strongBuy:null,b:rt?rt.buy:null,h:rt?rt.hold:null,s:rt?rt.sell:null,ss:rt?rt.strongSell:null,
      n:raw(fd.numberOfAnalystOpinions),mittel:r2(raw(fd.targetMeanPrice)),median:r2(raw(fd.targetMedianPrice)),
      hoch:r2(raw(fd.targetHighPrice)),tief:r2(raw(fd.targetLowPrice)),urteil:fd.recommendationKey||null,note:r2(raw(fd.recommendationMean))},
    naechsteZahlen:ne[0]||null,
    institutionell:pct(raw((q.majorHoldersBreakdown||{}).institutionsPercentHeld)),
    insiderNetto:pct(raw((q.netSharePurchaseActivity||{}).netPercentInsiderShares))
  };
}
async function yahooWochen(t){
  const d=await holeJson(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?range=10y&interval=1wk`,{'User-Agent':UA});
  const c=d&&d.chart&&d.chart.result&&d.chart.result[0];if(!c)return[];
  const ts=c.timestamp||[],cl=((c.indicators||{}).adjclose||[{}])[0].adjclose||((c.indicators||{}).quote||[{}])[0].close||[];
  // ⚠ adjclose: Splits (NVDA 10:1 2024) sonst als Kurssturz; EPS aus der SEC
  // ist splitbereinigt nur in neueren Meldungen - deshalb unten EPS = Gewinn/Aktien.
  return ts.map((t,i)=>[new Date(t*1000).toISOString().slice(0,10),cl[i]]).filter(p=>p[1]!=null&&isFinite(p[1]));
}

// ── SEC: Quartale aus companyfacts ───────────────────────────────────────
const tage=(a,b)=>(new Date(b)-new Date(a))/TAG;
function quartale(eintraege){
  // eintraege: [{start,end,val,filed}] (Dauer-Werte). 10-Q melden Cashflows
  // als Jahr-bis-heute (3, 6, 9 Monate) - Quartal = Differenz zweier YTD-Werte
  // mit gleichem Start. Q4 = Jahr minus 9 Monate.
  const best=new Map();   // end -> {val,filed}
  const setze=(end,val,filed,direkt)=>{const a=best.get(end);if(!a||(direkt&&!a.direkt)||(direkt===a.direkt&&filed<a.filed))best.set(end,{val,filed,direkt});};
  const proStart=new Map();
  for(const e of eintraege){
    if(!e.start||!e.end||e.val==null)continue;
    const d=tage(e.start,e.end);
    if(d>=80&&d<=100)setze(e.end,e.val,e.filed,true);
    if(!proStart.has(e.start))proStart.set(e.start,new Map());
    const m=proStart.get(e.start);const a=m.get(e.end);if(!a||e.filed<a.filed)m.set(e.end,{val:e.val,filed:e.filed});
  }
  for(const [,m] of proStart){
    const l=[...m.entries()].sort((a,b)=>a[0]<b[0]?-1:1);
    for(let i=1;i<l.length;i++){const d=tage(l[i-1][0],l[i][0]);if(d>=80&&d<=100)setze(l[i][0],l[i][1].val-l[i-1][1].val,l[i][1].filed,false);}
  }
  return[...best.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(([end,v])=>({end,val:v.val,filed:v.filed}));
}
function augenblick(eintraege){   // Stichtagswerte (Eigenkapital, Aktienzahl)
  // ⚠ Mehrere Aktienklassen (Alphabet: A, B, C) stehen als getrennte Eintraege
  // mit demselben Stichtag in DERSELBEN Meldung (accn) - sie werden addiert.
  const proMeldung=new Map();
  for(const e of eintraege){if(!e.end||e.val==null||e.start)continue;const k=e.end+'|'+(e.accn||e.filed);const a=proMeldung.get(k);if(a)a.val+=e.val;else proMeldung.set(k,{end:e.end,val:e.val,filed:e.filed});}
  const m=new Map();for(const v of proMeldung.values()){const a=m.get(v.end);if(!a||v.filed<a.filed)m.set(v.end,v);}
  return[...m.values()].sort((a,b)=>a.end<b.end?-1:1);
}
function factEintraege(f,tags,einheit){
  let alle=[];
  for(const t of tags){const u=f[t]&&f[t].units&&f[t].units[einheit];if(u)alle=alle.concat(u.filter(x=>/^10-[QK]/.test(x.form||'')));}
  return alle;
}
async function secQuartale(cik){
  const d=await holeJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10,'0')}.json`,{'User-Agent':SEC_UA,Accept:'application/json'});
  const g=d&&d.facts&&d.facts['us-gaap'];if(!g)return null;
  const dei=(d.facts.dei)||{};
  const umsatz=quartale(factEintraege(g,['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet'],'USD'));
  const gewinn=quartale(factEintraege(g,['NetIncomeLoss'],'USD'));
  const ocf=quartale(factEintraege(g,['NetCashProvidedByUsedInOperatingActivities'],'USD'));
  const capex=quartale(factEintraege(g,['PaymentsToAcquirePropertyPlantAndEquipment','PaymentsToAcquireProductiveAssets'],'USD'));
  const ek=augenblick(factEintraege(g,['StockholdersEquity'],'USD'));
  let aktien=augenblick(factEintraege(dei,['EntityCommonStockSharesOutstanding'],'shares'));
  // Rueckfall: verwaesserte Durchschnitts-Aktienzahl des Quartals (nur direkte
  // 3-Monats-Werte - Durchschnitte lassen sich nicht aus YTD differenzieren)
  if(aktien.length<8)aktien=factEintraege(g,['WeightedAverageNumberOfDilutedSharesOutstanding'],'shares').filter(x=>x.start&&tage(x.start,x.end)>=80&&tage(x.start,x.end)<=100)
    .reduce((m,x)=>{const a=m.find(y=>y.end===x.end);if(!a)m.push({end:x.end,val:x.val,filed:x.filed});return m;},[]).sort((a,b)=>a.end<b.end?-1:1);
  return{umsatz,gewinn,ocf,capex,ek,aktien};
}
// TTM-Reihe: Summe der letzten 4 lueckenlosen Quartale, gueltig ab Meldedatum
function ttm(q){
  const out=[];
  for(let i=3;i<q.length;i++){
    const v=q.slice(i-3,i+1);let ok=true;for(let k=1;k<4;k++){const d=tage(v[k-1].end,v[k].end);if(d<80||d>100)ok=false;}
    if(ok)out.push({end:q[i].end,filed:v.reduce((m,x)=>x.filed>m?x.filed:m,''),val:v.reduce((s,x)=>s+x.val,0)});
  }
  return out;
}
const amStichtag=(reihe,datum,feld='filed')=>{let w=null;for(const x of reihe){if(x[feld]<=datum)w=x;else break;}return w;};
function verlauf(wochen,sec){
  const U=ttm(sec.umsatz),G=ttm(sec.gewinn),O=ttm(sec.ocf),C=ttm(sec.capex);
  const fcfMap=new Map(C.map(x=>[x.end,x.val]));
  const F=O.filter(x=>fcfMap.has(x.end)).map(x=>({end:x.end,filed:x.filed,val:x.val-fcfMap.get(x.end)}));
  const A=sec.aktien;
  const pe=[],ps=[],pfcf=[];
  for(const [d,kurs] of wochen){
    const a=amStichtag(A,d);if(!a)continue;
    // Marktwert aus Aktienzahl und Kurs; Kurs ist splitbereinigt, die Aktienzahl
    // der Meldung nicht -> Splits erkennen: Marktwert-Sprung wird ueber den
    // juengsten Stand korrigiert (Faktor = aktuelle Aktien / gemeldete).
    const mcap=kurs*a.val*(a.splitFaktor||1);
    const g=amStichtag(G,d),u=amStichtag(U,d),f=amStichtag(F,d);
    if(g&&g.val>0)pe.push([d,r2(mcap/g.val,1)]);
    if(u&&u.val>0)ps.push([d,r2(mcap/u.val,2)]);
    if(f&&f.val>0)pfcf.push([d,r2(mcap/f.val,1)]);
  }
  return{pe,ps,pfcf,U,G,F};
}
function splitFaktoren(aktien,wochen){
  // gemeldete Aktienzahl vor einem Split ist um den Split-Faktor zu klein
  // (adjclose ist rueckwirkend bereinigt). Faktor je Meldung = Sprung zur
  // naechsten Meldung, wenn er nahe einer ganzen Zahl >= 2 liegt.
  for(let i=aktien.length-2;i>=0;i--){
    const q=aktien[i+1].val/aktien[i].val;const f=Math.round(q);
    aktien[i].splitFaktor=(aktien[i+1].splitFaktor||1)*(f>=2&&Math.abs(q-f)<0.15?f:1);
  }
  if(aktien.length)aktien[aktien.length-1].splitFaktor=aktien[aktien.length-1].splitFaktor||1;
}
// Schnitt nur, wenn die Kennzahl in mindestens 60 % der Wochen existierte -
// sonst (Intel 2023-2026: meist Verlust) waere ein P/E-Schnitt aus den paar
// Gewinnwochen eine Zufallszahl (gemessen: 266).
const mittel=(l,seitDatum,wochen)=>{const v=l.filter(p=>p[0]>=seitDatum).map(p=>p[1]).filter(x=>x!=null&&isFinite(x));const n=wochen.filter(p=>p[0]>=seitDatum).length;return v.length>=20&&v.length>=0.6*n?r2(v.reduce((s,x)=>s+x,0)/v.length,1):null;};
function wachstumYoY(q){   // Quartal gegen Vorjahresquartal, in %
  return q.map((x,i)=>{const v=q.slice(0,i).reverse().find(y=>{const d=tage(y.end,x.end);return d>350&&d<380;});return v&&v.val>0?{end:x.end,val:(x.val/v.val-1)*100}:null;}).filter(Boolean);
}

const alt=(()=>{try{return JSON.parse(fs.readFileSync('stock_data.json','utf8'));}catch(e){return null;}})();
const out={updated:new Date().toISOString(),source:'Yahoo Finance (current figures, analysts), SEC EDGAR filings (quarterly history), Yahoo weekly prices',stocks:{}};
const Y=await yahooSitzung();
for(const t of Object.keys(AKTIEN)){
  const o={};
  const y=await yahooStand(t,Y);
  const sec=await secQuartale(AKTIEN[t].cik);await warte(300);
  const wochen=await yahooWochen(t);
  if(y)Object.assign(o,y);
  if(sec&&wochen.length){
    splitFaktoren(sec.aktien,wochen);
    const v=verlauf(wochen,sec);
    const seit=new Date(Date.now()-3*365*TAG).toISOString().slice(0,10),seit5=new Date(Date.now()-5*365*TAG).toISOString().slice(0,10);
    o.verlauf={pe:v.pe.filter(p=>p[0]>=seit5),ps:v.ps.filter(p=>p[0]>=seit5),pfcf:v.pfcf.filter(p=>p[0]>=seit5)};
    o.schnitt3j={tpe:mittel(v.pe,seit,wochen),ps:mittel(v.ps,seit,wochen),pfcf:mittel(v.pfcf,seit,wochen)};
    // aktuelle P/FCF aus SEC-FCF (dieselbe Rechnung wie der Verlauf)
    const lf=v.F[v.F.length-1];if(o.mcap&&lf&&lf.val>0)o.pfcf=r2(o.mcap/lf.val,1);else if(lf&&lf.val<=0)o.pfcf=null;
    o.fcfTtm=lf?lf.val:null;
    // Quartale fuer die Earnings-Karte: Umsatz, Gewinn, Umsatzwachstum y/y
    const uw=new Map(wachstumYoY(sec.umsatz).map(x=>[x.end,x.val]));
    const gm=new Map(sec.gewinn.map(x=>[x.end,x.val]));
    o.quartale=sec.umsatz.slice(-12).map(x=>[x.end,x.val,gm.has(x.end)?gm.get(x.end):null,uw.has(x.end)?r2(uw.get(x.end),1):null]);
    // 3-Jahres-Schnitt fuer Wachstum und Netto-Marge aus den Meldungen
    const q12=sec.umsatz.slice(-12);
    const uw12=q12.map(x=>uw.get(x.end)).filter(x=>x!=null);
    const nm12=q12.map(x=>gm.has(x.end)&&x.val>0?gm.get(x.end)/x.val*100:null).filter(x=>x!=null);
    o.schnitt3j.revG=uw12.length>=8?r2(uw12.reduce((s,x)=>s+x,0)/uw12.length,1):null;
    o.schnitt3j.nm=nm12.length>=8?r2(nm12.reduce((s,x)=>s+x,0)/nm12.length,1):null;
  }
  if(!y&&!(sec&&wochen.length)){
    // nichts bekommen: alten Stand behalten, aber als alt markieren
    if(alt&&alt.stocks&&alt.stocks[t]){out.stocks[t]=Object.assign({},alt.stocks[t],{veraltet:true});continue;}
  }
  o.stand=new Date().toISOString().slice(0,10);
  out.stocks[t]=o;
  console.log('stock_data '+t+': yahoo '+(y?'ok':'FEHLT')+', sec '+(sec?sec.umsatz.length+' Quartale':'FEHLT')+', wochen '+wochen.length+
    (o.schnitt3j?', 3J P/E '+o.schnitt3j.tpe+' P/S '+o.schnitt3j.ps+' P/FCF '+o.schnitt3j.pfcf+' revG '+o.schnitt3j.revG:'')+
    (y?', jetzt P/E '+o.tpe+' fwd '+o.fpe+' P/S '+o.ps+' P/FCF '+o.pfcf:''));
  await warte(400);
}
if(PRUEFEN){console.log(JSON.stringify(out).slice(0,3000));process.exit(0);}
if(Object.keys(out.stocks).length)fs.writeFileSync('stock_data.json',JSON.stringify(out));
