"""Unit tests for the Buy & Hold strategy."""
from app.engine.buy_and_hold import BuyAndHoldStrategy
from app.models.schemas import RiskSettings
from tests.conftest import make_df


def test_signals_buy_first_sell_last():
    df = make_df([100, 110, 105, 120, 130])
    strategy = BuyAndHoldStrategy(params={}, risk=RiskSettings())
    result = strategy.generate_signals(df.copy())

    assert result.iloc[0]["signal"] == 1
    assert result.iloc[-1]["signal"] == -1
    assert all(result.iloc[1:-1]["signal"] == 0)


def test_single_trade_produced():
    df = make_df([100, 110, 105, 120, 130])
    strategy = BuyAndHoldStrategy(params={}, risk=RiskSettings(starting_capital=10_000))
    trades, equity = strategy.run(df, 10_000)

    assert len(trades) == 1
    assert trades[0].entry_price == 100.0
    assert trades[0].exit_price == 130.0
    assert trades[0].pnl > 0
    assert trades[0].exit_reason == "signal"


def test_equity_curve_matches_prices():
    df = make_df([100, 110, 105, 120, 130])
    strategy = BuyAndHoldStrategy(params={}, risk=RiskSettings(starting_capital=10_000))
    trades, equity = strategy.run(df, 10_000)

    assert len(equity) == 5
    assert equity[0]["value"] == 10_000.0
    assert equity[-1]["value"] == 13_000.0


def test_single_row_no_signals():
    """A single-row DataFrame should produce no signals."""
    df = make_df([100])
    strategy = BuyAndHoldStrategy(params={}, risk=RiskSettings())
    result = strategy.generate_signals(df.copy())

    assert all(result["signal"] == 0)
