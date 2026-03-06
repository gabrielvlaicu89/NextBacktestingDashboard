"""Unit tests for the metrics calculator."""
import pandas as pd

from app.engine.base import Trade
from app.services.metrics import compute_metrics


def _build_test_data():
    """Create known trades and equity curve for metric verification."""
    trades = [
        Trade(
            entry_date="2024-01-02", exit_date="2024-01-10",
            entry_price=100, exit_price=110,
            pnl=1000, pnl_pct=10.0,
            holding_days=8, exit_reason="signal",
        ),
        Trade(
            entry_date="2024-01-15", exit_date="2024-01-22",
            entry_price=105, exit_price=100,
            pnl=-500, pnl_pct=-4.7619,
            holding_days=7, exit_reason="signal",
        ),
    ]

    dates = pd.bdate_range("2024-01-02", periods=30)

    # Equity: rises, dips, recovers
    values = [10000 + i * (1000 / 10) for i in range(10)]      # 10000 → 10900
    values += [11000 - i * (500 / 10) for i in range(10)]      # 11000 → 10550
    values += [10500 + i * (200 / 10) for i in range(10)]      # 10500 → 10680

    equity_curve = [
        {"date": str(d.date()), "value": round(v, 2)}
        for d, v in zip(dates, values)
    ]

    # Flat benchmark
    benchmark_df = pd.DataFrame(
        {"Close": [10000.0] * 30},
        index=dates,
    )

    return trades, equity_curve, benchmark_df


def test_total_return_positive():
    trades, equity_curve, benchmark_df = _build_test_data()
    result = compute_metrics(trades, equity_curve, benchmark_df, starting_capital=10000)

    # Final value ~10680 → positive return
    assert result.metrics.total_return_pct > 0


def test_win_rate():
    trades, equity_curve, benchmark_df = _build_test_data()
    result = compute_metrics(trades, equity_curve, benchmark_df, starting_capital=10000)

    # 1 winning trade out of 2 → 50%
    assert result.metrics.win_rate_pct == 50.0


def test_profit_factor():
    trades, equity_curve, benchmark_df = _build_test_data()
    result = compute_metrics(trades, equity_curve, benchmark_df, starting_capital=10000)

    # Gross profit 1000, gross loss 500 → factor = 2.0
    assert result.metrics.profit_factor == 2.0


def test_max_drawdown_negative():
    trades, equity_curve, benchmark_df = _build_test_data()
    result = compute_metrics(trades, equity_curve, benchmark_df, starting_capital=10000)

    # There is a drawdown in the equity curve → negative percentage
    assert result.metrics.max_drawdown_pct < 0


def test_sharpe_ratio_positive():
    trades, equity_curve, benchmark_df = _build_test_data()
    result = compute_metrics(trades, equity_curve, benchmark_df, starting_capital=10000)

    # Positive overall return → Sharpe should be positive
    assert result.metrics.sharpe_ratio > 0


def test_response_structure():
    trades, equity_curve, benchmark_df = _build_test_data()
    result = compute_metrics(trades, equity_curve, benchmark_df, starting_capital=10000)

    assert len(result.equity_curve) == 30
    assert len(result.drawdown_series) == 30
    assert len(result.trades) == 2
    # Check equity curve has benchmark values
    assert "benchmark_value" in result.equity_curve[0]
