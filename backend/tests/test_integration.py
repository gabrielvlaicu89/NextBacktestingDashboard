"""Integration tests — full backtest flow through FastAPI endpoints."""

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
    """Return synthetic OHLCV data with a mean-reversion-friendly pattern."""
    np.random.seed(99)
    stable = list(np.random.normal(100, 1, 30))
    dip = [80, 78, 80, 85, 90, 95, 100, 105, 108, 110]
    recovery = list(np.random.normal(105, 1, 20))
    return make_df(stable + dip + recovery)


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


@patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
def test_mean_reversion_backtest(mock_fetch, client):
    """POST /api/backtest/run with MEAN_REVERSION returns valid SSE stream."""
    response = client.post(
        "/api/backtest/run",
        json={
            "strategy_type": "MEAN_REVERSION",
            "ticker": "SPY",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "parameters": {
                "zscore_window": 20,
                "zscore_threshold": 2.0,
                "holding_period": 10,
            },
        },
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert len(events) >= 2

    types = [e["type"] for e in events]
    assert "progress" in types
    assert "complete" in types

    complete = next(e for e in events if e["type"] == "complete")
    results = complete["results"]
    assert "metrics" in results
    assert "equity_curve" in results
    assert "trades" in results


@patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
def test_buy_and_hold_backtest(mock_fetch, client):
    """POST /api/backtest/run with BUY_AND_HOLD returns valid result."""
    response = client.post(
        "/api/backtest/run",
        json={
            "strategy_type": "BUY_AND_HOLD",
            "ticker": "SPY",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
        },
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    complete = next(e for e in events if e["type"] == "complete")
    assert complete["results"]["metrics"]["total_return_pct"] != 0


def test_health_check(client):
    """GET /health returns ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@patch("app.routers.backtest.fetch_ohlcv", side_effect=ValueError("bad ticker"))
def test_backtest_error_handling(mock_fetch, client):
    """Invalid ticker should produce an SSE error event, not a 500."""
    response = client.post(
        "/api/backtest/run",
        json={
            "strategy_type": "MEAN_REVERSION",
            "ticker": "INVALID",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "parameters": {
                "zscore_window": 20,
                "zscore_threshold": 2.0,
                "holding_period": 10,
            },
        },
    )

    assert response.status_code == 200  # SSE always returns 200
    events = _parse_sse(response.text)
    assert any(e["type"] == "error" for e in events)


@patch("app.routers.backtest.fetch_ohlcv", side_effect=_mock_ohlcv)
def test_custom_strategy_backtest(mock_fetch, client):
    """POST /api/backtest/run with CUSTOM returns a complete SSE result."""
    response = client.post(
        "/api/backtest/run",
        json={
            "strategy_type": "CUSTOM",
            "ticker": "SPY",
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "parameters": {
                "custom_definition": {
                    "version": 1,
                    "name": "Price Threshold Draft",
                    "description": "Long when price recovers above 90.",
                    "indicators": [],
                    "longEntry": {
                        "type": "group",
                        "operator": "AND",
                        "conditions": [
                            {
                                "type": "condition",
                                "left": {"kind": "price", "field": "CLOSE"},
                                "comparator": ">",
                                "right": {"kind": "constant", "value": 90},
                            }
                        ],
                    },
                    "longExit": {
                        "type": "group",
                        "operator": "AND",
                        "conditions": [
                            {
                                "type": "condition",
                                "left": {"kind": "price", "field": "CLOSE"},
                                "comparator": "<",
                                "right": {"kind": "constant", "value": 89},
                            }
                        ],
                    },
                    "shortEntry": {
                        "type": "group",
                        "operator": "AND",
                        "conditions": [],
                    },
                    "shortExit": {
                        "type": "group",
                        "operator": "AND",
                        "conditions": [],
                    },
                }
            },
        },
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert any(event["type"] == "complete" for event in events)
