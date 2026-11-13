// ══ SONDE: WELCHE AKTIEN-KENNZAHLEN LIEFERN DIE QUELLEN? (2026-11-13) ══════
// Nutzer: neue Kategorie Stocks (NVDA, AMD, INTC, AAPL, GOOGL) mit Karten zu
// Bewertung/Fundamentaldaten (P/E, Forward P/E, P/S, P/FCF, Wachstum, ROE,
// Verschuldung, Analysten ...). Yahoo und TradingView sind aus der Claude-
// Umgebung gesperrt - die Sonde laeuft auf dem Runner. Schreibt NICHTS.
//   node tools/aktien-sonde.mjs
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TICK=['NVDA','AMD','INTC','AAPL','GOOGL'];
const kurz=(v,n=160)=>{const s=typeof v==='string'?v:JSON.stringify(v);return s==null?String(s):s.length>n?s.slice(0,n)+'…':s;};
async function j(url,opt={}){try{const r=await fetch(url,opt);const t=await r.text();let d=null;try{d=JSON.parse(t);}catch(e){}return{st:r.status,d,t,h:r.headers};}catch(e){return{st:'ERR '+e.message};}}

// ── 1) Yahoo: Cookie + Crumb, quoteSummary, fundamentals-timeseries ───────
async function yahoo(){
  console.log('\n=== YAHOO ===');
  const r0=await fetch('https://fc.yahoo.com',{headers:{'User-Agent':UA},redirect:'manual'}).catch(e=>null);
  const ck=r0?(r0.headers.getSetCookie?r0.headers.getSetCookie():[r0.headers.get('set-cookie')]).filter(Boolean).map(c=>c.split(';')[0]).join('; '):'';
  const cr=await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb',{headers:{'User-Agent':UA,Cookie:ck}}).then(r=>r.text()).catch(()=>'');
  console.log('cookie',ck?'ja':'nein','crumb len',cr.length);
  const H={headers:{'User-Agent':UA,Cookie:ck,Accept:'application/json'}};
  const MOD='assetProfile,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,calendarEvents,earnings,earningsTrend,upgradeDowngradeHistory,institutionOwnership,majorHoldersBreakdown,netSharePurchaseActivity';
  for(const t of TICK){
    const r=await j(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=${MOD}&crumb=${encodeURIComponent(cr)}`,H);
    const q=r.d&&r.d.quoteSummary&&r.d.quoteSummary.result&&r.d.quoteSummary.result[0];
    if(!q){console.log(t,'quoteSummary',r.st,kurz(r.t,200));continue;}
    const raw=x=>x&&typeof x==='object'&&'raw' in x?x.raw:x;
    const sd=q.summaryDetail||{},ks=q.defaultKeyStatistics||{},fd=q.financialData||{},ap=q.assetProfile||{};
    const zeig={
      sector:ap.sector,industry:ap.industry,employees:ap.fullTimeEmployees,summaryLen:(ap.longBusinessSummary||'').length,
      price:raw(fd.currentPrice),trailingPE:raw(sd.trailingPE),forwardPE:raw(sd.forwardPE)??raw(ks.forwardPE),peg:raw(ks.pegRatio),
      ps:raw(sd.priceToSalesTrailing12Months),pb:raw(ks.priceToBook),evEbitda:raw(ks.enterpriseToEbitda),mcap:raw(sd.marketCap),
      fcf:raw(fd.freeCashflow),revGrowth:raw(fd.revenueGrowth),earnGrowth:raw(fd.earningsGrowth),roe:raw(fd.returnOnEquity),
      de:raw(fd.debtToEquity),grossM:raw(fd.grossMargins),opM:raw(fd.operatingMargins),netM:raw(fd.profitMargins),
      divY:raw(sd.dividendYield),beta:raw(sd.beta),tMean:raw(fd.targetMeanPrice),tMed:raw(fd.targetMedianPrice),tHigh:raw(fd.targetHighPrice),tLow:raw(fd.targetLowPrice),
      nAnalyst:raw(fd.numberOfAnalystOpinions),recKey:fd.recommendationKey,recMean:raw(fd.recommendationMean),
      recTrend:(q.recommendationTrend&&q.recommendationTrend.trend||[]).slice(0,1),
      nextEarn:((q.calendarEvents||{}).earnings||{}).earningsDate,
      qRev:(((q.earnings||{}).financialsChart||{}).quarterly||[]).length,
      instPct:raw((q.majorHoldersBreakdown||{}).institutionsPercentHeld),insiderNet:raw((q.netSharePurchaseActivity||{}).netPercentInsiderShares),
      upDown:((q.upgradeDowngradeHistory||{}).history||[]).length
    };
    console.log(t,kurz(zeig,1400));
  }
  // Quartals-Historie (fuer 3-Jahres-Durchschnitte)
  const typen='quarterlyTotalRevenue,quarterlyNetIncome,quarterlyDilutedEPS,quarterlyFreeCashFlow,quarterlyStockholdersEquity,quarterlyTotalDebt,annualTotalRevenue,annualDilutedEPS,trailingPeRatio,trailingForwardPeRatio,trailingPsRatio';
  const p1=Math.floor(Date.now()/1000)-86400*365*6,p2=Math.floor(Date.now()/1000);
  const r=await j(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/NVDA?type=${typen}&period1=${p1}&period2=${p2}&crumb=${encodeURIComponent(cr)}`,H);
  const res=r.d&&r.d.timeseries&&r.d.timeseries.result;
  console.log('timeseries NVDA',r.st,res?res.map(x=>{const k=x.meta&&x.meta.type&&x.meta.type[0];const a=x[k]||[];return k+':'+a.length+(a.length?' ['+a[0].asOfDate+'..'+a[a.length-1].asOfDate+']':'');}).join(' | '):kurz(r.t,200));
  // Optionen (Put/Call) fuer eine Aktie
  const o=await j(`https://query1.finance.yahoo.com/v7/finance/options/NVDA?crumb=${encodeURIComponent(cr)}`,H);
  const oc=o.d&&o.d.optionChain&&o.d.optionChain.result&&o.d.optionChain.result[0];
  console.log('options NVDA',o.st,oc?('Verfaelle '+(oc.expirationDates||[]).length+', calls '+((oc.options||[{}])[0].calls||[]).length):kurz(o.t,200));
  // Monatskurse 15 Jahre (Saisonalitaet)
  const c=await j('https://query1.finance.yahoo.com/v8/finance/chart/NVDA?range=15y&interval=1mo',{headers:{'User-Agent':UA}});
  const cc=c.d&&c.d.chart&&c.d.chart.result&&c.d.chart.result[0];
  console.log('chart NVDA 15y 1mo',c.st,cc?(cc.timestamp||[]).length+' Monate':kurz(c.t,200));
}

// ── 2) TradingView-Scanner: jede Spalte einzeln (unbekannte -> Fehler) ────
async function tv(){
  console.log('\n=== TRADINGVIEW SCANNER (america) ===');
  const SP=['close','market_cap_basic','price_earnings_ttm','price_earnings_forward_fy','forward_pe','price_sales_current','price_sales_ratio','price_book_ratio','price_free_cash_flow_ttm','enterprise_value_ebitda_ttm','debt_to_equity','debt_to_equity_fq','return_on_equity','return_on_equity_fq','gross_margin','operating_margin','net_margin','net_margin_ttm','total_revenue_yoy_growth_ttm','total_revenue_qoq_growth_fq','earnings_per_share_diluted_yoy_growth_ttm','earnings_per_share_diluted_ttm','free_cash_flow_ttm','dividend_yield_recent','dividends_yield_current','beta_1_year','recommendation_mark','Recommend.All','price_target_average','price_target_1y','price_target_high','price_target_low','earnings_release_next_date','earnings_release_date','sector','industry','description','RSI','SMA200','Perf.Y','Perf.YTD','price_52_week_high','price_52_week_low','total_revenue_fq_h','revenue_fq_h','price_earnings_ttm_h','net_income_fq_h'];
  const ok=[],weg=[];
  for(const s of SP){
    const r=await j('https://scanner.tradingview.com/america/scan',{method:'POST',headers:{'User-Agent':UA,Origin:'https://www.tradingview.com','Content-Type':'application/json'},body:JSON.stringify({symbols:{tickers:['NASDAQ:NVDA','NASDAQ:INTC'],query:{types:[]}},columns:[s]})});
    const row=r.d&&r.d.data&&r.d.data[0];
    if(row)ok.push(s+'='+kurz(row.d[0],60));else weg.push(s+'('+r.st+')');
    await new Promise(x=>setTimeout(x,250));
  }
  console.log('OK  ',ok.join('\n    '));console.log('NEIN',weg.join(', '));
}

// ── 3) SEC EDGAR companyfacts (Quartalszahlen aus den Pflichtmeldungen) ────
async function sec(){
  console.log('\n=== SEC EDGAR ===');
  for(const ua of ['FXAnalystPro research tool','Mozilla/5.0 (compatible; FXAnalystPro/1.0)']){
    const r=await j('https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json',{headers:{'User-Agent':ua,Accept:'application/json'}});
    const f=r.d&&r.d.facts&&r.d.facts['us-gaap'];
    console.log('UA',JSON.stringify(ua),'status',r.st,f?('Revenues-Facts '+((f.Revenues||{}).units||{USD:[]}).USD.length+', NetIncomeLoss '+((f.NetIncomeLoss||{}).units||{USD:[]}).USD.length):kurz(r.t,120));
  }
}
await yahoo();await tv();await sec();
