# Lesson 17 — The MA Crossover Test Bug: Why Monotonic Data Can't Test a Crossover

Three tests were written for the MA Crossover strategy and all three failed immediately on
the first test run. The strategy code was not wrong. The tests were not wrong in their
*assertions*. The failure was entirely in the *test data*: a fundamental mismatch between
what a crossover strategy does, and what the synthetic prices actually represented. This
lesson dissects that bug in detail, because the mental model it reveals applies to every
indicator-based test you will ever write.

---

## Section: What a Crossover Actually Is

A Moving Average (MA) crossover strategy generates a signal at the *moment* one moving
average transitions from below the other to above it — or vice versa. The signal is the
**event of crossing**, not the current state of one MA relative to the other.

```
Price              Fast MA (SMA 5)      Slow MA (SMA 20)    Signal
──────────────────────────────────────────────────────────────────
↑ rising           above slow MA        (just computed)      ← NO signal here
↑ still rising     still above slow MA                       ← NO signal here
...
↑ still rising     still above slow MA                       ← NO signal here
```

On a chart, this looks like:

```
Price
 │                         /─── fast MA
 │               /────────/
 │          ────/──────────────── slow MA
 │
 └──────────────────────────────►  time
              ↑
         Golden Cross — fast crosses ABOVE slow
         → BUY signal fires here, once, at the transition
```

The strategy code implements this exactly:

```python
# backend/app/engine/ma_crossover.py

prev_above = fast_ma.iloc[slow] > slow_ma.iloc[slow]  # ← state at loop start

for i in range(slow + 1, len(df)):
    curr_above = fast_ma.iloc[i] > slow_ma.iloc[i]

    if curr_above and not prev_above:    # was below, now above → golden cross
        df.iloc[i, ...] = 1             # BUY
    elif not curr_above and prev_above:  # was above, now below → death cross
        df.iloc[i, ...] = -1            # SELL

    prev_above = curr_above
```

The buy signal fires only when `curr_above = True` AND `prev_above = False` — meaning the
relationship *changed* between this bar and the last. There is no crossover if the fast MA
is *already* above the slow MA when the loop begins.

---

## Section: The Symptoms

The tests failed with a clear, terse assertion error:

```
FAILED tests/test_ma_crossover.py::test_golden_cross_buy
  assert 0 >= 1
  
FAILED tests/test_ma_crossover.py::test_ema_variant
  assert 0 >= 1

FAILED tests/test_ma_crossover.py::test_trade_execution
  assert 0 >= 1
```

`0 >= 1` means: we expected at least 1 buy signal, but found 0.

---

## Section: The Root Cause

The original test data was:

```python
prices = list(range(50, 120))   # [50, 51, 52, …, 119]
```

A perfectly steady, monotonic uptrend. Let's trace what happens to the moving averages:

```
Bar  Price   SMA(5)    SMA(20)   fast > slow?
──────────────────────────────────────────────
20   70      62.0      60.5      YES  ← prev_above = True at loop start
21   71      63.0      61.5      YES  ← curr_above = True, prev_above = True → no signal
22   72      64.0      62.5      YES  ← same
...  ...     ...       ...       YES  ← always YES, never crosses
```

On a monotonic uptrend, the 5-bar average is always higher than the 20-bar average, from
the very first bar where both are defined. `prev_above` is initialised to `True` at bar 20,
and it stays `True` forever. The condition `curr_above and not prev_above` is **never true**,
so no buy signal is ever emitted.

The strategy is correct. The test data is unsuitable.

---

## Section: The Fix — Designing Data That Exercises the Invariant You're Testing

A crossover test needs data that spends time in *both* states: fast below slow, then fast
above slow (and optionally back below). The transition between states is where the signal
fires.

```python
# backend/tests/test_ma_crossover.py

def _downup_prices() -> list[float]:
    down  = list(range(100, 60, -1))   # 40 bars, 100 → 61  (fast drops below slow)
    up    = list(range(61, 120))       # 58 bars, 61 → 119  (fast crosses back above slow)
    down2 = list(range(119, 70, -1))   # 49 bars, 119 → 71  (fast drops below slow again)
    return down + up + down2
```

Let's trace the moving averages through the down→up transition:

```
Phase    Price        SMA(5)        SMA(20)       fast < slow?
──────────────────────────────────────────────────────────────
Decline  100→61       95→66         90→75         slowly YES — fast lags slow
Bottom   61–65        67→63         75→70         YES — fast well below slow
Start ↑  65–85        66→75         70→72         Transition: fast climbing fast
                                                   ↓
Golden   ~bar 75      fast = slow   same          CROSS → signal = 1 (BUY)
                                                   ↓
Rising   85→119       fast > slow   fast > slow   YES — fast above slow
```

The decline ensures `prev_above = False` when the loop starts. The recovery then causes the
fast MA to climb through the slow MA — a genuine transition — and the buy signal fires.
The second decline creates another transition in the other direction, triggering the sell.

### Before and After

```python
# ❌ Before — monotonic uptrend, no crossover possible
prices = list(range(50, 120))         # always fast > slow

# ✅ After — down→up→down, guaranteed crossover in both directions
def _downup_prices():
    down  = list(range(100, 60, -1))
    up    = list(range(61, 120))
    down2 = list(range(119, 70, -1))
    return down + up + down2
```

The tests themselves didn't change at all — only the data they operate on.

---

## Section: The General Lesson — Testing Indicators Requires Thinking in State

The bug happened because the test was written as:
> "here's some price data, assert the strategy does something."

The correct mental model is:
> "what *state* must the indicator be in before my event can fire, and does my price data actually create that state?"

Every indicator has a concept of **current state** and **transition conditions**:

| Indicator | State | Transition you're testing |
|---|---|---|
| MA Crossover | fast above/below slow | fast crosses through slow |
| Mean Reversion (Z-score) | in-zone / out-of-zone | Z-score crosses threshold |
| RSI | overbought / oversold | RSI crosses 30 or 70 |
| Pairs Trading spread | spread wide / narrow | Z-score crosses entry threshold |

For each, you must ensure your test data starts in the **wrong** state for the signal you're
testing, spends enough bars there for the indicator to stabilise, and then transitions to the
**right** state.

### The "enough bars to stabilise" requirement

With `slow_period = 20`, the slow SMA requires 20 bars to produce its first value. The
decline phase (`range(100, 60, -1)` — 40 bars) is intentionally longer than `slow_period`.
This ensures both moving averages are fully computed and in the "fast below slow" state
before the uptrend begins. If the decline were only 5 bars, the SMA(20) would still be
computing from the *pre-decline* starting prices and the test data structure wouldn't
guarantee the desired initial state.

---

## Key Takeaway

> When testing a crossover or threshold-crossing indicator, your synthetic data must start in the opposite state from the one you're testing. A monotonic trend guarantees the indicator is already in the "crossed" state before the strategy even starts — no transition will ever fire. Design your test prices by reasoning about the *indicator's state machine*, not just the *direction of prices*.

---

**Next:** [Lesson 18 — Testing FastAPI with pytest: TestClient, Mocking, and SSE](./18-testing-fastapi.md)
