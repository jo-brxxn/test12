// ══ GAMEPLAN (seit 2026-11-16, VERSION-CHECK-737) ═══════════════════════════
// Nutzer 2026-11-16: "eine ganz neue Kategorie ... Gameplan ... fuer jedes Asset
// einen Gameplan ... wenn bestimmte Assets in der Watchlist sind, sollen die
// Gameplans davon ganz oben angezeigt werden, angeheftet ... einen Schalter fuer
// Bullish, Bearish ... die ganze Karte ... in der Farbe ... These ... Upcoming
// Catalysts ... ganz kleiner Kalender ... die naechsten High-Impact-Events ...
// Break Kriterium ... Entry Kriterium ... diese Karte dann auch innerhalb des
// Assets ... nur in einer kleinen Form".
// Wahl aus drei Entwuerfen (2026-11-16): Seite = G2 (Liste links, Detail rechts);
// Asset-Seite = K1-Leiste "direkt zwischen Asset Name und der Price Karte", Tipp
// klappt auf, der ausgeklappte Teil sieht aus wie G1 "beginnt halt erst bei entry
// und break der Rest dadrueber kommt weg". Bearbeiten ueberall direkt.
// Extras: Hinweis nach 14 Tagen ohne Aenderung; Entry/Break = eigener Text, wahlweise
// "mit einem Kalenderdatum oder Preislevel verknuepfen".
//
// Zustand: gameplans = {Asset:{b:'bull'|'bear'|'', th, en:{t,k,v}, br:{t,k,v}, t}}
//   k = '' (nur Text) | 'd' (Datum, v = YYYY-MM-DD) | 'p' (Preis, v = Zahl als Text)
//   t = letzte Aenderung (ms) - Abgleich je Asset: der neuere gewinnt (gpVereinen)
// Laeuft ueber snap()/applySnap() (Undo, Speichern, Cloud) + neueFelderBehalten.
// Ansichtswahl (gewaehltes Asset auf der Seite, aufgeklappte Leiste) nur Sitzung.
// Geprueft von check/gameplan.js.
import {BC} from './constants.js';
import {escH,escJH,syms,pushU,saveSoon,save,todayStr,getSymEventsAll,assetIconHtml,watchlistedAssetIds,
  watchlistPairs,watchInvolvedAssets,SB_CATS,YIELD_CCY,renderDetail,curPage,ar,abInfoBtn} from './main.js';
import {isEvtPast,evtImpact,countdownHtml,fmtDayHdr} from './calendar.js';
import {priceSeriesFor} from './data-feeds.js';
import {FX} from './constants.js';

export let gameplans={};
const GP_STALE_TAGE=14;
const GP_KAT_TAGE=21, GP_KAT_N=5;
let gpSel=null;                 // gewaehltes Asset auf der Gameplan-Seite (Sitzung)
const gpOffen=new Set();        // aufgeklappte Leisten auf der Asset-Seite (Sitzung)

// ── Zustand ──────────────────────────────────────────────────────────────
const kritRein=k=>{const o=k&&typeof k==='object'?k:{};const art=o.k==='d'||o.k==='p'?o.k:'';
  return{t:typeof o.t==='string'?o.t.slice(0,600):'',k:art,v:typeof o.v==='string'?o.v.slice(0,40):''};};
function eintragRein(e){
  if(!e||typeof e!=='object')return null;
  return{b:e.b==='bull'||e.b==='bear'?e.b:'',th:typeof e.th==='string'?e.th.slice(0,2000):'',en:kritRein(e.en),br:kritRein(e.br),t:+e.t||0};
}
export function gpRein(v){
  const o={};if(!v||typeof v!=='object'||Array.isArray(v))return o;
  Object.keys(v).forEach(id=>{const e=eintragRein(v[id]);if(e&&/^[A-Z0-9_]{1,12}$/.test(id))o[id]=e;});
  return o;
}
export function gpSetzeAlle(v){gameplans=gpRein(v);}
// Zwei Geraete bearbeiten verschiedene Assets: je Asset gewinnt die juengere Aenderung.
export function gpVereinen(lokal,fremd){
  const a=gpRein(lokal),b=gpRein(fremd),o=Object.assign({},a);
  Object.keys(b).forEach(id=>{if(!o[id]||(b[id].t||0)>=(o[id].t||0))o[id]=b[id];});
  return o;
}
const leer=()=>({b:'',th:'',en:{t:'',k:'',v:''},br:{t:'',k:'',v:''},t:0});
function gp(id){return gameplans[id]||leer();}
function hatInhalt(g){return!!(g.b||g.th.trim()||g.en.t.trim()||g.br.t.trim()||g.en.v||g.br.v);}
function veraendert(id,fn){
  const g=gameplans[id]?gameplans[id]:(gameplans[id]=leer());
  fn(g);g.t=Date.now();saveSoon();
}
const name=id=>{const s=syms.find(x=>x.id===id);return s?(s.name||s.id):id;};
const farbe=b=>b==='bull'?BC.bull:b==='bear'?BC.bear:BC.neu;
const veraltet=g=>hatInhalt(g)&&g.t&&Date.now()-g.t>GP_STALE_TAGE*864e5;

// ── Upcoming catalysts: die naechsten High-Impact-Termine ──────────────────
function katalysatoren(id){
  const heute=todayStr(),bis=new Date(Date.now()+GP_KAT_TAGE*864e5).toISOString().slice(0,10);
  let ev=[];try{ev=getSymEventsAll(id)||[];}catch(e){ev=[];}
  return ev.filter(e=>e&&e.date>=heute&&e.date<=bis&&!isEvtPast(e)&&evtImpact(e)==='high').slice(0,GP_KAT_N);
}
function katHtml(id){
  const L=katalysatoren(id);
  if(!L.length)return`<div class="gp-leer">No high-impact events in the next ${GP_KAT_TAGE} days</div>`;
  return`<div class="gp-kat">${L.map(e=>{const d=new Date(e.date+'T12:00:00Z');
    return`<div class="gp-ke" title="${escH(fmtDayHdr(e.date))}"><div class="gp-kd"><b>${d.getUTCDate()}</b><i>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]}</i></div><div class="gp-kn">${escH(e.name||'')}<i>${escH(e.currencies||'')}${e.time&&/^\d/.test(e.time)?' · '+escH(e.time):''}</i></div><span class="gp-kc">${countdownHtml(e.date)}</span></div>`;}).join('')}</div>`;
}
function naechster(id){const L=katalysatoren(id);return L.length?L[0]:null;}

// ── Verknuepfung eines Kriteriums (Datum | Preis) ─────────────────────────
function letzterKurs(id){
  if(FX.includes(id)||YIELD_CCY[id])return null;   // FX: Korb im Chart, Level gilt fuer das Paar; Renditen: kein Kurs
  const s=priceSeriesFor(id);if(!Array.isArray(s)||!s.length)return null;
  const v=+s[s.length-1][1];return v>0?v:null;
}
const zahlFmt=v=>{const n=+v;if(!isFinite(n))return escH(String(v));const st=Math.abs(n)>=1000?0:Math.abs(n)>=10?2:4;return n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:st});};
function bezugHtml(id,k){
  if(k.k==='d'&&/^\d{4}-\d{2}-\d{2}$/.test(k.v))return`<span class="gp-bez" title="Linked date">${escH(fmtDayHdr(k.v))} · ${k.v<todayStr()?'passed':countdownHtml(k.v)}</span>`;
  if(k.k==='p'&&k.v!==''&&isFinite(+k.v)){
    const last=letzterKurs(id);
    const ab=last?((+k.v/last-1)*100):null;
    return`<span class="gp-bez" title="${last?'Distance from the last close':'Linked price level'}">@ <b>${zahlFmt(k.v)}</b>${ab!=null?` · ${ab>0?'+':''}${ab.toFixed(2)}% away`:''}</span>`;
  }
  return'';
}
function kritHtml(id,feld,titel,cls){
  const k=gp(id)[feld];
  const art=[['','Text'],['d','Date'],['p','Price']].map(([a,l])=>`<button type="button" class="gp-art${k.k===a?' on':''}" onclick="gpArt('${escJH(id)}','${feld}','${a}')" aria-pressed="${k.k===a}">${l}</button>`).join('');
  const feldWert=k.k==='d'?`<input type="date" class="gp-in gp-in-d" value="${escH(k.v)}" onchange="gpWert('${escJH(id)}','${feld}',this.value)" aria-label="${titel} date">`
    :k.k==='p'?`<input type="text" inputmode="decimal" class="gp-in gp-in-p" value="${escH(k.v)}" placeholder="Price level" onchange="gpWert('${escJH(id)}','${feld}',this.value)" aria-label="${titel} price level">`:'';
  return`<div class="gp-krit ${cls}"><div class="gp-lab">${titel}</div>
    <textarea class="gp-ta" rows="2" placeholder="${feld==='en'?'What has to happen before you enter?':'What proves the idea wrong?'}" oninput="ar(this);gpText('${escJH(id)}','${feld}',this.value)">${escH(k.t)}</textarea>
    <div class="gp-link"><span class="gp-arten" role="group" aria-label="Link ${titel}">${art}</span>${feldWert}${bezugHtml(id,k)}</div></div>`;
}
function biasSchalter(id){
  const b=gp(id).b;
  return`<span class="gp-sw" role="group" aria-label="Bias"><button type="button" class="${b==='bull'?'on b':''}" onclick="event.stopPropagation();gpBias('${escJH(id)}','bull')" aria-pressed="${b==='bull'}">Bullish</button><button type="button" class="${b==='bear'?'on r':''}" onclick="event.stopPropagation();gpBias('${escJH(id)}','bear')" aria-pressed="${b==='bear'}">Bearish</button></span>`;
}
const staleHtml=g=>veraltet(g)?`<span class="gp-stale" title="Last change ${escH(new Date(g.t).toISOString().slice(0,10))}">Not reviewed for ${Math.floor((Date.now()-g.t)/864e5)}d</span>`:'';

// ── Asset-Seite: K1-Leiste, aufgeklappt wie G1 ab Entry/Break ──────────────
export function gpLeisteHtml(c){
  const id=c.id,g=gp(id),offen=gpOffen.has(id),n=naechster(id);
  const th=g.th.trim();
  return`<div class="gp-k1${offen?' auf':''}" id="gpLeiste" data-gp="${escH(id)}" style="--c:${farbe(g.b)}">
    <div class="gp-k1-z" role="button" tabindex="0" aria-expanded="${offen}" onclick="gpAuf('${escJH(id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();gpAuf('${escJH(id)}')}">
      <b class="gp-k1-t">Gameplan</b>
      <span class="gp-bd">${g.b==='bull'?'Bullish':g.b==='bear'?'Bearish':'No bias'}</span>
      ${offen?`<input class="gp-th-in" value="${escH(g.th)}" placeholder="Your thesis in one line" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" oninput="gpText('${escJH(id)}','th',this.value)" aria-label="Thesis">`
        :`<span class="gp-k1-th" data-gp-th="${escH(id)}">${th?escH(th):'<i>No thesis yet · tap to plan</i>'}</span>`}
      ${n?`<span class="gp-k1-n">Next <b>${escH(n.name||'')}</b> ${countdownHtml(n.date)}</span>`:''}
      ${staleHtml(g)}
      <span class="gp-chev" aria-hidden="true">${offen?'&#9652;':'&#9662;'}</span>
      ${abInfoBtn('Gameplan',['<b>Tap</b> the bar | Entry, Break, upcoming catalysts','<b>Entry / Break</b> | own text, optional <b>date</b> or <b>price</b> (price = dashed line in the chart)','<b>Catalysts</b> | next high-impact events, '+GP_KAT_TAGE+' days','<b>Not reviewed</b> | after '+GP_STALE_TAGE+' days without a change','All plans | sidebar <b>Gameplan</b>'])}
    </div>
    ${/* ausgeklappt wie G1, beginnt aber direkt bei Entry | Break (Nutzer: "der Rest
         dadrueber kommt weg") - Bias-Schalter und Link zur Seite stehen unten */''}
    ${offen?`<div class="gp-k1-a">
      <div class="gp-zwei">${kritHtml(id,'en','Entry','e')}${kritHtml(id,'br','Break','x')}</div>
      <div class="gp-lab">Upcoming catalysts</div>${katHtml(id)}
      <div class="gp-k1-fuss">${biasSchalter(id)}<button type="button" class="gp-zur" onclick="showTab('gameplan');gpWaehle('${escJH(id)}')">All gameplans</button></div>
    </div>`:''}
  </div>`;
}
// Preislinien fuer die Price-Karte (nur echte Kurs-Charts: nicht FX-Korb, nicht Rendite)
export function gpNiveaus(id){
  if(FX.includes(id)||YIELD_CCY[id])return[];
  const g=gameplans[id];if(!g)return[];
  const o=[];
  [['en','Entry',BC.bull],['br','Break',BC.bear]].forEach(([f,t,col])=>{const k=g[f];if(k&&k.k==='p'&&k.v!==''&&isFinite(+k.v)&&+k.v>0)o.push({v:+k.v,t,col});});
  return o;
}

// ── Seite (G2: Liste links, Detail rechts) ────────────────────────────────
function angeheftet(){
  const ids=syms.map(s=>s.id),s=new Set();
  try{watchlistedAssetIds(ids).forEach(x=>s.add(x));}catch(e){}
  try{watchlistPairs().forEach(p=>watchInvolvedAssets(p.name).forEach(x=>{if(ids.includes(x))s.add(x);}));}catch(e){}
  return ids.filter(x=>s.has(x));
}
function listeZeile(id){
  const g=gp(id),th=g.th.trim();
  return`<button type="button" class="gp-li${gpSel===id?' on':''}" style="--c:${farbe(g.b)}" onclick="gpWaehle('${escJH(id)}')" data-gp-li="${escH(id)}">
    <i class="gp-li-s" aria-hidden="true"></i>${assetIconHtml(id,22)}<span class="gp-li-tx"><b>${escH(name(id))}</b><span data-gp-th="${escH(id)}">${th?escH(th):'<i>No gameplan yet</i>'}</span></span>${veraltet(g)?'<span class="gp-li-st" title="Not reviewed for 14 days">14d+</span>':''}</button>`;
}
function detailHtml(id){
  const g=gp(id);
  return`<div class="gp-d" style="--c:${farbe(g.b)}">
    <div class="gp-d-k">${assetIconHtml(id,30)}<b class="gp-d-t">${escH(name(id))}</b>${staleHtml(g)}${biasSchalter(id)}</div>
    <div class="gp-d-g">
      <div class="gp-box"><div class="gp-lab">Thesis</div><textarea class="gp-ta gp-ta-th" rows="3" placeholder="Why should this asset move, and which way?" oninput="ar(this);gpText('${escJH(id)}','th',this.value)">${escH(g.th)}</textarea></div>
      <div class="gp-box"><div class="gp-lab">Upcoming catalysts</div>${katHtml(id)}</div>
      ${kritHtml(id,'en','Entry','e gp-box')}
      ${kritHtml(id,'br','Break','x gp-box')}
    </div>
    <div class="gp-d-f"><button type="button" class="gp-zur" onclick="gotoSym('${escJH(id)}')">Open ${escH(name(id))}</button></div>
  </div>`;
}
export function renderGameplan(){
  const el=document.getElementById('gameplanBody');if(!el)return;
  const pin=angeheftet(),pinS=new Set(pin);
  if(!gpSel||!syms.some(s=>s.id===gpSel))gpSel=pin[0]||(syms[0]&&syms[0].id)||null;
  const gruppen=SB_CATS.map(c=>({l:c.l,ids:c.ids.filter(x=>syms.some(s=>s.id===x)&&!pinS.has(x))})).filter(c=>c.ids.length);
  el.innerHTML=`<div class="gp2">
    <div class="gp2-l">${pin.length?`<div class="gp-grp">Pinned · Watchlist</div>${pin.map(listeZeile).join('')}`:''}
      ${gruppen.map(c=>`<div class="gp-grp">${escH(c.l)}</div>${c.ids.map(listeZeile).join('')}`).join('')}</div>
    <div class="gp2-r" id="gpDetail">${gpSel?detailHtml(gpSel):''}</div>
  </div>`;
  el.querySelectorAll('.gp-ta').forEach(ar);
}

// ── Bedienung ────────────────────────────────────────────────────────────
function neuZeichnen(id){
  if(curPage==='gameplan')renderGameplan();
  const l=document.getElementById('gpLeiste');
  if(l&&l.dataset.gp===id){const t=document.createElement('div');t.innerHTML=gpLeisteHtml({id});l.replaceWith(t.firstElementChild);document.querySelectorAll('#gpLeiste .gp-ta').forEach(ar);}
}
export function gpWaehle(id){gpSel=id;if(curPage==='gameplan'){renderGameplan();const d=document.getElementById('gpDetail');if(d&&innerWidth<760)d.scrollIntoView({block:'start',behavior:'smooth'});}}
export function gpAuf(id){if(gpOffen.has(id))gpOffen.delete(id);else gpOffen.add(id);neuZeichnen(id);}
export function gpBias(id,b){pushU();veraendert(id,g=>{g.b=g.b===b?'':b;});neuZeichnen(id);}
export function gpText(id,feld,v){
  veraendert(id,g=>{if(feld==='th')g.th=String(v||'').slice(0,2000);else g[feld].t=String(v||'').slice(0,600);});
  // nur die Kurzanzeigen nachziehen - kein Neuaufbau, der Cursor bleibt
  if(feld==='th')document.querySelectorAll(`[data-gp-th="${id}"]`).forEach(x=>{x.innerHTML=v.trim()?escH(v):'<i>No thesis yet</i>';});
}
export function gpArt(id,feld,a){pushU();veraendert(id,g=>{if(g[feld].k!==a){g[feld].k=a;g[feld].v='';}});neuZeichnen(id);if(curPage==='cur')renderDetail();}
export function gpWert(id,feld,v){
  let w=String(v||'').trim();
  if(gp(id)[feld].k==='p'){w=w.replace(/,/g,'');if(w!==''&&!isFinite(+w))w='';}
  veraendert(id,g=>{g[feld].v=w;});
  neuZeichnen(id);if(curPage==='cur'&&gp(id)[feld].k==='p')renderDetail();
}

// ── Gameplan am Trade (Nutzer 2026-11-17: "wenn ich ja ein Asset auswaehle direkt die These
// angehaengt wird ... Wenn der gameplan leer ist dann oeffnet sich beim hinzufuegen druecken
// ein Fenster und man kann ihn [dann] ausfuellen das wird dann auch so fuer den gameplan
// uebernommen"). Rueckfrage: Kopie beim Speichern; ohne These kein Trade (Pflicht).
export function gpHatThese(id){return!!gp(id).th.trim();}
export function gpKopie(id){const g=gameplans[id];return g&&hatInhalt(g)?JSON.parse(JSON.stringify(g)):null;}
export function gpName(id){return name(id);}
export function gpAusTrade(id,v){
  pushU();
  veraendert(id,g=>{
    if(v.b==='bull'||v.b==='bear')g.b=v.b;
    g.th=String(v.th||'').trim().slice(0,2000);
    if(String(v.en||'').trim())g.en.t=String(v.en).trim().slice(0,600);
    if(String(v.br||'').trim())g.br.t=String(v.br).trim().slice(0,600);
  });
  save();   // sofort: Plan + Trade sind EIN Undo-Schritt (saveSoon kaeme 400 ms spaeter)
  neuZeichnen(id);
}
// Anzeige im Trade-Formular / in den Trade-Details / auf der Karte "Open trades"
export function gpTradeHtml(k,id,titel,kurz){
  const g=eintragRein(k)||leer(),f=farbe(g.b);
  const wert=x=>escH(x.t||'')+(x.v?`${x.t?' · ':''}<b>${escH(x.v)}</b>`:'');
  const krit=(lab,x)=>x.t||x.v?`<div class="tj-gp-r"><span>${lab}</span><span>${wert(x)}</span></div>`:'';
  if(kurz)return g.th.trim()?`<div class="tj-gp-kurz" style="border-left-color:${f}"><span class="tj-gp-dot" style="background:${f}"></span><b>${escH(name(id))}</b><i>${escH(g.th.trim())}</i></div>`:'';
  return`<div class="tj-gp-k" style="border-left-color:${f}">
    <div class="tj-gp-t"><b>${escH(titel||'Gameplan')} · ${escH(name(id))}</b>${g.b?`<span class="tj-gp-b" style="color:${f}">${g.b==='bull'?'Bullish':'Bearish'}</span>`:''}</div>
    ${g.th.trim()?`<div class="tj-gp-th">${escH(g.th.trim())}</div>`:`<div class="tj-gp-th leer"><i>No thesis yet · required when you save</i></div>`}
    ${krit('Entry',g.en)}${krit('Break',g.br)}
  </div>`;
}
