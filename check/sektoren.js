const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
// ══ WAECHTER: SECTORS-ANSICHT DER MACRO-ZEILE (NUR ANZEIGE) ═══════════════
// Nutzer 2026-11-11: "die Wirtschaft soll in jeden Sektor auseinander
// genommen werden ... jedes Investment ... jede Nachfrage jeden Markt egal ob
// Haus oder yields"; 2026-11-12: "Mach nur anzeigen".
// Geprueft (USD, NZD, GOLD bei 1180 und 390 px):
//   A) Sectors an -> drei Sektor-Karten, je gelieferte Reihe genau eine Zeile,
//      keine Zeile ohne Wert (nie geschaetzt, nie leer)
//   B) Zeile = Wert aus sektor_data.json (Act, Fc, Prev) Zeichen fuer Zeichen,
//      6 Spalten wie die Haupt-Karten
//   C) Reihe mit Haupt-Indikator (ind) zeigt dieselbe Zahl wie ind_data.json
//   D) Tipp auf eine Zeile klappt Quelle + Verlauf auf (wie die Haupt-Karten,
//      Nutzer 2026-11-12); kein Seitenueberlauf
//   F) am PC alle drei Karten gleich hoch ("nach unten erweitern")
//   E) Score unveraendert: Sectors an/aus aendert keinen Bias-Score
// Gegenprobe --gegenprobe: ausgeliefertes main.js laesst eine Reihe weg -> A rot.
const {chromium}=require(PW);
const fs=require('fs'),path=require('path');
const { wartenBisDatenDa } = require('./warten.js');
const PORT=process.env.PORT||8935,GP=process.argv.includes('--gegenprobe');
const ROOT=path.join(__dirname,'..');
(async()=>{
  const SD=JSON.parse(fs.readFileSync(path.join(ROOT,'sektor_data.json'),'utf8'));
  const IND=JSON.parse(fs.readFileSync(path.join(ROOT,'ind_data.json'),'utf8'));
  const F=[];
  // C statisch: Datei gegen ind_data.json
  for(const c in SD.ccy)for(const k in SD.ccy[c]){const w=SD.ccy[c][k];
    if(!w.a)F.push(`A ${c}/${k}: Reihe ohne Wert in sektor_data.json`);
    if(w.ind){const e=IND[c]&&IND[c][w.ind];if(!e||String(e.actual)!==w.a)F.push(`C ${c}/${k}: ${w.a} statt ${e&&e.actual} aus ind_data.json (${w.ind})`);}}
  const b=await chromium.launch();
  for(const [W,H] of [[1180,820],[390,844]]){
    const ctx=await b.newContext({viewport:{width:W,height:H},serviceWorkers:'block'});
    if(GP)await ctx.route(/\/js\/main\.js/,async r=>{const res=await r.fetch();let t=await res.text();t=t.replace("g.reihen.filter(r=>W[r.k]).map","g.reihen.filter(r=>W[r.k]&&r.k!=='unemp').map");r.fulfill({response:res,body:t});});
    const p=await ctx.newPage();const err=[];p.on('pageerror',e=>err.push(e.message));
    await p.addInitScript(()=>{try{localStorage.setItem('fxpro_help_seen','1');localStorage.setItem('fxpro_intro_anim_enabled','0');}catch(e){}});
    await p.goto('http://127.0.0.1:'+PORT+'/index.html');await wartenBisDatenDa(p);
    await p.evaluate(()=>{['lockScreen','introOv'].forEach(x=>{const e=document.getElementById(x);if(e)e.remove();});});
    for(const [id,ccy] of [['USD','USD'],['NZD','NZD'],['GOLD','USD']]){
      const o=`${W}px ${id}`;
      await p.evaluate(id=>{document.querySelectorAll('.ov').forEach(x=>{x.style.display='none';});gotoSym(id);},id);await p.waitForTimeout(700);
      const vor=await p.evaluate(()=>JSON.stringify(getSym().rubrics.map(r=>r.bias)));
      const an=await p.evaluate(()=>{const i=document.querySelector('#detail .sk-rsw input');if(!i)return false;if(!i.checked)i.click();return true;});
      if(!an){F.push(o+' A: kein Sectors-Schalter');continue;}
      await p.waitForTimeout(1500);
      const L=await p.evaluate(()=>({karten:document.querySelectorAll('#detail .sk-card').length,
        zeilen:[...document.querySelectorAll('#detail tr.sk-zeile')].map(r=>({k:r.dataset.sk,a:r.querySelector('.ir-act').textContent.trim(),f:r.querySelector('.ir-fc').textContent.trim(),p:r.querySelector('.ir-prev').textContent.trim(),spalten:r.children.length})),
        hoehen:[...document.querySelectorAll('#detail .sk-card')].map(x=>Math.round(x.getBoundingClientRect().height)),
        ueber:document.documentElement.scrollWidth-innerWidth}));
      const soll=SD.ccy[ccy]||{};
      if(L.karten!==3)F.push(`${o} A: ${L.karten} Sektor-Karten statt 3`);
      if(L.zeilen.length!==Object.keys(soll).length)F.push(`${o} A: ${L.zeilen.length} Zeilen, sektor_data.json liefert ${Object.keys(soll).length}`);
      const ks=new Set();
      for(const z of L.zeilen){
        if(ks.has(z.k))F.push(`${o} A: Zeile ${z.k} doppelt`);ks.add(z.k);
        const w=soll[z.k];if(!w){F.push(`${o} A: Zeile ${z.k} ohne Wert in der Datei`);continue;}
        if(z.a!==w.a)F.push(`${o} B ${z.k}: zeigt ${z.a}, Datei ${w.a}`);
        if(z.f!==(w.f!=null?w.f:'–'))F.push(`${o} B ${z.k}: Prognose ${z.f} vs Datei ${w.f}`);
        if(z.p!==(w.p!=null?w.p:'–'))F.push(`${o} B ${z.k}: Vorwert ${z.p} vs Datei ${w.p}`);
        if(z.spalten!==6)F.push(`${o} A ${z.k}: ${z.spalten} Spalten statt 6 wie die Haupt-Karten`);
      }
      if(L.ueber>1)F.push(`${o} D: Seite laeuft ${L.ueber} px ueber`);
      if(W>=1100&&new Set(L.hoehen).size>1)F.push(`${o} F: Sektor-Karten ungleich hoch (${L.hoehen.join('/')})`);
      // D: Tipp klappt auf wie die Haupt-Karten - Quellenzeile + Chart aus sektor_hist/<CCY>.json
      const k0=L.zeilen.length?L.zeilen[0].k:null;
      await p.evaluate(k=>{const d=document.getElementById('skDetail-'+k);if(d&&d.style.display!=='none')return;   // gleiche Waehrung (GOLD = USD): schon offen
        const r=document.querySelector('#detail tr.sk-zeile[data-sk="'+k+'"]');if(r)r.click();},k0);await p.waitForTimeout(1500);
      const auf=await p.evaluate(k=>{const d=document.getElementById('skDetail-'+k);return{offen:!!d&&d.style.display!=='none',src:!!(d&&d.querySelector('.ind-data-src')),chart:!!(d&&d.querySelector('.ind-hist-holder svg'))};},k0);
      if(!auf.offen||!auf.src||!auf.chart)F.push(`${o} D: Tipp auf ${k0} klappt nicht mit Quelle und Verlauf auf (${JSON.stringify(auf)})`);
      await p.evaluate(()=>{const i=document.querySelector('#detail .sk-rsw input');if(i&&i.checked)i.click();});await p.waitForTimeout(800);
      const nach=await p.evaluate(()=>JSON.stringify(getSym().rubrics.map(r=>r.bias)));
      if(nach!==vor)F.push(`${o} E: Bias der Karten hat sich durch Sectors geaendert`);
    }
    err.forEach(e=>F.push(W+'px JS-Fehler: '+e));
    await ctx.close();
  }
  await b.close();
  if(GP){const ok=F.some(f=>/ A: \d+ Zeilen/.test(f));console.log(ok?'sektoren --gegenprobe: ok (fehlende Zeile gemeldet)':'sektoren --gegenprobe: FEHLER - nicht gemeldet\n  '+F.join('\n  '));process.exit(ok?0:1);}
  if(F.length){console.log('sektoren: '+F.length+' Befund(e)\n  '+F.slice(0,30).join('\n  '));process.exit(1);}
  console.log('sektoren: ok (drei Sektor-Karten, je Reihe eine Zeile = sektor_data.json, Haupt-Indikatoren = ind_data.json, Verlauf per Tipp, Score unveraendert)');
})().catch(e=>{console.log('sektoren: ABBRUCH '+e.message);process.exit(1);});
