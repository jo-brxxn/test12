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
//  - mehrere kurze Notizen je Saeule (wie die Pinned-notes-Karte)
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
import {escH,escJH,icn,abInfoBtn,getSym,isNonFx,macroCcyFor,effDeriveRules,invertBias,biasCss,
  research,resNotes,trashResNote,pushU,save,uid,todayStr,calEvts,evtMatchesSym,IND_EVENT_MATCHERS,
  fmtDayHdr,assetIconHtml,openM,zbQuittung,syms} from './main.js';
import {rateSteps} from './score.js';
import {isEvtPast,daysUntil} from './calendar.js';
import {CP} from './profil.js';

// ⚠ Als Funktion, nicht als Wert: der zirkulaere Import (main.js <->
// zentralbank.js) laesst escH beim Laden dieser Datei noch in der Todeszone
// (gleiche Falle wie in profil.js).
const h=x=>escH(x);
// Die drei Saeulen = die drei Makro-Karten, deren Regel (same/inverse) die
// Farbe bestimmt. Akzentfarben wie die Makro-Karten selbst (--a-*).
const ZB_SAEULEN=[
  {k:'infl',t:'Inflation',rub:'Inflation',a:'--a-infl',ic:'barsUp'},
  {k:'arb',t:'Labour market',rub:'Labour Market',a:'--a-lab',ic:'briefcase'},
  {k:'wirt',t:'Economy',rub:'Economic Growth',a:'--a-grow',ic:'chartUp'},
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

// Sitzungszustand der Karte (nicht gespeichert): Entwurf je Saeule, gewaehlte
// Richtung fuer die naechste Notiz, gerade bearbeitete Notiz, Fokus.
const _zbEntwurf={},_zbWahl={};
let _zbEdit=null,_zbFokus=null,_zbArchivAsset=null,_zbArchivTag=null;

function zbNotizHtml(n,dreht,lesen){
  const b=zbSicht(n.bias,dreht);
  const tx=n.title||n.body||'';
  if(!lesen&&_zbEdit===n.id)return`<div class="zb-n zb-n-ed" style="--nb:${biasCss(b)}">
      <input class="finp zb-n-in" id="zbEd-${h(n.id)}" value="${h(tx)}" maxlength="400" aria-label="Edit note" onkeydown="zbEditTaste(event,'${escJH(n.id)}')" onblur="zbEditFertig('${escJH(n.id)}',this.value)">
    </div>`;
  return`<div class="zb-n" style="--nb:${biasCss(b)}">
      ${lesen?`<span class="zb-n-b" style="color:${biasCss(b)}" title="${BIAS_WORT[b]}">${BIAS_ZEICHEN[b]}</span>`
        :`<button class="zb-n-b" style="color:${biasCss(b)}" onclick="zbBias('${escJH(n.id)}')" title="${BIAS_WORT[b]} — tap to change">${BIAS_ZEICHEN[b]}</button>`}
      ${lesen?`<span class="zb-n-tx">${h(tx)}</span>`:`<button class="zb-n-tx" onclick="zbBearb('${escJH(n.id)}')" title="Tap to edit">${h(tx)}</button>`}
      ${lesen?'':`<button class="zb-n-x" onclick="zbWeg('${escJH(n.id)}')" title="Delete note (goes to the trash for 30 days)" aria-label="Delete note">×</button>`}
    </div>`;
}
// Eine Saeule: Kapitell, Schaft (= kleine Notes-Karte), Basis.
function zbSaeuleHtml(sym,ccy,s,notizen,lesen){
  const dreht=zbDreht(sym,ccy,s.rub);
  const wahl=_zbWahl[ccy+'|'+s.k]||'neu';
  const liste=notizen.slice().sort((a,b)=>String(b.ts||'').localeCompare(String(a.ts||'')));
  const zeilen=liste.map(n=>zbNotizHtml(n,dreht,lesen)).join('')
    ||`<div class="zb-leer">${lesen?'No notes.':'<i>No notes for this meeting yet.</i>'}</div>`;
  const neu=lesen?'':`<div class="zb-add">
      <input class="finp zb-in" id="zbIn-${s.k}" placeholder="＋ New note…" maxlength="400" value="${h(_zbEntwurf[ccy+'|'+s.k]||'')}"
        aria-label="New ${h(s.t)} note" oninput="zbEntwurf('${escJH(ccy)}','${s.k}',this.value)" onkeydown="zbTaste(event,'${s.k}')"
        onfocus="zbFokus('${s.k}')" onfocusout="zbFokusWeg(event)">
      <span class="zb-wahl" role="group" aria-label="Bias of the next note">${['bull','neu','bear'].map(b=>`<button class="zb-w zb-w-${b}${wahl===b?' on':''}" onclick="zbWahl('${escJH(ccy)}','${s.k}','${b}')" title="Next note: ${BIAS_WORT[b]}${dreht?' for '+h(sym.name||sym.id):''}" aria-pressed="${wahl===b}">${BIAS_ZEICHEN[b]}</button>`).join('')}</span>
    </div>`;
  return`<div class="zb-s" style="--zb-a:var(${s.a})">
    <div class="zb-kap" aria-hidden="true"><span class="zb-vol l"></span><span class="zb-aba"></span><span class="zb-vol r"></span></div>
    <div class="zb-schaft">
      <div class="zb-s-hd"><span class="zb-s-ic">${icn(s.ic,13)}</span><span class="zb-s-t">${h(s.t)}</span>${dreht?`<span class="zb-s-inv" title="For ${h(sym.name||sym.id)} this pillar reads inverse: the colours are flipped against the ${h(ccy)} view">inverse</span>`:''}<span class="zb-s-n">${notizen.length}</span></div>
      ${neu}
      <div class="zb-liste">${zeilen}</div>
    </div>
    <div class="zb-fuss" aria-hidden="true"></div>
  </div>`;
}
// Der Giebel: Dachkoerper und vertieftes Tympanon als SVG (dehnt sich mit der
// Breite; Kanten mit non-scaling-stroke, damit sie ueberall gleich duenn
// bleiben), Zierspitzen (Akroterien) an First und Ecken, in der Mitte die
// Flagge im Medaillon mit Lorbeerkranz - Spitzen, Kranz und Medaillon als
// eigene Elemente in festen Pixeln, damit sie beim Dehnen nicht verzerren.
const ZB_PALMETTE='<svg viewBox="0 0 40 30" aria-hidden="true"><path class="zb-p1" d="M20 29C9 24 5 13 11 3c3 9 6 13 9 15 3-2 6-6 9-15 6 10 2 21-9 26z"/><path class="zb-p2" d="M20 27c-2-8-2-17 0-26 2 9 2 18 0 26z"/></svg>';
// Lorbeer: je Seite 6 Blattpaare auf einem Bogen um die Kranzmitte, vom Fuss
// (phi = 0, unten) bis knapp unter den Scheitel (phi = 150 Grad). Je Paar ein
// Blatt nach aussen, eines nach innen geneigt, Spitze entlang des Bogens.
const ZB_KRANZ=(()=>{
  const cx=60,cy=46,r=37,bl=[];
  for(const seite of[-1,1])for(let i=0;i<6;i++){
    const phi=(24+i*24)*Math.PI/180;
    const tang=Math.atan2(-Math.sin(phi),seite*Math.cos(phi))*180/Math.PI;   // Richtung des Bogens nach oben
    for(const [dr,kipp] of[[4.5,-seite*24],[-4.5,seite*24]]){
      const x=cx+seite*Math.sin(phi)*(r+dr),y=cy+Math.cos(phi)*(r+dr);
      bl.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="6.8" ry="2.7" transform="rotate(${(tang+kipp).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
    }
  }
  const ast=seite=>{const p=[];for(let i=0;i<=30;i++){const ph=(8+i*4.8)*Math.PI/180;p.push(`${(cx+seite*Math.sin(ph)*r).toFixed(1)} ${(cy+Math.cos(ph)*r).toFixed(1)}`);}return'M'+p.join('L');};
  return`<svg class="zb-kranz" viewBox="0 0 120 92" aria-hidden="true"><path class="zb-kranz-ast" d="${ast(-1)}${ast(1)}"/><g class="zb-kranz-bl">${bl.join('')}</g><path class="zb-kranz-band" d="M54 83.5l6 4 6-4-6 2.2z"/></svg>`;
})();
function zbGiebelHtml(ccy){
  let flagge='';
  if(FX.includes(ccy)){
    assetIconHtml(ccy,26,true);   // legt die Flaggen-Vorlagen (#ai-XXX) an, falls noch nicht da
    flagge=`<svg viewBox="0 0 36 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><use href="#ai-${ccy}" width="36" height="24"/></svg>`;
  }
  return`<div class="zb-giebel">
    <svg class="zb-giebel-svg" viewBox="0 0 1000 150" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="zbGDach" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="zb-gs-hell"/><stop offset="1" class="zb-gs-stein"/></linearGradient>
        <linearGradient id="zbGTymp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="zb-gs-stein2"/><stop offset="1" class="zb-gs-stein"/></linearGradient>
      </defs>
      <polygon points="0,150 500,3 1000,150" fill="url(#zbGDach)"/>
      <polygon points="74,141 500,28 926,141" fill="url(#zbGTymp)"/>
      <polyline class="zb-g-tiefe" points="74,141 500,28 926,141" vector-effect="non-scaling-stroke"/>
      <polyline class="zb-g-licht" points="0,150 500,3 1000,150" vector-effect="non-scaling-stroke"/>
      <line class="zb-g-boden" x1="74" y1="141" x2="926" y2="141" vector-effect="non-scaling-stroke"/>
    </svg>
    <span class="zb-akro zb-akro-m">${ZB_PALMETTE}</span><span class="zb-akro zb-akro-l">${ZB_PALMETTE}</span><span class="zb-akro zb-akro-r">${ZB_PALMETTE}</span>
    ${flagge?`<span class="zb-wappen">${ZB_KRANZ}<span class="zb-medaillon" aria-hidden="true">${flagge}</span></span>`:''}
  </div>`;
}

// ── Karte ────────────────────────────────────────────────────────────────
function zentralbankKarteHtml(sym,nurKarte){
  if(!sym)return'';
  const ccy=macroCcyFor(sym.id);
  const info=abInfoBtn('Central bank',[
    '<b>Three pillars</b> · <i>Inflation, Labour market, Economy</i> — your notes on what the bank said about each.',
    '<b>Notes belong to the latest rate decision</b> · when the next decision has happened, the pillars start empty and the earlier notes are in the <b>Archive</b> under their meeting date.',
    '<b>Red banner</b> · the bank decided and this meeting has no note yet — it goes away with your first note or with ✕.',
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
  const banner=s.letzte&&!jetzt.length&&!quittiert?`<div class="zb-banner" role="status">
      <span class="zb-banner-ic">${icn('bell',15)}</span>
      <span class="zb-banner-tx"><b>${h(bank.kurz)} decided</b> · ${h(fmtDayHdr(s.letzte.d))} · <i>add your notes for this meeting</i></span>
      <button class="zb-banner-x" onclick="zbQuittieren('${escJH(ccy)}')" title="Dismiss for this meeting" aria-label="Dismiss">×</button>
    </div>`:'';
  const verknuepft=ccy!==sym.id?` · <i>linked via ${h(ccy)}</i>`:'';
  const naechste=s.naechste?(()=>{const d=daysUntil(s.naechste.d);return`${h(fmtDayHdr(s.naechste.d))} <i>${d<=0?'today':d+'d'}</i>`;})():'<i>not in the calendar yet</i>';
  const letzte=s.letzte?h(fmtDayHdr(s.letzte.d)):'<i>unknown</i>';
  const archivBtn=`<button class="btn zb-arch" onclick="zbArchivAuf('${escJH(sym.id)}')" title="Notes of earlier meetings">${icn('folder',14)}<span>Archive</span><b>${archivTage.length}</b></button>`;
  const karte=`<div class="ab-tile zb-card" id="zbKarte" data-ccy="${h(ccy)}">
    <div class="ab-tile-hd">${ic}<span class="ab-tile-t">Central bank</span><span class="zb-hd-sub">${h(bank.name)}${verknuepft}</span>${archivBtn}${info}</div>
    ${banner}
    <div class="zb-bau">
      ${zbGiebelHtml(ccy)}
      <div class="zb-fries"><span class="zb-orn" aria-hidden="true"></span><span class="zb-name">${h(bank.name)}</span><span class="zb-orn r" aria-hidden="true"></span></div>
      <div class="zb-zahn" aria-hidden="true"></div>
      <div class="zb-saeulen">${ZB_SAEULEN.map(x=>zbSaeuleHtml(sym,ccy,x,jetzt.filter(n=>n.cb.s===x.k),false)).join('')}</div>
      <div class="zb-stufen">
        <div class="zb-st zb-st1"><span><span class="zb-st-l">Last decision</span> ${letzte}</span><span class="zb-st-dot" aria-hidden="true">◆</span><span><span class="zb-st-l">Next</span> ${naechste}</span></div>
        <div class="zb-st zb-st2" aria-hidden="true"></div>
        <div class="zb-st zb-st3" aria-hidden="true"></div>
      </div>
    </div>
  </div>`;
  return nurKarte?karte:`<div class="ab-col zb-row">${karte}</div>`;
}
// Nur die Karte neu zeichnen (docs/performance.md 5: nachladende Aenderungen
// tauschen nur ihre Karte), danach den Fokus zurueckholen.
function zbNeuZeichnen(){
  const alt=document.getElementById('zbKarte');const sym=getSym();
  if(!alt||!sym)return;
  alt.outerHTML=zentralbankKarteHtml(sym,true);
  zbNachRender();
}
// Ein Neuzeichnen (auch das ganze Asset-Seite durch einen Feed) darf einen
// gerade getippten Text nicht aus dem Feld werfen: Entwurf steht im Feld (aus
// _zbEntwurf), Fokus und Cursor kommen zurueck.
function zbNachRender(){
  if(_zbEdit){const e=document.getElementById('zbEd-'+_zbEdit);if(e&&document.activeElement!==e){e.focus();const l=e.value.length;try{e.setSelectionRange(l,l);}catch(x){}}return;}
  if(!_zbFokus)return;
  const el=document.getElementById('zbIn-'+_zbFokus.k);
  if(!el||document.activeElement===el)return;
  el.focus();
  try{el.setSelectionRange(_zbFokus.a,_zbFokus.e);}catch(x){}
}

// ── Bedienung ────────────────────────────────────────────────────────────
function zbCcyJetzt(){const sym=getSym();return sym?macroCcyFor(sym.id):null;}
function zbEntwurf(ccy,k,v){_zbEntwurf[ccy+'|'+k]=v;const el=document.getElementById('zbIn-'+k);if(el)_zbFokus={k,a:el.selectionStart,e:el.selectionEnd};}
function zbFokus(k){const el=document.getElementById('zbIn-'+k);_zbFokus={k,a:el?el.selectionStart:0,e:el?el.selectionEnd:0};}
// Ein Feld, das beim Neuzeichnen aus dem Dokument faellt, verliert den Fokus
// nicht wirklich - nur ein echtes Wegklicken loescht die Merkung.
function zbFokusWeg(ev){
  const t=ev&&ev.target;
  setTimeout(()=>{if(t&&t.isConnected&&document.activeElement!==t)_zbFokus=null;},0);
}
function zbWahl(ccy,k,b){
  _zbWahl[ccy+'|'+k]=b;
  // Nach der Richtungswahl geht es im Feld weiter (tippen, Enter).
  const el=document.getElementById('zbIn-'+k);const l=el?el.value.length:0;
  _zbFokus={k,a:l,e:l};
  zbNeuZeichnen();
}
function zbTaste(ev,k){
  if(ev.key==='Enter'&&!ev.isComposing){ev.preventDefault();zbNeu(k);}
  else if(ev.key==='Escape'){const ccy=zbCcyJetzt();if(ccy)delete _zbEntwurf[ccy+'|'+k];ev.target.value='';}
}
// Neue Notiz. ⚠ Kein Schreibpfad ohne try/catch mit sichtbarer Meldung (Regel
// 6) - scheitert es, bleibt der Text im Feld stehen.
function zbNeu(k){
  const sym=getSym(),ccy=zbCcyJetzt();
  const saeule=ZB_SAEULEN.find(x=>x.k===k);
  if(!sym||!ccy||!saeule)return;
  const el=document.getElementById('zbIn-'+k);
  const tx=String((el&&el.value)||_zbEntwurf[ccy+'|'+k]||'').trim();
  if(!tx)return;
  const dreht=zbDreht(sym,ccy,saeule.rub);
  const bias=zbSicht(_zbWahl[ccy+'|'+k]||'neu',dreht);   // zurueck in die Sicht der Bank-Waehrung
  try{
    pushU();
    const jetzt=new Date().toISOString();
    if(!Array.isArray(research.notes))research.notes=[];
    research.notes.push({id:uid(),title:tx,body:'',tags:[],fids:[],asset:'',fav:false,pin:false,arch:false,ts:jetzt,up:jetzt,bias,
      cb:{b:ccy,s:k,m:zbAktSitzung(ccy,zbSitzungen(ccy))}});
    if(!window.__gpZbOhneSave)save();   // __gpZbOhneSave: nur Gegenprobe check/zentralbank.js
  }catch(e){
    alert('The note could not be saved: '+(e&&e.message||e)+'\nYour text is still in the field.');
    return;
  }
  delete _zbEntwurf[ccy+'|'+k];
  _zbFokus={k,a:0,e:0};
  zbNeuZeichnen();
}
function zbFinde(id){return resNotes().find(n=>n&&n.id===id&&n.cb);}
// Richtung reihum: neutral -> bullish -> bearish (in der Sicht des Assets).
function zbBias(id){
  const n=zbFinde(id),sym=getSym();if(!n||!sym)return;
  const s=ZB_SAEULEN.find(x=>x.k===n.cb.s);const dreht=zbDreht(sym,n.cb.b,s&&s.rub);
  const jetzt=zbSicht(n.bias,dreht),neu=jetzt==='neu'?'bull':jetzt==='bull'?'bear':'neu';
  try{pushU();n.bias=zbSicht(neu,dreht);n.up=new Date().toISOString();save();}
  catch(e){alert('The change could not be saved: '+(e&&e.message||e));return;}
  zbNeuZeichnen();
}
function zbBearb(id){_zbEdit=id;_zbFokus=null;zbNeuZeichnen();}
function zbEditTaste(ev,id){
  if(ev.key==='Enter'&&!ev.isComposing){ev.preventDefault();ev.target.blur();}
  else if(ev.key==='Escape'){_zbEdit=null;zbNeuZeichnen();}
}
function zbEditFertig(id,v){
  if(_zbEdit!==id)return;
  _zbEdit=null;
  const n=zbFinde(id);const tx=String(v||'').trim();
  if(n&&tx&&tx!==(n.title||'')){
    try{pushU();n.title=tx;n.body='';n.up=new Date().toISOString();save();}
    catch(e){_zbEdit=id;alert('The change could not be saved: '+(e&&e.message||e)+'\nYour text is still in the field.');return;}
  }
  zbNeuZeichnen();
}
// Loeschen = Papierkorb (30 Tage wiederherstellbar), nie sofort weg.
function zbWeg(id){
  const n=zbFinde(id);if(!n)return;
  if(!confirm('Delete this note? It stays in the trash for 30 days.'))return;
  try{
    pushU();
    trashResNote(n);
    research.notes=resNotes().filter(x=>x.id!==id);
    save();
  }catch(e){alert('The note could not be deleted: '+(e&&e.message||e));return;}
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
      <div class="zb-saeulen zb-a-saeulen">${ZB_SAEULEN.map(x=>zbSaeuleHtml(sym,ccy,x,sel.filter(n=>n.cb.s===x.k),true)).join('')}</div>
    </div>
  </div>`;
}

export {zentralbankKarteHtml,zbNachRender,zbSitzungen,zbNotizen,ZB_SAEULEN};
// Inline-Handler (onclick) brauchen die Funktionen am window.
Object.assign(window,{zbEntwurf,zbFokus,zbFokusWeg,zbWahl,zbTaste,zbNeu,zbBias,zbBearb,zbEditTaste,zbEditFertig,zbWeg,zbQuittieren,zbArchivAuf,zbArchivZeig,zbSitzungen,zbNotizen});
