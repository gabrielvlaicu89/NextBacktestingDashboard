"""SSE streaming tests — backtest progress events + grid-search optimization.

Test that both /api/backtest/run and /api/backtest/optimize emit well-formed
SSE events with correct event types, progressive results, and error handling.
"""
from unittest.mock import patch
import json

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_df


@pytest.fixture
def client():
    return TestClient(app)


def _mock_ohlcv(*args, **kwargs):
    """Return synthetic OHLCV data."""
    np.random.seed(42)
    prices = list(np.random.normal(100, 2, 60))
    return make_df(prices)


def _parse_sse(text: str) -> list[dict]:
    """Parse SSE text into a list of JSON event dicts."""
    events = []
    for block in text.split("\n\n"):
        block = block.strip()
        if block.startswith("data: "):
            data_str = block.replace("data: ", "", 1)
            try:
                events.append(json.loads(data_str))
            except json.JSONDecodeError:
                continue
    return events


# ── Backtest SSE ────────────────────────────────────────────────────────────────


class TestBacktestSSE:
    """Backtest SSE endpoint event format and lifecycle."""

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_sse_content_type(self, mock_fetch, client):
        """Response Content-Type is text/event-stream."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
            },
        )
        assert "text/event-stream" in response.headers["content-type"]

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_progress_events_have_percent_and_message(self, mock_fetch, client):
        """Progress events contain percent (number) and message (string)."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "MA_CROSSOVER",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "parameters": {"fast_period": 5, "slow_period": 20, "ma_type": "SMA"},
            },
        )
        events = _parse_sse(response.text)
        progress_events = [e for e in events if e["type"] == "progress"]
        assert len(progress_events) > 0

        for ev in progress_events:
            assert isinstance(ev["percent"], (int, float))
            assert isinstance(ev["message"], str)

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_progress_percentages_increase(self, mock_fetch, client):
        """Progress percentages should be non-decreasing."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "parameters": {"zscore_window": 20, "zscore_threshold": 2.0, "holding_period": 10},
            },
        )
        events = _parse_sse(response.text)
        progress_pcts = [e["percent"] for e in events if e["type"] == "progress"]
        assert progress_pcts == sorted(progress_pcts)

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_complete_event_has_full_results(self, mock_fetch, client):
        """Complete event has metrics, equity_curve, drawdown_series, monthly_returns, trades."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
            },
        )
        events = _parse_sse(response.text)
        complete = next(e for e in events if e["type"] == "complete")
        results = complete["results"]

        required_keys = ["metrics", "equity_curve", "drawdown_series", "monthly_returns", "trades"]
        for key in required_keys:
            assert key in results, f"Missing key: {key}"

        metric_keys = [
            "total_return_pct", "annualized_return_pct", "max_drawdown_pct",
            "sharpe_ratio", "sortino_ratio", "win_rate_pct", "profit_factor",
        ]
        for key in metric_keys:
            assert key in results["metrics"], f"Missing metric: {key}"

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_stream_ends_with_complete_or_error(self, mock_fetch, client):
        """Final event in the stream should be 'complete' or 'error'."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
            },
        )
        events = _parse_sse(response.text)
        assert len(events) > 0
        assert events[-1]["type"] in ("complete", "error")

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=ValueError("No data found"))
    def test_data_fetch_error_yields_sse_error(self, mock_fetch, client):
        """Data fetch failure yields an SSE error event, not HTTP 500."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "BADTICKER",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "parameters": {"zscore_window": 20, "zscore_threshold": 2.0, "holding_period": 10},
            },
        )
        assert response.status_code == 200
        events = _parse_sse(response.text)
        error_event = next(e for e in events if e["type"] == "error")
        assert "No data found" in error_event["message"]

    def test_invalid_strategy_type_returns_422(self, client):
        """Unknown strategy type returns 422 validation error."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "NONEXISTENT",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
            },
        )
        assert response.status_code == 422


# ── Optimize SSE ────────────────────────────────────────────────────────────────


class TestOptimizeSSE:
    """Grid-search optimization SSE endpoint with progressive results."""

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_returns_sse_stream(self, mock_fetch, client):
        """POST /api/backtest/optimize returns text/event-stream."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"holding_period": 10},
                "param_ranges": {
                    "zscore_window": {"min": 10, "max": 20, "step": 10},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_emits_progress_and_complete(self, mock_fetch, client):
        """Optimization stream contains progress and complete events."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"holding_period": 10},
                "param_ranges": {
                    "zscore_window": {"min": 10, "max": 20, "step": 10},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        events = _parse_sse(response.text)
        types = [e["type"] for e in events]
        assert "progress" in types
        assert "complete" in types

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_progress_includes_individual_results(self, mock_fetch, client):
        """Each progress event (after the initial) includes a 'result' field."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"holding_period": 10},
                "param_ranges": {
                    "zscore_window": {"min": 10, "max": 20, "step": 10},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        events = _parse_sse(response.text)
        progress_with_results = [
            e for e in events if e["type"] == "progress" and "result" in e
        ]
        assert len(progress_with_results) >= 2  # at least 2 param combos

        for ev in progress_with_results:
            assert "params" in ev["result"]
            assert "metric" in ev["result"]

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_complete_has_all_results(self, mock_fetch, client):
        """Complete event contains results array matching the number of combinations."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {},
                "param_ranges": {
                    "placeholder": {"min": 1, "max": 3, "step": 1},
                },
                "optimize_for": "total_return_pct",
            },
        )
        events = _parse_sse(response.text)
        complete = next(e for e in events if e["type"] == "complete")
        # 3 combinations: 1, 2, 3
        assert len(complete["results"]) == 3

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_progress_percentages_reach_100(self, mock_fetch, client):
        """Progress events should reach 100% by the end."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {},
                "param_ranges": {
                    "placeholder": {"min": 1, "max": 2, "step": 1},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        events = _parse_sse(response.text)
        progress_pcts = [e["percent"] for e in events if e["type"] == "progress" and "percent" in e]
        assert 100.0 in progress_pcts

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=ValueError("Ticker not found"))
    def test_optimize_data_fetch_error(self, mock_fetch, client):
        """Data fetch failure during optimization yields SSE error event."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "BADTICKER",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"holding_period": 10},
                "param_ranges": {
                    "zscore_window": {"min": 10, "max": 20, "step": 10},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        assert response.status_code == 200
        events = _parse_sse(response.text)
        assert any(e["type"] == "error" for e in events)

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_empty_param_range_yields_error(self, mock_fetch, client):
        """Zero parameter combinations yields an error event."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"holding_period": 10},
                "param_ranges": {
                    "zscore_window": {"min": 30, "max": 10, "step": 5},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        events = _parse_sse(response.text)
        assert any(e["type"] == "error" for e in events)

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_ma_crossover(self, mock_fetch, client):
        """Optimization with MA_CROSSOVER strategy works end-to-end."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MA_CROSSOVER",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"ma_type": "SMA"},
                "param_ranges": {
                    "fast_period": {"min": 5, "max": 10, "step": 5},
                    "slow_period": {"min": 20, "max": 30, "step": 10},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        events = _parse_sse(response.text)
        complete = next(e for e in events if e["type"] == "complete")
        # 2 fast x 2 slow = 4 combinations
        assert len(complete["results"]) == 4

    @patch("app.services.optimizer.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_optimize_result_structure(self, mock_fetch, client):
        """Each result entry has params dict and metric value."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "fixed_parameters": {"holding_period": 10},
                "param_ranges": {
                    "zscore_window": {"min": 15, "max": 20, "step": 5},
                },
                "optimize_for": "sharpe_ratio",
            },
        )
        events = _parse_sse(response.text)
        complete = next(e for e in events if e["type"] == "complete")

        for result in complete["results"]:
            assert "params" in result
            assert "metric" in result
            assert "zscore_window" in result["params"]

    def test_optimize_invalid_request_returns_422(self, client):
        """Missing required fields returns 422."""
        response = client.post(
            "/api/backtest/optimize",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
            },
        )
        assert response.status_code == 422
