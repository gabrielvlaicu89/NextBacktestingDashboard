# Lesson 43 — Rate Limiting, Edge Cases, and Defensive Backend Design

A backtesting engine interacts with external APIs, financial data feeds, and user-supplied parameters that can be nonsensical. Phase 11 hardened the backend against three categories of real-world failure: external API rate limits (Alpha Vantage's 25-requests-per-day free tier), data edge cases (delisted tickers, weekend-only date ranges), and strategy-specific parameter validation (pairs trading with identical tickers). This lesson covers the patterns we used to handle each, and why "fail gracefully with a clear message" is always better than "crash with a traceback."

---

## Section: Thread-Safe Rate Limiting (Token Bucket)

### The Problem

Alpha Vantage's free tier allows 25 API requests per day. If a user runs multiple backtests of the Earnings Drift strategy in quick succession (or triggers an optimization that tests 50 parameter combinations), we'll blow through that limit in seconds. Alpha Vantage doesn't return a helpful HTTP 429 — instead, it returns HTTP 200 with a `"Note"` key in the JSON body explaining you've been rate-limited. If we don't detect this, we'd parse the response as valid earnings data and get garbage results.

### The Implementation

We built a thread-safe token bucket rate limiter:

```python
# backend/app/services/data_fetcher.py

class _AlphaVantageRateLimiter:
    """Thread-safe rate limiter for Alpha Vantage free tier (25 req/day)."""

    def __init__(self, max_per_day: int = 25):
        self._lock = threading.Lock()
        self._timestamps: list[float] = []
        self._window = 86_400  # 24 hours in seconds
        self._max = max_per_day

    def acquire(self, timeout: float = 60) -> bool:
        """Block until a request slot is available or timeout expires.
        Returns True if acquired, False on timeout."""
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                now = time.monotonic()
                # Prune expired timestamps
                self._timestamps = [
                    t for t in self._timestamps if now - t < self._window
                ]
                if len(self._timestamps) < self._max:
                    self._timestamps.append(now)
                    return True
            if time.monotonic() >= deadline:
                return False
            time.sleep(1)
```

### How It Works

The algorithm is a **sliding window** token bucket:

```
Timeline (each █ is a request):

t=0    t=10   t=20   t=30
 █      █      █      █     ← 4 of 25 slots used

When acquire() is called at t=35:
  1. Prune: remove any timestamp where (now - t) ≥ 86400
  2. Count: len(timestamps) = 4, which is < 25
  3. Record: append now (t=35) to timestamps
  4. Return True

When limit is hit (25 timestamps all within last 24h):
  1. Prune: all 25 are recent, none pruned
  2. Count: 25 ≥ 25
  3. Release lock, sleep(1), re-check
  4. Repeat until timeout expires → return False
```

Key design choices:

| Decision | Why |
|---|---|
| `threading.Lock()` | FastAPI uses `asyncio.to_thread()` for our blocking calls — multiple threads may call `fetch_earnings` concurrently |
| `time.monotonic()` | Unlike `time.time()`, monotonic clocks are immune to system clock adjustments (NTP sync, DST changes) |
| Module-level singleton `_av_limiter` | All requests share one limiter — if we created per-request limiter instances, the limit would never be reached |
| 60-second timeout | If all 25 slots are used, we wait up to a minute before giving up — enough for the edge case where a slot is about to expire, but not so long that the user stares at a spinner indefinitely |

### Integration with `fetch_earnings`

```python
_av_limiter = _AlphaVantageRateLimiter()

@functools.lru_cache(maxsize=128)
def fetch_earnings(ticker: str, api_key: str | None = None) -> list[dict]:
    key = api_key or os.environ.get("ALPHA_VANTAGE_API_KEY")
    if not key:
        logger.warning("ALPHA_VANTAGE_API_KEY not set — earnings data unavailable")
        return []

    # Rate limiter gate — blocks until a slot opens or timeout
    if not _av_limiter.acquire(timeout=60):
        logger.warning(f"Alpha Vantage rate limit reached for '{ticker}' — skipping")
        return []

    with httpx.Client(timeout=10) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    # Detect Alpha Vantage's soft rate limit (HTTP 200 with "Note" key)
    if "Note" in data:
        logger.warning(f"Alpha Vantage rate limit note for '{ticker}': {data['Note']}")
        return []

    # ... parse quarterlyEarnings ...
```

Three layers of defense:

```
Layer 1: _av_limiter.acquire()     → prevents sending too many requests
Layer 2: "Note" key detection      → catches rate limits we missed (e.g., shared API key)
Layer 3: return []                  → graceful degradation — strategy runs without earnings data
```

### Why Not Raise an Exception?

Earnings data is *supplementary* for the Earnings Drift strategy — the strategy can still run with synthetic assumptions or an empty earnings list (it just won't generate signals). Raising an exception would abort the entire backtest over a rate limit. Returning `[]` with a log warning is a better trade-off: the user gets results (possibly suboptimal), and the log tells operators what happened.

---

## Section: Improved Error Messages

### The Problem

Before Phase 11, `fetch_ohlcv` raised generic `ValueError` messages:

```
ValueError: No data returned for ticker 'ENRN'
ValueError: Only 3 rows of data found for 'SPY'
```

These leave the user guessing: Is "ENRN" misspelled? Delisted? Did the date range only cover a weekend?

### The Fix

Error messages now include actionable hints:

```python
if df.empty:
    raise ValueError(
        f"No data returned for ticker '{ticker}' in range {date_from} – {date_to}. "
        "The ticker may be invalid, delisted, or the date range may predate its listing."
    )

if len(df) < 10:
    raise ValueError(
        f"Insufficient data for '{ticker}': only {len(df)} trading days found "
        f"in range {date_from} – {date_to}. "
        "Try a wider date range (weekends and holidays are excluded automatically)."
    )
```

The pattern: **state what happened** ("No data returned"), **suggest probable causes** ("may be delisted"), and **recommend an action** ("Try a wider date range"). This eliminates the user's need to debug the problem themselves.

These messages propagate all the way to the UI — the backtest router catches `ValueError` in its generic `except Exception` handler and sends it as an SSE error event:

```
Backend ValueError
     │
     ▼
_stream_backtest: except Exception as exc:
     yield _sse("error", message=str(exc))
     │
     ▼
SSE event: data: {"type":"error","message":"No data returned for ticker 'ENRN'..."}
     │
     ▼
useBacktestStream: toast.error(data.message)
     │
     ▼
User sees: Toast with full error message including "delisted" hint
```

---

## Section: Pairs Trading Edge Cases

### The Problem

Pairs trading requires two tickers — a primary ticker and a "ticker_b" parameter. Three things can go wrong:

1. **Missing `ticker_b`** — the user forgot to fill in the second ticker
2. **`ticker_b` equals the primary ticker** — trading SPY against SPY is mathematically meaningless (spread is always zero)
3. **`ticker_b` data fetch fails** — the second ticker might be invalid or delisted

Before Phase 11, case 1 would crash in the `PairsTradingStrategy` constructor, and cases 2-3 would produce confusing errors.

### The Fix

We added explicit validation in `backtest.py` *before* the strategy runs:

```python
# backend/app/routers/backtest.py — inside _stream_backtest()

if request.strategy_type == StrategyType.PAIRS_TRADING:
    ticker_b = request.parameters.get("ticker_b")

    # Case 1: Missing ticker_b
    if not ticker_b:
        yield _sse("error", message="Pairs trading requires a 'ticker_b' parameter.")
        return

    # Case 2: Same ticker
    if ticker_b == request.ticker:
        yield _sse("error", message="Ticker B must be different from the primary ticker.")
        return

    # Case 3: Data fetch failure for ticker_b
    yield _sse("progress", percent=35, message=f"Fetching {ticker_b} data…")
    try:
        df_b = await asyncio.to_thread(
            fetch_ohlcv, ticker_b, request.date_from, request.date_to
        )
    except ValueError as exc:
        yield _sse("error", message=f"Ticker B ({ticker_b}): {exc}")
        return

    if isinstance(strategy, PairsTradingStrategy):
        strategy.set_df_b(df_b)
```

### Why Validate in the Router, Not the Strategy?

The strategy engine (`engine/pairs_trading.py`) is a pure computation layer — it takes DataFrames and returns trades. It shouldn't know about SSE events, HTTP error messages, or user-facing text. The router is the correct place for input validation because:

1. It has access to the SSE yielding mechanism (can send structured error events)
2. It can `return` early without crashing (clean short-circuit)
3. It can format user-friendly messages with context (e.g., "Ticker B ({ticker_b}): ...")

The strategy layer still raises `ValueError("df_b is required")` as a safety net — but the router check prevents that from ever being triggered through normal usage.

### The Error Message Pattern

Notice the `f"Ticker B ({ticker_b}): {exc}"` format — it prepends context ("Ticker B (INVALID):") to the underlying error message from `fetch_ohlcv`. This tells the user:
1. **Which** data fetch failed (ticker B, not the primary ticker)
2. **Why** it failed (the original ValueError message with delisted/insufficient hints)

```
"Ticker B (ENRN): No data returned for ticker 'ENRN' in range 2024-01-01 – 2024-12-31.
 The ticker may be invalid, delisted, or the date range may predate its listing."
```

---

## Section: Responsive Layout for Risk Settings

In Phase 11 we also tightened the responsive behaviour of the risk settings form. On desktop, five fields stacked vertically wastes space. On mobile, a 3-column grid is unusable. The fix is semantic grouping with responsive breakpoints:

```tsx
// risk-settings-form.tsx

{/* Row 1: Starting Capital + Position Sizing Mode → 2 columns on sm+ */}
<div className="grid gap-4 sm:grid-cols-2">
  <div className="space-y-2">
    <Label>Starting Capital ($)</Label>
    <Input type="number" ... />
  </div>
  <div className="space-y-2">
    <Label>Position Sizing</Label>
    <Select ... />
  </div>
</div>

{/* Row 2: Position Size + Stop Loss + Take Profit → 3 columns on sm+ */}
<div className="grid gap-4 sm:grid-cols-3">
  <div className="space-y-2"> ... Position Size ... </div>
  <div className="space-y-2"> ... Stop Loss ... </div>
  <div className="space-y-2"> ... Take Profit ... </div>
</div>
```

The grouping is semantic, not arbitrary — row 1 contains "how much money", row 2 contains "per-trade parameters". On mobile (`< 640px`), both rows collapse to single-column stacks.

---

## Section: Testing Edge Cases

### Testing the Rate Limiter

```python
class TestAlphaVantageRateLimiter:
    def test_limiter_allows_requests_within_limit(self):
        limiter = _AlphaVantageRateLimiter(max_per_day=5)
        for _ in range(5):
            assert limiter.acquire(timeout=1) is True

    def test_limiter_blocks_beyond_limit(self):
        limiter = _AlphaVantageRateLimiter(max_per_day=2)
        assert limiter.acquire(timeout=1) is True
        assert limiter.acquire(timeout=1) is True
        # Third should timeout
        assert limiter.acquire(timeout=1) is False

    def test_limiter_zero_max_blocks_immediately(self):
        limiter = _AlphaVantageRateLimiter(max_per_day=0)
        assert limiter.acquire(timeout=1) is False
```

Each test creates its own limiter instance with a small `max_per_day` — we'd never test against the default 25 because that would make the test slow. The `timeout=1` (one second) keeps tests fast while still exercising the retry loop.

### Testing `fetch_earnings` with `__wrapped__`

The `fetch_earnings` function is decorated with `@functools.lru_cache`. In tests, we need to bypass the cache to test the rate limiter integration:

```python
@patch("app.services.data_fetcher._av_limiter")
def test_fetch_earnings_skips_on_rate_limit(self, mock_limiter):
    mock_limiter.acquire.return_value = False
    result = fetch_earnings.__wrapped__("AAPL", api_key="test-key")
    assert result == []
    mock_limiter.acquire.assert_called_once()
```

`__wrapped__` is an attribute that `functools.lru_cache` stores — it's the original unwrapped function. Without it, repeated calls with the same arguments would return the cached result from a previous test, making the rate limiter mock irrelevant.

### Testing the "Note" Key Detection

```python
@patch("app.services.data_fetcher._av_limiter")
@patch("app.services.data_fetcher.httpx.Client")
def test_fetch_earnings_handles_rate_limit_note(self, mock_client_cls, mock_limiter):
    mock_limiter.acquire.return_value = True
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "Note": "Thank you for using Alpha Vantage! ..."
    }
    mock_resp.raise_for_status = MagicMock()

    # Wire up the context manager chain
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    result = fetch_earnings.__wrapped__("AAPL", api_key="test-key")
    assert result == []
```

This test is more complex because `httpx.Client` is used as a context manager (`with httpx.Client() as client:`). We need to mock the entire `__enter__` / `__exit__` chain so that `client.get()` returns our mock response with the `"Note"` key.

### Testing Pairs Trading SSE Errors

```python
@patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
def test_pairs_trading_rejects_same_ticker(self, mock_fetch, client):
    response = client.post(
        "/api/backtest/run",
        json={
            "strategy_type": "PAIRS_TRADING",
            "ticker": "SPY",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "parameters": {
                "ticker_b": "SPY",  # ← same as primary!
                "correlation_window": 60,
                "spread_threshold": 2.0,
            },
        },
    )
    events = _parse_sse(response.text)
    error_events = [e for e in events if e["type"] == "error"]
    assert len(error_events) >= 1
    assert "different" in error_events[0]["message"].lower()
```

SSE endpoints return `text/event-stream`, not JSON. The `_parse_sse()` helper splits the response by `\n\n`, extracts `data:` lines, and parses each as JSON. This returns a list of event dicts that we can filter and assert against — a reusable pattern for testing any SSE endpoint.

---

## Key Takeaway

> Defensive backend design means anticipating every way external data can fail — rate limits, missing data, invalid parameters — and converting each failure into a clear, actionable message *before* it reaches the strategy engine. The strategy layer should never see bad data; the router layer is the firewall.

---

**Next:** [Lesson 44 — ...](./44-placeholder.md)
