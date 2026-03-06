# Lesson 16 — Strategy Data Injection: Keeping Strategies Stateless

Some trading strategies need more than just OHLCV price bars. The Earnings Drift strategy
needs a list of quarterly earnings announcements. Pairs Trading needs a second ticker's
price series. The challenge is: how do you get this extra data into a strategy without
breaking the clean, uniform `Strategy` interface every strategy must share? This lesson
explains the two injection patterns we used, why we chose them over the alternatives, and
what can go wrong when the boundaries are drawn in the wrong place.

---

## Section: The Problem with "Self-Sufficient" Strategies

A naive first design would make each strategy responsible for fetching its own data:

```python
# ❌ Anti-pattern: strategy fetches its own external data
class EarningsDriftStrategy(Strategy):
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        earnings = fetch_earnings(self.params["ticker"])   # network call inside strategy!
        ...
```

This looks convenient, but creates several serious problems:

| Problem | Consequence |
|---|---|
| Strategies become stateful & network-dependent | Unit tests require network access or complex mocking |
| The optimiser runs `generate_signals()` thousands of times | Each call would re-fetch earnings (caching only partially mitigates this) |
| The strategy must know the ticker, but the abstract base doesn't require it | Every strategy now has an implicit contract only some of them satisfy |
| Earnings fetch failures would surface as `ValueError` inside `generate_signals` | Callers have no chance to handle the failure before running the strategy |

The solution is **inversion of control**: the router fetches all external data once, before
constructing the strategy, and then hands it to the strategy in a well-defined way.

---

## Section: Pattern 1 — Params Injection (Earnings Drift)

For earnings data, the router injects the fetched list directly into the `parameters` dict
under a private key prefixed with `_`:

```
POST /api/backtest/run
         │
         ▼
   _stream_backtest()                        backtest.py (router)
         │
         ├─► fetch_ohlcv(ticker, ...)        ← always fetched
         │
         ├─► fetch_earnings(ticker)          ← fetched only for EARNINGS_DRIFT
         │        │
         │        ▼
         │   request.parameters["_earnings_data"] = earnings_data   ← injected here
         │
         ├─► get_strategy(strategy_type, parameters, risk)
         │         └─► EarningsDriftStrategy(params=parameters, risk=risk)
         │
         └─► strategy.run(df, capital)
```

Inside the router:

```python
# backend/app/routers/backtest.py

if request.strategy_type == StrategyType.EARNINGS_DRIFT:
    earnings_data = await asyncio.to_thread(fetch_earnings, request.ticker)
    request.parameters["_earnings_data"] = earnings_data   # inject before strategy is built
```

Inside the strategy, the data is read back as a normal dict lookup:

```python
# backend/app/engine/earnings_drift.py

def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
    earnings_data: list[dict] = self.params.get("_earnings_data", [])
    # ↑ returns [] if not injected — graceful no-op
```

**Why a `_` prefix?**  
The user-supplied parameters are serialised from JSON via a Pydantic model. Any parameter
the user sends arrives here too. The `_` prefix is a convention that signals "this key was
injected internally and is not a user-facing configuration option." It also avoids name
collisions with legitimate parameter names like `days_before` or `eps_surprise_threshold`.

**Trade-off: Why not a constructor argument?**  
We could have defined `EarningsDriftStrategy.__init__(self, params, risk, earnings_data)`.
The problem: the factory function `get_strategy()` in `engine/base.py` constructs all
strategies with the same two arguments `(params, risk)`. Adding a third argument only for
one strategy breaks the factory and forces an awkward special-case branch just to instantiate
the class. Injecting through `params` keeps the factory uniform.

---

## Section: Pattern 2 — Setter Injection (Pairs Trading)

For Pairs Trading, the second ticker's DataFrame cannot be serialised into a JSON-compatible
dict, so params injection isn't viable. Instead, `PairsTradingStrategy` exposes an explicit
setter method:

```python
# backend/app/engine/pairs_trading.py

class PairsTradingStrategy(Strategy):
    def __init__(self, params, risk):
        super().__init__(params, risk)
        self._df_b: pd.DataFrame | None = None   # ① starts as None — guard against forgetting

    def set_df_b(self, df_b: pd.DataFrame) -> None:
        """Inject ticker B's OHLCV DataFrame before running the strategy."""
        self._df_b = df_b

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        if self._df_b is None:
            raise ValueError(                     # ② fails loudly if caller forgot to inject
                "Ticker B DataFrame not set. Call set_df_b() before running."
            )
        ...
```

The router calls `set_df_b()` after constructing the strategy and before running it:

```python
# backend/app/routers/backtest.py

strategy = get_strategy(request.strategy_type, request.parameters, request.risk_settings)

if request.strategy_type == StrategyType.PAIRS_TRADING:
    ticker_b = request.parameters.get("ticker_b")
    df_b = await asyncio.to_thread(fetch_ohlcv, ticker_b, request.date_from, request.date_to)
    if isinstance(strategy, PairsTradingStrategy):
        strategy.set_df_b(df_b)              # ③ inject the DataFrame directly

trades, equity_curve = await asyncio.to_thread(strategy.run, df, capital)
```

**① `None` initial state** — The attribute starts as `None`, making it obvious in a debugger
that injection has not happened yet.

**② Loud failure in `generate_signals`** — If a future developer calls `strategy.run(df)`
without first calling `set_df_b()`, the error message tells them exactly what they forgot.
Silent failures (e.g., producing zero signals because `_df_b is None`) are far harder to
debug.

**③ `isinstance` guard** — Even though the `if StrategyType.PAIRS_TRADING` block already
ensures we're in the right branch, the `isinstance` check satisfies the type checker
(mypy/Pylance). Without it, calling `strategy.set_df_b(df_b)` on a base `Strategy` reference
would be a type error, because `Strategy` doesn't define `set_df_b`.

---

## Section: The Optimiser Uses the Same Pattern

The grid search optimiser (`services/optimizer.py`) runs the same backtest hundreds of times.
If it fetched earnings or ticker B data inside the optimisation loop, the API would be
hammered once per parameter combination. Instead, it mirrors the router's pre-fetching
pattern — fetch once, inject many:

```
run_grid_search()
      │
      ├─► fetch_ohlcv(ticker, ...)
      │
      ├─► if EARNINGS_DRIFT:  fetch_earnings(ticker) → store in fixed_parameters["_earnings_data"]
      │
      ├─► if PAIRS_TRADING:   fetch_ohlcv(ticker_b, ...) → store df_b
      │
      └─► for each param_combination:
              strategy = get_strategy(type, {**fixed_parameters, **combo}, risk)
              if PAIRS_TRADING: strategy.set_df_b(df_b)
              strategy.run(df, capital)
```

This structure means one network round-trip serves the entire grid search, regardless of how
many combinations are tested.

---

## Section: The Signal Logic Correction in Pairs Trading

The original scaffold had a bug in the exit condition. It used a symmetric condition for
both the long and the short side, which was incoherent because the strategy is long-only:

```python
# ❌ Original (broken) — could emit -1 whether or not we're in a trade
for i in range(len(df)):
    z = zscore.iloc[i]
    if z < -threshold:
        df.iloc[i]["signal"] = 1
    elif z > threshold:
        df.iloc[i]["signal"] = -1   # fires even when there's no open position!
```

The fix introduces explicit state tracking:

```python
# ✅ Fixed — stateful loop, long-only
in_trade = False
for i in range(len(df)):
    z = zscore.iloc[i]
    if pd.isna(z):
        continue
    if not in_trade:
        if z < -threshold:
            df.iloc[i, df.columns.get_loc("signal")] = 1    # enter long
            in_trade = True
    else:
        if z > -0.5:
            df.iloc[i, df.columns.get_loc("signal")] = -1   # exit when mean-reverted
            in_trade = False
```

The exit threshold of `-0.5` (rather than `0`) is deliberate: in a noisy spread, waiting for
the Z-score to revert all the way to zero wastes time. Exiting when the spread is merely
"close to normal" (-0.5 standard deviations) captures most of the reversion profit without
overstaying.

---

## Key Takeaway

> Never let a strategy fetch its own data. The router layer (or optimiser) owns all I/O: it fetches everything before a strategy is constructed, then injects it via the params dict (for serialisable data) or a setter method (for DataFrames). This keeps strategies as pure, deterministic signal generators that can be tested in isolation with no network access.

---

**Next:** [Lesson 17 — The MA Crossover Test Bug: Why Monotonic Data Breaks Crossover Tests](./17-ma-crossover-test-bug.md)
