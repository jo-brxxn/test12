const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: SURPRISE-SPALTE DER STRENGTH MATRIX HAT WERTE ═══════════════
// 2026-11-10 (Bestandsaufnahme): die Spalte stand bei allen 8 Waehrungen auf
// 0. surpriseIndex() zaehlte calEvts mit Actual der letzten 30 Tage - der
// Kalender-Feed reicht aber nur 2 Tage zurueck (gemessen: 1 Termin mit
// Actual). Jetzt aus der Feed-Historie (pkReleases, wie die Release-Pfeile).
//   A) mindestens 6 von 8 Waehrungen haben bewertete Releases (n > 0)
//   B) |net| <= n, und die Zelle der Tabelle zeigt genau net/n
// Gegenprobe --gegenprobe: Uhr 400 Tage vorgestellt (kein Release im Fenster) -> rot.
const {chromium}=require(PW);
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
(async()=>{
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:900}});
  await p.addInitScript((gp)=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}
    if(gp){const D=Date,off=400*864e5;const N=class extends D{constructor(...a){if(a.length)super(...a);else super(D.now()+off);}static now(){return D.now()+off;}};window.Date=N;}},GP);
  await p.goto('http://127.0.0.1:'+PORT+'/index.html',{waitUntil:'networkidle'});
  await p.evaluate(()=>{const l=document.getElementById('lockScreen');if(l)l.remove();document.querySelectorAll('.ov').forEach(o=>o.style.display='none');});
  if(!GP)await wartenBisDatenDa(p);else await p.waitForTimeout(4000);
  await p.evaluate(()=>showTab('mx'));await p.waitForTimeout(1500);
  const r=await p.evaluate(()=>{const C=['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'],o={};C.forEach(c=>{o[c]=surpriseIndex(c);});
    const txt=(document.getElementById('pageArea').innerText||'').replace(/\s+/g,' ');return{o,txt};});
  await b.close();
  const F=[],C=Object.keys(r.o),mit=C.filter(c=>r.o[c].n>0);
  if(mit.length<6)F.push(`A LEER: nur ${mit.length} von 8 Waehrungen mit bewerteten Releases (${C.map(c=>c+' '+r.o[c].n).join(', ')})`);
  C.forEach(c=>{const {net,n}=r.o[c];if(Math.abs(net)>n)F.push(`B ${c}: |net| ${net} > n ${n}`);
    if(n>0){const soll=(net>0?'+':net<0?'-':'')+Math.abs(net)+'/'+n;if(!r.txt.replace(/−/g,'-').includes(soll))F.push(`B ZELLE: ${c} zeigt nicht ${soll}`);}});
  if(GP){const ok=F.some(f=>f.startsWith('A LEER'));console.log(ok?'surprise --gegenprobe: ok (kein Release im Fenster = gemeldet)':'surprise --gegenprobe: FEHLER - nicht gemeldet\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('surprise: '+F.length+' Befund(e)\n  '+F.join('\n  '));process.exit(1);}
  console.log('surprise: ok ('+C.map(c=>c+' '+(r.o[c].net>0?'+':'')+r.o[c].net+'/'+r.o[c].n).join(', ')+')');
})();
