'use strict';
// ══ TRADING JOURNAL ════════════════════════════════════════════════════
// Nutzer-Wunsch 2026-10-24: "ein neues Fenster ... das Journal heisst. Man
// soll da in einer schoenen grossen Kalender Uebersicht trades eintragen
// koennen die man genommen hat. Es soll angezeigt werden welches Asset
// welche Richtung und wie viel Profit. Wenn man draufklickt kommen alle
// anderen wichtigen Daten. Je nach win oder loss auch dann in bias Farbe."
//
// ⚠ NICHT verwechseln mit dem Score-Journal (js/journal.js, Schluessel
// fxpro_scorejournal) - das protokolliert Score-Aenderungen, dieses Modul
// eigene Trades. Eigener Schluessel, eigenes Sync-Feld (tradeJournal).
//
// SYNC (CLAUDE.md Regel 1, Muster docs/state-sync.md): liegt ausserhalb von
// snap() (Undo soll keinen Trade zuruecknehmen) und waechst auf mehreren
// Geraeten UNABHAENGIG - deshalb Merge statt Overwrite, wie bei scoreHist:
// Vereinigung nach id, bei Kollision gewinnt der zuletzt bearbeitete (up).
// Geloeschte Trades bleiben als Grabstein (del:true) stehen, sonst brachte
// der naechste Merge sie vom anderen Geraet zurueck.
//
// NIE GESCHAETZT (CLAUDE.md Regel 4): P/L traegt der Nutzer selbst ein. Das
// einzige abgeleitete Feld ist das R-Vielfache, und das nur, wenn Entry,
// Stop und Exit alle eingetragen sind.
import {escH,escJH,openM,closeM,uid,cloudAutoSync,markLsUpdatedSeen,markPrefEdit,curPage,syms,pairs} from './main.js';

const TRADES_KEY='fxpro_trades';
let trades=(()=>{try{const v=JSON.parse(localStorage.getItem(TRADES_KEY)||'[]');return Array.isArray(v)?v.filter(tjGueltig):[];}catch(e){return[];}})();
// Angezeigter Monat 'YYYY-MM' - bewusst NICHT synchronisiert (Ansichtswahl
// wie abCalSicht): die Seite startet immer im aktuellen Monat.
let tjMonat=null;
let _tjEdit=null;     // id des Trades im Editor, null = neuer Trade
let _tjView=null;     // id des Trades im Detail-Fenster

function tjGueltig(t){return t&&typeof t==='object'&&typeof t.id==='string'&&t.id;}
function tjAktiv(){return trades.filter(t=>!t.del);}

// ── Merge (zwei Geraete, disjunkte Eintraege) ─────────────────────────
function mergeTrades(base,override){
  const m=new Map();
  (Array.isArray(base)?base:[]).filter(tjGueltig).forEach(t=>m.set(t.id,t));
  (Array.isArray(override)?override:[]).filter(tjGueltig).forEach(t=>{
    const a=m.get(t.id);
    if(!a||String(t.up||'')>=String(a.up||''))m.set(t.id,t);
  });
  return[...m.values()];
}
// Cloud-Pull und Import: nie ueberschreiben, immer vereinigen.
function tjUebernehmen(remote){
  if(!Array.isArray(remote))return;
  const vorher=JSON.stringify(trades);
  trades=mergeTrades(trades,remote);
  if(JSON.stringify(trades)===vorher)return;
  try{localStorage.setItem(TRADES_KEY,JSON.stringify(trades));}catch(e){}
  if(curPage==='journal')renderJournal();
}
function tjSpeichern(){
  try{
    localStorage.setItem(TRADES_KEY,JSON.stringify(trades));
    localStorage.setItem('fxpro_updated',new Date().toISOString());
    markLsUpdatedSeen();markPrefEdit();cloudAutoSync();
    return true;
  }catch(e){alert('The trade could not be saved: '+(e&&e.message||e));return false;}
}

// ── Formate ───────────────────────────────────────────────────────────
const TJ_MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const TJ_WT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function tjPad(n){return String(n).padStart(2,'0');}
function tjHeute(){const d=new Date();return`${d.getFullYear()}-${tjPad(d.getMonth()+1)}-${tjPad(d.getDate())}`;}
function tjNum(v){if(v===''||v==null)return null;const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:null;}
function tjGeld(n){
  if(n==null||!isFinite(n))return'–';
  const s=Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return(n>0?'+':n<0?'−':'')+s;
}
// Kompakt fuer die schmale Tageszelle auf dem Handy (46 px): +1.3k / −310.
// Die volle Zahl steht in der Tabelle darunter und im Detail-Fenster.
function tjKurz(n){
  if(n==null||!isFinite(n))return'–';
  const a=Math.abs(n),v=a>=1000?(a/1000).toFixed(a>=10000?0:1)+'k':String(Math.round(a));
  return(n>0?'+':n<0?'−':'')+v;
}
function tjKlasse(t){return t.pnl>0?'win':t.pnl<0?'loss':'be';}
function tjErgebnis(t){return t.pnl>0?'Win':t.pnl<0?'Loss':'Break-even';}
function tjFarbe(n){return n>0?'var(--bias-bull)':n<0?'var(--bias-bear)':'var(--bias-neu)';}
function tjDatumLang(d){
  const[y,m,t]=String(d||'').split('-').map(Number);if(!y)return'–';
  const w=new Date(y,m-1,t).getDay();
  return`${TJ_WT[(w+6)%7]}, ${t} ${TJ_MON[m-1].slice(0,3)} ${y}`;
}
// R-Vielfaches nur aus echten Eingaben (Entry, Stop, Exit) - sonst null.
function tjR(t){
  const e=tjNum(t.entry),s=tjNum(t.sl),x=tjNum(t.exit);
  if(e==null||s==null||x==null||e===s)return null;
  const risiko=t.dir==='short'?s-e:e-s;
  if(!(risiko>0))return null;
  return(t.dir==='short'?e-x:x-e)/risiko;
}

// ── Seite ─────────────────────────────────────────────────────────────
function tjMonatSetzen(delta){
  const[y,m]=(tjMonat||tjHeute().slice(0,7)).split('-').map(Number);
  const d=new Date(y,m-1+delta,1);
  tjMonat=`${d.getFullYear()}-${tjPad(d.getMonth()+1)}`;
  renderJournal();
}
function tjMonatHeute(){tjMonat=tjHeute().slice(0,7);renderJournal();}

function renderJournal(){
  const el=document.getElementById('journalBody');if(!el)return;
  if(!tjMonat)tjMonat=tjHeute().slice(0,7);
  const[y,m]=tjMonat.split('-').map(Number);
  const imMonat=tjAktiv().filter(t=>String(t.d||'').slice(0,7)===tjMonat);
  const proTag={};
  imMonat.forEach(t=>{(proTag[t.d]=proTag[t.d]||[]).push(t);});
  Object.values(proTag).forEach(l=>l.sort((a,b)=>String(a.t||'').localeCompare(String(b.t||''))));

  // Kennzahlen des Monats
  const netto=imMonat.reduce((s,t)=>s+(t.pnl||0),0);
  const wins=imMonat.filter(t=>t.pnl>0).length,losses=imMonat.filter(t=>t.pnl<0).length;
  const quote=wins+losses?Math.round(wins/(wins+losses)*100):null;
  const best=imMonat.length?Math.max(...imMonat.map(t=>t.pnl)):null;
  const worst=imMonat.length?Math.min(...imMonat.map(t=>t.pnl)):null;
  const kpi=(lbl,wert)=>`<div class="tj-kpi"><div class="tj-kpi-l">${lbl}</div><div class="tj-kpi-v">${wert}</div></div>`;
  const kopf=`<div class="tj-card tj-kopf">
    <div class="tj-nav">
      <button class="btn tj-navb" onclick="tjMonatSetzen(-1)" title="Previous month" aria-label="Previous month">‹</button>
      <div class="tj-monat">${TJ_MON[m-1]} ${y}</div>
      <button class="btn tj-navb" onclick="tjMonatSetzen(1)" title="Next month" aria-label="Next month">›</button>
      <button class="btn" onclick="tjMonatHeute()" title="Back to the current month">Today</button>
    </div>
    <div class="tj-kpis">
      ${kpi('Net P/L',`<b style="color:${tjFarbe(netto)}">${imMonat.length?tjGeld(netto):'–'}</b>`)}
      ${kpi('Trades',`<b>${imMonat.length}</b>`)}
      ${kpi('Win rate',quote==null?'–':`<b style="color:${quote>=50?'var(--bias-bull)':'var(--bias-bear)'}">${quote}%</b>`)}
      ${kpi('Wins | Losses',`<b style="color:var(--bias-bull)">${wins}</b> | <b style="color:var(--bias-bear)">${losses}</b>`)}
      ${kpi('Best',best==null?'–':`<b style="color:${tjFarbe(best)}">${tjGeld(best)}</b>`)}
      ${kpi('Worst',worst==null?'–':`<b style="color:${tjFarbe(worst)}">${tjGeld(worst)}</b>`)}
    </div>
  </div>`;

  // Kalender: Montag zuerst, volle Wochen
  const erster=new Date(y,m-1,1),tage=new Date(y,m,0).getDate();
  const vorlauf=(erster.getDay()+6)%7;
  const heute=tjHeute();
  let zellen='';
  for(let i=0;i<vorlauf;i++)zellen+='<div class="tj-tag tj-leer"></div>';
  for(let d=1;d<=tage;d++){
    const ds=`${y}-${tjPad(m)}-${tjPad(d)}`;
    const l=proTag[ds]||[];
    const summe=l.reduce((s,t)=>s+(t.pnl||0),0);
    const wt=(vorlauf+d-1)%7;
    const chips=l.map(t=>`<button class="tj-chip ${tjKlasse(t)}" onclick="event.stopPropagation();tjZeigen('${escJH(t.id)}')" title="${escH(t.a)} · ${t.dir==='short'?'Short':'Long'} · ${tjGeld(t.pnl)}"><span class="tj-ca">${escH(t.a)}</span><span class="tj-cd">${t.dir==='short'?'Short':'Long'}</span><b class="tj-cp">${tjGeld(t.pnl)}</b></button>`).join('');
    const ton=!l.length?'':summe>0?' plus':summe<0?' minus':'';
    zellen+=`<div class="tj-tag${ds===heute?' heute':''}${wt>4?' we':''}${ton}" role="button" tabindex="0" onclick="tjNeu('${ds}')" title="Add a trade on ${tjDatumLang(ds)}">
      <div class="tj-tk"><span class="tj-tn">${d}</span>${l.length?`<b class="tj-ts" style="color:${tjFarbe(summe)}">${tjGeld(summe)}</b><b class="tj-tsk" style="color:${tjFarbe(summe)}">${tjKurz(summe)}</b>`:''}</div>
      <div class="tj-chips">${chips}</div>
    </div>`;
  }
  const rest=(7-(vorlauf+tage)%7)%7;
  for(let i=0;i<rest;i++)zellen+='<div class="tj-tag tj-leer"></div>';
  const kal=`<div class="tj-card">
    <div class="tj-kt">Calendar</div>
    <div class="tj-grid tj-wt">${TJ_WT.map(w=>`<div>${w}</div>`).join('')}</div>
    <div class="tj-grid">${zellen}</div>
    <div class="tj-hint"><i>Tap a day to add a trade · tap a trade for all details</i></div>
  </div>`;

  // Liste des Monats (auf dem Handy die volle Ansicht mit ganzen Namen)
  const sortiert=imMonat.slice().sort((a,b)=>(String(b.d)+String(b.t||'')).localeCompare(String(a.d)+String(a.t||'')));
  const liste=`<div class="tj-card">
    <div class="tj-kt">Trades · ${TJ_MON[m-1]} ${y}</div>
    ${sortiert.length?`<table class="tj-tab"><thead><tr><th>Date</th><th>Asset</th><th>Direction</th><th class="r">P/L</th><th class="r">R</th></tr></thead><tbody>
      ${sortiert.map(t=>{const r=tjR(t);return`<tr class="${tjKlasse(t)}" onclick="tjZeigen('${escJH(t.id)}')" title="Show all details"><td>${escH(tjDatumLang(t.d))}${t.t?` <i>${escH(t.t)}</i>`:''}</td><td><b>${escH(t.a)}</b></td><td style="color:${t.dir==='short'?'var(--bias-bear)':'var(--bias-bull)'}">${t.dir==='short'?'Short':'Long'}</td><td class="r"><b style="color:${tjFarbe(t.pnl)}">${tjGeld(t.pnl)}</b></td><td class="r">${r==null?'–':`<span style="color:${tjFarbe(r)}">${r>0?'+':''}${r.toFixed(2)}R</span>`}</td></tr>`;}).join('')}
    </tbody></table>`:`<div class="tj-leertext"><i>No trades in this month yet</i> · <button class="btn g" onclick="tjNeu()">＋ Add trade</button></div>`}
  </div>`;
  el.innerHTML=kopf+kal+liste;
}

// ── Detail-Fenster ───────────────────────────────────────────────────
function tjZeigen(id){
  const t=trades.find(x=>x.id===id&&!x.del);if(!t)return;
  _tjView=id;
  const r=tjR(t);
  const zeile=(k,v)=>v==null||v===''?'':`<tr><th>${k}</th><td>${v}</td></tr>`;
  const num=v=>{const n=tjNum(v);return n==null?null:`<b>${escH(String(v))}</b>`;};
  document.getElementById('tjvTitle').textContent=`${t.a} · ${t.dir==='short'?'Short':'Long'}`;
  document.getElementById('tjvBody').innerHTML=`
    <div class="tj-vk ${tjKlasse(t)}"><span class="tj-ve">${tjErgebnis(t)}</span><b class="tj-vp" style="color:${tjFarbe(t.pnl)}">${tjGeld(t.pnl)}</b></div>
    <table class="kv">
      ${zeile('Date',`<b>${escH(tjDatumLang(t.d))}</b>${t.t?` · <i>${escH(t.t)}</i>`:''}`)}
      ${zeile('Asset',`<b>${escH(t.a)}</b>`)}
      ${zeile('Direction',`<b style="color:${t.dir==='short'?'var(--bias-bear)':'var(--bias-bull)'}">${t.dir==='short'?'Short':'Long'}</b>`)}
      ${zeile('P/L',`<b style="color:${tjFarbe(t.pnl)}">${tjGeld(t.pnl)}</b>`)}
      ${zeile('R multiple',r==null?null:`<b style="color:${tjFarbe(r)}">${r>0?'+':''}${r.toFixed(2)}R</b>`)}
      ${zeile('Entry',num(t.entry))}
      ${zeile('Exit',num(t.exit))}
      ${zeile('Stop loss',num(t.sl))}
      ${zeile('Take profit',num(t.tp))}
      ${zeile('Size',t.size?`<b>${escH(String(t.size))}</b>`:null)}
      ${zeile('Setup',t.setup?escH(t.setup):null)}
      ${zeile('Notes',t.notes?`<i class="tj-notiz">${escH(t.notes)}</i>`:null)}
    </table>`;
  openM('mTradeView');
}
function tjBearbeiten(){const id=_tjView;closeM('mTradeView');if(id)tjNeu(null,id);}
function tjLoeschen(){
  const t=trades.find(x=>x.id===_tjView);if(!t)return;
  if(!confirm(`Delete this trade?\n${t.a} · ${tjGeld(t.pnl)}`))return;
  const alt={...t};
  // Grabstein statt Entfernen - sonst holt der Merge ihn vom anderen Geraet zurueck.
  Object.keys(t).forEach(k=>{if(k!=='id')delete t[k];});
  t.del=true;t.up=new Date().toISOString();
  if(!tjSpeichern()){Object.assign(t,alt);delete t.del;return;}
  closeM('mTradeView');renderJournal();
}

// ── Editor ───────────────────────────────────────────────────────────
const TJ_FELDER=['tjDate','tjTime','tjAsset','tjDir','tjPnl','tjEntry','tjExit','tjSl','tjTp','tjSize','tjSetup','tjNotes'];
const TJ_SCHLUESSEL=['d','t','a','dir','pnl','entry','exit','sl','tp','size','setup','notes'];
function tjAssetVorschlaege(){
  const s=new Set();
  tjAktiv().forEach(t=>t.a&&s.add(t.a));
  (pairs||[]).forEach(p=>p&&p.name&&s.add(p.name));
  (syms||[]).forEach(x=>x&&x.id&&s.add(x.id));
  return[...s].sort((a,b)=>a.localeCompare(b));
}
function tjNeu(datum,id){
  const t=id?trades.find(x=>x.id===id&&!x.del):null;
  _tjEdit=t?t.id:null;
  document.getElementById('tjFormTitle').textContent=t?'Edit trade':'New trade';
  const dl=document.getElementById('tjAssetList');
  if(dl)dl.innerHTML=tjAssetVorschlaege().map(a=>`<option value="${escH(a)}"></option>`).join('');
  TJ_FELDER.forEach((f,i)=>{
    const e=document.getElementById(f);if(!e)return;
    const k=TJ_SCHLUESSEL[i];
    let v=t?t[k]:'';
    if(!t&&k==='d')v=datum||tjHeute();
    if(!t&&k==='dir')v='long';
    e.value=v==null?'':String(v);
  });
  const err=document.getElementById('tjErr');if(err){err.textContent='';err.hidden=true;}
  openM('mTrade');
}
function tjFormSpeichern(){
  const v={};TJ_FELDER.forEach((f,i)=>{const e=document.getElementById(f);v[TJ_SCHLUESSEL[i]]=e?String(e.value||'').trim():'';});
  const fehl=[];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.d))fehl.push('Date');
  if(!v.a)fehl.push('Asset');
  const pnl=tjNum(v.pnl);if(pnl==null)fehl.push('P/L');
  const err=document.getElementById('tjErr');
  if(fehl.length){if(err){err.textContent='Missing: '+fehl.join(' · ');err.hidden=false;}return false;}
  const neu={...v,dir:v.dir==='short'?'short':'long',pnl,up:new Date().toISOString()};
  const alt=_tjEdit?trades.find(x=>x.id===_tjEdit):null;
  const sicherung=alt?{...alt}:null;
  if(alt)Object.assign(alt,neu);else trades.push({id:uid(),...neu});
  if(!tjSpeichern()){
    if(alt){Object.keys(alt).forEach(k=>delete alt[k]);Object.assign(alt,sicherung);}else trades.pop();
    if(err){err.textContent='Not saved - storage is full or blocked';err.hidden=false;}
    return false;
  }
  tjMonat=v.d.slice(0,7);
  closeM('mTrade');renderJournal();
  return true;
}
// Fuer MODAL_GUARD_TABELLE (js/main.js) - Nachfrage bei ungespeicherten Eingaben.
const TJ_GUARD={felder:TJ_FELDER,save:()=>tjFormSpeichern(),was:'This trade'};

export {trades,TRADES_KEY,mergeTrades,tjUebernehmen,renderJournal,tjNeu,tjZeigen,tjFormSpeichern,TJ_GUARD,tjR};
if(typeof window!=='undefined')Object.assign(window,{renderJournal,tjNeu,tjZeigen,tjBearbeiten,tjLoeschen,tjFormSpeichern,tjMonatSetzen,tjMonatHeute,mergeTrades,tjUebernehmen,tjR});
if(typeof window!=='undefined')Object.defineProperty(window,'trades',{get:()=>trades,configurable:true});
