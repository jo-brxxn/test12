// ── SCORE UNABHAENGIG NACHGERECHNET + JEDE ANGEZEIGTE SCORE-ZAHL ─────────
//
// Nutzer 2026-10-16 (/goal): "Nimm auch nochmal den Score unter die Lupe und
// generell alles wo er benutzt und gezeigt wird. Rechne alles nach und stell
// sicher das nichts falsches ist".
// Gefunden und behoben (VERSION-CHECK-604):
//   - Vergleichsfaktor doppelt gerundet (2 Stellen, dann 1): GBYIELD 5,0
//     statt 5,1, CAYIELD -2,2 statt -2,3, AUYIELD -5,8 statt -5,9.
//   - Matrix-Heatmap ohne Carry: 36 von 56 Zellen wichen vom Paar-Score ab
//     (bis 1,0, USD/CHF mit falschem Vorzeichen).
//   - Paar-Uebersicht "Pair score vs price" ohne Carry (eigene Kopie der
//     Trends-Reihe).
//   - Staerke-Note zwischen 00:00 und 02:00 (Berlin) mit dem UTC-Datum: der
//     heutige Live-Tag zaehlte als Vergangenheit, gestern fehlte.
// Geprueft:
//   A) EIGENE Implementierung nach docs/score-model.md (nicht die Funktionen
//      der App): jeder Indikator (feste Punkte, Altersgrenze mit eigenem
//      Zyklus, Gewicht/Halbgewicht/Core-Paare, MAD-Ueberraschung, Decay,
//      Marktrelevanz, Klemmung), jede Karte, jeder Asset-Score, Zaehlung,
//      Vergleichsfaktor, Carry (2Y, Carry-to-Risk, VIX), jedes Paar und die
//      Staerke-Note gegen die App.
//   B) jede sichtbare Score-Zahl auf allen Tabs, fuenf Asset-Seiten und dem
//      Dashboard mit allen Kartentypen (Zahl am Klickziel openScoreInfo*/
//      gotoSym/sbClick, Detail-Badge, Matrix-Heatmap) gegen symScoreCmp/
//      pairScore.
//   C) Trends-Paarlinie endet heute auf dem Paar-Score.
//   D) Berlin 00:30: symOwnHistory laesst den lokalen heutigen Tag aus.
//   E) statisch: kein "heute" aus new Date().toISOString() in js/.
//   node check/scorenachrechnung.js [--gegenprobe]
//     (Gegenprobe: A rechnet mit dem alten 2-Stellen-Faktor, B bekommt eine
//      verfaelschte Zahl, E einen eingeschmuggelten UTC-Tag -> alle rot)
const fs = require('fs');
const path = require('path');
const PW = process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright';
const URL = process.env.CHECK_URL || 'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const GP = process.argv.includes('--gegenprobe');
const F = []; const fail = (t, x) => F.push(`${t}: ${x}`);
const init = () => { try { localStorage.setItem('fxpro_help_seen', '1'); localStorage.setItem('fxpro_intro_anim_enabled', '0'); } catch (e) {} };

(async () => {
  // ── E) statisch ──
  const dir = path.join(__dirname, '..', 'js');
  let quellen = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
  if (GP) quellen.push(['gegenprobe.js', 'const heute=new Date().toISOString().slice(0,10);']);
  quellen.forEach(([f, t]) => t.split('\n').forEach((z, i) => {
    if (/new Date\(\)\.toISOString\(\)\.(slice|substring)\(0,\s*10\)/.test(z) && !/datum-ok/.test(z)) fail('E UTC-HEUTE', `${f}:${i + 1} "heute" als UTC-Datum - zwischen 00:00 und 02:00 Ortszeit der falsche Tag (todayStr()/isoLokal() nehmen)`);
  }));

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const perr = []; p.on('pageerror', e => perr.push(String(e)));
  await p.addInitScript(init);
  await p.goto(URL); await wartenBisDatenDa(p);
  await p.evaluate(() => { ['introOv', 'lockScreen'].forEach(x => { const e = document.getElementById(x); if (e) e.remove(); }); });

  // ── A) unabhaengige Nachrechnung ──
  const a = await p.evaluate(async GP => {
 const SC=await import('/js/score.js'),DF=await import('/js/data-feeds.js'),M=await import('/js/main.js');
 const g=n=>{const v=(n in M)?M[n]:(n in DF)?DF[n]:(n in SC)?SC[n]:window[n];if(v===undefined)throw new Error('fehlt '+n);return v};
 const stripPeriodSuffix=g('stripPeriodSuffix'),parseNumLike=g('parseNumLike'),todayStr=g('todayStr'),DATA_LIVE_OK=g('DATA_LIVE_OK'),macroCcyFor=g('macroCcyFor'),resolvePairPriceSeries=g('resolvePairPriceSeries'),SENTIMENT_DATA=g('SENTIMENT_DATA'),BOND_DATA_FEED=g('BOND_DATA_FEED'),syms=g('syms'),FX=(await import('/js/constants.js')).FX,pairs=g('pairs');
 const strip=n=>stripPeriodSuffix(n).base;
 const num=v=>{const x=parseNumLike(v);return x};
 const today=todayStr();
 const rnd2=n=>Math.round((n+(n>=0?1:-1)*Number.EPSILON)*100)/100;
 const BIAS={sbull:2,bull:1,neu:0,bear:-1,sbear:-2};
 const BOND=new Set(['2Y Bond Yield','10Y Bond Yield']);
 const CORE=[['CPI (Headline)','Core CPI'],['PPI','Core PPI'],['PCE','Core PCE'],['ZEW Economic Sentiment','Ifo Business Climate']];
 const SENT=new Set(SC.SENT_IND_NAMES||[]);
 const txtDays=i=>{const t=String(i.interval||'').toLowerCase();return /week/.test(t)?7:/quarter/.test(t)?90:/year|annual/.test(t)?365:/month/.test(t)?30:null};
 const gaps=i=>{const ds=(i.chartHist||[]).map(e=>e&&e[0]).filter(Boolean).sort();const g=[];for(let k=1;k<ds.length;k++){const x=(new Date(ds[k])-new Date(ds[k-1]))/864e5;if(isFinite(x)&&x>0&&x<400)g.push(x)}return ds.length>=4?g:[]};
 const cycle=i=>{const g=gaps(i),t=txtDays(i);if(g.length>=3){g.sort((a,b)=>a-b);const med=g[Math.floor(g.length/2)];return t?Math.max(med,t*0.6):med}return t||30};
 const guess=i=>!txtDays(i)&&gaps(i).length<3;
 const stale=i=>{const r=i.research;if(!r||!r.date)return false;if(r.bond||r.cot||r.sent)return false;if(DATA_LIVE_OK.ind===false)return false;if(guess(i))return false;const c=cycle(i);const age=(new Date(today)-new Date(String(r.date).slice(0,10)))/864e5;if(!(age>=0))return false;return age/c>2};
 const half=(i,rub)=>{const bn=strip(i.name);if(BOND.has(i.name))return true;if(bn==='Net Bullish Positioning'||bn==='Net Bearish Positioning')return true;if(i.name==='Seasonality'||i.name==='Retail Positioning')return true;
   if(bn==='WoW Change in Net Position (%)'){const v=parseFloat(String((i.research||{}).actual??'').replace(',','.'));if(isFinite(v)&&Math.abs(v)<3)return true}
   if(SENT.has(bn))return true;if(i.name==='Risk Correlation')return true;
   for(const g of CORE){if(!g.includes(bn))continue;if((rub.indicators||[]).some(o=>o!==i&&strip(o.name)!==bn&&g.includes(strip(o.name))))return true}return false};
 const weight=(i,rub)=>BOND.has(i.name)?0.75:i.stepDriven?0.5:half(i,rub)?0.5:1;
 const mad=i=>{const s=[];(i.chartHist||[]).forEach(e=>{if(!Array.isArray(e)||e.length<3)return;const a=num(e[1]),f=num(e[2]);if(a==null||f==null)return;s.push(a-f)});if(s.length<5)return null;const m=s.reduce((x,y)=>x+y,0)/s.length;const d=s.reduce((x,y)=>x+Math.abs(y-m),0)/s.length;return d>0&&isFinite(d)?d:null};
 const mag=i=>{const r=i.research||{};const a=num(r.actual),f=num(r.forecast);if(a==null||f==null)return 1;const sd=mad(i);if(sd==null)return 1;return Math.sqrt(Math.max(0.05,Math.abs(a-f)/sd))};
 const decay=(i,rub)=>{if(rub.name==='COT Data'||rub.name==='Risk Environment'||BOND.has(strip(i.name)))return 1;const r=i.research||{};const d=r.date||i.date;if(!d)return 1;const age=(Date.now()-new Date(d+'T00:00:00Z').getTime())/864e5;if(!isFinite(age)||age<=0)return 1;return Math.pow(0.5,age/(1.5*cycle(i)))};
 const mvCache={};
 const moves=sid=>{const ccy=macroCcyFor(sid);const key=ccy+'|'+sid;if(key in mvCache)return mvCache[key];const ser=DF.priceSeriesFor(ccy)||DF.priceSeriesFor(sid);let out=null;
   if(ser&&ser.length>=60){const px={};ser.forEach(e=>{if(e&&e[0]!=null&&e[1]!=null)px[e[0]]=Number(e[1])});const ds=Object.keys(px).sort();const mv={};for(let k=1;k<ds.length;k++){const a=px[ds[k-1]],c=px[ds[k]];if(a>0&&isFinite(c))mv[ds[k]]=Math.abs(c/a-1)}const all=Object.values(mv);if(all.length>=40)out={mv,base:all.reduce((x,y)=>x+y,0)/all.length}}
   return mvCache[key]=out};
 const mkt=(i,sid)=>{const h=i.chartHist;if(!Array.isArray(h)||h.length<5)return 1;const m=moves(sid);if(!m)return 1;const hits=[];h.forEach(e=>{const d=e&&e[0];if(d&&m.mv[d]!=null)hits.push(m.mv[d])});if(hits.length<5||!(m.base>0))return 1;return Math.sqrt(Math.max(0.1,hits.reduce((x,y)=>x+y,0)/hits.length/m.base))};
 const indMine=(i,rub,sid)=>{if(typeof i.pkt==='number'&&isFinite(i.pkt))return rnd2(i.pkt);if(stale(i))return 0;const w=weight(i,rub);
   const n=BOND.has(i.name)?1:Math.min(1.8,Math.max(0.4,mag(i)*decay(i,rub)*mkt(i,sid)));return rnd2((BIAS[i.bias]||0)*w*n)};
 const F=[];let nInd=0;const symMine={},trk={};
 syms.forEach(s=>{let sum=0,n=0;(s.rubrics||[]).forEach(rub=>{let rs=0;(rub.indicators||[]).forEach(i=>{nInd++;const mine=indMine(i,rub,s.id),app=SC.indScore(i,rub);
     if(Math.abs(mine-app)>0.005)F.push(`IND ${s.id}/${rub.name}/${i.name}: mine ${mine} app ${app} bias ${i.bias} pkt ${i.pkt} stale ${stale(i)}`);
     rs+=mine;if(!stale(i))n++});
   rs=rnd2(rs);const ra=SC.rubScore(rub);if(Math.abs(rs-ra)>0.005)F.push(`RUB ${s.id}/${rub.name}: mine ${rs} app ${ra}`);sum+=rs});
   symMine[s.id]=rnd2(sum);trk[s.id]=n;const sa=SC.symScore(s);if(Math.abs(symMine[s.id]-sa)>0.005)F.push(`SYM ${s.id}: mine ${symMine[s.id]} app ${sa}`);
   if(SC.symTrackedCount(s)!==n)F.push(`TRK ${s.id}: mine ${n} app ${SC.symTrackedCount(s)}`)});
 const fx=syms.filter(s=>FX.includes(s.id));const ref=fx.reduce((a,s)=>a+trk[s.id],0)/fx.length;
 const cmpMine={};syms.forEach(s=>{const f=trk[s.id]?(GP?Math.round(ref/trk[s.id]*100)/100:ref/trk[s.id]):1;cmpMine[s.id]=Math.round(symMine[s.id]*f*10)/10;const ca=SC.symScoreCmp(s);
   if(Math.abs(cmpMine[s.id]-ca)>0.001)F.push(`CMP ${s.id}: mine ${cmpMine[s.id]} app ${ca}`);
   const exakt=Math.round(symMine[s.id]*ref/(trk[s.id]||1)*10)/10;if(trk[s.id]&&Math.abs(exakt-cmpMine[s.id])>0.001)F.push(`CMP-RUNDUNG ${s.id}: mit exaktem Faktor ${exakt}, mit gerundetem ${cmpMine[s.id]}`)});
 // Carry unabhaengig
 const y2=(c,d)=>{const s=(BOND_DATA_FEED[c]||{})['2Y Bond Yield'];const ser=s&&s.series;if(!Array.isArray(ser))return null;let v=null,dd=null;ser.forEach(e=>{const t=String(e[0]).slice(0,10),x=Number(e[1]);if(t<=d&&isFinite(x)&&(dd==null||t>=dd)){v=x;dd=t}});return v};
 const vol=(bq,qq,d)=>{let s;try{s=resolvePairPriceSeries(bq,qq)}catch(e){s=null}if(!Array.isArray(s))return null;const r=s.filter(e=>e&&e[0]<=d&&isFinite(e[1])&&e[1]>0).slice(-251);if(r.length<61)return null;const ret=[];for(let k=1;k<r.length;k++)ret.push(Math.log(r[k][1]/r[k-1][1]));const m=ret.reduce((a,x)=>a+x,0)/ret.length;return Math.sqrt(ret.reduce((a,x)=>a+(x-m)**2,0)/(ret.length-1))*Math.sqrt(252)*100};
 const vix=d=>{const s=SENTIMENT_DATA&&SENTIMENT_DATA.vix&&SENTIMENT_DATA.vix.series;if(!s)return null;const am=x=>{let v=null;s.forEach(e=>{if(e&&e[0]<=x&&isFinite(+e[1]))v=+e[1]});return v};const vor=new Date(Date.parse(d)-28*864e5).toISOString().slice(0,10);const a=am(d),c=am(vor);return a==null||c==null||!c?null:(a/c-1)*100};
 const carry=pn=>{const[bq,qq]=pn.split('/');if(!FX.includes(bq)||!FX.includes(qq))return 0;const a=y2(bq,today),c=y2(qq,today);if(a==null||c==null)return 0;const diff=Math.round((a-c)*100)/100;const v=vol(bq,qq,today);if(!(v>0))return 0;const ratio=diff/v;const st=Math.abs(ratio)>=0.4?Math.sign(ratio):Math.abs(ratio)>=0.2?Math.sign(ratio)*0.5:0;const vx=vix(today);return vx!=null&&vx>=30?0:st};
 let nPair=0;(pairs||[]).forEach(pr=>{const pn=pr.name;const [bq,qq]=pn.split('/');const id={XAU:'GOLD',XAG:'SILVER',WTI:'OIL'};const bs=id[bq]||bq,qs=id[qq]||qq;if(cmpMine[bs]==null||cmpMine[qs]==null)return;nPair++;
   const c=carry(pn),ca=SC.pairCarryAdj(pn);if(Math.abs(c-ca)>0.001)F.push(`CARRY ${pn}: mine ${c} app ${ca}`);
   const mine=Math.round((cmpMine[bs]-cmpMine[qs]+c)*10)/10,app=SC.pairScore(pn);if(Math.abs(mine-app)>0.001)F.push(`PAIR ${pn}: mine ${mine} app ${app}`)});
 // Staerke 1-10
 const scoreHist=g('scoreHist');const tag=SC.SCORE_MODEL_VERSION+':normalized';let nStr=0;
 syms.forEach(s=>{const past=(scoreHist[s.id]||[]).filter(e=>Array.isArray(e)&&e[0]!==today&&typeof e[1]==='number'&&e[6]===tag).map(e=>e[1]);
   let mine=null;if(past.length>=10){const m=past.reduce((a,b)=>a+b,0)/past.length;const sd=Math.sqrt(past.reduce((a,b)=>a+(b-m)**2,0)/past.length);
     if(sd>=1e-6){const z=Math.round((cmpMine[s.id]-m)/sd*100)/100;const B=[-1.5,-1.0,-0.6,-0.2,0.2,0.6,1.0,1.5,2.0];mine=1;B.forEach((x,i)=>{if(z>=x)mine=i+2})}}
   const app=SC.symStrength10(s);nStr++;if(mine!==app)F.push(`STAERKE ${s.id}: mine ${mine} app ${app} (n ${past.length})`)});
 return{F,nInd,nSym:syms.length,nPair,ref,nStr};
  }, GP);
  a.F.forEach(x => fail('A NACHRECHNUNG', x));
  if (a.nInd < 300 || a.nPair < 20) fail('A ZU WENIG', `${a.nInd} Indikatoren, ${a.nPair} Paare`);

  // ── B) jede angezeigte Score-Zahl ──
  const scan = wo => p.evaluate(async ([wo, GP]) => {const SC=await import('/js/score.js');const M=await import('/js/main.js');const syms=M.syms||window.syms;
 const soll=(art,id)=>{if(art==='p')return SC.pairScore(id);const s=syms.find(x=>x.id===id);return s?SC.symScoreCmp(s):null};
 const vis=e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;for(let x=e;x;x=x.parentElement){const cs=getComputedStyle(x);if(cs.display==='none'||cs.visibility==='hidden')return false}return true};
 const out=[];let n=0;const farbe=[];
 if(GP){const e=[...document.querySelectorAll('.row-score,.heat-sc,.mx-hm td[title]')].find(x=>x.getBoundingClientRect().width);if(e)e.textContent='+99.9';}
 document.querySelectorAll('[onclick]').forEach(e=>{if(!vis(e))return;const oc=e.getAttribute('onclick');let m=oc.match(/openScoreInfo(Sym|Pair)\('([^']+)'/);let art,id;
   if(m){art=m[1]==='Pair'?'p':'s';id=m[2]}else{m=oc.match(/(?:gotoSym|sbClick)\('([^']+)'/);if(!m)return;art='s';id=m[1]}
   const t=(e.childElementCount===0?e.textContent:[...e.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('')).trim().replace('−','-');
   const kandidaten=/^[+-]?\d+(\.\d+)?$/.test(t)?[[e,t]]:[...e.querySelectorAll('[class*="sc"],[class*="score"]')].filter(x=>x.childElementCount===0).map(x=>[x,x.textContent.trim().replace('−','-')]).filter(([x,tt])=>/^[+-]?\d+(\.\d+)?$/.test(tt));
   kandidaten.forEach(([e,t])=>{n++;const v=parseFloat(t),s=soll(art,id);
   if(s==null||Math.abs(v-s)>0.001)out.push(`${wo}: ${e.className||e.tagName} ${id} zeigt ${t}, Rechnung ${s}`);});
 });
 // Matrix-Heatmap: Zelle = Paar
 document.querySelectorAll('.mx-hm td[title]').forEach(td=>{if(!vis(td))return;const m=td.title.match(/^([A-Z]{3})\/([A-Z]{3}):/);if(!m)return;n++;const v=parseFloat(td.textContent.replace('−','-'));const s=SC.pairScore(m[1]+'/'+m[2]);if(Math.abs(v-s)>0.001)out.push(`${wo}: Heatmap ${m[1]}/${m[2]} zeigt ${v}, Paar-Score ${s}`)});
 // Detail-Badge
 document.querySelectorAll('#detail .score-badge').forEach(e=>{if(!vis(e))return;n++;const t=e.textContent.trim();const id=(M.getSym?M.getSym():window.getSym()).id;const s=soll('s',id);if(Math.abs(parseFloat(t)-s)>0.001)out.push(`${wo}: Badge ${id} ${t} vs ${s}`)});
 // Farbe gegen Zahl (rohe Bias-Schwelle vs angezeigter Score)
 syms.forEach(s=>{const c=SC.symScoreCmp(s),bc=SC.scoreBias(c);if(bc!==s.bias&&!(bc==='neu'&&s.bias==='neu'))farbe.push(`${s.id}: zeigt ${c} (${bc}), Farbe ${s.bias} (roh ${SC.symScore(s)})`)});
 return{out,n,farbe};
}, [wo, GP]);
  const tabs = await p.evaluate(() => TAB_ORDER.slice()); let nB = 0;
  const merke = r => { nB += r.n; r.out.forEach(x => fail('B ANZEIGE', x)); };
  for (const t of tabs) { await p.evaluate(t => showTab(t), t); await p.waitForTimeout(450); merke(await scan('Tab ' + t)); }
  for (const id of ['EUR', 'USD', 'GOLD', 'US10Y', 'NAS']) { await p.evaluate(id => gotoSym(id), id); await p.waitForTimeout(650); merke(await scan('Asset ' + id)); }
  await p.evaluate(() => { const da = new Set(widgets.map(x => x.type)); W_TYPES.forEach((t, i) => { if (!da.has(t.type)) widgets.push({ id: 'snr' + i, type: t.type, title: t.label, order: widgets.length, content: '' }); }); showTab('dash'); renderDash(); });
  await p.waitForTimeout(900); merke(await scan('Dashboard alle Karten'));
  if (nB < 200) fail('B ZU WENIG', `nur ${nB} Score-Zahlen gefunden`);

  // ── C) Trends-Paarlinie endet auf dem Paar-Score ──
  const c = await p.evaluate(async () => {
    const SC = await import('/js/score.js'); const out = [];
    for (const pn of ['EUR/USD', 'USD/CHF', 'GBP/JPY', 'AUD/NZD']) {
      trendsPairSel = pn; const el = document.createElement('div'); document.body.appendChild(el); renderTrendsPair(el);
      const tr = trendsEphemeral[pn] || [], z = tr[tr.length - 1]; el.remove();
      if (z && z[0] === todayStr() && Math.abs(z[1] - SC.pairScore(pn)) > 0.001) out.push(`${pn}: Trends heute ${z[1]}, Paar-Score ${SC.pairScore(pn)}`);
    }
    return out;
  });
  c.forEach(x => fail('C PAARLINIE', x));
  await b.close();

  // ── D) Berlin kurz nach Mitternacht ──
  {
    const b2 = await chromium.launch(); const ctx = await b2.newContext({ timezoneId: 'Europe/Berlin', serviceWorkers: 'block' }); const p2 = await ctx.newPage();
    await p2.clock.install({ time: new Date(Date.now() - (Date.now() % 86400000) + 23.5 * 3600e3) });   // 23:30 UTC = 01:30 (Sommer) / 00:30 (Winter) Berlin - immer schon der naechste Tag
    await p2.addInitScript(init); await p2.goto(URL); await p2.clock.runFor(1000); await wartenBisDatenDa(p2);
    const d = await p2.evaluate(async () => {
      const SC = await import('/js/score.js'); const lok = todayStr(), utc = new Date().toISOString().slice(0, 10);   // datum-ok: Vergleichswert der Pruefung
      // Eigene Testeintraege (nur in diesem Testbrowser): 12 Vortage + heute,
      // im aktuellen Modell - sonst waere die Pruefung nach einem Modellwechsel
      // mangels Historie trivial gruen.
      const tag = SC.SCORE_MODEL_TAG(), d0 = new Date(lok + 'T12:00:00');
      scoreHist.USD = []; for (let i = 12; i >= 0; i--) { const d = new Date(d0 - i * 864e5); scoreHist.USD.push([d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), i, 0, 0, 0, 'neu', tag]); }
      const h = scoreHist.USD; const heute = h.find(e => e[0] === lok);
      const own = SC.symOwnHistory('USD'); const ohneHeute = h.filter(e => e[0] !== lok && e[6] === SC.SCORE_MODEL_TAG() && typeof e[1] === 'number').length;
      // Werte = Abstand in Tagen: heute 0, gestern 1 - eindeutig erkennbar.
      return { lok, utc, heute: !!heute, n: own.length, soll: ohneHeute, mitHeute: own.includes(0), mitGestern: own.includes(1) };
    });
    if (d.lok === d.utc) fail('D DATUMSGRENZE', `Testuhr ueberquert die Datumsgrenze nicht (${d.lok}) - Pruefung waere blind`);
    else if (d.mitHeute || !d.mitGestern) fail('D DATUMSGRENZE', `${d.lok} (UTC ${d.utc}): eigene Historie ${d.mitHeute ? 'enthaelt den heutigen Live-Tag' : ''}${!d.mitGestern ? ' ohne gestern' : ''} - die Note misst den Tag gegen sich selbst`);
    await b2.close();
  }
  perr.forEach(x => fail('JS-FEHLER', x));
  if (GP) {
    const ok = ['A NACHRECHNUNG', 'B ANZEIGE', 'E UTC-HEUTE'].every(k => F.some(x => x.startsWith(k)));
    console.log(ok ? `scorenachrechnung --gegenprobe: ok (A, B, E rot, ${F.length} Befunde)` : 'scorenachrechnung --gegenprobe: FEHLER - nicht alle Stufen rot\n  ' + F.slice(0, 8).join('\n  ')); process.exit(ok ? 0 : 1);
  }
  if (F.length) { console.log(`scorenachrechnung: ${F.length} Befund(e)`); F.slice(0, 40).forEach(x => console.log('  ' + x)); process.exit(1); }
  console.log(`scorenachrechnung: ok (${a.nInd} Indikatoren, ${a.nSym} Assets, ${a.nPair} Paare, ${a.nStr} Staerke-Noten unabhaengig nachgerechnet; ${nB} angezeigte Score-Zahlen = Rechnung; Trends-Paarlinie = Paar-Score; Berlin 00:30 richtiger Tag; kein UTC-"heute")`);
})().catch(e => { console.log('scorenachrechnung: ABBRUCH ' + e.message); process.exit(1); });
