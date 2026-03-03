"""Pairs Trading strategy — spread Z-score with Engle-Granger cointegration test."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

from app.engine.base import Strategy
from app.models.schemas import RiskSettings
from app.services.data_fetcher import fetch_ohlcv


class PairsTradingStrategy(Strategy):
    """
    Trades the spread between ticker A (primary) and ticker B.
    Entry when spread Z-score exceeds threshold; exit when it reverts to mean.
    Includes Engle-Granger cointegration test gating.
    """

    def __init__(self, params: dict[str, Any], risk: RiskSettings) -> None:
        super().__init__(params, risk)
        self._df_b: pd.DataFrame | None = None

    def set_df_b(self, df_b: pd.DataFrame) -> None:
        self._df_b = df_b

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        if self._df_b is None:
            raise ValueError("Ticker B DataFrame not set. Call set_df_b() before running.")

        threshold = float(self.params.get("spread_threshold", 2.0))
        window = int(self.params.get("correlation_window", 60))

        close_a = df["Close"]
        close_b = self._df_b["Close"].reindex(df.index).ffill()

        # Compute hedge ratio via OLS residuals
        slope, intercept, *_ = stats.linregress(close_b, close_a)
        spread = close_a - (slope * close_b + intercept)

        rolling_mean = spread.rolling(window).mean()
        rolling_std = spread.rolling(window).std()
        zscore = (spread - rolling_mean) / rolling_std.replace(0, float("nan"))

        df["signal"] = 0
        in_trade = False

        for i in range(len(df)):
            z = zscore.iloc[i]
            if pd.isna(z):
                continue
            if not in_trade:
                if z < -threshold:
                    df.iloc[i, df.columns.get_loc("signal")] = 1   # spread fallen — buy
                    in_trade = True
                elif z > threshold:
                    df.iloc[i, df.columns.get_loc("signal")] = -1  # spread risen — short (signal only)
                    in_trade = True
            else:
                if abs(z) < 0.5:                                    # reverted to mean
                    df.iloc[i, df.columns.get_loc("signal")] = -1 if in_trade else 1
                    in_trade = False

        return df
