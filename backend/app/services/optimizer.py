"""Grid search optimizer — runs all param combinations and streams progress via SSE."""

from __future__ import annotations

import asyncio
import itertools
import json
from typing import AsyncGenerator

import numpy as np

from app.engine.base import get_strategy
from app.engine.pairs_trading import PairsTradingStrategy
from app.models.schemas import OptimizeRequest, StrategyType
from app.services.data_fetcher import fetch_ohlcv, fetch_earnings
from app.services.metrics import compute_metrics


async def run_grid_search(request: OptimizeRequest) -> AsyncGenerator[str, None]:
    """
    Iterate over all parameter combinations defined in request.param_ranges.
    Yield SSE-formatted progress events and stream partial results.
    """
    # Build param grid
    param_keys = list(request.param_ranges.keys())
    ranges = []
    for key in param_keys:
        pr = request.param_ranges[key]
        values = list(np.arange(pr.min, pr.max + pr.step / 2, pr.step))
        ranges.append(values)

    combinations = list(itertools.product(*ranges))
    total = len(combinations)

    if total == 0:
        yield _sse(
            "error", message="No parameter combinations generated. Check your ranges."
        )
        return

    yield _sse(
        "progress", percent=0, message=f"Starting grid search — {total} combinations…"
    )
    await asyncio.sleep(0)

    # Pre-fetch data once
    try:
        df = await asyncio.to_thread(
            fetch_ohlcv, request.ticker, request.date_from, request.date_to
        )
        benchmark_df = await asyncio.to_thread(
            fetch_ohlcv, request.benchmark, request.date_from, request.date_to
        )
    except ValueError as exc:
        yield _sse("error", message=str(exc))
        return

    # ── Strategy-specific pre-fetching ─────────────────────────────────────────
    df_b = None
    if request.strategy_type == StrategyType.EARNINGS_DRIFT:
        earnings_data = await asyncio.to_thread(fetch_earnings, request.ticker)
        request.fixed_parameters["_earnings_data"] = earnings_data

    if request.strategy_type == StrategyType.PAIRS_TRADING:
        ticker_b = request.fixed_parameters.get("ticker_b")
        if ticker_b:
            df_b = await asyncio.to_thread(
                fetch_ohlcv, ticker_b, request.date_from, request.date_to
            )

    results = []

    for idx, combo in enumerate(combinations):
        params = {**request.fixed_parameters, **dict(zip(param_keys, combo))}

        try:
            strategy = get_strategy(
                request.strategy_type, params, request.risk_settings
            )
            if isinstance(strategy, PairsTradingStrategy) and df_b is not None:
                strategy.set_df_b(df_b)
            trades, equity_curve = await asyncio.to_thread(
                strategy.run, df, request.risk_settings.starting_capital
            )
            response = await asyncio.to_thread(
                compute_metrics,
                trades,
                equity_curve,
                benchmark_df,
                request.risk_settings.starting_capital,
            )
            metric_value = getattr(response.metrics, request.optimize_for, None)
        except Exception:
            metric_value = None

        entry = {
            "params": {k: round(float(v), 6) for k, v in zip(param_keys, combo)},
            "metric": (
                round(float(metric_value), 6) if metric_value is not None else None
            ),
        }
        results.append(entry)

        pct = round((idx + 1) / total * 100, 1)
        param_str = ", ".join(f"{k}={round(v, 3)}" for k, v in zip(param_keys, combo))
        yield _sse(
            "progress",
            percent=pct,
            message=f"[{idx+1}/{total}] {param_str}",
            result=entry,
        )
        await asyncio.sleep(0)

    yield _sse("complete", results=results)


def _sse(
    event_type: str,
    *,
    percent: float | None = None,
    message: str | None = None,
    results=None,
    result=None,
) -> str:
    data: dict = {"type": event_type}
    if percent is not None:
        data["percent"] = percent
    if message is not None:
        data["message"] = message
    if results is not None:
        data["results"] = results
    if result is not None:
        data["result"] = result
    return f"data: {json.dumps(data, allow_nan=False)}\n\n"
