// Baut sektor_data.json fuer die Sectors-Ansicht der MACRO-Zeile.
// Quellen (alle schon im Repo, kein Netz): cal_hist/<Jahr>.json (TradingView-
// Kalender), ind_data.json (Haupt-Indikatoren - damit beide Ansichten dieselbe
// Zahl zeigen), bond_data.json (Renditen). Nichts wird geschaetzt: ohne
// Veroeffentlichung in SEKTOR_FRISCH_TAGE gibt es die Zeile nicht.
// Aufruf: node tools/sektoren.mjs [--pruefen]   (--pruefen schreibt nichts)
import fs from 'node:fs';
// Katalog als ES-Modul aus js/ laden, unabhaengig davon, ob die Node-Version
// des Runners .js-Dateien ohne package.json als ES-Modul erkennt.
const KAT=new URL('../js/sektoren-katalog.js',import.meta.url);
const {SEKTOREN,SEKTOR_FRISCH_TAGE,sektorTitelBasis}=await import('data:text/javascript,'+encodeURIComponent(fs.readFileSync(KAT,'utf8')));
const lies=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){return null;}};
const CCYS=['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'];
const jetzt=Date.now(),grenze=jetzt-SEKTOR_FRISCH_TAGE*864e5;
// EUR nur Eurozone: Laenderzeilen tragen im Archiv einen Vorsatz.
const LAND=/^(German|French|Italian|Spanish) /;
const ev=[];
for(const f of fs.readdirSync('cal_hist').filter(f=>/^\d{4}\.json$/.test(f)).sort().slice(-3)){const d=lies('cal_hist/'+f);if(d&&Array.isArray(d.ev))ev.push(...d.ev);}
// je Waehrung: Basis-Titel -> Veroeffentlichungen (nur mit Actual, nicht in der Zukunft)
const idx={};
for(const e of ev){
  const[zeit,ccy,titel,,a,f,p]=e;
  if(!CCYS.includes(ccy)||a==null||a===''||LAND.test(titel))continue;
  const t=new Date(zeit).getTime();if(!isFinite(t)||t>jetzt)continue;
  ((idx[ccy]=idx[ccy]||{})[sektorTitelBasis(titel)]=idx[ccy][sektorTitelBasis(titel)]||[]).push({t,d:zeit.slice(0,10),titel,a,f:f||null,p:p||null});
}
const ind=lies('ind_data.json')||{},bond=lies('bond_data.json')||{};
function ausArchiv(ccy,re){
  const m=idx[ccy]||{};
  for(const r of re){
    let alle=[];for(const k in m)if(r.test(k))alle=alle.concat(m[k]);
    if(!alle.length)continue;
    alle.sort((x,y)=>x.t-y.t);
    // ein Tag = ein Wert (Prel und Final am selben Tag: der spaetere Eintrag)
    const tag=new Map();for(const x of alle)tag.set(x.d,x);
    const reihe=[...tag.values()],l=reihe[reihe.length-1];
    if(l.t<grenze)continue;
    return{t:l.titel,d:l.d,a:l.a,f:l.f,p:l.p,h:reihe.slice(-12).map(x=>[x.d,x.a])};
  }
  return null;
}
function ausInd(ccy,name){
  const e=ind[ccy]&&ind[ccy][name];if(!e||e.actual==null||e.actual===''||!e.date)return null;
  if(new Date(e.date).getTime()<grenze)return null;
  const h=Array.isArray(e.history)?e.history.slice(-12).map(x=>[x[0],x[1]]):[];
  const o={t:e.event||name,d:e.date,a:String(e.actual),f:e.forecast!=null&&e.forecast!==''?String(e.forecast):null,p:e.previous!=null&&e.previous!==''?String(e.previous):null,h,ind:name};
  if(e.est)o.est=true;
  return o;
}
function ausAnleihe(ccy,art){
  const b=bond[ccy];if(!b)return null;
  const s=k=>b[k]&&Array.isArray(b[k].series)?b[k].series.filter(x=>x&&x[1]!=null&&isFinite(parseFloat(x[1]))):[];
  const z=s('10Y Bond Yield'),k=s('2Y Bond Yield');
  let reihe;
  if(art==='10Y')reihe=z;else if(art==='2Y')reihe=k;
  else{const m=new Map(k.map(x=>[x[0],parseFloat(x[1])]));reihe=z.filter(x=>m.has(x[0])).map(x=>[x[0],((parseFloat(x[1])-m.get(x[0]))*100).toFixed(0)]);}
  if(reihe.length<2)return null;
  const l=reihe[reihe.length-1],v=reihe[reihe.length-2];
  if(new Date(l[0]).getTime()<grenze)return null;
  const ein=art==='kurve'?' bp':'%';
  // Verlauf: ein Wert je Woche (12 Wochen), sonst waere es nur die letzten 12 Tage
  const h=[];for(let i=reihe.length-1;i>=0&&h.length<12;i-=5)h.unshift([reihe[i][0],reihe[i][1]+ein]);
  return{t:art==='kurve'?'10Y Bond Yield minus 2Y Bond Yield':art+' Bond Yield',d:l[0],a:l[1]+ein,f:null,p:v[1]+ein,h,taeglich:true};
}
const per=t=>/yoy|\(3mo\/yr\)|annual growth|y\/y/i.test(t)?'y/y':/mom|m\/m/i.test(t)?'m/m':/qoq|q\/q/i.test(t)?'q/q':null;
const out={updated:new Date().toISOString(),source:'TradingView calendar archive (cal_hist), ind_data.json, bond_data.json',frischTage:SEKTOR_FRISCH_TAGE,ccy:{}};
const zahl={};
for(const ccy of CCYS){
  const o={};
  for(const s of SEKTOREN)for(const g of s.gruppen)for(const r of g.reihen){
    if(r.nur&&!r.nur.includes(ccy))continue;
    let w=null;
    if(r.anl)w=ausAnleihe(ccy,r.anl);
    else{if(r.ind)w=ausInd(ccy,r.ind);if(!w&&r.re)w=ausArchiv(ccy,r.re);}
    if(w&&Object.values(o).some(x=>x.t===w.t))w=null;   // dieselbe Veroeffentlichung steht schon in einer anderen Zeile
    if(w){const z=per(w.t)||(r.ind&&ind[ccy]&&ind[ccy][r.ind]&&per(String(ind[ccy][r.ind].period||'')))||null;if(z)w.per=z;o[r.k]=w;}
  }
  out.ccy[ccy]=o;zahl[ccy]=Object.keys(o).length;
}
console.log('sektor_data: '+CCYS.map(c=>c+' '+zahl[c]).join(', '));
if(!process.argv.includes('--pruefen'))fs.writeFileSync('sektor_data.json',JSON.stringify(out));
