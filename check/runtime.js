const PW=process.env.PW_PATH||'/opt/node22/lib/node_modules/playwright';
const URL=process.env.CHECK_URL||'http://127.0.0.1:8935/index.html';
const { chromium } = require(PW);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const seen = new Set();
  const rec = (kind, msg) => {
    const key = kind + '|' + msg;
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({ kind, msg });
  };
  page.on('pageerror', e => rec('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); // ⚠ faireconomy.media erlaubt keine Abfrage aus dem Browser. Der Code
      // rechnet damit: fetchFFPeriod() probiert die Adresse direkt UND ueber
      // drei CORS-Proxys, jeder Weg in try/catch (js/main.js). Die
      // CORS-Meldung schreibt der BROWSER trotzdem in die Konsole, und kein
      // JavaScript kann das unterdruecken. Auf dem Runner (mit echtem Netz)
      // hat sie den Lauf rot gemacht, lokal (ohne Netz) trat sie nie auf -
      // ein roter Lauf fuer ein Verhalten, das so gebaut ist. Deshalb genau
      // DIESE Quelle ausgenommen, nicht CORS allgemein: eine CORS-Meldung
      // von woanders ist weiter ein Fehler.
      const erwartet = /blocked by CORS policy/.test(t) && /faireconomy\.media/.test(t);
      if (!erwartet && !/ERR_TUNNEL|ERR_NAME|Failed to load resource/.test(t)) rec('CONSOLE', t); } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { ['introOv','lockScreen'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); });
  await page.waitForTimeout(800);
  // dismiss any auto-opened modal
  // Fenster sind .ov (openM/closeM) - '.mov' gibt es nicht mehr.
  const fensterZu = () => page.evaluate(() => { document.querySelectorAll('.ov').forEach(m => { if (m.id && getComputedStyle(m).display !== 'none') try { closeM(m.id); } catch(e){ m.style.display = 'none'; } }); });
  await fensterZu();
  await page.waitForTimeout(200);

  // ⚠ Bis 2026-10-16 stand hier eine feste Liste mit veralteten Namen
  // ('matrix','compare','research','setups' gibt es nicht; 'over','mx',
  // 'news','carry','pairs' fehlten) - der Waechter pruefte so nur einen Teil
  // der App. Jetzt die echte Reihenfolge der App.
  const TABS = await page.evaluate(() => TAB_ORDER.slice());
  if (process.argv.includes('--gegenprobe')) await page.evaluate(() => { window.openCardInfo = undefined; });

  // ---- 1. every tab renders ----
  for (const t of TABS) {
    await page.evaluate(tab => { try { showTab(tab); } catch(e) { window.__e = (window.__e||[]).concat(tab+': '+e.message); } }, t);
    await page.waitForTimeout(250);
  }
  const tabErrs = await page.evaluate(() => window.__e || []);
  tabErrs.forEach(e => rec('TAB', e));

  // ---- 2. click every button on every tab ----
  // ⚠ Seit 2026-10-16 Knopf fuer Knopf, wiedergefunden ueber Signatur
  // (onclick + Text) und Vorkommen, mit Rueckkehr zum Tab nach jedem Klick.
  // Vorher klickte EINE Schleife alle Knoepfe: navigierte ein Klick weg,
  // waren alle folgenden vom Dokument getrennt (offsetParent null) und wurden
  // still uebersprungen - die Gegenprobe mit kaputtem openCardInfo blieb gruen.
  const BOESE = 'del|remove|reset|clear|logout|import|wipe|purge|disconnect|unlink|forget|restore|reload|location|download|export|backup';
  const SAMMLE = `((arg)=>{const re=new RegExp(arg.boese,'i');
    const vis=e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;for(let x=e;x;x=x.parentElement){const cs=getComputedStyle(x);if(cs.display==='none'||cs.visibility==='hidden')return false}return true};
    const els=[...document.querySelectorAll('button[onclick],[role=button][onclick]')].filter(e=>!e.closest('.ov')&&vis(e));
    const S=e=>(e.getAttribute('onclick')||'')+'|'+(e.textContent||e.title||'').trim().slice(0,40);
    if(arg.sig){const e=els.filter(x=>S(x)===arg.sig)[arg.occ];if(!e)return false;try{e.click()}catch(x){console.error('CLICKTHROW '+x.message)}return true}
    const cnt={};return els.map(e=>{const sg=S(e);cnt[sg]=cnt[sg]||0;return{sig:sg,occ:cnt[sg]++,bad:re.test(e.getAttribute('onclick')||'')}}).filter(k=>!k.bad)})`;
  let geklickt = 0, nichtGefunden = 0;
  for (const t of TABS) {
    const hin = async () => { await fensterZu(); await page.evaluate(tab => { try { showTab(tab); } catch(e){} }, t); await page.waitForTimeout(200); };
    await hin();
    const ks = await page.evaluate(`${SAMMLE}(${JSON.stringify({ boese: BOESE })})`);
    for (const k of ks) {
      if (await page.evaluate(t => window.curPage !== t, t)) await hin();
      const ok = await page.evaluate(`${SAMMLE}(${JSON.stringify({ boese: BOESE, sig: k.sig, occ: k.occ })})`);
      if (ok) geklickt++; else nichtGefunden++;
      await page.waitForTimeout(60);
      await fensterZu();
    }
  }
  if (geklickt < 300) rec('CLICK', `nur ${geklickt} Knoepfe geklickt - Durchlauf unvollstaendig`);

  // ---- 3. score modals across all symbols/rubrics/pairs ----
  const modalErrs = await page.evaluate(() => {
    const out = [];
    // Nur noch ein Modus (der einfache ist seit 2026-09-24 entfernt).
    for (const mode of ['normalized']) {
      for (const s of syms) {
        try { openScoreInfoSym(s.id); } catch(e) { out.push(mode+' sym '+s.id+': '+e.message); }
        for (const r of (s.rubrics||[])) {
          try { openScoreInfoRub(s.id, r.id); } catch(e) { out.push(mode+' rub '+s.id+'/'+r.name+': '+e.message); }
        }
      }
      for (const p of (typeof ALL_PAIRS!=='undefined'?ALL_PAIRS:[]).slice(0,20)) {
        try { openScoreInfoPair(p); } catch(e) { out.push(mode+' pair '+p+': '+e.message); }
      }
    }
    return out;
  });
  modalErrs.forEach(e => rec('SCOREMODAL', e));

  // ---- 4. asset detail pages ----
  const detailErrs = await page.evaluate(() => {
    const out = [];
    for (const s of syms) {
      try { gotoSym(s.id); } catch(e) { out.push('gotoSym '+s.id+': '+e.message); }
    }
    return out;
  });
  detailErrs.forEach(e => rec('DETAIL', e));
  await page.waitForTimeout(300);

  // ---- 5. data-driven views with every asset selected ----
  const filterErrs = await page.evaluate(() => {
    const out = [];
    const tryIt = (label, fn) => { try { fn(); } catch(e) { out.push(label + ': ' + e.message); } };
    for (const s of syms) {
      tryIt('setSeasAsset '+s.id, () => { setSeasAsset(s.id); });
      tryIt('setDataAsset '+s.id, () => { if (typeof setDataAsset==='function') setDataAsset(s.id); });
      tryIt('setTrendsFilter '+s.id, () => { setTrendsFilter(s.id); renderTrends(); });
    }
    tryIt('setTrendsFilter ALL', () => { setTrendsFilter('ALL'); renderTrends(); });
    tryIt('setTrendsFilter FX', () => { setTrendsFilter('FX'); renderTrends(); });
    return out;
  });
  filterErrs.forEach(e => rec('FILTER', e));

  // ---- 6. undo/redo + save roundtrip ----
  const stateErrs = await page.evaluate(() => {
    const out = [];
    try {
      const before = snap();
      // applySnap() erwartet den STRING, nicht das geparste Objekt
      // (es ruft selbst JSON.parse auf) - fruehere Testfassung uebergab
      // das Objekt und meldete dadurch einen Phantom-Fehler.
      // Der ERSTE Durchlauf darf abweichen: applySnap ruft migrateDash() auf,
      // das bei einem noch nicht migrierten Stand dashV einmalig hochzieht
      // (gemessen 0 -> DASH_V). Gefordert ist Stabilitaet AB dem zweiten Lauf.
      applySnap(before);
      recomputeAuto();
      const once = snap();
      applySnap(once);
      recomputeAuto();
      const after = snap();
      if (once !== after) out.push('snap/applySnap roundtrip is NOT idempotent');
    } catch(e) { out.push('snap roundtrip: ' + e.message); }
    try { doUndo(); doRedo(); } catch(e) { out.push('undo/redo: ' + e.message); }
    return out;
  });
  stateErrs.forEach(e => rec('STATE', e));

  await browser.close();
  if (process.argv.includes('--gegenprobe')) {
    const ok = errors.some(e => /openCardInfo/.test(e.msg));
    console.log(ok ? `runtime --gegenprobe: ok (kaputtes openCardInfo gemeldet, ${errors.length} Befunde)` : 'runtime --gegenprobe: FEHLER - nicht gemeldet');
    process.exit(ok ? 0 : 1);
  }
  console.log(JSON.stringify({ total: errors.length, tabs: TABS.length, geklickt, nichtGefunden, errors }, null, 2));
  process.exit(errors.length ? 1 : 0);
})();
