#!/usr/bin/env python3
"""Backtest der drei Niveau-Zeilen, die tools/niveau_backtest.py mangels
Historie nicht pruefen kann (Wages, PMI, Rate Path) - Reihen aus dem
Kalender-Archiv cal_hist/ (TradingView, Erstveroeffentlichung, ab 2016-09),
ergaenzt um historyFull aus ind_data.json.

Grenzen der Quelle (gemessen 2026-10-17):
- S&P-Global-/HCOB-/Jibun-PMIs (EUR GBP JPY AUD CAD) stehen im Archiv OHNE
  Actual (lizenzpflichtig) -> PMI nur fuer USD (ISM), CHF (procure.ch/SVME),
  NZD (BusinessNZ): KEIN Querschnitt, nur Zeitreihen-Test je Waehrung.
- 2Y-Rendite: Auktionsrendite USD 2-Year Note, EUR German 2-Year Schatz,
  CAD 2-Year Bond (ab 2021), JPY 2-Year JGB (ab 2022); NZD 1-Year Bill als
  Variante. GBP/AUD/CHF haben keine 2Y-Auktion im Archiv.
- Wages: 7 von 8 (CHF fehlt).
Aufruf: python3 tools/niveau_backtest_archiv.py
"""
import json, math, os, re, statistics as st
from datetime import date, timedelta
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
FX = ['USD','EUR','GBP','CHF','JPY','CAD','AUD','NZD']
IND = json.load(open(R+'ind_data.json'))
PH = json.load(open(R+'price_hist.json'))['assets']; PD = json.load(open(R+'price_data.json'))
EV = []
for y in json.load(open(R+'cal_hist/meta.json'))['jahre']:
    EV += json.load(open(R+f'cal_hist/{y}.json'))['ev']
D = lambda s: date.fromisoformat(str(s)[:10])
def num(x):
    m = re.search(r'-?\d[\d.,]*', str(x or ''))
    return float(m.group(0).replace(',','')) if m else None
def archiv(c, titel):
    out = {}
    for r in EV:
        if r[1] == c and r[2] in titel and num(r[4]) is not None: out[r[0][:10]] = num(r[4])
    return out
def ind(c, b):
    e = IND.get(c, {}).get(b); out = {}
    for h in (e or {}).get('historyFull') or []:
        v = num(h[1])
        if v is not None: out[str(h[0])[:10]] = v
    return out
def reihe(*teile):
    m = {}
    for t in teile: m.update(t)
    return sorted((D(k), v) for k, v in m.items())

# ── Kurse / Korb (wie tools/niveau_backtest.py) ─────────────────────────────
def kurs(c):
    inv = PD[c].get('invert'); s = {}
    for d, v in PH[c]: s[D(d)] = v
    for row in PD[c]['series']: s[D(row[0])] = row[1]
    return {d: (1/v if inv else v) for d, v in s.items() if v}
K = {c: kurs(c) for c in FX if c != 'USD'}
def wert(c, d):
    if c == 'USD': return 1.0
    for k in range(6):
        x = K[c].get(d - timedelta(days=k))
        if x: return x
    return None
def korb_ret(c, d0, d1):
    a = [wert(x, d0) for x in FX]; b = [wert(x, d1) for x in FX]
    if None in a or None in b: return None
    lr = {x: math.log(b[i]/a[i]) for i, x in enumerate(FX)}
    return lr[c] - sum(lr[x] for x in FX if x != c) / 7
def med(a):
    s = sorted(a); n = len(s); return s[n//2] if n % 2 else (s[n//2-1]+s[n//2])/2
def robust(r, stich, akt_tage, min_jahre=5):
    r = [x for x in r if x[0] <= stich]
    if len(r) < 12 or r[0][0] > stich - timedelta(days=min_jahre*365): return None
    if (stich - r[-1][0]).days > 200: return None
    f = [v for d, v in r if d >= stich - timedelta(days=3652)]
    m = med(f); mad = med([abs(v-m) for v in f]) * 1.4826
    if mad <= 0: return None
    akt = [v for d, v in r if d >= r[-1][0] - timedelta(days=akt_tage)]
    return (sum(akt)/len(akt) - m) / mad
def letzter(r, stich, max_tage):
    r = [x for x in r if x[0] <= stich]
    return r[-1] if r and (stich - r[-1][0]).days <= max_tage else None
def rank(v):
    s = sorted(range(len(v)), key=lambda i: v[i]); r = [0]*len(v)
    for k, i in enumerate(s): r[i] = k
    return r
def corr(a, b):
    ma, mb = sum(a)/len(a), sum(b)/len(b)
    sa = math.sqrt(sum((x-ma)**2 for x in a)); sb = math.sqrt(sum((x-mb)**2 for x in b))
    return 0 if sa == 0 or sb == 0 else sum((x-ma)*(y-mb) for x, y in zip(a, b))/(sa*sb)
def monatsenden(a, b):
    d = date(a.year, a.month, 1); out = []
    while d < b:
        n = date(d.year + (d.month == 12), d.month % 12 + 1, 1); out.append(n - timedelta(days=1)); d = n
    return out
ENDE = max(D(r[0]) for r in PD['EUR']['series'])
STICH = monatsenden(date(2017,1,1), ENDE)
def stufe(st_, x):
    x = round(x, 3)
    for ab, p in st_:
        if abs(x) >= ab: return math.copysign(p, x)
    return 0

# ── Reihen ──────────────────────────────────────────────────────────────────
LOHN_TITEL = {'USD': ['Average Hourly Earnings YoY'], 'EUR': ['Wage Growth YoY'],
  'GBP': ['Average Earnings incl. Bonus', 'Average Earnings incl. Bonus (3Mo/Yr)'],
  'JPY': ['Average Cash Earnings YoY'], 'CAD': ['Average Hourly Wages YoY'],
  'AUD': ['Wage Price Index YoY'], 'NZD': ['Labour Costs Index YoY']}
LOHN = {c: reihe(ind(c, 'Avg Hourly Earnings') if c not in ('EUR',) else {}, archiv(c, t)) for c, t in LOHN_TITEL.items()}
PMI_TITEL = {'USD': ['ISM Manufacturing PMI'], 'CHF': ['SVME Manufacturing PMI', 'procure.ch Manufacturing PMI'],
  'NZD': ['Business NZ PMI']}
PMI = {c: reihe(archiv(c, t)) for c, t in PMI_TITEL.items()}
Y2_TITEL = {'USD': ['2-Year Note Auction'], 'EUR': ['German 2-Year Schatz Auction'],
  'CAD': ['2-Year Bond Auction'], 'JPY': ['2-Year JGB Auction'], 'NZD': ['1-Year Bill Auction']}
Y2 = {c: reihe(archiv(c, t)) for c, t in Y2_TITEL.items()}
CB = {c: reihe(ind(c, 'Central Bank Rate')) for c in FX}

def lauf(name, sig_fn, waehrungen, stufen, min_peers):
    """Querschnitt: Signal relativ zum Mittel der uebrigen Waehrungen der Menge."""
    out = {}
    for h in (1, 3):
        ics = []; hits = []; ls = []; pool_x = []; pool_y = []; monate = 0
        for s in STICH:
            e = monatsenden(s + timedelta(days=1), s + timedelta(days=31*h+5))
            if len(e) < h or e[h-1] > ENDE: continue
            sig = {c: sig_fn(c, s) for c in waehrungen}; sig = {c: v for c, v in sig.items() if v is not None}
            if len(sig) < min_peers + 1: continue
            rel = {c: v - sum(sig[x] for x in sig if x != c)/(len(sig)-1) for c, v in sig.items()}
            fw = {c: korb_ret(c, s, e[h-1]) for c in rel}; cs = [c for c in rel if fw[c] is not None]
            if len(cs) < min_peers + 1: continue
            monate += 1
            pool_x += [rel[c] for c in cs]; pool_y += [fw[c] for c in cs]
            if len(cs) >= 4: ics.append(corr(rank([rel[c] for c in cs]), rank([fw[c] for c in cs])))
            for c in cs:
                p = stufe(stufen, rel[c])
                if p: hits.append(1 if (p > 0) == (fw[c] > 0) else 0)
            o = sorted(cs, key=lambda c: rel[c]); ls.append(fw[o[-1]] - fw[o[0]])
        if not monate: out[h] = f"{name:28} {h}M  keine Monate"; continue
        pc = corr(rank(pool_x), rank(pool_y))
        icm = st.mean(ics) if ics else float('nan')
        t = icm/(st.pstdev(ics) or 1e-9)*math.sqrt(len(ics)/h) if len(ics) > 2 else float('nan')
        out[h] = (f"{name:28} {h}M  Monate {monate:3}  Pool-IC {pc:+.3f}  IC/Monat {icm:+.3f} t {t:+.2f} (n {len(ics)})  "
                  f"Treffer {st.mean(hits)*100 if hits else float('nan'):.1f}% (n {len(hits)})  Top-Bottom {st.mean(ls)*100/h:+.3f}%/Mon")
    return out

def zeitreihe(name, sig_fn, waehrungen, stufen):
    """Ohne Querschnitt: absolutes Signal je Waehrung gegen ihre eigene Korb-Rendite."""
    out = {}
    for h in (1, 3):
        x = []; y = []; hits = []; je = {}
        for c in waehrungen:
            for s in STICH:
                e = monatsenden(s + timedelta(days=1), s + timedelta(days=31*h+5))
                if len(e) < h or e[h-1] > ENDE: continue
                v = sig_fn(c, s); f = korb_ret(c, s, e[h-1])
                if v is None or f is None: continue
                x.append(v); y.append(f); je.setdefault(c, []).append((v, f))
                p = stufe(stufen, v)
                if p: hits.append(1 if (p > 0) == (f > 0) else 0)
        jc = ' '.join(f"{c} {corr(rank([a for a, _ in l]), rank([b for _, b in l])):+.2f}({len(l)})" for c, l in je.items())
        out[h] = (f"{name:28} {h}M  n {len(x):4}  Pool-IC {corr(rank(x), rank(y)):+.3f}  "
                  f"Treffer {st.mean(hits)*100 if hits else float('nan'):.1f}% (n {len(hits)})  je Waehrung: {jc}")
    return out

def lohn_sig(min_j):
    return lambda c, s: robust(LOHN.get(c, []), s, 92, min_j) if c in LOHN else None
def pmi_sig(c, s):
    p = letzter(PMI.get(c, []), s, 45); return p[1] - 50 if p else None
def pfad_sig(c, s):
    y = letzter(Y2.get(c, []), s, 45); cb = letzter(CB[c], s, 400)
    return (y[1] - cb[1]) * 100 if y and cb else None   # bp

ST_LOHN = [[1.5,.75],[.75,.5]]; ST_PMI = [[4,.75],[1.5,.5]]; ST_PFAD = [[60,.75],[25,.5]]
print(f"Stichtage {STICH[0]} .. {STICH[-1]}, Kurse bis {ENDE}")
for c, r in LOHN.items(): print(f"  Lohn {c}: {len(r)} Werte ab {r[0][0] if r else '-'}")
for c, r in Y2.items(): print(f"  2Y {c}: {len(r)} Werte ab {r[0][0] if r else '-'}")
for c, r in PMI.items(): print(f"  PMI {c}: {len(r)} Werte ab {r[0][0] if r else '-'}")
print("\n== Wages vs Normal (Querschnitt, robuster z) ==")
for v in lauf('Wages 5J-Fenster (wie App)', lohn_sig(5), list(LOHN), ST_LOHN, 3).values(): print(v)
for v in lauf('Wages 3J-Fenster (Probe)', lohn_sig(3), list(LOHN), ST_LOHN, 3).values(): print(v)
print("\n== Rate Path: 2Y minus Leitzins (Querschnitt) ==")
for v in lauf('Pfad USD/EUR/CAD/JPY', pfad_sig, ['USD','EUR','CAD','JPY'], ST_PFAD, 1).values(): print(v)
for v in lauf('Pfad + NZD (1Y Bill)', pfad_sig, ['USD','EUR','CAD','JPY','NZD'], ST_PFAD, 1).values(): print(v)
for v in zeitreihe('Pfad je Waehrung absolut', pfad_sig, ['USD','EUR','CAD','JPY','NZD'], ST_PFAD).values(): print(v)
print("\n== PMI vs 50 (nur USD/CHF/NZD frei verfuegbar) ==")
for v in lauf('PMI Querschnitt (3 Waehr.)', pmi_sig, list(PMI), ST_PMI, 1).values(): print(v)
for v in zeitreihe('PMI je Waehrung absolut', pmi_sig, list(PMI), ST_PMI).values(): print(v)

# ── Economic Growth: Kandidaten fuer eine Niveau-Zeile (Modell 26-Pruefung) ──
# Regel VOR dem Lauf festgelegt: aufgenommen wird nur, was in 1M UND 3M einen
# positiven Pool-IC und eine Trefferquote > 50 % hat.
VERTR = {c: reihe(ind(c, 'Consumer Confidence')) for c in FX}
VERTR = {c: r for c, r in VERTR.items() if len(r) > 24}
EH_TITEL = {'USD': ['Retail Sales YoY'], 'EUR': ['Retail Sales YoY'], 'GBP': ['Retail Sales YoY'], 'CHF': ['Retail Sales YoY'],
  'JPY': ['Retail Sales YoY'], 'CAD': ['Retail Sales YoY'], 'NZD': ['Retail Sales YoY']}
EH = {c: reihe(ind(c, 'Retail Sales') if c == 'CHF' else {}, archiv(c, t)) for c, t in EH_TITEL.items()}
IP_TITEL = {'USD': ['Industrial Production YoY'], 'EUR': ['Industrial Production YoY'], 'GBP': ['Industrial Production YoY'],
  'JPY': ['Industrial Production YoY Final', 'Industrial Production YoY Prel'], 'CHF': ['Industrial Production YoY']}
IP = {c: reihe(archiv(c, t)) for c, t in IP_TITEL.items()}
def trend(r, s, tage=92):
    r = [x for x in r if x[0] <= s]
    if len(r) < 6 or (s - r[-1][0]).days > 120: return None
    l = r[-1][0]; a = [v for d, v in r if d > l - timedelta(days=tage)]; b = [v for d, v in r if l - timedelta(days=2*tage) < d <= l - timedelta(days=tage)]
    return (sum(a)/len(a) - sum(b)/len(b)) if a and b else None
ST_Z = [[1.5,.75],[.75,.5]]
for c, r in VERTR.items(): print(f"  Vertrauen {c}: {len(r)} Werte ab {r[0][0]}")
for c, r in EH.items(): print(f"  Einzelhandel y/y {c}: {len(r)} Werte ab {r[0][0] if r else '-'}")
print("\n== Economic Growth: Kandidaten ==")
KAND = [('Consumer Confidence vs Normal', lambda c, s: robust(VERTR[c], s, 92) if c in VERTR else None, list(VERTR), ST_Z),
        ('Consumer Confidence Trend 3M', lambda c, s: trend(VERTR[c], s) if c in VERTR else None, list(VERTR), [[5,.5],[2,.25]]),
        ('Retail Sales y/y vs Normal', lambda c, s: robust(EH[c], s, 92, 3) if c in EH else None, list(EH), ST_Z),
        ('Industrial Prod. y/y vs Normal', lambda c, s: robust(IP[c], s, 92, 3) if c in IP else None, list(IP), ST_Z)]
for name, fn, ws, stf in KAND:
    for v in lauf(name, fn, ws, stf, 3).values(): print(v)

# ── Wachstums-MOMENTUM nach Dahlquist/Hasseltoft (JFE 2020): Richtung statt Niveau ──
# "Trend" = aktueller Wert minus Mittel der 12 Monate davor (Paper-Definition) bzw.
# 3M-Aenderung (wie Inflation/Unemployment Trend der App). Gleiche Regel wie oben.
def dh(r, s):
    r = [x for x in r if x[0] <= s]
    if len(r) < 8 or (s - r[-1][0]).days > 120: return None
    l = r[-1][0]; vor = [v for d, v in r if l - timedelta(days=380) <= d < l - timedelta(days=20)]
    return r[-1][1] - sum(vor)/len(vor) if len(vor) >= 3 else None
def komb(*quellen):
    def f(c, s):
        w = [fn(c, s) for fn in quellen]; w = [x for x in w if x is not None]
        return sum(w)/len(w) if w else None
    return f
eh_dh = lambda c, s: dh(EH[c], s) if c in EH else None
ip_dh = lambda c, s: dh(IP[c], s) if c in IP else None
eh_3m = lambda c, s: trend(EH[c], s) if c in EH else None
ip_3m = lambda c, s: trend(IP[c], s) if c in IP else None
ST_MOM = [[3,.5],[1,.25]]
print("\n== Wachstums-Momentum (Dahlquist/Hasseltoft) ==")
for name, fn, ws in [('Retail y/y Momentum (12M)', eh_dh, list(EH)), ('Retail y/y Trend 3M', eh_3m, list(EH)),
                     ('Ind.Prod y/y Momentum (12M)', ip_dh, list(IP)), ('Ind.Prod y/y Trend 3M', ip_3m, list(IP)),
                     ('Growth Momentum (Retail+IP)', komb(eh_dh, ip_dh), sorted(set(EH) | set(IP)))]:
    for v in lauf(name, fn, ws, ST_MOM, 3).values(): print(v)
