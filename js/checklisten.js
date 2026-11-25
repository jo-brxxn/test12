'use strict';
// ══ CHECKLISTS (Nutzer 2026-11-25, VERSION-CHECK-822) ═════════════════════════
// Nutzer: "eine Neue Kategorie, die irgendwie Lists oder so heisst. Dort will ich verschiedene Listen
// haben. Die ich aufklappen kann, wo dann schoen designt Fragen drin stehen, die ich auch hinzufuegen kann
// ... mehrere Fragen in einen Ordner zu packen ... mein ganzes Wissen ... mehr zu einer Routine zu machen,
// sodass ich bei wichtigen Sachen nicht manche Sachen vergesse. Zum Beispiel, wenn eine Bank einen
// Zinsentscheid hat ... wie viele Leute ueberhaupt dafuer gestimmt haben und was vielleicht andere Leute
// wollten ... Oder eine Liste fuer eine Entry, dass ich da nicht vergesse, auf Inflation ... zu gucken.
// Bitte leg wieder Fokus auf Design."
// Per Rueckfrage: Name "Checklists"; KEINE Kriterien - "mach die Frage wie eine Art Stichpunkt also man
// kann die Frage formulieren aber wie unten drunter noch mehr erklaeren und ausweiten"; NUR LESEN (kein
// Abhaken); Aufbau "Karten zum Aufklappen".
//
// SPEICHERUNG (Regel 1, docs/state-sync.md): checklisten = {listeId:{id,name,c,o,t,del?,
//   f:{ordnerId:{id,name,o,t,del?}}, q:{frageId:{id,fid,ti,tx,o,t,del?}}}} im snap(). Abgleich je Liste
// (Kopf: Name/Farbe/Reihenfolge/Loeschen - neuerer Stempel gewinnt), je Ordner und je Frage einzeln.
// Geloeschtes bleibt als Marker {del} (sonst kaeme es vom anderen Geraet zurueck), der Inhalt liegt
// 30 Tage im Papierkorb. Auf- und Zugeklappt ist nur Sitzung (wie andere Ansichtswahlen).

let H = null;
export function chkHelfer(h) { H = h; }
export let checklisten = {};

// ── Daten ────────────────────────────────────────────────────────────────────
export const CHK_FARBEN = [['rate', 'var(--a-rate)'], ['lab', 'var(--a-lab)'], ['infl', 'var(--a-infl)'], ['grow', 'var(--a-grow)'], ['cot', 'var(--a-cot)']];
const farbe = k => (CHK_FARBEN.find(x => x[0] === k) || CHK_FARBEN[0])[1];
const txt = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const zeit = v => isFinite(+v) && +v > 0 ? +v : 0;
const zahl = v => isFinite(+v) ? +v : 0;
const idOk = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
function ordnerRein(f) {
  if (!f || !idOk(f.id)) return null;
  if (f.del) return { id: f.id, del: zeit(f.del) || 1, t: zeit(f.t) };
  return { id: f.id, name: txt(f.name, 80) || 'Untitled folder', o: zahl(f.o), t: zeit(f.t) };
}
function frageRein(q) {
  if (!q || !idOk(q.id)) return null;
  if (q.del) return { id: q.id, del: zeit(q.del) || 1, t: zeit(q.t) };
  return { id: q.id, fid: idOk(q.fid) ? q.fid : null, ti: txt(q.ti, 200), tx: txt(q.tx, 4000), o: zahl(q.o), t: zeit(q.t) };
}
function listeRein(l) {
  if (!l || !idOk(l.id)) return null;
  const r = { id: l.id, t: zeit(l.t), f: {}, q: {} };
  if (l.del) { r.del = zeit(l.del) || 1; return r; }
  r.name = txt(l.name, 80) || 'Untitled list';
  r.c = CHK_FARBEN.some(x => x[0] === l.c) ? l.c : CHK_FARBEN[0][0];
  r.o = zahl(l.o);
  Object.values(l.f && typeof l.f === 'object' ? l.f : {}).forEach(f => { const x = ordnerRein(f); if (x) r.f[x.id] = x; });
  Object.values(l.q && typeof l.q === 'object' ? l.q : {}).forEach(q => { const x = frageRein(q); if (x) r.q[x.id] = x; });
  return r;
}
export function chkRein(v) {
  const o = {};
  if (v && typeof v === 'object') Object.values(v).forEach(x => { const r = listeRein(x); if (r) o[r.id] = r; });
  return o;
}
export function chkSetzeAlle(v) { checklisten = chkRein(v); }
// Zwei Geraete: je Liste/Ordner/Frage gewinnt der neuere Stempel; gleich alt -> Loeschen gewinnt.
const juenger = (x, y) => !x ? y : !y ? x : ((y.t || 0) > (x.t || 0) || ((y.t || 0) === (x.t || 0) && y.del && !x.del)) ? y : x;
export function chkVereinen(lokal, fremd) {
  const a = chkRein(lokal), b = chkRein(fremd), o = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(id => {
    const x = a[id], y = b[id];
    if (!x || !y) { o[id] = x || y; return; }
    const kopf = juenger(x, y);
    if (kopf.del) { o[id] = { id, del: kopf.del, t: kopf.t, f: {}, q: {} }; return; }
    const r = Object.assign({}, kopf, { f: {}, q: {} });
    new Set([...Object.keys(x.f || {}), ...Object.keys(y.f || {})]).forEach(k => { r.f[k] = juenger((x.f || {})[k], (y.f || {})[k]); });
    new Set([...Object.keys(x.q || {}), ...Object.keys(y.q || {})]).forEach(k => { r.q[k] = juenger((x.q || {})[k], (y.q || {})[k]); });
    o[id] = r;
  });
  return o;
}
const neuId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const listen = () => Object.values(checklisten).filter(l => !l.del).sort((a, b) => a.o - b.o || a.t - b.t);
const ordnerVon = l => Object.values(l.f || {}).filter(f => !f.del).sort((a, b) => a.o - b.o || a.t - b.t);
const fragenVon = (l, fid) => Object.values(l.q || {}).filter(q => !q.del && (fid === undefined || (q.fid || null) === fid)).sort((a, b) => a.o - b.o || a.t - b.t);
const naechsteO = arr => arr.reduce((m, x) => Math.max(m, x.o || 0), 0) + 1;
function schreiben(fn) {
  try { H.pushU(); fn(); H.save(); }
  catch (e) { alert('Could not save: ' + (e && e.message || e)); }
  renderChecklisten();
}

// ── Seite ────────────────────────────────────────────────────────────────────
const _auf = new Set(), _zu = new Set();     // aufgeklappte Listen, zugeklappte Ordner (nur Sitzung)
// Erklaerung: jede Zeile ein Stichpunkt (Regel 10 - kein Fliesstext); fuehrende "-", "•", "*" fallen weg.
function punkteHtml(tx) {
  const z = String(tx || '').split(/\n+/).map(s => s.replace(/^\s*[-•*·]\s*/, '').trim()).filter(Boolean);
  if (!z.length) return '';
  return `<ul class="chk-pk">${z.map(s => `<li>${H.escH(s)}</li>`).join('')}</ul>`;
}
function frageHtml(l, q, nr, liste) {
  const e = H.escH, i = liste.indexOf(q), id = H.escJH(q.id), lid = H.escJH(l.id);
  return `<div class="chk-q">
    <span class="chk-nr" aria-hidden="true">${nr}</span>
    <button type="button" class="chk-q-x" onclick="chkFrageAuf('${lid}','${id}')" title="Edit question">
      <b>${e(q.ti || 'Untitled question')}</b>${punkteHtml(q.tx)}
    </button>
    <span class="chk-mv">
      <button type="button" onclick="chkVerschieben('${lid}','${id}',-1)" ${i > 0 ? '' : 'disabled'} aria-label="Move up" title="Move up">${H.icn('chevronUp', 14)}</button>
      <button type="button" onclick="chkVerschieben('${lid}','${id}',1)" ${i < liste.length - 1 ? '' : 'disabled'} aria-label="Move down" title="Move down">${H.icn('chevronDown', 14)}</button>
    </span>
  </div>`;
}
function karteHtml(l) {
  const e = H.escH, lid = H.escJH(l.id), auf = _auf.has(l.id), ord = ordnerVon(l), alle = fragenVon(l), lose = fragenVon(l, null);
  const sub = `${ord.length ? `${ord.length} folder${ord.length === 1 ? '' : 's'} · ` : ''}<b>${alle.length}</b> question${alle.length === 1 ? '' : 's'}`;
  const kopf = `<div class="ab-tile-hd chk-hd" onclick="chkAufZu('${lid}')" role="button" tabindex="0" aria-expanded="${auf}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();chkAufZu('${lid}');}">
      <span class="chk-ic" aria-hidden="true">${H.icn('clipboard', 16)}</span><span class="chk-tt"><span class="ab-tile-t">${e(l.name)}</span>
      <span class="chk-sub">${sub}</span></span><span class="chk-info" onclick="event.stopPropagation()">${H.abInfoBtn(l.name, ['<b>Tap the header</b> | open or close the list', '<b>Question</b> | title = the question, lines below = what to check', '<b>Folders</b> | group questions · tap the folder name to fold it', '<b>▲ ▼</b> | change the order · <b>tap a question</b> to edit it'])}</span><span class="chk-pfeil${auf ? ' auf' : ''}" aria-hidden="true">${H.icn('chevronDown', 18)}</span></div>`;
  if (!auf) {
    // Vorschau in derselben Reihenfolge wie aufgeklappt: erst Fragen ohne Ordner, dann je Ordner
    const reihe = lose.concat(...ord.map(f => fragenVon(l, f.id))), vor = reihe.slice(0, 3);
    return `<div class="ab-tile chk-karte" style="--lc:${farbe(l.c)}">${kopf}
      ${vor.length ? `<ul class="chk-vor">${vor.map(q => `<li>${e(q.ti || 'Untitled question')}</li>`).join('')}${alle.length > 3 ? `<li class="chk-mehr">+ ${alle.length - 3} more</li>` : ''}</ul>` : '<div class="chk-leer"><i>No questions yet</i></div>'}
    </div>`;
  }
  let nr = 0;
  const block = (fragen) => fragen.map(q => frageHtml(l, q, ++nr, fragen)).join('');
  const ordnerHtml = ord.map(f => {
    const fid = H.escJH(f.id), fr = fragenVon(l, f.id), zu = _zu.has(f.id);
    const start = nr; const inhalt = zu ? (nr += fr.length, '') : block(fr);
    return `<section class="chk-f${zu ? ' zu' : ''}">
      <div class="chk-f-hd">
        <button type="button" class="chk-f-t" onclick="chkOrdnerAufZu('${fid}')" aria-expanded="${!zu}">${H.icn('chevronDown', 14)}<span>${e(f.name)}</span><em>${fr.length}</em></button>
        <span class="chk-f-akt"><button type="button" onclick="chkFrageNeu('${lid}','${fid}')" title="Add question to this folder">${H.icn('plus', 14)}<span>Question</span></button><button type="button" onclick="chkOrdnerName('${lid}','${fid}')" aria-label="Rename folder" title="Rename folder">${H.icn('edit', 14)}</button><button type="button" onclick="chkOrdnerLoeschen('${lid}','${fid}')" aria-label="Delete folder" title="Delete folder">${H.icn('trash', 14)}</button></span>
      </div>
      ${zu ? '' : (inhalt || `<div class="chk-leer"><i>Empty folder · tap ＋ Question</i></div>`)}
    </section>`;
  }).join('');
  const loseHtml = block(lose);
  return `<div class="ab-tile chk-karte auf" style="--lc:${farbe(l.c)}">${kopf}
    <div class="chk-akt">
      <button type="button" class="btn g" onclick="chkFrageNeu('${lid}',null)">${H.icn('plus', 14)}<span>Question</span></button>
      <button type="button" class="btn" onclick="chkOrdnerNeu('${lid}')">${H.icn('folder', 14)}<span>Folder</span></button>
      <span class="chk-akt-r"><button type="button" class="btn" onclick="chkListeAuf('${lid}')">${H.icn('edit', 14)}<span>Edit list</span></button><button type="button" class="btn" onclick="chkListeLoeschen('${lid}')">${H.icn('trash', 14)}<span>Delete</span></button></span>
    </div>
    ${loseHtml ? `<div class="chk-lose">${loseHtml}</div>` : ''}${ordnerHtml}
    ${!alle.length && !ord.length ? '<div class="chk-leer"><i>Add the first question — the title is the question, the lines below explain it</i></div>' : ''}
  </div>`;
}
export function renderChecklisten() {
  const el = document.getElementById('chkBody'); if (!el) return;
  const l = listen();
  const kopf = `<div class="chk-leiste"><button type="button" class="btn g" onclick="chkListeAuf(null)">${H.icn('plus', 14)}<span>New list</span></button></div>`;
  if (!l.length) {
    el.innerHTML = `<div class="ab-tile chk-start">
      <div class="ab-tile-hd"><span class="ab-tile-t">Start your first checklist</span>${H.abInfoBtn('Checklists', ['<b>Lists</b> | one routine each — e.g. rate decision, entry', '<b>Questions</b> | the question plus the points underneath', '<b>Folders</b> | group questions inside a list', '<b>Templates</b> | start from an example and change it'])}</div>
      <ul class="chk-pk"><li><b>Routines</b> for the moments that matter — a rate decision, an entry</li><li><b>Questions</b> with the points you must not forget underneath</li><li><b>Folders</b> group questions inside a list</li></ul>
      <div class="chk-vorlagen">
        <button type="button" class="chk-vl" onclick="chkVorlage('zins')" style="--lc:${farbe('rate')}"><b>Rate decision</b><span>vote split · dissenters · guidance · pricing</span></button>
        <button type="button" class="chk-vl" onclick="chkVorlage('entry')" style="--lc:${farbe('grow')}"><b>Entry check</b><span>inflation · labour · events · positioning</span></button>
        <button type="button" class="chk-vl leer" onclick="chkListeAuf(null)"><b>Blank list</b><span>start from scratch</span></button>
      </div></div>`;
    return;
  }
  el.innerHTML = kopf + `<div class="chk-grid">${l.map(karteHtml).join('')}</div>`;
}
export function chkAufZu(id) { if (_auf.has(id)) _auf.delete(id); else _auf.add(id); renderChecklisten(); }
export function chkOrdnerAufZu(fid) { if (_zu.has(fid)) _zu.delete(fid); else _zu.add(fid); renderChecklisten(); }

// ── Vorlagen (nur auf Knopfdruck; Inhalt = die Beispiele des Nutzers) ─────────
const VORLAGEN = {
  zins: { name: 'Rate decision', c: 'rate', f: [
    ['Decision', [
      ['How was the vote split?', 'Count the votes for the decision\nWho dissented — and what did they want: hike, cut, size\nMore or less dissent than at the last meeting'],
      ['Did the statement or guidance change?', 'New wording on inflation and the labour market\nForward guidance: data dependent, more moves, a pause'],
    ]],
    ['Market', [
      ['What was priced in before?', 'Rate probabilities before the meeting\nSurprise against pricing = the real move'],
      ['How did the currency and the 2Y yield react?', 'First move after the decision\nMove after the press conference'],
    ]],
  ] },
  entry: { name: 'Entry check', c: 'grow', q: [
    ['Does inflation support the bias?', 'Latest CPI against forecast and trend\nCore and services inflation'],
    ['Are labour market and growth in line?', 'Employment, wages, PMIs'],
    ['High-impact events before the planned exit?', 'Calendar for the next 48 hours'],
    ['Is positioning crowded?', 'COT and retail extremes'],
    ['Is the gameplan written?', 'Entry, break and invalidation'],
  ] },
};
export function chkVorlage(k) {
  const v = VORLAGEN[k]; if (!v) return;
  schreiben(() => {
    const t = Date.now(), id = neuId('cl'), l = { id, name: v.name, c: v.c, o: naechsteO(listen()), t, f: {}, q: {} };
    let o = 0;
    (v.f || []).forEach(([fn, qs], fi) => { const fid = neuId('cf'); l.f[fid] = { id: fid, name: fn, o: fi + 1, t }; qs.forEach(([ti, tx]) => { const q = neuId('cq'); l.q[q] = { id: q, fid, ti, tx, o: ++o, t }; }); });
    (v.q || []).forEach(([ti, tx]) => { const q = neuId('cq'); l.q[q] = { id: q, fid: null, ti, tx, o: ++o, t }; });
    checklisten[id] = l; _auf.add(id);
  });
}

// ── Liste: anlegen / bearbeiten (Name + Farbe) ───────────────────────────────
let _liste = null, _lfarbe = CHK_FARBEN[0][0];
export function chkListeAuf(id) {
  const l = id && checklisten[id];
  _liste = l ? id : null; _lfarbe = l ? l.c : CHK_FARBEN[listen().length % CHK_FARBEN.length][0];
  document.getElementById('chkLTitel').textContent = l ? 'Edit list' : 'New list';
  document.getElementById('chkLName').value = l ? l.name : '';
  farbenZeichnen();
  H.openM('mChkListe'); H.guardArm('mChkListe');
  setTimeout(() => { try { document.getElementById('chkLName').focus(); } catch (e) { } }, 60);
}
function farbenZeichnen() {
  const w = document.getElementById('chkLFarben'); if (!w) return;
  w.innerHTML = CHK_FARBEN.map(([k, v]) => `<button type="button" class="chk-fb${k === _lfarbe ? ' on' : ''}" style="--lc:${v}" onclick="chkListeFarbe('${k}')" aria-pressed="${k === _lfarbe}" aria-label="Colour ${k}"></button>`).join('');
}
export function chkListeFarbe(k) { _lfarbe = k; farbenZeichnen(); }
export function chkListeZustand() { return _lfarbe; }
export function chkListeSpeichern() {
  const name = document.getElementById('chkLName').value.trim();
  if (!name) { document.getElementById('chkLName').focus(); return; }
  schreiben(() => {
    const t = Date.now();
    if (_liste && checklisten[_liste]) Object.assign(checklisten[_liste], { name: name.slice(0, 80), c: _lfarbe, t });
    else { const id = neuId('cl'); checklisten[id] = { id, name: name.slice(0, 80), c: _lfarbe, o: naechsteO(listen()), t, f: {}, q: {} }; _auf.add(id); }
  });
  H.closeM('mChkListe');
}
export function chkListeLoeschen(id) {
  const l = checklisten[id]; if (!l || l.del) return;
  if (!confirm(`Delete the list "${l.name}" with all its questions? It moves to the trash.`)) return;
  schreiben(() => { H.trashAblegen('chkl', { id, e: JSON.parse(JSON.stringify(l)) }); checklisten[id] = { id, del: Date.now(), t: Date.now(), f: {}, q: {} }; _auf.delete(id); });
}

// ── Ordner ───────────────────────────────────────────────────────────────────
let _ordner = null;   // {lid, fid|null}
export function chkOrdnerNeu(lid) { _ordner = { lid, fid: null }; ordnerFenster('New folder', ''); }
export function chkOrdnerName(lid, fid) { const f = checklisten[lid] && checklisten[lid].f[fid]; if (!f) return; _ordner = { lid, fid }; ordnerFenster('Rename folder', f.name); }
function ordnerFenster(titel, wert) {
  document.getElementById('chkOTitel').textContent = titel;
  const i = document.getElementById('chkOName'); i.value = wert;
  H.openM('mChkOrdner'); H.guardArm('mChkOrdner'); setTimeout(() => { try { i.focus(); } catch (e) { } }, 60);
}
export function chkOrdnerSpeichern() {
  const name = document.getElementById('chkOName').value.trim(), z = _ordner;
  if (!name) { document.getElementById('chkOName').focus(); return; }
  const l = z && checklisten[z.lid]; if (!l) { H.closeM('mChkOrdner'); return; }
  schreiben(() => {
    const t = Date.now();
    if (z.fid && l.f[z.fid]) Object.assign(l.f[z.fid], { name: name.slice(0, 80), t });
    else { const fid = neuId('cf'); l.f[fid] = { id: fid, name: name.slice(0, 80), o: naechsteO(ordnerVon(l)), t }; }
  });
  H.closeM('mChkOrdner');
}
export function chkOrdnerLoeschen(lid, fid) {
  const l = checklisten[lid], f = l && l.f[fid]; if (!f || f.del) return;
  const fr = fragenVon(l, fid);
  if (!confirm(`Delete the folder "${f.name}"${fr.length ? ` and its ${fr.length} question${fr.length === 1 ? '' : 's'}` : ''}? It moves to the trash.`)) return;
  schreiben(() => {
    const t = Date.now();
    H.trashAblegen('chkf', { lid, f: JSON.parse(JSON.stringify(f)), q: JSON.parse(JSON.stringify(fr)), ln: l.name });
    l.f[fid] = { id: fid, del: t, t }; fr.forEach(q => { l.q[q.id] = { id: q.id, del: t, t }; });
  });
}

// ── Frage ────────────────────────────────────────────────────────────────────
let _frage = null;   // {lid, qid|null}
export function chkFrageNeu(lid, fid) { _frage = { lid, qid: null }; frageFenster(checklisten[lid], { ti: '', tx: '', fid: fid || null }); }
export function chkFrageAuf(lid, qid) { const l = checklisten[lid], q = l && l.q[qid]; if (!q) return; _frage = { lid, qid }; frageFenster(l, q); }
function frageFenster(l, q) {
  if (!l) return;
  document.getElementById('chkQTitel').textContent = _frage.qid ? 'Edit question' : 'New question';
  document.getElementById('chkQTi').value = q.ti || '';
  document.getElementById('chkQTx').value = q.tx || '';
  const s = document.getElementById('chkQOrd');
  s.innerHTML = `<option value="">No folder</option>` + ordnerVon(l).map(f => `<option value="${H.escH(f.id)}"${f.id === q.fid ? ' selected' : ''}>${H.escH(f.name)}</option>`).join('');
  s.value = q.fid || '';
  document.getElementById('chkQDel').hidden = !_frage.qid;
  H.openM('mChkFrage'); H.guardArm('mChkFrage');
  setTimeout(() => { try { document.getElementById('chkQTi').focus(); } catch (e) { } }, 60);
}
export function chkFrageZustand() { return (document.getElementById('chkQOrd') || {}).value || ''; }
export function chkFrageSpeichern() {
  const ti = document.getElementById('chkQTi').value.trim(), tx = document.getElementById('chkQTx').value.replace(/\s+$/, '');
  const fid = document.getElementById('chkQOrd').value || null, z = _frage;
  if (!ti) { document.getElementById('chkQTi').focus(); return; }
  const l = z && checklisten[z.lid]; if (!l) { H.closeM('mChkFrage'); return; }
  schreiben(() => {
    const t = Date.now();
    if (z.qid && l.q[z.qid]) {
      const q = l.q[z.qid], wechsel = (q.fid || null) !== fid;
      Object.assign(q, { ti: ti.slice(0, 200), tx: tx.slice(0, 4000), fid, t });
      if (wechsel) q.o = naechsteO(fragenVon(l, fid).filter(x => x.id !== q.id));
    } else { const id = neuId('cq'); l.q[id] = { id, fid, ti: ti.slice(0, 200), tx: tx.slice(0, 4000), o: naechsteO(fragenVon(l, fid)), t }; }
    if (fid) _zu.delete(fid);
  });
  H.closeM('mChkFrage');
}
export function chkFrageLoeschen() {
  const z = _frage, l = z && checklisten[z.lid], q = l && l.q[z.qid]; if (!q || q.del) return;
  if (!confirm(`Delete the question "${q.ti}"? It moves to the trash.`)) return;
  schreiben(() => { H.trashAblegen('chkq', { lid: z.lid, q: JSON.parse(JSON.stringify(q)), ln: l.name }); l.q[q.id] = { id: q.id, del: Date.now(), t: Date.now() }; });
  H.closeM('mChkFrage');
}
export function chkVerschieben(lid, qid, r) {
  const l = checklisten[lid], q = l && l.q[qid]; if (!q) return;
  const nb = fragenVon(l, q.fid || null), i = nb.findIndex(x => x.id === qid), j = i + r;
  if (i < 0 || j < 0 || j >= nb.length) return;
  schreiben(() => {
    const t = Date.now();
    nb.forEach((x, k) => { x.o = k + 1; x.t = t; });   // zuerst lueckenlos durchnummerieren
    const a = nb[i], b = nb[j], oa = a.o; a.o = b.o; b.o = oa;
  });
}

// ── Papierkorb ───────────────────────────────────────────────────────────────
export function chkLabel(kind, d) {
  if (kind === 'chkl') return 'Checklist · ' + ((d && d.e && d.e.name) || 'Untitled list');
  if (kind === 'chkf') return 'Checklist folder · ' + ((d && d.f && d.f.name) || 'Untitled folder') + (d && d.ln ? ' (' + d.ln + ')' : '');
  return 'Checklist question · ' + ((d && d.q && d.q.ti) || 'Untitled question') + (d && d.ln ? ' (' + d.ln + ')' : '');
}
export function chkZurueck(kind, d) {
  const t = Date.now();
  if (kind === 'chkl') { const l = listeRein(d && d.e); if (!l || l.del) return; l.t = t; checklisten[l.id] = l; }
  else {
    const l = d && checklisten[d.lid];
    if (!l || l.del) { alert('The list of this item no longer exists — restore the list first.'); return; }
    if (kind === 'chkf') { const f = ordnerRein(d.f); if (f && !f.del) { f.t = t; l.f[f.id] = f; } (d.q || []).forEach(x => { const q = frageRein(x); if (q && !q.del) { q.t = t; l.q[q.id] = q; } }); }
    else { const q = frageRein(d.q); if (!q || q.del) return; if (q.fid && !(l.f[q.fid] && !l.f[q.fid].del)) q.fid = null; q.t = t; l.q[q.id] = q; }
  }
  H.save(); if (H.curPage() === 'chk') renderChecklisten();
}

export const CHK_WINDOW = { chkAufZu, chkOrdnerAufZu, chkVorlage, chkListeAuf, chkListeFarbe, chkListeSpeichern, chkListeLoeschen, chkOrdnerNeu, chkOrdnerName, chkOrdnerSpeichern, chkOrdnerLoeschen, chkFrageNeu, chkFrageAuf, chkFrageSpeichern, chkFrageLoeschen, chkVerschieben };
Object.assign(window, { chkAufZu, chkOrdnerAufZu, chkVorlage, chkListeAuf, chkListeFarbe, chkListeSpeichern, chkListeLoeschen, chkOrdnerNeu, chkOrdnerName, chkOrdnerSpeichern, chkOrdnerLoeschen, chkFrageNeu, chkFrageAuf, chkFrageSpeichern, chkFrageLoeschen, chkVerschieben });
