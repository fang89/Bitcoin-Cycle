"""Daily Bitcoin history from the Coin Metrics community API (free, no key) -> data.js.

Price, MVRV (market cap / realised cap), hash rate and active addresses, one row per UTC day,
from July 2010. Run after 00:00 UTC to pick up the previous day.
"""
import json, urllib.request, datetime as dt

URL = ("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics"
       "?assets=btc&metrics=PriceUSD,CapMVRVCur,HashRate,AdrActCnt"
       "&frequency=1d&page_size=10000&start_time=2010-07-18")
KEYS = {"PriceUSD": "c", "CapMVRVCur": "mvrv", "HashRate": "hash", "AdrActCnt": "addr"}


def rows():
    url = URL
    while url:
        with urllib.request.urlopen(url, timeout=60) as r:
            page = json.load(r)
        yield from page["data"]
        url = page.get("next_page_url")


def main():
    out = {"d": [], **{k: [] for k in KEYS.values()}}
    for row in sorted(rows(), key=lambda r: r["time"]):
        if "PriceUSD" not in row:
            continue
        day = dt.date.fromisoformat(row["time"][:10])
        out["d"].append((day - dt.date(1970, 1, 1)).days)
        for src, k in KEYS.items():
            v = row.get(src)
            if v is None:
                out[k].append(None)
            else:
                v = float(v)
                out[k].append(round(v, 2) if k == "c" and v >= 1 else round(v, 6) if k != "addr" else int(v))
    # hash rate in EH/s keeps the file small
    out["hash"] = [None if v is None else round(v / 1e6, 4) for v in out["hash"]]
    meta = {"source": "Coin Metrics community API", "asOf": dt.date.fromordinal(dt.date(1970, 1, 1).toordinal() + out["d"][-1]).isoformat()}
    with open("data.js", "w") as f:
        f.write("window.BTC_DATA=" + json.dumps({"meta": meta, **out}, separators=(",", ":")) + ";\n")
    print(len(out["d"]), "days", meta["asOf"])


if __name__ == "__main__":
    main()
