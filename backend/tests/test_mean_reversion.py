"""Unit tests for the Mean Reversion strategy."""

import numpy as np

from app.engine.mean_reversion import MeanReversionStrategy
from app.models.schemas import RiskSettings
from tests.conftest import make_df


def test_buy_signal_at_dip():
    """Price stable at ~100, sharp drop to 80 should trigger a buy."""
    np.random.seed(42)
    stable = list(np.random.normal(100, 1, 30))
    dip = [80, 78, 80, 85, 90, 95, 100, 105, 110, 115]
    df = make_df(stable + dip)

    strategy = MeanReversionStrategy(
        params={"zscore_window": 20, "zscore_threshold": 2.0, "holding_period": 10},
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())
    buy_signals = result[result["signal"] == 1]

    assert len(buy_signals) >= 1, "Expected at least one buy signal at the dip"
    first_buy_loc = df.index.get_loc(buy_signals.index[0])
    assert 28 <= first_buy_loc <= 33


def test_sell_after_holding_period():
    """If Z-score doesn't cross +threshold, sell after holding_period."""
    np.random.seed(42)
    stable = list(np.random.normal(100, 1, 30))
    # Dip that stays low for a while
    dip = [80] + [82] * 15
    df = make_df(stable + dip)

    strategy = MeanReversionStrategy(
        params={"zscore_window": 20, "zscore_threshold": 2.0, "holding_period": 5},
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())
    buy_indices = result.index[result["signal"] == 1]
    sell_indices = result.index[result["signal"] == -1]

    if len(buy_indices) > 0 and len(sell_indices) > 0:
        buy_loc = df.index.get_loc(buy_indices[0])
        sell_loc = df.index.get_loc(sell_indices[0])
        assert sell_loc - buy_loc <= 5  # sold within holding period


def test_trade_execution():
    """Full run should produce at least one trade."""
    np.random.seed(42)
    stable = list(np.random.normal(100, 1, 30))
    dip = [80, 78, 80, 85, 90, 95, 100, 105, 110, 115]
    df = make_df(stable + dip)

    strategy = MeanReversionStrategy(
        params={"zscore_window": 20, "zscore_threshold": 2.0, "holding_period": 10},
        risk=RiskSettings(starting_capital=10_000),
    )
    trades, equity = strategy.run(df, 10_000)

    assert len(trades) >= 1
    assert len(equity) == len(df)
    t = trades[0]
    assert t.entry_date
    assert t.exit_date
    assert t.holding_days >= 1
