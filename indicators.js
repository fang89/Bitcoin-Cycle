/* Market mood and four-year cycle calcs for the Bitcoin dashboard.
   Pure computation on window.BTC_DATA; no drawing. Loaded after data.js, before app.js.
   Every value on day t uses data up to and including day t only (no look-ahead).
   Methodology and the evidence behind each choice: METHODOLOGY.md.
   tools/backtest.py computes the same numbers in Python; keep the two in step. */
(function () {
"use strict";
const D = window.BTC_DATA;
const N = D.d.length;
const DAY = 86400000;

// Bitcoin trades every day, so every window is in calendar days.
const TREND_MA = 200;        // the standard trend average (Brock, Lakonishok & LeBaron 1992; Faber 2007)
const YEAR = 365;            // 52-week high and the network-activity baseline
const VOL_WIN = 30;          // one month of daily returns for realised volatility
const ADDR_WIN = 30;         // active addresses, one-month average ...
const RANK_WIN = 365 * 3;    // components are ranked against their own last three years
const RANK_MIN = 365;        // ... once at least a year of history exists
const HORIZONS = [30, 90, 180, 365];
const HALVINGS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20"].map(toDay);
const NEXT_HALVING = toDay("2028-04-15");     // estimate: block 1,050,000 at ten-minute blocks
const BULL_DAYS = 548;                        // "18 months after the halving", the folk rule
const BANDS = [
  { lo: 0,  hi: 20,  key: "xfear",   label: "Extreme fear" },
  { lo: 20, hi: 40,  key: "fear",    label: "Fear" },
  { lo: 40, hi: 60,  key: "neutral", label: "Neutral" },
  { lo: 60, hi: 80,  key: "greed",   label: "Greed" },
  { lo: 80, hi: 101, key: "xgreed",  label: "Extreme greed" },
];
const COMPONENTS = [
  { key: "trend",     label: "Trend",      what: "Price vs its 200-day average" },
  { key: "valuation", label: "Valuation",  what: "MVRV: market cap over realised cap (what holders paid)" },
  { key: "network",   label: "Network",    what: "Active addresses, 30-day average vs its one-year average" },
  { key: "drawdown",  label: "Drawdown",   what: "Distance below the 52-week high" },
  { key: "calm",      label: "Calm",       what: "One-month volatility, inverted (calm = high)" },
];

function toDay(s) { return Math.round(Date.parse(s + "T00:00:00Z") / DAY); }
const dayIdx = d => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (D.d[m] < d) lo = m + 1; else hi = m; } return lo; };

/* ---------- rolling helpers (NaN-aware, trailing windows) ---------- */
function sma(x, w) {
  const out = new Float64Array(x.length).fill(NaN);
  let sum = 0, n = 0;
  for (let i = 0; i < x.length; i++) {
    if (!isNaN(x[i])) { sum += x[i]; n++; }
    if (i >= w && !isNaN(x[i - w])) { sum -= x[i - w]; n--; }
    if (i >= w - 1 && n === w) out[i] = sum / w;
  }
  return out;
}
function rollMax(x, w) {
  const out = new Float64Array(x.length).fill(NaN);
  const q = new Int32Array(x.length); let qh = 0, qt = 0;
  for (let i = 0; i < x.length; i++) {
    while (qt > qh && x[q[qt - 1]] <= x[i]) qt--;
    q[qt++] = i;
    if (q[qh] <= i - w) qh++;
    if (i >= w - 1) out[i] = x[q[qh]];
  }
  return out;
}
function rollStd(x, w) {            // sample standard deviation, ddof 1
  const out = new Float64Array(x.length).fill(NaN);
  for (let i = w - 1; i < x.length; i++) {
    let s = 0, ok = true;
    for (let j = i - w + 1; j <= i; j++) { if (isNaN(x[j])) { ok = false; break; } s += x[j]; }
    if (!ok) continue;
    const m = s / w; let v = 0;
    for (let j = i - w + 1; j <= i; j++) v += (x[j] - m) ** 2;
    out[i] = Math.sqrt(v / (w - 1));
  }
  return out;
}
// Percentile of today's value among the non-missing values of the trailing window,
// ties shared (pandas rolling(...).rank(pct=True)).
function rollRank(x, w, minN) {
  const out = new Float64Array(x.length).fill(NaN);
  for (let i = 0; i < x.length; i++) {
    if (isNaN(x[i])) continue;
    let n = 0, less = 0, eq = 0;
    for (let j = Math.max(0, i - w + 1); j <= i; j++) {
      const v = x[j]; if (isNaN(v)) continue;
      n++; if (v < x[i]) less++; else if (v === x[i]) eq++;
    }
    if (n >= minN) out[i] = (less + (eq + 1) / 2) / n;
  }
  return out;
}
const median = a => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const num = a => Float64Array.from(a, v => (v == null ? NaN : v));

/* ---------- the raw inputs ---------- */
const px = num(D.c);
const ma200 = sma(px, TREND_MA);
const ma200w = sma(px, 1400);
const ret = px.map((v, i) => (i ? v / px[i - 1] - 1 : NaN));
const addr = num(D.addr);
const addrM = sma(addr, ADDR_WIN), addrY = sma(addr, YEAR);
const hi52 = rollMax(px, YEAR);
const raw = {
  trend: px.map((v, i) => v / ma200[i] - 1),
  valuation: num(D.mvrv),
  network: addrM.map((v, i) => v / addrY[i] - 1),
  drawdown: px.map((v, i) => v / hi52[i] - 1),
  calm: rollStd(ret, VOL_WIN).map(v => v * Math.sqrt(365)),
};

/* ---------- the mood composite ---------- */
const pct = {};
for (const c of COMPONENTS) {
  const r = rollRank(raw[c.key], RANK_WIN, RANK_MIN);
  pct[c.key] = c.key === "calm" ? r.map(v => 1 - v) : r;
}
const mood = new Float64Array(N).fill(NaN);
for (let i = 0; i < N; i++) {
  let s = 0, n = 0;
  for (const c of COMPONENTS) { const v = pct[c.key][i]; if (!isNaN(v)) { s += v; n++; } }
  if (n >= 3) mood[i] = s / n * 100;
}
const bandOf = v => BANDS.find(b => v >= b.lo && v < b.hi);

/* ---------- the halving clock ---------- */
const since = new Int32Array(N).fill(-1);     // days since the last halving, -1 before the first
const till = new Int32Array(N);               // days to the next halving (the estimate after 2024)
for (let i = 0; i < N; i++) {
  const d = D.d[i];
  let last = -1; for (const h of HALVINGS) if (h <= d) last = h;
  since[i] = last < 0 ? -1 : d - last;
  const nx = HALVINGS.find(h => h > d) ?? NEXT_HALVING;
  till[i] = nx - d;
}
const cycles = HALVINGS.map((h, k) => {
  const i0 = dayIdx(h), iEnd = k + 1 < HALVINGS.length ? dayIdx(HALVINGS[k + 1]) : N - 1;
  let pk = i0; for (let i = i0; i <= Math.min(N - 1, i0 + 730); i++) if (px[i] > px[pk]) pk = i;
  let tr = pk; for (let i = pk; i <= Math.min(N - 1, pk + 730); i++) if (px[i] < px[tr]) tr = i;
  let lo = null;
  if (i0 >= 300) { lo = Math.max(0, i0 - 730); for (let i = lo; i <= i0; i++) if (px[i] < px[lo]) lo = i; }
  return {
    year: new Date(h * DAY).getUTCFullYear(), i0, iEnd, peak: pk, trough: tr, preLow: lo,
    toPeak: D.d[pk] - h, multiple: px[pk] / px[i0], peakToTrough: D.d[tr] - D.d[pk], fall: px[tr] / px[pk] - 1,
    open: D.d[N - 1] - D.d[pk] < 730,
  };
});
const done = cycles.filter(c => !c.open);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const typical = {                              // from completed cycles only
  toPeak: avg(done.map(c => c.toPeak)), peakToTrough: avg(done.map(c => c.peakToTrough)),
  troughMin: Math.min(...done.map(c => c.peakToTrough)), troughMax: Math.max(...done.map(c => c.peakToTrough)),
  fall: avg(done.map(c => c.fall)), n: done.length,
};

/* ---------- what followed: forward returns by mood band ---------- */
function episodes(mask) {              // a new spell starts after 180+ days away from the band
  let n = 0, last = -Infinity;
  for (let i = 0; i < N; i++) if (mask(i)) { if (D.d[i] - last > 180) n++; last = D.d[i]; }
  return n;
}
function forwardStats(mask) {
  const res = { days: 0, h: {} };
  for (let i = 0; i < N; i++) if (mask(i)) res.days++;
  for (const h of HORIZONS) {
    const v = [];
    for (let i = 0; i + h < N; i++) if (mask(i)) v.push(px[i + h] / px[i] - 1);
    res.h[h] = v.length ? { med: median(v), up: v.filter(x => x > 0).length / v.length, n: v.length } : null;
  }
  const byYear = new Map();
  for (let i = 0; i + 365 < N; i++) if (mask(i)) {
    const y = new Date(D.d[i] * DAY).getUTCFullYear(), a = byYear.get(y) || [0, 0];
    a[0] += px[i + 365] / px[i] - 1; a[1]++; byYear.set(y, a);
  }
  const ym = [...byYear.values()].map(([s, n]) => s / n);
  res.years = { n: ym.length, up: ym.filter(v => v > 0).length };
  return res;
}
const hasMood = i => !isNaN(mood[i]);
const inBand = b => i => hasMood(i) && mood[i] >= b.lo && mood[i] < b.hi;
const moodTable = BANDS.map(b => ({ band: b, ...forwardStats(inBand(b)), episodes: episodes(inBand(b)) }));
const moodAll = forwardStats(hasMood);

// the same bands split by where in the cycle the day sat
const PHASES = [
  { key: "early", label: "0–18 months after halving", test: s => s >= 0 && s < BULL_DAYS },
  { key: "mid",   label: "18–30 months",               test: s => s >= BULL_DAYS && s < 913 },
  { key: "late",  label: "30+ months",                 test: s => s >= 913 },
];
const moodByPhase = BANDS.map(b => ({
  band: b,
  cells: PHASES.map(ph => {
    const v = [];
    for (let i = 0; i + 365 < N; i++) if (inBand(b)(i) && ph.test(since[i])) v.push(px[i + 365] / px[i] - 1);
    return v.length > 30 ? { med: median(v), up: v.filter(x => x > 0).length / v.length, n: v.length } : null;
  }),
}));

/* ---------- trading rules, all on the same sample from the first halving ---------- */
const S0 = dayIdx(HALVINGS[0]);
function runRule(posAt) {               // position set at close t earns the return of day t+1
  let eq = 1, pk = 1, dd = 0, inMkt = 0, n = 0, sum = 0, sq = 0;
  const curve = new Float64Array(N).fill(NaN); curve[S0] = 1;
  for (let i = S0 + 1; i < N; i++) {
    const pos = posAt(i - 1), r = pos * ret[i];
    eq *= 1 + r; pk = Math.max(pk, eq); dd = Math.min(dd, eq / pk - 1);
    inMkt += pos; n++; sum += r; sq += r * r;
    curve[i] = eq;
  }
  const yrs = n / 365, mu = sum / n;
  return { cagr: eq ** (1 / yrs) - 1, vol: Math.sqrt((sq - n * mu * mu) / (n - 1)) * Math.sqrt(365), maxDD: dd, inMkt: inMkt / n, curve };
}
function swing(sellOk) {                 // buy on extreme fear, sell on extreme greed, hold in between
  const pos = new Float64Array(N); let s = 0;
  for (let i = 0; i < N; i++) { if (mood[i] < 20) s = 1; else if (mood[i] > 80 && sellOk(i)) s = 0; pos[i] = s; }
  return i => pos[i];
}
const RULES = [
  { key: "bh",     label: "Buy and hold",                      pos: () => 1 },
  { key: "ma",     label: "Above the 200-day average",         pos: i => (px[i] >= ma200[i] ? 1 : 0) },
  { key: "cyc",    label: "0–18 months after each halving",    pos: i => (since[i] >= 0 && since[i] < BULL_DAYS ? 1 : 0) },
  { key: "cyc2",   label: "12 months before to 18 after",      pos: i => ((since[i] >= 0 && since[i] < BULL_DAYS) || till[i] <= 365 ? 1 : 0) },
  { key: "mood",   label: "Mood: buy under 20, sell over 80",  pos: swing(() => true) },
  { key: "moodc",  label: "Mood, but never sell in months 0–18", pos: swing(i => since[i] >= BULL_DAYS) },
].map(r => ({ ...r, ...runRule(r.pos) }));

/* ---------- trend regime ---------- */
const trend = (() => {
  const acc = { up: [], down: [] };
  for (let i = 1; i < N; i++) if (!isNaN(ma200[i - 1])) (px[i - 1] >= ma200[i - 1] ? acc.up : acc.down).push(ret[i]);
  const summ = a => {
    const mu = a.reduce((x, y) => x + y, 0) / a.length;
    const sd = Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / (a.length - 1));
    return { days: a.length, annRet: mu * 365, annVol: sd * Math.sqrt(365) };
  };
  return { up: summ(acc.up), down: summ(acc.down) };
})();

window.BTC_IND = {
  d: D.d, px, ma200, ma200w, mood, pct, raw, COMPONENTS, BANDS, HORIZONS, bandOf, PHASES,
  moodTable, moodAll, moodByPhase, RULES, S0, trend,
  HALVINGS, NEXT_HALVING, BULL_DAYS, since, till, cycles, typical, dayIdx,
  firstMoodDay: D.d[mood.findIndex(v => !isNaN(v))],
};
})();
