/* Bitcoin cycle dashboard: price chart with the halving clock, market mood, cycle overlay and rule backtests.
   Reads window.BTC_DATA (data.js) and window.BTC_IND (indicators.js). Canvas only, no libraries. */
(function () {
"use strict";
const D = window.BTC_DATA, I = window.BTC_IND, N = D.d.length, DAY = 86400000;
const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const toDay = s => Math.round(Date.parse(s + "T00:00:00Z") / DAY);
const iso = d => new Date(d * DAY).toISOString().slice(0, 10);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const nice = d => { const t = new Date(d * DAY); return `${t.getUTCDate()} ${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
const usd = v => v >= 1000 ? "$" + Math.round(v).toLocaleString("en-US") : v >= 10 ? "$" + v.toFixed(1) : "$" + v.toFixed(v >= 1 ? 2 : 3);
const usdShort = v => v >= 1e3 ? "$" + (v >= 1e4 ? Math.round(v / 1e3) : (v / 1e3).toFixed(1).replace(/\.0$/, "")) + "k" : v >= 1 ? "$" + (+v.toFixed(v >= 10 ? 0 : 1)) : "$" + v.toFixed(2);
const pct = (v, dp = 0) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v * 100).toFixed(dp) + "%";
const mult = v => v >= 10 ? Math.round(v) + "×" : v.toFixed(1) + "×";
const cls = v => (v > 0 ? "pos" : v < 0 ? "neg" : "");
const bandColor = b => css("--band-" + b.key);

/* ---------- curated events ---------- */
const EVENTS = [
  { d: "2010-07-18", c: "adoption", t: "Mt. Gox opens", b: "The first exchange most people used. Bitcoin trades at about 8 cents." },
  { d: "2011-06-19", c: "crisis", t: "Mt. Gox hacked", b: "A breach crashes the price on the exchange to a cent. The 2011 bubble deflates from $30 to $2 by November." },
  { d: "2012-11-28", c: "halving", t: "First halving", b: "Block reward cut from 50 to 25 BTC. New supply halves overnight." },
  { d: "2013-03-25", c: "policy", t: "Cyprus bail-in", b: "Depositors take losses in the Cyprus rescue. Bitcoin gets its first 'escape the banks' bid and runs to $230 by April." },
  { d: "2013-10-02", c: "policy", t: "Silk Road shut down", b: "The FBI seizes the darknet market and its coins. The price shrugs it off within weeks." },
  { d: "2013-12-05", c: "policy", t: "China's first ban", b: "The PBoC bars banks from handling bitcoin, a day after the $1,100 cycle top." },
  { d: "2014-02-24", c: "crisis", t: "Mt. Gox collapses", b: "The largest exchange halts withdrawals and files for bankruptcy, about 850,000 BTC missing." },
  { d: "2015-07-30", c: "adoption", t: "Ethereum launches", b: "Smart-contract chains arrive. The 'altcoin' era starts here." },
  { d: "2016-07-09", c: "halving", t: "Second halving", b: "Block reward cut from 25 to 12.5 BTC." },
  { d: "2016-08-02", c: "crisis", t: "Bitfinex hack", b: "About 120,000 BTC stolen. Price drops 20% in a day." },
  { d: "2017-08-01", c: "adoption", t: "SegWit and the Bitcoin Cash fork", b: "The block-size war ends with a chain split. SegWit activates three weeks later." },
  { d: "2017-09-04", c: "policy", t: "China bans ICOs", b: "Token sales outlawed and local exchanges ordered shut." },
  { d: "2017-12-17", c: "adoption", t: "CME futures launch", b: "Wall Street gets a regulated way to short bitcoin. This is also the day of the cycle top near $19,500." },
  { d: "2018-11-14", c: "crisis", t: "Bitcoin Cash hash war", b: "A fight over the BCH fork breaks the $6,000 floor. Price halves again into December." },
  { d: "2020-03-12", c: "crisis", t: "COVID crash", b: "'Black Thursday': bitcoin falls about 40% in a day as everything is sold for dollars." },
  { d: "2020-05-11", c: "halving", t: "Third halving", b: "Block reward cut from 12.5 to 6.25 BTC." },
  { d: "2020-08-11", c: "adoption", t: "MicroStrategy buys", b: "First listed company to put its treasury into bitcoin, $250m to start." },
  { d: "2021-02-08", c: "adoption", t: "Tesla buys $1.5b", b: "The corporate-treasury trade goes mainstream." },
  { d: "2021-04-14", c: "adoption", t: "Coinbase lists", b: "The direct listing marks the first top of the 2021 double peak, near $64,000." },
  { d: "2021-05-21", c: "policy", t: "China bans mining", b: "The State Council crackdown sends half the world's hash rate offline and overseas." },
  { d: "2021-09-07", c: "policy", t: "El Salvador legal tender", b: "The first country to make bitcoin legal tender." },
  { d: "2021-10-19", c: "adoption", t: "First US futures ETF", b: "ProShares BITO lists. The second, final top of the cycle follows three weeks later." },
  { d: "2022-05-09", c: "crisis", t: "Terra / LUNA collapse", b: "A $40b algorithmic stablecoin unwinds and dumps its bitcoin reserve." },
  { d: "2022-06-13", c: "crisis", t: "Celsius freezes withdrawals", b: "Crypto lenders start to fail; Three Arrows Capital follows within weeks." },
  { d: "2022-11-11", c: "crisis", t: "FTX files for bankruptcy", b: "The second-largest exchange is gone in a week. This marks the cycle trough near $15,700." },
  { d: "2023-03-10", c: "crisis", t: "SVB fails", b: "USDC briefly depegs. Bitcoin rallies on the bank scare." },
  { d: "2024-01-11", c: "adoption", t: "Spot ETFs trade", b: "The SEC approves spot bitcoin ETFs. Billions flow in within weeks." },
  { d: "2024-04-20", c: "halving", t: "Fourth halving", b: "Block reward cut from 6.25 to 3.125 BTC." },
  { d: "2024-11-05", c: "policy", t: "US election", b: "A pro-crypto administration wins. Bitcoin clears $100,000 a month later." },
  { d: "2025-03-06", c: "policy", t: "US Strategic Bitcoin Reserve", b: "Executive order to hold seized bitcoin as a reserve asset." },
  { d: "2025-10-10", c: "crisis", t: "Tariff liquidation cascade", b: "A tariff shock wipes out about $19b of leveraged crypto positions in a day, four days after the cycle top." },
];
EVENTS.forEach(e => { e.day = toDay(e.d); e.i = I.dayIdx(e.day); });
const CATS = [
  { key: "halving", label: "Halvings" }, { key: "crisis", label: "Crises" },
  { key: "policy", label: "Policy" }, { key: "adoption", label: "Adoption" },
];

/* ---------- state ---------- */
const last = N - 1, lastDay = D.d[last];
const S = {
  i0: 0, i1: last, log: true, range: "all",
  show: { ma200: true, ma200w: false, cycle: true },
  cats: { halving: true, crisis: true, policy: true, adoption: true },
  hover: null, sel: null,
};
const RANGES = [
  { key: "1y", label: "1Y", days: 365 }, { key: "4y", label: "4Y", days: 1461 },
  { key: "cyc", label: "This cycle", days: lastDay - I.HALVINGS[I.HALVINGS.length - 1] + 30 },
  { key: "all", label: "All", days: Infinity },
];
const setRange = r => {
  S.range = r.key; S.i1 = last;
  S.i0 = r.days === Infinity ? 0 : Math.max(0, last - r.days);
  S.sel = null; $("btc-evDetail").style.display = "none"; eventList();
  syncButtons(); drawAll();
};

/* ---------- canvas helper ---------- */
function setup(cv) {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, r.width, r.height);
  return { g, w: r.width, h: r.height };
}
const PAD = { l: 8, r: 64, t: 26, b: 22 };

/* ---------- tiles ---------- */
function tiles() {
  const p = I.px[last], chg = p / I.px[last - 1] - 1, ath = Math.max(...I.px), athI = I.px.indexOf(ath);
  const m = I.mood[last], b = I.bandOf(m), cyc = I.cycles[I.cycles.length - 1];
  const day = I.since[last], tillN = I.till[last];
  const t = I.typical, trLo = D.d[cyc.peak] + t.troughMin, trHi = D.d[cyc.peak] + t.troughMax;
  const phase = day < I.BULL_DAYS ? "inside the 18-month bull window"
    : lastDay < trLo ? "past the peak window, before the usual trough"
    : lastDay <= trHi ? "inside the historical trough window" : "past the historical trough window";
  $("btc-tiles").innerHTML = `
    <div class="tile"><div class="k">Bitcoin</div><div class="v">${usd(p)}</div><div class="s"><span class="${cls(chg)}">${pct(chg, 1)}</span> on the day · ${nice(lastDay)}</div></div>
    <div class="tile"><div class="k">From all-time high</div><div class="v ${cls(p / ath - 1)}">${pct(p / ath - 1)}</div><div class="s">${usd(ath)} on ${nice(D.d[athI])}</div></div>
    <div class="tile"><div class="k">Market mood</div><div class="v" style="color:${bandColor(b)}">${Math.round(m)}</div><div class="s">${b.label}</div></div>
    <div class="tile"><div class="k">Halving clock</div><div class="v">Day ${day}</div><div class="s">${phase}</div></div>
    <div class="tile"><div class="k">Next halving</div><div class="v">${tillN}d</div><div class="s">around ${MON[new Date(I.NEXT_HALVING * DAY).getUTCMonth()]} ${new Date(I.NEXT_HALVING * DAY).getUTCFullYear()} (estimate)</div></div>
    <div class="tile"><div class="k">MVRV</div><div class="v">${D.mvrv[last].toFixed(2)}</div><div class="s">price ${pct(D.mvrv[last] - 1)} vs holders' cost basis</div></div>`;
}

/* ---------- controls ---------- */
function controls() {
  $("btc-ranges").innerHTML = RANGES.map(r => `<button type="button" data-r="${r.key}">${r.label}</button>`).join("");
  $("btc-ranges").onclick = e => { const b = e.target.closest("button"); if (b) setRange(RANGES.find(r => r.key === b.dataset.r)); };
  $("btc-scaleSeg").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.log = b.dataset.scale === "log"; syncButtons(); drawAll(); };
  const IND = [
    { key: "ma200", label: "200-day avg", c: "--line-ma" }, { key: "ma200w", label: "200-week avg", c: "--line-maw" },
    { key: "cycle", label: "Cycle windows", c: "--cyc-bull" },
  ];
  $("btc-indChips").innerHTML = IND.map(x => `<button type="button" class="chip" data-k="${x.key}" style="--c:var(${x.c})"><span class="dot"></span>${x.label}</button>`).join("");
  $("btc-indChips").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.show[b.dataset.k] = !S.show[b.dataset.k]; syncButtons(); drawAll(); };
  $("btc-catChips").innerHTML = CATS.map(x => `<button type="button" class="chip" data-k="${x.key}" style="--c:var(--cat-${x.key})"><span class="dot"></span>${x.label}</button>`).join("");
  $("btc-catChips").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.cats[b.dataset.k] = !S.cats[b.dataset.k]; syncButtons(); drawAll(); eventList(); };
}
function syncButtons() {
  for (const b of $("btc-ranges").children) b.setAttribute("aria-pressed", b.dataset.r === S.range);
  for (const b of $("btc-scaleSeg").children) b.setAttribute("aria-pressed", (b.dataset.scale === "log") === S.log);
  for (const b of $("btc-indChips").children) b.setAttribute("aria-pressed", !!S.show[b.dataset.k]);
  for (const b of $("btc-catChips").children) b.setAttribute("aria-pressed", !!S.cats[b.dataset.k]);
  $("btc-rangeLabel").textContent = `${nice(D.d[S.i0])} – ${nice(D.d[S.i1])}`;
}

/* ---------- main chart ---------- */
let geo = null;           // the mapping of the last draw, for hover and zoom
function yScale(lo, hi, h) {
  const f = S.log ? Math.log : (v => v);
  const a = f(lo), b = f(hi);
  return v => PAD.t + (h - PAD.t - PAD.b) * (1 - (f(v) - a) / (b - a));
}
function yTicks(lo, hi) {
  if (!S.log) {
    const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4))), m = [1, 2, 2.5, 5, 10].find(k => (hi - lo) / (k * step) <= 6) * step;
    const out = []; for (let v = Math.ceil(lo / m) * m; v <= hi; v += m) out.push(v); return out;
  }
  const out = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
    for (const k of (Math.log10(hi / lo) < 1.2 ? [1, 1.5, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 5])) { const v = k * 10 ** e; if (v >= lo && v <= hi) out.push(v); }
  return out.length > 9 ? out.filter(v => Math.abs(Math.log10(v) - Math.round(Math.log10(v))) < 1e-9) : out;
}
function xTicks(d0, d1) {
  const span = d1 - d0, out = [];
  if (span > 365 * 3) {
    const st = span > 365 * 10 ? 2 : 1;
    for (let y = new Date(d0 * DAY).getUTCFullYear() + 1; y <= new Date(d1 * DAY).getUTCFullYear(); y++) if (y % st === 0) out.push([toDay(`${y}-01-01`), String(y)]);
  } else {
    const st = span > 500 ? 3 : span > 200 ? 2 : 1;
    const t = new Date(d0 * DAY);
    for (let y = t.getUTCFullYear(), m = t.getUTCMonth() + 1; ; m++) {
      if (m > 11) { m = 0; y++; }
      const d = Math.round(Date.UTC(y, m, 1) / DAY); if (d > d1) break;
      if (m % st === 0) out.push([d, m === 0 ? String(y) : MON[m]]);
    }
  }
  return out;
}
function drawMain() {
  const { g, w, h } = setup($("btc-base"));
  const i0 = S.i0, i1 = S.i1, d0 = D.d[i0], d1 = D.d[i1];
  const X = d => PAD.l + (w - PAD.l - PAD.r) * (d - d0) / Math.max(1, d1 - d0);
  let lo = Infinity, hi = -Infinity;
  for (let i = i0; i <= i1; i++) {
    for (const v of [I.px[i], S.show.ma200 ? I.ma200[i] : NaN, S.show.ma200w ? I.ma200w[i] : NaN]) if (v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  if (S.log) { lo /= 1.25; hi *= 1.18; } else { const pad = (hi - lo) * 0.08; lo = Math.max(0, lo - pad); hi += pad; }
  const Y = yScale(lo, hi, h);
  geo = { X, Y, d0, d1, w, h, lo, hi };
  const grid = css("--grid"), muted = css("--muted");
  g.font = "11px Inter, system-ui, sans-serif"; g.textBaseline = "middle";

  // cycle shading: the 18 months after each halving, and the usual trough window of the open cycle
  if (S.show.cycle) {
    g.fillStyle = css("--cyc-bull-fill");
    for (const c of I.cycles) {
      const a = X(D.d[c.i0]), b = X(D.d[c.i0] + I.BULL_DAYS);
      if (b > PAD.l && a < w - PAD.r) g.fillRect(Math.max(PAD.l, a), PAD.t, Math.min(w - PAD.r, b) - Math.max(PAD.l, a), h - PAD.t - PAD.b);
    }
    const c = I.cycles[I.cycles.length - 1], t = I.typical;
    if (c.open) {
      const a = X(D.d[c.peak] + t.troughMin), b = X(D.d[c.peak] + t.troughMax);
      if (b > PAD.l && a < w - PAD.r) {
        g.fillStyle = css("--cyc-trough-fill");
        g.fillRect(Math.max(PAD.l, a), PAD.t, Math.min(w - PAD.r, b) - Math.max(PAD.l, a), h - PAD.t - PAD.b);
      }
    }
  }
  // grid
  g.strokeStyle = grid; g.lineWidth = 1; g.fillStyle = muted; g.textAlign = "left";
  for (const v of yTicks(lo, hi)) { const y = Math.round(Y(v)) + .5; g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(w - PAD.r, y); g.stroke(); g.fillText(usdShort(v), w - PAD.r + 6, y); }
  g.textAlign = "center"; g.textBaseline = "top";
  for (const [d, lb] of xTicks(d0, d1)) { const x = X(d); if (x < PAD.l + 10 || x > w - PAD.r - 10) continue; g.fillText(lb, x, h - PAD.b + 6); }

  // halvings, past and next
  g.textBaseline = "top";
  const hv = [...I.HALVINGS.map((d, k) => [d, `Halving ${k + 1}`, false]), [I.NEXT_HALVING, "Halving 5 (est.)", true]];
  for (const [d, lb, est] of hv) {
    const x = Math.round(X(d)) + .5; if (x < PAD.l || x > w - PAD.r) continue;
    g.strokeStyle = css("--cat-halving"); g.setLineDash(est ? [4, 4] : []); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, PAD.t - 4); g.lineTo(x, h - PAD.b); g.stroke(); g.setLineDash([]);
    g.fillStyle = css("--cat-halving"); g.font = "600 10.5px Inter, system-ui, sans-serif"; g.textAlign = x > w - PAD.r - 60 ? "right" : "left";
    g.fillText(lb, x + (g.textAlign === "left" ? 4 : -4), 4);
  }
  g.font = "11px Inter, system-ui, sans-serif";

  // averages
  const line = (arr, col, wd, dash) => {
    g.strokeStyle = col; g.lineWidth = wd; g.setLineDash(dash || []); g.beginPath(); let on = false;
    const stepI = Math.max(1, Math.floor((i1 - i0) / (w * 1.5)));
    for (let i = i0; i <= i1; i += (i + stepI > i1 && i !== i1 ? i1 - i : stepI)) {
      const v = arr[i]; if (!(v > 0)) { on = false; continue; }
      const x = X(D.d[i]), y = Y(v); on ? g.lineTo(x, y) : g.moveTo(x, y); on = true;
    }
    g.stroke(); g.setLineDash([]);
  };
  if (S.show.ma200w) line(I.ma200w, css("--line-maw"), 1.4, [5, 3]);
  if (S.show.ma200) line(I.ma200, css("--line-ma"), 1.3);
  line(I.px, css("--series-1"), 1.7);

  // peaks and troughs per cycle
  if (S.show.cycle) {
    g.font = "600 10.5px Inter, system-ui, sans-serif"; g.textAlign = "center";
    for (const c of I.cycles) {
      for (const [i, top] of [[c.peak, true], [c.trough, false]]) {
        if (i < i0 || i > i1 || (!top && c.open)) continue;
        const x = X(D.d[i]), y = Y(I.px[i]);
        g.fillStyle = top ? css("--up") : css("--down");
        g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
        const lb = top ? `Peak +${c.toPeak}d · ${mult(c.multiple)}` : `Trough ${pct(c.fall)}`;
        g.textBaseline = top ? "bottom" : "top";
        g.fillStyle = css("--ink-1");
        g.fillText(lb, Math.min(w - PAD.r - 50, Math.max(PAD.l + 50, x)), top ? y - 7 : y + 7);
      }
    }
    g.font = "11px Inter, system-ui, sans-serif";
  }
  // event flags along the bottom edge of the plot
  for (const e of EVENTS) {
    if (!S.cats[e.c] || e.c === "halving" || e.day < d0 || e.day > d1) continue;
    const x = X(e.day), y = h - PAD.b - 2;
    g.fillStyle = css("--cat-" + e.c); g.globalAlpha = S.sel && S.sel !== e ? .35 : 1;
    g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 4.5, y); g.lineTo(x - 4.5, y); g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  drawMood();
  drawHover();
}

/* ---------- mood strip under the chart ---------- */
function drawMood() {
  const { g, w, h } = setup($("btc-moodCanvas"));
  const { X, d0, d1 } = geo, t = 4, b = h - 4, Y = v => b - (b - t) * v / 100;
  g.fillStyle = css("--band-bg"); g.fillRect(PAD.l, t, w - PAD.l - PAD.r, b - t);
  g.strokeStyle = css("--grid"); g.lineWidth = 1;
  for (const v of [20, 50, 80]) { const y = Math.round(Y(v)) + .5; g.beginPath(); g.moveTo(PAD.l, y); g.lineTo(w - PAD.r, y); g.stroke(); }
  g.fillStyle = css("--muted"); g.font = "10.5px Inter, system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
  g.fillText("Mood", w - PAD.r + 6, Y(50)); g.fillText("80", w - PAD.r + 6, Y(85)); g.fillText("20", w - PAD.r + 6, Y(15));
  const stepI = Math.max(1, Math.floor((S.i1 - S.i0) / (w * 1.5)));
  let prev = null;
  for (let i = S.i0; i <= S.i1; i += stepI) {
    const v = I.mood[i]; if (isNaN(v)) { prev = null; continue; }
    const x = X(D.d[i]), y = Y(v);
    if (prev) { g.strokeStyle = bandColor(I.bandOf(v)); g.lineWidth = 1.6; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(x, y); g.stroke(); }
    prev = [x, y];
  }
}

/* ---------- hover ---------- */
function nearest(day) { let i = I.dayIdx(Math.round(day)); return Math.max(S.i0, Math.min(S.i1, i)); }
function drawHover() {
  const { g, w, h } = setup($("btc-overlay"));
  const tip = $("btc-tooltip");
  if (S.hover == null || !geo) { tip.style.display = "none"; return; }
  const i = S.hover, { X, Y } = geo, x = X(D.d[i]), y = Y(I.px[i]);
  g.strokeStyle = css("--muted"); g.setLineDash([3, 3]); g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, PAD.t); g.lineTo(x, h - PAD.b); g.stroke(); g.setLineDash([]);
  g.fillStyle = css("--series-1"); g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
  g.strokeStyle = css("--surface-1"); g.lineWidth = 2; g.stroke();
  const m = I.mood[i], b = isNaN(m) ? null : I.bandOf(m), s = I.since[i];
  const near = EVENTS.filter(e => S.cats[e.c] && Math.abs(e.day - D.d[i]) <= Math.max(3, (geo.d1 - geo.d0) / 160));
  tip.innerHTML = `<div class="d">${nice(D.d[i])}</div><div class="p">${usd(I.px[i])}</div>` +
    (b ? `<div class="r">Mood <b style="color:${bandColor(b)}">${Math.round(m)} · ${b.label}</b></div>` : "") +
    (s >= 0 ? `<div class="r">Day ${s} after halving ${I.HALVINGS.filter(hh => hh <= D.d[i]).length} · ${I.till[i]}d to the next</div>` : `<div class="r">${I.till[i]}d to the first halving</div>`) +
    (I.ma200[i] > 0 ? `<div class="r">${pct(I.px[i] / I.ma200[i] - 1)} vs 200-day average</div>` : "") +
    near.map(e => `<div class="ev"><span class="key" style="--c:var(--cat-${e.c})"></span><span><b>${e.t}</b></span></div>`).join("");
  tip.style.display = "block";
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = (x + 14 + tw > w ? x - 14 - tw : x + 14) + "px";
  tip.style.top = Math.max(4, Math.min(h - th - 4, y - th / 2)) + "px";
}
function interactions() {
  const wrap = $("btc-chartWrap");
  let drag = null;
  const dayAt = ev => { const r = wrap.getBoundingClientRect(); return geo.d0 + (ev.clientX - r.left - PAD.l) / (geo.w - PAD.l - PAD.r) * (geo.d1 - geo.d0); };
  wrap.addEventListener("pointermove", ev => {
    if (drag) {
      const r = wrap.getBoundingClientRect(), dd = (ev.clientX - drag.x) / (r.width - PAD.l - PAD.r) * (drag.d1 - drag.d0);
      const span = drag.i1 - drag.i0; let n0 = Math.round(drag.i0 - dd);
      n0 = Math.max(0, Math.min(last - span, n0)); S.i0 = n0; S.i1 = n0 + span; S.range = null; syncButtons(); drawMain(); return;
    }
    S.hover = nearest(dayAt(ev)); drawHover();
  });
  wrap.addEventListener("pointerleave", () => { S.hover = null; drawHover(); });
  wrap.addEventListener("pointerdown", ev => { if (ev.pointerType === "mouse") { drag = { x: ev.clientX, i0: S.i0, i1: S.i1, d0: geo.d0, d1: geo.d1 }; wrap.setPointerCapture(ev.pointerId); } });
  wrap.addEventListener("pointerup", ev => {
    if (drag && Math.abs(ev.clientX - drag.x) < 3) {   // a click: open the nearest event flag
      const d = dayAt(ev), tol = (geo.d1 - geo.d0) / 120;
      const e = EVENTS.filter(x => S.cats[x.c] && Math.abs(x.day - d) < tol).sort((a, b) => Math.abs(a.day - d) - Math.abs(b.day - d))[0];
      if (e) selectEvent(e, false);
    }
    drag = null;
  });
  wrap.addEventListener("wheel", ev => {
    ev.preventDefault();
    const c = nearest(dayAt(ev)), k = ev.deltaY > 0 ? 1.18 : 1 / 1.18;
    let n0 = Math.round(c - (c - S.i0) * k), n1 = Math.round(c + (S.i1 - c) * k);
    if (n1 - n0 < 30) return;
    S.i0 = Math.max(0, n0); S.i1 = Math.min(last, n1); S.range = null; syncButtons(); drawMain();
  }, { passive: false });
}

/* ---------- events ---------- */
function selectEvent(e, zoom = true) {
  S.sel = S.sel === e ? null : e;
  if (S.sel && zoom) { S.i0 = Math.max(0, e.i - 548); S.i1 = Math.min(last, e.i + 548); S.range = null; syncButtons(); }
  const box = $("btc-evDetail");
  if (S.sel) {
    box.style.setProperty("--c", `var(--cat-${e.c})`); box.style.display = "block";
    box.querySelector(".dt").textContent = `${nice(e.day)} · ${usd(I.px[e.i])}` + (I.mood[e.i] >= 0 ? ` · mood ${Math.round(I.mood[e.i])}` : "");
    box.querySelector(".tt").textContent = e.t; box.querySelector(".bb").textContent = e.b;
  } else box.style.display = "none";
  eventList(); drawMain();
}
function eventList() {
  const vis = EVENTS.filter(e => S.cats[e.c]);
  $("btc-evCount").textContent = `${vis.length} of ${EVENTS.length}`;
  $("btc-evList").innerHTML = vis.slice().reverse().map(e => {
    const k = EVENTS.indexOf(e), fwd = e.i + 365 < N ? I.px[e.i + 365] / I.px[e.i] - 1 : null;
    return `<button type="button" class="ev-card${S.sel === e ? " sel" : ""}" data-k="${k}" style="--c:var(--cat-${e.c})">
      <div class="dt">${nice(e.day)} · ${usd(I.px[e.i])}${fwd != null ? ` · <span class="${cls(fwd)}">${pct(fwd)}</span> a year later` : ""}</div>
      <div class="tt">${e.t}</div><div class="bb">${e.b}</div></button>`;
  }).join("");
}

/* ---------- mood panel ---------- */
function moodPanel() {
  const m = I.mood[last], b = I.bandOf(m);
  $("btc-moodAsOf").textContent = "as of " + nice(lastDay);
  $("btc-moodNow").innerHTML = `<div class="mood-big" style="--c:${bandColor(b)}"><span class="mood-num">${Math.round(m)}</span><span class="mood-lbl">${b.label}</span></div>
    <div class="mood-scale">${I.BANDS.map(x => `<span class="seg-${x.key}" style="--c:${bandColor(x)}"></span>`).join("")}<span class="pin" style="left:${m}%"></span></div>`;
  const fmtRaw = { trend: v => pct(v) + " vs 200d", valuation: v => v.toFixed(2), network: v => pct(v) + " vs 1y", drawdown: v => pct(v), calm: v => (v * 100).toFixed(0) + "% vol" };
  $("btc-moodComps").innerHTML = I.COMPONENTS.map(c => {
    const v = I.pct[c.key][last] * 100;
    return `<li title="${c.what}"><div class="ct"><span class="cn">${c.label}</span><span class="cv">${fmtRaw[c.key](I.raw[c.key][last])}</span></div>
      <div class="cbar"><span style="width:${v}%;background:${bandColor(I.bandOf(v))}"></span></div><span class="cp">${Math.round(v)}</span></li>`;
  }).join("");
  $("btc-moodSince").textContent = `since ${MON[new Date(I.firstMoodDay * DAY).getUTCMonth()]} ${new Date(I.firstMoodDay * DAY).getUTCFullYear()}`;
  const cell = s => s ? `<td>${pct(s.med)}<small>${Math.round(s.up * 100)}% up</small></td>` : "<td>—</td>";
  $("btc-moodTable").innerHTML = `<thead><tr><th>Mood</th><th>1m</th><th>3m</th><th>6m</th><th>12m</th><th>Spells</th><th>Years higher</th></tr></thead><tbody>` +
    I.moodTable.map(r => `<tr class="${r.band === b ? "now" : ""}"><th><span class="key" style="--c:${bandColor(r.band)}"></span>${r.band.label}</th>${I.HORIZONS.map(hh => cell(r.h[hh])).join("")}<td>${r.episodes}</td><td>${r.years.up} of ${r.years.n}</td></tr>`).join("") +
    `<tr class="all"><th>Any day</th>${I.HORIZONS.map(hh => cell(I.moodAll.h[hh])).join("")}<td></td><td>${I.moodAll.years.up} of ${I.moodAll.years.n}</td></tr></tbody>`;
  const ph = I.since[last] < I.BULL_DAYS ? 0 : I.since[last] < 913 ? 1 : 2;
  $("btc-phaseTable").innerHTML = `<thead><tr><th>Mood</th>${I.PHASES.map((p, k) => `<th class="${k === ph ? "nowc" : ""}">${p.label}</th>`).join("")}</tr></thead><tbody>` +
    I.moodByPhase.map(r => `<tr class="${r.band === b ? "now" : ""}"><th><span class="key" style="--c:${bandColor(r.band)}"></span>${r.band.label}</th>${r.cells.map(c => c ? `<td>${pct(c.med)}<small>${Math.round(c.up * 100)}% up · ${c.n}d</small></td>` : "<td>—<small>no history</small></td>").join("")}</tr>`).join("") + "</tbody>";
}

/* ---------- cycle overlay ---------- */
const CYC_COLORS = ["--cyc-1", "--cyc-2", "--cyc-3", "--cyc-4"];
let cycHover = null;
function drawCycles() {
  const { g, w, h } = setup($("btc-cycCanvas"));
  const P = { l: 8, r: 52, t: 14, b: 24 }, X = d => P.l + (w - P.l - P.r) * d / 1460;
  const lo = 0.25, hi = 120, Y = v => P.t + (h - P.t - P.b) * (1 - (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)));
  g.font = "11px Inter, system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
  g.fillStyle = css("--cyc-bull-fill"); g.fillRect(X(0), P.t, X(I.BULL_DAYS) - X(0), h - P.t - P.b);
  g.strokeStyle = css("--grid"); g.fillStyle = css("--muted"); g.lineWidth = 1;
  for (const v of [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]) { const y = Math.round(Y(v)) + .5; g.beginPath(); g.moveTo(P.l, y); g.lineTo(w - P.r, y); g.stroke(); g.fillText(v < 1 ? v + "×" : v + "×", w - P.r + 6, y); }
  g.strokeStyle = css("--baseline"); g.beginPath(); g.moveTo(P.l, Y(1)); g.lineTo(w - P.r, Y(1)); g.stroke();
  g.textAlign = "center"; g.textBaseline = "top";
  for (let m = 0; m <= 48; m += 6) { const x = X(m * 30.44); g.textAlign = m === 0 ? "left" : m === 48 ? "right" : "center"; g.fillText(m === 0 ? "halving" : m + "m", x, h - P.b + 6); }
  I.cycles.forEach((c, k) => {
    const base = I.px[c.i0], end = Math.min(N - 1, c.i0 + 1460), cur = k === I.cycles.length - 1;
    g.strokeStyle = css(CYC_COLORS[k]); g.lineWidth = cur ? 2.6 : 1.4; g.beginPath();
    for (let i = c.i0; i <= end; i++) { const x = X(D.d[i] - D.d[c.i0]), y = Y(Math.max(lo, I.px[i] / base)); i === c.i0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    const pk = c.peak; g.fillStyle = css(CYC_COLORS[k]);
    g.beginPath(); g.arc(X(D.d[pk] - D.d[c.i0]), Y(I.px[pk] / base), 3.5, 0, 7); g.fill();
    if (cur) {
      const x = X(D.d[end] - D.d[c.i0]), y = Y(I.px[end] / base);
      g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.strokeStyle = css("--surface-1"); g.lineWidth = 2; g.stroke();
      g.fillStyle = css("--ink-1"); g.font = "600 11px Inter, system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "bottom";
      g.fillText(`today · day ${D.d[end] - D.d[c.i0]}`, x + 8, y - 4); g.font = "11px Inter, system-ui, sans-serif";
    }
  });
  // the historical trough window, counted from each cycle's own peak, shown for the open cycle
  const c = I.cycles[I.cycles.length - 1], t = I.typical;
  if (c.open) {
    const a = X(c.toPeak + t.troughMin), b = X(c.toPeak + t.troughMax);
    g.fillStyle = css("--cyc-trough-fill"); g.fillRect(a, P.t, b - a, h - P.t - P.b);
  }
  if (cycHover != null) {
    const x = X(cycHover); g.strokeStyle = css("--muted"); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, P.t); g.lineTo(x, h - P.b); g.stroke(); g.setLineDash([]);
  }
  $("btc-cycLegend").innerHTML = I.cycles.map((c, k) => `<span class="lgd"><span class="sw" style="background:var(${CYC_COLORS[k]})"></span>${c.year} cycle</span>`).join("") +
    `<span class="lgd"><span class="sw box" style="background:var(--cyc-bull-fill)"></span>first 18 months</span>` +
    `<span class="lgd"><span class="sw box" style="background:var(--cyc-trough-fill)"></span>past troughs, timed from this cycle's peak</span>`;
  return { X, w, P };
}
function cycleInteractions() {
  const wrap = $("btc-cycWrap"), tip = $("btc-cycTip");
  wrap.addEventListener("pointermove", ev => {
    const r = wrap.getBoundingClientRect(), P = { l: 8, r: 52 };
    const day = Math.round(Math.max(0, Math.min(1460, (ev.clientX - r.left - P.l) / (r.width - P.l - P.r) * 1460)));
    cycHover = day; drawCycles();
    const rows = I.cycles.map((c, k) => {
      const i = c.i0 + day; if (i > N - 1) return "";
      return `<div class="r"><span class="sw" style="background:var(${CYC_COLORS[k]})"></span>${c.year}: <b>${mult(I.px[i] / I.px[c.i0])}</b> · ${usd(I.px[i])}</div>`;
    }).join("");
    tip.innerHTML = `<div class="d">Day ${day} (${(day / 30.44).toFixed(1)} months) after the halving</div>${rows}`;
    tip.style.display = "block";
    const x = ev.clientX - r.left, tw = tip.offsetWidth;
    tip.style.left = (x + 14 + tw > r.width ? x - 14 - tw : x + 14) + "px"; tip.style.top = "10px";
  });
  wrap.addEventListener("pointerleave", () => { cycHover = null; tip.style.display = "none"; drawCycles(); });
}
function cycleTables() {
  const t = I.typical, cur = I.cycles[I.cycles.length - 1];
  $("btc-cycTable").innerHTML = `<thead><tr><th>Cycle</th><th>Price at halving</th><th>Peak</th><th>Days to peak</th><th>Halving → peak</th><th>Trough</th><th>Peak → trough</th><th>Fall</th></tr></thead><tbody>` +
    I.cycles.map((c, k) => `<tr class="${c.open ? "now" : ""}"><th><span class="key" style="--c:var(${CYC_COLORS[k]})"></span>${c.year}</th>
      <td>${usd(I.px[c.i0])}</td><td>${usd(I.px[c.peak])}<small>${nice(D.d[c.peak])}</small></td><td>${c.toPeak}</td><td>${mult(c.multiple)}</td>
      <td>${usd(I.px[c.trough])}<small>${nice(D.d[c.trough])}${c.open ? " · lowest so far" : ""}</small></td><td>${c.peakToTrough}d${c.open ? "+" : ""}</td><td class="neg">${pct(c.fall)}</td></tr>`).join("") + "</tbody>";
  const tr0 = D.d[cur.peak] + t.troughMin, tr1 = D.d[cur.peak] + t.troughMax;
  const status = lastDay < tr0 ? `${tr0 - lastDay} days before it opens` : lastDay <= tr1 ? `today sits inside it, with ${tr1 - lastDay} days left` : `it closed ${lastDay - tr1} days ago`;
  $("btc-cycNow").innerHTML = `The ${cur.year} cycle peaked at <b>${usd(I.px[cur.peak])}</b> on ${nice(D.d[cur.peak])}, ${cur.toPeak} days after the halving.
    That's in line with the two cycles before it (${I.cycles.slice(-3, -1).map(c => c.toPeak).join(" and ")} days), but the move from halving to peak was only <b>${mult(cur.multiple)}</b>, against
    ${I.cycles.slice(0, -1).map(c => mult(c.multiple)).join(", ")} before it. In the ${t.n} completed cycles the trough came ${t.troughMin}–${t.troughMax} days after the peak, which puts the
    window at <b>${nice(tr0)} – ${nice(tr1)}</b>: ${status}. The low so far is <b>${usd(I.px[cur.trough])}</b> (${pct(cur.fall)}) on ${nice(D.d[cur.trough])};
    past bear markets went ${I.cycles.slice(0, -1).map(c => pct(c.fall)).join(", ")}.`;
}

/* ---------- rules backtest ---------- */
const RULE_COLORS = { bh: "--muted", ma: "--line-ma", cyc: "--cyc-3", cyc2: "--cat-halving", mood: "--band-xfear", moodc: "--cyc-1" };
const ruleShow = { bh: true, ma: true, cyc: true, cyc2: true, mood: true, moodc: false };
function drawRules() {
  const { g, w, h } = setup($("btc-ruleCanvas"));
  const P = { l: 8, r: 56, t: 10, b: 22 }, d0 = D.d[I.S0], d1 = lastDay, X = d => P.l + (w - P.l - P.r) * (d - d0) / (d1 - d0);
  let hi = 1; for (const r of I.RULES) if (ruleShow[r.key]) for (let i = I.S0; i < N; i++) if (r.curve[i] > hi) hi = r.curve[i];
  const lo = 0.5, Y = v => P.t + (h - P.t - P.b) * (1 - Math.log(v / lo) / Math.log(hi * 1.3 / lo));
  g.font = "11px Inter, system-ui, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left"; g.strokeStyle = css("--grid"); g.fillStyle = css("--muted");
  for (let e = 0; 10 ** e <= hi * 1.3; e++) { const y = Math.round(Y(10 ** e)) + .5; g.beginPath(); g.moveTo(P.l, y); g.lineTo(w - P.r, y); g.stroke(); g.fillText(e < 3 ? (10 ** e) + "×" : (10 ** (e - 3)) + "k×", w - P.r + 6, y); }
  g.textAlign = "center"; g.textBaseline = "top";
  for (let y = 2014; y <= 2026; y += 2) g.fillText(String(y), X(toDay(`${y}-01-01`)), h - P.b + 6);
  for (const hv of I.HALVINGS) { const x = Math.round(X(hv)) + .5; g.strokeStyle = css("--cat-halving"); g.globalAlpha = .5; g.beginPath(); g.moveTo(x, P.t); g.lineTo(x, h - P.b); g.stroke(); g.globalAlpha = 1; }
  for (const r of I.RULES) {
    if (!ruleShow[r.key]) continue;
    g.strokeStyle = css(RULE_COLORS[r.key]); g.lineWidth = r.key === "bh" ? 1.3 : 1.7; g.beginPath();
    for (let i = I.S0; i < N; i += 2) { const x = X(D.d[i]), y = Y(r.curve[i]); i === I.S0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
  }
}
function rulesTable() {
  const edges = [...I.HALVINGS.map(d => I.dayIdx(d)), N - 1];
  const per = r => edges.slice(0, -1).map((a, k) => { const b = edges[k + 1]; return (r.curve[b] / r.curve[a]) ** (365 / (b - a)) - 1; });
  const best = Math.max(...I.RULES.map(r => r.cagr));
  $("btc-ruleTable").innerHTML = `<thead><tr><th>Rule</th><th>CAGR</th><th>Max fall</th><th>Vol</th><th>In market</th>${I.cycles.map(c => `<th>${c.year} cycle</th>`).join("")}</tr></thead><tbody>` +
    I.RULES.map(r => `<tr class="${r.cagr === best ? "now" : ""}"><th><button type="button" class="rk" data-k="${r.key}" aria-pressed="${ruleShow[r.key]}"><span class="sw" style="background:var(${RULE_COLORS[r.key]})"></span>${r.label}</button></th>
      <td>${pct(r.cagr)}</td><td class="neg">${pct(r.maxDD)}</td><td>${Math.round(r.vol * 100)}%</td><td>${Math.round(r.inMkt * 100)}%</td>${per(r).map(v => `<td class="${cls(v)}">${pct(v)}</td>`).join("")}</tr>`).join("") + "</tbody>";
  $("btc-ruleTable").onclick = e => { const b = e.target.closest(".rk"); if (!b) return; ruleShow[b.dataset.k] = !ruleShow[b.dataset.k]; b.setAttribute("aria-pressed", ruleShow[b.dataset.k]); drawRules(); };
  $("btc-ruleSince").textContent = `${nice(D.d[I.S0])} to ${nice(lastDay)}`;
}

/* ---------- trend ---------- */
function trendBox() {
  const t = I.trend, above = I.px[last] >= I.ma200[last];
  $("btc-trendNow").innerHTML = `Bitcoin is <b class="${above ? "pos" : "neg"}">${above ? "above" : "below"}</b> its 200-day average (${usd(I.ma200[last])}),
    ${pct(I.px[last] / I.ma200[last] - 1)} away. The 200-week average, the line every past bear market bottomed near, is ${usd(I.ma200w[last])}.`;
  $("btc-trendTable").innerHTML = `<thead><tr><th>Day after a close</th><th>Days</th><th>Annualised return</th><th>Annualised vol</th></tr></thead><tbody>
    <tr><th>Above the 200-day</th><td>${t.up.days.toLocaleString()}</td><td class="pos">${pct(t.up.annRet)}</td><td>${Math.round(t.up.annVol * 100)}%</td></tr>
    <tr><th>Below the 200-day</th><td>${t.down.days.toLocaleString()}</td><td class="${cls(t.down.annRet)}">${pct(t.down.annRet)}</td><td>${Math.round(t.down.annVol * 100)}%</td></tr></tbody>`;
}

/* ---------- boot ---------- */
function drawAll() { drawMain(); drawCycles(); drawRules(); }
tiles(); controls(); syncButtons(); interactions(); cycleInteractions();
moodPanel(); cycleTables(); rulesTable(); trendBox(); eventList();
$("btc-evList").onclick = e => { const b = e.target.closest(".ev-card"); if (b) selectEvent(EVENTS[+b.dataset.k]); };
$("btc-evClose").onclick = () => selectEvent(S.sel);
$("btc-genDate").textContent = "data to " + nice(lastDay);
drawAll();
document.getElementById("btc-app").classList.add("ready");
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawAll, 80); });
new MutationObserver(() => { tiles(); moodPanel(); cycleTables(); rulesTable(); drawAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { tiles(); moodPanel(); drawAll(); });
})();
