// ── NOTIZEN UEBERLEBEN ALLES ──────────────────────────────────────
// Seit 2026-11-17 (VERSION-CHECK-755) nur noch Pinned notes + History (entpinnt), Bank- und
// Chart-Notizen; Archiv, Ordner, Beispielnotizen und Quick capture entfernt (Nutzer-Wunsch).
// Notiz-Datenverlust ist in diesem Projekt DREIMAL beim Nutzer angekommen
// (2026-09-01 Klick neben den Editor, 2026-09-01 Papierkorb nachgeruestet,
// 2026-09-08 der Fall hier). Notizen sind der einzige Inhalt der App, den
// niemand wiederherstellen kann - Kurse, Indikatoren und Scores kommen aus
// dem Feed zurueck, ein selbst geschriebener Gedanke nicht. Deshalb ein
// eigener Waechter statt einer Zeile in einem anderen.
//
// ⚠ Der Anlass (Nutzer 2026-09-08): "Ausserdem loeschen sich immer noch
// automatisch Notizen, die in mehreren Ordnern gleichzeitig gespeichert
// sind." Reproduziert und gemessen:
//   • SAFE_UID_RE war /^[a-z0-9]{1,24}$/i - OHNE Unterstrich.
//   • Die mitgelieferten Verhaltensnotizen heissen "sd_USD_macro_bull_0",
//     1440 von 1545 Ids fielen also durch den Filter.
//   • Bearbeitet der Nutzer so eine Notiz, BEHAELT sie ihre Id.
//   • Bei jedem applySnap (Cloud-Sync, Undo, Backup, Import) warf der Filter
//     sie still weg, seedAssetBehaviorNotes legte sie mit ORIGINALTEXT neu an.
//   Nach EINEM Umlauf: eigener Text weg, wieder als "mitgeliefert" markiert,
//   zweiter Ordner weg, nichts im Papierkorb.
const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
const URL=process.env.CHECK_URL||'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);
const { wartenBisDatenDa } = require('./warten.js');
(async()=>{
 const b=await chromium.launch();
 const p=await b.newPage({viewport:{width:1500,height:1000}});
 await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');}catch(e){}});
 const perr=[];p.on('pageerror',e=>perr.push(String(e)));
 await p.goto(URL,{waitUntil:'networkidle'});
 await p.evaluate(()=>{['introOv','lockScreen'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});});
 await wartenBisDatenDa(p);
 const r=await p.evaluate(()=>{
  const F=[],ok={};const add=(t,d)=>F.push(Object.assign({t},d));

  // ── 1) Jede Id, die die App SELBST erzeugt, muss den Sicherheitsfilter
  // passieren. Ein Filter, der eigene Daten aussortiert, ist kein Schutz,
  // sondern ein Loeschwerkzeug.
  const RE=(typeof SAFE_UID_RE!=='undefined')?SAFE_UID_RE:/^[A-Za-z0-9_-]{1,64}$/;
  const schlecht=research.notes.filter(n=>!(n&&typeof n.id==='string'&&RE.test(n.id)));
  ok.notizen=research.notes.length;
  ok.idsAbgelehnt=schlecht.length;
  if(schlecht.length)add('Notiz-Id faellt durch den eigenen Sicherheitsfilter',
    {anzahl:schlecht.length,beispiele:schlecht.slice(0,3).map(n=>n.id)});
  const schlechteOrdner=researchFolders.filter(f=>!(f&&typeof f.id==='string'&&RE.test(f.id)));
  if(schlechteOrdner.length)add('Ordner-Id faellt durch den eigenen Sicherheitsfilter',
    {anzahl:schlechteOrdner.length,beispiele:schlechteOrdner.slice(0,3).map(f=>f.id)});

  // ── 2) SEIT 755 NUR NOCH PINNED NOTES (Archiv, Ordner, Beispielnotizen entfernt) ──
  // Eine eigene Pinned note mit eigenem Text muss jeden Sync (applySnap) ueberleben,
  // entpinnt in der History bleiben, eine Notiz ohne Pin/History in den Papierkorb gehen
  // (mit Loesch-Marker) und von dort als Pinned note zurueckkommen.
  const jetzt=new Date().toISOString();
  const neuN=(id,x)=>Object.assign({id,fids:[],title:'WAECHTER '+id,body:'WAECHTER: dieser Text darf einen Sync NIE verlieren.',tags:[],fav:false,pin:true,arch:false,ts:jetzt,up:jetzt,bias:'bull',evt:null,asset:'USD'},x||{});
  research.notes.push(neuN('wnp1'),neuN('wnh1'),neuN('wna1',{pin:false}));
  togResPin('wnh1');                       // entpinnen -> History
  applySnap(snap());
  const p1=research.notes.find(n=>n.id==='wnp1'),h1=research.notes.find(n=>n.id==='wnh1'),a1=research.notes.find(n=>n.id==='wna1');
  ok.roundtrip={pinned:!!p1,history:!!h1};
  if(!p1)add('Pinned note ueberlebt den Sync nicht',{});
  else if(!p1.pin||String(p1.body).indexOf('WAECHTER:')<0||p1.asset!=='USD')add('Pinned note nach dem Sync veraendert',{pin:p1.pin,asset:p1.asset});
  if(!h1)add('Entpinnte Notiz (History) nach dem Sync weg',{});
  else if(h1.pin||!h1.hist)add('History-Eintrag nach dem Sync nicht mehr in der History',{pin:h1.pin,hist:h1.hist});
  if(typeof pinHist==='function'&&!pinHist('USD').some(n=>n.id==='wnh1'))add('History der Pinned notes zeigt die entpinnte Notiz nicht',{});
  if(a1)add('Notiz ohne Pin/History steht nach dem Sync noch da (Archiv-Rest)',{});
  const t1=(research.trash||[]).find(t=>t.data&&t.data.id==='wna1');
  if(!t1)add('Notiz ohne Pin/History nicht im Papierkorb',{});
  if(!(research.geloescht||{})['n:wna1'])add('Kein Loesch-Marker fuer die abgeraeumte Notiz',{});
  if((researchFolders||[]).length)add('Es gibt noch Ordner',{anzahl:researchFolders.length});
  if(research.notes.some(n=>n&&n.seed))add('Beispielnotizen werden noch erzeugt',{});
  if(t1){
    restoreTrashItem(t1.id);
    applySnap(snap());
    const z=research.notes.find(n=>n.id==='wna1');
    if(!z)add('Wiederhergestellte Notiz nach dem Sync wieder weg',{});
    else if(!z.pin)add('Wiederhergestellte Notiz ist keine Pinned note',{});
    ok.wiederhergestellt=!!z;
  }
  // aufraeumen
  ['wnp1','wnh1','wna1'].forEach(id=>{const n=research.notes.find(x=>x.id===id);if(n){trashResNote(n);research.notes=research.notes.filter(x=>x.id!==id);}});
  ok.pinUndArchiv=research.notes.filter(n=>n&&n.pin&&n.arch).length;
  return {fehler:F.length,F:F.slice(0,20),ok};
 });
 console.log('pageerrors',perr.length,perr.slice(0,2));
 console.log(JSON.stringify(r,null,1));
 await b.close();
})();
