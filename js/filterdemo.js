// ══ FILTER-VORSCHAU a | b (TEMPORAER, Nutzer 2026-10-31) ══════════════════
// Nutzer: "Mach mal schnell wenn ich die App oeffne eine Darstellung von
// beidem mit Beispielen nenn das eine Option a das andere b warte auf meine
// Anweisung dann sag ich was ich will". Gefragt war, wie weit die Gruppen-
// Filter auf 2 Spalten umgebaut werden:
//   a = JEDER Gruppen-Filter (auch die Browser-Auswahllisten) wird ein eigenes
//       Auswahlfenster mit 2 Spalten
//   b = nur die Chip-Popups (Data, Country profile) bekommen 2 Spalten, die
//       Auswahllisten bleiben Browser-Listen (iOS-Liste auf dem iPad)
// Beide stehen beim Auswaehlen fest (gemessen vorher: COT/Retail/Put-Call/
// Net flow/Fear & Greed -47 px, Data-Popup -138 px).
// ⚠ Nach der Entscheidung KOMPLETT entfernen: diese Datei, der Import und
// der Aufruf in js/main.js.
// Nicht in automatisierten Laeufen (navigator.webdriver) - sonst laege das
// Fenster ueber jeder Seite, die ein Waechter anklickt. Erzwingen fuer eine
// Sichtpruefung: ?filterdemo in der Adresse.

const FD_CSS = `
.fd-ov{position:fixed;inset:0;z-index:9800;background:rgba(10,16,30,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 16px}
.fd-box{width:min(1040px,100%);background:var(--bg1);border:1px solid var(--bd);border-radius:14px;box-shadow:var(--shadow-pop);color:var(--t1)}
.fd-hd{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--bd)}
.fd-hd .pg-titel{margin:0;font-size:var(--fs-kt)}
.fd-hd .fd-sub{color:var(--t2);font-size:var(--fs-sm)}
.fd-hd .btn{margin-left:auto}
.fd-spalten{display:grid;grid-template-columns:1fr 1fr;gap:0}
.fd-opt{position:relative;padding:14px 18px 18px;min-width:0}
.fd-opt+.fd-opt{border-left:1px solid var(--bd)}
.fd-t{font:800 var(--fs-kt)/1.2 var(--ff-text);color:var(--t0);margin-bottom:6px}
.fd-t b{color:var(--blue)}
.fd-pkt{margin:0 0 12px;padding-left:18px;font-size:var(--fs-sm);line-height:1.55;color:var(--t1)}
.fd-pkt i{color:var(--t2)}
.fd-ex-t{font-size:var(--fs-2xs);letter-spacing:1.4px;text-transform:uppercase;color:var(--t2);font-weight:700;margin:12px 0 6px}
.fd-zeile{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:34px}
.fd-zeile .btn,.fd-zeile select{height:34px}
.fd-x{visibility:hidden}
.fd-x.an{visibility:visible}
.fd-chips{display:flex;flex-wrap:wrap;gap:5px}
.fd-pop{position:absolute;z-index:2;width:min(560px,calc(100% - 16px));max-height:max(240px,50vh);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:var(--bg2);border:1px solid var(--bd);border-radius:12px;box-shadow:var(--shadow-pop)}
.fd-pop .data-picker-body{display:block;columns:2;column-gap:16px}
.fd-pop .data-picker-hd{position:sticky;top:0;z-index:1;background:var(--bg2)}
.fd-pop .data-picker-grp{break-inside:avoid;margin-bottom:10px}
.fd-pop .cmp-chip:disabled{opacity:.35;cursor:not-allowed}
.fd-pop .fd-alle{margin:10px 13px 0}
@media (max-width:760px){.fd-spalten{grid-template-columns:1fr}.fd-opt+.fd-opt{border-left:0;border-top:1px solid var(--bd)}.fd-ov{padding:8px}}
`;

function fdEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Die echten Gruppen der App: Asset-Filter = Watchlist + SB_CATS,
// Preisvergleich = alles mit Kursdaten (Koerbe, Paare, Non-FX, Renditen/VIX).
function fdAssetGruppen() {
  const cats = (window.SB_CATS || []).map(c => ({ name: c.l, ids: c.ids.slice() }));
  let wl = [];
  try { wl = window.watchlistedAssetIds ? window.watchlistedAssetIds(cats.flatMap(c => c.ids)) : []; } catch (e) { wl = []; }
  const wlSet = new Set(wl);
  const g = cats.map(c => ({ name: c.name, ids: c.ids.filter(id => !wlSet.has(id)) })).filter(c => c.ids.length);
  return wl.length ? [{ name: 'Watchlist', ids: wl }].concat(g) : g;
}
function fdPreisGruppen() {
  const fx = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD'];
  const paare = (window.FX_PAIRS || []).slice();
  const syms = window.syms || [];
  const yCat = (window.SB_CATS || []).find(c => c.l === 'Yields');
  const yIds = yCat ? yCat.ids.slice() : [];
  const nonFx = syms.map(s => s.id).filter(id => !fx.includes(id) && !yIds.includes(id));
  if (!nonFx.includes('ETH')) nonFx.push('ETH');
  const renditen = yIds.concat(['VIX']);
  return [
    { name: 'Currencies (basket)', ids: fx },
    { name: 'Non-FX', ids: nonFx },
    { name: 'Yields & VIX', ids: renditen },
    { name: 'FX pairs', ids: paare }
  ].filter(g => g.ids.length);
}

function fdZeigen() {
  if (document.getElementById('fdOv')) return;
  if (!document.getElementById('fdStyle')) { const st = document.createElement('style'); st.id = 'fdStyle'; st.textContent = FD_CSS; document.head.appendChild(st); }
  const ov = document.createElement('div');
  ov.id = 'fdOv'; ov.className = 'fd-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Filter preview');
  const assetGr = fdAssetGruppen();
  const nativOpts = assetGr.map(g => `<optgroup label="${fdEsc(g.name)}">${g.ids.map(id => `<option value="${fdEsc(id)}">${fdEsc(id)}</option>`).join('')}</optgroup>`).join('');
  const option = (k, titel, punkte, filterHtml) => `<section class="fd-opt" data-opt="${k}">
      <div class="fd-t">Option <b>${k}</b> · ${titel}</div>
      <ul class="fd-pkt">${punkte.map(p => `<li>${p}</li>`).join('')}</ul>
      <div class="fd-ex-t">Asset filter · COT, Retail, Put/Call …</div>
      <div class="fd-zeile">${filterHtml}</div>
      <div class="fd-ex-t">Data · price comparison · up to 4</div>
      <div class="fd-zeile"><button type="button" class="btn fd-add">＋ Add</button><span class="fd-chips"></span></div>
    </section>`;
  ov.innerHTML = `<div class="fd-box">
    <div class="fd-hd"><span class="pg-titel">Filter preview</span><span class="fd-sub">tap through both · tell Claude <b>a</b> or <b>b</b></span><button type="button" class="btn fd-zu">Close</button></div>
    <div class="fd-spalten">
      ${option('a', 'every filter', ['<b>Every</b> grouped filter → one picker', 'Groups in <b>2 columns</b> · no long scrolling', 'Stays in place when you pick', '<i>iPad: replaces the iOS list</i>'],
        `<button type="button" class="btn fd-asset">All assets ▾</button><button type="button" class="btn flt-x fd-x" title="Reset filter" aria-label="Reset filter">✕</button>`)}
      ${option('b', 'chip pickers only', ['Dropdowns stay <b>native</b> (iOS list on iPad)', 'Only chip pickers (Data, Country profile) → <b>2 columns</b>', 'Stays in place when you pick', '<i>Dropdowns keep the long list</i>'],
        `<select class="btn fd-nativ"><option value="">All assets</option>${nativOpts}</select><button type="button" class="btn flt-x fd-x" title="Reset filter" aria-label="Reset filter">✕</button>`)}
    </div>
  </div>`;
  document.body.appendChild(ov);

  let offen = null;
  const zu = () => { if (offen) { offen.remove(); offen = null; } };
  // Popup EINMAL unter dem Knopf ausrichten - danach steht es, egal was gewaehlt wird.
  const aufmachen = (opt, knopf, html) => {
    zu();
    const p = document.createElement('div'); p.className = 'fd-pop'; p.innerHTML = html;
    const r = knopf.getBoundingClientRect(), o = opt.getBoundingClientRect();
    p.style.top = Math.round(r.bottom - o.top + 6) + 'px';
    p.style.left = Math.max(8, Math.round(r.left - o.left)) + 'px';
    opt.appendChild(p); offen = p; return p;
  };
  const gruppenHtml = (gr, istAn, voll) => gr.map(g => `<div class="data-picker-grp"><span class="cmp-filter-lbl">${fdEsc(g.name)}</span><div class="cmp-filter-grp">${g.ids.map(id => {
    const an = istAn(id);
    return `<button type="button" class="cmp-chip${an ? ' on' : ''}" data-id="${fdEsc(id)}"${!an && voll ? ' disabled' : ''}>${fdEsc(id)}</button>`;
  }).join('')}</div></div>`).join('');

  ov.querySelectorAll('.fd-opt').forEach(opt => {
    const x = opt.querySelector('.fd-x');
    // Einzel-Asset-Filter: a = eigenes Fenster, b = Browser-Liste
    const ab = opt.querySelector('.fd-asset'), nat = opt.querySelector('.fd-nativ');
    const setzen = id => {
      if (ab) ab.textContent = (id || 'All assets') + ' ▾';
      if (nat) nat.value = id || '';
      x.classList.toggle('an', !!id);
    };
    x.addEventListener('click', () => setzen(''));
    if (nat) nat.addEventListener('change', () => setzen(nat.value));
    if (ab) ab.addEventListener('click', e => {
      e.stopPropagation();
      if (offen && offen.dataset.art === 'asset') { zu(); return; }
      const akt = ab.textContent.replace(' ▾', '');
      const p = aufmachen(opt, ab, `<div class="data-picker-hd"><span>Filter by asset</span></div>
        <button type="button" class="cmp-chip fd-alle${akt === 'All assets' ? ' on' : ''}" data-id="">All assets</button>
        <div class="data-picker-body">${gruppenHtml(assetGr, id => id === akt, false)}</div>`);
      p.dataset.art = 'asset';
      p.addEventListener('click', ev => { const b = ev.target.closest('[data-id]'); if (!b) return; ev.stopPropagation(); setzen(b.dataset.id); zu(); });
    });
    // Data-Preisvergleich: Mehrfachauswahl, bleibt offen bis 4 oder daneben tippen
    const add = opt.querySelector('.fd-add'), chips = opt.querySelector('.fd-chips');
    const gew = [];
    const chipsZeichnen = () => { chips.innerHTML = gew.map(id => `<button type="button" class="cmp-chip on" data-weg="${fdEsc(id)}" title="Remove">${fdEsc(id)} ✕</button>`).join(''); };
    chips.addEventListener('click', e => { const b = e.target.closest('[data-weg]'); if (!b) return; gew.splice(gew.indexOf(b.dataset.weg), 1); chipsZeichnen(); });
    add.addEventListener('click', e => {
      e.stopPropagation();
      if (offen && offen.dataset.art === 'preis') { zu(); return; }
      const malen = p => {
        p.innerHTML = `<div class="data-picker-hd"><span>Pick up to 4 prices</span><b>${gew.length}/4</b></div>
          <div class="data-picker-body">${gruppenHtml(fdPreisGruppen(), id => gew.includes(id), gew.length >= 4)}</div>
          <div class="data-picker-ft">every tap applies at once · closes at 4 or when you tap outside</div>`;
      };
      const p = aufmachen(opt, add, ''); p.dataset.art = 'preis'; malen(p);
      p.addEventListener('click', ev => {
        const b = ev.target.closest('[data-id]'); if (!b || b.disabled) return; ev.stopPropagation();
        const id = b.dataset.id, i = gew.indexOf(id);
        if (i >= 0) gew.splice(i, 1); else if (gew.length < 4) gew.push(id);
        chipsZeichnen();
        if (gew.length >= 4) zu(); else malen(p);   // Inhalt neu, Lage bleibt
      });
    });
  });
  ov.addEventListener('click', e => { if (offen && !offen.contains(e.target)) zu(); if (e.target === ov) fdSchliessen(); });
  ov.querySelector('.fd-zu').addEventListener('click', fdSchliessen);
}
function fdSchliessen() {
  const ov = document.getElementById('fdOv'); if (ov) ov.remove();
  try { sessionStorage.setItem('fxpro_fd_zu', '1'); } catch (e) {}
}

export function filterDemoStarten() {
  let erzwungen = false;
  try { erzwungen = /[?&#]filterdemo\b/.test(location.search + location.hash); } catch (e) {}
  if (!erzwungen) {
    if (navigator.webdriver) return;
    try { if (sessionStorage.getItem('fxpro_fd_zu') === '1') return; } catch (e) {}
  }
  // Erst wenn der Ladebildschirm weg und die PIN-Sperre offen ist.
  const warten = () => {
    const lade = document.getElementById('ladeOv');
    const pin = document.getElementById('lockScreen');
    const pinZu = pin && getComputedStyle(pin).display !== 'none';
    if (lade || pinZu) { setTimeout(warten, 400); return; }
    try { fdZeigen(); } catch (e) { console.warn('Filter preview failed:', e); }
  };
  setTimeout(warten, 400);
}
