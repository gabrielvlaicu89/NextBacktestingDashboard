# Lesson 18 — Testing FastAPI: TestClient, Mocking External Calls, and SSE Parsing

Unit tests verify individual functions in isolation. Integration tests verify that the entire
HTTP layer — request parsing, routing, business logic, response serialisation — works together.
For a FastAPI backend with Server-Sent Events (SSE) and external data fetching, integration
testing brings three non-obvious challenges: running the app without a real server, replacing
network calls with synthetic data, and parsing a streaming response format that isn't JSON.
This lesson explains how we solved each one.

---

## Section: The Testing Stack

```
test file
    │
    ├─► pytest          — test runner, fixture system, assertion rewriting
    ├─► pytest-asyncio  — async test support (asyncio_mode = auto in pytest.ini)
    └─► FastAPI TestClient (wraps httpx.Client internally)
            │
            └─► mounts the FastAPI app in-process
                (no real HTTP server, no network port, no subprocess)
```

Key config in `backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
asyncio_mode = auto
```

`asyncio_mode = auto` tells `pytest-asyncio` to treat every `async def test_*` function as
a coroutine test automatically — you don't need to decorate each one with `@pytest.mark.asyncio`.

---

## Section: The TestClient — Running FastAPI In-Process

FastAPI's `TestClient` (borrowed from Starlette) uses `httpx` to make HTTP requests directly
to the ASGI application object in memory, without binding to a network port:

```python
# backend/tests/test_integration.py

from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)
```

The `TestClient` behaves exactly like a real HTTP client from the test's perspective:

```python
response = client.post(
    "/api/backtest/run",
    json={
        "strategy_type": "MEAN_REVERSION",
        "ticker": "SPY",
        "date_from": "2024-01-01",
        "date_to": "2024-12-31",
        "parameters": {"zscore_window": 20, "zscore_threshold": 2.0, "holding_period": 10},
    },
)
assert response.status_code == 200
```

No server process is started. The `json=` argument is serialised to bytes, passed directly to
the ASGI callable, and the response bytes are returned immediately. This makes integration
tests fast: the entire test suite runs in ~1.3 seconds.

```
TestClient.post(...)
     │
     ▼
httpx internal transport
     │
     ▼
ASGI transport (in-process)
     │
     ▼
FastAPI app — same code as production
     │
     ▼
response bytes returned to httpx
     │
     ▼
TestClient.post() returns Response object
```

---

## Section: Mocking External Calls — Where and Why

The integration test must not call Yahoo Finance. A real network call would make tests:
- **Slow** — 2–5 seconds per request
- **Flaky** — network failures or API rate limits cause random test failures
- **Non-deterministic** — real price data changes daily, breaking assertions about specific results

We use `unittest.mock.patch` to replace `fetch_ohlcv` with a function that returns synthetic
data:

```python
def _mock_ohlcv(*args, **kwargs) -> pd.DataFrame:
    """Return a synthetic OHLCV DataFrame with a mean-reversion-friendly pattern."""
    np.random.seed(99)                              # ① deterministic random data
    stable   = list(np.random.normal(100, 1, 30))  # 30 bars near 100
    dip      = [80, 78, 80, 85, 90, 95, 100, 105, 108, 110]  # visible dip
    recovery = list(np.random.normal(105, 1, 20))  # 20 bars after recovery
    return make_df(stable + dip + recovery)

@patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
def test_mean_reversion_backtest(mock_fetch, client):
    response = client.post("/api/backtest/run", json={...})
    ...
```

**① `np.random.seed(99)`** — Without a fixed seed, `np.random.normal(100, 1, 30)` produces
different values every time the test runs. A fixed seed makes the data (and therefore the
trade results) deterministic across runs, environments, and Python versions.

### The Critical Detail: Where to Patch

The `@patch` target is `"app.routers.backtest.fetch_ohlcv"`, not
`"app.services.data_fetcher.fetch_ohlcv"`.

This is one of the most commonly misunderstood rules in Python mocking:

> **Patch the name as it is used, not where it is defined.**

```python
# In app/services/data_fetcher.py:
def fetch_ohlcv(...): ...     # defined here

# In app/routers/backtest.py:
from app.services.data_fetcher import fetch_ohlcv   # imported here — creates a new name
...
df = await asyncio.to_thread(fetch_ohlcv, ...)       # used here, via the local name
```

When the router does `from app.services.data_fetcher import fetch_ohlcv`, Python binds the
name `fetch_ohlcv` in the `app.routers.backtest` module's namespace. Patching
`app.services.data_fetcher.fetch_ohlcv` replaces the original, but the router's local
binding still points to the original function — the patch has no effect.

```
✅ @patch("app.routers.backtest.fetch_ohlcv")
   → replaces the name the router actually calls

❌ @patch("app.services.data_fetcher.fetch_ohlcv")
   → replaces the original but the router already has its own reference — no effect
```

---

## Section: Parsing SSE Responses

The backtest endpoint returns `Content-Type: text/event-stream`. SSE is a newline-delimited
text protocol, not JSON:

```
data: {"type": "progress", "percent": 10, "message": "Fetching market data…"}\n
\n
data: {"type": "progress", "percent": 30, "message": "Running strategy…"}\n
\n
data: {"type": "complete", "results": {...}}\n
\n
```

Each event is a block of lines ending with a blank line. Each data line starts with `data: `.

The test suite includes a helper to parse this:

```python
def _parse_sse(text: str) -> list[dict]:
    events = []
    for block in text.split("\n\n"):       # ① split on blank lines between events
        block = block.strip()
        if block.startswith("data: "):
            data_str = block.replace("data: ", "", 1)   # ② strip the prefix, once
            try:
                events.append(json.loads(data_str))     # ③ parse the JSON payload
            except json.JSONDecodeError:
                continue
    return events
```

**① `split("\n\n")`** — Each SSE event is separated from the next by a blank line.
Splitting on `"\n\n"` gives one block per event. Multi-line events (where a single message
spans multiple `data:` lines) would need a more sophisticated parser, but our events are
always single-line, so this is sufficient.

**② `replace("data: ", "", 1)`** — The `1` argument means replace only the *first* occurrence.
If the JSON payload itself happened to contain the string `"data: "`, a global replace would
corrupt it. The `1` makes the operation safe.

**③ Graceful `continue` on parse error** — Comment or retry lines (which SSE allows by
convention) are skipped rather than crashing the parser.

The integration test then makes structured assertions against the parsed events:

```python
events = _parse_sse(response.text)
types = [e["type"] for e in events]

assert "progress" in types         # at least one progress event
assert "complete" in types         # terminal event exists

complete = next(e for e in events if e["type"] == "complete")
results  = complete["results"]

assert "metrics"      in results   # top-level shape check
assert "equity_curve" in results
assert "trades"       in results
```

---

## Section: The Shared `make_df` Fixture

Rather than repeating DataFrame construction in every test file, a central helper lives in
`tests/conftest.py`. pytest automatically discovers and imports `conftest.py` files — any
function defined there is available to all tests without explicit import:

```python
# backend/tests/conftest.py

import pandas as pd

def make_df(prices: list[float], start_date: str = "2024-01-02") -> pd.DataFrame:
    dates = pd.bdate_range(start_date, periods=len(prices))  # ① business days only
    return pd.DataFrame(
        {
            "Open":   prices,
            "High":   [p * 1.01 for p in prices],
            "Low":    [p * 0.99 for p in prices],
            "Close":  prices,
            "Volume": [1_000_000] * len(prices),
        },
        index=dates,
    )
```

**① `pd.bdate_range`** — Business date range. Real price data only has rows for trading
days (Mon–Fri, excluding public holidays). Using `bdate_range` ensures the synthetic
DataFrame matches the structure of real yfinance output: no Saturday/Sunday rows, no
gaps that would confuse date-based signal logic.

In unit tests, `make_df` is imported explicitly:

```python
from tests.conftest import make_df
```

In integration tests, it could also be used as a pytest fixture by defining it with `yield`
or `return` and registering it via `@pytest.fixture`, but explicit import is simpler here.

---

## Section: Test Results Summary

After all fixes, the full test suite produced:

```
29 passed in 1.27s
```

| File | Tests | Coverage area |
|---|---|---|
| `test_buy_and_hold.py` | 4 | Signal generation, single trade, equity curve shape |
| `test_mean_reversion.py` | 3 | Z-score dip detection, holding period exit, trade execution |
| `test_ma_crossover.py` | 4 | Golden cross, death cross, EMA variant, trade execution |
| `test_earnings_drift.py` | 4 | Signal placement, surprise filtering, empty earnings, trade execution |
| `test_pairs_trading.py` | 4 | Spread dip entry, mean-reversion exit, missing df_b error, trade execution |
| `test_metrics.py` | 6 | Total return, win rate, profit factor, max drawdown, Sharpe, response structure |
| `test_integration.py` | 4 | Full HTTP round-trip for MEAN_REVERSION, BUY_AND_HOLD, health check, error handling |

---

## Key Takeaway

> Patch the name as it is *used*, not where it is *defined*. When a module does `from x import f`, it creates its own local binding to `f`. Patching the original `x.f` leaves the local binding unchanged. Always patch `<module_that_uses_it>.f` to guarantee the mock actually intercepts the call.

---

**Next:** [Lesson 19 — Phase 4: Next.js API Layer & Data Flow](./19-nextjs-api-layer.md)
