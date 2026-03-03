"""Metrics computation — Sharpe, Sortino, drawdown, win rate, etc."""
from __future__ import annotations

import math
from datetime import datetime

import numpy as np
import pandas as pd

from app.engine.base import Trade
from app.models.schemas import BacktestResponse, PerformanceMetrics, TradeResult


def compute_metrics(
    trades: list[Trade],
    equity_curve: list[dict],
    benchmark_df: pd.DataFrame,
    starting_capital: float,
    risk_free_rate: float = 0.0,
) -> BacktestResponse:
    """Compute all performance metrics and return a full BacktestResponse."""

    eq_df = pd.DataFrame(equity_curve).set_index("date")
    eq_df.index = pd.to_datetime(eq_df.index)
    eq_df["value"] = eq_df["value"].astype(float)

    # ── Benchmark alignment ───────────────────────────────────────────────────
    bench = benchmark_df["Close"].reindex(eq_df.index, method="ffill")
    bench_normalized = bench / bench.iloc[0] * starting_capital

    equity_with_bench = [
        {
            "date": d.strftime("%Y-%m-%d"),
            "value": round(v, 2),
            "benchmark_value": round(float(bench_normalized.get(d, 0)), 2),
        }
        for d, v in eq_df["value"].items()
    ]

    # ── Return metrics ────────────────────────────────────────────────────────
    final_value = float(eq_df["value"].iloc[-1])
    total_return_pct = (final_value / starting_capital - 1) * 100

    n_days = (eq_df.index[-1] - eq_df.index[0]).days or 1
    n_years = n_days / 365.25
    annualized_return_pct = ((final_value / starting_capital) ** (1 / n_years) - 1) * 100 if n_years > 0 else 0.0

    # ── Drawdown ──────────────────────────────────────────────────────────────
    running_max = eq_df["value"].cummax()
    drawdown = (eq_df["value"] - running_max) / running_max * 100
    max_drawdown_pct = float(drawdown.min())

    drawdown_series = [
        {"date": d.strftime("%Y-%m-%d"), "drawdown_pct": round(float(v), 4)}
        for d, v in drawdown.items()
    ]

    # ── Sharpe & Sortino ──────────────────────────────────────────────────────
    daily_returns = eq_df["value"].pct_change().dropna()
    excess_returns = daily_returns - risk_free_rate / 252

    sharpe_ratio = (
        float(excess_returns.mean() / excess_returns.std() * math.sqrt(252))
        if excess_returns.std() > 0 else 0.0
    )

    downside = excess_returns[excess_returns < 0]
    sortino_ratio = (
        float(excess_returns.mean() / downside.std() * math.sqrt(252))
        if len(downside) > 0 and downside.std() > 0 else 0.0
    )

    # ── Win rate & Profit factor ──────────────────────────────────────────────
    if trades:
        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl <= 0]
        win_rate_pct = len(wins) / len(trades) * 100
        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")
    else:
        win_rate_pct = 0.0
        profit_factor = 0.0

    # ── Monthly returns ───────────────────────────────────────────────────────
    monthly = eq_df["value"].resample("ME").last()
    monthly_returns_raw = monthly.pct_change().dropna()
    monthly_returns = [
        {
            "year": d.year,
            "month": d.month,
            "return_pct": round(float(v) * 100, 4),
        }
        for d, v in monthly_returns_raw.items()
    ]

    # ── Compile ───────────────────────────────────────────────────────────────
    trade_results = [
        TradeResult(
            entry_date=t.entry_date,
            exit_date=t.exit_date,
            entry_price=t.entry_price,
            exit_price=t.exit_price,
            pnl=t.pnl,
            pnl_pct=t.pnl_pct,
            holding_days=t.holding_days,
            exit_reason=t.exit_reason,
        )
        for t in trades
    ]

    return BacktestResponse(
        metrics=PerformanceMetrics(
            total_return_pct=round(total_return_pct, 4),
            annualized_return_pct=round(annualized_return_pct, 4),
            max_drawdown_pct=round(max_drawdown_pct, 4),
            sharpe_ratio=round(sharpe_ratio, 4),
            sortino_ratio=round(sortino_ratio, 4),
            win_rate_pct=round(win_rate_pct, 4),
            profit_factor=round(profit_factor, 4),
        ),
        equity_curve=equity_with_bench,
        drawdown_series=drawdown_series,
        monthly_returns=monthly_returns,
        trades=trade_results,
    )
