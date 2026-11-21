// ══ ECONOMY MAP (seit 2026-11-21, 784; Karte seit 787) ══════════════════════════
// Nutzer 2026-11-21 (Auftrag, 784): neue Kategorie, Wirtschaft als Bild, Gruppen mit Firmen, Klick auf
// eine Firma -> Revenue/Earnings/Forecasts/CapEx, links Thesen zum Zuordnen, Platzhalter ohne Quelle.
// Umbau 787: "die komplette wirtschaftliche Lage ... nur mit Unternehmen, die auch Aktien haben ...
// Hauptbereiche am groessten, kleinere im Hintergrund ... simpler Aufbau, Verknuepfungen erkennen, wer
// von wem was kauft ... interaktiv, dass man reinzoomen kann ... Klick auf ein Unternehmen -> das
// Unternehmen und alle Verbindungen hervorgehoben ... zoombare, filterbare Wirtschaftskarte".
//
// Karte: Sektoren = Gebiete (Flaeche nach Stufe: gross/mittel/Hintergrund), darin Gruppen, darin Firmen.
// Semantischer Zoom: Geometrie wird umgerechnet, Schrift bleibt in echter Groesse (design-system C);
// Namen erscheinen erst, wenn sie ganz hineinpassen (nie gekuerzt). Rad-Zoom erst nach einem Klick in
// die Karte (wie die Scroll-Karten, 773), Knoepfe + / - / Fit immer, Ziehen = verschieben, zwei Finger = Zoom.
// Klick auf Firma: Firma + alle belegten Beziehungen hervorgehoben (Linien, Rest blass), Panel mit Typ,
// Datum und Quelle. Filter nach Tags und Beziehungstyp. Katalog: js/wirtschaft-katalog.js.
//
// Thesen: econThesen = {id:{n, s, d:{gruppe:1|-1}, at, t}} bzw. Grabstein {del:1,t}; snap()/applySnap()
// + neueFelderBehalten; Abgleich je These die juengere Aenderung (econVereinen). Alte Gruppen-ids (784)
// werden beim Einlesen umgeschrieben (EC_ALT). Ansicht (Zoom, Auswahl, Filter) = Sitzung.
// Geprueft von check/wirtschaft.js.
import {escH,escJH,pushU,saveSoon,trashAblegen,openM,abInfoBtn,ar,curPage,uid,syms,fmtDayHdr} from './main.js';
import {STOCK_IDS,aktienDaten,aktienDatenHolen} from './aktien.js';
import {EC_ZONEN,EC_GRUPPEN,EC_BEZ,EC_TAGS,EC_TYPEN,EC_ALT} from './wirtschaft-katalog.js';
export {EC_ZONEN,EC_GRUPPEN};

const GR=Object.fromEntries(EC_GRUPPEN.map(g=>[g.id,g])),ZO=Object.fromEntries(EC_ZONEN.map(z=>[z.id,z]));
const FIRMA=new Map();
EC_GRUPPEN.forEach(g=>g.s.forEach(s=>FIRMA.set(s.t,{t:s.t,n:s.n,g:g.id,tags:[...new Set([...(g.tags||[]),...s.tags])]})));
export const EC_FIRMEN_N=FIRMA.size;
const TAGN=Object.fromEntries(EC_TAGS),TYPN=Object.fromEntries(EC_TYPEN);
const TYPF={buys:'#5fd0ff',power:'#F2B84B',invest:'#7DDC8A',partner:'#C9A3FF'};
const bezVon=t=>EC_BEZ.filter(b=>b[0]===t||b[1]===t);
const MIT_BEZ=new Set(EC_BEZ.flatMap(b=>[b[0],b[1]]));

// ── Zustand (Thesen) ──────────────────────────────────────────────────────
export let econThesen={};
const STATUS=[['active','Active'],['watch','Watching'],['draft','Draft']];
const GRAB_TTL=365*864e5;
function thRein(x){
  if(!x||typeof x!=='object')return null;
  if(x.del){const t=+x.t||0;return Date.now()-t>GRAB_TTL?null:{del:1,t};}
  const d={};if(x.d&&typeof x.d==='object'&&!Array.isArray(x.d))Object.keys(x.d).forEach(g0=>{const g=GR[g0]?g0:EC_ALT[g0];if(g&&GR[g]&&(x.d[g0]===1||x.d[g0]===-1))d[g]=x.d[g0];});
  return{n:typeof x.n==='string'?x.n.slice(0,200):'',s:STATUS.some(s=>s[0]===x.s)?x.s:'active',d,at:+x.at||0,t:+x.t||0};
}
export function econRein(v){
  const o={};if(!v||typeof v!=='object'||Array.isArray(v))return o;
  Object.keys(v).forEach(id=>{if(!/^[A-Za-z0-9_-]{1,40}$/.test(id))return;const e=thRein(v[id]);if(e)o[id]=e;});
  return o;
}
export function econSetzeAlle(v){econThesen=econRein(v);}
// Zwei Geraete: je These gewinnt die juengere Aenderung; gleich alt -> Grabstein (Loeschen gewinnt)
export function econVereinen(lokal,fremd){
  const a=econRein(lokal),b=econRein(fremd),o=Object.assign({},a);
  Object.keys(b).forEach(id=>{const x=o[id],y=b[id];if(!x||y.t>x.t||(y.t===x.t&&y.del&&!x.del))o[id]=y;});
  return o;
}
const lebend=()=>Object.keys(econThesen).filter(id=>!econThesen[id].del);
function veraendert(id,fn){const th=econThesen[id];if(!th||th.del)return;fn(th);th.t=Date.now();saveSoon();}

// ── Sitzung ───────────────────────────────────────────────────────────────
let ecTh=null,ecSel=null,ecLink=false,ecFirma=null;
const ecTags=new Set(),ecTypen=new Set(EC_TYPEN.map(x=>x[0]));
const V={k:1,x:0,y:0,W:0,H:0};          // Zoom und Blickpunkt (Welt-Koordinaten oben links, Ursprung = Kern)
let L=null;                              // Layout fuer die aktuelle Buehnengroesse
let aktiv=false;                         // Rad-Zoom erst nach Klick in die Karte

const datum=ms=>{if(!ms)return'';try{return fmtDayHdr(new Date(ms).toISOString().slice(0,10));}catch(e){return'';}};
const tagDatum=s=>{try{return fmtDayHdr(s);}catch(e){return s;}};

// ── Thesen-Leiste ─────────────────────────────────────────────────────────
function impChips(th,max){
  const e=Object.entries(th.d);const zeig=max?e.slice(0,max):e;
  return zeig.map(([g,v])=>`<span class="ec-imp ${v>0?'b':'s'}">${v>0?'+':'−'} ${escH(GR[g].n)}</span>`).join('')+(e.length>zeig.length?`<span class="ec-imp n">+${e.length-zeig.length}</span>`:'');
}
function theseHtml(id){
  const th=econThesen[id],on=ecTh===id,n=Object.keys(th.d).length;
  const st=STATUS.find(s=>s[0]===th.s)||STATUS[0];
  if(!on)return`<div class="ec-th" onclick="ecThWahl('${escJH(id)}')" role="button" tabindex="0">
      <div class="ec-th-n">${th.n.trim()?escH(th.n):'<i>Untitled thesis</i>'}</div>
      <div class="ec-th-m"><span class="ec-st${th.s==='active'?' a':''}">${st[1]}</span><span>${datum(th.at)}</span><span>·</span><span><b>${n}</b> ${n===1?'group':'groups'}</span></div>
      ${n?`<div class="ec-imps">${impChips(th,4)}</div>`:''}</div>`;
  return`<div class="ec-th on">
      <div class="ec-th-kopf"><textarea class="ec-th-in" rows="1" placeholder="Name your thesis" aria-label="Thesis" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()" oninput="ar(this);ecThTitel('${escJH(id)}',this.value)">${escH(th.n)}</textarea>
        <button class="ec-x" onclick="ecThWahl('${escJH(id)}')" title="Close thesis" aria-label="Close thesis"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="ec-sw" role="group" aria-label="Status">${STATUS.map(([k,l])=>`<button class="${th.s===k?'on':''}" onclick="ecThStatus('${escJH(id)}','${k}')" aria-pressed="${th.s===k}">${l}</button>`).join('')}</div>
      <div class="ec-imps">${n?impChips(th):'<span class="ec-leer">No groups linked yet</span>'}</div>
      ${ecLink?`<div class="ec-lk"><div class="ec-lk-t">Linking mode</div><div class="ec-lk-z">Tap a group on the map</div>
        <div class="ec-lk-s"><span class="ec-imp b">+ Bullish</span><span>→</span><span class="ec-imp s">− Bearish</span><span>→</span><span class="ec-imp n">Off</span></div></div>`:''}
      <div class="ec-th-kn"><button class="btn${ecLink?'':' g'} ec-kn" onclick="ecThLink()">${ecLink?'Done linking':'Link groups'}</button><button class="btn g ec-kn ec-del" onclick="ecThLoeschen('${escJH(id)}')">Delete</button></div>
    </div>`;
}
function railHtml(){
  const ids=lebend().sort((a,b)=>{const A=econThesen[a],B=econThesen[b],r=s=>STATUS.findIndex(x=>x[0]===s);return r(A.s)-r(B.s)||B.at-A.at;});
  return`<div class="ec-rail">
    <div class="ec-rail-k"><span class="ec-kt">Theses</span>${abInfoBtn('Theses',['<b>New</b> | name the idea, set a status','<b>Link groups</b> | tap groups on the map: <b>+</b> bullish, <b>−</b> bearish, off','<b>Tap a thesis</b> | the map marks every linked group','Synced across devices · <b>Delete</b> moves it to the trash'])}<span class="ec-sp"></span>
      <button class="btn ec-neu" onclick="ecThNeu()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>New</button></div>
    <div class="ec-th-liste">${ids.length?ids.map(theseHtml).join(''):`<div class="ec-leer-box"><b>No theses yet</b><span>Tap <b>New</b> · then link the groups it hits</span></div>`}</div>
    <div class="ec-leg"><span><i class="lg db"></i>Bullish group</span><span><i class="lg ds"></i>Bearish group</span></div>
  </div>`;
}

// ── Layout: Orbit (Nutzer 2026-11-21: "Ich will das aber als Orbit") ────────────
// Kern in der Mitte; innere Bahn = Stufe 1 (AI, Space, Energy), mittlere = Stufe 2, aeussere = Stufe 3
// (Hintergrund). Je Sektor ein Planet (Groesse nach Stufe), Gruppen als Monde, Firmen als Satelliten.
// Welt-Einheiten; Bahnen so weit, dass sich keine Systeme beruehren.
const PLR={1:34,2:16,3:11};
function layout(W,H){
  const sys=EC_ZONEN.map(z=>{
    const gs=EC_GRUPPEN.filter(g=>g.z===z.id),rP=PLR[z.stufe];
    const monde=gs.map(g=>({g,rc:Math.max(6.5,g.s.length*1.35)}));
    const rcMax=Math.max(...monde.map(m=>m.rc));
    const umfang=monde.reduce((a,m)=>a+2*(m.rc+2.4),0);
    const Rm=Math.max(rP+rcMax+5,umfang/(2*Math.PI));
    return{z,rP,monde,Rm,Rs:Rm+rcMax+5,Rl:Rm+rcMax+17};});   // Rl = mit Platz fuer den Namen
  const ringe=[1,2,3].map(st=>sys.filter(x=>x.z.stufe===st));
  const ex=Math.max(1,Math.min(1.7,W/H));   // Bahnen elliptisch: breite Buehne nutzen
  let innen=26;const PZ=[],G=[],F=new Map();
  ringe.forEach((rg,ri)=>{
    const rsMax=Math.max(...rg.map(x=>x.Rl)),bedarf=rg.reduce((a,x)=>a+2*x.Rl*1.05,0)/(2*Math.PI);
    const R=Math.max(innen+rsMax+4,bedarf);rg._R=R;
    const ges=rg.reduce((a,x)=>a+x.Rl,0);let w=-Math.PI/2+(ri===1?Math.PI/rg.length:0);
    rg.forEach(x=>{const anteil=x.Rl/ges*Math.PI*2;const a=w+anteil/2;w+=anteil;
      x.cx=Math.cos(a)*R*ex;x.cy=Math.sin(a)*R;x.a=Math.atan2(x.cy,x.cx);PZ.push(x);
      // Monde: Startwinkel nach aussen, gleichmaessig nach Platzbedarf verteilt
      const um=x.monde.reduce((s2,m)=>s2+(m.rc+2.4),0);let wm=a;
      x.monde.forEach(m=>{const am=(m.rc+2.4)/um*Math.PI*2;const b=wm+am/2;wm+=am;
        const mx=x.cx+Math.cos(b)*x.Rm,my=x.cy+Math.sin(b)*x.Rm;G.push({g:m.g,x:mx,y:my,rc:m.rc,a:b,z:x});
        const n=m.g.s.length;m.g.s.forEach((s2,k)=>{const c=b+Math.PI+(k+.5)/n*Math.PI*2;F.set(s2.t,{x:mx+Math.cos(c)*m.rc,y:my+Math.sin(c)*m.rc,g:m.g.id});});});});
    innen=R+rsMax;});
  const Rw=innen+6;
  return{W,H,PZ,G,F,Rw,ex,ringe:ringe.map(r=>r._R)};
}

// ── Zeichnen (Bildschirm = (Welt - Blick) * Zoom), Schrift fest, Beschriftung kollisionsfrei ──
const mc=(()=>{try{return document.createElement('canvas').getContext('2d');}catch(e){return null;}})();
const breite=(t,f)=>{if(!mc)return t.length*7;mc.font=f;return mc.measureText(t).width;};
const sx=x=>(x-V.x)*V.k,sy=y=>(y-V.y)*V.k;
function wirkung(){const th=ecTh&&econThesen[ecTh];const o={};if(th&&!th.del)Object.keys(th.d).forEach(g=>{o[g]=th.d[g];});return o;}
function firmaPasst(t){const f=FIRMA.get(t);if(!f)return false;return!ecTags.size||[...ecTags].every(x=>f.tags.includes(x));}
const ZEILEN={'Energy & Power':['Energy &','Power'],'Software & Internet':['Software &','Internet'],'Leisure & Travel':['Leisure &','Travel'],'Business Services':['Business','Services'],'Water & Waste':['Water &','Waste'],'AI & Compute':['AI &','Compute'],'Real Estate':['Real','Estate']};
let _sterne=null;
function zeichnen(){
  const svg=document.getElementById('ecKarte');if(!svg||!L)return;
  const W=V.W,H=V.H,k=V.k,im=wirkung();
  const sel=ecFirma&&FIRMA.get(ecFirma)?ecFirma:null;
  const bez=sel?bezVon(sel).filter(b=>ecTypen.has(b[2])):[];
  const nahe=new Set(bez.flatMap(b=>[b[0],b[1]]));if(sel)nahe.add(sel);
  const filt=ecTags.size>0;
  // belegte Flaechen (Bildschirm): Kreise der Planeten/Monde + gesetzte Beschriftungen
  const belegt=[];const frei=(b,ohneRing)=>b.x0>=2&&b.y0>=2&&b.x1<=W-2&&b.y1<=H-2&&!belegt.some(o=>!(ohneRing&&o.ring)&&b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0);
  const nimm=b=>{belegt.push(b);return b;};
  if(!_sterne||_sterne.W!==W||_sterne.H!==H){let h=7;const rnd=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%10000)/10000;};let st='';for(let i=0;i<Math.round(W*H/5200);i++)st+=`<circle cx="${(rnd()*W).toFixed(0)}" cy="${(rnd()*H).toFixed(0)}" r="${(rnd()*1.1+.2).toFixed(2)}" fill="#fff" opacity="${(rnd()*.5+.12).toFixed(2)}"/>`;_sterne={W,H,st};}
  let o=`<defs><radialGradient id="ecKern"><stop offset="0" stop-color="#5fd0ff" stop-opacity=".5"/><stop offset=".55" stop-color="#2E6FB0" stop-opacity=".2"/><stop offset="1" stop-color="#0B1424" stop-opacity="0"/></radialGradient>
    <filter id="ecGl"><feGaussianBlur stdDeviation="5"/></filter>${Object.entries(TYPF).map(([k2,c])=>`<marker id="ecPf${k2}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4 0 8z" fill="${c}"/></marker>`).join('')}</defs>${_sterne.st}`;
  // Bahnen + Kern
  const cx0=sx(0),cy0=sy(0);
  L.ringe.forEach(R=>{o+=`<ellipse cx="${cx0.toFixed(1)}" cy="${cy0.toFixed(1)}" rx="${(R*k*L.ex).toFixed(1)}" ry="${(R*k).toFixed(1)}" fill="none" stroke="#2A3A5C" stroke-dasharray="2 6"/>`;});
  const rk=Math.max(26,20*k);o+=`<circle cx="${cx0.toFixed(1)}" cy="${cy0.toFixed(1)}" r="${(rk*1.7).toFixed(1)}" fill="url(#ecKern)"/><circle cx="${cx0.toFixed(1)}" cy="${cy0.toFixed(1)}" r="${rk.toFixed(1)}" fill="#0E1E38" stroke="#5fd0ff" stroke-opacity=".6"/>`;
  nimm({x0:cx0-rk,x1:cx0+rk,y0:cy0-rk,y1:cy0+rk});
  if(rk>=40)o+=`<text x="${cx0.toFixed(1)}" y="${(cy0+4).toFixed(1)}" text-anchor="middle" class="ec-kern-t">Economy</text>`;
  // Planeten (Sektoren) und ihre Mond-Bahnen
  L.PZ.forEach(x=>{const px=sx(x.cx),py=sy(x.cy),r=x.rP*k;nimm({x0:px-r,x1:px+r,y0:py-r,y1:py+r});
    o+=`<g class="ec-z" data-z="${x.z.id}"><title>${escH(x.z.n)}</title><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(x.Rm*k).toFixed(1)}" fill="none" stroke="${x.z.c}" stroke-opacity=".3"/>
      <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r+7).toFixed(1)}" fill="${x.z.c}" opacity=".16"/><circle class="ec-pl" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" fill="#0E1E38" stroke="${x.z.c}" stroke-width="${x.z.stufe===1?3:2}"/></g>`;});
  // Monde samt Satellitenkreis als Sperrflaeche, bevor irgendeine Beschriftung gesetzt wird
  L.G.forEach(m=>{const px=sx(m.x),py=sy(m.y),r=Math.max(4,3.3*k,m.rc*k+3),r0=Math.max(4,Math.min(9,3.3*k));nimm({x0:px-r,x1:px+r,y0:py-r,y1:py+r,ring:1});nimm({x0:px-r0,x1:px+r0,y0:py-r0,y1:py+r0});});
  // Sektor-Namen zuerst (hoechster Rang): im Planeten, sonst aussen in Strahlrichtung hinter dem System
  let txt='';
  L.PZ.forEach(x=>{const px=sx(x.cx),py=sy(x.cy),r=x.rP*k,z=x.z,f=z.stufe===1?'800 13px Inter':'800 11.5px Inter',ze=ZEILEN[z.n]||[z.n],w=Math.max(...ze.map(l=>breite(l,f)))+6,h=ze.length*14;
    const ox=Math.cos(x.a),oy=Math.sin(x.a),d=x.Rs*k+8,ax0=px+ox*d,ay0=py+oy*d;
    const dI=Math.max(r+8,x.Rs*k*.55),tx=-oy,ty=ox,dT=x.Rs*k+6;
    const kand=[[px,py-h/2+11,true],[ax0,ay0+(oy<0?-h+11:11)],[px-ox*(x.Rs*k+8),py-oy*(x.Rs*k+8)+(oy>0?-h+11:11)],[px+tx*dT,py+ty*dT+11-h/2],[px-tx*dT,py-ty*dT+11-h/2],
      [px+ox*(d+22),py+oy*(d+22)+(oy<0?-h+11:11)],[px,py+r+14],[px,py-r-6-(h-14)],[px-ox*dI,py-oy*dI+11-h/2]];
    for(const [ax,ay,innen] of kand){const b={x0:ax-w/2,x1:ax+w/2,y0:ay-11,y1:ay-11+h};if(innen?(w<=2*r-6&&h<=2*r-8):frei(b)){if(!innen)nimm(b);
      txt+=`<text x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" text-anchor="middle" class="ec-zn${z.stufe===1?' gross':''}" fill="${innen?'#E6ECF7':z.c}">${ze.map((l,i)=>`<tspan x="${ax.toFixed(1)}" dy="${i?14:0}">${escH(l)}</tspan>`).join('')}</text>`;break;}}});
  // Monde (Gruppen)
  L.G.forEach(m=>{const px=sx(m.x),py=sy(m.y),r=Math.max(4,Math.min(9,3.3*k));
    const v=im[m.g.id],kl=v?(v>0?' im-b':' im-s'):(ecTh?' im-off':'');
    o+=`<g class="ec-g${kl}${ecSel===m.g.id?' sel':''}" data-g="${m.g.id}"><title>${escH(m.g.n)} · ${escH(m.g.was)}</title>${k*m.rc>14?`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(m.rc*k).toFixed(1)}" fill="none" stroke="${m.z.z.c}" stroke-opacity=".22"/>`:''}
      <circle class="ec-gl" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r+6).toFixed(1)}" filter="url(#ecGl)"/><circle class="ec-gr" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(1)}" stroke="${m.z.z.c}"/></g>`;});
  // Firmen (Satelliten) + Positionen fuer Linien
  const pos={},fk=[];
  FIRMA.forEach((f,t)=>{const c=L.F.get(t);if(!c)return;const x=sx(c.x),y=sy(c.y);pos[t]=[x,y];
    const dim=(sel&&!nahe.has(t))||(filt&&!firmaPasst(t)),hell=sel&&nahe.has(t);fk.push({t,f,x,y,dim,hell});});
  // Beziehungen der gewaehlten Firma (zur Mitte gebogen; Pfeil = Ware/Dienst vom Verkaeufer zum Kaeufer)
  bez.forEach(b=>{const [kaeufer,verk,typ]=b;const p=pos[verk],q=pos[kaeufer];if(!p||!q)return;
    const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,kx=mx+(cx0-mx)*.35,ky=my+(cy0-my)*.35,ux=q[0]-kx,uy=q[1]-ky,ul=Math.hypot(ux,uy)||1;
    o+=`<path class="ec-l" d="M${p[0].toFixed(1)},${p[1].toFixed(1)} Q${kx.toFixed(1)},${ky.toFixed(1)} ${(q[0]-ux/ul*9).toFixed(1)},${(q[1]-uy/ul*9).toFixed(1)}" stroke="${TYPF[typ]}" marker-end="url(#ecPf${typ})"><title>${escH(kaeufer+' · '+TYPN[typ]+' · '+verk)}</title></path>`;});
  // Beschriftung in Rangfolge: Sektoren (oben) > gewaehlte Firma + Links > Gruppen > Firmen
  const chip=(e,mitName)=>{const tw=breite(e.t,'800 11px Inter'),nw=mitName?breite(e.f.n,'500 11px Inter'):0,bw=Math.max(tw,nw)+12,bh=mitName?32:18;return{x0:e.x-bw/2,x1:e.x+bw/2,y0:e.y-bh/2,y1:e.y+bh/2,bw,bh};};
  const gesetzt=new Set();
  const verschoben=(c,dx,dy)=>({...c,x0:c.x0+dx,x1:c.x1+dx,y0:c.y0+dy,y1:c.y1+dy,dx,dy});
  const setzeFirma=(e,ausweichen)=>{if(gesetzt.has(e.t))return;const mitName=k>=L.kName&&chip(e,true);let b=null;
    if(mitName&&frei(mitName,1))b=mitName;else{const c=chip(e,false);if(frei(c,1))b=c;
      else if(ausweichen){for(const [dx,dy] of [[0,-20],[0,20],[c.bw/2+6,0],[-c.bw/2-6,0],[c.bw/2+6,-20],[-c.bw/2-6,20],[0,-40],[0,40]]){const v=verschoben(c,dx,dy);if(frei(v,1)){b=v;break;}}}}
    if(!b)return;nimm(b);gesetzt.add(e.t);e.b=b;};
  const wichtig=fk.filter(e=>e.t===sel||e.hell);wichtig.forEach(e=>setzeFirma(e,true));
  L.G.forEach(m=>{if(k<L.kGruppe&&!(ecSel===m.g.id))return;const px=sx(m.x),py=sy(m.y),r=Math.max(4,Math.min(9,3.3*k)),w=breite(m.g.n,'700 11.5px Inter')+4;
    const ox=Math.cos(m.a),oy=Math.sin(m.a),R2=Math.max(r,m.rc*k+3),d=R2+6;const an=Math.abs(ox)<.35?'m':ox>0?'s':'e';
    const kand=[[px+ox*d,py+oy*d+4+(Math.abs(oy)>.8?oy*5:0),an],[px,py+R2+15,'m'],[px,py-R2-6,'m'],[px+R2+5,py+4,'s'],[px-R2-5,py+4,'e'],[px-ox*d,py-oy*d+4,an==='s'?'e':an==='e'?'s':'m']];
    for(const [ax,ay,a] of kand){const x0=a==='m'?ax-w/2:a==='s'?ax:ax-w;const b={x0,x1:x0+w,y0:ay-12,y1:ay+4};if(frei(b)){nimm(b);
      txt+=`<text x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" text-anchor="${a==='m'?'middle':a==='s'?'start':'end'}" class="ec-gn${ecSel===m.g.id?' sel':''}">${escH(m.g.n)}</text>`;break;}}});
  if(k>=L.kFirma)fk.forEach(e=>{if(!e.dim||e.hell)setzeFirma(e,false);});
  // Firmen zeichnen: Kasten mit Ticker (wenn gesetzt) oder Punkt
  fk.forEach(e=>{const kl=`ec-f${e.dim?' dim':''}${e.hell?' hell':''}${sel===e.t?' sel':''}`;
    if(e.b){const b=e.b,mitName=b.bh>18;txt+=`<g class="${kl}" data-t="${escH(e.t)}"><rect x="${b.x0.toFixed(1)}" y="${b.y0.toFixed(1)}" width="${b.bw.toFixed(1)}" height="${b.bh}" rx="5"/>
      ${b.dx||b.dy?`<line x1="${e.x.toFixed(1)}" y1="${e.y.toFixed(1)}" x2="${((b.x0+b.x1)/2).toFixed(1)}" y2="${((b.y0+b.y1)/2).toFixed(1)}" class="ec-fz"/>`:''}<text x="${((b.x0+b.x1)/2).toFixed(1)}" y="${(b.y0+13).toFixed(1)}" text-anchor="middle" class="ec-ft">${escH(e.t)}</text>${mitName?`<text x="${((b.x0+b.x1)/2).toFixed(1)}" y="${(b.y0+27).toFixed(1)}" text-anchor="middle" class="ec-fn">${escH(e.f.n)}</text>`:''}${MIT_BEZ.has(e.t)?`<circle cx="${(b.x1-3).toFixed(1)}" cy="${(b.y0+3).toFixed(1)}" r="3" class="ec-fl"/>`:''}</g>`;}
    else o+=`<g class="${kl}" data-t="${escH(e.t)}"><title>${escH(e.t+' · '+e.f.n)}</title><circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="${Math.max(2.2,Math.min(4.5,k*.9)).toFixed(1)}" class="ec-fd${MIT_BEZ.has(e.t)?' lk':''}"/></g>`;});
  svg.innerHTML=o+txt;
  const zt=document.getElementById('ecZoomT');if(zt)zt.textContent=Math.round(k/L.k0*100)+'%';
}
let _rf=0;const neu=()=>{if(_rf)return;_rf=requestAnimationFrame(()=>{_rf=0;zeichnen();});};

// ── Blick ─────────────────────────────────────────────────────────────────
function begrenzen(){
  V.k=Math.max(L.k0,Math.min(L.k0*45,V.k));
  const vw=V.W/V.k,vh=V.H/V.k,R=L.Rw,RX=L.Rw*L.ex;
  const lo=a=>-R-a*.15,hi=(a)=>R-a*.85;
  V.x=vw>=2*RX?-vw/2:Math.max(-RX-vw*.1,Math.min(RX-vw*.9,V.x));V.y=vh>=2*R?-vh/2:Math.max(-R-vh*.1,Math.min(R-vh*.9,V.y));
}
function fit(){V.k=L.k0;V.x=-V.W/(2*V.k);V.y=-V.H/(2*V.k);}
function zoomUm(f,px,py){const wx=V.x+px/V.k,wy=V.y+py/V.k;V.k*=f;begrenzen();V.x=wx-px/V.k;V.y=wy-py/V.k;begrenzen();neu();}
function zoomAuf(x,y,w,h){V.k=Math.min(V.W/(w*1.12),V.H/(h*1.12));begrenzen();V.x=x+w/2-V.W/V.k/2;V.y=y+h/2-V.H/V.k/2;begrenzen();neu();}
export function ecZoom(a){
  if(a==='fit'){fit();neu();return;}
  zoomUm(a==='in'?1.6:1/1.6,V.W/2,V.H/2);
}
function zoomAufFirmen(ts){
  const r=ts.map(t=>L.F.get(t)).filter(Boolean);if(!r.length)return;
  const x0=Math.min(...r.map(c=>c.x)),y0=Math.min(...r.map(c=>c.y)),x1=Math.max(...r.map(c=>c.x)),y1=Math.max(...r.map(c=>c.y));
  zoomAuf(x0-8,y0-8,Math.max(x1-x0+16,40),Math.max(y1-y0+16,30));
}

// ── Panel rechts ──────────────────────────────────────────────────────────
function panelHtml(){
  const f=ecFirma&&FIRMA.get(ecFirma);
  if(f){
    const g=GR[f.g],z=ZO[g.z],bz=bezVon(f.t);
    return`<div class="ec-p">
      <div class="ec-p-k"><span class="ec-p-tk">${escH(f.t)}</span><div class="ec-p-tw"><div class="ec-p-t">${escH(f.n)}</div><div class="ec-p-z" style="color:${z.c}">${escH(z.n)} › ${escH(g.n)}</div></div></div>
      <div class="ec-p-was">${escH(g.was)}</div>
      ${f.tags.length?`<div class="ec-p-tags">${f.tags.map(x=>`<span>${escH(TAGN[x]||x)}</span>`).join('')}</div>`:''}
      <div class="ec-p-h">Links <span>${bz.length}</span></div>
      ${bz.length?bz.map(b=>{const anderer=b[0]===f.t?b[1]:b[0],o=FIRMA.get(anderer);const rolle=b[2]==='buys'?(b[0]===f.t?'Buys from':'Sells to'):b[2]==='power'?(b[0]===f.t?'Power from':'Power to'):b[2]==='invest'?(b[0]===f.t?'Invests in':'Investor'):'Partner';
        return`<div class="ec-p-b${ecTypen.has(b[2])?'':' aus'}"><div class="ec-p-b1"><span class="ec-p-typ" style="--tc:${TYPF[b[2]]}">${rolle}</span><button class="ec-p-o" onclick="ecFirmaWahl('${escJH(anderer)}')"><b>${escH(anderer)}</b> ${escH(o?o.n:'')}</button></div>
          <div class="ec-p-b2">${escH(b[4])}</div><div class="ec-p-b3"><span>${escH(tagDatum(b[3]))}</span><a href="${escH(b[5])}" target="_blank" rel="noopener noreferrer">Source</a></div></div>`;}).join(''):'<div class="ec-p-l0"><i>No sourced links yet</i></div>'}
      <div class="ec-p-kn"><button class="btn g ec-kn" onclick="ecAktie('${escJH(f.t)}')">Company details</button>${bz.length?`<button class="btn g ec-kn" onclick="ecFirmaZoom()">Zoom to links</button>`:''}</div>
    </div>`;
  }
  const g=GR[ecSel];
  if(g){const z=ZO[g.z],v=wirkung()[g.id];
    return`<div class="ec-p"><div class="ec-p-k"><div class="ec-p-tw"><div class="ec-p-t">${escH(g.n)}</div><div class="ec-p-z" style="color:${z.c}">${escH(z.n)}</div></div></div>
      <div class="ec-p-was">${escH(g.was)}</div>${v?`<div class="ec-p-im ${v>0?'b':'s'}">${v>0?'Bullish':'Bearish'} · thesis</div>`:''}
      <div class="ec-p-h">Companies <span>${g.s.length}</span></div>
      ${g.s.map(s=>`<button class="ec-p-c" onclick="ecFirmaWahl('${escJH(s.t)}')"><b>${escH(s.t)}</b><span>${escH(s.n)}</span>${MIT_BEZ.has(s.t)?'<i>Links</i>':''}</button>`).join('')}</div>`;}
  return`<div class="ec-p ec-p-leer"><div class="ec-p-t">Tap a company</div><div class="ec-p-z">It lights up with every sourced link</div>
    <div class="ec-p-hilfe"><span><b>Drag</b> · move</span><span><b>Wheel / pinch</b> · zoom (click the map first)</span><span><b>Tap a group</b> · zoom in</span><span><b>Dot</b> · company has sourced links</span></div></div>`;
}

// ── Seite ─────────────────────────────────────────────────────────────────
const EC_MIN_W=600,EC_MIN_H=520;
function kopfHtml(){
  const th=ecTh?econThesen[ecTh]:null;
  return`<div class="ec-b-kopf"><span class="ec-kt ec-kt-d">Economy orbit</span>${abInfoBtn('Economy orbit',['<b>Inner orbit</b> | the main sectors: <b>AI & Compute</b>, <b>Space</b>, <b>Energy & Power</b> · middle orbit = 10 sectors · outer orbit = background','<b>Planet</b> = sector · <b>moons</b> = industry groups · <b>satellites</b> = companies (listed only)','<b>Zoom</b> | names appear once they fit','<b>Tap a company</b> | it and every sourced link light up · arrow = goods flow from seller to buyer','<b>Links</b> | type, date and source of each relationship','<b>Tags</b> | filter, e.g. <i>Rate-sensitive</i> or <i>China exposure</i>'],'info-b ec-info')}
    <span class="ec-sp"></span>${th?`<span class="ec-b-th">${th.n.trim()?escH(th.n):'<i>Untitled thesis</i>'}</span>`:''}
    <div class="ec-zoom" role="group" aria-label="Zoom"><button onclick="ecZoom('out')" aria-label="Zoom out">−</button><span id="ecZoomT">100%</span><button onclick="ecZoom('in')" aria-label="Zoom in">+</button><button onclick="ecZoom('fit')" class="ec-fit">Fit</button></div></div>
    <div class="ec-filter"><span class="ec-fl-l">Tags</span>${EC_TAGS.map(([k,l])=>`<button class="ec-chip${ecTags.has(k)?' on':''}" onclick="ecTagFilter('${k}')" aria-pressed="${ecTags.has(k)}">${escH(l)}</button>`).join('')}
      <span class="ec-fl-l">Links</span>${EC_TYPEN.map(([k,l])=>`<button class="ec-chip ty${ecTypen.has(k)?' on':''}" style="--tc:${TYPF[k]}" onclick="ecTypFilter('${k}')" aria-pressed="${ecTypen.has(k)}"><i></i>${escH(l)}</button>`).join('')}</div>`;
}
export function renderEcon(){
  const body=document.getElementById('econBody');if(!body)return;
  if(ecTh&&(!econThesen[ecTh]||econThesen[ecTh].del)){ecTh=null;ecLink=false;}
  const fokus=document.activeElement&&document.activeElement.classList.contains('ec-th-in');
  body.innerHTML=`<div class="ec-raster">${railHtml()}
    <div class="ec-buehne">${kopfHtml()}<div class="ec-b-in"><div class="ec-orbit" id="ecOrbit"><svg class="ec-svg" id="ecKarte" role="img" aria-label="Economy orbit"></svg></div><div id="ecPanel">${panelHtml()}</div></div></div></div>`;
  const ob=document.getElementById('ecOrbit'),pg=document.getElementById('pgEcon');
  const einspaltig=getComputedStyle(ob.parentElement).gridTemplateColumns.trim().split(/\s+/).length===1;
  const W=Math.max(EC_MIN_W,Math.floor(ob.clientWidth));
  // ⚠ Seiten-Zoom (PC, --pg-zoom): Rects messen Bildschirm-Pixel, style.height setzt Seiten-Pixel
  const z=pg?(parseFloat(getComputedStyle(pg).zoom)||1):1;
  const frei=Math.floor((innerHeight-ob.getBoundingClientRect().top)/z+(pg?pg.scrollTop:0)-18);
  const H=einspaltig?Math.round(Math.min(760,Math.max(EC_MIN_H,W*.72))):Math.max(EC_MIN_H,frei);ob.style.height=H+'px';
  const svg=document.getElementById('ecKarte');svg.setAttribute('width',W);svg.setAttribute('height',H);svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  if(!L||L.W!==W||L.H!==H){const alt=L?{k:V.k/L.k0,cx:V.x+V.W/V.k/2,cy:V.y+V.H/V.k/2}:null;L=layout(W,H);V.W=W;V.H=H;
    L.k0=Math.min(W/(2*L.Rw*L.ex),H/(2*L.Rw))/1.02;L.kGruppe=L.k0*1.7;L.kFirma=L.k0*2.4;L.kName=L.k0*5.5;
    if(alt){V.k=L.k0*alt.k;V.x=alt.cx-W/V.k/2;V.y=alt.cy-H/V.k/2;begrenzen();}else fit();}
  zeichnen();
  if(W>ob.clientWidth+2&&!ob._mitte){ob.scrollLeft=Math.round((W-ob.clientWidth)/2);ob._mitte=1;}
  bedienung(svg);
  if(fokus||body._fokusNeu){const t=body.querySelector('.ec-th-in');if(t){t.focus();const n=t.value.length;try{t.setSelectionRange(n,n);}catch(e){}ar(t);}body._fokusNeu=false;}
  else{const t=body.querySelector('.ec-th-in');if(t)ar(t);}
  beobachten();
}
function panelNeu(){const p=document.getElementById('ecPanel');if(p)p.innerHTML=panelHtml();}

// ── Bedienung: Ziehen, Rad (nach Klick), zwei Finger, Tippen ──────────────────
function bedienung(svg){
  const zeiger=new Map();let start=null,bewegt=false,pinch=null;
  const lokal=e=>{const r=svg.getBoundingClientRect(),zz=r.width/V.W||1;return[(e.clientX-r.left)/zz,(e.clientY-r.top)/zz];};
  svg.addEventListener('pointerdown',e=>{aktiv=true;svg.classList.add('aktiv');zeiger.set(e.pointerId,lokal(e));try{svg.setPointerCapture(e.pointerId);}catch(x){}
    if(zeiger.size===1){start={p:lokal(e),x:V.x,y:V.y,ziel:e.target};bewegt=false;}
    else if(zeiger.size===2){const [a,b]=[...zeiger.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),k:V.k,m:[(a[0]+b[0])/2,(a[1]+b[1])/2]};bewegt=true;}});
  svg.addEventListener('pointermove',e=>{if(!zeiger.has(e.pointerId))return;zeiger.set(e.pointerId,lokal(e));
    if(pinch&&zeiger.size===2){const [a,b]=[...zeiger.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);const f=(pinch.k*d/pinch.d)/V.k;zoomUm(f,pinch.m[0],pinch.m[1]);return;}
    if(start&&zeiger.size===1){const p=lokal(e),dx=p[0]-start.p[0],dy=p[1]-start.p[1];if(Math.hypot(dx,dy)>5)bewegt=true;if(bewegt){V.x=start.x-dx/V.k;V.y=start.y-dy/V.k;begrenzen();neu();}}});
  const ende=e=>{zeiger.delete(e.pointerId);if(zeiger.size<2)pinch=null;
    if(zeiger.size===0){if(start&&!bewegt)tippen(start.ziel);start=null;}};
  svg.addEventListener('pointerup',ende);svg.addEventListener('pointercancel',e=>{zeiger.delete(e.pointerId);start=null;pinch=null;});
  svg.addEventListener('wheel',e=>{if(!aktiv&&!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const p=lokal(e);zoomUm(Math.exp(-e.deltaY*.0016),p[0],p[1]);},{passive:false});
  svg.addEventListener('dblclick',e=>{const p=lokal(e);zoomUm(1.8,p[0],p[1]);});
}
// Klick daneben sperrt den Rad-Zoom wieder (die Seite scrollt)
if(typeof document!=='undefined')document.addEventListener('pointerdown',e=>{if(aktiv&&!(e.target&&e.target.closest&&e.target.closest('#ecKarte'))){aktiv=false;const s=document.getElementById('ecKarte');if(s)s.classList.remove('aktiv');}},true);
function tippen(ziel){
  const el=ziel&&ziel.closest?ziel:null;if(!el)return;
  const ft=el.closest('[data-t]'),gg=el.closest('[data-g]'),zz=el.closest('[data-z]');
  if(ft){ecFirmaWahl(ft.getAttribute('data-t'));return;}
  if(gg){ecGruppe(gg.getAttribute('data-g'));return;}
  if(zz){const r=L.PZ.find(x=>x.z.id===zz.getAttribute('data-z'));if(r)zoomAuf(r.cx-r.Rs,r.cy-r.Rs,2*r.Rs,2*r.Rs);return;}
  if(ecFirma){ecFirma=null;neu();panelNeu();}
}
// Groessenaenderung -> Neubau (Diagramme in echter Groesse)
let _ro=null,_roB=0,_roT=0;
function beobachten(){
  const ob=document.getElementById('ecOrbit');if(!ob||typeof ResizeObserver==='undefined')return;
  if(_ro&&_ro._el===ob)return;if(_ro)_ro.disconnect();
  _roB=Math.round(ob.clientWidth);
  _ro=new ResizeObserver(()=>{const w=Math.round(ob.clientWidth);if(Math.abs(w-_roB)<8||curPage!=='econ')return;_roB=w;clearTimeout(_roT);_roT=setTimeout(()=>{if(curPage==='econ'&&!document.querySelector('.ec-th-in:focus'))renderEcon();},120);});
  _ro._el=ob;_ro.observe(ob);
}

// ── Bedienung: Auswahl, Filter, Thesen ─────────────────────────────────────
export function ecFirmaWahl(t){if(!FIRMA.has(t))return;ecFirma=ecFirma===t?null:t;if(ecFirma)ecSel=FIRMA.get(t).g;neu();panelNeu();}
export function ecFirmaZoom(){if(!ecFirma)return;zoomAufFirmen([ecFirma,...bezVon(ecFirma).filter(b=>ecTypen.has(b[2])).flatMap(b=>[b[0],b[1]])]);}
export function ecTagFilter(k){if(!TAGN[k])return;if(ecTags.has(k))ecTags.delete(k);else ecTags.add(k);renderEcon();}
export function ecTypFilter(k){if(!TYPN[k])return;if(ecTypen.has(k))ecTypen.delete(k);else ecTypen.add(k);renderEcon();}
export function ecGruppe(gid){
  if(!GR[gid])return;
  if(ecLink&&ecTh&&econThesen[ecTh]&&!econThesen[ecTh].del){
    pushU();veraendert(ecTh,th=>{const v=th.d[gid];if(v===1)th.d[gid]=-1;else if(v===-1)delete th.d[gid];else th.d[gid]=1;});
    ecSel=gid;renderEcon();return;
  }
  ecSel=gid;ecFirma=null;const r=L&&L.G.find(x=>x.g.id===gid);if(r&&V.k<L.kName)zoomAuf(r.x-r.rc-6,r.y-r.rc-6,2*r.rc+12,2*r.rc+12);else neu();panelNeu();
}
export function ecThNeu(){
  pushU();const id=uid()+uid().slice(0,3),now=Date.now();
  econThesen[id]={n:'',s:'active',d:{},at:now,t:now};ecTh=id;ecLink=false;saveSoon();
  const b=document.getElementById('econBody');if(b)b._fokusNeu=true;renderEcon();
}
export function ecThWahl(id){if(!econThesen[id]||econThesen[id].del)return;ecTh=ecTh===id?null:id;ecLink=false;renderEcon();}
export function ecThTitel(id,v){
  veraendert(id,th=>{th.n=String(v||'').slice(0,200);});
  const k=document.querySelector('.ec-b-th');if(k)k.innerHTML=String(v||'').trim()?escH(v):'<i>Untitled thesis</i>';
}
export function ecThStatus(id,s){if(!STATUS.some(x=>x[0]===s))return;pushU();veraendert(id,th=>{th.s=s;});renderEcon();}
export function ecThLink(){if(!ecTh)return;ecLink=!ecLink;renderEcon();}
export function ecThLoeschen(id){
  const th=econThesen[id];if(!th||th.del)return;
  if(!confirm(`Delete "${th.n.trim()||'Untitled thesis'}"? It moves to the trash.`))return;
  pushU();trashAblegen('econth',{id,e:JSON.parse(JSON.stringify(th))});
  econThesen[id]={del:1,t:Date.now()};if(ecTh===id){ecTh=null;ecLink=false;}saveSoon();renderEcon();
}
// aus dem Papierkorb (restoreTrashItem)
export function ecThZurueck(d){
  if(!d||!d.id||!d.e)return;const e=thRein(d.e);if(!e||e.del)return;
  econThesen[d.id]=Object.assign(e,{t:Date.now()});saveSoon();if(curPage==='econ')renderEcon();
}
export function ecThLabel(d){return'Thesis · '+(((d&&d.e&&d.e.n)||'').trim()||'Untitled thesis').slice(0,80);}

// ── Firmenfenster ────────────────────────────────────────────────────────
const geld=v=>{if(v==null||!isFinite(v))return'–';const a=Math.abs(v),s=v<0?'−':'';return s+(a>=1e12?(a/1e12).toFixed(2)+'T':a>=1e9?(a/1e9).toFixed(1)+'B':a>=1e6?(a/1e6).toFixed(0)+'M':a.toFixed(0));};
function platz(titel,was){return`<div class="ec-pz"><div class="ec-pz-t">${titel}</div><div class="ec-pz-z"><i>${was}</i></div></div>`;}
// Umsatz + Gewinn je Quartal (SEC, stock_data.json) in echter Breite, mit y-Achse
function umsatzChart(q,W){
  const H=150,pl=44,pr=6,pt=8,pb=20,n=q.length;
  const werte=q.flatMap(x=>[x[1]||0,x[2]||0]);const mx=Math.max(...werte,0),mn=Math.min(...werte,0);
  const roh=(mx-mn)/3||1,p10=Math.pow(10,Math.floor(Math.log10(roh))),schritt=[1,2,2.5,5,10].map(f=>f*p10).find(s=>s>=roh)||roh;
  const lo=Math.floor(mn/schritt)*schritt,hi=Math.ceil(mx/schritt)*schritt||schritt;
  const y=v=>pt+(H-pt-pb)*(1-(v-lo)/(hi-lo)),bw=(W-pl-pr)/n;
  let s=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="ec-ch">`;
  for(let t=lo;t<=hi+1e-6;t+=schritt)s+=`<line x1="${pl}" x2="${W-pr}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" class="ec-gl"/><text x="${pl-6}" y="${(y(t)+4).toFixed(1)}" text-anchor="end" class="ec-ax">${geld(t)}</text>`;
  q.forEach((x,i)=>{const x0=pl+i*bw;const u=x[1]||0,g=x[2]||0;
    s+=`<rect x="${(x0+bw*.12).toFixed(1)}" y="${y(Math.max(u,0)).toFixed(1)}" width="${(bw*.36).toFixed(1)}" height="${Math.max(1,Math.abs(y(u)-y(0))).toFixed(1)}" class="ec-r"><title>${escH(x[0])} revenue ${geld(u)}</title></rect>`
      +`<rect x="${(x0+bw*.52).toFixed(1)}" y="${y(Math.max(g,0)).toFixed(1)}" width="${(bw*.36).toFixed(1)}" height="${Math.max(1,Math.abs(y(g)-y(0))).toFixed(1)}" fill="var(${g>=0?'--bias-bull':'--bias-bear'})"><title>${escH(x[0])} net income ${geld(g)}</title></rect>`
      +(i%2?'':`<text x="${(x0+bw/2).toFixed(1)}" y="${H-5}" text-anchor="middle" class="ec-ax">${escH(String(x[0]).slice(2,7).replace('-','/'))}</text>`);});
  return s+'</svg>';
}
export function ecAktie(t){
  const f=FIRMA.get(t);if(!f)return;const g=GR[f.g],z=ZO[g.z],echt=STOCK_IDS.includes(t);
  if(echt&&!aktienDaten())aktienDatenHolen();
  const ths=lebend().map(id=>econThesen[id]).filter(th=>th.d[g.id]);
  const bz=bezVon(t);
  const tt=document.getElementById('mEconFirmaT');if(tt)tt.innerHTML=`<span class="ec-f-tk">${escH(t)}</span>${escH(f.n)}`;
  const b=document.getElementById('mEconFirmaB');if(!b)return;
  b.innerHTML=`<div class="ec-f">
    <div class="ec-f-g"><span class="ec-f-gr" style="color:${z.c}"><span>${escH(z.n)} › ${escH(g.n)}</span></span>${f.tags.map(x=>`<span class="ec-f-gr"><span>${escH(TAGN[x]||x)}</span></span>`).join('')}</div>
    <div class="ec-f-sek"><div class="ec-f-t">What it does</div><div class="ec-pz-z">${escH(g.was)}</div></div>
    <div class="ec-f-sek" id="ecFUms"></div>
    ${platz('Analyst forecasts','Revenue and EPS estimates · source not connected yet')}
    ${platz('CapEx','Quarterly capital spending + share of revenue · source not connected yet')}
    ${platz('Where the money goes','Spending focus from earnings calls and filings · source not connected yet')}
    <div class="ec-f-sek"><div class="ec-f-t">Links <span>${bz.length}</span></div>
      ${bz.length?bz.map(x=>{const a=x[0]===t?x[1]:x[0];return`<div class="ec-f-th"><span class="ec-imp n">${escH(TYPN[x[2]])}</span><span><b>${escH(a)}</b> ${escH(x[4])} · <i>${escH(tagDatum(x[3]))}</i> · <a href="${escH(x[5])}" target="_blank" rel="noopener noreferrer">Source</a></span></div>`;}).join(''):'<div class="ec-pz-z"><i>No sourced links yet</i></div>'}</div>
    <div class="ec-f-sek"><div class="ec-f-t">Linked theses <span>${ths.length}</span></div>
      ${ths.length?ths.map(th=>`<div class="ec-f-th"><span class="ec-imp ${th.d[g.id]>0?'b':'s'}">${th.d[g.id]>0?'Bullish':'Bearish'}</span><span>${th.n.trim()?escH(th.n):'<i>Untitled thesis</i>'}</span></div>`).join(''):'<div class="ec-pz-z"><i>No thesis touches this group yet</i></div>'}</div>
  </div>`;
  const kn=document.getElementById('mEconFirmaK');
  if(kn)kn.innerHTML=(echt&&(syms||[]).some(s=>s.id===t)?`<button class="btn g" onclick="closeM('mEconFirma');gotoSym('${escJH(t)}')">Open asset page</button>`:'')+`<button class="btn g" onclick="closeM('mEconFirma')">Done</button>`;
  openM('mEconFirma');
  ecUmsatzFuellen(t);
}
function ecUmsatzFuellen(t){
  const el=document.getElementById('ecFUms');if(!el)return;
  const titel='<div class="ec-f-t">Revenue &amp; net income <span>quarterly · SEC filings</span></div>';
  if(!STOCK_IDS.includes(t)){el.outerHTML=platz('Revenue &amp; net income','Quarterly figures for this company · source not connected yet');return;}
  const st=aktienDaten(),s=st&&st.stocks&&st.stocks[t],q=s&&Array.isArray(s.quartale)?s.quartale.filter(x=>x&&x[1]!=null):[];
  if(!st){el.innerHTML=titel+'<div class="ec-pz-z"><i>Loading company data …</i></div>';setTimeout(()=>{if(document.getElementById('ecFUms'))ecUmsatzFuellen(t);},800);return;}
  if(q.length<2){el.innerHTML=titel+'<div class="ec-pz-z"><i>No quarterly history yet</i></div>';return;}
  const W=Math.max(200,Math.floor(el.clientWidth||400));
  el.innerHTML=titel+`<div class="ec-f-lg"><span><i class="ec-lg-r"></i>Revenue</span><span><i style="background:var(--bias-bull)"></i>Net income</span><span><i style="background:var(--bias-bear)"></i>Net loss</span></div>`+umsatzChart(q.slice(-12),W);
}
