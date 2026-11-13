const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: KATEGORIE STOCKS (2026-11-13) ═══════════════════════════════
// Nutzer: "neue Kategorie ... stocks also Aktien ... nvidia, amd, Intel,
// Apple, Google ... Indikatoren sollen die gleichen wie bei sp500 sein ...
// das sind dann die vom usd ... feste Karte in der übersichtlich das
// Unternehmen erklärt wird ... neue Karten zu wichtigen Indikatoren".
// Daten: check/fixtures/stock_test.json (TESTDATEN, nur fuer diesen Waechter,
// nach dem Muster der echten stock_data.json) - die echte Datei schreibt der
// Feed (tools/aktien.mjs) und ist lokal nicht abrufbar.
// Geprueft (1440 und 390 px):
//   A) Kategorie Stocks mit NVDA, AMD, INTC, AAPL, GOOGL; Klasse stock, Makro = USD
//   B) Makro-Karten zaehlen wie beim S&P 500: Inflation, Labour Market,
//      Economic Growth je Aktie mit demselben Karten-Score wie SP500
//   C) Reihe Company: Company | Valuation | Growth & quality; darunter
//      Analysts | Earnings | Seasonality; KEINE COT- und keine Retail-Karte
//   D) Werte = Datei: NVDA TTM P/E 21.0, 3Y 52.1, "Undervalued"; INTC TTM P/E "loss"
//   E) kein Seitenueberlauf, keine JS-Fehler
// Gegenprobe --gegenprobe: ausgeliefertes main.js ohne die Company-Reihe -> C rot.
const {chromium}=require(PW);const path=require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
const AKTIEN=['NVDA','AMD','INTC','AAPL','GOOGL'];
(async()=>{
  const b=await chromium.launch();const F=[];
  for(const [W,H] of [[1440,900],[390,844]]){
    const ctx=await b.newContext({viewport:{width:W,height:H},serviceWorkers:'block'});
    await ctx.route(/stock_data\.json/,r=>r.fulfill({path:path.join(__dirname,'fixtures','stock_test.json'),contentType:'application/json'}));
    if(GP)await ctx.route(/\/js\/main\.js/,async r=>{const res=await r.fetch();let t=await res.text();t=t.replace("${aktie?`${abReihenTitel('Company')}","${false?`${abReihenTitel('Company')}");r.fulfill({response:res,body:t});});
    const p=await ctx.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
    await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
    await p.goto('http://127.0.0.1:'+PORT+'/index.html');await wartenBisDatenDa(p);
    await p.evaluate(()=>{['lockScreen','introOv'].forEach(x=>{const e=document.getElementById(x);if(e)e.remove();});});
    const o=W+'px';
    const A=await p.evaluate(ids=>({kat:[...document.querySelectorAll('#sidebar *')].some(e=>e.textContent.trim()==='Stocks'),
      s:ids.map(id=>{const s=syms.find(x=>x.id===id);return s?id+':'+assetCls(id)+':'+macroCcyFor(id):id+':fehlt';})}),AKTIEN);
    if(!A.kat)F.push(o+' A: keine Kategorie "Stocks" in der Seitenleiste');
    A.s.forEach(x=>{if(!/:stock:USD$/.test(x))F.push(o+' A: '+x+' (erwartet Klasse stock, Makro USD)');});
    for(const id of ['NVDA','INTC']){
      await p.evaluate(id=>{document.querySelectorAll('.ov').forEach(x=>{x.style.display='none';});gotoSym(id);},id);await p.waitForTimeout(1800);
      const L=await p.evaluate(()=>{
        const titel=[...document.querySelectorAll('#detail .ab-tile-t')].map(x=>x.textContent.trim());
        const rub=n=>{const s=getSym(),sp=syms.find(x=>x.id==='SP500');const a=s.rubrics.find(r=>r.name===n),b=sp.rubrics.find(r=>r.name===n);return[a?a.bias:null,b?b.bias:null];};
        const zelle=(karte,metrik)=>{const k=[...document.querySelectorAll('#detail .ab-tile')].find(t=>(t.querySelector('.ab-tile-t')||{}).textContent===karte);if(!k)return null;const z=[...k.querySelectorAll('tr.stk-z')].find(r=>r.querySelector('.ir-name').textContent.trim()===metrik);return z?[...z.children].map(c=>c.textContent.trim()):null;};
        return{titel,makro:['Inflation','Labour Market','Economic Growth'].map(n=>[n,...rub(n)]),pe:zelle('Valuation','TTM P/E'),ueber:document.documentElement.scrollWidth-innerWidth};});
      const t=L.titel;
      for(const k of ['Company','Valuation','Growth & quality','Analysts','Earnings','Seasonality'])if(!t.includes(k))F.push(`${o} ${id} C: Karte "${k}" fehlt`);
      for(const k of ['COT Positioning','Retail Positioning'])if(t.includes(k))F.push(`${o} ${id} C: Karte "${k}" steht da (gibt es fuer Einzelaktien nicht)`);
      L.makro.forEach(([n,a,b])=>{if(a!==b)F.push(`${o} ${id} B: ${n} Bias ${a}, beim S&P 500 ${b} (soll gleich gewertet werden)`);});
      if(id==='NVDA'&&L.pe&&(L.pe[1]!=='21.0'||L.pe[2]!=='52.1'||L.pe[3]!=='Undervalued'))F.push(`${o} D: NVDA TTM P/E ${L.pe.join(' | ')} (erwartet 21.0 | 52.1 | Undervalued)`);
      if(id==='INTC'&&L.pe&&(L.pe[1]!=='loss'||L.pe[2]!=='–'))F.push(`${o} D: INTC TTM P/E ${L.pe.join(' | ')} (erwartet loss | –)`);
      if(!L.pe&&!GP)F.push(`${o} ${id} D: Zeile TTM P/E fehlt`);
      if(L.ueber>1)F.push(`${o} ${id} E: Seite laeuft ${L.ueber} px ueber`);
    }
    err.forEach(e=>F.push(o+' E JS-Fehler: '+e));
    await ctx.close();
  }
  await b.close();
  if(GP){const ok=F.some(f=>/C: Karte "Company" fehlt/.test(f));console.log(ok?'aktien --gegenprobe: ok (fehlende Company-Reihe gemeldet)':'aktien --gegenprobe: FEHLER\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('aktien: '+F.length+' Befund(e)\n  '+F.slice(0,30).join('\n  '));process.exit(1);}
  console.log('aktien: ok (Kategorie Stocks mit 5 Aktien, Makro wie S&P 500, Company/Valuation/Growth & quality + Analysts/Earnings/Seasonality, Werte = Datei)');
})().catch(e=>{console.log('aktien: ABBRUCH '+e.message);process.exit(1);});
