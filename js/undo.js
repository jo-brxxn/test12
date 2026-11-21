// ── UNDO / REDO: die letzten 20 Aenderungen, dauerhaft, ueber alle Geraete (seit 2026-11-17, VERSION-CHECK-741) ──
// Nutzer 2026-11-17: "Die Tasten oben rechts also die Pfeile ... die letzen 20 Aktionen
// zu merken egal was es ist außer halt scrollen und iwas öffnen einfach wenn man eine
// Veränderung an der Webseite macht also was löscht hinzufügt oder neu anordnet ...
// dauerhaft kommt eine dazu wird die 20. zur 21. und damit gelöscht."
// Rueckfrage 2026-11-17: ueber ALLE Geraete geteilt; ein Feld = ein Schritt.
//
// Vorher: 60 volle Kopien von snap() nur im Speicher (weg nach Neuladen), Trades fehlten,
// Tipp-Felder ohne pushU() (Gameplan, Notiz-Texte) fehlten, und ein Undo setzte den GANZEN
// Stand zurueck - auch, was der Abgleich inzwischen von einem anderen Geraet gebracht hatte.
// snap() misst 924 KB: 20 volle Kopien (18 MB) passen weder in den iPad-Speicher (~5 MB)
// noch in die Cloud-Zeile. Deshalb haelt jeder Schritt nur den UNTERSCHIED (Pfad, alt, neu).
//
// Was ein Schritt ist: jedes save(), vor dem eine Nutzer-Markierung lag (pushU, saveSoon,
// markUserEditTs, markPrefEdit - check/zurueck.js B erzwingt sie fuer jeden Klick, der
// Zustand aendert), plus jedes Speichern eines Trades. save() OHNE Markierung (Feeds,
// Kalender, Trend/COT/Sentiment) und jeder Abgleich verschieben nur die Basis - sie landen
// nie in einem Schritt und ein Undo dreht sie nie zurueck.
// Tippen: Schritte desselben Felds (bis der Fokus es verlaesst) verschmelzen zu einem.
//
// Ein Undo setzt NUR die Pfade des Schritts zurueck - was danach an anderer Stelle passiert
// ist (auch auf einem anderen Geraet), bleibt. Zeitstempel (Notiz up, Gameplan t, Trade up)
// werden dabei frisch gesetzt, sonst gewinnt im Abgleich die juengere, rueckgaengig
// gemachte Fassung vom anderen Geraet.
// Abgleich des Verlaufs selbst: ganzes Objekt, juengeres t gewinnt (Geraete wechseln sich
// beim Bedienen ab; ein Verlust trifft nur den Verlauf, nie die Daten).
import {snap,undoSnapSetzen,markUserEditTs,save,flushAndSave,tippenOffen,tippenJetztSpeichern,renderSidebar,rerender} from './main.js';
import {trades,tjUndoSetzen} from './trades.js';

export const UNDO_MAX=20,UNDO_KEY='fxpro_undo_log',UNDO_MAX_BYTES=1200000;
let _seqN=0,_seqStand=0,_basis=null,_zuletzt=null,_tBasis=null,_offen=null,_still=0,_fokusSitzung=0;
// Fokus-Sitzung = Seitenaufruf + Zaehler: nach Neuladen verschmilzt nichts mit einem alten Schritt
const _sitz=Math.random().toString(36).slice(2,8);
const istObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const klon=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function gleich(a,b){
  if(a===b)return true;
  if(typeof a!=='object'||typeof b!=='object'||a===null||b===null)return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!gleich(a[i],b[i]))return false;return true;}
  const ka=Object.keys(a).filter(k=>a[k]!==undefined),kb=Object.keys(b).filter(k=>b[k]!==undefined);
  if(ka.length!==kb.length)return false;
  for(const k of ka)if(!gleich(a[k],b[k]))return false;
  return true;
}
// Liste aus Objekten mit eindeutiger id -> nach id vergleichen (Umordnen = ein kleiner Eintrag).
function idListe(a){
  if(!Array.isArray(a))return false;
  if(!a.length)return true;
  if(!a.every(x=>istObj(x)&&(typeof x.id==='string'||typeof x.id==='number')))return false;
  return new Set(a.map(x=>String(x.id))).size===a.length;
}
export function undoDiff(a,b,p,out){
  if(gleich(a,b))return out;
  if(istObj(a)&&istObj(b)){new Set([...Object.keys(a),...Object.keys(b)]).forEach(k=>undoDiff(a[k],b[k],p.concat(k),out));return out;}
  if(Array.isArray(a)&&Array.isArray(b)&&(a.length||b.length)&&idListe(a)&&idListe(b)){
    const ia=a.map(x=>String(x.id)),ib=b.map(x=>String(x.id));
    const ma=new Map(a.map(x=>[String(x.id),x])),mb=new Map(b.map(x=>[String(x.id),x]));
    new Set([...ia,...ib]).forEach(id=>undoDiff(ma.get(id),mb.get(id),p.concat('#'+id),out));
    if(ia.join('\u0001')!==ib.join('\u0001'))out.push({p,o:ia,n:ib});
    return out;
  }
  out.push({p,a:klon(a),b:klon(b)});
  return out;
}
function hole(c,s){
  if(c==null||typeof c!=='object')return undefined;
  if(Array.isArray(c)&&s[0]==='#')return c.find(x=>x&&String(x.id)===s.slice(1));
  return c[s];
}
function setze(c,s,v){
  if(Array.isArray(c)&&s[0]==='#'){
    const i=c.findIndex(x=>x&&String(x.id)===s.slice(1));
    if(v===undefined){if(i>=0)c.splice(i,1);}
    else if(i>=0)c[i]=v;else c.push(v);
    return;
  }
  if(v===undefined)delete c[s];else c[s]=v;
}
// Ein Schritt auf einen Stand anwenden: rueck=true -> alte Werte, sonst neue.
export function undoAnwenden(stand,patches,rueck){
  const wert=patches.filter(x=>!x.o),ord=patches.filter(x=>x.o);
  (rueck?wert.slice().reverse():wert).forEach(x=>{
    let c=stand;
    for(let i=0;i<x.p.length-1;i++){
      let n=hole(c,x.p[i]);
      if(n==null||typeof n!=='object'){n=x.p[i+1][0]==='#'?[]:{};setze(c,x.p[i],n);}
      c=n;
    }
    setze(c,x.p[x.p.length-1],klon(rueck?x.a:x.b));
  });
  ord.forEach(x=>{
    let c=stand;for(const s of x.p){c=hole(c,s);if(c==null)break;}
    if(!Array.isArray(c))return;
    const ziel=new Map((rueck?x.o:x.n).map((id,i)=>[id,i]));
    const z=c.map((e,i)=>[e,ziel.has(String(e&&e.id))?ziel.get(String(e.id)):1e9+i]);
    z.sort((u,v)=>u[1]-v[1]);
    c.splice(0,c.length,...z.map(u=>u[0]));
  });
  return stand;
}
function verschmelzen(alt,neu){
  const m=new Map(),schl=x=>(x.o?'o\u0002':'v\u0002')+x.p.join('\u0001');
  alt.forEach(x=>m.set(schl(x),klon(x)));
  neu.forEach(x=>{const k=schl(x),v=m.get(k);if(!v){m.set(k,klon(x));return;}if(x.o)v.n=x.n;else v.b=klon(x.b);});
  return[...m.values()].filter(x=>x.o?x.o.join('\u0001')!==x.n.join('\u0001'):!gleich(x.a,x.b));
}
// ── Verlauf lesen/schreiben (Platte; Cloud ueber cloudPushRoh/cloudPullRoh) ──
export function undoLog(){
  try{const v=JSON.parse(localStorage.getItem(UNDO_KEY)||'null');if(v&&Array.isArray(v.e))return{t:+v.t||0,pos:Math.max(0,Math.min(v.e.length,+v.pos||0)),e:v.e};}catch(e){}
  return{t:0,pos:0,e:[]};
}
function logSchreiben(l){
  l.t=Date.now();
  let s=JSON.stringify(l);
  // Groesse begrenzen: aelteste zuerst raus, der juengste Schritt bleibt immer
  while(s.length>UNDO_MAX_BYTES&&l.e.length>1){l.e.shift();l.pos=Math.max(0,l.pos-1);s=JSON.stringify(l);}
  // Speicher voll: aelteste Schritte opfern, bis es passt (der Datenstand selbst hat Vorrang)
  for(;;){
    try{localStorage.setItem(UNDO_KEY,s);break;}
    catch(e){if(l.e.length<=1){console.warn('Undo history not stored:',e);break;}l.e.shift();l.pos=Math.max(0,l.pos-1);s=JSON.stringify(l);}
  }
  undoKnoepfe();
}
// Cloud -> hier (cloudPullRoh): juengerer Verlauf gewinnt.
export function undoUebernehmen(r){
  if(!r||!Array.isArray(r.e))return;
  const l=undoLog();
  if((+r.t||0)<=l.t)return;
  try{localStorage.setItem(UNDO_KEY,JSON.stringify({t:+r.t,pos:Math.max(0,Math.min(r.e.length,+r.pos||0)),e:r.e}));}catch(e){}
  undoKnoepfe();
}
export function undoFuerCloud(){const l=undoLog();return l.e.length?l:null;}
const NAMEN={research:'Note',researchFolders:'Folder',researchAnalysis:'Analysis',calEvts:'Calendar',syms:'Asset',pairs:'Watchlist',pairCats:'Watchlist',
  noteCats:'Note category',widgets:'Dashboard',dashRemovedTypes:'Dashboard',dashV:'Dashboard',sbOrder:'Sidebar order',catOrder:'Category order',rubOrder:'Card order',
  eventAlerts:'Alert',priceAlerts:'Alert',gameplans:'Gameplan',econThesen:'Thesis',zbEntscheid:'Central bank',zbQuittung:'Central bank',bsGewichte:'Bias weights',scoreLog:'Score'};
function etikett(ps){
  if(ps.some(x=>x.p[0]==='T'))return'Trade';
  const p=(ps.find(x=>x.p[1]!=='scoreLog')||ps[0]).p;
  const n=NAMEN[p[1]]||'Change';
  if(p[1]==='gameplans'&&p[2])return n+' · '+p[2];
  if(p[1]==='syms'&&p[2]&&p[2][0]==='#')return n+' · '+p[2].slice(1);
  return n;
}
export function undoKnoepfe(){
  const l=undoLog(),u=document.getElementById('undoBtn'),r=document.getElementById('redoBtn');
  if(u){u.disabled=l.pos<1;u.title=l.pos?'Undo: '+(l.e[l.pos-1].l||'Change'):'Nothing to undo';}
  if(r){r.disabled=l.pos>=l.e.length;r.title=l.pos<l.e.length?'Redo: '+(l.e[l.pos].l||'Change'):'Nothing to redo';}
}
// ── Aufnehmen ──
const tjStr=()=>JSON.stringify((trades||[]).filter(t=>t&&t.id));
function feldJetzt(){
  const a=document.activeElement;
  if(!a||a===document.body)return null;
  if(a.isContentEditable)return a;
  if(a.tagName==='TEXTAREA')return a;
  if(a.tagName==='INPUT'&&!/^(button|checkbox|radio|range|file|submit|reset|color)$/i.test(a.type||''))return a;
  return null;
}
if(typeof document!=='undefined'){
  document.addEventListener('focusin',()=>{_fokusSitzung++;},true);
  document.addEventListener('focusout',()=>{if(_offen){clearTimeout(_offen.timer);_offen.timer=setTimeout(undoAbschliessen,30);}},true);
  addEventListener('pagehide',()=>{try{undoAbschliessen(true);}catch(e){}});
}
export function undoInit(){if(_basis===null)_basis=_zuletzt=snap();if(_tBasis===null)_tBasis=tjStr();undoKnoepfe();}
function planen(){
  clearTimeout(_offen.timer);
  _offen.timer=setTimeout(undoAbschliessen,350);
}
// aus save(): s = gerade geschriebener snap(), nutzer = Markierung seit dem letzten save()
export function undoOffen(){return!!_offen||tippenOffen();}
// Reihenfolge der save()-Aufrufe: ein spaet laufendes doSave darf keinen neueren Stand ueberschreiben
export function undoSeq(){return++_seqN;}
// aus doSave, wenn save() nichts fuer Undo hatte (Ruhe): Basis = gespeicherter Stand
export function undoRuhe(s,sq){
  if(sq<_seqStand||_still||_offen||tippenOffen())return;
  _seqStand=sq;_basis=_zuletzt=s;
}
// pushU = ein neuer Klick beginnt: Wartendes speichern, offenen Schritt abschliessen
export function undoGrenze(){
  if(_still)return;
  try{tippenJetztSpeichern();}catch(e){}
  if(_offen&&!feldJetzt())undoAbschliessen(true);
}
export function undoNachSave(s,nutzer,sq){
  if(sq)_seqStand=Math.max(_seqStand,sq);
  if(_basis===null||_still){_basis=s;_zuletzt=s;return;}
  const vorher=_zuletzt||_basis;_zuletzt=s;
  if(!nutzer){
    if(s===vorher)return;
    if(_offen||tippenOffen()){
      // Feed/Kalender mitten in einer Eingabe (gemessen 2026-11-17, check/undo.js B): diese
      // Aenderung (vorher -> jetzt) merken und beim Abschliessen aus dem Schritt nehmen.
      // Die Basis bleibt stehen, sonst verschluckt sie die noch nicht gespeicherten Zeichen.
      if(!_offen)_offen={zw:null,timer:0,fs:null,aus:[]};
      try{_offen.aus=verschmelzen(_offen.aus,undoDiff(JSON.parse(vorher),JSON.parse(s),['S'],[]));}catch(e){}
      return;
    }
    _basis=s;return;
  }
  if(!_offen)_offen={zw:null,timer:0,fs:null,aus:[]};
  _offen.zw=s;
  if(feldJetzt())_offen.fs=_sitz+':'+_fokusSitzung;
  planen();
}
// aus tjSpeichern (Trade angelegt, bearbeitet, geloescht)
export function undoTradeGespeichert(){
  if(_still)return;
  if(_tBasis===null){_tBasis=tjStr();return;}
  if(!_offen)_offen={zw:null,timer:0,fs:null,aus:[]};
  planen();
}
// Trades kamen aus der Cloud/einem anderen Tab: keine Nutzer-Aenderung
export function undoTradeBasis(){if(!_offen)_tBasis=tjStr();}
// zwingend=false (Takt/Fokus): wartet, solange getippte Zeichen noch nicht gespeichert sind -
// sonst landen sie in einem zweiten Schritt. Abgleich/Undo selbst schliessen sofort ab.
export function undoAbschliessen(zwingend){
  const o=_offen;if(!o)return;
  clearTimeout(o.timer);
  if(zwingend!==true&&tippenOffen()){o.timer=setTimeout(undoAbschliessen,150);return;}
  _offen=null;
  let out=[];
  if(o.zw&&_basis&&o.zw!==_basis){
    try{undoDiff(JSON.parse(_basis),JSON.parse(o.zw),['S'],out);}catch(e){}
    if(o.aus&&o.aus.length){
      const k=x=>(x.o?'o\u0002':'v\u0002')+x.p.join('\u0001'),aus=new Map(o.aus.map(x=>[k(x),x]));
      out=out.filter(x=>{const a=aus.get(k(x));return!a||(x.o?a.n.join('\u0001')!==x.n.join('\u0001'):!gleich(a.b,x.b));});
    }
  }
  // Basis = letzter gespeicherter Stand (enthaelt auch Feed-Aenderungen nach dem Nutzer-Stand)
  _basis=_zuletzt||o.zw||_basis;
  const t=tjStr();
  if(_tBasis!==null&&t!==_tBasis){try{undoDiff(JSON.parse(_tBasis),JSON.parse(t),['T'],[]).forEach(x=>{if(!x.o)out.push(x);});}catch(e){}}
  _tBasis=t;
  if(!out.length)return;
  const l=undoLog();
  l.e=l.e.slice(0,l.pos);
  const letzt=l.e[l.e.length-1];
  if(o.fs!=null&&letzt&&letzt.fs===o.fs&&letzt.g===geraet()){
    letzt.d=verschmelzen(letzt.d,out);letzt.ts=Date.now();
    if(!letzt.d.length)l.e.pop();
  }else{
    l.e.push({ts:Date.now(),g:geraet(),fs:o.fs,l:etikett(out),d:out});
  }
  while(l.e.length>UNDO_MAX)l.e.shift();
  l.pos=l.e.length;
  logSchreiben(l);
}
function geraet(){
  try{let g=localStorage.getItem('fxpro_undo_dev');if(!g){g=Math.random().toString(36).slice(2,10);localStorage.setItem('fxpro_undo_dev',g);}return g;}catch(e){return'x';}
}
// Abgleich/anderer Tab: offenen Schritt vorher abschliessen, danach Basis = neuer Stand
export function undoFremd(fn){
  try{undoAbschliessen(true);}catch(e){}
  _still++;
  try{return fn();}finally{_still--;try{_basis=_zuletzt=snap();_seqStand=++_seqN;}catch(e){}}
}
// ── Rueckgaengig / Wiederholen ──
function zeitstempelFrisch(stand,patches){
  const iso=new Date().toISOString(),jetzt=Date.now(),S=stand.S;
  patches.forEach(x=>{
    if(x.p[0]!=='S')return;
    if(x.p[1]==='gameplans'&&x.p[2]){
      // Gameplans vereinen je Asset (juengeres t gewinnt) - ein ENTFERNTER Plan kaeme vom
      // anderen Geraet zurueck. Deshalb leerer Plan mit frischem t statt Loeschen.
      if(!istObj(S.gameplans))S.gameplans={};
      if(!istObj(S.gameplans[x.p[2]]))S.gameplans[x.p[2]]={b:'',th:'',en:{t:'',k:'',v:''},br:{t:'',k:'',v:''},t:0};
      S.gameplans[x.p[2]].t=jetzt;
    }
    let c=S;
    for(let i=1;i<x.p.length;i++){
      const prev=c;c=hole(c,x.p[i]);
      if(c==null||typeof c!=='object')break;
      if(Array.isArray(prev)&&x.p[i][0]==='#'&&typeof c.up==='string')c.up=iso;
    }
  });
}
function schritt(rueck){
  try{flushAndSave();}catch(e){}
  undoAbschliessen(true);
  const l=undoLog();
  const e=rueck?l.e[l.pos-1]:l.e[l.pos];
  if(!e)return false;
  const ps=e.d||[],sP=ps.filter(x=>x.p[0]==='S').map(x=>Object.assign({},x,{p:x.p.slice(1)})),tP=ps.filter(x=>x.p[0]==='T').map(x=>Object.assign({},x,{p:x.p.slice(1)}));
  markUserEditTs();
  _still++;
  try{
    if(sP.length){
      const st={S:JSON.parse(snap())};
      undoAnwenden(st.S,sP,rueck);
      zeitstempelFrisch(st,ps);
      undoSnapSetzen(JSON.stringify(st.S));
    }
    if(tP.length){
      const liste=JSON.parse(tjStr()),iso=new Date().toISOString();
      const ids=new Set(tP.map(x=>x.p[0]).filter(s=>s&&s[0]==='#').map(s=>s.slice(1)));
      undoAnwenden(liste,tP,rueck);
      ids.forEach(id=>{
        const t=liste.find(x=>String(x.id)===id);
        // weg -> Grabstein, sonst holt der Abgleich ihn vom anderen Geraet zurueck
        if(!t)liste.push({id,del:true,up:iso});else t.up=iso;
      });
      tjUndoSetzen(liste);
    }
    save();
  }finally{_still--;}
  _basis=_zuletzt=snap();_seqStand=++_seqN;_tBasis=tjStr();
  l.pos+=rueck?-1:1;
  logSchreiben(l);
  try{renderSidebar();rerender();}catch(err){}
  return true;
}
export function doUndo(){try{return schritt(true);}catch(e){alert('Undo failed: '+(e&&e.message||e));return false;}}
export function doRedo(){try{return schritt(false);}catch(e){alert('Redo failed: '+(e&&e.message||e));return false;}}
if(typeof window!=='undefined')Object.assign(window,{doUndo,doRedo,undoLog});
