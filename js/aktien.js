// ══ AKTIEN (Kategorie Stocks, 2026-11-13) ════════════════════════════════
// Nutzer: "Ok ich will eine neue Kategorie hinzufügen: stocks also Aktien.
// Für direkt mal nvidia, amd, Intel, Apple, Google hinzu. Die Asset Seite dazu
// soll erstmal komplett gleich aufgebaut sein. Und die Indikatoren sollen die
// gleichen wie bei sp500 sein ... und das sind dann die vom usd. Und mach da
// eine feste Karte in der übersichtlich das Unternehmen erklärt wird und
// wichtige Partner oder Abhängigkeiten ... mach auch neue Karten zu wichtigen
// Indikatoren also ich kenne zB PE".
//
// Hier: die Aktien-Liste, das feste Firmenprofil je Aktie und die Karten
// der Zeile "Company" (Profil, Valuation, Growth & quality) sowie Analysts
// und Earnings im Band darunter. Score: wie S&P 500 (USD-Makro-Karten mit
// denselben Ableitungsregeln, VIX/AAII) - die Kennzahlen hier sind NUR
// ANZEIGE. Daten: stock_data.json (tools/aktien.mjs, Yahoo + SEC EDGAR).
//
// Helfer kommen per aktienHelfer() aus main.js (kein zirkulaerer Import).
let H=null;
export function aktienHelfer(h){H=h;}

export const STOCK_IDS=['NVDA','AMD','INTC','AAPL','GOOGL'];
// Akzentfarbe des Symbols (Kursverlauf im Rahmen wie bei den Indizes).
// ⚠ Kein Rot (Design-Regel: Rot nur bearish/Warnung).
export const STOCK_ACCENT={NVDA:'#76B900',AMD:'#F08A24',INTC:'#2A8DE0',AAPL:'#A9B3BD',GOOGL:'#5B8DEF'};

// ── Feste Firmenprofile ──────────────────────────────────────────────────
// Struktur, keine Tageszahlen: was die Firma macht, womit sie Geld verdient,
// mit wem sie verflochten ist und woran sie haengt. Zahlen kommen live aus
// stock_data.json. Stand des Wissens: 2026.
export const STOCK_PROFIL={
  NVDA:{name:'NVIDIA',full:'NVIDIA Corporation',ticker:'NASDAQ: NVDA',
    was:'Designs GPUs and full AI computing systems. Does not build chips itself (fabless).',
    geld:[['Data Center','AI accelerators (Hopper, Blackwell, Rubin), networking, systems – by far the largest segment'],['Gaming','GeForce graphics cards'],['Professional visualization','workstation GPUs'],['Automotive & robotics','DRIVE, Jetson']],
    vorteil:['CUDA software ecosystem – the industry standard for AI developers','Full stack: chips, networking (Mellanox/NVLink), systems and software'],
    partner:[['Customers','Hyperscalers: Microsoft, Meta, Alphabet, Amazon, Oracle; AI labs and sovereign AI projects'],['Manufacturing','TSMC (chips and CoWoS advanced packaging)'],['Memory','SK Hynix, Micron, Samsung (HBM)'],['Systems','Foxconn, Dell, Supermicro, HPE build the servers']],
    risiko:['Customer concentration: a handful of hyperscalers buy most data-center chips','US export controls on AI chips to China','Single foundry: TSMC in Taiwan (geopolitics)','In-house chips of its customers (Google TPU, Amazon Trainium, Microsoft Maia) and AMD'],
    treiber:['Data-center revenue and guidance at quarterly results','Hyperscaler capex plans','Export-rule changes']},
  AMD:{name:'AMD',full:'Advanced Micro Devices, Inc.',ticker:'NASDAQ: AMD',
    was:'Designs CPUs, GPUs and adaptive chips (FPGAs). Fabless since spinning off its fabs (GlobalFoundries).',
    geld:[['Data Center','EPYC server CPUs and Instinct AI GPUs (MI300/MI350 series)'],['Client','Ryzen PC processors'],['Gaming','Radeon GPUs and custom chips for PlayStation and Xbox'],['Embedded','Xilinx FPGAs and adaptive SoCs']],
    vorteil:['Chiplet design – flexible and cost-efficient','Server CPU share gains against Intel over several years','Second source for AI GPUs next to NVIDIA'],
    partner:[['Customers','Microsoft, Meta, Oracle, OpenAI (multi-year GPU agreement), cloud providers'],['Consoles','Sony (PlayStation), Microsoft (Xbox)'],['Manufacturing','TSMC'],['Software','ROCm – open alternative to CUDA']],
    risiko:['Competes with NVIDIA in AI GPUs and with Intel and ARM designs in CPUs','Dependence on TSMC (Taiwan)','US export controls to China','AI GPU ramp has to meet high expectations'],
    treiber:['Data-center GPU revenue and outlook','Server CPU share','PC cycle']},
  INTC:{name:'Intel',full:'Intel Corporation',ticker:'NASDAQ: INTC',
    was:'Designs AND manufactures chips (integrated device manufacturer) and is building a contract foundry business.',
    geld:[['Client Computing','Core PC processors – still the largest segment'],['Data Center & AI','Xeon server CPUs, Gaudi accelerators'],['Intel Foundry','manufacturing for itself and outside customers (18A, 14A process)'],['Others','Mobileye (majority stake), Altera (majority sold)']],
    vorteil:['Own fabs in the US, Europe and Israel – strategic for US chip supply','Large installed base in PCs and servers'],
    partner:[['Shareholders','US government (stake since 2025, CHIPS Act), NVIDIA (investment and joint products, 2025), SoftBank'],['Manufacturing','own fabs plus TSMC for some products'],['Customers','PC makers: Dell, HP, Lenovo; cloud providers']],
    risiko:['Execution of the 18A/14A processes and foundry customer wins','Heavy capex while the business is loss-making','Share losses to AMD and ARM-based chips','Dependence on government support'],
    treiber:['Foundry customer announcements','Gross margin recovery','PC and server demand']},
  AAPL:{name:'Apple',full:'Apple Inc.',ticker:'NASDAQ: AAPL',
    was:'Consumer hardware plus a high-margin services business on top of its installed base of devices.',
    geld:[['iPhone','about half of revenue'],['Services','App Store, iCloud, Apple Music/TV, AppleCare, payments, search licensing – highest margin'],['Mac, iPad','computers and tablets with own M-series chips'],['Wearables, Home','Apple Watch, AirPods, Vision Pro']],
    vorteil:['Ecosystem lock-in and brand pricing power','Own chip designs (A- and M-series)','Very large cash flow and share buybacks'],
    partner:[['Assembly','Foxconn, Pegatron, Luxshare – China, India, Vietnam'],['Chips','TSMC (exclusive leading-edge capacity), Broadcom, Qualcomm (modems, being replaced by own)'],['Services','Google pays to be the default search engine in Safari']],
    risiko:['China: both a key market and the main production base','Antitrust: App Store rules, Google search payments','Tariffs on imported devices','Slow iPhone upgrade cycle, AI catch-up'],
    treiber:['iPhone sales at quarterly results','Services growth','Tariff and China news']},
  GOOGL:{name:'Alphabet',full:'Alphabet Inc. (Google)',ticker:'NASDAQ: GOOGL',
    was:'Parent of Google: search and advertising, YouTube, cloud computing and long-term bets.',
    geld:[['Google Search & other','search ads – the core profit engine'],['YouTube','ads and subscriptions'],['Google Cloud','infrastructure, AI (Gemini, TPUs), workspace'],['Other Bets','Waymo and others – loss-making']],
    vorteil:['Search scale and data','Own AI models (Gemini) and own AI chips (TPU)','Android and Chrome distribution'],
    partner:[['Distribution','Apple (default search in Safari), Samsung and Android phone makers'],['AI chips','TPU co-design with Broadcom; also buys NVIDIA GPUs'],['Cloud customers','enterprises and AI labs (e.g. Anthropic)']],
    risiko:['Antitrust: US search and ad-tech cases, EU rules','AI chat assistants may shift search traffic','Advertising depends on the economic cycle','Very high AI capex'],
    treiber:['Search and YouTube ad growth','Cloud growth and margin','Antitrust rulings']}
};
export const STOCK_DEF=STOCK_IDS.map(id=>{const p=STOCK_PROFIL[id];return{id,name:p.name,full:p.full,bias:'neu',
  genBull:p.vorteil.slice(0,2),genBear:p.risiko.slice(0,2)};});

// ── Daten ────────────────────────────────────────────────────────────────
let ST=null,stLaden=null,stFehler=false;
export function aktienDaten(){return ST;}
export function aktienDatenHolen(){
  if(ST||stLaden||!H)return;
  stLaden=fetch(H.DATA_BASE+'stock_data.json?t='+Math.floor(Date.now()/3e5),{signal:AbortSignal.timeout(H.FEED_TIMEOUT_MS),cache:'no-store'})
    .then(r=>r.ok?r.json():null).then(d=>{if(d&&d.stocks){ST=d;stFehler=false;}else stFehler=true;})
    .catch(()=>{stFehler=true;}).finally(()=>{stLaden=null;try{if(H.curPage()==='cur'&&STOCK_IDS.includes(H.getSym().id))H.renderDetail();}catch(e){}});
}
const e=s=>H.escH(s==null?'':String(s));
const zahl=(v,n=1,suf='')=>v==null||!isFinite(v)?'–':(Math.round(v*10**n)/10**n).toFixed(n)+suf;
const geld=v=>{if(v==null||!isFinite(v))return'–';const a=Math.abs(v),s=v<0?'−':'';return s+(a>=1e12?(a/1e12).toFixed(2)+'T':a>=1e9?(a/1e9).toFixed(1)+'B':a>=1e6?(a/1e6).toFixed(0)+'M':a.toFixed(0));};
function leer(t,txt){return H.abTile(t,'',H.AB_LEER(txt),' ab-aktie');}
function datenOderLeer(id,titel){
  if(!ST){if(!stFehler)aktienDatenHolen();return{leer:leer(titel,stFehler?'stock_data.json could not be loaded.':'Loading company data …')};}
  const s=ST.stocks&&ST.stocks[id];
  if(!s)return{leer:leer(titel,`No company data for ${e(id)} in stock_data.json yet.`)};
  return{s};
}
// Einstufung gegen die eigene Historie (3-Jahres-Schnitt): fuer Bewertungs-
// kennzahlen ist niedriger = guenstiger. ±15 % gelten als "fairly valued".
function gegenHistorie(wert,schnitt,niedrigerBesser){
  if(wert==null||schnitt==null||!isFinite(wert)||!isFinite(schnitt)||schnitt<=0)return{t:'–',b:null};
  const q=wert/schnitt;
  if(q<0.85)return niedrigerBesser?{t:'Undervalued',b:'bull'}:{t:'Below avg',b:'bear'};
  if(q>1.15)return niedrigerBesser?{t:'Overvalued',b:'bear'}:{t:'Above avg',b:'bull'};
  return{t:niedrigerBesser?'Fairly valued':'In line',b:'neu'};
}
const farbe=b=>b?`style="color:${H.biasCss(b)}"`:'';

// ── Karte: Company (fest) ────────────────────────────────────────────────
export function karteProfil(c){
  const p=STOCK_PROFIL[c.id];if(!p)return'';
  const s=ST&&ST.stocks&&ST.stocks[c.id];
  const kopf=`<div class="stk-kopf"><b>${e(p.full)}</b> <i>${e(p.ticker)}</i>${s&&s.sector?` · <i>${e(s.sector)} / ${e(s.industry||'')}</i>`:''}</div>
    <div class="stk-was">${e(p.was)}</div>`;
  const abschnitt=(t,zeilen)=>`<div class="stk-gr"><div class="stk-gr-t">${e(t)}</div>${zeilen}</div>`;
  const kv=l=>`<table class="kv stk-kv">${l.map(([k,v])=>`<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join('')}</table>`;
  const punkte=(l,b)=>`<ul class="stk-ul">${l.map(x=>`<li${b?` ${farbe(b)}`:''}><span>${e(x)}</span></li>`).join('')}</ul>`;
  const fakten=s?kv([['Market cap',geld(s.mcap)],['Employees',s.mitarbeiter?s.mitarbeiter.toLocaleString('en-US'):'–'],['Next results',s.naechsteZahlen?H.fmtDayHdr(s.naechsteZahlen):'–']]):'';
  const inhalt=kopf+fakten+abschnitt('How it makes money',kv(p.geld))+abschnitt('Edge',punkte(p.vorteil))
    +abschnitt('Partners & dependencies',kv(p.partner))+abschnitt('Key risks',punkte(p.risiko,'bear'))+abschnitt('Moves the stock',punkte(p.treiber));
  return H.abTile('Company','',inhalt,' ab-aktie stk-profil',null,['Fixed profile: what the company does, where the money comes from, who it depends on.','Figures (market cap, employees, next results) come from stock_data.json; the text is curated and does not change daily.']);
}

// ── Karte: Valuation ─────────────────────────────────────────────────────
function zeilen(rows){
  return`<table class="ind-table stk-tab"><colgroup><col style="width:36%"><col style="width:16%"><col style="width:16%"><col style="width:32%"></colgroup>
    <thead><tr><th class="iht-name">Metric</th><th title="Current value">Now</th><th title="Average of the last 3 years, from the company's own filings">3Y avg</th><th title="Now against its own 3-year average">vs own history</th></tr></thead>
    <tbody>${rows.map(r=>{const g=r.g||{t:'–',b:null};return`<tr class="stk-z" title="${e(r.tip||'')}"><td class="ir-name"><span class="ir-name-txt">${e(r.n)}</span></td><td class="ir-act"><b>${r.v}</b></td><td class="ir-fc">${r.a}</td><td class="stk-urteil" ${farbe(g.b)}>${e(g.t)}</td></tr>`;}).join('')}</tbody></table>`;
}
export function karteBewertung(c){
  const r=datenOderLeer(c.id,'Valuation');if(r.leer)return r.leer;const s=r.s,a=s.schnitt3j||{};
  const neg=v=>v==null?'<i>n/a</i>':zahl(v,1);
  const rows=[
    {n:'Forward P/E',v:neg(s.fpe),a:'–',g:{t:'–',b:null},tip:'Price / expected earnings of the next 12 months (analyst estimates). No own history available.'},
    {n:'TTM P/E',v:s.tpe==null?'<i>loss</i>':zahl(s.tpe,1),a:zahl(a.tpe,1),g:gegenHistorie(s.tpe,a.tpe,true),tip:'Price / earnings of the last 12 months. Empty when the company made a loss.'},
    {n:'Price to sales',v:zahl(s.ps,1),a:zahl(a.ps,1),g:gegenHistorie(s.ps,a.ps,true),tip:'Market value / revenue of the last 12 months.'},
    {n:'Price to free cash flow',v:s.pfcf==null?'<i>n/a</i>':zahl(s.pfcf,1),a:zahl(a.pfcf,1),g:gegenHistorie(s.pfcf,a.pfcf,true),tip:'Market value / free cash flow (operating cash flow minus capex) of the last 12 months.'},
    {n:'EV / EBITDA',v:zahl(s.evEbitda,1),a:'–',g:{t:'–',b:null},tip:'Enterprise value (incl. debt) / operating profit before depreciation.'},
    {n:'PEG',v:zahl(s.peg,2),a:'–',g:s.peg==null?{t:'–',b:null}:s.peg<1?{t:'Cheap',b:'bull'}:s.peg>2?{t:'Expensive',b:'bear'}:{t:'Fair',b:'neu'},tip:'P/E divided by expected earnings growth. Below 1 = cheap for its growth, above 2 = expensive.'}
  ];
  const ziel=s.ana&&s.ana.median&&s.kurs?(s.ana.median/s.kurs-1)*100:null;
  const fuss=`<div class="ab-foot"><span><span class="ab-foot-l">Price</span> <b>${zahl(s.kurs,2)}</b></span><span><span class="ab-foot-l">Analyst median target</span> <b>${zahl(s.ana&&s.ana.median,2)}</b> ${ziel!=null?`<b ${farbe(ziel>=0?'bull':'bear')}>${ziel>=0?'+':''}${zahl(ziel,1,'%')}</b>`:''}</span><span><i>as of ${e(s.stand||'–')}</i></span></div>`;
  return H.abTile('Valuation','',zeilen(rows)+stkVerlaufHtml(s)+fuss,' ab-aktie',null,['Lower = cheaper. "vs own history" compares today with the company\'s own 3-year average from its SEC filings (±15 % = fairly valued).','No industry average: there is no free, reliable source for it - a made-up benchmark would be worse than none.','Display only - not part of the score.']);
}
// Verlauf P/E (5 Jahre, woechentlich) mit 3J-Schnitt als Linie
function stkVerlaufHtml(s){
  const l=(s.verlauf&&s.verlauf.pe)||[];if(l.length<10)return'';
  const W=480,Hh=92,pad=4,v=l.map(p=>p[1]),mn=Math.min(...v),mx=Math.max(...v),sp=(mx-mn)||1;
  const x=i=>pad+i/(l.length-1)*(W-2*pad),y=w=>Hh-pad-(w-mn)/sp*(Hh-2*pad);
  const pfad=l.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+','+y(p[1]).toFixed(1)).join('');
  const a=s.schnitt3j&&s.schnitt3j.tpe;
  return`<div class="stk-chart"><div class="stk-chart-t"><b>TTM P/E</b> <i>5 years, weekly${a?` · line = 3Y avg ${zahl(a,1)}`:''}</i> <span class="stk-chart-r">${zahl(mn,0)} – ${zahl(mx,0)}</span></div>
    <svg viewBox="0 0 ${W} ${Hh}" width="100%" height="${Hh}" preserveAspectRatio="none" class="stk-svg"><path d="${pfad}" fill="none" stroke="var(--blue)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>${a&&a>=mn&&a<=mx?`<line x1="${pad}" x2="${W-pad}" y1="${y(a).toFixed(1)}" y2="${y(a).toFixed(1)}" stroke="var(--t3)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>`:''}</svg>
    <div class="stk-achse"><span>${e(l[0][0].slice(0,4))}</span><span>${e(l[l.length-1][0].slice(0,4))}</span></div></div>`;
}

// ── Karte: Growth & quality ──────────────────────────────────────────────
export function karteQualitaet(c){
  const r=datenOderLeer(c.id,'Growth & quality');if(r.leer)return r.leer;const s=r.s,a=s.schnitt3j||{};
  const p=v=>v==null?'–':zahl(v,1,'%');
  const rows=[
    {n:'Revenue growth y/y',v:p(s.revG),a:p(a.revG),g:gegenHistorie(s.revG,a.revG,false),tip:'Latest quarter against the same quarter a year ago.'},
    {n:'Earnings growth y/y',v:p(s.epsG),a:'–',g:s.epsG==null?{t:'–',b:null}:{t:s.epsG>=0?'Growing':'Shrinking',b:s.epsG>=0?'bull':'bear'},tip:'Latest quarter against the same quarter a year ago.'},
    {n:'Gross margin',v:p(s.gm),a:'–',g:{t:'–',b:null},tip:'Revenue minus cost of goods sold, in % of revenue.'},
    {n:'Operating margin',v:p(s.om),a:'–',g:{t:'–',b:null},tip:'Operating profit in % of revenue.'},
    {n:'Net margin',v:p(s.nm),a:p(a.nm),g:gegenHistorie(s.nm,a.nm,false),tip:'Net profit in % of revenue.'},
    {n:'Return on equity',v:p(s.roe),a:'–',g:s.roe==null?{t:'–',b:null}:{t:s.roe>=15?'Strong':s.roe>=0?'Moderate':'Negative',b:s.roe>=15?'bull':s.roe>=0?'neu':'bear'},tip:'Net profit in % of shareholders\' equity. Above 15 % is strong.'},
    {n:'Debt to equity',v:zahl(s.de,2),a:'–',g:s.de==null?{t:'–',b:null}:{t:s.de<=0.5?'Low':s.de<=1.5?'Moderate':'High',b:s.de<=0.5?'bull':s.de<=1.5?'neu':'bear'},tip:'Total debt / shareholders\' equity.'},
    {n:'Free cash flow (TTM)',v:geld(s.fcfTtm),a:'–',g:s.fcfTtm==null?{t:'–',b:null}:{t:s.fcfTtm>0?'Positive':'Negative',b:s.fcfTtm>0?'bull':'bear'},tip:'Operating cash flow minus capex, last 12 months, from SEC filings.'},
    {n:'Dividend yield',v:p(s.divY),a:'–',g:{t:'–',b:null},tip:'Annual dividend / price.'}
  ];
  return H.abTile('Growth & quality','',zeilen(rows),' ab-aktie',null,['Growth, profitability and balance sheet. 3Y averages from the company\'s SEC filings where available.','Display only - not part of the score.']);
}

// ── Karte: Analysts ──────────────────────────────────────────────────────
export function karteAnalysten(c){
  const r=datenOderLeer(c.id,'Analysts');if(r.leer)return r.leer;const s=r.s,a=s.ana||{};
  const teile=[['Strong buy',a.sb,'bull',1],['Buy',a.b,'bull',.6],['Hold',a.h,'neu',1],['Sell',a.s,'bear',.6],['Strong sell',a.ss,'bear',1]];
  const sum=teile.reduce((x,t)=>x+(t[1]||0),0);
  if(!sum)return leer('Analysts','No analyst ratings in stock_data.json.');
  const balken=`<div class="stk-bar">${teile.map(([n,v,b,o])=>v?`<span style="flex:${v};background:${H.biasCss(b)};opacity:${o}" title="${e(n)}: ${v}"></span>`:'').join('')}</div>
    <table class="kv stk-kv">${teile.map(([n,v,b])=>`<tr><th>${e(n)}</th><td><b ${farbe(v?b:null)}>${v==null?'–':v}</b> <i>${sum?Math.round((v||0)/sum*100):0}%</i></td></tr>`).join('')}</table>`;
  const auf=x=>x&&s.kurs?(x/s.kurs-1)*100:null;
  const ziel=`<div class="stk-gr"><div class="stk-gr-t">Price targets</div><table class="kv stk-kv">${[['Median',a.median],['Mean',a.mittel],['High',a.hoch],['Low',a.tief]].map(([n,v])=>{const u=auf(v);return`<tr><th>${n}</th><td><b>${zahl(v,2)}</b> ${u!=null?`<b ${farbe(u>=0?'bull':'bear')}>${u>=0?'+':''}${zahl(u,1,'%')}</b>`:''}</td></tr>`;}).join('')}</table></div>`;
  const kons=a.urteil?`<div class="stk-kopf">Consensus <b ${farbe(/buy/.test(a.urteil)?'bull':/sell|under/.test(a.urteil)?'bear':'neu')}>${e(a.urteil.replace('_',' '))}</b> <i>${a.n||sum} analysts</i></div>`:'';
  const halter=`<div class="ab-foot"><span><span class="ab-foot-l">Held by institutions</span> <b>${zahl(s.institutionell,1,'%')}</b></span><span><span class="ab-foot-l">Insider net buying (6M)</span> <b ${farbe(s.insiderNetto>0?'bull':s.insiderNetto<0?'bear':null)}>${zahl(s.insiderNetto,1,'%')}</b></span></div>`;
  return H.abTile('Analysts','',kons+balken+ziel+halter,' ab-aktie',null,['Current Wall Street ratings and 12-month price targets (Yahoo Finance).','Upside = target against the current price.','Display only - not part of the score.']);
}

// ── Karte: Earnings ──────────────────────────────────────────────────────
export function karteZahlen(c){
  const r=datenOderLeer(c.id,'Earnings');if(r.leer)return r.leer;const s=r.s;
  const q=s.quartale||[];
  const tg=s.naechsteZahlen?H.daysUntil(s.naechsteZahlen):null;
  const kopf=`<div class="stk-kopf">Next results <b>${s.naechsteZahlen?e(H.fmtDayHdr(s.naechsteZahlen)):'–'}</b>${tg!=null&&tg>=0?` <span class="ir-next${tg<=7?' soon':''}">${tg}d</span>`:''}</div>`;
  if(q.length<2)return H.abTile('Earnings','',kopf+H.AB_LEER('No quarterly history yet.'),' ab-aktie');
  const W=480,Hh=110,pad=6,mx=Math.max(...q.map(x=>Math.max(x[1]||0,Math.abs(x[2]||0))))||1;
  const bw=(W-2*pad)/q.length,null0=Hh-22;
  const sk=v=>v/mx*(null0-pad);
  const bars=q.map((x,i)=>{const x0=pad+i*bw;const u=sk(x[1]||0),g=sk(x[2]||0);
    return`<rect x="${(x0+bw*.12).toFixed(1)}" y="${(null0-u).toFixed(1)}" width="${(bw*.36).toFixed(1)}" height="${Math.max(1,u).toFixed(1)}" fill="var(--blue)" opacity=".55"><title>${e(x[0])} revenue ${geld(x[1])}</title></rect>`
      +`<rect x="${(x0+bw*.52).toFixed(1)}" y="${(g>=0?null0-g:null0).toFixed(1)}" width="${(bw*.36).toFixed(1)}" height="${Math.max(1,Math.abs(g)).toFixed(1)}" fill="${H.biasCss((x[2]||0)>=0?'bull':'bear')}"><title>${e(x[0])} net income ${geld(x[2])}</title></rect>`
      +(i%2?'':`<text x="${(x0+bw/2).toFixed(1)}" y="${Hh-6}" text-anchor="middle" font-size="11" fill="var(--t3)">${e(x[0].slice(2,7).replace('-','/'))}</text>`);}).join('');
  const l=q[q.length-1];
  const fuss=`<div class="ab-foot"><span><span class="ab-foot-l">Last quarter</span> <b>${e(H.fmtDayHdr(l[0]))}</b></span><span><span class="ab-foot-l">Revenue</span> <b>${geld(l[1])}</b> ${l[3]!=null?`<b ${farbe(l[3]>=0?'bull':'bear')}>${l[3]>=0?'+':''}${zahl(l[3],1,'%')} y/y</b>`:''}</span><span><span class="ab-foot-l">Net income</span> <b>${geld(l[2])}</b></span></div>`;
  return H.abTile('Earnings','',kopf+`<div class="stk-chart"><div class="stk-chart-t"><span class="stk-lg"><i style="background:var(--blue);opacity:.55"></i>Revenue</span> <span class="stk-lg"><i style="background:${H.biasCss('bull')}"></i>Net income</span> <i>last ${q.length} quarters, SEC filings</i></div><svg viewBox="0 0 ${W} ${Hh}" width="100%" height="${Hh}" class="stk-svg">${bars}<line x1="${pad}" x2="${W-pad}" y1="${null0}" y2="${null0}" stroke="var(--bd2)"/></svg></div>`+fuss,' ab-aktie',null,['Quarterly revenue and net income from the company\'s 10-Q/10-K filings at the SEC.','Next results date from Yahoo Finance.']);
}
