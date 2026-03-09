"""Unit tests for the custom strategy engine."""

import pytest

from app.engine.custom_strategy import CustomStrategy
from app.models.schemas import RiskSettings
from tests.conftest import make_df


def make_custom_definition(include_short_rules: bool = False) -> dict:
    return {
        "version": 1,
        "name": "SMA Cross Draft",
        "description": "Long-only custom strategy for tests.",
        "indicators": [
            {
                "id": "sma-1",
                "indicatorId": "SMA",
                "label": "SMA 3",
                "params": {"period": 3},
            }
        ],
        "longEntry": {
            "type": "group",
            "operator": "AND",
            "conditions": [
                {
                    "type": "condition",
                    "left": {"kind": "price", "field": "CLOSE"},
                    "comparator": "crosses_above",
                    "right": {
                        "kind": "indicator",
                        "indicatorId": "sma-1",
                        "output": "value",
                    },
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
                    "comparator": "crosses_below",
                    "right": {
                        "kind": "indicator",
                        "indicatorId": "sma-1",
                        "output": "value",
                    },
                }
            ],
        },
        "shortEntry": {
            "type": "group",
            "operator": "AND",
            "conditions": (
                [
                    {
                        "type": "condition",
                        "left": {"kind": "price", "field": "CLOSE"},
                        "comparator": "<",
                        "right": {"kind": "constant", "value": 100},
                    }
                ]
                if include_short_rules
                else []
            ),
        },
        "shortExit": {
            "type": "group",
            "operator": "AND",
            "conditions": [],
        },
    }


def test_custom_strategy_generates_entry_and_exit_signals():
    prices = [100, 99, 98, 99, 101, 104, 106, 105, 102, 99, 97, 100, 103]
    df = make_df(prices)
    strategy = CustomStrategy(
        {"custom_definition": make_custom_definition()}, RiskSettings()
    )

    result = strategy.generate_signals(df)

    assert (result["signal"] == 1).sum() >= 1
    assert (result["signal"] == -1).sum() >= 1


def test_custom_strategy_runs_full_backtest_cycle():
    prices = [100, 99, 98, 99, 101, 104, 106, 105, 102, 99, 97, 100, 103]
    df = make_df(prices)
    strategy = CustomStrategy(
        {"custom_definition": make_custom_definition()}, RiskSettings()
    )

    trades, equity_curve = strategy.run(df, 10_000)

    assert len(trades) >= 1
    assert len(equity_curve) == len(df)
    assert trades[0].exit_reason in {"signal", "end_of_period"}


def test_custom_strategy_rejects_short_side_rules_for_now():
    prices = [100, 99, 98, 99, 101, 104, 106, 105, 102, 99, 97, 100, 103]
    df = make_df(prices)
    strategy = CustomStrategy(
        {"custom_definition": make_custom_definition(include_short_rules=True)},
        RiskSettings(),
    )

    with pytest.raises(ValueError, match="long-entry and long-exit rules only"):
        strategy.generate_signals(df)