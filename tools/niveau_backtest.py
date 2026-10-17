#!/usr/bin/env python3
"""Backtest des Niveau-Blocks (Score-Modell 23+): sagen die Niveau-Signale die
Korb-Entwicklung einer Waehrung in den Folgemonaten voraus?

Point-in-time: an jedem Monatsende nur Releases mit Datum <= Stichtag
(historyFull aus ind_data.json; Revisionen sind dort nicht nachgezogen -
die Reihe ist die Erstveroeffentlichung, also kein Blick in die Zukunft).
Signale exakt wie applyNiveauFeed (js/main.js): robuster z gegen 10 Jahre
(mind. 5 J), Waehrung relativ zum Mittel der anderen sieben.
Ziel: Korb-Rendite = log-Rendite der Waehrung gegen den Durchschnitt der
anderen sieben (wie korbReihe), ueber 1 und 3 Monate.
Kennzahlen je Signal: mittlere Rang-IC (Spearman je Monat), t-Wert der IC,
Trefferquote des Vorzeichens (nur Monate/Waehrungen mit Punkten != 0) und
die Monatsrendite einer Long-Top-2/Short-Bottom-2-Auswahl.
Aufruf: python3 tools/niveau_backtest.py
"""
import json, math, statistics as st
from datetime import date, timedelta
R = '/home/user/FX-final/' if __name__ == '__main__' else ''
import os; R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
FX = ['USD','EUR','GBP','CHF','JPY','CAD','AUD','NZD']
ZIEL = {'USD':2,'EUR':2,'GBP':2,'JPY':2,'CHF':1,'CAD':2,'AUD':2.5,'NZD':2}
IND = json.load(open(R+'ind_data.json'))
PH = json.load(open(R+'price_hist.json'))['assets']; PD = json.load(open(R+'price_data.json'))
D = lambda s: date.fromisoformat(str(s)[:10])
def num(x):
    import re
    m = re.search(r'-?\d[\d.,]*', str(x or ''))
    return float(m.group(0).replace(',','')) if m else None
def reihe(c, b):
    e = IND.get(c, {}).get(b); out = {}
    for h in (e or {}).get('historyFull') or []:
        v = num(h[1])
        if v is not None: out[str(h[0])[:10]] = v
    return sorted((D(k), v) for k, v in out.items())
# Waehrungswert in USD je Tag
def kurs(c):
    inv = PD[c].get('invert'); s = {}
    for d, v in PH[c]: s[D(d)] = v
    for row in PD[c]['series']: s[D(row[0])] = row[1]
    if c == 'USD': return None
    return {d: (1/v if inv else v) for d, v in s.items() if v}
K = {c: kurs(c) for c in FX}
def wert(c, d):
    if c == 'USD': return 1.0
    s = K[c]
    for k in range(6):
        x = s.get(d - timedelta(days=k))
        if x: return x
    return None
def korb_ret(c, d0, d1):
    a = [wert(x, d0) for x in FX]; b = [wert(x, d1) for x in FX]
    if None in a or None in b: return None
    lr = {x: math.log(b[i]/a[i]) for i, x in enumerate(FX)}
    return lr[c] - sum(lr[x] for x in FX if x != c) / 7
def med(a):
    s = sorted(a); n = len(s); return s[n//2] if n % 2 else (s[n//2-1]+s[n//2])/2
def robust(r, stich, akt_tage, vz=1):
    r = [x for x in r if x[0] <= stich]
    if len(r) < 12 or r[0][0] > stich - timedelta(days=5*365): return None
    if (stich - r[-1][0]).days > 200: return None
    f = [v for d, v in r if d >= stich - timedelta(days=3652)]
    if len(f) < 12: return None
    m = med(f); mad = med([abs(v-m) for v in f]) * 1.4826
    if mad <= 0: return None
    akt = [v for d, v in r if d >= r[-1][0] - timedelta(days=akt_tage)]
    return vz * (sum(akt)/len(akt) - m) / mad
def letzter(r, stich, max_tage):
    r = [x for x in r if x[0] <= stich]
    return r[-1] if r and (stich - r[-1][0]).days <= max_tage else None
def signale(c, stich):
    o = {}
    inf_b = ['PCE','Core PCE'] if c == 'USD' else ['CPI (Headline)','Core CPI']
    w = [letzter(reihe(c, b), stich, 120) for b in inf_b]; w = [x[1] for x in w if x]
    if w: o['infl'] = sum(w)/len(w) - ZIEL[c]
    z = robust(reihe(c,'Unemployment Rate'), stich, 92, -1)
    if z is not None: o['lab'] = z
    e = IND.get(c, {}).get('Avg Hourly Earnings') or {}
    if 'y/y' in str(e.get('period','')).lower() or 'yoy' in str(e.get('event','')).lower() or '3mo/yr' in str(e.get('event','')).lower():
        z = robust(reihe(c,'Avg Hourly Earnings'), stich, 92)
        if z is not None: o['wage'] = z
    z = robust(reihe(c,'GDP Growth QoQ'), stich, 100)
    if z is not None: o['gdp'] = z
    pm = letzter(reihe(c,'Manufacturing PMI'), stich, 45)
    if pm: o['pmi'] = pm[1] - 50
    cb = letzter(reihe(c,'Central Bank Rate'), stich, 400); hi = letzter(reihe(c,'CPI (Headline)'), stich, 120)
    if cb and hi: o['_real'] = cb[1] - hi[1]
    ir = [x for x in reihe(c, 'PCE' if c == 'USD' else 'CPI (Headline)') if x[0] <= stich]
    if len(ir) >= 4 and (stich - ir[-1][0]).days <= 120:
        vor = [x for x in ir if x[0] <= ir[-1][0] - timedelta(days=80)]
        if vor and (ir[-1][0]-vor[-1][0]).days <= 200: o['inflT'] = ir[-1][1] - vor[-1][1]
    ur = [x for x in reihe(c,'Unemployment Rate') if x[0] <= stich]
    if len(ur) >= 6 and (stich - ur[-1][0]).days <= 200:
        l = ur[-1][0]; a = [v for d,v in ur if d > l-timedelta(days=92)]; b = [v for d,v in ur if l-timedelta(days=184) < d <= l-timedelta(days=92)]
        if a and b: o['labT'] = -(sum(a)/len(a) - sum(b)/len(b))
    return o
STUFEN = {'infl':[[2,1],[1,.75],[.5,.5]],'real':[[1.5,.75],[.75,.5]],'lab':[[1.5,1],[1,.75],[.5,.5]],'wage':[[1.5,.75],[.75,.5]],
          'gdp':[[1,.75],[.5,.5]],'pmi':[[4,.75],[1.5,.5]],'inflT':[[.7,.5],[.3,.25]],'labT':[[.4,.5],[.2,.25]]}
def stufe(t, x):
    x = round(x, 3)
    for ab, p in STUFEN[t]:
        if abs(x) >= ab: return math.copysign(p, x)
    return 0
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
ende = max(D(r[0]) for r in PD['EUR']['series'])
stichtage = [d for d in monatsenden(date(2018,1,1), ende)]
TYP = ['infl','real','lab','wage','gdp','pmi','inflT','labT','BLOCK']
res = {h: {t: {'ic':[], 'hit':[], 'ls':[]} for t in TYP} for h in (1,3)}
for s in stichtage:
    sig = {c: signale(c, s) for c in FX}
    rz = {c: sig[c].get('_real') for c in FX}
    for c in FX:
        p = [rz[x] for x in FX if x != c and rz[x] is not None]
        if rz[c] is not None and len(p) >= 5: sig[c]['real'] = rz[c] - sum(p)/len(p)
    rel = {c: {} for c in FX}
    for t in TYP[:-1]:
        for c in FX:
            if t not in sig[c]: continue
            if t == 'real': rel[c][t] = sig[c][t]; continue
            p = [sig[x][t] for x in FX if x != c and t in sig[x]]
            if len(p) >= 4: rel[c][t] = sig[c][t] - sum(p)/len(p)
    for c in FX:
        pk = [stufe(t, rel[c][t]) for t in rel[c]]
        if pk: rel[c]['BLOCK'] = sum(pk)
    for h in (1, 3):
        e = monatsenden(s + timedelta(days=1), s + timedelta(days=31*h+5))
        if len(e) < h: continue
        s1 = e[h-1]
        if s1 > ende: continue
        fw = {c: korb_ret(c, s, s1) for c in FX}
        for t in TYP:
            cs = [c for c in FX if t in rel[c] and fw[c] is not None]
            if len(cs) < 5: continue
            x = [rel[c][t] for c in cs]; y = [fw[c] for c in cs]
            res[h][t]['ic'].append(corr(rank(x), rank(y)))
            for c in cs:
                pt = rel[c][t] if t == 'BLOCK' else stufe(t, rel[c][t])
                if pt: res[h][t]['hit'].append(1 if (pt > 0) == (fw[c] > 0) else 0)
            o = sorted(cs, key=lambda c: rel[c][t])
            res[h][t]['ls'].append((sum(fw[c] for c in o[-2:]) - sum(fw[c] for c in o[:2]))/2)
print(f"Stichtage {stichtage[0]} .. {stichtage[-1]} ({len(stichtage)} Monate), Kurse bis {ende}")
for h in (1, 3):
    print(f"\n== Horizont {h} Monat(e) ==")
    print(f"{'Signal':8} {'Monate':>6} {'IC':>7} {'t(IC)':>6} {'Treffer':>8} {'n':>5} {'L/S %/Mon':>10}")
    for t in TYP:
        r = res[h][t]; n = len(r['ic'])
        if n < 6: print(f"{t:8} {n:6}   (zu wenig Monate)"); continue
        ic = st.mean(r['ic']); sd = st.pstdev(r['ic']) or 1e-9
        tval = ic / sd * math.sqrt(n / (h if h > 1 else 1))   # ueberlappende 3M-Fenster: effektiv n/3
        hit = st.mean(r['hit']) if r['hit'] else float('nan')
        ls = st.mean(r['ls']) * 100 / h
        print(f"{t:8} {n:6} {ic:7.3f} {tval:6.2f} {hit*100:7.1f}% {len(r['hit']):5} {ls:10.3f}")

# ── Stabilitaet: zwei Haelften + Block-Varianten ─────────────────────────
def block_lauf(typen, von, bis, h):
    ics=[];hits=[];ls=[]
    for s in [d for d in stichtage if von <= d <= bis]:
        sig = {c: signale(c, s) for c in FX}
        rz = {c: sig[c].get('_real') for c in FX}
        for c in FX:
            p = [rz[x] for x in FX if x != c and rz[x] is not None]
            if rz[c] is not None and len(p) >= 5: sig[c]['real'] = rz[c] - sum(p)/len(p)
        blk = {}
        for c in FX:
            pk = []
            for t in typen:
                if t not in sig[c]: continue
                if t == 'real': pk.append(stufe(t, sig[c][t])); continue
                p = [sig[x][t] for x in FX if x != c and t in sig[x]]
                if len(p) >= 4: pk.append(stufe(t, sig[c][t] - sum(p)/len(p)))
            if pk: blk[c] = sum(pk)
        e = monatsenden(s + timedelta(days=1), s + timedelta(days=31*h+5))
        if len(e) < h or e[h-1] > ende: continue
        fw = {c: korb_ret(c, s, e[h-1]) for c in FX}
        cs = [c for c in blk if fw[c] is not None]
        if len(cs) < 5: continue
        ics.append(corr(rank([blk[c] for c in cs]), rank([fw[c] for c in cs])))
        hits += [1 if (blk[c] > 0) == (fw[c] > 0) else 0 for c in cs if blk[c]]
        o = sorted(cs, key=lambda c: blk[c]); ls.append((sum(fw[c] for c in o[-2:]) - sum(fw[c] for c in o[:2]))/2)
    n=len(ics); ic=st.mean(ics); t=ic/(st.pstdev(ics) or 1e-9)*math.sqrt(n/h)
    return f"IC {ic:+.3f} t {t:+.2f} Treffer {st.mean(hits)*100:.1f}% (n {len(hits)}) L/S {st.mean(ls)*100/h:+.3f}%/Mon"
VARIANTEN = {'alle 8 (Modell 23)': ['infl','real','lab','wage','gdp','pmi','inflT','labT'],
             'ohne real+gdp':      ['infl','lab','wage','pmi','inflT','labT'],
             'nur Inflation':      ['infl','inflT']}
H1, H2 = (date(2018,1,1), date(2022,5,31)), (date(2022,6,1), date(2026,12,31))
print("\n== Block-Varianten, Stabilitaet ==")
for name, typen in VARIANTEN.items():
    for h in (1, 3):
        print(f"{name:22} {h}M  2018-22: {block_lauf(typen,*H1,h)}")
        print(f"{'':22} {h}M  2022-26: {block_lauf(typen,*H2,h)}")
