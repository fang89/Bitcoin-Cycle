# Market mood and the four-year cycle: methodology

This note covers the three things on the dashboard: the **market mood index**, the **four-year
halving cycle**, and the **trading-rule backtests** that test both. All figures use Coin Metrics
daily data from 18 July 2010 to 16 October 2026. To reproduce every table, run
`python3 tools/backtest.py`.

> **The short version.**
> - **The cycle has held four times out of four.** Peaks came 371–546 days after the halving.
>   Every completed bear market fell 77–85% and bottomed 364–406 days after the peak.
> - **A rule built only on the halving clock beat buy-and-hold.** Holding for 18 months after
>   each halving and sitting in cash the rest of the time compounded at 100% a year, against
>   88% for buy-and-hold, with coins held 43% of the time.
> - **But four cycles is not a sample.** The size of each run has shrunk every time (92×, 30×,
>   8×, 2×). Timings set from the first two cycles missed the next two peaks by about three months.
> - **Mood ported from the STI works at one end only.** Extreme fear was followed by a higher
>   price a year later in 5 of 5 years. Extreme greed came before the *largest* gains, so in
>   bitcoin, greed is momentum, not a sell signal. "Buy fear, sell greed" was the worst rule tested.

---

## 1. Data

| Series | Source | From | Used for |
|---|---|---|---|
| Price (USD, daily close at 00:00 UTC) | Coin Metrics community API, `PriceUSD` | Jul 2010 | Everything |
| MVRV | Coin Metrics, `CapMVRVCur` | Jul 2010 | Valuation input |
| Active addresses | Coin Metrics, `AdrActCnt` | Jul 2010 | Network input |

Coin Metrics is free and needs no key. Its history goes back further than Yahoo's `BTC-USD`, which
starts in September 2014 and so would miss the 2012 halving. There are no gaps: 5,935 days, one
row per day.

**MVRV** divides market cap by *realised* cap. Realised cap values every coin at the price it
last moved on-chain, which approximates what holders paid in aggregate. MVRV below 1 means the
average holder is under water.

## 2. The mood index

### 2.1 Same build as the STI, two inputs swapped

The STI dashboard's mood blends five price-based readings. Two of them, breadth and new highs
minus new lows, need a basket of member stocks. Bitcoin is a single asset, so those two are
replaced with the closest on-chain equivalents:

| Input | Calc on day *t* | Risk-on when | Replaces on the STI |
|---|---|---|---|
| **Trend** | price ÷ 200-day SMA − 1 | high | (same) |
| **Valuation** | MVRV | high | Breadth |
| **Network** | 30-day avg active addresses ÷ 365-day avg − 1 | high | Highs vs lows |
| **Drawdown** | price ÷ trailing 365-day high − 1 | near 0 | (same) |
| **Calm** | 30-day realised vol, annualised (× √365) | low | (same) |

Bitcoin trades every day, so every window is in calendar days: a 365-day year, not 252 trading
days.

### 2.2 Normalise, average, band

These steps are unchanged from the STI:

1. **Rank.** Each input becomes its percentile rank within its own trailing 1,095 days (three
   years), today included, with ties shared. A rank needs at least 365 observations. Calm is
   flipped (`1 − vol rank`) so that 1.0 always means the most risk-on reading.
2. **Average.** `mood = 100 × mean(ranks)`, needing at least 3 of 5. No fitted weights.
3. **Band.** 0–20 extreme fear, 20–40 fear, 40–60 neutral, 60–80 greed, 80–100 extreme greed.

The mood starts on 1 February 2012, once a year of ranks exists. Every value uses only data known
at that day's close.

All of these parameters were carried over from the STI build or taken from the literature
before any bitcoin result was looked at. Nothing here was tuned.

### 2.3 How the components relate

|  | trend | valuation | network | drawdown | calm |
|---|---|---|---|---|---|
| trend | 1.00 | 0.79 | 0.44 | 0.82 | −0.12 |
| valuation | 0.79 | 1.00 | 0.19 | 0.76 | −0.18 |
| network | 0.44 | 0.19 | 1.00 | 0.37 | −0.07 |
| drawdown | 0.82 | 0.76 | 0.37 | 1.00 | 0.14 |
| calm | −0.12 | −0.18 | −0.07 | 0.14 | 1.00 |

Trend, valuation and drawdown overlap heavily: they are three views of the same price path.
Network activity and calm add the most independent information.

### 2.4 What followed each band

Median forward return, with the share of days that ended higher:

| Mood | Days | 1m | 3m | 6m | 12m |
|---|---|---|---|---|---|
| Extreme fear | 458 | +2.5% (60%) | −4.7% (40%) | −3.5% (47%) | **+56% (76%)** |
| Fear | 1,226 | −1.7% (46%) | −9.0% (45%) | −13.3% (44%) | +34% (61%) |
| Neutral | 1,726 | +5.2% (63%) | +15.8% (65%) | +38% (71%) | +114% (73%) |
| Greed | 1,749 | +5.0% (60%) | +19.0% (69%) | +45% (74%) | +124% (73%) |
| Extreme greed | 213 | +7.1% (65%) | +59% (80%) | +188% (92%) | **+263% (80%)** |

Daily observations overlap heavily, so the next table is the honest one. It averages the 12-month
result within each calendar year first, then counts the years that ended higher. A spell is a
fresh visit to the band after at least 180 days away from it.

| Mood | Years higher | Median year | Spells | Since 2017: median 12m, % up |
|---|---|---|---|---|
| Extreme fear | **5 of 5** | +70% | 5 | +45%, 73% |
| Fear | 9 of 12 | +101% | 9 | +30%, 61% |
| Neutral | 10 of 14 | +111% | 7 | +67%, 70% |
| Greed | 9 of 13 | +94% | 5 | +37%, 63% |
| Extreme greed | 5 of 8 | +75% | 5 | +217%, 77% |
| Any day | 11 of 14 | +88% | | +49%, 67% |

The extreme-fear spells started in Jan 2015, Feb 2018, Mar 2020, Mar 2022 and Jan 2026. The
extreme-greed spells started in Dec 2016, Jun 2019, Jul 2020, Nov 2023 and Nov 2024.

**What this says:**

- **Fear is a 12-month buy, not a 3-month one.** Over 3 and 6 months, fear and extreme fear had
  the *worst* medians: bitcoin bear markets grind on for months after the first panic. Over 12
  months, extreme fear came out higher in every year it appeared.
- **Greed is momentum.** On the STI, extreme greed was a coin flip a year later. On bitcoin it
  came before the biggest gains in the table, at every horizon. A greedy reading usually means a
  bull run is under way, and bitcoin's bull runs have been long.
- **The sample is tiny.** There are five spells at each extreme. The early years, when bitcoin
  went up 100× in a cycle, inflate every forward return. The post-2017 columns are smaller, but
  the ordering holds.

### 2.5 Each component on its own

Median 12-month forward return by percentile bucket (0–20 = most bearish reading):

| Component | 0–20 | 20–40 | 40–60 | 60–80 | 80–100 |
|---|---|---|---|---|---|
| Trend | +28% | +74% | +148% | +135% | +58% |
| Valuation (MVRV) | +73% (90% up) | +118% | +184% | +92% | +32% |
| Network | +68% | +43% | +117% | +125% | +121% |
| Drawdown | +46% | −15% | +90% | +112% | +153% |
| Calm | +22% | +19% | +56% | +106% | +156% |

MVRV is the only input that behaves the way a contrarian would hope at both ends. Its lowest
bucket was higher a year later 90% of the time, and its highest bucket had the weakest median.
Drawdown and calm are momentum gauges. The mood blends both kinds, which is why it ends up
contrarian only at the fearful extreme.

## 3. The four-year cycle

### 3.1 The theory

Every 210,000 blocks, roughly four years, the reward paid to miners halves. That halves the new
supply hitting the market. The folk model goes like this:

- A bull market starts around the halving and peaks 12–18 months after it.
- A bear market of about −80% follows and bottoms around a year after the peak.
- The price then base-builds into the next halving.

### 3.2 Anatomy

Pre-registered definitions:

- **Peak:** the highest close within 730 days of the halving.
- **Trough:** the lowest close within 730 days of that peak.

| Halving | Price | Peak | Days to peak | Halving → peak | Trough | Peak → trough | Fall |
|---|---|---|---|---|---|---|---|
| 28 Nov 2012 | $12 | 4 Dec 2013 | 371 | 92× | 14 Jan 2015 | 406d | −85% |
| 9 Jul 2016 | $652 | 16 Dec 2017 | 525 | 30× | 15 Dec 2018 | 364d | −84% |
| 11 May 2020 | $8,592 | 8 Nov 2021 | 546 | 7.9× | 9 Nov 2022 | 366d | −77% |
| 20 Apr 2024 | $64,908 | 6 Oct 2025 | 534 | 1.9× | 30 Jun 2026* | 267d* | −53%* |

\* Cycle still open; this is the lowest close so far.

Each cycle low came 513–720 days *before* the next halving. Timing has been remarkably steady. Size
has not: every cycle's run has been roughly a quarter to a third of the one before.

**Returns by year of the cycle** (365-day blocks counted from each halving):

| Cycle | Year 1 | Year 2 | Year 3 | Year 4 |
|---|---|---|---|---|
| 2012 | +8,070% | −62% | −6% | +104% |
| 2016 | +284% | +166% | +89% | −25% |
| 2020 | +559% | −49% | −6% | +126% |
| 2024 | +31% | −11% | open | |
| Median | +422% | −30% | −6% | +104% |

Year 1 was the best year in every cycle. Year 2 was negative in three of four. The 2016 cycle is
the exception, because its peak landed late in year 2.

### 3.3 Trading the clock

All rules run on the same sample, from the first halving to today. Each signal is taken at the
close and traded the next day. There are no costs, and cash earns 0%.

| Rule | CAGR | Max fall | Vol | In market |
|---|---|---|---|---|
| Buy and hold | 88% | −85% | 75% | 100% |
| Above the 200-day SMA | 91% | −71% | 63% | 61% |
| **0–18 months after each halving** | **100%** | −71% | 57% | 43% |
| **12 months before to 18 months after** | **129%** | −71% | 65% | 65% |
| Halving window *and* above the 200-day | 79% | −71% | 54% | 38% |
| Mood: buy under 20, sell over 80 | 19% | −72% | 41% | 44% |
| Mood, but never sell in months 0–18 | 53% | −84% | 55% | 64% |

CAGR within each cycle:

| Rule | 2012–16 | 2016–20 | 2020–24 | 2024–now |
|---|---|---|---|---|
| Buy and hold | 200% | 96% | 67% | 10% |
| 200-day SMA | 210% | 94% | 73% | 6% |
| 0–18m after halving | 196% | 126% | 67% | 24% |
| 12m before to 18m after | 272% | 139% | 108% | 24% |
| Mood swing | 29% | 38% | 6% | 1% |

The 12-months-before rule beat buy-and-hold in all four cycles; the 0–18 month rule did in three, and trailed by 4 points in 2012–16. Their whole edge is sitting out
the bear market in years 2–3. They don't avoid the worst drawdown: the −71% is the 2013–14 crash,
which started inside the first 18-month window.

### 3.4 Is it the halving, or just any four-year clock?

**Placebo test.** I took the same 18-month window, slid its anchor across every week of a
1,461-day clock and re-ran it on the same sample. The real halving anchor (100% CAGR) beat all 209
shifted versions; the median shifted version made 24%.

That is consistent with the theory, but it is not proof. With only four cycles, *some* phase
had to line up with the four bull runs. The test shows that the halving dates are that phase,
not that the halving caused the runs. Other explanations fit the same four data points: global
liquidity cycles, the 2013, 2017 and 2021 retail manias, and a self-fulfilling narrative.

### 3.5 Out of sample

The cycle theory was popularised around 2017–2019. To test it on cycles it didn't see, I set the
timings from the 2012 and 2016 cycles only (peak 448 days after the halving, trough 385 days
after the peak) and applied them to the two later cycles:

| Cycle | Predicted peak | Actual | Miss | Price on predicted day vs actual peak | Predicted trough | Actual |
|---|---|---|---|---|---|---|
| 2020 | 2 Aug 2021 | 8 Nov 2021 | +98d | −42% | 22 Aug 2022 | 9 Nov 2022 (+79d) |
| 2024 | 12 Jul 2025 | 6 Oct 2025 | +86d | −6% | 1 Aug 2026 | open (low so far 30 Jun 2026) |

Selling on the predicted day and holding cash for the rest of the cycle:

- **2020 cycle:** 44% CAGR against 63% for buy-and-hold. The max fall was −53% against −77%.
- **2024 cycle:** 27% CAGR against 10%. The max fall was −28% against −53%.

The clock got the *shape* right twice out of sample. It was about a quarter early on the peak
both times, and in 2021 being early cost 42% of the top.

### 3.6 Mood and the clock together

Median 12-month return by mood band, split by where the halving clock was:

| Mood | 0–18 months | 18–30 months | 30+ months |
|---|---|---|---|
| Extreme fear | — | +45% (73% up) | +134% (100% up) |
| Fear | **−38% (28% up)** | +16% (54% up) | +157% (100% up) |
| Neutral | +82% | **−61% (0% up)** | +129% |
| Greed | +44% | — | +121% |
| Extreme greed | **+275% (80% up)** | — | — |

The clock changes how to read the mood:

- **Fear early in the cycle was a trap.** Fear in months 0–18 usually meant the peak was already
  in, as in early 2014 and mid-2021, and the next year was lower.
- **Fear after month 30 was the best entry in the data.** It was higher a year later every time.
- **Extreme greed has almost only shown up in the first 18 months**, which is the bull window.

Cells are a few hundred overlapping days from at most four cycles. Read them as descriptions of
history, not as estimates.

## 4. Thresholds the market already watches

These sit outside the mood. They are fixed levels, not ranks, quoted for reference:

| Signal | Days | Median 12m after | Higher a year later | Spells |
|---|---|---|---|---|
| MVRV < 1 | 662 | +98% | 99% | 5 |
| MVRV > 3.5 | 106 | −16% | 40% | 4 |
| Price below the 200-week SMA | 380 | +121% | 100% | 5 |
| Above the 200-day SMA | 3,378 | +126% | 74% | |
| Below the 200-day SMA | 2,025 | +45% | 66% | |

On-chain valuation and the 200-week average have the cleanest record at the bottom of the
cycle. The price fell through the 200-week average again in June 2026; that spell's 12-month
result is not in yet.

## 5. Caveats

- **Four cycles.** Every cycle statistic rests on three completed cycles and one open one.
- **Survivorship of the narrative.** The cycle theory is famous because it worked, and it is
  testable only on the data that made it famous.
- **Shrinking runs.** Each halving cuts new supply by a smaller share of the coins already out.
  ETFs and treasury companies now set much of the marginal demand. Either could weaken the clock.
- **Early-era distortion.** Returns before 2014 come from a market with very thin trading.
  The post-2017 columns help, but they don't solve this.
- **Frictionless backtests.** No fees, spreads, taxes or funding costs, and cash earns 0%. In
  practice, cash earning T-bill rates would help the timing rules.
- **Not investment advice.** These are base rates for setting expectations, not trade signals.

## 6. Today (16 Oct 2026)

- It is day 909 of the 2024 cycle, with about 547 days to the next halving (estimated for April
  2028).
- The price is 35% below the 6 October 2025 peak. The low so far is $58,525, down 53%, on 30 June
  2026.
- Past troughs came 364–406 days after the peak. Timed from this cycle's peak, that window runs
  from 5 October to 16 November 2026, so today sits inside it.
- The mood is 51 (neutral), MVRV is 1.51 and the price is above its 200-day average.
- If the clock holds, the classic setup is the next 12 months: the "12 months before the halving"
  entry would open in April 2027. If the run shrinks again as the multiples suggest, a −53% fall
  may already have been this cycle's bear market.
