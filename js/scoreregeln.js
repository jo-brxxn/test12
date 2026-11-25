'use strict';
// ══ SCORE-REGELN: "WIE ENTSTEHT DER SCORE" (Nutzer 2026-11-22, VERSION-CHECK-794) ══
// Nutzer (Foto der Silver-Seite, "Next event" eingekreist): "Entfern das bei
// allen Assets oben mit Next Event und mach dort Score hin. Ich moechte das
// wenn man darauf klickt sich ein Fenster oeffnet wo Ultra uebersichtlich drin
// steht wie sich der Score ergibt. Arbeite viel mit Farben fasse die
// Indikatoren in Kategorien zusammen und sag was genau wann passiert. Aber
// kurz kein Fliesstext. Und mach in dem Fenster oben rechts ein Zahnrad hin
// wenn man das drueckt soll sich das settings Fenster oeffnen".
// Per Rueckfrage: der Knopf heisst "Score" (Stil wie History), das Fenster
// zeigt die REGELN ("allgemein was wann passiert, nicht wie die Werte aktuell
// sind") - die aktuellen Werte stehen weiter im Fenster hinter der Score-Zahl
// (openScoreInfoSym). Aufbau nach dem bestaetigten Mockup: Bias-Schwellen,
// dann je Kategorie ein farbiger Block "Ereignis -> Punkte", unten die
// Endrechnung.
//
// ⚠ KEINE ZWEITE WAHRHEIT: welche Regeln erscheinen, folgt aus den Zeilen, die
// das Asset wirklich hat (srTyp je Indikator), und jede Punktzahl kommt aus
// derselben Konstante, die auch die Rechnung liest (BOND_PKT, COT_WOW_STUFEN,
// TREND_PKT ...). Nur die Sentiment-Schwellen stehen in sentEval() als
// Literale - die prueft check/scoreregeln.js am Verhalten von sentEval selbst.
// Eine Zeile, die srTyp nicht kennt, wird als "unbekannt" sichtbar gemeldet
// (und vom Waechter rot), statt still unter eine falsche Regel zu fallen.

let H = null;
export function srHelfer(h) { H = h; }

const KAT = {
  macro: { t: 'Macro releases', f: 'var(--a-lab)' },
  rates: { t: 'Rates & yields', f: 'var(--a-rate)' },
  roh:   { t: 'Commodities', f: 'var(--a-infl)' },
  pos:   { t: 'Positioning & sentiment', f: 'var(--a-cot)' },
  trend: { t: 'Price trend', f: 'var(--a-grow)' },
  seas:  { t: 'Seasonality', f: 'var(--t3)' },
};
const RUB_KURZ = { 'Inflation': 'Inflation', 'Interest Rates': 'Rates', 'Labour Market': 'Labour', 'Economic Growth': 'Growth' };
const SENT_ZEILE = {
  vix:       ['VIX ≥ 28 / ≤ 13', 'panic / complacency'],
  aaii:      ['AAII spread ≤ −20 / ≥ +20 pts', 'bull minus bear, weekly'],
  cryptoFng: ['Crypto Fear & Greed ≤ 25 / ≥ 75', 'extreme fear / greed'],
  stockFng:  ['Fear & Greed ≤ 25 / ≥ 75', 'extreme fear / greed'],
};

// Regel-Typ einer Indikator-Zeile. Reihenfolge wie in der Rechnung:
// Nur-Anzeige zuerst, dann die Zeilen mit festen Punkten, zuletzt Releases.
export function srTyp(sid, rub, ind) {
  const h = H, base = h.stripPeriodSuffix(ind.name).base, rn = rub && rub.name;
  if (h.SCORE_ZERO.has(base) || (h.FX.includes(sid) && h.m28NurAnzeige(base, sid))) return 'anzeige';
  if (ind.name === h.REALZINS_IND) return 'realzins';
  if (ind.name === h.GLOBAL_YIELDS_IND) return 'globalyields';
  if (h.BOND_HALF_PT.has(ind.name)) return 'bond';
  if (ind.name === h.KURVE_IND) return 'kurve';
  if (ind.name === h.ZINSDIFF_IND) return 'zinsdiff';
  if (Object.values(h.ROHSTOFF_NAME).includes(ind.name)) return 'roh';
  if (h.COT_NET_HALF.has(base) || base === h.COT_WOW_BASE) return 'cot';
  if (ind.name === h.RETAIL_IND_NAME) return 'retail';
  if (ind.name === h.SEAS_IND_NAME) return 'seas';
  if (ind.name === h.TREND_IND.d) return 'trend-d';
  if (ind.name === h.TREND_IND.h) return 'trend-h';
  if (h.SENT_IND_NAMES.includes(base)) return 'sent';
  if (ind.name === 'Gas Storage vs 5Y') return 'gas';
  if (ind.name === 'BTC Sentiment Score') return 'btcscore';
  if (h.istAssetEigen(sid, ind.name)) return 'eigen';
  if (rn === 'COT Data') return 'unbekannt';
  return 'release';
}

// Hoechster Betrag, den eine Zeile dieses Typs laut Fenster beitragen kann
// (fuer check/scoreregeln.js: echte Beitraege duerfen ihn nie uebersteigen).
export function srMax(sid, rub, ind, typ) {
  const h = H, N = h.SCORE_NORM_MAX;
  switch (typ) {
    case 'anzeige': return 0;
    case 'realzins': return h.REALZINS_PKT;
    case 'globalyields': return h.GLOBAL_YIELDS_PKT;
    case 'bond': return h.BOND_PKT;
    case 'kurve': return h.KURVE_PKT;
    case 'zinsdiff': return Math.max(...h.ZINSDIFF_STUFEN.map(s => s[1]));
    case 'roh': return Math.max(...h.ROHSTOFF_STUFEN.map(s => s[1])) * Math.max(1, ...Object.values(h.ROHSTOFF_KORB).flat().map(x => x[1]));
    case 'cot': return h.COT_MAX;
    case 'retail': return h.RETAIL_STIMME * 2;
    case 'seas': return 0.5 * N;
    case 'trend-d': return h.TREND_PKT;
    case 'trend-h': return h.TREND_PKT_H;
    case 'sent': return 0.5 * N;
    case 'gas': case 'btcscore': return h.ZEILE_PKT;
    case 'eigen': return (typeof ind.gew === 'number' ? ind.gew : 1) * N;
    case 'release': return 1 * N;
    default: return Infinity;
  }
}

// ── Darstellung ──────────────────────────────────────────────────────────
const fmt = v => { v = Math.round(v * 1000) / 1000; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); };
function pktHtml(p) {
  const h = H;
  const eins = v => `<b style="color:${v > 0 ? h.BC.bull : v < 0 ? h.BC.bear : 'var(--t3)'}">${v === 0 ? '0' : fmt(v)}</b>`;
  if (Array.isArray(p)) return p.map(eins).join('<i class="sr-sl">/</i>');
  if (p && Array.isArray(p.stufen)) return p.stufen.map(eins).join('<i class="sr-sl">·</i>');
  if (typeof p === 'number') return eins(p);
  return `<b class="sr-neu">${h.escH(p)}</b>`;
}
const zeile = (t, p, n) => ({ t, p, n });
function blockHtml(k, sub, zeilen) {
  const h = H;
  if (!zeilen.length) return '';
  return `<section class="sr-blk" style="--sr-f:${KAT[k].f}">
    <div class="sr-blk-hd"><span class="sr-blk-t">${h.escH(KAT[k].t)}</span>${sub ? `<span class="sr-blk-s">${h.escH(sub)}</span>` : ''}</div>
    ${zeilen.map(z => `<div class="sr-z"><span class="sr-z-t">${h.escH(z.t)}${z.n ? `<em>${h.escH(z.n)}</em>` : ''}</span><span class="sr-z-p">${pktHtml(z.p)}</span></div>`).join('')}
  </section>`;
}

// Alle Zeilen des Assets nach Typ einsammeln.
function sammeln(sym) {
  const out = [];
  (sym.rubrics || []).forEach(rub => (rub.indicators || []).forEach(ind => out.push({ rub, ind, typ: srTyp(sym.id, rub, ind) })));
  return out;
}

export function srFensterHtml(sym) {
  const h = H, sid = sym.id, fx = h.FX.includes(sid), nonFx = h.isNonFx(sid);
  const z = sammeln(sym), hat = t => z.some(x => x.typ === t), von = t => z.filter(x => x.typ === t);
  const lc = nonFx ? h.effLinkCcy(sym) : null, regeln = nonFx ? h.effDeriveRules(sym) : {};
  // Vorzeichen einer gespiegelten Karte: same +1, inverse -1, sonst null (von Hand).
  const vz = rub => {
    if (!nonFx || !h.MACRO_DERIVE_RUBS.includes(rub.name)) return 1;
    if (!lc) return null;
    const r = regeln[rub.name];
    return r === 'same' ? 1 : r === 'inverse' ? -1 : null;
  };
  // Regel je Indikator (Zahnrad "Single indicators", sym.indRules) schlaegt die Karten-Regel.
  const vzZ = x => { const r = h.indRegel(sym, x.ind); return r === 'same' ? 1 : r === 'inverse' ? -1 : vz(x.rub); };
  const eigenR = x => !!h.indRegel(sym, x.ind);
  const mal = (p, v) => v == null ? '±' + Math.abs(Array.isArray(p) ? p[0] : p) : Array.isArray(p) ? p.map(x => x * v) : p * v;
  const vor = rub => nonFx && lc && h.MACRO_DERIVE_RUBS.includes(rub.name) ? lc + ' ' : '';
  const gew = `×${h.SCORE_NORM_MIN}–${h.SCORE_NORM_MAX}`;
  let html = '';

  // Kopf: Bias-Schwellen
  html += `<div class="sr-bias">
    <span class="sr-bias-c" style="--c:${h.BC.bear}"><b>≤ −3</b>Bearish</span>
    <span class="sr-bias-c" style="--c:${h.BC.neu}"><b>−2.9 … +2.9</b>Neutral</span>
    <span class="sr-bias-c" style="--c:${h.BC.bull}"><b>≥ +3</b>Bullish</span>
  </div>
  <div class="sr-hint">Every rule works both ways · <b>opposite event = opposite sign</b></div>`;

  // Macro releases
  const rel = z.filter(x => x.typ === 'release'), mz = [];
  const rubs = [...new Set(rel.map(x => x.rub))];
  if (fx) {
    if (rel.length) {
      mz.push(zeile('Beats / misses forecast', [1, -1], '× weight'));
      mz.push(zeile('No forecast: better / worse than previous', [0.5, -0.5], '× weight'));
      const halb = [...new Set(rel.map(x => h.stripPeriodSuffix(x.ind.name).base).filter(b => h.M28_GEWICHT[b]))];
      if (halb.length) mz.push(zeile(halb.join(' · '), '×' + h.M28_GEWICHT[halb[0]], 'measured weak'));
      if (rel.some(x => h.indIsCorePaired(x.ind, x.rub))) mz.push(zeile('Headline + core of one release', '×0.5 each'));
      h.M28_DECKEL.filter(g => g.id !== 'rates').forEach(g => { if (rel.some(x => g.namen.includes(h.stripPeriodSuffix(x.ind.name).base))) mz.push(zeile(g.name, 'max ±' + g.max)); });
    }
  } else {
    rubs.forEach(rub => {
      const v = vz(rub), kurz = RUB_KURZ[rub.name] || rub.name;
      if (rel.filter(x => x.rub === rub).every(eigenR)) return;   // alle Zeilen mit eigener Regel
      if (v == null) mz.push(zeile(`${kurz}: not linked`, '±1', 'bias set by hand'));
      else mz.push(zeile(`${vor(rub)}${kurz} beats / misses forecast`, mal([1, -1], v), v < 0 ? 'inverse · × weight' : '× weight'));
    });
    rel.filter(eigenR).forEach(x => mz.push(zeile(`${vor(x.rub)}${h.indName(x.ind)} beats / misses`, mal([1, -1], vzZ(x)), 'own rule · × weight')));
    if (rel.length) mz.push(zeile('No forecast: vs previous', '±0.5', '× weight'));
  }
  von('eigen').forEach(x => { const r = h.indRegel(sym, x.ind), g = typeof x.ind.gew === 'number' ? x.ind.gew : 1;
    mz.push(zeile(`${h.indName(x.ind)} beats / misses`, [1, -1].map(v => v * g * (r === 'inverse' ? -1 : 1)), (r === 'inverse' ? 'own row · inverse' : 'own row') + ' · × weight')); });
  if (rel.length || hat('eigen')) {
    mz.push(zeile('Weight: surprise size · age · market impact', gew));
    mz.push(zeile(`Overdue > ${h.IND_STALE_CYCLES} own cycles`, 0));
  }
  const nur = von('anzeige').map(x => h.indName(x.ind));
  if (nur.length) mz.push(zeile([...new Set(nur)].join(' · '), 0, 'shown only'));
  const relSub = rubs.map(r => (RUB_KURZ[r.name] || r.name) + ' ' + rel.filter(x => x.rub === r).length).join(' · ');
  html += blockHtml('macro', nonFx && lc ? `linked to ${lc} · ${relSub}` : relSub, mz);

  // Rates & yields
  const rz = [];
  von('bond').forEach(x => rz.push(zeile(`${vor(x.rub)}${x.ind.name.replace(' Bond Yield', '')} yield trend up / down`, mal([h.BOND_PKT, -h.BOND_PKT], vzZ(x)), `SMA${h.BOND_SMA_FAST} vs SMA${h.BOND_SMA_SLOW}`)));
  von('kurve').forEach(x => rz.push(zeile(`${vor(x.rub)}Curve 10Y−2Y steeper / flatter`, mal([-h.KURVE_PKT, h.KURVE_PKT], vzZ(x)))));
  von('zinsdiff').forEach(x => h.ZINSDIFF_STUFEN.slice().reverse().forEach(([bp, p]) =>
    rz.push(zeile(`${vor(x.rub)}2Y gap to peers ±${bp} bp in ${h.ZINSDIFF_TAGE}d`, mal([p, -p], vzZ(x)), 'widens / narrows'))));
  if (fx) { const g = h.M28_DECKEL.find(d => d.id === 'rates'); if (g && z.some(x => g.namen.includes(h.stripPeriodSuffix(x.ind.name).base) && x.typ !== 'anzeige')) rz.push(zeile(g.name + ' together', 'max ±' + g.max)); }
  h.DECKEL_ALLE.forEach(g => { if (z.some(x => x.typ === 'bond' && g.namen.includes(x.ind.name))) rz.push(zeile(g.name + ' together', 'max ±' + g.max)); });
  if (hat('realzins')) rz.push(zeile('US 10Y real yield rising / falling', [-h.REALZINS_PKT, h.REALZINS_PKT]));
  if (hat('globalyields')) rz.push(zeile('Global yields above / below EMA ' + h.GLOBAL_YIELDS_EMA, [-h.GLOBAL_YIELDS_PKT, h.GLOBAL_YIELDS_PKT], 'average of all 10Y yields'));
  if (rz.length) rz.push(zeile(`Change < ${Math.round(h.BOND_DEAD_BAND * 100)} bp`, 0, 'dead band'));
  html += blockHtml('rates', '', rz);

  // Commodities
  const oz = [], korb = h.ROHSTOFF_KORB[sid] || h.ROHSTOFF_KORB[lc] || [];
  const st = h.ROHSTOFF_STUFEN.slice().sort((a, b) => a[0] - b[0]);
  von('roh').forEach(x => {
    const id = Object.keys(h.ROHSTOFF_NAME).find(k => h.ROHSTOFF_NAME[k] === x.ind.name);
    const w = ((korb.find(e => e[0] === id) || [])[1]) || 1, v = vz(x.rub);
    oz.push(zeile(`${vor(x.rub)}${h.ROHSTOFF_KURZ(id)} above / below 1D EMA20`, mal([st[0][1] * w, -st[0][1] * w], vzZ(x)), `weight ${w}`));
  });
  if (hat('roh')) {
    oz.push(zeile(st.slice(1).map(s => `${s[0]}+ days`).join(' / ') + ' on that side', st.slice(1).map(s => '×' + Math.round(s[1] / st[0][1] * 100) / 100).join(' / ')));
    oz.push(zeile(`Within ±${h.TREND_NEUTRAL_ATR} × ATR14`, 0));
  }
  if (hat('gas')) oz.push(zeile('Storage change below / above 5-year avg', [h.ZEILE_PKT, -h.ZEILE_PKT], 'EIA, weekly'));
  html += blockHtml('roh', '', oz);

  // Positioning & sentiment
  const pz = [];
  if (hat('cot')) {
    // Modell 42 (2026-11-22): Netto-Positionierung nur Anzeige, Wochenaenderung bei JEDEM Asset mit dem Trend
    const wow = h.COT_WOW_STUFEN.slice().sort((a, b) => a[0] - b[0]);
    pz.push(zeile('COT speculators long / short share', 0, 'shown only'));
    pz.push(zeile(`Long share w/w ${wow.map(s => '+' + s[0]).join(' · ')} pts`, { stufen: wow.map(s => s[1]) }, 'with the move · trend following'));
    pz.push(zeile(`${h.COT_SERIE_RUHE}rd+ week in a row same direction`, 0, 'trend exhausted · the turning week counts again'));
    pz.push(zeile('COT total', 'max ±' + h.COT_MAX));
  }
  if (hat('retail')) {
    pz.push(zeile(`Retail crowd ≥ ${h.RETAIL_AB}% long / short`, [-h.RETAIL_STIMME, h.RETAIL_STIMME], fx ? 'per pair, averaged' : 'against the crowd'));
    pz.push(zeile(`Extreme grows ≥ ${h.RETAIL_WACHS_PKT} pts in ${h.RETAIL_WACHS_TAGE}d`, '×2', 'max ±' + h.RETAIL_STIMME * 2));
  }
  const sentKeys = [...new Set(von('sent').map(x => ((h.SENT_MAP[sid] || []).find(p => p[0] === h.stripPeriodSuffix(x.ind.name).base) || [])[1]).filter(Boolean))];
  sentKeys.forEach(k => { const s = SENT_ZEILE[k]; if (s) pz.push(zeile(s[0], [0.5, -0.5], s[1] + ' · × weight')); });
  if (hat('btcscore')) pz.push(zeile(`BTC sentiment score ≤ ${h.BTC_SCORE_TIEF} / ≥ ${h.BTC_SCORE_HOCH}`, [h.ZEILE_PKT, -h.ZEILE_PKT]));
  von('unbekannt').forEach(x => pz.push(zeile(h.indName(x.ind), '?', 'rule not described yet')));
  html += blockHtml('pos', '', pz);

  // Price trend
  const tz = [];
  if (hat('trend-d')) tz.push(zeile(`Close above / below 1D EMA${h.TREND_EMA_N}`, [h.TREND_PKT, -h.TREND_PKT]));
  if (hat('trend-h')) tz.push(zeile(`Close above / below 4H EMA${h.TREND_EMA_H}`, [h.TREND_PKT_H, -h.TREND_PKT_H]));
  if (tz.length) tz.push(zeile(`Within ±${h.TREND_NEUTRAL_ATR} × ATR${h.TREND_ATR_N}`, 0));
  html += blockHtml('trend', fx ? 'basket vs the other 7 currencies' : 'last closed candle', tz);

  // Seasonality
  if (hat('seas')) html += blockHtml('seas', '15 years, this month', [
    zeile(`Up on avg + ≥ ${h.SEAS_HIT_HOCH}% up years`, 0.5, '× weight'),
    zeile(`Down on avg + ≤ ${h.SEAS_HIT_TIEF}% up years`, -0.5, '× weight'),
    zeile(`Same direction, ${h.SEAS_HIT_TIEF}–${h.SEAS_HIT_HOCH}% up years (grey zone)`, [h.SEAS_GRAU_PKT, -h.SEAS_GRAU_PKT]),
    zeile('Hit rate points the other way', 0),
  ]);

  // Endrechnung
  html += `<div class="sr-end">
    <div class="sr-z"><span class="sr-z-t">Bias</span><span class="sr-z-p"><b class="sr-neu">raw sum of all rows</b></span></div>
    <div class="sr-z"><span class="sr-z-t">Shown score<em>fewer rows ≠ weaker score</em></span><span class="sr-z-p"><b class="sr-neu">raw sum × (Ø rows of the 8 currencies ÷ own rows)</b></span></div>
  </div>`;
  return html;
}

export function openScoreRegeln(symId) {
  const h = H; if (!h) return;
  const sym = h.syms().find(s => s.id === symId); if (!sym) return;
  const t = document.getElementById('srTitel'), b = document.getElementById('srBody'), g = document.getElementById('srGear');
  if (!t || !b) return;
  t.textContent = 'How the score works · ' + (sym.name || sym.id);
  b.innerHTML = srFensterHtml(sym);
  // Zahnrad nur, wo es Einstellungen gibt (Nicht-FX, Nutzerwahl 2026-11-22).
  if (g) { g.hidden = !h.isNonFx(symId); if (!g.firstChild) g.innerHTML = h.icn('gear', 17); }
  h.openM('mScoreRegeln');
  const m = b.closest('.modal'); if (m) m.scrollTop = 0;   // neues Asset = von oben, nicht beim Stand des letzten
}
// Zahnrad: Settings des Assets. openAssetCfg() liest getSym() - auf der
// Asset-Seite ist das das gezeigte Asset; das Regeln-Fenster schliesst sich,
// damit die Settings nicht dahinter aufgehen.
export function srZahnrad() {
  const h = H; if (!h) return;
  h.closeM('mScoreRegeln');
  h.openAssetCfg();
}
