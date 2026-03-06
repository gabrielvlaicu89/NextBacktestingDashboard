"""Unit tests for the Pairs Trading strategy."""
import numpy as np
import pytest

from app.engine.pairs_trading import PairsTradingStrategy
from app.models.schemas import RiskSettings
from tests.conftest import make_df


def _make_pair(n: int = 120, seed: int = 42):
    """Create two correlated price series where the spread dips then reverts."""
    np.random.seed(seed)
    base = 100 + np.cumsum(np.random.normal(0.05, 0.5, n))

    noise_a = np.random.normal(0, 0.3, n)
    spread_shock = np.zeros(n)
    spread_shock[70:85] = -5  # A becomes cheap relative to B
    spread_shock[85:100] = np.linspace(-5, 0, 15)  # spread reverts

    prices_a = list(base + noise_a + spread_shock)
    prices_b = list(base + np.random.normal(0, 0.3, n))

    return prices_a, prices_b


def test_generates_buy_on_spread_dip():
    """Should buy A when spread Z-score drops below -threshold."""
    prices_a, prices_b = _make_pair()
    df_a = make_df(prices_a)
    df_b = make_df(prices_b)

    strategy = PairsTradingStrategy(
        params={"spread_threshold": 1.5, "correlation_window": 30},
        risk=RiskSettings(),
    )
    strategy.set_df_b(df_b)
    result = strategy.generate_signals(df_a.copy())

    buy_signals = result[result["signal"] == 1]
    assert len(buy_signals) >= 1, "Expected a buy signal when spread dips"


def test_exits_on_reversion():
    """Should sell A when spread reverts toward mean."""
    prices_a, prices_b = _make_pair()
    df_a = make_df(prices_a)
    df_b = make_df(prices_b)

    strategy = PairsTradingStrategy(
        params={"spread_threshold": 1.5, "correlation_window": 30},
        risk=RiskSettings(),
    )
    strategy.set_df_b(df_b)
    result = strategy.generate_signals(df_a.copy())

    sell_signals = result[result["signal"] == -1]
    assert len(sell_signals) >= 1, "Expected a sell signal on reversion"


def test_raises_without_df_b():
    """Should raise ValueError if set_df_b() was not called."""
    df = make_df([100] * 10)
    strategy = PairsTradingStrategy(
        params={"spread_threshold": 2.0, "correlation_window": 60},
        risk=RiskSettings(),
    )
    with pytest.raises(ValueError, match="Ticker B DataFrame not set"):
        strategy.generate_signals(df.copy())


def test_trade_execution():
    """Full run produces trades with valid fields."""
    prices_a, prices_b = _make_pair()
    df_a = make_df(prices_a)
    df_b = make_df(prices_b)

    strategy = PairsTradingStrategy(
        params={"spread_threshold": 1.5, "correlation_window": 30},
        risk=RiskSettings(starting_capital=10_000),
    )
    strategy.set_df_b(df_b)
    trades, equity = strategy.run(df_a, 10_000)

    assert len(equity) == len(df_a)
    if trades:
        assert trades[0].entry_price > 0
