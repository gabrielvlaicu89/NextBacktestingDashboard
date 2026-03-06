# Lesson 15 — The Data Fetching Layer: yfinance, httpx, and Caching

Every algorithmic trading backtester is ultimately only as good as the market data it runs on.
Before a single signal can be generated, raw OHLCV price bars and earnings calendars must be
downloaded, validated, normalised, and — critically — cached so that a parameter optimisation
loop running thousands of combinations doesn't hammer external APIs thousands of times.
This lesson explains how `services/data_fetcher.py` does all of that, and why each architectural
decision was made.

---

## Section: Two Data Sources, Two Different APIs

The backtester relies on two external data sources:

| Source | Data | Library / Protocol | Auth |
|---|---|---|---|
| Yahoo Finance | OHLCV price bars | `yfinance` (unofficial scrape) | None |
| Alpha Vantage | Quarterly EPS / Earnings dates | HTTP REST (JSON) | API key |

Because the two sources are fetched differently, they live in two separate functions:
`fetch_ohlcv` and `fetch_earnings`.

```
Client request
     │
     ▼
backtest router
     │
     ├─► fetch_ohlcv(ticker, date_from, date_to)  ──► yfinance.download()
     │                                                  Yahoo Finance servers
     │
     └─► fetch_earnings(ticker)  ──► httpx.Client.get()
                                      api.alphavantage.co
```

---

## Section: Fetching OHLCV with yfinance

```python
# backend/app/services/data_fetcher.py

@functools.lru_cache(maxsize=256)
def fetch_ohlcv(ticker: str, date_from: date, date_to: date) -> pd.DataFrame:
    df = yf.download(
        ticker,
        start=str(date_from),
        end=str(date_to),
        auto_adjust=True,   # ① prices adjusted for splits and dividends automatically
        progress=False,     # ② suppress the ASCII progress bar in server logs
        actions=False,      # ③ exclude dividend/split columns from the output
    )

    if df.empty:
        raise ValueError(f"No data returned for ticker '{ticker}'…")

    if len(df) < 10:
        raise ValueError(f"Insufficient data for '{ticker}': only {len(df)} days found…")

    # ④ yfinance ≥ 0.2 returns MultiIndex columns when downloading multiple tickers
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    return df[["Open", "High", "Low", "Close", "Volume"]].dropna()
```

**① `auto_adjust=True`** — Without this, the `Close` price on any day before a stock split
would look artificially low. For example, Apple's 4:1 split in 2020 would make all pre-2020
prices look 4× cheaper than they actually were from a strategy's perspective, producing
completely fictitious signals. Adjusted prices are the correct input for backtesting.

**② `progress=False`** — `yfinance` prints a `[***...]` progress bar to stdout by default.
In a web server context that noise ends up in application logs and looks like corruption.

**③ `actions=False`** — By default yfinance includes `Dividends` and `Stock Splits` columns.
The strategy engine doesn't use them, so they add noise and slightly slow down downstream
`dropna()` calls.

**④ MultiIndex guard** — When you download a single ticker, yfinance returns a flat DataFrame.
When you download multiple at once it returns a MultiIndex. Because future refactors might
call `download` differently, the guard future-proofs the function.

---

## Section: Fetching Earnings with httpx

The Alpha Vantage EARNINGS endpoint returns a JSON payload like this:

```json
{
  "symbol": "AAPL",
  "quarterlyEarnings": [
    {
      "reportedDate": "2024-08-01",
      "reportedEPS": "1.40",
      "estimatedEPS": "1.35",
      "surprisePercentage": "3.7"
    },
    ...
  ]
}
```

The fetcher normalises this into a flat list of dicts:

```python
@functools.lru_cache(maxsize=128)
def fetch_earnings(ticker: str, api_key: str | None = None) -> list[dict]:
    key = api_key or os.environ.get("ALPHA_VANTAGE_API_KEY")
    if not key:
        logger.warning("ALPHA_VANTAGE_API_KEY not set — earnings data unavailable")
        return []                    # ① graceful degradation

    url = "https://www.alphavantage.co/query"
    params = {"function": "EARNINGS", "symbol": ticker, "apikey": key}

    try:
        with httpx.Client(timeout=10) as client:  # ② synchronous, not async
            resp = client.get(url, params=params)
            resp.raise_for_status()               # ③ raises on 4xx / 5xx
            data = resp.json()
    except Exception as exc:
        logger.error(f"Alpha Vantage request failed for '{ticker}': {exc}")
        return []                                 # ① graceful degradation

    results = []
    for item in data.get("quarterlyEarnings", []):
        try:
            results.append({
                "date": item["reportedDate"],
                "reported_eps": float(item.get("reportedEPS", 0) or 0),
                "estimated_eps": float(item.get("estimatedEPS", 0) or 0),
                "surprise_pct": float(item.get("surprisePercentage", 0) or 0),
            })
        except (ValueError, KeyError, TypeError):
            continue                              # ④ skip malformed records
    return results
```

**① Graceful degradation** — Alpha Vantage's free tier allows only 25 requests per day.
If the key is missing, or the request fails for any reason, returning `[]` allows the rest
of the backtest to continue. `EarningsDriftStrategy` detects an empty list and produces no
signals — a sensible fallback rather than a 500 error.

**② Synchronous `httpx`** — The FastAPI backtest endpoint is an `async` function, but
`fetch_earnings` is synchronous. This is intentional: it is called with
`await asyncio.to_thread(fetch_earnings, ticker)`, which runs the blocking network call in
a thread pool so the event loop is not blocked. Mixing sync and async here correctly isolates
the blocking I/O.

**③ `raise_for_status()`** — Without this, an HTTP 403 (bad API key) or 429 (rate limited)
response would silently succeed and return an empty or error-keyed JSON body, making the
failure invisible.

**④ Per-record `try/except`** — Alpha Vantage occasionally returns `"None"` as a string value
for EPS fields. The `or 0` handles empty string / `None` coercion, and the `except` block
ensures one bad record doesn't abort the entire earnings history.

---

## Section: In-Memory Caching with `lru_cache`

Both functions are decorated with `@functools.lru_cache`. This is the single most important
performance decision in the data layer.

### Why it matters for optimisation

The grid search optimizer (`services/optimizer.py`) runs the same strategy hundreds of times
with different parameter combinations — e.g., testing every combination of `zscore_window`
in `[10, 15, 20, 25, 30]` × `zscore_threshold` in `[1.5, 2.0, 2.5]` = 15 backtests.
Every one of those backtests uses the same ticker and date range. Without caching, that's
15 identical calls to Yahoo Finance — slow, rate-limited, and wasteful.

With `lru_cache`, the first call downloads and stores the result; calls 2–15 return the
cached `pd.DataFrame` in microseconds.

### Why the arguments must be hashable

`lru_cache` keys the cache on the function's arguments. This requires **all arguments to be
hashable**. `pd.DataFrame` is not hashable, but `str`, `date`, and `int` are — which is
exactly why `fetch_ohlcv` takes `date` objects rather than a DataFrame parameter.

```python
# ✅ Works — date is hashable
fetch_ohlcv("SPY", date(2024, 1, 1), date(2024, 12, 31))

# ❌ Would break lru_cache — DataFrames aren't hashable
fetch_ohlcv("SPY", my_df)
```

### Cache size reasoning

| Cache | `maxsize` | Rationale |
|---|---|---|
| `fetch_ohlcv` | 256 | One optimisation run tests at most a handful of tickers; 256 covers many concurrent users |
| `fetch_earnings` | 128 | Earnings data is per-ticker only (no date range key); 128 tickers is generous |

---

## Section: Why We Chose `httpx` over `requests`

The obvious alternative would have been the popular `requests` library. We chose `httpx` because:

1. **Already a project dependency** — FastAPI recommends `httpx` for its test client (`AsyncClient`). Adding it for production use adds zero new dependencies.
2. **Async-compatible** — `httpx` has an `AsyncClient` alongside its synchronous `Client`. If we ever need to fetch earnings asynchronously in the future, the migration is trivial: swap `httpx.Client` for `httpx.AsyncClient` and add `await`.
3. **Timeout parameter is first-class** — `httpx.Client(timeout=10)` sets both connect and read timeouts in one argument. With `requests`, timeouts are a tuple passed per-call: `requests.get(url, timeout=(3, 10))`.

---

## Key Takeaway

> Cache external data at the source function boundary. Every function that hits a network should be decorated with `lru_cache` (or an equivalent), validated for empty/short results, and return a graceful fallback rather than raising — so a missing API key degrades the feature, not the entire request.

---

**Next:** [Lesson 16 — Strategy Data Injection: Keeping Strategies Stateless](./16-strategy-data-injection.md)
