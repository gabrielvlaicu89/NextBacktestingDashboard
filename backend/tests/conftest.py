"""Shared test helpers for the backend test suite."""

import pandas as pd


def make_df(prices: list[float], start_date: str = "2024-01-02") -> pd.DataFrame:
    """Create a minimal OHLCV DataFrame from a list of close prices."""
    dates = pd.bdate_range(start_date, periods=len(prices))
    return pd.DataFrame(
        {
            "Open": prices,
            "High": [p * 1.01 for p in prices],
            "Low": [p * 0.99 for p in prices],
            "Close": prices,
            "Volume": [1_000_000] * len(prices),
        },
        index=dates,
    )
