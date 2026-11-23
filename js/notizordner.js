'use strict';
// ══ NOTES: ORDNER MIT MINDMAP (Nutzer 2026-11-23, VERSION-CHECK-813) ══════════
// Nutzer: "die pinned Notes Karte ... nur noch Notes ... auf diese Karte klicken ... Fenster ... einen
// Ordner erstellen ... links wie bei der Preis Karte eine Leiste wo ein Button fuer create new folder ist
// und dadrunter die ganzen Ordner ... rechts davon ca 2 Drittel ... Mindmap ... Anfangs ist dort nur der
// Ordner Name in der Mitte, oben rechts ... Knopf ... Stichpunkt hinzufuegen ... Titel und Inhalt ... Der
// Titel ist immer komplett lesbar. Der Inhalt wird ... abgekuerzt ... Bias ... an einen komplett neuen Ast
// ... oder einen Ast von einer bestehenden Notiz".
// Per Rueckfrage: Entwurf B (Baum von links nach rechts, Spalten je Ebene, rechtwinklige Linien), beliebig
// viele Ordner je Asset, Ordner mit anderen Assets TEILEN = derselbe Ordner bei mehreren Assets, bisherige
// Pinned notes bleiben vorerst und lassen sich EINMALIG einsortieren (werden zum Punkt und verlassen Pinned),
// Karte zeigt die Ordnerliste, Tipp auf einen Punkt = Bearbeiten, KEIN Verschieben per Ziehen.
//
// SPEICHERUNG (Regel 1, docs/state-sync.md): notizOrdner = {ordnerId:{id,name,assets[],t,del?,p:{punktId:
// {id,par,ti,tx,b,t,del?}}}} im snap(). Abgleich je Ordner (Name/Assets/Loeschen: neuerer Stempel gewinnt)
// und je Punkt (neuerer Stempel gewinnt) - Geloeschtes bleibt als Marker {del}, sonst kaeme es vom anderen
// Geraet zurueck (check/geloescht.js-Prinzip).

let H = null;
const escJH = v => H.escJH(v);
export function ordnerHelfer(h) { H = h; }
export let notizOrdner = {};

// ── Daten ────────────────────────────────────────────────────────────────────
const txt = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const zeit = v => isFinite(+v) && +v > 0 ? +v : 0;
const biasOk = b => b === 'bull' || b === 'bear' ? b : 'neu';
const idOk = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
function punktRein(p) {
  if (!p || !idOk(p.id)) return null;
  if (p.del) return { id: p.id, del: zeit(p.del) || 1, t: zeit(p.t) };
  return { id: p.id, par: idOk(p.par) ? p.par : null, ti: txt(p.ti, 120), tx: txt(p.tx, 4000), b: biasOk(p.b), t: zeit(p.t) };
}
function ordnerRein(o) {
  if (!o || !idOk(o.id)) return null;
  const r = { id: o.id, t: zeit(o.t), p: {} };
  if (o.del) { r.del = zeit(o.del) || 1; return r; }
  r.name = txt(o.name, 80) || 'Untitled folder';
  r.assets = Array.isArray(o.assets) ? [...new Set(o.assets.filter(a => typeof a === 'string' && /^[A-Z0-9._-]{1,15}$/.test(a)))] : [];
  Object.values(o.p && typeof o.p === 'object' ? o.p : {}).forEach(p => { const q = punktRein(p); if (q) r.p[q.id] = q; });
  return r;
}
export function noRein(v) {
  const o = {};
  if (v && typeof v === 'object') Object.values(v).forEach(x => { const r = ordnerRein(x); if (r) o[r.id] = r; });
  return o;
}
export function noSetzeAlle(v) { notizOrdner = noRein(v); }
export function noVereinen(lokal, fremd) {
  const a = noRein(lokal), b = noRein(fremd), o = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(id => {
    const x = a[id], y = b[id];
    if (!x || !y) { o[id] = x || y; return; }
    const kopf = (y.t || 0) >= (x.t || 0) ? y : x;
    const r = Object.assign({}, kopf, { p: {} });
    if (r.del) { o[id] = { id, del: r.del, t: r.t, p: {} }; return; }
    new Set([...Object.keys(x.p), ...Object.keys(y.p)]).forEach(pid => {
      const px = x.p[pid], py = y.p[pid];
      r.p[pid] = !px ? py : !py ? px : ((py.t || 0) >= (px.t || 0) ? py : px);
    });
    o[id] = r;
  });
  return o;
}
const neuId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ordnerVon = asset => Object.values(notizOrdner).filter(o => !o.del && (o.assets || []).includes(asset))
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));
const punkte = o => Object.values(o.p || {}).filter(p => !p.del).sort((a, b) => (a.t0 || a.t) - (b.t0 || b.t) || a.id.localeCompare(b.id));
function schreiben(fn) {
  try { H.pushU(); fn(); H.save(); }
  catch (e) { alert('Could not save: ' + (e && e.message || e)); }
  zeichnen();
}

// ── Karte "Notes" auf der Asset-Seite ───────────────────────────────────────
const biasFarbe = b => b === 'bull' ? H.BC.bull : b === 'bear' ? H.BC.bear : H.BC.neu;
function biasBalken(o) {
  const l = punkte(o), n = l.length || 1, z = k => l.filter(p => p.b === k).length;
  if (!l.length) return '<span class="no-bb no-bb-leer"></span>';
  return `<span class="no-bb">${['bear', 'bull', 'neu'].map(k => z(k) ? `<i style="width:${(z(k) / n * 100).toFixed(1)}%;background:${biasFarbe(k)}"></i>` : '').join('')}</span>`;
}
export function ordnerKarteHtml(c, pinnedZeilen, pinnedAnzahl) {
  const e = H.escH, l = ordnerVon(c.id);
  const zeilen = l.map(o => `<button type="button" class="no-kz" onclick="ordnerAuf('${escJH(c.id)}','${escJH(o.id)}')" title="Open ${e(o.name)}">
      <span class="no-kz-n">${e(o.name)}${(o.assets || []).length > 1 ? `<i>shared · ${o.assets.length} assets</i>` : ''}</span>${biasBalken(o)}<span class="no-kz-c">${punkte(o).length}</span></button>`).join('');
  return `<div class="ab-ntile ab-auf no-karte" onclick="abKarteAuf(event,()=>ordnerAuf('${escJH(c.id)}'))" title="Open notes">
    <div class="ab-tile-hd">${H.abTileIcon()}<span class="ab-tile-t">Notes</span><span class="ab-tile-s">${l.length}</span>${H.abInfoBtn('Notes', ['Folders with a mind map for this asset. Tap the card to open them.', 'A folder can be shared with other assets: it then shows on each of them, and changes appear everywhere.', 'Pinned notes from before stay below until you sort them into a folder.'])}</div>
    <div class="no-kl">${zeilen || `<div class="ab-nt-empty"><i>No folders yet</i> · tap to create one</div>`}</div>
    ${pinnedAnzahl ? `<div class="no-kp"><span class="no-kp-t">Pinned notes · ${pinnedAnzahl} to sort</span><div class="ab-nt-list">${pinnedZeilen}</div></div>` : ''}
    <div class="ab-goto"><button class="ab-goto-b" onclick="pinHistAuf('${escJH(c.id)}')" title="Unpinned notes of ${e(c.name)}">History →</button></div>
  </div>`;
}

// ── Fenster ──────────────────────────────────────────────────────────────────
let _asset = null, _sel = null;
export function ordnerAuf(asset, ordnerId) {
  _asset = asset;
  const l = ordnerVon(asset);
  _sel = ordnerId && l.some(o => o.id === ordnerId) ? ordnerId : (_sel && l.some(o => o.id === _sel) ? _sel : (l[0] && l[0].id) || null);
  zeichnen(); H.openM('mNotesOrdner');
}
function offen() { const ov = document.getElementById('mNotesOrdner'); return ov && ov.style.display !== 'none'; }
function zeichnen() {
  if (H.curPage() === 'cur') { try { H.renderDetail(); } catch (e) { } }
  if (!_asset) return;
  const el = document.getElementById('noBody'); if (!el) return;
  const e = H.escH, c = H.syms().find(s => s.id === _asset), l = ordnerVon(_asset);
  if (_sel && !l.some(o => o.id === _sel)) _sel = (l[0] && l[0].id) || null;
  const t = document.getElementById('noTitel'); if (t) t.textContent = 'Notes · ' + (c ? c.name : _asset);
  const sub = document.getElementById('noSub'); if (sub) sub.textContent = `${l.length} folder${l.length === 1 ? '' : 's'} · ${l.reduce((s, o) => s + punkte(o).length, 0)} points`;
  const pin = H.pinnedVon(_asset);
  const rail = `<div class="no-rail">
      <button type="button" class="no-newf" onclick="ordnerNeu()">＋ Create new folder</button>
      <div class="no-lbl">Folders</div>
      ${l.map(o => `<button type="button" class="no-f${o.id === _sel ? ' on' : ''}" onclick="ordnerWahl('${escJH(o.id)}')"><span class="no-f-n">${e(o.name)}${biasBalken(o)}</span><span class="no-f-c">${punkte(o).length}</span></button>`).join('') || '<div class="no-leer"><i>No folders yet</i></div>'}
      ${pin.length ? `<div class="no-lbl">Pinned notes to sort · ${pin.length}</div>
        ${pin.map(n => `<div class="no-pin" style="--nb:${biasFarbe(n.bias)}"><span class="no-pin-t">${e(n.title || 'Untitled note')}</span><button type="button" class="btn" onclick="ordnerPinEinsortieren('${escJH(n.id)}')" ${l.length ? '' : 'disabled title="Create a folder first"'}>Sort in</button></div>`).join('')}` : ''}
    </div>`;
  const o = notizOrdner[_sel];
  let main = '';
  if (!o || o.del) main = `<div class="no-main no-main-leer"><div class="no-hinweis"><b>No folder selected</b><i>Create a folder on the left to start a mind map</i></div></div>`;
  else {
    const teilen = (o.assets || []).map(a => { const s = H.syms().find(x => x.id === a); return `<span class="no-share-c">${e(s ? s.name : a)}${o.assets.length > 1 ? `<button type="button" onclick="ordnerTeilen('${escJH(o.id)}','${escJH(a)}',false)" aria-label="Stop sharing with ${e(s ? s.name : a)}" title="Remove">×</button>` : ''}</span>`; }).join('');
    const frei = H.syms().map(s => s.id).filter(id => !(o.assets || []).includes(id));
    main = `<div class="no-main">
      <div class="no-kopf">
        <div class="no-share"><span class="no-share-l">Shared with</span>${teilen}${frei.length ? `<select class="m-inp no-share-add" title="Share with asset" aria-label="Share with asset" onchange="if(this.value)ordnerTeilen('${escJH(o.id)}',this.value,true)"><option value="" hidden selected>＋ Asset</option>${H.sbCatsOptgroups(frei, id => { const s = H.syms().find(x => x.id === id); return `<option value="${e(id)}">${e(s ? s.name : id)}</option>`; })}</select>` : ''}</div>
        <div class="no-kopf-r"><button type="button" class="btn" onclick="ordnerUmbenennen('${escJH(o.id)}')">Rename</button><button type="button" class="btn" onclick="ordnerLoeschen('${escJH(o.id)}')">Delete</button><button type="button" class="btn g" onclick="punktNeu()">＋ Add point</button></div>
      </div>
      <div class="no-canvas" id="noCanvas">${baumHtml(o)}</div>
    </div>`;
  }
  el.innerHTML = rail + main;
  if (o && !o.del) requestAnimationFrame(() => baumLayout(o));
}

// ── Baum (Entwurf B): Spalten je Ebene, Hoehen gemessen, nichts ueberlappt ──
const KNW = 196, ROOTW = 150, GAPX = 40, GAPY = 12, RAND = 16;
function baumHtml(o) {
  const e = H.escH;
  return `<svg class="no-svg" id="noSvg"></svg><div class="no-root" id="noRoot">${e(o.name)}</div>` +
    punkte(o).map(p => `<button type="button" class="no-pt" data-id="${e(p.id)}" style="--c:${biasFarbe(p.b)}" onclick="punktBearbeiten('${escJH(p.id)}')" title="Edit">
      <span class="no-pt-d"></span><span class="no-pt-x"><b>${e(p.ti || 'Untitled')}</b>${p.tx ? `<i>${e(kurz(p.tx))}</i>` : ''}</span></button>`).join('');
}
const kurz = s => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > 70 ? t.slice(0, 68).trimEnd() + '…' : t; };
function baumLayout(o) {
  const cv = document.getElementById('noCanvas'), root = document.getElementById('noRoot'), svg = document.getElementById('noSvg');
  if (!cv || !root || !svg) return;
  const l = punkte(o), kinder = {}, hoehe = {};
  const da = new Set(l.map(p => p.id));
  l.forEach(p => { const par = p.par && da.has(p.par) ? p.par : null; (kinder[par || '_'] = kinder[par || '_'] || []).push(p); });
  cv.querySelectorAll('.no-pt').forEach(n => { hoehe[n.dataset.id] = n.offsetHeight; });
  const pos = {};
  // Blattfolge von oben nach unten; ein Elternknoten steht mittig vor seinen Kindern.
  let y = RAND;
  const setze = (p, tiefe, seen) => {
    if (seen.has(p.id)) return null; seen.add(p.id);
    const k = (kinder[p.id] || []);
    const x = RAND + ROOTW + GAPX + tiefe * (KNW + GAPX);
    if (!k.length) { pos[p.id] = { x, y, h: hoehe[p.id] || 50 }; y += (hoehe[p.id] || 50) + GAPY; return pos[p.id]; }
    const start = y, kp = k.map(q => setze(q, tiefe + 1, seen)).filter(Boolean);
    const h = hoehe[p.id] || 50;
    const mitte = kp.length ? (kp[0].y + kp[0].h / 2 + kp[kp.length - 1].y + kp[kp.length - 1].h / 2) / 2 : start + h / 2;
    let top = Math.max(start, mitte - h / 2);
    if (top + h + GAPY > y) y = top + h + GAPY;
    pos[p.id] = { x, y: top, h }; return pos[p.id];
  };
  const seen = new Set(), oben = kinder._ || [];
  oben.forEach(p => setze(p, 0, seen));
  const breiteMax = Math.max(0, ...Object.values(pos).map(q => q.x + KNW));
  const hoeheMax = Math.max(y, 0);
  const rh = root.offsetHeight;
  if (!oben.length) {   // leerer Ordner: nur der Name, mittig
    root.style.left = Math.max(RAND, (cv.clientWidth - ROOTW) / 2) + 'px'; root.style.top = Math.max(RAND, (cv.clientHeight - rh) / 2) + 'px';
    svg.setAttribute('width', 0); svg.setAttribute('height', 0); return;
  }
  const ersteM = pos[oben[0].id].y + pos[oben[0].id].h / 2, letzteM = pos[oben[oben.length - 1].id].y + pos[oben[oben.length - 1].id].h / 2;
  const gesH = Math.max(hoeheMax + RAND, cv.clientHeight), dy = Math.max(0, (cv.clientHeight - hoeheMax - RAND) / 2);
  const rootY = (ersteM + letzteM) / 2 - rh / 2 + dy;
  root.style.left = RAND + 'px'; root.style.top = rootY + 'px';
  cv.querySelectorAll('.no-pt').forEach(n => { const q = pos[n.dataset.id]; if (!q) { n.style.display = 'none'; return; } n.style.left = q.x + 'px'; n.style.top = (q.y + dy) + 'px'; });
  const W = Math.max(breiteMax + RAND, cv.clientWidth), Hh = gesH;
  svg.setAttribute('width', W); svg.setAttribute('height', Hh); svg.style.width = W + 'px'; svg.style.height = Hh + 'px';
  const ast = {}; l.forEach(p => { let q = p, n = 0; while (q.par && da.has(q.par) && n++ < 50) q = o.p[q.par]; ast[p.id] = q.b; });
  let d = '';
  l.forEach(p => {
    const q = pos[p.id]; if (!q) return;
    const vonRoot = !(p.par && da.has(p.par)), pp = vonRoot ? null : pos[p.par];
    const x1 = vonRoot ? RAND + ROOTW : pp.x + KNW, y1 = vonRoot ? rootY + rh / 2 : pp.y + dy + pp.h / 2;
    const x2 = q.x, y2 = q.y + dy + q.h / 2, mx = x1 + GAPX / 2;
    d += `<path d="M${x1},${y1} H${mx} V${y2} H${x2}" stroke="${biasFarbe(ast[p.id])}" />`;
  });
  svg.innerHTML = d;
}

// ── Ordner ───────────────────────────────────────────────────────────────────
let _nameFuer = null;   // null = neuer Ordner, sonst Ordner-Id
export function ordnerNeu() { _nameFuer = null; nameAuf('New folder', ''); }
export function ordnerUmbenennen(id) { const o = notizOrdner[id]; if (!o) return; _nameFuer = id; nameAuf('Rename folder', o.name); }
function nameAuf(titel, wert) {
  document.getElementById('noNameTitel').textContent = titel;
  const i = document.getElementById('noNameIn'); i.value = wert;
  H.openM('mNoName'); H.guardArm('mNoName'); setTimeout(() => { try { i.focus(); } catch (e) { } }, 60);
}
export function ordnerNameSpeichern() {
  const v = document.getElementById('noNameIn').value.trim();
  if (!v) { alert('Please enter a folder name.'); return; }
  schreiben(() => {
    const t = Date.now();
    if (_nameFuer && notizOrdner[_nameFuer]) { notizOrdner[_nameFuer].name = v.slice(0, 80); notizOrdner[_nameFuer].t = t; }
    else { const id = neuId('nf'); notizOrdner[id] = { id, name: v.slice(0, 80), assets: [_asset], t, p: {} }; _sel = id; }
  });
  H.guardArm('mNoName'); H.closeM('mNoName');
}
export function ordnerWahl(id) { _sel = id; zeichnen(); }
export function ordnerLoeschen(id) {
  const o = notizOrdner[id]; if (!o) return;
  if (!confirm(`Delete the folder "${o.name}" with ${punkte(o).length} points${(o.assets || []).length > 1 ? ' on all ' + o.assets.length + ' assets it is shared with' : ''}?`)) return;
  schreiben(() => { notizOrdner[id] = { id, del: Date.now(), t: Date.now(), p: {} }; });
}
export function ordnerTeilen(id, asset, an) {
  const o = notizOrdner[id]; if (!o) return;
  schreiben(() => {
    const s = new Set(o.assets || []);
    if (an) s.add(asset); else if (s.size > 1) s.delete(asset);
    o.assets = [...s]; o.t = Date.now();
    if (!o.assets.includes(_asset)) _sel = null;
  });
}

// ── Punkte ───────────────────────────────────────────────────────────────────
let _pt = null, _pinId = null, _bias = 'neu', _art = 'neu';   // _art: 'neu' = neuer Ast, 'ast' = an einen Punkt
export function punktNeu() { _pt = null; _pinId = null; punktFenster({ ti: '', tx: '', b: 'neu', par: null }, _sel); }
export function punktBearbeiten(id) { const o = notizOrdner[_sel], p = o && o.p[id]; if (!p) return; _pt = id; _pinId = null; punktFenster(p, _sel); }
export function ordnerPinEinsortieren(noteId) {
  const n = H.pinnedVon(_asset).find(x => x.id === noteId); if (!n) return;
  if (!ordnerVon(_asset).length) { alert('Create a folder first.'); return; }
  _pt = null; _pinId = noteId;
  punktFenster({ ti: n.title || '', tx: n.body || '', b: biasOk(n.bias === 'sbull' ? 'bull' : n.bias === 'sbear' ? 'bear' : n.bias), par: null }, _sel || ordnerVon(_asset)[0].id);
}
function punktFenster(p, ordnerId) {
  const e = H.escH;
  _bias = biasOk(p.b); _art = p.par ? 'ast' : 'neu';
  document.getElementById('noPtTitel').textContent = _pt ? 'Edit point' : _pinId ? 'Sort pinned note into a folder' : 'New point';
  document.getElementById('noPtTi').value = p.ti || '';
  document.getElementById('noPtTx').value = p.tx || '';
  const of = document.getElementById('noPtOrdWrap'), os = document.getElementById('noPtOrd');
  of.hidden = !_pinId;
  os.innerHTML = ordnerVon(_asset).map(o => `<option value="${e(o.id)}"${o.id === ordnerId ? ' selected' : ''}>${e(o.name)}</option>`).join('');
  document.getElementById('noPtDel').hidden = !_pt;
  parListe(p.par);
  segZeichnen();
  H.openM('mNoPunkt'); H.guardArm('mNoPunkt');
  setTimeout(() => { try { document.getElementById('noPtTi').focus(); } catch (x) { } }, 60);
}
function zielOrdner() { return _pinId ? document.getElementById('noPtOrd').value : _sel; }
function parListe(gewaehlt) {
  const sel = document.getElementById('noPtPar'), o = notizOrdner[zielOrdner()]; if (!sel) return;
  const l = o ? punkte(o) : [], weg = new Set();
  if (_pt) { weg.add(_pt); let wuchs = true; while (wuchs) { wuchs = false; l.forEach(p => { if (p.par && weg.has(p.par) && !weg.has(p.id)) { weg.add(p.id); wuchs = true; } }); } }
  const tiefe = p => { let n = 0, q = p; while (q && q.par && o.p[q.par] && n < 20) { q = o.p[q.par]; n++; } return n; };
  const frei = l.filter(p => !weg.has(p.id));
  sel.innerHTML = frei.map(p => `<option value="${H.escH(p.id)}"${p.id === gewaehlt ? ' selected' : ''}>${'– '.repeat(tiefe(p))}${H.escH(p.ti || 'Untitled')}</option>`).join('');
  if (!frei.length) _art = 'neu';
  document.getElementById('noPtArtAst').disabled = !frei.length;
}
function segZeichnen() {
  document.querySelectorAll('#noPtBias button').forEach(b => b.classList.toggle('on', b.dataset.v === _bias));
  document.getElementById('noPtArtNeu').classList.toggle('on', _art === 'neu');
  document.getElementById('noPtArtAst').classList.toggle('on', _art === 'ast');
  document.getElementById('noPtPar').hidden = _art !== 'ast';
}
export function punktBias(b) { _bias = biasOk(b); segZeichnen(); }
export function punktArt(a) { _art = a === 'ast' ? 'ast' : 'neu'; segZeichnen(); }
export function punktOrdnerWechsel() { parListe(null); segZeichnen(); }
// Fuer den Eingabe-Schutz (MODAL_GUARD_TABELLE): Bias und Ast zaehlen wie Felder.
export function punktZustand() { return _bias + '|' + _art + '|' + (document.getElementById('noPtPar') || {}).value + '|' + (document.getElementById('noPtOrd') || {}).value; }
export function punktSpeichern() {
  const ti = document.getElementById('noPtTi').value.trim(), tx = document.getElementById('noPtTx').value.trim();
  if (!ti) { alert('Please enter a title.'); return; }
  const oid = zielOrdner(), o = notizOrdner[oid];
  if (!o) { alert('Please choose a folder.'); return; }
  const par = _art === 'ast' ? (document.getElementById('noPtPar').value || null) : null;
  const pinId = _pinId;
  schreiben(() => {
    const t = Date.now();
    if (_pt && o.p[_pt]) Object.assign(o.p[_pt], { ti: ti.slice(0, 120), tx: tx.slice(0, 4000), b: _bias, par, t });
    else { const id = neuId('np'); o.p[id] = { id, par, ti: ti.slice(0, 120), tx: tx.slice(0, 4000), b: _bias, t }; }
    if (pinId) { _sel = oid; H.pinEntfernen(pinId); }
  });
  H.guardArm('mNoPunkt'); H.closeM('mNoPunkt');
}
export function punktLoeschen() {
  const o = notizOrdner[_sel], p = o && o.p[_pt]; if (!p) return;
  const k = punkte(o).filter(q => q.par === p.id).length;
  if (!confirm(`Delete "${p.ti || 'Untitled'}"?${k ? ` Its ${k} sub-point${k > 1 ? 's move' : ' moves'} up one level.` : ''}`)) return;
  schreiben(() => {
    const t = Date.now();
    punkte(o).forEach(q => { if (q.par === p.id) { q.par = p.par || null; q.t = t; } });
    o.p[p.id] = { id: p.id, del: t, t };
  });
  H.guardArm('mNoPunkt'); H.closeM('mNoPunkt');
}
// Inline-Handler (onclick) brauchen die Funktionen am window.
Object.assign(window, { ordnerAuf, ordnerNeu, ordnerUmbenennen, ordnerNameSpeichern, ordnerWahl, ordnerLoeschen, ordnerTeilen, punktNeu, punktBearbeiten, ordnerPinEinsortieren, punktBias, punktArt, punktOrdnerWechsel, punktSpeichern, punktLoeschen });
export const ORDNER_WINDOW = { ordnerAuf, ordnerNeu, ordnerUmbenennen, ordnerNameSpeichern, ordnerWahl, ordnerLoeschen, ordnerTeilen, punktNeu, punktBearbeiten, ordnerPinEinsortieren, punktBias, punktArt, punktOrdnerWechsel, punktSpeichern, punktLoeschen };
export { offen as ordnerOffen };
