"""Backtest router — triggers strategy runs and streams progress via SSE."""
import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.models.schemas import BacktestRequest, BacktestResponse, OptimizeRequest
from app.services.data_fetcher import fetch_ohlcv
from app.services.metrics import compute_metrics
from app.services.optimizer import run_grid_search
from app.engine.base import get_strategy

router = APIRouter()


async def _stream_backtest(request: BacktestRequest) -> AsyncGenerator[str, None]:
    """Run a backtest and yield SSE-formatted progress events."""
    try:
        yield _sse("progress", percent=10, message="Fetching market data…")
        await asyncio.sleep(0)  # allow event loop to flush

        df = await asyncio.to_thread(fetch_ohlcv, request.ticker, request.date_from, request.date_to)
        benchmark_df = await asyncio.to_thread(fetch_ohlcv, request.benchmark, request.date_from, request.date_to)

        yield _sse("progress", percent=30, message="Running strategy…")
        await asyncio.sleep(0)

        strategy = get_strategy(request.strategy_type, request.parameters, request.risk_settings)
        trades, equity_curve = await asyncio.to_thread(strategy.run, df, request.risk_settings.starting_capital)

        yield _sse("progress", percent=70, message="Computing metrics…")
        await asyncio.sleep(0)

        results: BacktestResponse = await asyncio.to_thread(
            compute_metrics, trades, equity_curve, benchmark_df, request.risk_settings.starting_capital
        )

        yield _sse("progress", percent=100, message="Done")
        await asyncio.sleep(0)
        yield _sse("complete", results=results.model_dump())

    except Exception as exc:
        yield _sse("error", message=str(exc))


def _sse(event_type: str, *, percent: float | None = None, message: str | None = None, results=None) -> str:
    data = {"type": event_type}
    if percent is not None:
        data["percent"] = percent
    if message is not None:
        data["message"] = message
    if results is not None:
        data["results"] = results
    return f"data: {json.dumps(data)}\n\n"


@router.post("/run")
async def run_backtest(request: BacktestRequest):
    """Stream backtest progress and results as Server-Sent Events."""
    return StreamingResponse(
        _stream_backtest(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/optimize")
async def optimize_backtest(request: OptimizeRequest):
    """Stream optimization grid search progress as SSE."""
    async def _stream():
        async for event in run_grid_search(request):
            yield event

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
