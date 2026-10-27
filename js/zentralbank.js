// ══ ZENTRALBANK-KARTE (Nutzer 2026-10-27) ═════════════════════════════════
// Nutzer: "auf jeder Asset Seite eine neue Karte ... die eine Art Bild ist sie
// soll eine grosse Zentralbank abbilden wo oben der Name steht und dann quasi
// auf 3 Saeulen baut Inflation Arbeitsmarkt und Wirtschaft diese 3 Saeulen
// sollen so sein wie die Notes Karte nur kleiner da soll es auch die
// Moeglichkeit geben Notizen reinzuschreiben. Dann soll es so sein, dass wenn
// die Zentralbank gesprochen hat ... das dort so ein roter Banner erscheint
// ... Sobald ein neues Meeting kommt werden die Notizen die gemacht wurden in
// ein Archiv gelegt passend zu dem Datum des letzten Meetings ... Oben rechts
// auf der Karte soll es dann den Archiv Button geben ... Leg Fokus auf
// Qualitaet ... den Namen schoen zu schreiben und vlt die Flagge einzubauen.
// Auch die Notizen muessen sicher zuverlaessig gespeichert werden".
// Per Rueckfrage festgelegt:
//  - ALLE Assets; Non-FX zeigen die verknuepfte Bank (macroCcyFor) - "denk
//    dran das da Notizen bei zb Inflation bei Dollar positiv sind aber vlt bei
//    einem anderen Asset nicht also da muss auch die Regel uebernommen
//    werden": die Bias-Farbe einer Notiz folgt der Asset-Regel der Saeule
//    (effDeriveRules: inverse -> gedreht).
//  - mehrere kurze Notizen je Saeule; seit 2026-10-27 (Nutzer: "die Notizen
//    und wie man sie einfuegt soll genau so sein wie bei den quick Notes",
//    per Rueckfrage = Pinned notes) EXAKT wie dort: "＋ New note…" oeffnet das
//    volle Notizfenster (Titel, Text, Tags, Bias, Event), die Zeilen sind
//    dieselben .ab-nt-Zeilen (★ markieren, Titel + Textanfang, ▲▼ sortieren,
//    Antippen oeffnet die Notiz, Loeschen im Fenster).
//  - Banner ab dem Zinsentscheid, weg nach der ersten Notiz oder per ✕
//  - Name in Gravur-Optik in der App-Schrift (Regel "eine Schrift")
//
// SPEICHERUNG - bewusst KEINE neue Speicherform: jede Notiz ist eine ganz
// normale Notiz in research.notes, mit einem Feld cb = {b: Bank-Waehrung,
// s: Saeule, m: Datum der Sitzung, zu der sie gehoert}. Damit laeuft sie durch
// genau den Weg, der nach den Notiz-Verlusten 2026-09-01 gehaertet wurde:
// snap()/Cloud-Sync, Zusammenfuehren nach id (mergeResearchNotes), Sperre
// ueber alle Tabs (navigator.locks), Drei-Wege-Abgleich, Papierkorb beim
// Loeschen (trashResNote). Geprueft von check/zentralbank.js.
// Gespeichert wird der Bias aus Sicht der BANK-Waehrung; die Asset-Sicht
// entsteht erst beim Anzeigen (und beim Eingeben zurueckgerechnet).
//
// ARCHIV = keine Verschiebung: eine Notiz behaelt ihr Sitzungsdatum m. Die
// Karte zeigt die Notizen der LETZTEN Sitzung, das Archiv alle aelteren. Kommt
// ein neuer Zinsentscheid, ist die Karte damit von selbst leer - es wird
// nichts kopiert oder geloescht, also kann dabei auch nichts verloren gehen.
import {BC,FX} from './constants.js';
import {escH,escJH,icn,abInfoBtn,getSym,macroCcyFor,effDeriveRules,invertBias,biasCss,
  resNotes,pushU,save,todayStr,calEvts,evtMatchesSym,IND_EVENT_MATCHERS,curPage,
  fmtDayHdr,assetIconHtml,openM,zbQuittung,zbEntscheid,syms,resZbNeu} from './main.js';
import {rateSteps} from './score.js';
import {isEvtPast,daysUntil} from './calendar.js';
import {CP} from './profil.js';

// ⚠ Als Funktion, nicht als Wert: der zirkulaere Import (main.js <->
// zentralbank.js) laesst escH beim Laden dieser Datei noch in der Todeszone
// (gleiche Falle wie in profil.js).
const h=x=>escH(x);
// Jede Saeule = eine Makro-Karte, deren Regel (same/inverse) die
// Farbe bestimmt. Akzentfarben wie die Makro-Karten selbst (--a-*).
const ZB_SAEULEN=[
  {k:'infl',t:'Inflation',rub:'Inflation',a:'--a-infl',ic:'barsUp'},
  {k:'arb',t:'Labour market',rub:'Labour Market',a:'--a-lab',ic:'briefcase'},
  {k:'wirt',t:'Economy',rub:'Economic Growth',a:'--a-grow',ic:'chartUp'},
  // Vierte Saeule (Nutzer 2026-10-27: "Ergaenz noch eine Saeule mit dem Namen
  // generel"): alles Uebrige der Sitzung - Entscheid, Ausblick, Ton. Regel und
  // Farbe der Zins-Karte (Interest Rates): eine allgemeine Notiz zur Bank
  // betrifft ihren Zinskurs, auf GOLD/SP500 also gedreht wie dort.
  {k:'allg',t:'General',rub:'Interest Rates',a:'--a-rate',ic:'percent'},
];
const ZB_TOL_TAGE=2;   // Kalender (Ortsdatum) und Feed (Datum am Sitz der Bank) liegen bis 1 Tag auseinander

// ── Sitzungen ────────────────────────────────────────────────────────────
// Vergangene Entscheide aus der Leitzins-Historie (jeder Beschluss, auch
// "unveraendert"), kommende und heutige aus dem Kalender (mit Uhrzeit). Ein
// Kalender-Termin, der hoechstens einen Tag neben einem Feed-Datum liegt, ist
// DIESELBE Sitzung - dann gilt das Kalender-Datum (es kennt die Uhrzeit).
function tageAbstand(a,b){return Math.abs(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/864e5;}
function zbSitzungen(ccy){
  const liste=[];
  (rateSteps(ccy)||[]).forEach(p=>{if(p&&p[0]&&p[0]<=todayStr())liste.push({d:p[0],t:'',vorbei:true,q:'feed'});});
  const m=IND_EVENT_MATCHERS['Central Bank Rate'];
  (calEvts||[]).forEach(ev=>{
    if(!ev||!ev.date||!m||!evtMatchesSym(ev,ccy)||!m(ev.name,ccy))return;
    const vorbei=isEvtPast(ev);
    const da=liste.find(x=>tageAbstand(x.d,ev.date)<=1);
    if(da){if(da.q==='feed'){da.d=ev.date;da.t=ev.time||'';da.q='kal';}da.vorbei=da.vorbei||vorbei;return;}
    liste.push({d:ev.date,t:ev.time||'',vorbei,q:'kal'});
  });
  liste.sort((a,b)=>a.d.localeCompare(b.d));
  let letzte=null,naechste=null;
  liste.forEach(x=>{if(x.vorbei)letzte=x;else if(!naechste)naechste=x;});
  return{letzte,naechste,liste};
}
// Wem gehoert eine neue Notiz? Der letzten Sitzung. Ohne bekannte Sitzung
// (Feed und Kalender fehlen) der juengsten vorhandenen Notiz, sonst heute -
// damit nie eine Notiz ohne Datum entsteht.
function zbAktSitzung(ccy,s){
  if(s&&s.letzte)return s.letzte.d;
  const alle=zbNotizen(ccy).map(n=>n.cb.m).sort();
  return alle.length?alle[alle.length-1]:todayStr();
}

// ── Notizen ──────────────────────────────────────────────────────────────
function zbNotizen(ccy){return resNotes().filter(n=>n&&n.cb&&n.cb.b===ccy&&n.cb.m&&ZB_SAEULEN.some(x=>x.k===n.cb.s));}
function zbIstAktuell(n,akt){return n.cb.m>=akt||tageAbstand(n.cb.m,akt)<=ZB_TOL_TAGE;}
function zbBank(ccy){const c=CP[ccy];return c?{name:c.bank,kurz:c.kurz,land:c.land}:{name:ccy+' central bank',kurz:ccy,land:''};}
// Wird die Saeule fuer DIESES Asset umgekehrt gelesen? (Gold: Inflation
// inverse - eine fuer den Dollar bullishe Inflationsnotiz ist fuer Gold bearish.)
// window.__gpZbKeineRegel: nur fuer die Gegenprobe in check/zentralbank.js.
function zbDreht(sym,ccy,rub){
  if(!sym||sym.id===ccy||window.__gpZbKeineRegel)return false;
  return(effDeriveRules(sym)||{})[rub]==='inverse';
}
const zbSicht=(b,dreht)=>dreht?invertBias(b||'neu'):(b||'neu');
const BIAS_ZEICHEN={bull:'▲',neu:'◆',bear:'▼'};
const BIAS_WORT={bull:'bullish',neu:'neutral',bear:'bearish'};

let _zbArchivAsset=null,_zbArchivTag=null;
// Reihenfolge wie Pinned notes (abNotizen): eigene Ordnung ord, sonst neueste zuerst.
function zbSortiert(liste){
  return liste.slice().sort((a,b)=>{
    const ao=typeof a.ord==='number'?a.ord:1e9,bo=typeof b.ord==='number'?b.ord:1e9;
    if(ao!==bo)return ao-bo;
    return String(b.up||b.ts||'').localeCompare(String(a.up||a.ts||''));
  });
}
// Eine Zeile = dieselbe Zeile wie in Pinned notes (.ab-nt). Im Archiv (lesen)
// ohne ★ und ▲▼, Antippen oeffnet die Notiz trotzdem.
function zbNotizZeile(n,dreht,lesen,i,anz){
  const b=zbSicht(n.bias,dreht);
  return`<div class="ab-nt zb-nt${n.hl?' hl':''}" style="--nb:${biasCss(b)}">
      ${lesen?'':`<button class="ab-nt-hl${n.hl?' on':''}" onclick="abNoteHl('${escJH(n.id)}')" title="${n.hl?'Remove highlight':'Mark as important'}">${n.hl?'★':'☆'}</button>`}
      <button class="ab-nt-tx" onclick="openResNote('${escJH(n.id)}')" title="Open this note">
        <span class="ab-nt-ti">${h(n.title||'Untitled note')}</span>
        ${n.body?`<span class="ab-nt-bd">${h(String(n.body).replace(/\s+/g,' ').slice(0,90))}</span>`:''}
      </button>
      ${lesen?'':`<span class="ab-nt-mv">
        <button onclick="zbVerschieben('${escJH(n.id)}',-1)" ${i===0?'disabled':''} title="Move up">▲</button>
        <button onclick="zbVerschieben('${escJH(n.id)}',1)" ${i===anz-1?'disabled':''} title="Move down">▼</button>
      </span>`}
    </div>`;
}
// Eine Saeule: Kapitell, Schaft (= kleine Pinned-notes-Karte), Basis.
function zbSaeuleHtml(sym,ccy,s,notizen,lesen,m){
  const dreht=zbDreht(sym,ccy,s.rub);
  const liste=zbSortiert(notizen);
  const zeilen=liste.map((n,i)=>zbNotizZeile(n,dreht,lesen,i,liste.length)).join('')
    ||`<div class="ab-nt-empty zb-leer">${lesen?'No notes.':'No notes for this meeting yet.'}</div>`;
  const neu=lesen?'':`<div class="ab-nt-add"><button type="button" class="finp ab-nt-neu" onclick="zbNeuFenster('${escJH(ccy)}','${s.k}')" title="Opens the note window — title, text, tags, bias and the related event">＋ New note…</button></div>`;
  const zins=s.k==='allg'?zbZinsZeileHtml(sym,ccy,m,lesen):'';
  return`<div class="zb-s" style="--zb-a:var(${s.a})">
    <div class="zb-kap" aria-hidden="true"><span class="zb-vol l"></span><span class="zb-aba"></span><span class="zb-vol r"></span></div>
    <div class="zb-schaft">
      <div class="zb-s-hd"><span class="zb-s-ic">${icn(s.ic,13)}</span><span class="zb-s-t">${h(s.t)}</span>${dreht?`<span class="zb-s-inv" title="For ${h(sym.name||sym.id)} this pillar reads inverse: the colours are flipped against the ${h(ccy)} view">inverse</span>`:''}<span class="zb-s-n">${notizen.length}</span></div>
      <div class="zb-inhalt">${zins}${neu}<div class="ab-nt-list zb-liste">${zeilen}</div></div>
    </div>
    <div class="zb-fuss" aria-hidden="true"></div>
  </div>`;
}
// Der Giebel - normale Dachneigung, nur die Flagge laenglich (Nutzer
// 2026-10-27, zweite Runde: "Das Dach soll nicht laenglicher nur das wo die
// Flagge drinne ist das Gebaeude soll eher groesser als breiter"; per
// Rueckfrage "Normales Dach, hoeher"). Dachkoerper und vertieftes Tympanon als SVG (dehnt sich mit der
// Breite, Kanten mit non-scaling-stroke), Zierspitzen an First und Ecken, in
// der Mitte die Flagge als Tafel im Flaggenformat mit je einem Lorbeerzweig
// links und rechts - Tafel, Zweige und Spitzen in festen Pixeln, damit nichts
// verzerrt.
const ZB_PALMETTE='<svg viewBox="0 0 40 30" aria-hidden="true"><path class="zb-p1" d="M20 29C9 24 5 13 11 3c3 9 6 13 9 15 3-2 6-6 9-15 6 10 2 21-9 26z"/><path class="zb-p2" d="M20 27c-2-8-2-17 0-26 2 9 2 18 0 26z"/></svg>';
// Lorbeerzweig nach rechts: leicht gebogener Stiel, 5 Blattpaare (oben/unten
// im Wechsel schraeg nach aussen), Spitze am Ende. Links = gespiegelt.
const ZB_ZWEIG=(()=>{
  const bl=[];
  for(let i=0;i<5;i++){
    const x=7+i*8.4,y=12-Math.sin(i/4*Math.PI*.9)*1.6;
    bl.push(`<ellipse cx="${x.toFixed(1)}" cy="${(y-3.4).toFixed(1)}" rx="5.2" ry="2.1" transform="rotate(-28 ${x.toFixed(1)} ${(y-3.4).toFixed(1)})"/>`);
    bl.push(`<ellipse cx="${(x+3.4).toFixed(1)}" cy="${(y+3.2).toFixed(1)}" rx="5.2" ry="2.1" transform="rotate(26 ${(x+3.4).toFixed(1)} ${(y+3.2).toFixed(1)})"/>`);
  }
  return`<svg class="zb-zweig" viewBox="0 0 52 24" aria-hidden="true"><path class="zb-zweig-ast" d="M1 12.5C14 11 30 9.5 50 11.5"/><g class="zb-zweig-bl">${bl.join('')}<ellipse cx="48.5" cy="11.3" rx="4.6" ry="1.9"/></g></svg>`;
})();
function zbGiebelHtml(ccy){
  let flagge='';
  if(FX.includes(ccy)){
    assetIconHtml(ccy,26,true);   // legt die Flaggen-Vorlagen (#ai-XXX) an, falls noch nicht da
    flagge=`<svg viewBox="0 0 36 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><use href="#ai-${ccy}" width="36" height="24"/></svg>`;
  }
  return`<div class="zb-giebel">
    <svg class="zb-giebel-svg" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="zbGDach" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="zb-gs-hell"/><stop offset="1" class="zb-gs-stein"/></linearGradient>
        <linearGradient id="zbGTymp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="zb-gs-stein2"/><stop offset="1" class="zb-gs-stein"/></linearGradient>
      </defs>
      <polygon points="0,120 500,3 1000,120" fill="url(#zbGDach)"/>
      <polygon points="64,112 500,22 936,112" fill="url(#zbGTymp)"/>
      <polyline class="zb-g-tiefe" points="64,112 500,22 936,112" vector-effect="non-scaling-stroke"/>
      <polyline class="zb-g-licht" points="0,120 500,3 1000,120" vector-effect="non-scaling-stroke"/>
      <line class="zb-g-boden" x1="64" y1="112" x2="936" y2="112" vector-effect="non-scaling-stroke"/>
    </svg>
    <span class="zb-akro zb-akro-m">${ZB_PALMETTE}</span><span class="zb-akro zb-akro-l">${ZB_PALMETTE}</span><span class="zb-akro zb-akro-r">${ZB_PALMETTE}</span>
    ${flagge?`<span class="zb-wappen"><span class="zb-zweig-l">${ZB_ZWEIG}</span><span class="zb-tafel" aria-hidden="true">${flagge}</span><span class="zb-zweig-r">${ZB_ZWEIG}</span></span>`:''}
  </div>`;
}

// ── Karte ────────────────────────────────────────────────────────────────
function zentralbankKarteHtml(sym,nurKarte){
  if(!sym)return'';
  const ccy=macroCcyFor(sym.id);
  const info=abInfoBtn('Central bank',[
    '<b>Four pillars</b> · <i>Inflation, Labour market, Economy, General</i> — your notes on what the bank said about each. <b>General</b> · decision, guidance, tone; reads like the <i>Interest Rates</i> card for linked assets.',
    '<b>Notes belong to the latest rate decision</b> · when the next decision has happened, the pillars start empty and the earlier notes are in the <b>Archive</b> under their meeting date.',
    '<b>Policy rate</b> · first line of <b>General</b>: the rate and its change at the latest meeting, from the rate feed — tap to change it (−1.50 … +1.50); before the feed has it, pick one of five.',
    '<b>Red base step</b> · the bank decided and this meeting has no note yet — it goes away with your first note or with ✕.',
    '<b>Colours</b> · ▲ <b style="color:'+BC.bull+'">bullish</b> · ◆ neutral · ▼ <b style="color:'+BC.bear+'">bearish</b>, for the asset you are on. Assets linked to a currency share its bank and its notes; a pillar that reads <i>inverse</i> for this asset shows the colours flipped.',
    '<b>Saved like every note</b> · synced across devices, deleted notes go to the trash for 30 days.'
  ],'info-b ii-nach');
  const ic=`<span class="ab-tile-ic" aria-hidden="true">${icn('landmark',18)||''}</span>`;
  if(!ccy||!CP[ccy]){
    const karte=`<div class="ab-tile zb-card" id="zbKarte"><div class="ab-tile-hd">${ic}<span class="ab-tile-t">Central bank</span>${info}</div>
      <div class="zb-nolink">No linked currency for ${h(sym.name||sym.id)} · <i>set one in the asset settings</i> ${icn('gear',13)}</div></div>`;
    return nurKarte?karte:`<div class="ab-col zb-row">${karte}</div>`;
  }
  const bank=zbBank(ccy),s=zbSitzungen(ccy),akt=zbAktSitzung(ccy,s);
  const alle=zbNotizen(ccy),jetzt=alle.filter(n=>zbIstAktuell(n,akt));
  const archivTage=[...new Set(alle.filter(n=>!zbIstAktuell(n,akt)).map(n=>n.cb.m))];
  const quittiert=zbQuittung&&zbQuittung[ccy]&&tageAbstand(zbQuittung[ccy],akt)<=ZB_TOL_TAGE;
  const naechste=s.naechste?(()=>{const d=daysUntil(s.naechste.d);return`${h(fmtDayHdr(s.naechste.d))} <i>${d<=0?'today':d+'d'}</i>`;})():'<i>not in the calendar yet</i>';
  const letzte=s.letzte?h(fmtDayHdr(s.letzte.d)):'<i>unknown</i>';
  // Erinnerung nach dem Zinsentscheid = die oberste Stufe wird rot (seit
  // 642, Nutzer-Wahl "Rote Stufe unten"): das Dach reicht bis in die
  // Titelzeile, ueber dem Gebaeude ist kein Platz mehr, und so bleibt die
  // Karte mit und ohne Erinnerung gleich hoch.
  const stufe=s.letzte&&!jetzt.length&&!quittiert?`<div class="zb-st zb-st1 zb-banner" role="status">
          <span class="zb-banner-ic">${icn('bell',15)}</span>
          <span class="zb-banner-tx"><b>${h(bank.kurz)} decided</b> · ${h(fmtDayHdr(s.letzte.d))} · <i>add your notes for this meeting</i></span>
          <button class="zb-banner-x" onclick="zbQuittieren('${escJH(ccy)}')" title="Dismiss for this meeting" aria-label="Dismiss">×</button>
        </div>`
    :`<div class="zb-st zb-st1"><span><span class="zb-st-l">Last decision</span> ${letzte}</span><span class="zb-st-dot" aria-hidden="true">◆</span><span><span class="zb-st-l">Next</span> ${naechste}</span></div>`;
  // Der Bankname steht gross im Fries; im Kopf nur noch die Verknuepfung -
  // rechts, wo das Dach flach ist (links/mittig laege sie auf dem Dach).
  const verknuepft=ccy!==sym.id?`<span class="zb-hd-sub">linked via <b>${h(ccy)}</b></span>`:'';
  const archivBtn=`<button class="btn zb-arch" onclick="zbArchivAuf('${escJH(sym.id)}')" title="Notes of earlier meetings">${icn('folder',14)}<span>Archive</span><b>${archivTage.length}</b></button>`;
  const karte=`<div class="ab-tile zb-card" id="zbKarte" data-ccy="${h(ccy)}">
    <div class="ab-tile-hd">${ic}<span class="ab-tile-t">Central bank</span>${verknuepft}${archivBtn}${info}</div>
    <div class="zb-bau">
      ${zbGiebelHtml(ccy)}
      <div class="zb-fries"><div class="zb-fries-z"><span class="zb-orn" aria-hidden="true"></span><span class="zb-name">${h(bank.name)}</span><span class="zb-orn r" aria-hidden="true"></span></div></div>
      <div class="zb-zahn" aria-hidden="true"></div>
      <div class="zb-architrav" aria-hidden="true"></div>
      <div class="zb-saeulen">${ZB_SAEULEN.map(x=>zbSaeuleHtml(sym,ccy,x,jetzt.filter(n=>n.cb.s===x.k),false,s.letzte?akt:null)).join('')}</div>
      <div class="zb-stufen">
        ${stufe}
        <div class="zb-st zb-st2" aria-hidden="true"></div>
        <div class="zb-st zb-st3" aria-hidden="true"></div>
      </div>
    </div>
  </div>`;
  return nurKarte?karte:`<div class="ab-col zb-row">${karte}</div>`;
}
// Nur die Karte neu zeichnen (docs/performance.md 5: nachladende Aenderungen
// tauschen nur ihre Karte).
// ── Zinsentscheid (645 unter dem Namen, seit 647 erste Zeile von General) ──
// Nutzer 2026-10-27: "Die erste Notiz bei generel soll immer fest sein
// decision mit 5 Optionen -0.5 -0.25 hold 0.25 0.5 und das dann wenn es negativ
// in bearish bias Farbe usw und das kann man dann so anklicken und dann steht
// da nur noch was gemacht wurde bei nochmal klicken oeffnet sich ein kleines
// Fenster das noch mehr Optionen anzeigt bis zu -1.5 und +1.5 in 0.25
// Schritten". Rueckfragen: Wert aus dem Zins-Feed (rateSteps), aenderbar;
// Platz "unter dem Namen der Bank mittig". Farben in der Sicht des Assets
// nach der Regel der Zins-Karte (wie die Saeule General): auf GOLD ist eine
// Fed-Senkung bullish.
const ZB_ENT_KURZ=[-0.5,-0.25,0,0.25,0.5];
const ZB_ENT_ALLE=Array.from({length:13},(_,i)=>(i-6)/4);
// Veraenderung des Leitzinses an dieser Sitzung laut Feed: letzter Stand
// innerhalb der Toleranz minus Stand davor. null = Sitzung noch nicht im Feed.
function zbEntscheidFeed(ccy,m){
  const st=rateSteps(ccy);if(!st||!m)return null;
  const idx=[];st.forEach((p,i)=>{if(p&&p[0]&&tageAbstand(p[0],m)<=ZB_TOL_TAGE)idx.push(i);});
  if(!idx.length||idx[0]<1)return null;
  const w=st[idx[idx.length-1]][1]-st[idx[0]-1][1];
  return isFinite(w)?Math.round(w*100)/100:null;
}
function zbEntscheidWert(ccy,m){
  const eig=zbEntscheid&&zbEntscheid[ccy]?zbEntscheid[ccy][m]:undefined;
  if(typeof eig==='number')return{w:eig,q:'du'};
  const f=zbEntscheidFeed(ccy,m);
  return f==null?null:{w:f,q:'feed'};
}
const zbEntText=w=>Math.abs(w)<1e-9?'Hold':(w>0?'+':'−')+Math.abs(w).toFixed(2);
const zbEntBias=(w,dreht)=>zbSicht(Math.abs(w)<1e-9?'neu':w>0?'bull':'bear',dreht);
// Stand vor der Sitzung: letzter Feed-Eintrag, der mehr als die Toleranz
// davor liegt. Der Satz nach der Sitzung = davor + Entscheid (Feed oder eigene
// Wahl) - steht die Sitzung im Feed, ist das genau dessen Wert.
function zbZinsVor(ccy,m){
  let v=null;(rateSteps(ccy)||[]).forEach(p=>{if(p&&p[0]&&p[0]<m&&tageAbstand(p[0],m)>ZB_TOL_TAGE)v=p[1];});
  return v;
}
const zbProz=v=>v==null||!isFinite(v)?'–':(+v).toFixed(2)+'%';
// Seit 647 (Nutzer 2026-10-27: "in der Bank Karte sollst du den Leitzins und
// die Veraenderung in Form eines einzigen Notiz bei generel ganz oben
// hinschreiben"; Rueckfrage: die Decision aus dem Fries hierher verlegen):
// feste erste Zeile der Saeule General, ueber "New note". Zeile 1 Leitzins,
// Zeile 2 Veraenderung in Bias-Farbe + Datum; Tipp oeffnet das Auswahlfenster.
// Noch nicht im Feed: bisheriger Satz und die fuenf Knoepfe.
function zbZinsZeileHtml(sym,ccy,m,lesen){
  if(!m)return'';
  const dreht=zbDreht(sym,ccy,'Interest Rates'),e=zbEntscheidWert(ccy,m),vor=zbZinsVor(ccy,m);
  const satz=e&&vor!=null?vor+e.w:vor;
  const fed=ccy==='USD'?' — the Fed sets a range; the feed gives its upper bound':'';
  const kopf=`<span class="zb-zins-z1"><span class="zb-zins-l">Policy rate</span><b title="${e?'After':'Before'} the decision of ${h(fmtDayHdr(m))}${fed}">${zbProz(satz)}</b></span>`;
  if(!e){
    if(lesen)return'';
    return`<div class="zb-zins zb-zins-wahl"><span class="zb-zins-z1"><span class="zb-zins-l">Policy rate</span><b title="Before the decision of ${h(fmtDayHdr(m))}${fed}">${zbProz(vor)}</b></span>
      <span class="zb-zins-z2">Decision ${h(fmtDayHdr(m))}</span>
      <div class="zb-ent" role="group" aria-label="Rate decision of ${h(fmtDayHdr(m))}">${ZB_ENT_KURZ.map(w=>`<button type="button" class="zb-ent-b" style="--nb:${biasCss(zbEntBias(w,dreht))}" onclick="zbEntscheidSetzen('${escJH(ccy)}','${m}',${w})">${zbEntText(w)}</button>`).join('')}</div></div>`;
  }
  const farbe=biasCss(zbEntBias(e.w,dreht));
  const zeile2=`<span class="zb-zins-z2"><b class="zb-zins-w">${zbEntText(e.w)}</b> · decision ${h(fmtDayHdr(m))}</span>`;
  if(lesen)return`<div class="zb-zins zb-zins-lesen" style="--nb:${farbe}">${kopf}${zeile2}</div>`;
  return`<div class="zb-zins" id="zbEntBtn" style="--nb:${farbe}" role="button" tabindex="0" aria-haspopup="dialog" onclick="zbEntscheidAuf('${escJH(ccy)}','${m}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();zbEntscheidAuf('${escJH(ccy)}','${m}');}" title="${e.q==='feed'?'From the rate feed':'Set by you'} — tap to change">${kopf}${zeile2}</div>`;
}
// Kleines Fenster unter dem Wert: alle Schritte -1.50 ... +1.50, darunter der
// Feed-Wert und "Use feed value" bzw. "Clear".
function zbEntDaneben(ev){const t=ev.target;if(t&&t.closest&&t.closest('#zbEntPop,#zbEntBtn'))return;zbEntscheidZu();}
function zbEntEsc(ev){if(ev.key==='Escape')zbEntscheidZu();}
function zbEntscheidZu(){
  document.removeEventListener('pointerdown',zbEntDaneben,true);document.removeEventListener('keydown',zbEntEsc,true);
  const el=document.getElementById('zbEntPop');if(el)el.remove();
}
function zbEntscheidAuf(ccy,m){
  if(document.getElementById('zbEntPop')){zbEntscheidZu();return;}
  const btn=document.getElementById('zbEntBtn'),sym=getSym();if(!btn||!sym)return;
  const dreht=zbDreht(sym,ccy,'Interest Rates'),e=zbEntscheidWert(ccy,m),f=zbEntscheidFeed(ccy,m);
  const el=document.createElement('div');el.id='zbEntPop';el.className='zb-ent-pop';el.setAttribute('role','dialog');
  const setz=w=>`zbEntscheidSetzen('${escJH(ccy)}','${m}',${w})`;
  el.innerHTML=`<div class="zb-ent-pop-hd"><b>${h(zbBank(ccy).kurz)} decision</b> · ${h(fmtDayHdr(m))}<span>rate change · percentage points</span></div>
    <div class="zb-ent-raster">${ZB_ENT_ALLE.map(w=>`<button type="button" class="zb-ent-b${e&&Math.abs(e.w-w)<1e-9?' on':''}" style="--nb:${biasCss(zbEntBias(w,dreht))}" onclick="${setz(w)}">${zbEntText(w)}</button>`).join('')}</div>
    <div class="zb-ent-pop-ft">${f!=null?`<span>Rate feed · <b style="color:${biasCss(zbEntBias(f,dreht))}">${zbEntText(f)}</b></span>${e&&e.q==='du'?`<button type="button" class="btn" onclick="${setz('null')}">Use feed value</button>`:''}`
      :`<span><i>not in the rate feed yet</i></span>${e?`<button type="button" class="btn" onclick="${setz('null')}">Clear</button>`:''}`}</div>`;
  document.body.appendChild(el);
  const r=btn.getBoundingClientRect(),w=el.offsetWidth;
  el.style.left=Math.round(Math.min(Math.max(8,r.left+r.width/2-w/2),window.innerWidth-w-8))+'px';
  el.style.top=Math.round(r.bottom+6)+'px';
  setTimeout(()=>{if(document.getElementById('zbEntPop')){document.addEventListener('pointerdown',zbEntDaneben,true);document.addEventListener('keydown',zbEntEsc,true);}},0);
}
function zbEntscheidSetzen(ccy,m,w){
  const f=zbEntscheidFeed(ccy,m);
  try{
    pushU();
    const t=zbEntscheid[ccy]||(zbEntscheid[ccy]={});
    // gleich dem Feed-Wert = kein eigener Eintrag (bleibt "aus dem Feed")
    if(w==null||(f!=null&&Math.abs(f-w)<1e-9))delete t[m];else t[m]=w;
    if(!Object.keys(t).length)delete zbEntscheid[ccy];
    save();
  }catch(e){alert('Could not be saved: '+(e&&e.message||e));return;}
  zbEntscheidZu();zbNeuZeichnen();
}
function zbNeuZeichnen(){
  const alt=document.getElementById('zbKarte');const sym=getSym();
  if(!alt||!sym)return;
  alt.outerHTML=zentralbankKarteHtml(sym,true);
}
// ── Bedienung ────────────────────────────────────────────────────────────
// Kontext fuer das Notizfenster (main.js, _resZb): Bank, Saeule, Sitzung, und
// ob der Bias fuer das GERADE OFFENE Asset gedreht gelesen wird. Ausserhalb
// der Asset-Seite (Suche im Archiv-Tab) gilt die Sicht der Bank-Waehrung.
function zbFensterKontext(cb){
  const sym=curPage==='cur'?getSym():null;
  const s=ZB_SAEULEN.find(x=>x.k===cb.s)||ZB_SAEULEN[0];
  const dreht=zbDreht(sym,cb.b,s.rub);
  const bank=zbBank(cb.b);
  const zeile=`${icn('landmark',13)}<b>${h(bank.name)}</b> · ${h(s.t)} · <i>meeting ${h(fmtDayHdr(cb.m))}</i>${dreht?` · <i>bias as seen for ${h(sym.name||sym.id)} (reads inverse)</i>`:''}`;
  return{b:cb.b,s:cb.s,m:cb.m,dreht,zeile};
}
// "＋ New note…" einer Saeule: das volle Notizfenster, vorbelegt mit Bank,
// Saeule und der letzten Sitzung.
function zbNeuFenster(ccy,k){
  if(!ZB_SAEULEN.some(x=>x.k===k))return;
  resZbNeu(zbFensterKontext({b:ccy,s:k,m:zbAktSitzung(ccy,zbSitzungen(ccy))}));
}
// ▲▼ wie abNoteMove: erst durchnummerieren, dann tauschen.
function zbVerschieben(id,richtung){
  const n=resNotes().find(x=>x&&x.id===id&&x.cb);if(!n)return;
  const ccy=n.cb.b,s=zbSitzungen(ccy),akt=zbAktSitzung(ccy,s);
  const liste=zbSortiert(zbNotizen(ccy).filter(x=>x.cb.s===n.cb.s&&zbIstAktuell(x,akt)));
  const i=liste.findIndex(x=>x.id===id),j=i+richtung;
  if(i<0||j<0||j>=liste.length)return;
  try{
    pushU();
    liste.forEach((x,k)=>{x.ord=k;});
    liste[i].ord=j;liste[j].ord=i;
    const jetzt=new Date().toISOString();liste[i].up=jetzt;liste[j].up=jetzt;
    save();
  }catch(e){alert('Could not move the note: '+(e&&e.message||e));return;}
  zbNeuZeichnen();
}
// Banner fuer DIESE Sitzung wegklicken - gespeichert und synchronisiert
// (zbQuittung in snap(), Regel 1), sonst stuende er auf dem naechsten Geraet
// wieder da.
function zbQuittieren(ccy){
  const s=zbSitzungen(ccy);const akt=zbAktSitzung(ccy,s);
  try{pushU();zbQuittung[ccy]=akt;save();}
  catch(e){alert('Could not be saved: '+(e&&e.message||e));return;}
  zbNeuZeichnen();
}

// ── Archiv ───────────────────────────────────────────────────────────────
function zbArchivAuf(assetId){
  _zbArchivAsset=assetId;_zbArchivTag=null;
  zbArchivZeichnen();
  openM('mZbArchiv');
}
function zbArchivZeig(tag){_zbArchivTag=tag;zbArchivZeichnen();}
function zbArchivZeichnen(){
  const sym=syms.find(x=>x.id===_zbArchivAsset)||getSym();
  const body=document.getElementById('zbArchivBody'),titel=document.getElementById('mZbArchivTitle');
  if(!sym||!body)return;
  const ccy=macroCcyFor(sym.id);const bank=zbBank(ccy);
  const s=zbSitzungen(ccy),akt=zbAktSitzung(ccy,s);
  const alt=zbNotizen(ccy).filter(n=>!zbIstAktuell(n,akt));
  const tage=[...new Set(alt.map(n=>n.cb.m))].sort().reverse();
  if(titel)titel.textContent=bank.name+' — meeting archive';
  if(!tage.length){body.innerHTML=`<div class="zb-leer">No earlier meetings with notes yet.</div>`;return;}
  if(!_zbArchivTag||!tage.includes(_zbArchivTag))_zbArchivTag=tage[0];
  const liste=tage.map(t=>{
    const n=alt.filter(x=>x.cb.m===t);
    const je=ZB_SAEULEN.map(x=>n.filter(y=>y.cb.s===x.k).length);
    return`<button class="zb-a-tag${t===_zbArchivTag?' on':''}" onclick="zbArchivZeig('${escJH(t)}')">
      <b>${h(fmtDayHdr(t))}</b><span class="zb-a-n">${ZB_SAEULEN.map((x,i)=>`<span style="color:var(${x.a})" title="${h(x.t)}">${je[i]}</span>`).join(' · ')}</span></button>`;
  }).join('');
  const sel=alt.filter(x=>x.cb.m===_zbArchivTag);
  body.innerHTML=`<div class="zb-a">
    <div class="zb-a-liste" role="list">${liste}</div>
    <div class="zb-a-detail">
      <div class="zb-a-kopf"><b>${h(bank.kurz)} decision</b> · ${h(fmtDayHdr(_zbArchivTag))}${ccy!==sym.id?` · <i>colours for ${h(sym.name||sym.id)}</i>`:''}</div>
      <div class="zb-saeulen zb-a-saeulen">${ZB_SAEULEN.map(x=>zbSaeuleHtml(sym,ccy,x,sel.filter(n=>n.cb.s===x.k),true,_zbArchivTag)).join('')}</div>
    </div>
  </div>`;
}

export {zentralbankKarteHtml,zbFensterKontext,zbSitzungen,zbNotizen,ZB_SAEULEN};
// Inline-Handler (onclick) brauchen die Funktionen am window.
Object.assign(window,{zbEntscheidAuf,zbEntscheidSetzen,zbNeuFenster,zbVerschieben,zbQuittieren,zbArchivAuf,zbArchivZeig,zbSitzungen,zbNotizen});
