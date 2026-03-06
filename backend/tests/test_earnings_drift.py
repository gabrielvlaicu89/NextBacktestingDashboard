"""Unit tests for the Earnings Drift (PEAD) strategy."""
from app.engine.earnings_drift import EarningsDriftStrategy
from app.models.schemas import RiskSettings
from tests.conftest import make_df


def test_signals_around_earnings_date():
    """Buy before and sell after an earnings date."""
    prices = [100 + i * 0.5 for i in range(60)]
    df = make_df(prices)

    earnings_data = [
        {
            "date": str(df.index[30].date()),
            "reported_eps": 2.0,
            "estimated_eps": 1.5,
            "surprise_pct": 33.3,
        },
    ]

    strategy = EarningsDriftStrategy(
        params={
            "_earnings_data": earnings_data,
            "days_before": 2,
            "days_after": 5,
            "eps_surprise_threshold": 10.0,
        },
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())

    assert result.iloc[28]["signal"] == 1   # buy 2 days before earnings
    assert result.iloc[35]["signal"] == -1  # sell 5 days after earnings


def test_surprise_threshold_filters():
    """Earnings below the surprise threshold should not generate signals."""
    prices = [100 + i * 0.5 for i in range(60)]
    df = make_df(prices)

    earnings_data = [
        {
            "date": str(df.index[30].date()),
            "reported_eps": 1.6,
            "estimated_eps": 1.5,
            "surprise_pct": 5.0,  # below threshold
        },
    ]

    strategy = EarningsDriftStrategy(
        params={
            "_earnings_data": earnings_data,
            "days_before": 2,
            "days_after": 5,
            "eps_surprise_threshold": 10.0,
        },
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())

    assert all(result["signal"] == 0), "No signals when surprise < threshold"


def test_no_earnings_data():
    """Empty earnings data should produce no signals."""
    df = make_df([100 + i for i in range(30)])

    strategy = EarningsDriftStrategy(
        params={"_earnings_data": [], "days_before": 2, "days_after": 5},
        risk=RiskSettings(),
    )
    result = strategy.generate_signals(df.copy())

    assert all(result["signal"] == 0)


def test_trade_execution():
    """Full run with earnings data should produce trades."""
    prices = [100 + i * 0.5 for i in range(60)]
    df = make_df(prices)

    earnings_data = [
        {
            "date": str(df.index[30].date()),
            "reported_eps": 2.0,
            "estimated_eps": 1.0,
            "surprise_pct": 100.0,
        },
    ]

    strategy = EarningsDriftStrategy(
        params={
            "_earnings_data": earnings_data,
            "days_before": 2,
            "days_after": 5,
            "eps_surprise_threshold": 0.0,
        },
        risk=RiskSettings(starting_capital=10_000),
    )
    trades, equity = strategy.run(df, 10_000)

    assert len(trades) >= 1
    assert trades[0].pnl > 0  # uptrend — buying before should profit
