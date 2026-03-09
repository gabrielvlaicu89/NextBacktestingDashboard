"""Unit tests for the MA Crossover strategy."""

from app.engine.ma_crossover import MACrossoverStrategy
from app.models.schemas import RiskSettings
from tests.conftest import make_df


def _downup_prices() -> list[float]:
    """
    Prices that decline then recover.

    This guarantees a golden cross followed by a death cross.
    Decline: fast MA drops below slow MA
    Recovery: fast MA crosses back above slow MA → golden cross (buy)
    Second decline: fast MA drops below slow MA again → death cross (sell)
    """
    down = list(range(100, 60, -1))  # 100 → 61 (40 bars)
    up = list(range(61, 120))  # 61 → 119 (58 bars)
    down2 = list(range(119, 70, -1))  # 119 → 71 (49 bars)
    return down + up + down2


def test_golden_cross_buy():
    """A downtrend followed by uptrend should produce a golden cross (buy signal)."""
    df = make_df(_downup_prices())

    strategy = MACrossoverStrategy(
        params={"fast_period": 5, "slow_period": 20, "ma_type": "SMA"},
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())
    buy_signals = result[result["signal"] == 1]

    assert (
        len(buy_signals) >= 1
    ), "Expected a golden cross buy signal in the uptrend phase"


def test_death_cross_sell():
    """Uptrend followed by downtrend should produce a death cross (sell signal)."""
    df = make_df(_downup_prices())

    strategy = MACrossoverStrategy(
        params={"fast_period": 5, "slow_period": 20, "ma_type": "SMA"},
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())
    sell_signals = result[result["signal"] == -1]

    assert (
        len(sell_signals) >= 1
    ), "Expected a death cross sell signal in the downtrend phase"


def test_ema_variant():
    """EMA variant should also produce buy and sell signals."""
    df = make_df(_downup_prices())

    strategy = MACrossoverStrategy(
        params={"fast_period": 5, "slow_period": 20, "ma_type": "EMA"},
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())
    buy_signals = result[result["signal"] == 1]
    sell_signals = result[result["signal"] == -1]

    assert len(buy_signals) >= 1
    assert len(sell_signals) >= 1


def test_trade_execution():
    """Full run should produce trades with valid fields."""
    df = make_df(_downup_prices())

    strategy = MACrossoverStrategy(
        params={"fast_period": 5, "slow_period": 20, "ma_type": "SMA"},
        risk=RiskSettings(starting_capital=10_000),
    )
    trades, equity = strategy.run(df, 10_000)

    assert len(trades) >= 1
    assert len(equity) == len(df)
    for t in trades:
        assert t.entry_price > 0
        assert t.holding_days >= 0
