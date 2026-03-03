# Lesson 06 — Strategy Engine Design Patterns

## The Problem: Multiple Strategies, One Runner

We need to support five different trading strategies. The naive approach would be:

```python
def run_backtest(strategy_type, ticker, ...):
    if strategy_type == "mean_reversion":
        # 200 lines of mean reversion code
    elif strategy_type == "ma_crossover":
        # 200 lines of MA crossover code
    elif strategy_type == "pairs_trading":
        # 200 lines of pairs trading code
    # ... etc.
```

This works initially but becomes unmanageable: one 1000-line function, impossible to test in isolation, risky to modify (a typo in the `if` block for strategy A can break strategy B), and hard to extend with new strategies.

We used two established design patterns instead.

## Pattern 1: Abstract Base Class (Template Method)

In `app/engine/base.py`:

```python
from abc import ABC, abstractmethod

class Strategy(ABC):
    def __init__(self, params: dict, risk: RiskSettings):
        self.params = params
        self.risk = risk

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        """Return a Series of -1 (sell), 0 (hold), 1 (buy)"""
        ...

    def execute_trades(self, df: pd.DataFrame, starting_capital: float) -> list[Trade]:
        """Base class handles ALL trade execution logic."""
        signals = self.generate_signals(df)    # ← calls subclass
        # apply stop-loss, take-profit, position sizing, capital tracking
        # returns list of Trade objects
        ...
```

`ABC` stands for Abstract Base Class. The `@abstractmethod` decorator marks `generate_signals` as a **contract** — any class that inherits from `Strategy` *must* implement this method. If it doesn't, Python raises a `TypeError` when you try to instantiate it.

This is the **Template Method** pattern: the base class defines the algorithm skeleton (`execute_trades` — process signals, apply risk rules, track capital) but defers one step (`generate_signals`) to subclasses.

Each strategy subclass only needs to answer one question: **"given this price data, when should I buy or sell?"**

```python
# app/engine/mean_reversion.py
class MeanReversionStrategy(Strategy):
    def generate_signals(self, df: pd.DataFrame) -> pd.Series:
        window = self.params.get("zscore_window", 20)
        threshold = self.params.get("zscore_threshold", 1.5)
        
        rolling_mean = df["close"].rolling(window).mean()
        rolling_std = df["close"].rolling(window).std()
        zscore = (df["close"] - rolling_mean) / rolling_std
        
        signals = pd.Series(0, index=df.index)
        signals[zscore < -threshold] = 1   # oversold → buy
        signals[zscore > threshold] = -1   # overbought → sell
        return signals
```

Everything else — tracking when a trade was opened, whether stop-loss triggered, computing profit — is handled once in `base.py` and shared by all strategies.

## Pattern 2: Factory Function

```python
# app/engine/base.py
def get_strategy(strategy_type: str, params: dict, risk: RiskSettings) -> Strategy:
    strategies = {
        "MEAN_REVERSION": MeanReversionStrategy,
        "MA_CROSSOVER": MACrossoverStrategy,
        "EARNINGS_DRIFT": EarningsDriftStrategy,
        "PAIRS_TRADING": PairsTradingStrategy,
        "BUY_AND_HOLD": BuyAndHoldStrategy,
    }
    cls = strategies.get(strategy_type)
    if not cls:
        raise ValueError(f"Unknown strategy: {strategy_type}")
    return cls(params, risk)
```

The **Factory** pattern hides the construction logic from the caller. The router doesn't need to know which class to instantiate:

```python
# app/routers/backtest.py
strategy = get_strategy(request.strategy_type, request.parameters, request.risk)
trades = strategy.execute_trades(df, request.starting_capital)
```

**Adding a new strategy** requires exactly three steps:
1. Create `app/engine/my_new_strategy.py` with a class that implements `generate_signals()`
2. Import it in `base.py`
3. Add one line to the `strategies` dict in `get_strategy()`

The router, the metrics service, the schemas — none of them need to change.

## The `Trade` Dataclass

```python
from dataclasses import dataclass
from datetime import date

@dataclass
class Trade:
    entry_date: date
    exit_date: date
    entry_price: float
    exit_price: float
    shares: float
    pnl: float
    pnl_pct: float
    exit_reason: str   # "signal", "stop_loss", "take_profit", "end_of_data"
```

`@dataclass` automatically generates `__init__`, `__repr__`, and `__eq__` from the field definitions, saving boilerplate. A `Trade` is a plain data object — no logic, just structure.

`exit_reason` is important for analysis: if your strategy's stop-loss fires on 80% of trades, the stop-loss threshold is too tight.

## Why Polymorphism Beats `if/elif`

The `execute_trades` method calls `self.generate_signals(df)`. At runtime, `self` is *whichever concrete subclass was instantiated by the factory*. Python resolves which `generate_signals` to call based on the actual type — this is **polymorphism**.

The result: `execute_trades` doesn't contain a single `if` statement about strategy type. It's written once, for all strategies, forever.

```
BacktestRunner
    calls execute_trades()
             ↓
    calls generate_signals()    ← Python dispatches to correct subclass
             ↑
MeanReversionStrategy.generate_signals()  OR
MACrossoverStrategy.generate_signals()    OR
PairsTradingStrategy.generate_signals()
```

## Unit Testing Benefits

Because each strategy is an isolated class with one method to test (`generate_signals`), unit testing is straightforward:

```python
def test_mean_reversion_buys_when_oversold():
    strategy = MeanReversionStrategy(
        params={"zscore_window": 20, "zscore_threshold": 1.5},
        risk=RiskSettings()
    )
    df = make_test_df_with_oversold_period()
    signals = strategy.generate_signals(df)
    assert (signals == 1).any()   # at least one buy signal generated
```

You test signal logic independently from trade execution logic. Bugs are easier to pinpoint.

## Key Takeaway

> The Abstract Base Class + Factory combination makes the codebase **open for extension, closed for modification** (the Open/Closed Principle). New strategies slot in without touching existing code. The Template Method pattern ensures all strategies obey the same execution rules — stop-losses, position sizing — with zero duplication.

---

**Next:** [Lesson 07 — Authentication Architecture](./07-authentication-architecture.md)
