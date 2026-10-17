#!/usr/bin/env python3
"""Backtests behind the Bitcoin dashboard: the market mood index and the four-year halving cycle.

Every parameter below was fixed before the tests were run (see METHODOLOGY.md); nothing is
tuned on Bitcoin's own history. Recomputes the mood exactly as indicators.js does.

    pip install pandas numpy
    python3 tools/backtest.py               # prints every table in METHODOLOGY.md
    python3 tools/backtest.py --csv mood.csv
"""
import json, sys, math, pathlib
import numpy as np, pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSV = sys.argv[sys.argv.index("--csv") + 1] if "--csv" in sys.argv else None
s = open(ROOT / "data.js").read()
D = json.loads(s[s.index("=") + 1:].strip().rstrip(";"))
idx = pd.to_datetime(np.array(D["d"]) * 86400, unit="s")
df = pd.DataFrame({k: pd.Series(D[k], index=idx, dtype=float) for k in ("c", "mvrv", "hash", "addr")})
p = df.c
print("BTC", p.index[0].date(), "to", p.index[-1].date(), len(p), "days")

# ---------- fixed parameters (calendar days: bitcoin trades every day) ----------
TREND_MA, YEAR, VOL_WIN, RANK_WIN, RANK_MIN = 200, 365, 30, 365 * 3, 365
HORIZONS = (30, 90, 180, 365)
HALVINGS = pd.to_datetime(["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20"])
NEXT_HALVING = pd.Timestamp("2028-04-15")       # estimate, block 1,050,000
BULL_DAYS = 548                                  # "18 months after the halving", the folk rule

r = p.pct_change()
fwd = {h: p.shift(-h) / p - 1 for h in HORIZONS}

def strat(pos, ret=r):
    """pos decided at close t, earns day t+1. Returns CAGR, vol, max drawdown, time in market."""
    pos = pos.shift(1).reindex(ret.index)
    ok = pos.notna() & ret.notna()
    pr = (pos[ok] * ret[ok])
    eq = (1 + pr).cumprod()
    yrs = ok.sum() / 365
    return eq.iloc[-1] ** (1 / yrs) - 1, pr.std() * math.sqrt(365), (eq / eq.cummax() - 1).min(), pos[ok].mean()

def fmt(name, c):
    return f"  {name:34s} CAGR {c[0]:7.1%}  vol {c[1]:5.0%}  maxDD {c[2]:6.1%}  in market {c[3]:4.0%}"

def bucket_table(x, label, cuts, names):
    b = pd.cut(x, cuts, labels=names)
    print(f"\n{label}")
    for nm in names:
        sel = b == nm
        row = [f"{nm:>14s} days {sel.sum():5d}"]
        for h in HORIZONS:
            v = fwd[h][sel].dropna()
            row.append(f"{h:3d}d {v.median():+7.1%} (up {(v > 0).mean():4.0%})" if len(v) else f"{h:3d}d      --")
        print("  " + " | ".join(row))

def episodes(mask, gap=180):
    out, last = [], None
    for d_ in mask[mask].index:
        if last is None or (d_ - last).days > gap:
            out.append(d_)
        last = d_
    return out

# ---------- 1. the mood components ----------
def prank(x):
    return x.rolling(RANK_WIN, min_periods=RANK_MIN).rank(pct=True)
raw = pd.DataFrame({
    "trend": p / p.rolling(TREND_MA).mean() - 1,
    "valuation": df.mvrv,
    "network": df.addr.rolling(30).mean() / df.addr.rolling(YEAR).mean() - 1,
    "drawdown": p / p.rolling(YEAR).max() - 1,
    "vol": r.rolling(VOL_WIN).std() * math.sqrt(365),
})
comp = pd.DataFrame({k: prank(raw[k]) for k in ("trend", "valuation", "network", "drawdown")})
comp["calm"] = 1 - prank(raw.vol)
mood = comp.mean(1, skipna=True).where(comp.notna().sum(1) >= 3) * 100
print("mood from", mood.first_valid_index().date(), "| today", round(mood.iloc[-1], 1))
print("\ncomponent correlation\n", comp.corr().round(2))

print("\n1. Each component on its own: percentile rank vs trailing 3y, median forward return")
for k in comp:
    bucket_table(comp[k], k, [-.01, .2, .4, .6, .8, 1.01], ["0-20", "20-40", "40-60", "60-80", "80-100"])

# ---------- 2. the composite ----------
BANDS = [(-1, 20, "Extreme fear"), (20, 40, "Fear"), (40, 60, "Neutral"), (60, 80, "Greed"), (80, 101, "Extreme greed")]
bucket_table(mood, "2. Composite mood", [-1, 20, 40, 60, 80, 101], [b[2] for b in BANDS])
print("\n2b. 12-month outcome by calendar year of the signal (year-averaged), and episodes")
f365 = fwd[365]
for lo, hi, nm in BANDS + [(-1, 101, "All days")]:
    sel = (mood >= lo) & (mood < hi)
    v = f365[sel].dropna()
    yr = v.groupby(v.index.year).mean()
    ep = "" if nm == "All days" else f", {len(episodes(sel.fillna(False)))} episodes"
    late = v["2017":]
    print(f"  {nm:>13s}: higher in {(yr > 0).sum():2d} of {len(yr):2d} years, median year {yr.median():+7.1%}, "
          f"median day {v.median():+7.1%}{ep} | since 2017: median day {late.median():+7.1%}, up {(late > 0).mean():4.0%} (n{len(late)})")
for lo, hi, nm in (BANDS[0], BANDS[-1]):
    print(f"  {nm} episodes: " + ", ".join(str(e.date())[:7] for e in episodes(((mood >= lo) & (mood < hi)).fillna(False))))

# ---------- 3. trading rules on the same sample (from the first halving) ----------
S0 = HALVINGS[0]
rs = r[S0:]
since = (pd.Series(p.index, index=p.index) - pd.Series(p.index, index=p.index).where(p.index.isin(HALVINGS)).ffill()).dt.days
till = (pd.Series(p.index, index=p.index).where(p.index.isin(HALVINGS)).bfill().fillna(NEXT_HALVING) - pd.Series(p.index, index=p.index)).dt.days
fixed = {
    "Buy and hold": pd.Series(1.0, index=p.index),
    "200-day SMA (above = long)": (p >= p.rolling(TREND_MA).mean()).astype(float),
    "Cycle: 0-18m after halving": (since < BULL_DAYS).astype(float),
    "Cycle: 12m before to 18m after": ((since < BULL_DAYS) | (till <= 365)).astype(float),
    "Cycle 0-18m AND above 200d": ((since < BULL_DAYS) & (p >= p.rolling(TREND_MA).mean())).astype(float),
}
# mood swing: buy on extreme fear, sell on extreme greed, hold the position between
pos, state = [], 0.0
for v in mood:
    if v < 20: state = 1.0
    elif v > 80: state = 0.0
    pos.append(state)
fixed["Mood: buy <20, sell >80"] = pd.Series(pos, index=p.index)
pos, state = [], 0.0
for v, sd in zip(mood, since):
    if v < 20: state = 1.0
    elif v > 80 and sd >= BULL_DAYS: state = 0.0
    pos.append(state)
fixed["Mood + cycle: sell >80 only late"] = pd.Series(pos, index=p.index)
print(f"\n3. Rules, {S0.date()} to {p.index[-1].date()} (signal at close, trade next day, no costs, cash 0%)")
for k, v in fixed.items():
    print(fmt(k, strat(v[S0:], rs)))
print("\n3b. By halving cycle: CAGR of each rule inside each cycle")
edges = list(HALVINGS) + [p.index[-1]]
print("  " + " " * 34 + "".join(f"{str(a.date())[:4]}-{str(b.date())[2:4]:>3s}  " for a, b in zip(edges, edges[1:])))
for k, v in fixed.items():
    cells = []
    for a, b in zip(edges, edges[1:]):
        cells.append(f"{strat(v[a:b], r[a:b])[0]:8.0%}  ")
    print(f"  {k:34s}" + "".join(cells))

# ---------- 4. the four-year cycle itself ----------
print("\n4. Cycle anatomy (peak = highest close within 2 years of the halving; trough = lowest close in the 2 years after the peak)")
rows = []
for i, h in enumerate(HALVINGS):
    seg = p[h:h + pd.Timedelta(days=730)]
    top = seg.idxmax()
    aft = p[top:top + pd.Timedelta(days=730)]
    bot = aft.idxmin()
    pre = p[h - pd.Timedelta(days=730):h]
    pbot = pre.idxmin() if len(pre) > 300 else None
    done = (p.index[-1] - top).days >= 730
    rows.append((h, top, bot, done))
    print(f"  halving {h.date()} @ ${p[h]:>9,.0f} | pre-halving low {str(pbot.date()) if pbot is not None else '   n/a    '}"
          f" ({(h - pbot).days if pbot is not None else 0:4d}d before) | peak {top.date()} +{(top - h).days}d, {seg.max() / p[h]:5.1f}x"
          f" | trough {bot.date()} +{(bot - top).days}d after peak, {aft.min() / seg.max() - 1:+.0%}{'' if done else '  (cycle still open)'}")
print("\n4b. Return by cycle year (365-day blocks counted from each halving)")
print("  cycle     yr1(0-12m)  yr2(12-24m)  yr3(24-36m)  yr4(36-48m)")
yrs = {k: [] for k in range(4)}
for h in HALVINGS:
    cells = []
    for k in range(4):
        a, b = h + pd.Timedelta(days=365 * k), h + pd.Timedelta(days=365 * (k + 1))
        if b > p.index[-1]:
            cells.append(f"{'open':>11s}" if a < p.index[-1] else f"{'':>11s}")
            continue
        v = p.asof(b) / p.asof(a) - 1
        yrs[k].append(v)
        cells.append(f"{v:+11.0%}")
    print(f"  {h.year}  " + "  ".join(cells))
print("  median " + "  ".join(f"{np.median(v):+11.0%}" if v else "" for v in yrs.values()))

# 4c. placebo: same 18-month rule, anchored on every other day of a 4-year clock
print("\n4c. Placebo: the 0-18m rule anchored on every possible phase of a 1,461-day clock (same sample)")
base = strat(fixed["Cycle: 0-18m after halving"][S0:], rs)[0]
res = []
day = (p.index - HALVINGS[0]).days
for off in range(0, 1461, 7):
    ph = (day - off) % 1461
    res.append(strat(pd.Series((ph < BULL_DAYS).astype(float), index=p.index)[S0:], rs)[0])
res = np.array(res)
print(f"  halving-anchored CAGR {base:.1%}; beats {(res < base).mean():.0%} of {len(res)} weekly phase offsets; "
      f"best offset {res.max():.1%}, median {np.median(res):.1%}")
# the clock vs the actual halving dates: halvings are block-based, so spacing drifts
print("  halving spacing (days):", [int((b - a).days) for a, b in zip(HALVINGS, HALVINGS[1:])])

# 4d. out of sample: set the timings from the 2012 and 2016 cycles only, then score 2020 and 2024
print("\n4d. Out-of-sample timing: averages of the first two cycles, applied to the next two")
t_peak = np.mean([(rows[i][1] - rows[i][0]).days for i in (0, 1)])
t_bot = np.mean([(rows[i][2] - rows[i][1]).days for i in (0, 1)])
for h, top, bot, done in rows[2:]:
    pk, tr = h + pd.Timedelta(days=t_peak), h + pd.Timedelta(days=t_peak + t_bot)
    print(f"  {h.year}: predicted peak {pk.date()} vs actual {top.date()} ({(top - pk).days:+d}d); "
          f"predicted trough {tr.date()} vs {'actual' if done else 'lowest so far'} {bot.date()} ({(bot - tr).days:+d}d); "
          f"price on predicted peak day was {p.asof(pk) / p[top] - 1:+.0%} from the actual peak")
    s_cyc = strat(pd.Series(((since >= 0) & (since < t_peak)).astype(float), index=p.index)[h:h + pd.Timedelta(days=1460)], r[h:h + pd.Timedelta(days=1460)])
    s_bh = strat(pd.Series(1.0, index=p.index)[h:h + pd.Timedelta(days=1460)], r[h:h + pd.Timedelta(days=1460)])
    print(f"        hold 0-{t_peak:.0f}d then cash: CAGR {s_cyc[0]:.0%} maxDD {s_cyc[2]:.0%} | buy and hold over the cycle: CAGR {s_bh[0]:.0%} maxDD {s_bh[2]:.0%}")

# 4e. mood split by cycle phase
print("\n4e. Mood bands split by cycle phase, median 365d forward return (days)")
phase = pd.cut(since, [-1, 547, 912, 1600], labels=["0-18m", "18-30m", "30m+"])
for lo, hi, nm in BANDS:
    sel = (mood >= lo) & (mood < hi)
    cells = []
    for ph in ["0-18m", "18-30m", "30m+"]:
        v = f365[sel & (phase == ph)].dropna()
        cells.append(f"{ph}: {v.median():+6.0%} (n{len(v):4d}, up {(v > 0).mean():3.0%})" if len(v) > 30 else f"{ph}:      --          ")
    print(f"  {nm:>13s}  " + " | ".join(cells))

# ---------- 6. the famous bitcoin thresholds, for reference ----------
print("\n6. Absolute thresholds the market already watches (not in the mood; fixed levels, not ranks)")
ma200w = p.rolling(1400).mean()
for nm, mask in (("MVRV < 1 (price under realised price)", df.mvrv < 1), ("MVRV > 3.5", df.mvrv > 3.5),
                 ("Below the 200-week SMA", p < ma200w), ("Above 200d SMA", p >= p.rolling(200).mean()),
                 ("Below 200d SMA", p < p.rolling(200).mean())):
    mask = mask & p.index.to_series().ge(pd.Timestamp("2012-01-01"))
    v = f365[mask].dropna()
    ep = episodes(mask.fillna(False))
    print(f"  {nm:40s} days {mask.sum():5d}  365d median {v.median():+7.0%}  up {(v > 0).mean():4.0%}  "
          f"episodes {len(ep)}: " + ", ".join(str(e.date())[:7] for e in ep[:12]))

# ---------- 5. where we are ----------
last = p.index[-1]
lh = HALVINGS[HALVINGS <= last][-1]
pk = p[lh:].idxmax()
print(f"\n5. Today {last.date()}: day {(last - lh).days} of the {lh.year} cycle, {(NEXT_HALVING - last).days}d to the next halving (est.), "
      f"{p.iloc[-1] / p[pk] - 1:+.0%} from the {pk.date()} peak, mood {mood.iloc[-1]:.0f}, "
      f"MVRV {df.mvrv.iloc[-1]:.2f}, {'above' if p.iloc[-1] >= p.rolling(200).mean().iloc[-1] else 'below'} the 200d")
if CSV:
    mood.to_csv(CSV)
