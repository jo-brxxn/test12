// ══ SEKTOREN-KATALOG (2026-11-12) ═══════════════════════════════════════
// Nutzer 2026-11-11: "die Wirtschaft soll in jeden Sektor auseinander
// genommen werden das man jedes Investment sieht jede Nachfrage jeden Markt
// egal ob Haus oder yields" - und 2026-11-12: "Mach nur anzeigen".
// EINE Liste fuer Feed (tools/sektoren.mjs -> sektor_data.json) und App
// (Sectors-Schalter der MACRO-Zeile). Reine Anzeige: nichts hiervon zaehlt
// in den Score.
// Zeile: k = fester Schluessel, n = Name auf der Oberflaeche (nie gekuerzt),
//   ind = Indikator der Haupt-Tabellen (Wert kommt dann aus ind_data.json,
//         damit beide Ansichten dieselbe Zahl zeigen),
//   re  = Titel-Muster des TradingView-Kalenders in Rangfolge (das erste mit
//         einer frischen Veroeffentlichung gewinnt), geprueft gegen den Titel
//         OHNE Zusatz Prel/Final/Flash/Adv/2nd Est/3rd Est, klein geschrieben,
//   (der Zeitraum y/y, m/m, q/q steht NICHT im Namen - er kommt je Waehrung
//    aus dem Titel der Quelle, z.B. NZD-CPI ist q/q)
//   anl = Rendite aus bond_data.json ('2Y'|'10Y'|'kurve'),
//   nur = nur fuer diese Waehrungen.
// Eine Zeile ohne Veroeffentlichung in den letzten 200 Tagen erscheint nicht
// (Nutzer 2026-11-10: "wenn die Daten nicht verfuegbar sind dann rausnehmen").
export const SEKTOR_FRISCH_TAGE=200;
export const SEKTOREN=[
  {titel:'Prices & money',akz:'infl',gruppen:[
    {titel:'Consumer prices',reihen:[
      {k:'cpi_yy',n:'CPI',ind:'CPI (Headline)',re:[/^inflation rate yoy$/,/^quarterly inflation rate yoy$/]},
      {k:'cpi_mm',n:'CPI',re:[/^inflation rate mom$/,/^inflation rate qoq$/,/^quarterly inflation rate qoq$/]},
      {k:'core_yy',n:'Core CPI',ind:'Core CPI',re:[/^core inflation rate yoy$/,/^rba trimmed mean cpi yoy$/]},
      {k:'core_mm',n:'Core CPI',re:[/^core inflation rate mom$/,/^rba trimmed mean cpi mom$/]},
      {k:'pce_yy',n:'PCE',ind:'PCE',re:[/^pce price index yoy$/]},
      {k:'cpce_yy',n:'Core PCE',ind:'Core PCE',re:[/^core pce price index yoy$/]},
      {k:'svc_yy',n:'Services inflation',ind:'Services Inflation',re:[/^services inflation yoy$/]},
      {k:'trim_yy',n:'CPI trimmed mean',re:[/^cpi trimmed-mean yoy$/]},
      {k:'median_yy',n:'CPI median',re:[/^cpi median yoy$/,/^rba weighted median cpi yoy$/]},
      {k:'tokyo_yy',n:'Tokyo core CPI',re:[/^tokyo core cpi yoy$/]},
      {k:'food_yy',n:'Food prices',re:[/^food inflation yoy$/]}]},
    {titel:'Producer & trade prices',reihen:[
      {k:'ppi_yy',n:'PPI',ind:'PPI',re:[/^ppi yoy$/,/^ppi output yoy$/,/^producer & import prices yoy$/]},
      {k:'ppi_mm',n:'PPI',re:[/^ppi mom$/,/^ppi output mom$/,/^producer & import prices mom$/,/^ppi qoq$/,/^ppi output qoq$/]},
      {k:'cppi_yy',n:'Core PPI',ind:'Core PPI',re:[/^core ppi yoy$/,/^ppi core output yoy$/]},
      {k:'ppi_in',n:'PPI input',re:[/^ppi input yoy$/,/^ppi input qoq$/,/^raw materials prices yoy$/]},
      {k:'imp_p',n:'Import prices',re:[/^import prices yoy$/,/^import prices mom$/,/^import prices qoq$/]},
      {k:'exp_p',n:'Export prices',re:[/^export prices yoy$/,/^export prices mom$/,/^export prices qoq$/]},
      {k:'gdp_defl',n:'GDP price index',re:[/^gdp price index qoq$/,/^gdp price index yoy$/,/^gdp chain price index qoq$/,/^gdp implicit price qoq$/]},
      {k:'cmdty',n:'Commodity prices',re:[/^commodity prices yoy$/]}]},
    {titel:'Wages & labour cost',reihen:[
      {k:'wage_yy',n:'Wages',ind:'Avg Hourly Earnings',re:[/^average hourly earnings yoy$/,/^average earnings incl\. bonus \(3mo\/yr\)$/,/^average cash earnings yoy$/,/^average hourly wages yoy$/,/^wage price index yoy$/,/^wage growth yoy$/,/^labour costs index yoy$/,/^labour cost index yoy$/]},
      {k:'wage_mm',n:'Wages',re:[/^average hourly earnings mom$/,/^wage price index qoq$/,/^labour costs index qoq$/]},
      {k:'wage_ex',n:'Wages excluding bonus',re:[/^average earnings excl\. bonus \(3mo\/yr\)$/]},
      {k:'eci',n:'Employment cost index',re:[/^employment cost index qoq$/]},
      {k:'ulc',n:'Unit labour costs',re:[/^unit labour costs qoq$/]},
      {k:'prod',n:'Productivity',re:[/^nonfarm productivity qoq$/,/^labour productivity qoq$/,/^labor productivity qoq$/]}]},
    {titel:'Inflation expectations',reihen:[
      {k:'exp_1y',n:'Consumer inflation expectations',ind:'Inflation Expectations',re:[/^michigan inflation expectations$/,/^ecb consumer inflation expectations$/,/^consumer inflation expectations$/,/^dmp 1y cpi expectations$/,/^business inflation expectations$/]},
      {k:'exp_5y',n:'Michigan 5-year inflation expectations',re:[/^michigan 5 year inflation expectations$/]},
      {k:'exp_ny',n:'New York Fed 1-year inflation expectations',nur:['USD'],re:[/^consumer inflation expectations$/]}]},
    {titel:'Money & credit',reihen:[
      {k:'m_supply',n:'Money supply',ind:'Money Supply',re:[/^m3 money supply annual growth$/,/^m2 money supply yoy$/]},
      {k:'cons_credit',n:'Consumer credit',re:[/^consumer credit change$/,/^boe consumer credit$/]},
      {k:'loans_hh',n:'Loans to households',re:[/^loans to households yoy$/,/^housing credit mom$/]},
      {k:'loans_co',n:'Loans to companies',re:[/^loans to companies yoy$/]},
      {k:'bank_lend',n:'Bank lending',re:[/^bank lending yoy$/,/^private sector credit yoy$/,/^outstanding loan growth yoy$/,/^net lending to individuals mom$/]},
      {k:'new_loans',n:'New loans',re:[/^new yuan loans$/]},
      {k:'tsf',n:'Total social financing',re:[/^total social financing$/]},
      {k:'cb_bs',n:'Central bank balance sheet',re:[/^fed balance sheet$/]}]},
    {titel:'Rates & yields',reihen:[
      {k:'policy',n:'Policy rate',ind:'Central Bank Rate',re:[/^interest rate$/,/interest rate decision$/,/^deposit facility rate$/,/^loan prime rate 1y$/]},
      {k:'y2',n:'2-year yield',anl:'2Y'},
      {k:'y10',n:'10-year yield',anl:'10Y'},
      {k:'curve',n:'Yield curve 10Y minus 2Y',anl:'kurve'},
      {k:'mort',n:'30-year mortgage rate',re:[/^mba 30-year mortgage rate$/,/^bba mortgage rate$/,/^loan prime rate 5y$/]},
      {k:'auct10',n:'10-year note auction yield',re:[/^10-year note auction$/]}]}]},
  {titel:'Jobs & households',akz:'lab',gruppen:[
    {titel:'Jobs',reihen:[
      {k:'emp',n:'Employment',ind:'NFP / Employment Change',re:[/^non farm payrolls$/,/^employment change$/,/^employment change qoq$/]},
      {k:'unemp',n:'Unemployment rate',ind:'Unemployment Rate',re:[/^unemployment rate$/]},
      {k:'adp',n:'ADP employment change',ind:'ADP Employment',re:[/^adp employment change$/]},
      {k:'claims',n:'Initial jobless claims',ind:'Unemployment Claims',re:[/^initial jobless claims$/,/^claimant count change$/]},
      {k:'cont',n:'Continuing jobless claims',re:[/^continuing jobless claims$/]},
      {k:'jolts',n:'Job openings',ind:'JOLTS Job Openings',re:[/^jolts job openings$/,/^anz-indeed job ads mom$/,/^jobs\/applications ratio$/]},
      {k:'part',n:'Participation rate',re:[/^participation rate$/]},
      {k:'full',n:'Full-time employment change',re:[/^full time employment chg$/]},
      {k:'priv',n:'Private payrolls',re:[/^nonfarm payrolls private$/,/^hmrc payrolls change$/]},
      {k:'cuts',n:'Challenger job cuts',re:[/^challenger job cuts$/]},
      {k:'hours',n:'Average weekly hours',re:[/^average weekly hours$/]}]},
    {titel:'Income & spending',reihen:[
      {k:'retail_mm',n:'Retail sales',ind:'Retail Sales',re:[/^retail sales mom$/,/^retail sales qoq$/]},
      {k:'retail_yy',n:'Retail sales',re:[/^retail sales yoy$/]},
      {k:'retail_ex',n:'Retail sales excluding autos or fuel',re:[/^retail sales ex autos mom$/,/^retail sales ex fuel mom$/]},
      {k:'income',n:'Personal income',re:[/^personal income mom$/]},
      {k:'spend',n:'Personal spending',re:[/^personal spending mom$/,/^household spending mom$/,/^household consumption mom$/]},
      {k:'real_c',n:'Real consumer spending',re:[/^real consumer spending qoq$/,/^gdp private consumption qoq$/,/^gdp final consumption qoq$/]},
      {k:'cars',n:'Vehicle sales',re:[/^total vehicle sales$/,/^new car sales yoy$/,/^vehicle sales yoy$/,/^new motor vehicle sales$/]}]},
    {titel:'Confidence',reihen:[
      {k:'conf',n:'Consumer confidence',ind:'Consumer Confidence',re:[/^cb consumer confidence$/,/^consumer confidence$/,/^consumer confidence index$/,/^gfk consumer confidence$/,/^westpac consumer confidence index$/,/^anz roy morgan consumer confidence$/]},
      {k:'mich',n:'Michigan consumer sentiment',re:[/^michigan consumer sentiment$/]},
      {k:'mich_exp',n:'Michigan consumer expectations',re:[/^michigan consumer expectations$/]},
      {k:'ecosent',n:'Economic sentiment',re:[/^economic sentiment$/,/^economic sentiment index$/,/^eco watchers survey current$/,/^rcm\/tipp economic optimism index$/]}]},
    {titel:'Housing',reihen:[
      {k:'starts',n:'Housing starts',re:[/^housing starts$/,/^housing starts yoy$/]},
      {k:'permits',n:'Building permits',ind:'Building Permits',re:[/^building permits$/,/^building permits mom$/]},
      {k:'exist',n:'Existing home sales',re:[/^existing home sales$/]},
      {k:'newh',n:'New home sales',re:[/^new home sales$/]},
      {k:'pend',n:'Pending home sales',re:[/^pending home sales mom$/]},
      {k:'hpi',n:'House prices',re:[/^s&p\/case-shiller home price yoy$/,/^house price index yoy$/,/^nationwide housing prices yoy$/,/^halifax house price index yoy$/]},
      {k:'hpi_mm',n:'House prices',re:[/^house price index mom$/,/^nationwide housing prices mom$/,/^cotality dwelling prices mom$/,/^new housing price index mom$/]},
      {k:'rics',n:'RICS house price balance',re:[/^rics house price balance$/]},
      {k:'mapp',n:'Mortgage approvals',re:[/^mortgage approvals$/,/^home loans qoq$/]},
      {k:'mappl',n:'Mortgage applications',re:[/^mba mortgage applications$/]},
      {k:'nahb',n:'NAHB housing market index',re:[/^nahb housing market index$/]},
      {k:'constr',n:'Construction',re:[/^construction spending mom$/,/^construction output yoy$/,/^construction work done qoq$/,/^construction orders yoy$/]}]}]},
  {titel:'Business, trade & government',akz:'grow',gruppen:[
    {titel:'Output',reihen:[
      {k:'gdp_qq',n:'GDP',ind:'GDP Growth QoQ',re:[/^gdp growth rate qoq$/]},
      {k:'gdp_yy',n:'GDP',re:[/^gdp growth rate yoy$/,/^gdp yoy$/]},
      {k:'gdp_mm',n:'Monthly GDP',re:[/^gdp mom$/]},
      {k:'ip_mm',n:'Industrial production',re:[/^industrial production mom$/]},
      {k:'ip_yy',n:'Industrial production',re:[/^industrial production yoy$/]},
      {k:'mfg_mm',n:'Manufacturing production',re:[/^manufacturing production mom$/,/^manufacturing sales mom$/]},
      {k:'cap',n:'Capacity utilisation',re:[/^capacity utilization$/,/^capacity utilization mom$/,/^industrial capacity utilization$/,/^nzier capacity utilization$/]},
      {k:'lead',n:'Leading index',re:[/^cb leading index mom$/,/^leading economic index$/,/^westpac leading index mom$/,/^kof leading indicators$/]}]},
    {titel:'Orders & investment',reihen:[
      {k:'dur',n:'Durable goods orders',re:[/^durable goods orders mom$/]},
      {k:'dur_ex',n:'Durable goods orders excluding transport',re:[/^durable goods orders ex transp mom$/]},
      {k:'fact',n:'Factory orders',re:[/^factory orders mom$/,/^machinery orders mom$/]},
      {k:'capgoods',n:'Core capital goods orders',re:[/^non defense goods orders ex air$/]},
      {k:'capex',n:'Business investment',re:[/^business investment qoq$/,/^private capital expenditure qoq$/,/^capital spending yoy$/,/^fixed asset investment \(ytd\) yoy$/]},
      {k:'inv',n:'Business inventories',re:[/^business inventories mom$/,/^business inventories qoq$/]},
      {k:'whole_inv',n:'Wholesale inventories',re:[/^wholesale inventories mom$/]},
      {k:'whole',n:'Wholesale sales',re:[/^wholesale sales mom$/]},
      {k:'profit',n:'Corporate profits',re:[/^corporate profits qoq$/,/^company gross profits qoq$/,/^industrial profits \(ytd\) yoy$/]}]},
    {titel:'Surveys',reihen:[
      {k:'pmi_m',n:'Manufacturing PMI',ind:'Manufacturing PMI',re:[/^ism manufacturing pmi$/,/^(hcob|s&p global) manufacturing pmi$/,/^nbs manufacturing pmi$/,/^procure\.ch manufacturing pmi$/,/^business nz pmi$/]},
      {k:'pmi_s',n:'Services PMI',ind:'Services PMI',re:[/^ism services pmi$/,/^(hcob|s&p global) services pmi$/,/^nbs non manufacturing pmi$/,/^services nz psi$/]},
      {k:'pmi_c',n:'Composite PMI',re:[/^(hcob|s&p global) composite pmi$/,/^nbs general pmi$/]},
      {k:'pmi_k',n:'Construction PMI',re:[/^(hcob|s&p global) construction pmi$/]},
      {k:'ism_no',n:'ISM manufacturing new orders',re:[/^ism manufacturing new orders$/]},
      {k:'ism_pr',n:'ISM manufacturing prices',re:[/^ism manufacturing prices$/]},
      {k:'biz',n:'Business confidence',ind:'Business Confidence',re:[/^nfib business optimism index$/,/^nab business confidence$/,/^anz business confidence$/,/^industrial sentiment$/,/^tankan large manufacturers index$/,/^cbi industrial trends orders$/,/^ivey pmi s\.a$/,/^cfib business barometer$/]},
      {k:'empire',n:'New York Empire State manufacturing index',re:[/^ny empire state manufacturing index$/]},
      {k:'philly',n:'Philadelphia Fed manufacturing index',re:[/^philadelphia fed manufacturing index$/]},
      {k:'chi',n:'Chicago PMI',re:[/^chicago pmi$/]}]},
    {titel:'Trade & external',reihen:[
      {k:'trade',n:'Trade balance',re:[/^balance of trade$/]},
      {k:'goods',n:'Goods trade balance',re:[/^goods trade balance$/]},
      {k:'exports',n:'Exports',re:[/^exports$/,/^exports yoy$/,/^exports mom$/]},
      {k:'imports',n:'Imports',re:[/^imports$/,/^imports yoy$/,/^imports mom$/]},
      {k:'ca',n:'Current account',re:[/^current account$/]},
      {k:'tic',n:'Net long-term capital flows',re:[/^net long-term tic flows$/,/^foreign securities purchases$/,/^fdi \(ytd\) yoy$/]},
      {k:'fxres',n:'Foreign exchange reserves',re:[/^foreign exchange reserves$/]},
      {k:'tot',n:'Terms of trade',ind:'Terms of Trade',re:[/^terms of trade qoq$/]}]},
    {titel:'Government',reihen:[
      {k:'budget',n:'Budget balance',re:[/^monthly budget statement$/,/^budget balance$/,/^public sector net borrowing ex banks$/]},
      {k:'debt',n:'Government debt to GDP',re:[/^government debt to gdp$/]}]},
    {titel:'Energy & commodities',reihen:[
      {k:'eia',n:'EIA crude oil stocks change',ind:'Oil Inventories',nur:['USD'],re:[/^eia crude oil stocks change$/]},
      {k:'gas',n:'EIA natural gas stocks change',nur:['USD'],re:[/^eia natural gas stocks change$/]},
      {k:'rigs',n:'Baker Hughes oil rig count',nur:['USD'],re:[/^baker hughes oil rig count$/]},
      {k:'gdt',n:'Global Dairy Trade price index',ind:'GDT Price Index',re:[/^global dairy trade price index$/]}]}]}
];
// Titel -> Vergleichsform (ohne Fassungs-Zusatz). Fuer Feed und Waechter.
export function sektorTitelBasis(t){return String(t||'').replace(/\s+(Final|Prel|Flash|Adv|2nd Est|3rd Est)$/i,'').trim().toLowerCase();}
