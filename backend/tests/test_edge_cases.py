"""Tests for Phase 11 — date validation, pairs trading edge cases,
improved error messages, and Alpha Vantage rate limiting."""
from unittest.mock import patch, MagicMock
import json
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.models.schemas import BacktestRequest, OptimizeRequest
from app.services.data_fetcher import _AlphaVantageRateLimiter, fetch_earnings
from tests.conftest import make_df


@pytest.fixture
def client():
    return TestClient(app)


def _mock_ohlcv(*args, **kwargs):
    """Return synthetic OHLCV data."""
    np.random.seed(99)
    prices = list(np.random.normal(100, 1, 60))
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


# ---------------------------------------------------------------------------
# Pydantic date validation
# ---------------------------------------------------------------------------

class TestDateValidation:
    def test_backtest_request_rejects_date_to_before_date_from(self):
        with pytest.raises(ValidationError, match="date_to must be after date_from"):
            BacktestRequest(
                strategy_type="MEAN_REVERSION",
                ticker="SPY",
                date_from="2024-12-31",
                date_to="2024-01-01",
            )

    def test_backtest_request_rejects_equal_dates(self):
        with pytest.raises(ValidationError, match="date_to must be after date_from"):
            BacktestRequest(
                strategy_type="MEAN_REVERSION",
                ticker="SPY",
                date_from="2024-06-15",
                date_to="2024-06-15",
            )

    def test_backtest_request_accepts_valid_dates(self):
        req = BacktestRequest(
            strategy_type="MEAN_REVERSION",
            ticker="SPY",
            date_from="2024-01-01",
            date_to="2024-12-31",
        )
        assert req.date_from.year == 2024
        assert req.date_to.month == 12

    def test_optimize_request_rejects_date_to_before_date_from(self):
        with pytest.raises(ValidationError, match="date_to must be after date_from"):
            OptimizeRequest(
                strategy_type="MEAN_REVERSION",
                ticker="SPY",
                date_from="2024-12-31",
                date_to="2024-01-01",
                param_ranges={"zscore_window": {"min": 10, "max": 30, "step": 5}},
            )

    def test_optimize_request_accepts_valid_dates(self):
        req = OptimizeRequest(
            strategy_type="MEAN_REVERSION",
            ticker="SPY",
            date_from="2024-01-01",
            date_to="2024-12-31",
            param_ranges={"zscore_window": {"min": 10, "max": 30, "step": 5}},
        )
        assert req.date_from < req.date_to

    def test_api_returns_422_for_invalid_dates(self, client):
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "MEAN_REVERSION",
                "ticker": "SPY",
                "date_from": "2024-12-31",
                "date_to": "2024-01-01",
            },
        )
        assert response.status_code == 422

    def test_api_returns_422_for_equal_dates(self, client):
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-06-15",
                "date_to": "2024-06-15",
            },
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Pairs trading edge cases
# ---------------------------------------------------------------------------

class TestPairsTradingEdgeCases:
    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_pairs_trading_requires_ticker_b(self, mock_fetch, client):
        """Missing ticker_b yields an SSE error event."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "PAIRS_TRADING",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "parameters": {},
            },
        )
        events = _parse_sse(response.text)
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) >= 1
        assert "ticker_b" in error_events[0]["message"].lower()

    @patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
    def test_pairs_trading_rejects_same_ticker(self, mock_fetch, client):
        """ticker_b == ticker yields an SSE error event."""
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "PAIRS_TRADING",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "parameters": {"ticker_b": "SPY", "correlation_window": 60, "spread_threshold": 2.0},
            },
        )
        events = _parse_sse(response.text)
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) >= 1
        assert "different" in error_events[0]["message"].lower()

    @patch("app.routers.backtest.fetch_ohlcv")
    def test_pairs_trading_handles_ticker_b_data_failure(self, mock_fetch, client):
        """When ticker_b has no data, a clear error event is sent."""
        call_count = 0
        def _side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                # First two calls succeed (ticker A + benchmark)
                return _mock_ohlcv()
            # Third call (ticker B) raises
            raise ValueError("No data returned for ticker 'INVALID' in range ...")

        mock_fetch.side_effect = _side_effect
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "PAIRS_TRADING",
                "ticker": "SPY",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
                "parameters": {"ticker_b": "INVALID", "correlation_window": 60, "spread_threshold": 2.0},
            },
        )
        events = _parse_sse(response.text)
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) >= 1
        assert "INVALID" in error_events[0]["message"]


# ---------------------------------------------------------------------------
# Improved error messages
# ---------------------------------------------------------------------------

class TestImprovedErrorMessages:
    @patch("app.routers.backtest.fetch_ohlcv")
    def test_delisted_ticker_error_message(self, mock_fetch, client):
        """A ticker with no data includes 'delisted' hint in the error."""
        mock_fetch.side_effect = ValueError(
            "No data returned for ticker 'ENRN' in range 2024-01-01 – 2024-12-31. "
            "The ticker may be invalid, delisted, or the date range may predate its listing."
        )
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "ENRN",
                "date_from": "2024-01-01",
                "date_to": "2024-12-31",
            },
        )
        events = _parse_sse(response.text)
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) >= 1
        assert "delisted" in error_events[0]["message"]

    @patch("app.routers.backtest.fetch_ohlcv")
    def test_insufficient_data_mentions_weekends(self, mock_fetch, client):
        """Insufficient data error includes weekends/holidays note."""
        mock_fetch.side_effect = ValueError(
            "Insufficient data for 'SPY': only 3 trading days found "
            "in range 2024-12-30 – 2025-01-03. "
            "Try a wider date range (weekends and holidays are excluded automatically)."
        )
        response = client.post(
            "/api/backtest/run",
            json={
                "strategy_type": "BUY_AND_HOLD",
                "ticker": "SPY",
                "date_from": "2024-12-30",
                "date_to": "2025-01-03",
            },
        )
        events = _parse_sse(response.text)
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) >= 1
        assert "weekends" in error_events[0]["message"]


# ---------------------------------------------------------------------------
# Alpha Vantage rate limiter
# ---------------------------------------------------------------------------

class TestAlphaVantageRateLimiter:
    def test_limiter_allows_requests_within_limit(self):
        limiter = _AlphaVantageRateLimiter(max_per_day=5)
        for _ in range(5):
            assert limiter.acquire(timeout=1) is True

    def test_limiter_blocks_beyond_limit(self):
        limiter = _AlphaVantageRateLimiter(max_per_day=2)
        assert limiter.acquire(timeout=1) is True
        assert limiter.acquire(timeout=1) is True
        # Third should timeout
        assert limiter.acquire(timeout=1) is False

    def test_limiter_zero_max_blocks_immediately(self):
        limiter = _AlphaVantageRateLimiter(max_per_day=0)
        assert limiter.acquire(timeout=1) is False

    @patch("app.services.data_fetcher._av_limiter")
    def test_fetch_earnings_skips_on_rate_limit(self, mock_limiter):
        """When rate limiter cannot acquire, fetch_earnings returns []."""
        mock_limiter.acquire.return_value = False
        # We must bypass the lru_cache to test the rate limiter
        result = fetch_earnings.__wrapped__("AAPL", api_key="test-key")
        assert result == []
        mock_limiter.acquire.assert_called_once()

    @patch("app.services.data_fetcher._av_limiter")
    @patch("app.services.data_fetcher.httpx.Client")
    def test_fetch_earnings_handles_rate_limit_note(self, mock_client_cls, mock_limiter):
        """When Alpha Vantage returns a 'Note' key, fetch_earnings returns []."""
        mock_limiter.acquire.return_value = True
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"Note": "Thank you for using Alpha Vantage! Our standard API call frequency is 25 calls per day."}
        mock_resp.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        result = fetch_earnings.__wrapped__("AAPL", api_key="test-key")
        assert result == []
